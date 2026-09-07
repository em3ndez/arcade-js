#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Record Galaxian's sounds from YOUR MAME + YOUR ROM into local sample files.

WHY THIS TOOL EXISTS (the copyright position)
---------------------------------------------
arcade-js plays audio ABOVE the emulation: the board watches the program's writes to the sound registers
and plays a recorded clip. That needs samples -- and Galaxian's sounds are Namco/Midway's copyrighted work,
exactly like the program ROM. So we ship NONE of it: the repo has the *tooling*, you supply the *content*.
This drives the MAME you already installed against the romset you already own and writes the audio to a
gitignored directory. Nothing copyrighted enters the repo.

WHAT GALAXIAN'S SOUND IS
------------------------
Pure DISCRETE ANALOGUE circuits (galaxian_a.cpp), no sound CPU and no sample ROM. The program latches
triggers to memory-mapped sound registers and the netlist makes the noise. From galaxian_a.cpp sound_w
(offset 0x6800-7) + pitch_w (0x7800) + lfo_freq_w (0x6004-7):
  * 0x6800/1/2  FS1/FS2/FS3 -- three background 555 tone voices (gated by alien-count), pitched by 0x7800
  * 0x6803      HIT         -- the LFSR-noise explosion/hit
  * 0x6805      FIRE        -- the player-shot 555 VCO
  * 0x6806/7    VOL1/VOL2   -- background tone volume
  * 0x7800      PITCH       -- pitch of the background tones / VCO
There is nothing to "extract" -- MAME synthesises the netlist, so we RECORD what each trigger produces.

HOW A SOUND IS ISOLATED (the key trick, galaxian-specific)
----------------------------------------------------------
The running ROM writes its own attract sounds, which contaminate everything. So we FREEZE THE CPU: boot far
enough to init, clear IRQ_ENABLE (0x7001=0) so the vblank NMI/ISR stops, poke a `jp $` spin into a quiet
work-RAM cell and park the PC on it. Galaxian's WATCHDOG then resets the frozen CPU (~1.5s) unless we KICK
it every frame (read 0x7800). We also drive the sound to the ROM's exact QUIESCE state each frame
(silenceSoundAndDisableIrqStars 0x1cb5: regs 0x6800-7=0, LFO 0x6004-7=1, pitch 0x7800=0xFF) -- measured to
be truly silent (AC-RMS 0; regs=0/pitch=0 leaves a ~1700 noise floor). The netlist keeps running
independently, and the lua-injected register write is then the ONLY thing driving it -- a clean sound with a
silent baseline. GATED triggers (FIRE/HIT) fire on the level, so we PULSE them; a sustained tone is HELD.

Classification is measured, not assumed (AC-RMS, median-centred for the discrete DC bias): a value whose
sound outlives the pulse-and-release is `sustained`, otherwise `gated`; a value that makes no sound is
`silent` and (per the map's honesty rule) gets NO clip.

Run (writes gitignored clips + index.json):
  games/galaxian/tools/record_samples.py --out games/galaxian/audio/samples
"""
import argparse, json, math, os, statistics, struct, subprocess, sys, tempfile, wave

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
FREEZE_ADDR = 0x43a0            # a quiet work-RAM cell (below STACK_SCRATCH 0x43e0) for the spin loop
BOOT_FRAMES = 150              # freeze after boot inits (well before the run ends)
PULSE_FRAMES = 3              # rising-edge pulse width for a gated trigger

# addr, name: the sounding triggers (VOL1/2 and n/c 0x6804 are not standalone sounds). PITCH is set so the
# background FS tones voice; FIRE/HIT ignore it.
SWEEP = [
    (0x6805, "fire",  0x80),   # FIRE VCO
    (0x6803, "hit",   0x80),   # HIT noise (explosion)
    (0x6800, "bg1",   0x80),   # FS1 background tone
    (0x6801, "bg2",   0x80),   # FS2
    (0x6802, "bg3",   0x80),   # FS3
]


def build_lua(addr, pitch, mode):
    """Freeze the CPU, quiesce to silence, then inject `addr`=1 (+ PITCH) hold/pulse from the freeze."""
    return f"""
local cpu=manager.machine.devices[":maincpu"]; local prog=cpu.spaces["program"]
local F={FREEZE_ADDR}
local function quiesce()
  for a=0x6800,0x6807 do prog:write_u8(a,0) end
  for a=0x6004,0x6007 do prog:write_u8(a,1) end
  prog:write_u8(0x7800,0xff)
end
_G.f=0; _G.frozen=false
_G.n=emu.add_machine_frame_notifier(function()
  _G.f=_G.f+1
  if _G.f=={BOOT_FRAMES} then
    prog:write_u8(0x7001,0)
    prog:write_u8(F,0xc3); prog:write_u8(F+1,F&0xff); prog:write_u8(F+2,(F>>8)&0xff)
    pcall(function() cpu.state["PC"].value=F end); _G.frozen=true
  end
  if _G.frozen then
    prog:write_u8(0x7001,0); prog:write_u8(F,0xc3); prog:write_u8(F+1,F&0xff); prog:write_u8(F+2,(F>>8)&0xff)
    pcall(function() cpu.state["PC"].value=F end)
    prog:read_u8(0x7800)          -- kick watchdog
    quiesce()
    local since=_G.f-{BOOT_FRAMES}
    local on=("{mode}"=="hold") or (since<{PULSE_FRAMES})
    if on then prog:write_u8({addr},1); prog:write_u8(0x7800,{pitch}) end
  end
end)
"""


def read_wav(path):
    w = wave.open(path, "rb"); n, fr, sw, ch = w.getnframes(), w.getframerate(), w.getsampwidth(), w.getnchannels()
    raw = w.readframes(n); w.close()
    if sw != 2:
        raise RuntimeError(f"{path}: expected 16-bit, got {sw*8}-bit")
    s = list(struct.unpack(f"<{len(raw)//2}h", raw))
    if ch == 2:
        s = s[0::2]
    return s, fr


def ac_rms(seg):
    if not seg:
        return 0.0
    med = statistics.median(seg)
    return math.sqrt(sum((x - med) ** 2 for x in seg) / len(seg))


def run_one(mame, rompath, addr, pitch, mode, seconds, outdir, sid):
    with tempfile.TemporaryDirectory() as tmp:
        luap = os.path.join(tmp, "inj.lua"); open(luap, "w").write(build_lua(addr, pitch, mode))
        wav = os.path.join(outdir, sid + ".wav")
        argv = [mame, "galaxian", "-rompath", rompath, "-norotate", "-video", "none", "-nothrottle",
                "-frameskip", "0", "-sound", "none", "-wavwrite", wav, "-nvram_directory", os.path.join(tmp, "nv"),
                "-cfg_directory", os.path.join(tmp, "cfg"), "-nonvram_save", "-nocheat", "-noautosave",
                "-seconds_to_run", str(seconds), "-autoboot_script", luap]
        subprocess.run(argv, capture_output=True, text=True)
        if not os.path.exists(wav):
            return None
        s, fr = read_wav(wav)
        # the clip is the post-freeze region; skip a settle margin past BOOT_FRAMES
        i0 = int((BOOT_FRAMES + 10) / 60 * fr)
        seg = s[i0:]
        # trim leading silence, keep from the injected region; write the trimmed clip back
        clip = s[i0:]
        with wave.open(wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(fr)
            w.writeframes(struct.pack(f"<{len(clip)}h", *clip))
        return ac_rms(seg), fr, len(clip)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--mame", default="mame")
    ap.add_argument("--rompath", default=os.path.expanduser("~/Downloads"))
    ap.add_argument("--out", default=os.path.join(GAME, "audio", "samples"))
    ap.add_argument("--seconds", type=int, default=5)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    # silent baseline control: the freeze+quiesce with NO injection must be ~0.
    base = run_one(a.mame, a.rompath, 0x6804, 0xff, "hold", a.seconds, a.out, "_baseline")
    base_rms = base[0] if base else 0.0
    print(f"[baseline] freeze+quiesce AC-RMS = {base_rms:.0f} (must be near 0)")

    index = {"driver": "galaxian", "baseline_ac_rms": round(base_rms), "sounds": {}}
    for addr, name, pitch in SWEEP:
        p = run_one(a.mame, a.rompath, addr, pitch, "pulse", a.seconds, a.out, name)
        h = run_one(a.mame, a.rompath, addr, pitch, "hold", a.seconds, a.out, name + "_hold")
        prms = p[0] if p else 0.0
        hrms = h[0] if h else 0.0
        # A GATED sound (fire/hit) is triggered by a brief event, so a short PULSE already makes it sound;
        # a SUSTAINED tone (the FS background voices) needs continuous gating, so a brief pulse makes ~nothing
        # while HOLDING voices it. So: pulse audible -> gated (play once on the write edge); pulse silent but
        # hold audible -> sustained (loop while held); neither -> silent (no clip).
        if hrms < base_rms + 250:
            kind = "silent"
        elif prms > base_rms + 150:
            kind = "gated"
        else:
            kind = "sustained"
        index["sounds"][f"0x{addr:04x}"] = {"name": name, "kind": kind,
                                            "pulse_ac_rms": round(prms), "hold_ac_rms": round(hrms)}
        print(f"[{name} 0x{addr:04x}] pulse={prms:.0f} hold={hrms:.0f} -> {kind}")
    json.dump(index, open(os.path.join(a.out, "index.json"), "w"), indent=2)
    print(f"wrote {len(SWEEP)} sample(s) + index.json -> {a.out}")


if __name__ == "__main__":
    sys.exit(main())
