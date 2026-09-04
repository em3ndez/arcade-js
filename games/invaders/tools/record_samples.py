#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Record Space Invaders' sounds from YOUR MAME + YOUR ROM into local sample files.

WHY THIS TOOL EXISTS (the copyright position)
---------------------------------------------
arcade-js plays audio ABOVE the emulation: the board watches the program's writes
to the sound ports and plays a recorded clip. That needs samples -- and Space
Invaders' sounds are Taito's copyrighted work, exactly like the program ROM. So we
ship NONE of it: the repository has the *tooling*, you supply the *content*. This
drives the MAME you already installed against the romset you already own, and
writes the audio to a gitignored directory. Nothing copyrighted enters the repo.

WHAT SPACE INVADERS' SOUND IS
-----------------------------
Pure DISCRETE ANALOGUE circuits (mw8080bw), no sound CPU and no sample ROM. The
game latches sound triggers to two output ports and the circuits make the noise:

  * OUT 3 (SOUND_PORT3_SHADOW 0x2094): b0 UFO (a sustained tone while the bit is
    held), b1 player shot, b2 player explosion, b3 invader die, b4 extra-life,
    b5 amp/UFO-mute control.
  * OUT 5 (SOUND_PORT5_SHADOW 0x2098): b0-b3 the four fleet-march steps, b4 the
    UFO-hit (saucer explosion).

There is nothing to "extract" -- MAME synthesises the circuits from a netlist, so
we RECORD what each trigger actually produces.

HOW A SOUND IS ISOLATED (the key trick)
---------------------------------------
The running ROM writes its own attract-mode sounds, which contaminate everything.
We cannot mute an OUT write after the fact (the discrete circuit fires on the
write EDGE), and NOPping the ROM's OUT instructions does not stick (MAME ROM is
read-only to lua). So instead we FREEZE THE CPU: boot far enough to init, then
poke a `jmp $` into work RAM and park the PC on it so the 8080 spins forever and
emits no sound writes. The mw8080bw audio device keeps running independently, and
the lua-injected OUT 3/5 latch is the ONLY thing driving it -- a clean sound with
a truly silent baseline (measured: OUT3=0 -> peak 0). GATED triggers (shot, die,
...) fire on the rising edge, so we PULSE them; the sustained UFO tone is HELD.

The classification is measured, not assumed: a value whose sound outlives the
pulse-and-release by a wide margin is `sustained`, otherwise `gated`. A value that
makes no sound is `silent` and (per the map's honesty rule) gets NO clip.

Run (writes gitignored clips + index.json):
  games/invaders/tools/record_samples.py --out games/invaders/audio/samples
"""
import argparse
import json
import math
import os
import struct
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)

# The sweep: one bit per sound. OUT3 b0-b5 (UFO, shot, player-explode, invader-die, extra-life, amp/mute);
# OUT5 b0-b3 (the four fleet-march steps) + b4 (UFO-hit / saucer explosion). Each is captured both edge-
# PULSED (how the game triggers a one-shot) and HELD (to measure whether it is a steady continuous tone).
SWEEP = (
    [(0x03, 1 << b, f"out3_b{b}") for b in range(6)]
    + [(0x05, 1 << b, f"out5_b{b}") for b in range(5)]
)

FREEZE_ADDR = 0x2340  # a quiet work-RAM cell to hold the CPU's spin loop


def build_lua(port, value, mode, boot_frames, pulse_frames):
    """Freeze the CPU on a jmp-self after boot, then inject `value` on `port`.

    hold: keep the bit set for the whole capture. pulse: set it for `pulse_frames`
    on the rising edge (after freeze), then release to 0 so a gated circuit fires once.
    """
    # Freeze with interrupts DISABLED: 0xFREEZE = DI (f3) then jmp-self at FREEZE+1, PC parked on the DI.
    # The 8080's RST1/RST2 (mid/vblank) fire every frame and would vector to the ISR -- which runs sound
    # code -- even while the CPU spins; DI masks them so the ONLY thing driving the audio device is our
    # injected latch. OUT3 sounds are OR'd with 0x20 (the amp/enable bit the ISR used to hold) so the amp
    # stays on. jmp target = FREEZE_ADDR+1 (past the DI).
    lo1, hi1 = (FREEZE_ADDR + 1) & 0xFF, ((FREEZE_ADDR + 1) >> 8) & 0xFF
    return f"""
local cpu=manager.machine.devices[":maincpu"]; local prog=cpu.spaces["program"]; local iosp=cpu.spaces["io"]
local function spin()
  prog:write_u8({FREEZE_ADDR},0xf3); prog:write_u8({FREEZE_ADDR+1},0xc3)
  prog:write_u8({FREEZE_ADDR+2},{lo1}); prog:write_u8({FREEZE_ADDR+3},{hi1})
end
_G.f=0; _G.frozen=false
_G.n=emu.add_machine_frame_notifier(function()
  _G.f=_G.f+1
  if _G.f=={boot_frames} then spin(); pcall(function() cpu.state["PC"].value={FREEZE_ADDR} end); _G.frozen=true end
  if _G.frozen then
    spin()
    local since = _G.f - {boot_frames}
    local on = ("{mode}"=="hold") or (since < {pulse_frames})
    local v3 = (0x03=={port} and on) and ({value} | 0x20) or 0
    iosp:write_u8(0x03, v3)
    iosp:write_u8(0x05, (0x05=={port} and on) and {value} or 0)
  end
end)
"""


def peak_rms(buf):
    if not buf:
        return 0, 0.0
    m = sum(buf) / len(buf)
    ac = [x - m for x in buf]
    peak = max(abs(x) for x in buf)
    rms = math.sqrt(sum(x * x for x in ac) / len(ac))
    return peak, rms


def read_wav(path):
    w = wave.open(path, "rb")
    n, fr, sw, ch = w.getnframes(), w.getframerate(), w.getsampwidth(), w.getnchannels()
    raw = w.readframes(n)
    w.close()
    if sw != 2:
        raise SystemExit(f"unexpected sample width {sw}")
    vals = struct.unpack("<%dh" % (n * ch), raw)
    if ch > 1:
        vals = vals[::ch]
    return list(vals), fr


def window(vals, fr, t0, t1):
    return vals[int(fr * t0):int(fr * t1)]


def run_one(mame, rompath, port, value, mode, boot_frames, pulse_frames, seconds, outdir, sid):
    with tempfile.TemporaryDirectory() as tmp:
        lua = os.path.join(tmp, "inj.lua")
        with open(lua, "w") as f:
            f.write(build_lua(port, value, mode, boot_frames, pulse_frames))
        wav = os.path.join(outdir, sid + ".wav")
        argv = [mame, "invaders", "-rompath", rompath, "-norotate", "-video", "none",
                "-nothrottle", "-frameskip", "0", "-sound", "none", "-wavwrite", wav,
                "-nvram_directory", tmp, "-cfg_directory", tmp, "-nonvram_save",
                "-nocheat", "-noautosave", "-seconds_to_run", str(seconds),
                "-autoboot_script", lua]
        r = subprocess.run(argv, capture_output=True, text=True)
        if not os.path.exists(wav):
            raise SystemExit(f"MAME produced no wav for {sid}:\n{r.stderr[-800:]}")
    # Analyse relative to the freeze instant (boot_frames at 60Hz). early = the trigger's onset (catches a
    # brief gated sound); mid = 1.6-2.6s on, where only a SUSTAINED sound still rings (a gated one-shot has
    # stopped). Both are kept clear of a capture-tail wav artifact seen from ~3s on.
    vals, fr = read_wav(wav)
    fz = boot_frames / 60.0
    early = window(vals, fr, fz + 0.1, fz + 1.6)
    mid = window(vals, fr, fz + 1.6, fz + 2.6)
    return wav, early, mid, fr


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mame", default="mame")
    ap.add_argument("--rompath", default=os.path.expanduser("~/Downloads"))
    ap.add_argument("--out", default=os.path.join(GAME, "audio", "samples"))
    ap.add_argument("--boot-frames", type=int, default=400)
    ap.add_argument("--pulse-frames", type=int, default=3)
    ap.add_argument("--seconds", type=float, default=12.0)
    ap.add_argument("--silent-rms", type=float, default=30.0, help="AC-rms below this = silent (no clip)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    index = []
    for port, value, sid in SWEEP:
        # Two passes: pulse (rising-edge trigger, how the game fires a one-shot) and hold (bit kept set, to
        # MEASURE whether the sound is a steady continuous tone). We report the MEASUREMENTS; whether a sound
        # LOOPS in the port is the map's call, taken from the game's actual OUT-port hold-vs-pulse usage --
        # MAME alone cannot tell a game-held loop (UFO) from a game-pulsed one-shot that merely rings while a
        # test harness holds its bit (e.g. the saucer-hit).
        _, p_early, p_mid, fr = run_one(args.mame, args.rompath, port, value, "pulse",
                                        args.boot_frames, args.pulse_frames, args.seconds, args.out, sid)
        wav_h, h_early, h_mid, _ = run_one(args.mame, args.rompath, port, value, "hold",
                                           args.boot_frames, args.pulse_frames, args.seconds, args.out, sid + "_hold")
        pe = peak_rms(p_early)[1]
        he = peak_rms(h_early)[1]
        hm = peak_rms(h_mid)[1]
        silent = max(pe, he) < args.silent_rms
        steady_held = (not silent) and hm >= 0.6 * max(he, 1)   # a steady continuous tone while held
        kind = "silent" if silent else ("steady-tone" if steady_held else "one-shot")
        peak = max(peak_rms(p_early)[0], peak_rms(h_early)[0])
        # Keep the HELD clip for a steady tone (loopable), the PULSE clip for a one-shot; drop silents.
        keep = wav_h if steady_held else os.path.join(args.out, sid + ".wav")
        entry = {"id": sid, "port": port, "value": value, "measured": kind,
                 "pulse_early_rms": round(pe, 1), "hold_early_rms": round(he, 1),
                 "hold_mid_rms": round(hm, 1), "peak": peak}
        if not silent:
            entry["clip"] = os.path.basename(keep)
        index.append(entry)
        print(f"  {sid}: port {port:#04x} val {value:#04x} -> {kind:11} "
              f"(pulse_early={pe:.0f} hold_early={he:.0f} hold_mid={hm:.0f} peak={peak})")

    with open(os.path.join(args.out, "index.json"), "w") as f:
        json.dump({"game": "invaders", "model": "discrete-out-ports",
                   "ports": {"3": "SOUND_PORT3_SHADOW", "5": "SOUND_PORT5_SHADOW"},
                   "note": "`measured` is a MAME measurement (silent/steady-tone/one-shot); loop-vs-play-once "
                           "is decided when authoring manifest.audio.map from the game's OUT-port usage.",
                   "samples": index}, f, indent=2)
    ns = sum(1 for e in index if e["measured"] != "silent")
    print(f"\nwrote {ns} clip(s) + index.json to {args.out} "
          f"({sum(1 for e in index if e['measured']=='silent')} silent, no clip)")


if __name__ == "__main__":
    main()
