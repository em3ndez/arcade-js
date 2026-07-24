# 08 · Entropy pinning — validating games that race the CPU against the beam

Almost every arcade game seeds its randomness from a **spin counter**: the main loop increments a
RAM byte as fast as it can while it waits for the vblank interrupt, and mixes that count into a
seed once per frame. The count is a race between the CPU and the beam, so its value depends on
exactly how many instructions fit before the interrupt fires — i.e. on **cycle-exact** timing.

Our translation is cycle-*accurate* (every routine's total is measured against MAME) but not
cycle-*exact* to the last T-state — the `m.step` collapse (docs/06) folds per-instruction charges
into per-block totals, and even the base translation has sub-instruction slack. That is invisible
almost everywhere. It is **not** invisible to the spin counter: a difference of one spin per frame
forks the seed within a few frames, and from then on every RNG-driven sprite (barrels, fireballs,
the elevators on 75m) is in a different place in JS than in MAME. A raw pixel diff of a long run
then looks broken even though the game logic is identical.

This is a **property of the genre, not of Donkey Kong**, so the fix is built as reusable
infrastructure. The idea: for equivalence testing only, force the RNG to a deterministic value
**identically on both engines**, so the diff validates everything *except* the entropy timing —
which is the one thing that legitimately cannot match.

## 1. Discovery — let the machine find the culprit

Run both engines in **attract mode** (no input, fully deterministic) and diff work RAM per frame.
Exactly one class of byte forks: the entropy working set. The tell is that it forks **while the
interrupt counter stays byte-identical** — the interrupt counter is the synced twin (it advances
once per interrupt, which both engines fire in lockstep), so the byte that diverges next to it is
the spin-count-derived seed.

For DK that pass yields: `0x601a` (interrupt counter) identical through 1214 frames; `0x6019`
(spin count) first forks at frame 9; `0x6018` (the mixed seed) one frame later. The mix routine is
`sub_0057`: `0x6018 = 0x6018 + 0x601a + 0x6019`, run once per vblank. So `0x6019` is the only
divergent *input*.

## 2. The pin — make the working set read a deterministic 0

Two moves, applied to both engines:

1. **Pin the seed to its boot value.** `0x6018` has a single writer (the mix routine's store). Drop
   that write and the byte keeps its power-on `0` forever — every reader of the seed, however many,
   is now deterministic, and we never had to enumerate them.
2. **Point the spin counter's readers at the pinned seed.** `0x6019` is also read *directly* in a
   few places. Redirect those reads to `0x6018` so they see the same `0`.

Why not just freeze `0x6019` itself? Because it has a **second writer** we could not locate in the
disassembly (it takes 253–255 at times), and freezing only the main-loop `inc` leaves MAME's copy
diverging from JS's. Redirecting the *readers* sidesteps writer-hunting entirely. And why pin to a
constant instead of deriving from `0x601a`? Because `0x601a` carries **±1 jitter at cutscene
boundaries** (the DMA-timing artifact, §4) — any seed derived from it inherits that jitter. Pinning
to the boot constant is independent of both.

The pin **must be cycle-neutral.** An early version NOP-ed the `inc` (11→4 cycles); that shifted the
frame timing and made the diff *worse*. The shipped pin only ever rewrites instruction **operands**
(a store's target, a read's address) — same opcodes, same lengths, same cycles.

## 3. Using it

The pin is declared once per game in the manifest and realized on each side:

- **Config** — `manifest.entropyPin` (games/dkong/manifest.js): `seedBytes` + `redirectReads`
  express the intent at the RAM level (for JS); `romPatches` express the same as MAME ROM operand
  rewrites. Both are present so they can be checked against each other.
- **JS** — `core/entropy-pin.js` `installEntropyPin(machine, cfg)` wraps the `mem` seam. `emit.js
  --pin-entropy` calls it. Game-agnostic.
- **MAME** — `tools/lua/pin_entropy.lua` reads the patch spec from `$ENTROPY_PIN` and patches the
  ROM region before the CPU runs. `mame_golden.py --pin-entropy "<spec>"` composes it ahead of the
  tape and sets the env. Get `<spec>` from `entropyPinRomSpec(manifest.entropyPin)`. Game-agnostic.

The shipped game **never** pins — real randomness stays. This is a harness-only mode.

## 4. What's left, and why a convergent diff

With the pin on, the RNG-driven divergence is gone. What remains is the **DMA-timing artifact** the
project already documents and deliberately does not chase: during the "how high can you get" board
intros, we don't drive the sprite DMA cycle-for-cycle the way the real hardware does, so the
Kong-climb animation drifts a few frames mid-cutscene and re-locks by the time gameplay resumes
(the game *logic* stays in lockstep — every board completion lands within ±1 frame the whole run).
Because the content is identical but a few frames out of phase, validate the pinned run with a
**convergent / alignment-tolerant** diff (compare each frame against a small window of offsets and
take the best) rather than a fixed offset.

Measured on the full-progression tape (~9500 frames, nine board completions), pinned:

| diff | max | mean | frames > 1% | pixel-identical |
|---|---|---|---|---|
| unpinned, convergent | 1.80% | 90 px | 25 | 77% |
| **pinned, convergent** | **1.10%** | **43 px** | **1** | **78%** |

The residual ~1% is the cutscene DMA artifact; chasing it means matching MAME's DMA timing to the
cycle, a separate core-fidelity task the project has scoped out.

## 5. Adding a new game

1. Capture attract-mode work RAM from both engines; diff per frame (§1). The byte that forks next
   to a byte that stays synced is your spin counter; the seed is what its mix routine writes.
2. Find the seed's single writer (its store) and the spin counter's direct readers (a disassembly
   grep for the two addresses).
3. Fill in `manifest.entropyPin`: `seedBytes` = the seed(s); `redirectReads` = `{from: spin, to:
   seed}`; `romPatches` = the cycle-neutral operand rewrites that do the same (store target → a
   ROM address so the write is ignored; each spin read's address → the seed).
4. Verify: attract-mode with the pin should make the seed **byte-identical** between the engines.
   Then a gameplay tape under a convergent diff should collapse to the DMA-artifact floor.

See also: docs/06 (the collapse that widened the timing slack), docs/05 (the pixel gate this feeds),
docs/04 (integration testing), docs/07 (porting a new game).
