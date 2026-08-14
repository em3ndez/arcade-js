# The Frogger idiomatic layer — grounding

A grounding note for the hand-written layer under `games/frogger/idiomatic/`: what it is, what
"correct" means for it, and how that is proven. Names for the routines and the game's
`mechanisms.md` map are earned later, in the understanding pass after each decompile batch; until
then modules keep their `loc_<addr>` names.

## What it is

The idiomatic layer is a second implementation of the game's routines — small, readable JavaScript
— that runs *in place of* the frozen translated oracle in `games/frogger/translated/`. It is born
live: where an address has an idiomatic module the machine runs it; where none exists yet, the
translated routine runs. There is no go-live switch and no dormant layer — coverage grows one
address at a time as modules land.

## The correctness contract

The frozen translated layer is the authority: a faithful, cycle-checked transcription of the Z80
ROM. An idiomatic module is correct iff, for every entry, it leaves the machine **memory-equivalent**
to its oracle on the declared live-out:

- always the RAM / VRAM / IO it writes;
- plus the specific CPU register(s) the *caller* consumes after the call — most leaves leave none,
  because the caller reloads them;
- never the T-state clock. The layer reproduces memory, not time.

Each module ships with an equivalence gate (`test/equivalence-<addr>.test.js`) that replays
oracle-versus-rewrite on captured or crafted entries and asserts exactly that live-out. Every gate
carries broken twins — "teeth" — it must catch, so it cannot pass vacuously. Where the oracle leaves
dead scratch on the stack that the register-free rewrite never writes, the gate masks that window;
where live-out escapes RAM (a sound-command port, a screen-flip latch), the gate compares the IO
surface directly.

## The go-live loop

`runIdiomaticGame` drives the layer with the clock ignored — `maxCycles` / `nextNmi` /
`nextBoundary` are Infinity and the scheduler's NMI is disabled. The frame boundary is a **vblank
yield**, not a T-state count. The spine (`drainForegroundThenYieldEachVblank`,
`endForegroundPassAtPaceTail`) drains a frame's foreground work and re-enters at the pace tail
(`0x0368`); the driver, not a busy-delay loop, decides when a pass is done and the frame yields.
Because pure delays are collapsed to no clock cost, goldens align on a boot landmark, not a frame
number.

## How correctness is proven

- **Equivalence gates** — per module, memory/register-equivalent to the oracle, with teeth.
- **Pixel gate** (`pixel_gate_required --layer idiomatic`) — renders the layer the player actually
  runs, through `runIdiomaticGame`, and diffs it against a fresh MAME golden at the aligned boot
  landmark. It is built to be able to fail.
- **The registry** — `names.js` maps each address to its module and records the routine's role.
