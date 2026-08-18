#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Record Frogger's sounds from YOUR MAME + YOUR ROM into local sample files.

Adapted from games/timeplt/tools/record_samples.py -- same posture, Frogger's sound hardware.

arcade-js plays audio ABOVE the emulation: the board watches the program's sound-latch writes and a
SamplePlayer plays a recorded clip. We do NOT emulate Frogger's audio (the second Z80 + AY-3-8910 PSG);
we record what each command PRODUCES. That audio is the ROM authors' copyrighted work, so we ship NONE
of it: this drives YOUR MAME against YOUR romset and writes to a gitignored dir
(games/frogger/audio/samples/, matched by .gitignore's games/*/audio/samples/). Do not commit or
redistribute anything it makes.

TRIGGER (MAME galaxian/galaxian.cpp frogger_ppi8255_w + konami_sound_control_w; the ROM's own
issueSoundCommand @ ROM 0x0794). Frogger is a Galaxian-family board, NOT the konami/ driver timeplt
comes from -- the sound hand-off differs. Delivering a command takes THREE ordered writes on the
:maincpu program space, all the same frame, in THIS order:
  1. write 0xD000 = <command byte>   (PPI1 port A -- the 8-bit latch the sound CPU reads)
  2. write 0xD002 = <ctrl, bit3 CLEAR, bit4 clear>  e.g. 0x00  -- the FALLING edge of bit3 (1->0)
     asserts the sound CPU's /INT, which is what fires the sound
  3. write 0xD002 = <ctrl, bit3 SET,   bit4 clear>  e.g. 0x08  -- re-arm bit3 high so the next
     command's falling edge fires again
The command MUST be at 0xD000 BEFORE the falling edge (the sound Z80 reads the latch in its /INT
handler). NOTE the FALLING edge -- UNLIKE Time Pilot's rising edge on a separate attention line. bit4
of 0xD002 is the sound MUTE; we keep it 0 (unmuted) throughout. To STOP a sustained command, re-issue
the full 3-write sequence with a stop byte (default 0x00). Because the falling edge needs bit3 HIGH
first, the mute-hold table pre-seeds 0xD002=0x08 so bit3 idles high even before the first injection.

DISCOVERY SWEEP, not a sound map: sweeps the command byte, records what each value produced (peak/RMS
per clip). Default sweeps the full emit set the game sends (hop=0x04, drown=0x02, squash=0x03,
fly-eat=0x18, countdown=0x05/0x06, start jingle=0x09/0x0a/0x0b, game-over=0x0c/0x0d, board-advance=0x10/0x30,
spawn=0x90, lane=0xd0, home=0x08/0xf0, end-of-seq=0x0f/0xb0); pass --commands to sweep a different range.
TWO PASSES tell a one-shot from a looping tune: the stop (command 0 + falling edge) INTERRUPTS a playing
sound, so the pulse pass (stop early) truncates everything and is only an amplitude probe; the SUSTAIN
pass (stop at --sustain-hold) classifies -- still sounding at the late stop => SUSTAINED (a loop period
is cut from it), else one-shot. ROM contamination is blocked by write taps on EXACTLY {0xD000, 0xD002}
(never 0xD004=IN3 input or 0xD006=PPI1 control -- tapping those breaks the machine); silent gaps prove
it (--report-gaps). --stop-value (default 0, issued with its own falling edge) silences a command
between slots.

Run: record_samples.py --rompath ~/Downloads [--commands 0x00-0x1f,0x80] [--report-gaps] [--dry-run]
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import wave

REPO = os.path.dirname(  # <repo>
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
sys.path.insert(0, os.path.join(REPO, "tools"))

import hardware  # noqa: E402

# The determinism-controlled MAME command line lives in ONE place. Reusing
# mame_golden.build_mame_argv means the recording runs under exactly the flags
# the pixel-golden captures run under (fresh nvram/cfg, -nocheat, -noautosave,
# -frameskip 0, -nothrottle, headless video, -sound none), and any future fix
# there applies here for free. -sound none does NOT stop MAME synthesising the
# emulated audio -- it only drops the live host output device -- so -wavwrite
# still captures the full mixer stream. Importing this module also installs the
# headless SDL_VIDEODRIVER=dummy.
import mame_golden  # noqa: E402

# --- Frogger sound hardware addresses -------------------------------------
# Mirrors boards/frogger/hardware.json ppi_window + MAME galaxian/galaxian.cpp
# frogger_ppi8255_w. A command is delivered by THREE ordered writes: park the
# byte in the latch (0xD000 = PPI1 port A), then pulse the control port
# (0xD002 = PPI1 port B) bit 3 LOW then HIGH. The sound Z80 acts on the FALLING
# edge (bit3 1->0) -- see _trigger(). UNLIKE Time Pilot, there is no separate
# attention line: the command latch and the /INT strobe are two ports of the
# SAME PPI, and the edge is FALLING, not rising.
SOUND_CMD_LATCH = 0xD000   # command byte -> sound Z80 (PPI1 port A; galaxian.cpp frogger_ppi8255_w)
SOUND_CTRL_PORT = 0xD002   # PPI1 port B; bit3 -> sound CPU /INT (falling edge fires); bit4 = mute
CTRL_INT_BIT = 0x08        # bit 3: the /INT line. Idle HIGH; drive LOW for the falling edge.
CTRL_IDLE = 0x08           # idle control value: bit3 HIGH (armed), bit4 (mute) LOW (unmuted)

# What the ROM is prevented from writing while a sweep runs, so its own attract
# sounds cannot contaminate the clips: EXACTLY the two sound bytes. 0xD004 is IN3
# (an input) and 0xD006 is the PPI1 control register -- tapping either breaks the
# machine, so we tap ONLY {0xD000, 0xD002}, never the 0xD00x range.
DEFAULT_MUTE = "0xD000,0xD002"

# The falling-edge trigger needs bit3 HIGH before it is driven low. The mute tap
# replaces every blocked ROM write with the value we are "holding"; seeding the
# ctrl port's hold to CTRL_IDLE (bit3 high) means the actual hardware bit3 idles
# high all through boot, so even the FIRST injected command has a real 1->0 edge.
IDLE_HOLDS = {SOUND_CTRL_PORT: CTRL_IDLE}

DEFAULT_OUT = os.path.join("games", "frogger", "audio", "samples")
DEFAULT_HARDWARE = os.path.join("boards", "frogger", "hardware.json")

# ---------------------------------------------------------------------------
# Sample-buffer helpers. numpy if present (it is, in this repo), stdlib if not:
# a BYO-ROM user should not need to install anything to record their own audio.
# ---------------------------------------------------------------------------
try:
    import numpy as _np
except ImportError:  # pragma: no cover -- exercised only on a numpy-less host
    _np = None


def _peak_rms(buf):
    """(peak, rms) of a mean-removed buffer."""
    if len(buf) == 0:
        return 0.0, 0.0
    if _np is not None:
        return float(_np.max(_np.abs(buf))), float(_np.sqrt(_np.mean(buf * buf)))
    peak = max(abs(v) for v in buf)
    rms = math.sqrt(sum(v * v for v in buf) / len(buf))
    return float(peak), float(rms)


def _trim(buf, threshold):
    """First/last index whose magnitude clears `threshold`; (None, None) if silent."""
    if len(buf) == 0:
        return None, None
    if _np is not None:
        hits = _np.flatnonzero(_np.abs(buf) >= threshold)
        if hits.size == 0:
            return None, None
        return int(hits[0]), int(hits[-1]) + 1
    first = last = None
    for i, v in enumerate(buf):
        if abs(v) >= threshold:
            if first is None:
                first = i
            last = i
    if first is None:
        return None, None
    return first, last + 1


def _median(seq):
    if _np is not None:
        return float(_np.median(seq)) if len(seq) else 0.0
    s = sorted(seq)
    n = len(s)
    if n == 0:
        return 0.0
    return float(s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2)


def center(seg):
    """Subtract a segment's idle DC, estimated by its MEDIAN.

    MEASURED, and the reason a plain mean will not do: an AY-3-8910-family PSG
    sits at a large idle DC bias that STEPS between sounds. A single MEAN removed
    over a slot is dragged toward the loud part, so the constant-DC silent tail
    ends up far from zero and reads as signal -- which makes a one-shot look
    sustained. The MEDIAN of a slot window (silence dominates it, or the whole
    window IS one sustained sound) tracks the idle level robustly, so silence
    lands at ~0. A truly sustained sound that fills the window instead centres on
    the sound -- which correctly leaves its brief end tail reading as 'still
    sounding', i.e. sustained.
    """
    if _np is not None:
        a = _np.asarray(seg, dtype=_np.float64)
        return (a - _np.median(a)) if len(a) else a
    m = _median(seg)
    return [v - m for v in seg]


def load_recording(wav_path):
    """Read the session wav, downmix to mono float. -> (samples, rate).

    Raw (DC not yet removed): the idle DC is removed per-segment by center(),
    which needs the untouched signal to estimate each segment's own idle level.
    """
    with wave.open(wav_path, "rb") as w:
        channels, sampwidth, rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
        nframes = w.getnframes()
        raw = w.readframes(nframes)
    if sampwidth != 2:
        raise RuntimeError(f"{wav_path}: expected 16-bit PCM, got {sampwidth*8}-bit")
    if _np is not None:
        a = _np.frombuffer(raw, dtype="<i2").astype(_np.float64)
        if channels > 1 and len(a):
            a = a.reshape(-1, channels).mean(axis=1)
    else:
        import array

        b = array.array("h")
        b.frombytes(raw)
        a = (
            [sum(b[i : i + channels]) / channels for i in range(0, len(b), channels)]
            if channels > 1
            else list(b)
        )
    return a, rate


def _to_int16(buf):
    """A mono float buffer -> 16-bit LE PCM bytes, hard-clipped to the int16 range."""
    if _np is not None:
        return _np.clip(_np.rint(_np.asarray(buf)), -32768, 32767).astype("<i2").tobytes()
    import array

    return array.array(
        "h", (max(-32768, min(32767, int(round(v)))) for v in buf)
    ).tobytes()


# ---------------------------------------------------------------------------
# Value / range parsing
# ---------------------------------------------------------------------------
def parse_values(spec):
    """'0x00-0x1f,0x80,0x8a' -> [0,1,...,31,128,138]. Ranges are inclusive."""
    out = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part[1:]:  # not a leading minus
            lo, hi = part.split("-", 1)
            lo, hi = int(lo, 0), int(hi, 0)
            if hi < lo:
                raise ValueError(f"descending range {part!r}")
            out.extend(range(lo, hi + 1))
        else:
            out.append(int(part, 0))
    seen, uniq = set(), []
    for v in out:
        if not 0 <= v <= 0xFF:
            raise ValueError(f"value {v} out of 0..255")
        if v not in seen:
            seen.add(v)
            uniq.append(v)
    return uniq


def parse_ranges(spec):
    """'0xD000' -> [(0xD000,0xD000)]; '0xD000,0xD002' -> two ranges."""
    out = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part[1:]:
            lo, hi = part.split("-", 1)
            lo, hi = int(lo, 0), int(hi, 0)
        else:
            lo = hi = int(part, 0)
        if hi < lo:
            raise ValueError(f"descending range {part!r}")
        out.append((lo, hi))
    return out


# A slot id is a filename stem, so the sustain pass needs a suffix that cannot
# collide with a real clip id. It never reaches disk: the sustain pass is merged
# into its command's single output clip.
SUSTAIN_SUFFIX = "~sustain"

# What fraction of --sustain-hold a command's SUSTAIN pass must still be sounding
# for before we believe it drives a SUSTAINED (looping) tune. Frogger's stop
# (command 0 + the falling edge) INTERRUPTS whatever is playing, so the pulse
# pass truncates EVERY command at --hold and its length is no baseline. A looping
# tune keeps sounding right up to the late stop at --sustain-hold; a one-shot has
# already decayed.
SUSTAIN_STILL_FRACTION = 0.9


def _trigger(dt, command):
    """The three ordered writes that deliver ONE command to the sound CPU, all at the
    same instant `dt` (seconds from the slot start). Order is load-bearing: the command
    must sit in the latch (0xD000) BEFORE the falling edge on the control port (0xD002),
    because the sound Z80 reads the latch inside the /INT the FALLING edge (bit3 1->0)
    raises. The final write drives bit3 back HIGH to re-arm the edge for the next
    command -- and keeps bit4 (mute) clear throughout."""
    return [
        (dt, SOUND_CMD_LATCH, command),
        (dt, SOUND_CTRL_PORT, CTRL_IDLE & ~CTRL_INT_BIT),  # bit3 LOW -> falling edge fires /INT (0x00)
        (dt, SOUND_CTRL_PORT, CTRL_IDLE),                  # bit3 HIGH -> re-arm (0x08)
    ]


def build_schedule(args):
    """The slot list. Each command produces a PULSE slot and a SUSTAIN slot.

    `key` is the command being measured (`cmd_4`) and names the ONE clip file it
    produces. Every slot triggers the command with the three-write sequence in
    _trigger (load 0xD000, pulse 0xD002 low then high), then re-issues that
    sequence with `stop` at the end of its hold -- for a one-shot the stop is a
    no-op, but it is the hook by which a real --stop-value silences a sustained
    tune. `dt` in `writes` is seconds from the slot's own start.
    """
    slots = []
    hold, gap = args.hold, args.gap
    shold, sgap = args.sustain_hold, args.sustain_gap
    stop = args.stop_value

    for v in args.commands:
        key = f"cmd_{v}"  # DECIMAL, e.g. cmd_24 -> cmd_24.wav
        slots.append(
            {
                "id": key, "key": key, "pass": "pulse", "value": v,
                "hold": hold, "gap": gap,
                "writes": _trigger(0.0, v) + _trigger(hold, stop),
            }
        )
        slots.append(
            {
                "id": key + SUSTAIN_SUFFIX, "key": key, "pass": "sustain", "value": v,
                "hold": shold, "gap": sgap,
                "writes": _trigger(0.0, v) + _trigger(shold, stop),
            }
        )
    return slots


LUA_TEMPLATE = """\
-- SPDX-License-Identifier: GPL-3.0-only
-- GENERATED by games/frogger/tools/record_samples.py -- do not edit.
--
-- Drives Frogger's sound latch (0xD000) and control port (0xD002, bit3 = /INT,
-- FALLING edge) on a fixed schedule and logs the ACTUAL emulated time of every
-- slot, so the recorded wav is split by measured timestamps rather than assumed.

local sp = manager.machine.devices[":maincpu"].spaces["program"]
local out = assert(io.open(os.getenv("SCHEDULE_OUT"), "w"))
out:setvbuf("no")   -- MAME exits without running a Lua stop hook.

-- What we are currently holding on each sound address. ROM writes are replaced
-- with this, so the program cannot touch the sound ports during the sweep. The
-- control port is pre-seeded to its idle (bit3 HIGH) so the falling edge that
-- fires /INT has a real 1->0 transition even for the first injected command.
_G.__hold = {}
%(idle_holds)s
_G.__inject = false
_G.__blocked = 0
_G.__taps = {}

local function mute(lo, hi, name)
  -- Retain the tap: MAME unsubscribes taps on garbage collection, which would
  -- silently un-mute the ROM partway through the sweep.
  _G.__taps[#_G.__taps + 1] = sp:install_write_tap(lo, hi, name,
    function(offset, data, mask)
      if _G.__inject then return data end
      _G.__blocked = _G.__blocked + 1
      return _G.__hold[offset] or 0
    end)
end
%(mutes)s

local function W(addr, val)
  _G.__hold[addr] = val
  _G.__inject = true
  sp:write_u8(addr, val)
  _G.__inject = false
end

-- frame -> { {addr, val}, ... }
local ACTS = %(acts)s
-- frame -> slot id (the clip boundary)
local MARKS = %(marks)s

local BASELINE_FRAME = %(baseline_frame)d
local END_FRAME = %(end_frame)d

local frame = 0
_G.__sub = emu.add_machine_frame_notifier(function()
  frame = frame + 1
  local t = manager.machine.time:as_double()
  if frame == BASELINE_FRAME then
    out:write(string.format("baseline %%.6f\\n", t))
  end
  local m = MARKS[frame]
  if m then out:write(string.format("slot %%s %%.6f\\n", m, t)) end
  local a = ACTS[frame]
  if a then
    for _, w in ipairs(a) do W(w[1], w[2]) end
  end
  if frame == END_FRAME then
    out:write(string.format("end %%.6f\\n", t))
    out:write(string.format("blocked %%d\\n", _G.__blocked))
  end
end)
"""


def lua_table(mapping, fmt):
    """Render a dict as a Lua table literal with integer keys."""
    items = ", ".join(f"[{k}] = {fmt(v)}" for k, v in sorted(mapping.items()))
    return "{ " + items + " }"


def generate_lua(args, hw, slots):
    """Render the autoboot script + return (lua_text, slot_frames, end_frame)."""
    fps = hw.refresh_hz
    boot_frames = max(1, int(round(args.boot * fps)))

    acts = {}
    marks = {}
    slot_frames = []
    start = boot_frames
    for slot in slots:
        slot_frames.append(start)
        marks[start] = slot["id"]
        for dt, addr, val in slot["writes"]:
            f = start + int(round(dt * fps))
            acts.setdefault(f, []).append((addr, val))
        start += max(1, int(round(slot["gap"] * fps)))

    end_frame = start
    # One second of settled silence leading up to the first slot: the noise
    # floor is measured over it, which is why --boot must be >= 1.5s.
    baseline_frame = max(1, boot_frames - int(round(1.0 * fps)))

    mutes = "\n".join(
        f'mute(0x{lo:04X}, 0x{hi:04X}, "mute_{i}")'
        for i, (lo, hi) in enumerate(args.mute_ranges)
    ) or "-- (muting disabled: the program drives the sound ports too)"

    # Only pre-seed the hold of addresses that are actually being muted -- with no
    # tap on the control port there is nothing to read the seed, and the ROM
    # itself would idle bit3 high anyway.
    muted_addrs = set()
    for lo, hi in args.mute_ranges:
        muted_addrs.update(range(lo, hi + 1))
    idle_holds = "\n".join(
        f"_G.__hold[0x{a:04X}] = 0x{v:02X}"
        for a, v in sorted(IDLE_HOLDS.items())
        if a in muted_addrs
    ) or "-- (no idle holds)"

    text = LUA_TEMPLATE % {
        "idle_holds": idle_holds,
        "mutes": mutes,
        "acts": lua_table(
            acts,
            lambda ws: "{ " + ", ".join(f"{{0x{a:04X}, 0x{v:02X}}}" for a, v in ws) + " }",
        ),
        "marks": lua_table(marks, lambda s: f'"{s}"'),
        "baseline_frame": baseline_frame,
        "end_frame": end_frame,
    }
    return text, slot_frames, end_frame


def parse_schedule_log(path):
    """Read the Lua log back: measured slot times, baseline, end, blocked count."""
    slots, baseline, end_t, blocked = [], None, None, None
    with open(path) as fh:
        for line in fh:
            f = line.split()
            if not f:
                continue
            if f[0] == "slot":
                slots.append((f[1], float(f[2])))
            elif f[0] == "baseline":
                baseline = float(f[1])
            elif f[0] == "end":
                end_t = float(f[1])
            elif f[0] == "blocked":
                blocked = int(f[1])
    return slots, baseline, end_t, blocked


# ---------------------------------------------------------------------------
# Loop-period measurement (for SUSTAINED tunes)
# ---------------------------------------------------------------------------
def loop_period(buf, rate, min_period_s, max_period_s, min_corr):
    """Length, in samples, of the repeating phrase in a SUSTAINED recording.

    Normalised autocorrelation: for each candidate lag L, correlate the signal
    with itself shifted by L and divide by the energy of the two overlapping
    halves. The fundamental period is the lag that maximises it; sub-multiples
    are checked so a whole-multiple of the true period does not win.

    @returns (period_samples, correlation) or (None, None) if nothing repeats
             convincingly (a result, not a failure -- the caller then keeps the
             whole recording and says so).
    """
    if _np is None or len(buf) < 4:
        return None, None
    a = _np.asarray(buf, dtype=_np.float64)
    n = len(a)
    lo = max(1, int(min_period_s * rate))
    hi = min(n // 2, int(max_period_s * rate) if max_period_s else n // 2)
    if hi <= lo:
        return None, None

    nfft = 1 << int(math.ceil(math.log2(2 * n)))
    spec = _np.fft.rfft(a, nfft)
    ac = _np.fft.irfft(spec * _np.conj(spec), nfft)[: hi + 1]
    cum = _np.concatenate(([0.0], _np.cumsum(a * a)))
    lags = _np.arange(lo, hi + 1)
    norm = _np.sqrt(_np.maximum((cum[n - lags] - cum[0]) * (cum[n] - cum[lags]), 1e-9))
    nac = ac[lo : hi + 1] / norm

    best = int(_np.argmax(nac))
    period, corr = int(lags[best]), float(nac[best])
    for d in (2, 3, 4, 5):
        sub = period // d
        if sub < lo:
            break
        c = float(nac[sub - lo])
        if c >= corr - 0.02:  # the shorter period explains the signal just as well
            period, corr = sub, c
            break
    if corr < min_corr:
        return None, None
    return period, corr


# ---------------------------------------------------------------------------
# Splitting
# ---------------------------------------------------------------------------
def analyse_slots(full, rate, marks, baseline_t, end_t, args):
    """Slice the mono recording per slot, DC-centre and measure each.

    `full` is the whole recording after load_recording() (mono, raw). Each slot
    segment is idle-DC-centred by center() before measuring. Each row keeps the
    trimmed float samples (`_buf`) so resolve_passes() can pick the pass, cut a
    loop and write the clip. Writes nothing itself.
    """
    n = len(full)

    def cut(t0, t1):
        i0 = max(0, min(n, int(round(t0 * rate))))
        i1 = max(i0, min(n, int(round(t1 * rate))))
        return center(full[i0:i1])

    # Noise floor, measured on this very recording: the 1s of settled silence
    # immediately before the first slot.
    base = cut(baseline_t, marks[0][1]) if marks else center(full[:0])
    base_peak, base_rms = _peak_rms(base)
    threshold = max(float(args.min_peak), base_peak * args.noise_margin)

    rows = []
    for i, (sid, t0) in enumerate(marks):
        t1 = marks[i + 1][1] if i + 1 < len(marks) else end_t
        buf = cut(t0, t1)
        peak, rms = _peak_rms(buf)
        a, b = _trim(buf, threshold)
        row = {
            "id": sid,
            "slot_start_s": round(t0, 6),
            "slot_end_s": round(t1, 6),
            "peak": round(peak, 1),
            "rms": round(rms, 1),
            "silent": a is None,
            "duration_s": 0.0,
            "clipped_at_slot_end": False,
            "_buf": None,
        }
        if a is not None:
            pad = int(round(args.pad * rate))
            a = max(0, a - pad)
            b = min(len(buf), b + pad)
            row["_buf"] = buf[a:b]
            row["duration_s"] = round((b - a) / rate, 4)
            # Still loud at the very end of its slot -> the sound had not
            # finished when the window closed: a looping tune, or --gap too short.
            row["clipped_at_slot_end"] = b >= len(buf) - int(round(0.05 * rate))
        rows.append(row)

    meta = {
        "sample_rate": rate,
        "channels": 1,
        "sample_width_bytes": 2,
        "baseline_peak": round(base_peak, 1),
        "baseline_rms": round(base_rms, 1),
        "silence_threshold": round(threshold, 1),
        "recording_seconds": round(n / rate, 3),
    }
    return rows, meta


def resolve_passes(rows, slots, meta, args, out_dir):
    """Turn per-slot measurements into one clip per command, and write the files.

    The pulse pass and the sustain pass differ ONLY in WHEN the stop is written
    (--hold early vs --sustain-hold late). Frogger's stop (command 0 + the
    falling edge) INTERRUPTS whatever is playing, so the pulse pass truncates
    EVERY command at --hold and its length carries no information. What tells a
    looping tune from a one-shot here is the SUSTAIN pass alone:

      SUSTAINED (looping) <=> its sustain pass is STILL sounding when the late
                              stop hits at --sustain-hold (>= SUSTAIN_STILL_FRACTION
                              of it). A one-shot -- even a long one -- has decayed
                              to silence before then.

      SUSTAINED  -> the clip is ONE LOOP PERIOD of the sustain pass (a whole
                    repeating phrase, ending where it began), or the whole
                    sustain recording if no clean period is found.
      one-shot   -> the clip is the sustain pass, whose late stop cannot cut a
                    self-terminating effect short (falling back to the pulse pass).

    Returns the report rows, one per command, in schedule order. Clips are
    written as `<key>.wav` where key is `cmd_<decimal>` (e.g. cmd_24.wav).
    """
    rate = meta["sample_rate"]
    by_id = {r["id"]: r for r in rows}
    os.makedirs(out_dir, exist_ok=True)

    out = []
    seen = set()
    for slot in slots:
        key = slot["key"]
        if key in seen:
            continue
        seen.add(key)
        pulse = by_id.get(key)
        sustain = by_id.get(key + SUSTAIN_SUFFIX)
        if pulse is None:
            continue  # capture cut short; the missing-slot problem is reported

        row = {
            "id": key,
            "command": slot["value"],
            "command_hex": f"0x{slot['value']:02X}",
            "slot_start_s": pulse["slot_start_s"],
            "slot_end_s": pulse["slot_end_s"],
            "peak": pulse["peak"],
            "rms": pulse["rms"],
            "silent": pulse["silent"],
            "file": None,
            "duration_s": 0.0,
            "clipped_at_slot_end": pulse["clipped_at_slot_end"],
            "pulse_duration_s": pulse["duration_s"],
            "sustain_duration_s": None,
            "sustained": None,
            "loop": False,
            "loop_period_s": None,
            "loop_corr": None,
        }

        # Prefer the sustain pass as the source for a one-shot clip: its longer
        # window cannot truncate a self-terminating sound the way --gap might.
        buf = pulse["_buf"]
        if sustain is not None and not sustain["silent"]:
            buf = sustain["_buf"]
        if sustain is not None:
            row["sustain_duration_s"] = sustain["duration_s"]
            row["peak"] = max(row["peak"], sustain["peak"])
            # A genuine looping tune is still sounding when the late stop hits at
            # --sustain-hold; a one-shot (even a long one) has decayed before then.
            # (Frogger's stop interrupts, so pulse length is not a usable baseline
            # -- see SUSTAIN_STILL_FRACTION.)
            sustained = (
                not pulse["silent"]
                and not sustain["silent"]
                and sustain["duration_s"] >= SUSTAIN_STILL_FRACTION * args.sustain_hold
            )
            row["sustained"] = sustained
            if sustained:
                # Only the part of the sustain pass before the stop write is a
                # phrase; search up to a quarter of the hold so whatever comes
                # back was seen at least four times.
                held = int(min(len(sustain["_buf"]), args.sustain_hold * rate))
                region = sustain["_buf"][:held]
                period, corr = loop_period(
                    region, rate, args.min_period, args.sustain_hold / 4.0, args.loop_corr
                )
                row["loop"] = True
                if period:
                    row["loop_period_s"] = round(period / rate, 4)
                    row["loop_corr"] = round(corr, 4)
                    buf = region[:period]
                else:
                    # No convincing period: keep the whole sustained recording
                    # rather than inventing a loop point. Says so in index.json.
                    buf = region

        if buf is not None and len(buf):
            # Remove any residual DC so the written clip is a clean centred
            # waveform (no offset step to click at the seam) and report its TRUE
            # AC peak/rms rather than the DC-inflated slot figure.
            if _np is not None:
                clip = _np.asarray(buf, dtype=_np.float64)
                clip = clip - clip.mean()
            else:
                mean = sum(buf) / len(buf)
                clip = [v - mean for v in buf]
            name = f"{key}.wav"
            with wave.open(os.path.join(out_dir, name), "wb") as ow:
                ow.setnchannels(1)
                ow.setsampwidth(2)
                ow.setframerate(rate)
                ow.writeframes(_to_int16(clip))
            row["file"] = name
            row["duration_s"] = round(len(clip) / rate, 4)
            pk, rm = _peak_rms(clip)
            row["peak"] = round(pk, 1)
            row["rms"] = round(rm, 1)
        out.append(row)
    return out


GAP_TAIL_S = 0.25


def gap_report(full, rate, marks, end_t):
    """Peak in the last GAP_TAIL_S of each slot -- the muting/separation proof.

    It must be at the noise floor. If it is not, either the ROM is still driving
    the sound ports (muting failed) or the slot's own sound is still playing when
    the next slot starts (--gap too short, or a tune that --stop-value did not
    silence). Each tail window is idle-DC-centred, like the slot measurements."""
    n = len(full)
    out = []
    for i, (sid, t0) in enumerate(marks):
        t1 = marks[i + 1][1] if i + 1 < len(marks) else end_t
        ts = max(t0, t1 - GAP_TAIL_S)
        i0 = max(0, min(n, int(round(ts * rate))))
        i1 = max(i0, min(n, int(round(t1 * rate))))
        peak, rms = _peak_rms(center(full[i0:i1]))
        out.append((sid, peak, rms))
    return out


# ---------------------------------------------------------------------------
def main():
    p = argparse.ArgumentParser(
        prog="record_samples.py",
        description=(
            "Record Frogger's sounds from YOUR MAME + YOUR ROM into local, "
            "gitignored sample files."
        ),
        epilog=(
            "COPYRIGHT / BRING-YOUR-OWN-ROM\n"
            "  Frogger's audio is the ROM authors' copyrighted work, exactly like its\n"
            "  sprites and program ROM. arcade-js therefore ships NO Frogger audio. This\n"
            "  script drives the MAME you installed against the romset you own and writes\n"
            "  the result to a gitignored directory on your machine. Do not commit or\n"
            "  redistribute anything it produces.\n"
            "\n"
            "WHAT IT DOES\n"
            "  Boots frogger headless under the project's determinism flags, mutes the\n"
            "  ROM's own writes to the sound latch (0xD000) and control port (0xD002),\n"
            "  then sweeps the sound-command byte -- for each value writing 0xD000 then\n"
            "  pulsing 0xD002 bit3 low-then-high (the FALLING edge fires the sound CPU's\n"
            "  /INT) -- leaving a fixed silence gap between each. The single -wavwrite\n"
            "  recording is split back into one clip per command, trimmed, and reported\n"
            "  with peak/RMS amplitude.\n"
            "\n"
            "  This is a DISCOVERY SWEEP: it does not assume which value means which\n"
            "  sound. It records what each command actually produced, as evidence for\n"
            "  building the command->sound map in games/frogger/audio/.\n"
            "\n"
            "  Clips are named cmd_<decimal>.wav (e.g. cmd_4.wav) in the output dir.\n"
            "\n"
            "EXAMPLES\n"
            "  record_samples.py --rompath ~/Downloads\n"
            "  record_samples.py --commands 0x00-0x1f,0x80 --report-gaps\n"
            "  record_samples.py --dry-run          # print the schedule + MAME argv\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--hardware",
        default=os.path.join(REPO, DEFAULT_HARDWARE),
        metavar="PATH",
        help="board hardware.json (default: %(default)s)",
    )
    p.add_argument(
        "--out",
        default=os.path.join(REPO, DEFAULT_OUT),
        metavar="DIR",
        help="output directory for clips (gitignored; default: %(default)s)",
    )
    p.add_argument("--mame", default="mame", help="MAME binary (default: %(default)s)")
    p.add_argument(
        "--rompath",
        default=os.path.expanduser("~/Downloads"),
        help="MAME rompath holding YOUR frogger romset -- a dir containing the "
        "frogger set (as frogger.zip or a frogger/ subdir WITH the audio ROMs "
        "frogger.608/609/610). NOT games/frogger/rom (that holds only the repacked "
        "maincpu image, no audio ROMs). (default: %(default)s)",
    )
    p.add_argument(
        "--commands",
        default="0x00-0x10,0x18,0x30,0x80,0x90,0xb0,0xd0,0xf0,0xff",
        metavar="SPEC",
        help="sound-command values to sweep, e.g. '0x00-0x1f,0x80'. Frogger's emit "
        "codes are small indices (hop=0x04, drown=0x02, fly-eat=0x18, countdown=0x06, "
        "start jingle=0x09-0x0b, game-over=0x0c/0x0d, board-advance=0x10/0x30), so the "
        "default low range covers them. (default: %(default)s)",
    )
    p.add_argument(
        "--stop-value",
        type=lambda s: int(s, 0),
        default=0,
        metavar="V",
        help="value written to 0xD000 (with a falling edge) at the end of every slot to silence a "
        "sustained command. 0 ('no command') suffices for the self-terminating "
        "sounds; if --report-gaps shows a tune bleeding, set this to the real "
        "stop command found in the sweep (default: %(default)s)",
    )
    p.add_argument(
        "--gap",
        type=float,
        default=5.0,
        help="seconds between PULSE slot starts; also the pulse window / the "
        "one-shot clip length. Must exceed the longest self-terminating effect "
        "or it is flagged clipped (default: %(default)s)",
    )
    p.add_argument(
        "--hold",
        type=float,
        default=0.1,
        help="seconds the command is held in 0xD000 before --stop-value is "
        "written, in the PULSE pass. Only needs to span >=1 frame so the sound "
        "CPU samples it (default: %(default)s)",
    )
    p.add_argument(
        "--sustain-gap",
        type=float,
        default=14.0,
        help="seconds between SUSTAIN slot starts; the long window used to see "
        "whether a command keeps sounding and to measure a loop period. Must "
        "exceed --sustain-hold plus the stop latency and release tail so a tune "
        "silenced by --stop-value has fallen quiet before the next slot "
        "(default: %(default)s)",
    )
    p.add_argument(
        "--sustain-hold",
        type=float,
        default=10.0,
        help="seconds a command plays in the SUSTAIN pass before --stop-value is "
        "written. The loop search returns no period longer than a quarter of "
        "this (default: %(default)s)",
    )
    p.add_argument(
        "--min-period",
        type=float,
        default=0.2,
        help="shortest loop period the phrase search will consider, seconds "
        "(default: %(default)s)",
    )
    p.add_argument(
        "--loop-corr",
        type=float,
        default=0.8,
        help="minimum normalised autocorrelation before a loop period is "
        "believed; below it the whole sustained recording is kept uncut "
        "(default: %(default)s)",
    )
    p.add_argument(
        "--boot",
        type=float,
        default=6.0,
        help="seconds to let the machine boot and settle first (default: %(default)s)",
    )
    p.add_argument(
        "--samplerate", type=int, default=48000, help="MAME -samplerate (default: %(default)s)"
    )
    p.add_argument(
        "--min-peak",
        type=float,
        default=64.0,
        help="absolute silence threshold, 16-bit units (default: %(default)s)",
    )
    p.add_argument(
        "--noise-margin",
        type=float,
        default=8.0,
        help="threshold is also >= this x the measured noise floor (default: %(default)s)",
    )
    p.add_argument(
        "--pad", type=float, default=0.01, help="seconds of pad kept around a trimmed clip"
    )
    p.add_argument(
        "--mute-ranges",
        default=DEFAULT_MUTE,
        metavar="SPEC",
        help="address ranges the program is prevented from writing during the "
        "sweep (default: %(default)s). Tap ONLY {0xD000, 0xD002}; 0xD004 is IN3 "
        "input and 0xD006 is the PPI1 control register -- tapping either breaks "
        "the machine. Empty string lets the ROM drive the sound ports too, which "
        "contaminates every clip.",
    )
    p.add_argument("--keep-wav", action="store_true", help="keep the full session wav")
    p.add_argument(
        "--report-gaps",
        action="store_true",
        help="print the residual level at the end of every slot (the muting proof)",
    )
    p.add_argument("--dry-run", action="store_true", help="print the plan and exit")
    args = p.parse_args()

    try:
        args.commands = parse_values(args.commands)
    except ValueError as exc:
        p.error(f"--commands: {exc}")
    if not args.commands:
        p.error("--commands selected nothing")
    try:
        args.mute_ranges = parse_ranges(args.mute_ranges)
    except ValueError as exc:
        p.error(f"--mute-ranges: {exc}")
    if not 0 <= args.stop_value <= 0xFF:
        p.error("--stop-value must be 0..255")
    if args.gap <= args.hold + 0.1:
        p.error("--gap must exceed --hold by at least 0.1s or slots would overlap")
    if args.sustain_gap <= args.sustain_hold + 0.1:
        p.error("--sustain-gap must exceed --sustain-hold by at least 0.1s or the "
                "sustain slots would overlap")
    if args.boot < 1.5:
        p.error("--boot must be >= 1.5s: the noise floor is measured in the second "
                "before the first slot, and the machine needs to settle")

    hw = hardware.load_from_args(args)
    slots = build_schedule(args)
    if not slots:
        p.error("schedule is empty")

    lua_text, slot_frames, end_frame = generate_lua(args, hw, slots)
    total_s = end_frame / hw.refresh_hz
    seconds = int(math.ceil(total_s)) + 1  # -seconds_to_run truncates

    workdir = tempfile.mkdtemp(prefix="record_samples_frogger_")
    os.makedirs(os.path.join(workdir, "nvram"), exist_ok=True)
    os.makedirs(os.path.join(workdir, "cfg"), exist_ok=True)
    lua_path = os.path.join(workdir, "sweep.lua")
    wav_path = os.path.join(workdir, "session.wav")
    sched_path = os.path.join(workdir, "schedule.txt")

    try:
        with open(lua_path, "w") as fh:
            fh.write(lua_text)

        # Reuse the golden harness's determinism-controlled argv verbatim, then
        # add the audio recording on top. no_frames=True drops -aviwrite; the
        # generated sweep script rides in on the -autoboot_script slot (the
        # tape/writes/at_pc fields are all falsey, so build_mame_argv installs
        # args.lua_state, our sweep script).
        ns = argparse.Namespace(
            mame=args.mame,
            rompath=args.rompath,
            seconds=seconds,
            no_frames=True,
            tape=None,
            writes=False,
            at_pc=None,
            playback=None,
            record=None,
            lua_state=lua_path,
            lua_at_pc=None,
            lua_writes=None,
        )
        argv = mame_golden.build_mame_argv(ns, hw, workdir)
        argv += ["-wavwrite", wav_path, "-samplerate", str(args.samplerate)]

        n_cmd = len(args.commands)
        print(f"[plan  ] {n_cmd} commands x2 passes = {len(slots)} slots, gap "
              f"{args.gap}s / {args.sustain_gap}s, hold {args.hold}s / "
              f"{args.sustain_hold}s, boot {args.boot}s -> {total_s:.1f}s emulated "
              f"({seconds}s -seconds_to_run)")
        if args.dry_run:
            print("[dry   ] " + " ".join(argv))
            print("[dry   ] muted: "
                  + (", ".join(f"0x{lo:04X}-0x{hi:04X}" for lo, hi in args.mute_ranges)
                     or "(nothing -- the ROM will contaminate every clip)"))
            print(f"[dry   ] stop-value written at slot end: 0x{args.stop_value:02X}")
            print("[dry   ] schedule:")
            for slot, f in zip(slots, slot_frames):
                print(f"          frame {f:6d}  {slot['id']:<18} "
                      + " ".join(f"+{dt:.2f}s {a:04X}={v:02X}" for dt, a, v in slot["writes"]))
            return 0

        env = dict(os.environ)
        env["SCHEDULE_OUT"] = sched_path
        print("[record] " + " ".join(argv))
        res = subprocess.run(argv, env=env, capture_output=True, text=True)
        if res.returncode != 0:
            sys.stderr.write(res.stdout + res.stderr)
            raise RuntimeError(f"MAME exited {res.returncode}")

        if not os.path.exists(wav_path):
            raise RuntimeError(
                f"MAME produced no wav at {wav_path} -- this build may not support "
                f"-wavwrite, or the path was rejected"
            )
        if not os.path.exists(sched_path):
            raise RuntimeError(
                f"the sweep script produced no schedule log at {sched_path} -- the "
                f"autoboot script did not run"
            )

        marks, baseline_t, end_t, blocked = parse_schedule_log(sched_path)
        problems = []
        if len(marks) != len(slots):
            problems.append(
                f"only {len(marks)} of {len(slots)} slots ran -- the capture was cut "
                f"short, so the missing slots are UNTESTED, not silent"
            )
        if end_t is None:
            end_t = marks[-1][1] + args.gap if marks else 0.0
            problems.append("no end marker: the run ended before the last slot closed")
        if baseline_t is None:
            problems.append("no baseline marker: the noise floor could not be measured")
            baseline_t = marks[0][1] - 1.0 if marks else 0.0
        if not marks:
            raise RuntimeError("no slots were recorded; nothing to split")

        out_dir = args.out
        full, rate = load_recording(wav_path)  # mono float, read once
        slot_rows, meta = analyse_slots(full, rate, marks, baseline_t, end_t, args)
        rows = resolve_passes(slot_rows, slots, meta, args, out_dir)
        # NOTES are informational: the clip is still written and valid, they just
        # flag something a human should know. Unlike PROBLEMS they do not fail the
        # run. A sustained tune with no clean short loop is a real finding here
        # (a longer/through-composed tune), not a failed capture, so the whole
        # recording is kept and merely noted.
        notes = []
        for r in rows:
            if r["sustained"] and r["loop_period_s"] is None:
                notes.append(
                    f"{r['id']} sustains but no clean loop period was found -- the whole "
                    f"{r['duration_s']}s recording was kept, so looping it will seam. For "
                    f"a tighter loop try a longer --sustain-hold or a lower --loop-corr"
                )

        meta.update(
            {
                "generated_by": "games/frogger/tools/record_samples.py",
                "note": "DERIVED FROM YOUR OWN ROM -- copyrighted, never commit",
                "clip_naming": "cmd_<decimal>.wav (e.g. cmd_4.wav)",
                "mame_argv": argv,
                "sound_cmd_latch": "0xD000",
                "sound_ctrl_port": "0xD002",
                "ctrl_int_bit": "0x08 (bit3, FALLING edge asserts sound-CPU /INT)",
                "gap_s": args.gap,
                "hold_s": args.hold,
                "sustain_gap_s": args.sustain_gap,
                "sustain_hold_s": args.sustain_hold,
                "stop_value": args.stop_value,
                "min_period_s": args.min_period,
                "loop_corr_min": args.loop_corr,
                "boot_s": args.boot,
                "mute_ranges": [f"0x{lo:04X}-0x{hi:04X}" for lo, hi in args.mute_ranges],
                "rom_sound_writes_blocked": blocked,
                "clips": rows,
            }
        )
        with open(os.path.join(out_dir, "index.json"), "w") as fh:
            json.dump(meta, fh, indent=1)
            fh.write("\n")

        # ---- report -------------------------------------------------------
        print(f"[audio ] {meta['recording_seconds']}s @ {meta['sample_rate']}Hz "
              f"{meta['channels']}ch/{meta['sample_width_bytes']*8}-bit")
        print(f"[floor ] noise floor peak={meta['baseline_peak']} "
              f"rms={meta['baseline_rms']} -> silence threshold {meta['silence_threshold']}")
        if blocked is not None:
            print(f"[mute  ] {blocked} program writes to the sound ports suppressed")
        print()
        print(f"  {'command':<10} {'peak':>7} {'pulse':>8} {'sustain':>8} {'kept':>8} "
              f"{'period':>8}  result")
        print("  " + "-" * 74)
        sounded = 0
        for r in rows:
            if r["silent"]:
                verdict = "silent"
            else:
                sounded += 1
                verdict = r["file"] + (" (CUT OFF at slot end)" if r["clipped_at_slot_end"] else "")
                if r["sustained"]:
                    verdict = "LOOP  " + verdict
            fmt = lambda v: "-" if v is None else f"{v:.3f}s"  # noqa: E731
            label = f"{r['command']}/0x{r['command']:02X}"
            print(f"  {label:<10} {r['peak']:>7.0f} {fmt(r['pulse_duration_s']):>8} "
                  f"{fmt(r['sustain_duration_s']):>8} {fmt(r['duration_s']):>8} "
                  f"{fmt(r['loop_period_s']):>8}  {verdict}")
        print()
        looped = sum(1 for r in rows if r["loop"])
        print(f"[result] {sounded}/{len(rows)} commands produced sound; "
              f"{len(rows) - sounded} silent; {looped} classified SUSTAINED and cut to "
              f"one phrase -> {out_dir}")

        if args.report_gaps:
            print()
            print(f"  residual in the last {GAP_TAIL_S}s of each slot "
                  f"(must be at the floor: proves muting worked AND the gap is long enough)")
            # A dirty gap AFTER A SILENT command means the ROM's own writes leaked
            # through -> muting FAILED (a hard problem). A dirty gap after a
            # SOUNDING command means that command's tune had not fallen silent by
            # the next slot -- stop=0 does not halt every tune -- which is a
            # note-level bleed, not a muting failure.
            silent_keys = {r["id"] for r in rows if r["silent"]}
            leak_after_silent = 0
            bleed_after_sound = 0
            for sid, peak, rms in gap_report(full, rate, marks, end_t):
                bad = peak > meta["silence_threshold"]
                base_key = (
                    sid[: -len(SUSTAIN_SUFFIX)] if sid.endswith(SUSTAIN_SUFFIX) else sid
                )
                if bad:
                    if base_key in silent_keys:
                        leak_after_silent += 1
                    else:
                        bleed_after_sound += 1
                print(f"  {sid:<20} peak={peak:>8.0f} rms={rms:>8.1f}"
                      + ("  <-- STILL SOUNDING" if bad else ""))
            if leak_after_silent:
                problems.append(
                    f"{leak_after_silent} gap(s) after a SILENT command were still "
                    f"sounding -- the ROM's own sound writes are leaking through "
                    f"(muting FAILED), so clips are contaminated"
                )
            if bleed_after_sound:
                notes.append(
                    f"{bleed_after_sound} gap(s) after a SOUNDING command had residual "
                    f"tune bleed -- that tune did not fall silent before the next slot "
                    f"(stop=0x{args.stop_value:02X} does not halt it). The next clip may "
                    f"start with a brief tail; raise --sustain-gap or find its real "
                    f"--stop-value"
                )

        if args.keep_wav:
            dst = os.path.join(out_dir, "session.wav")
            shutil.copy(wav_path, dst)
            print(f"[wav   ] full session kept at {dst}")

        if sounded == 0:
            problems.append(
                "EVERY slot was silent -- nothing was captured. Either the writes are "
                "not reaching the sound latch or this MAME build records no audio; "
                "this is a failed capture, not a result"
            )
        if notes:
            sys.stderr.write("\n--- notes (clips written; review):\n")
            for nt in notes:
                sys.stderr.write(f"---   - {nt}\n")
        if problems:
            sys.stderr.write("\n*** PROBLEMS with this capture:\n")
            for pr in problems:
                sys.stderr.write(f"***   - {pr}\n")
            return 1
        return 0
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
