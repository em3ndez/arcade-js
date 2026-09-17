#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Donkey Kong gameplay pixel gate: JS render vs MAME, driven coin -> start -> real Mario play.

Attract takes no input, so a golden captures itself and proves little; this drives the SAME
coin/1P-start/joystick tape into both sides and compares the frames the game actually plays.
It renders the LAYER the manifest ships (`--layer idiomatic`, the generator engine web/worker.js
runs) or the frozen cycle-driven oracle (`--layer oracle`), against a MAME golden.

WHY THIS IS BUILT THE WAY IT IS (all four numbers MEASURED, see the block comments):

  * ENTROPY-PINNED, BOTH SIDES. DK's RNG is a main-loop spin counter (0x6019) raced against the
    vblank NMI; unpinned, JS and MAME fork within ~9 frames and every RNG-driven sprite drifts.
    The pin (manifest.entropyPin, mirrored on MAME by tools/lua/pin_entropy.lua) makes the whole
    RNG working set deterministic and identical on both sides — TEST-ONLY, never the shipped game.
    Without it there is no stable frame-to-frame comparison at all.

  * DRIFT-TOLERANT OFFSET, NOT A SINGLE FIXED ONE. Even pinned, the JS<->MAME frame offset is NOT
    globally constant: it grows across the long "how high"/Kong-carries-Pauline intro because of
    the accepted DMA-timing artifact (0x601A carries +-1 cutscene jitter). Measured: the boot/state
    offset is 3, and it has drifted to ~7 by the time Mario is playing. So the comparison is
    align-tolerant — each JS frame is scored against the BEST of a small window of golden offsets
    (GEN_OFFSET +- DRIFT) — exactly the drift-tolerant convergence DK's validation mandates, never a
    fixed offset. A +-1-frame align window shifts a moving sprite by ~1px; it cannot absorb the
    wrong twin below (a 64px barrel displacement), so the teeth survive the tolerance.

  * THE GATE WINDOW IS REAL MARIO GAMEPLAY. After start the game plays a ~1000-frame intro before
    Mario spawns (~JS frame 1176); the tape then holds P1 Right so he walks the 25m girders while
    barrels roll. The window [GATE_FROM, GATE_TO) is that walk — moving Mario + moving barrels,
    the content a rendering regression actually corrupts. game_responded() proves, from the
    golden's own state, that the coin was ACCEPTED and play STARTED and Mario is ACTIVE in the
    window, so the gate can never pass over an attract screen or a frozen intro.

  * NO ROW BAND EXCLUSION. Time Pilot's gate weakly-guards its top rows because its idiomatic path
    composites scanline bands against a beam. DK's idiomatic runtime renders a WHOLE-FRAME snapshot
    (machine.renderFrame(), the shipped serviceIdiomaticFrame call), so there is no scanline-descent
    residual and the WHOLE frame is guarded — BAND_FROM is 0. The idiomatic floor is instead a
    moving-sprite phase residual (snapshot vs MAME's beam), which is what sets the band.
"""
import argparse
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(GAME))
sys.path.insert(0, os.path.join(REPO, "tools"))

import numpy as np  # noqa: E402
import pixel_gate  # noqa: E402
from framediff import FROZEN_OFFSET  # noqa: E402
from hardware import Hardware  # noqa: E402

HW = os.path.join(REPO, "boards", "dkong", "hardware.json")
DRIVER = "dkong"
SECONDS = 30
GOLDEN_FRAMES = 1820          # floor(60.606061 * 30) + 2, the capture's own length

# ── THE INPUT TAPE, in the GOLDEN's (MAME) frame numbering ────────────────────────────────────
# coin then 1P start then P1 Right held so Mario walks once he spawns. Same events on both sides.
LUA_COIN, LUA_START, LUA_WALK = 120, 180, 1180
# ★ TAPE_ORIGIN = 3, MEASURED. On the coroutine engine boot burns NO frames; MAME spends 3 (its
# RAM-clear) before the same first vblank wait, so idiomatic state[i] == golden state[i+3] at boot
# (measured: at offset 3 the only work cells that differ are the inert spin counter 0x6019 and two
# frame-sync timers; sprite+video RAM are byte-exact). applyInputs is called at (idiomaticFrame +
# TAPE_ORIGIN) so the tape rides the golden's numbering and the coin lands on the same game frame.
# The oracle (cycle-driven, boots like MAME) needs no origin shift — it uses the emit N+1 convention.
TAPE_ORIGIN = 3

# ── THE GAMEPLAY GATE WINDOW (JS frames.rgb indices) ─────────────────────────────────────────
# Mario spawns ~1176 and walks right to a ladder by ~1500; barrels roll throughout. Earlier frames
# are boot + the how-high/Kong intro (torn snapshot-vs-raster transition frames) and are NOT gated.
GATE_FROM, GATE_TO = 1176, 1500
BAND_FROM = 0                 # whole frame guarded — the snapshot renderer has no scanline band

# ── PER-LAYER ALIGNMENT + BAND, each MEASURED in the gate window ──────────────────────────────
# idiomatic (generator engine, renderFrame snapshot): the offset has drifted to 7 by the gate
#   window; align-tolerance +-1 (offsets {6,7,8}). CORRECT-LAYER FLOOR = 180px worst frame (0 frames
#   over 400) — the moving-sprite snapshot-vs-beam phase residual. BAND_MAX_PX = 540 = 3x the floor,
#   NOT fitted to the twin.
# oracle (cycle-driven, boots like MAME): no cutscene drift, so offset is the frozen +1 and align
#   tolerance is 0. CORRECT-LAYER FLOOR = 7px worst frame (near byte-exact, pinned). BAND_MAX_PX = 30
#   (~4x the 7px floor, a hair of run-to-run headroom); any real oracle regression is hundreds of px.
LAYER = {
    "idiomatic": dict(gen_offset=7, drift=1, band_max_px=540, tape_origin=TAPE_ORIGIN,
                      idiomatic=True, input_shift=0),
    "oracle":    dict(gen_offset=FROZEN_OFFSET, drift=0, band_max_px=30, tape_origin=0,
                      idiomatic=False, input_shift=1),
}

# ── game_responded state cells (work RAM), MEASURED against an attract-only golden ────────────
CREDITS = 0x6001     # 0 in attract forever; -> nonzero the frame the machine ACCEPTS the coin
GAME_MODE = 0x6005   # 0x01 attract -> 0x02 credit screen (coin) -> 0x03 in play (start). Never 0x03 in attract.
MARIO_X = 0x6203     # 0 until Mario spawns into the board; nonzero == Mario is on the playfield


def lua_tape(path):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"""-- Generated by pixel_suite.py -- coin, 1P start, then P1 Right held so Mario walks.
local M = manager.machine
local I2 = M.ioport.ports[":IN2"]
local I0 = M.ioport.ports[":IN0"]
assert(I2 and I0, "missing :IN2 / :IN0")
local coin, start = I2.fields["Coin 1"], I2.fields["1 Player Start"]
local right = I0.fields["P1 Right"]
assert(coin and start and right, "missing Coin 1 / 1 Player Start / P1 Right")
local f = 0
_G.__pt = emu.add_machine_frame_notifier(function()
  f = f + 1
  coin:set_value((f >= {LUA_COIN} and f < {LUA_COIN + 1}) and 1 or 0)
  start:set_value((f >= {LUA_START} and f < {LUA_START + 1}) and 1 or 0)
  right:set_value((f >= {LUA_WALK}) and 1 or 0)
end)
""")
    return path


def pin_spec():
    """The MAME entropy-pin ROM-patch spec, derived from manifest.entropyPin so it cannot drift
    from the JS pin. Uses core/entropy-pin.js's entropyPinRomSpec -- the one source of truth."""
    r = subprocess.run(
        ["node", "-e",
         'import("%s").then(async(ep)=>{const m=(await import("%s")).default;'
         'process.stdout.write(ep.entropyPinRomSpec(m.entropyPin));})'
         % (os.path.join(REPO, "core", "entropy-pin.js"), os.path.join(GAME, "manifest.js"))],
        capture_output=True, text=True, check=True)
    return r.stdout.strip()


def capture_golden(rompath, out, tape):
    subprocess.run(
        [sys.executable, os.path.join(REPO, "tools", "mame_golden.py"),
         "--hardware", HW, "--lua-dir", os.path.join(HERE, "lua"),
         "--rompath", rompath, "--out", out, "--seconds", str(SECONDS),
         "--tape", tape, "--pin-entropy", pin_spec()],
        check=True)


def render_js(out, frames, cfg):
    """Render the chosen layer through games/dkong/tools/render.js, pinned, same tape."""
    shift = cfg["input_shift"]  # oracle uses the emit N+1 convention; idiomatic rides the origin
    cmd = ["node", os.path.join(HERE, "render.js"),
           "--pin-entropy", "--frames", str(frames), "--frames-out", out,
           "--input", f"0x7d00=0x80@{LUA_COIN + shift}:once",
           "--input", f"0x7d00=0x04@{LUA_START + shift}:once",
           "--input", f"0x7c00=0x01@{LUA_WALK + shift}:hold"]
    if cfg["idiomatic"]:
        cmd += ["--idiomatic", "--tape-origin", str(cfg["tape_origin"])]
    subprocess.run(cmd, check=True)


def band_worst(js_rgb, golden_rgb, cfg):
    """Drift-tolerant per-frame worst differing-pixel count over the gate window.

    Each JS frame i in [GATE_FROM, GATE_TO) is scored against the BEST-aligning golden frame in
    i + {gen_offset - drift .. gen_offset + drift} (rows BAND_FROM..). Returns (worst, over, at):
    the worst per-frame count, how many frames exceed BAND_MAX_PX, and where the worst sits.
    Deriving PASS from `worst` alone would read an EMPTY window as clean, so the caller must also
    check the window is non-empty (game_responded proves the golden actually played)."""
    w, h, bpf = pixel_gate.screen_geometry(HW)
    offs = [cfg["gen_offset"] + d for d in range(-cfg["drift"], cfg["drift"] + 1)]
    njs = os.path.getsize(js_rgb) // bpf
    ngd = os.path.getsize(golden_rgb) // bpf
    worst, over, worst_at = 0, 0, None
    with open(js_rgb, "rb") as jf, open(golden_rgb, "rb") as gf:
        for i in range(GATE_FROM, min(GATE_TO, njs)):
            jf.seek(i * bpf)
            a = np.frombuffer(jf.read(bpf), dtype=np.uint8).reshape(h, w, 3)[BAND_FROM:]
            best = None
            for k in offs:
                if not 0 <= i + k < ngd:
                    continue
                gf.seek((i + k) * bpf)
                b = np.frombuffer(gf.read(bpf), dtype=np.uint8).reshape(h, w, 3)[BAND_FROM:]
                c = int(np.any(a != b, axis=2).sum())
                best = c if best is None else min(best, c)
            if best is None:
                continue
            if best > cfg["band_max_px"]:
                over += 1
            if best > worst:
                worst, worst_at = best, i
    return worst, over, worst_at


def state_column(golden_dir, addr):
    """Every frame's value of one work-RAM cell, read out of the golden's state dump."""
    regions = Hardware.load(HW).state_regions
    frame_bytes = sum(size for _n, _b, size in regions)
    off = 0
    for _name, base, size in regions:
        if base <= addr < base + size:
            off += addr - base
            break
        off += size
    else:
        raise SystemExit(f"pixel_suite: 0x{addr:04X} is not in any dumped state region")
    with open(os.path.join(golden_dir, "state.bin"), "rb") as fh:
        blob = fh.read()
    if len(blob) % frame_bytes:
        raise SystemExit(f"pixel_suite: state.bin is {len(blob)} bytes, not a multiple of "
                         f"{frame_bytes} -- the dumped state regions have changed")
    return blob[off::frame_bytes]


def game_responded(golden_dir):
    """Did the golden take the coin, start play, and reach Mario on the board?

    Without this a tape that never reaches the machine leaves both sides in attract, every frame
    matches, and the gate PASSes over a run that played nothing. Read from the golden's own state:
      * coin accepted  -- CREDITS (0x6001) goes nonzero (stays 0 in attract forever).
      * play started   -- GAME_MODE (0x6005) reaches 0x03 in-play (never 0x03 in attract).
      * Mario on board -- MARIO_X (0x6203) is nonzero somewhere in the GATED window, so the pixels
                          being compared are real gameplay, not the how-high/intro screen.
    """
    credits = state_column(golden_dir, CREDITS)
    mode = state_column(golden_dir, GAME_MODE)
    marx = state_column(golden_dir, MARIO_X)
    return {
        "coin accepted": [f for f, v in enumerate(credits) if v],
        "play started (mode==0x03)": [f for f, v in enumerate(mode) if v == 0x03],
        "Mario on board in gate window":
            [f for f in range(GATE_FROM, min(GATE_TO, len(marx))) if marx[f]],
    }


def runtime():
    """Which layer the player runs, read from the manifest rather than assumed."""
    r = subprocess.run(
        ["node", "-e",
         f'import("{os.path.join(GAME, "manifest.js")}").then(m => console.log(m.default.runtime))'],
        capture_output=True, text=True, check=True)
    return r.stdout.strip()


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--rompath", default=os.path.join(GAME, "rom"))
    p.add_argument("--frames", type=int, default=GOLDEN_FRAMES - 1)
    p.add_argument("--work", default=os.path.join(GAME, "out", "pixelwork"))
    p.add_argument("--layer", choices=("idiomatic", "oracle"), default=None,
                   help="which layer to render vs MAME. Default reads manifest.runtime; the pixel "
                        "gate passes this explicitly, chosen from which layer's files changed.")
    a = p.parse_args()

    try:
        verified = subprocess.run(["mame", "-rompath", a.rompath, "-verifyroms", DRIVER],
                                  capture_output=True, text=True).returncode == 0
    except FileNotFoundError:
        print("pixel_suite: SKIP -- no `mame` on PATH")
        return 0
    if not verified:
        print(f"pixel_suite: SKIP -- romset {DRIVER} not found under {a.rompath}")
        return 0

    layer = a.layer or runtime()
    cfg = LAYER[layer]
    src = "--layer" if a.layer else "manifest.runtime"
    print(f"  layer: {'IDIOMATIC (generator engine, renderFrame snapshot)' if cfg['idiomatic'] else 'oracle (cycle-driven)'}"
          f"; golden offset {cfg['gen_offset']} +-{cfg['drift']}, band {cfg['band_max_px']}px (from {src})")

    os.makedirs(a.work, exist_ok=True)
    go, jo = os.path.join(a.work, "golden"), os.path.join(a.work, layer)
    capture_golden(a.rompath, go, lua_tape(os.path.join(a.work, "tape.lua")))
    render_js(jo, a.frames, cfg)

    rc = 0
    resp = game_responded(go)
    for label, frames in resp.items():
        if not frames:
            print(f"pixel_suite: FAIL -- golden shows no '{label}'; this run compares two "
                  "attract/idle screens, which proves nothing.")
            return 1
        print(f"  golden: {label:32} frames {frames[0]}..{frames[-1]}")

    _, _, bpf = pixel_gate.screen_geometry(HW)
    njs = os.path.getsize(os.path.join(jo, "frames.rgb")) // bpf
    if njs < GATE_TO:
        print(f"pixel_suite: INCOMPLETE -- render delivered {njs} frames; the gate window ends at "
              f"{GATE_TO}, so the comparison never reached gameplay.")
        return 1

    worst, over, at = band_worst(os.path.join(jo, "frames.rgb"),
                                 os.path.join(go, "frames.rgb"), cfg)
    verdict = pixel_gate.PASS if over == 0 else pixel_gate.FAIL
    print(f"  gameplay [{GATE_FROM}:{GATE_TO}] worst={worst:5d}px (budget {cfg['band_max_px']}) "
          f"over={over} worst@{at} -> {verdict}")
    if over:
        rc = 1

    print(f"pixel_suite: {'PASS' if rc == 0 else 'FAIL'}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
