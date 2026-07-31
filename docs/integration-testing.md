# 5. Integration testing — the MAME ground-truth harness

Unit tests prove a routine matches the disassembly. Integration testing proves the *whole machine*
matches reality, where reality is **MAME** running the same ROM. The comparison is only meaningful
if both sides are deterministic and produce the same artifacts, so most of the harness is about
pinning determinism. The one channel this cannot hold — the timing-seeded RNG — has a shared
**entropy-pin** mode (`--pin-entropy` on both the golden and the port); see the *Entropy pinning*
section of [the decompiler pipeline](decompiler-pipeline.md).

## Run it alongside translation, not after

Stand up the machine as soon as it can boot and run this gate **continuously, in parallel with
[translation](translation.md)** — it is not a final step. The whole-machine diff validates the
routines you *already* have, working together, and it fails at the first routine that diverges (or
the first unregistered `m.call`) — which is exactly the routine to translate or fix next. So the
gate doubles as the work-list: boot it, see where it stops or diverges, address that, boot again.
Waiting until translation is "done" hides integration bugs until they have piled up and discards the
diff's you-are-here signal. Donkey Kong was built this way — the state diff drove the *order* of the
work, and the same loop runs from the first bootable frame of every new game.

## Capturing a golden (the reference side)

`tools/mame_golden.py` drives MAME with a pinned, determinism-controlled command line: video/sound
off, no throttle, no frameskip, a **fresh empty nvram and cfg directory per run**, no autosave. Two
runs produce byte-identical output. It installs a Lua instrument (`games/dkong/tools/lua/`) that,
each frame, dumps the work/sprite/video RAM and optionally a hardware-write trace; an input tape
(`games/<id>/tapes/*.lua`) can press buttons and poke state to reach a chosen scenario.

It then extracts three artifacts:

- **frames.rgb** — the raw video, one 256×224 RGB frame after another (via ffmpeg).
- **state.bin** — a fixed-size RAM snapshot per frame.
- **writes.txt** — the hardware writes in execution order.

Every capture is **self-checked and fails closed**: the frame and state counts must equal the
frame-rate formula, the power-on state must be all-zero, the AVI and the state dump must agree, a
watchdog-reset signature must be absent, and the machine configuration is *certified* — the dip
switches and the CPU reset state must match pinned constants (`tools/scope.py`), or the golden is
rejected. A golden captured against a subtly different machine is worse than no golden.

## Emitting the same artifacts (our side)

`games/dkong/tools/emit.js` runs the JavaScript machine and writes the **same three formats** — `state.bin`,
`writes.txt`, `frames.rgb` — from the same inputs/pokes as the tape. It is honest about scope: if it
can only produce a short run, it says so and exits non-zero, so a partial artifact never reads as
complete.

## Diffing in an order that localizes the fault

The diff tools are shared across every board, so none of them hardcode a game's addresses: each
takes `--hardware boards/<driver>/hardware.json`, the board's machine-readable declaration of its
state-dump regions, MMIO write ranges, screen size, driver name, and frame timing. The JS engine
keeps its own numeric constants in `boards/<driver>/{memory,io}.js`, unrefactored; a drift test
(`boards/dkong/test/board.test.js`) asserts the JSON matches them so the two can never diverge.

`tools/verdict.sh` runs the diffs in a deliberate order — **state → writes → pixels** — so a failure
is interpretable:

- **state** differs ⇒ the CPU/logic is wrong; the renderer is irrelevant until it's fixed.
- state matches but **pixels** differ ⇒ the bug is in the video model, not the CPU.
- **writes** (in execution order) catch timing/ordering errors that state snapshots miss.

Each stage names whether it actually ran (a missing reference reports "gate unavailable", never
"pass"), and unexpected exit codes fail closed as harness errors. The result is `PASS` / `FAIL` /
`PARTIAL` / `NOTHING-COMPARED`, with exactly which gates ran.

## Cycle-free convergence — validating the whole game with no T-state clock

The diffs above assume a cycle-*driven* run (the NMI fires at an absolute T-state count). The
idiomatic layer is cycle-*free*, so it needs the frame-stepped engine (fire the NMI at the
vblank-poll yield — see [the decompiler pipeline](decompiler-pipeline.md), "Cycles are droppable").
Three committed pieces make that a repeatable, game-agnostic gate:

- **`core/frame-stepped.js` — `runCycleFree(machine, {pollPCs, maxFrames, onFrame})`.** The engine
  mode: neutralises the cycle scheduler and fires the NMI when the CPU reaches a poll PC. Works on
  any game's `Machine` (they share the interface). A ROM-guarded smoke test
  (`games/thepit/idiomatic/test/frame-stepped.test.js`) gates it — it drives The Pit to the demo.
- **`manifest.convergence`** (per game) — `pollPCs` (the vblank-poll yields) and `stateExclude` (the
  free-running cycle-proxy counters + dead stack that legitimately hold a bounded phase offset).
  Plus `manifest.entropyPin` (JS `seedBytes` / MAME `romPatches`) so a pinned run is deterministic.
- **`tools/convergence.mjs`** — runs the game cycle-free and scores it against a MAME golden with the
  drift-tolerant **reconverge** rule (a frame is compared to its NEAREST golden frame, not its
  index-mate; PASS iff no frame diverges past the threshold). Exit 0 = converged.

**The procedure** (needs the game's BYO ROM + MAME locally; the golden is not committed):

1. Capture the golden with `tools/mame_golden.py` (see "Capturing a golden" above).
   - **Pixel gate:** an *unpinned* golden (`--seconds N`, keep frames). The reconverge rule tolerates
     the RNG-driven attract content, so no pin is needed on either side.
   - **State gate:** a *pinned* golden — MAME's RNG frozen the SAME way as the JS `seedBytes`. Do NOT
     freeze it with a frame-notifier or an un-held `install_write_tap` (see [grounding.md](grounding.md)
     on token retention); a debugger write-reset of the LFSR at its `ret` is the reliable route, and
     verify the capture with `screen:frame_number()`, not a Lua frame counter.
2. Run the gate:
   ```
   node tools/convergence.mjs --game <g> --golden <dir> --mode pixel            # unpinned
   node tools/convergence.mjs --game <g> --golden <dir> --mode state --pin      # pinned
   ```
3. Read it: pixel PASS = the engine tracks MAME visually across the run. The **state** view is a
   diagnostic, not a hard gate — the RNG-driven demo *content* is the entropy-timing residual that
   pixels validate, so the state diff never fully zeroes on a demo; what it confirms is that the
   *deterministic* structure matches (boot, setup, and RNG-independent transitions like The Pit's
   demo entry, which converges JS f671 / MAME f691).

**Porting to a new game** is two facts: (1) the `pollPCs` — the ROM addresses where the main loop
spins waiting for vblank (a `waitFrames`-style flag read and the main-loop top); pick the loop
YIELDS, never a busy-delay's inner djnz, or the NMI fires thousands of times per frame. (2) the
entropy pin — find the byte that forks while the interrupt counter stays synced (the attract-mode
RAM diff auto-identifies it; see decompiler-pipeline.md). Put both in `manifest.convergence` /
`manifest.entropyPin` and the tool works unchanged.

## Go-live — running the WHOLE game idiomatic

`runCycleFree` detects the frame boundary via **`m.step` reaching a poll PC**. That only works while
the poll routines (`mainLoop`, `waitFrames`) are still TRANSLATED — they are what emit the `m.step`.
Idiomatic routines are cycle-free and **never call `m.step`**, so once you wire the poll routines
themselves idiomatic (the whole-game state), the poll-PC seam goes dark and the run hangs. That is
why per-routine swaps validate under `runCycleFree` but the *whole idiomatic game* needs a second
engine.

**`core/frame-stepped.js` — `runIdiomaticGame(machine, {watchdogPort, nmiReturnPC, maxFrames, onFrame})`.**
The go-live engine. It fires the vblank NMI on the ONE control-flow event the idiomatic poll routines
still perform once per frame: the **watchdog kick** — a read of `watchdogPort` (The Pit `0xb800`) that
`mainLoop` does once per pass and `waitFrames` once per spin. That read IS the vblank-poll yield:
sample the pre-NMI state (same order as `runCycleFree` — sampling *after* the NMI fakes a one-frame
phase shift in every NMI-updated cell, e.g. the sound ring / input debounce), then run the real NMI.
An `inNmi` guard stops the handler's own watchdog kick from re-triggering. `nmiReturnPC` is any valid
ROM PC for the NMI's pushed return (use the main-loop top). Wire EVERY idiomatic routine as an
override; `machine.reset()` then enters the idiomatic boot at `0x0000` and the game self-drives.

**The gate: `<game>/idiomatic/test/golive.test.js`.** Run the assembled idiomatic game under
`runIdiomaticGame` AND the pure-translated game under `runCycleFree` for the same frame count, and
assert byte-identical over the **used game-state region `[0x8000, gameStateHi]`** minus the
cycle-proxy cells — plus that it reaches a known state (The Pit: `GAME_STATE == 4`, the attract demo,
proving boot → setup → demo all run idiomatic). This is the capstone the per-routine equivalence
tests build toward: not "each routine matches in isolation" but "all N routines run together AS the
game and reproduce the oracle" (which is itself pixel-validated vs MAME). The translated oracle is
the practical ground truth here; the pinned-MAME *pixel* golden is the final capstone once the
shipped runtime is flipped.

**Porting go-live is three facts** in `manifest.convergence.golive = { watchdogPort, nmiReturnPC,
gameStateHi }`: (1) `watchdogPort` — the I/O address whose READ kicks the watchdog (once per frame in
the poll loops). (2) `nmiReturnPC` — the main-loop top. (3) `gameStateHi` — the top of the used
game-state region: instrument a pure-translated run and take the **highest DIRECT store** (a write
where `addr != SP` and `!= SP+1`) in work RAM; everything above it is stack / unused scratch and is
not compared. Confirm the gate has TEETH by injecting a fault into a routine that actually WRITES in
the scenario (verify it is a live writer first — a rendering-only routine whose colour-RAM output is
outside `[0x8000, gameStateHi]` will not trip a game-state gate, which is a poor teeth target, not a
missing tooth).
