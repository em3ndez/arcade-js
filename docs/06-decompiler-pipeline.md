# 6. The decompiler pipeline — dropping fidelity down to what pixels need

The strict `optimized/` sweep — the retired predecessor of this pipeline (see *What this retires*,
below) — rewrote the [translated](02-translation.md) lift into idiomatic
JavaScript while holding it **observably equivalent to the last byte and the last T-state** —
full register file, all flags, exact per-branch cycle totals. That strictness is what made the
sweep trustworthy, and it shipped a working, MAME-validated Donkey Kong. It is also the thing that
kept the `optimized/` output reading like a disassembly: every dead flag preserved, every register
shuffle kept, `m.step` bookkeeping on every line, an atomicity analysis per routine.

This is the pipeline that supersedes it (Karl's call, 2026-07-24, proven the same day), and it removes
almost all of that. The whole thing is one sentence:

> Register fidelity and cycle fidelity are **conservative proxies**. The only thing that has to be
> right is the memory the display reads. Reproduce *that* — plus the registers/flags a caller
> actually consumes — and the code is free to be ordinary JavaScript.

Everything below is the consequence of taking that seriously.

## Why the proxies are safe to drop (measured, not asserted)

The registers/flags/cycles a routine leaves behind only matter if something downstream *reads*
them before they are overwritten. A dead value can be anything; it never reaches pixels. Three
experiments this session pinned exactly where the live boundary is:

- **Registers, flags, and the stack are droppable.** Decompiling `entry_1a07` (a rst-0x28 router)
  with the *entire* register/pointer-walk dance deleted, the whole-machine RAM trace stayed
  byte-exact over 166 dispatches. The bytes the oracle pushes to the stack never surface — the
  stack region is dead scratch (`STACK_SCRATCH [0x6be0,0x6c00)`). Reviewers all session kept
  reporting the same tell: corrupting a register on a naturally-run path is *not* caught by the
  whole-machine gate precisely when the register is dead. When it is live, the corruption
  propagates into memory and the gate catches it for free. So the whole-machine/pixel gate already
  gives you exactly the register correctness that matters; the strict full-register unit check was
  catching *dead* differences.

- **Cycles are droppable, under two conditions.** A frame-stepped engine — one that fires the
  vblank NMI at the main loop's natural vblank-poll yield (`0x02BD`) instead of at whatever
  instruction the cycle count lands on — was run against the stock cycle-accurate engine with the
  PRNG entropy-pinned on both sides. Per-frame RAM was **identical**: driven gameplay byte-for-byte
  (reconverging), attract carrying only a single bounded, non-propagating difficulty-*prescaler*
  phase counter (`0x6384`, ±1–2, never reaches gameplay). The result is teeth-verified: pin **off**
  forks 974 addresses (the seed forks at frame 5); an injected canary byte is caught; a large
  arbitrary NMI-shift forks `GAME_STATE` even pinned. So the two conditions are real requirements,
  not free lunch:
  1. **Keep the PRNG pinned for validation.** The timing-seeded spin counter (`0x6019`/seed
     `0x6018`) is the one channel cycles genuinely feed into memory; pinning redirects its readers
     to a constant so it cannot fork. (See *When the RNG itself is the obstacle*, below — the
     entropy-pin mode built for exactly this.)
  2. **Fire the NMI at the vblank-poll yield.** The real machine only accepts the NMI when the main
     loop is idling at its poll, so the handler always runs against completed, quiescent work —
     never a mid-flight data race. A cycle-free frame model does this naturally; it must not fire
     the NMI at an arbitrary point.

- **The production path works from the lift + the RAM names alone.** Hand-decompiling `loc_1cd2`
  from *only* `translated/state0.js` + `ram.js` (no `optimized/` crib, no purpose-prose), the
  worker recovered the routine's meaning — "commit one horizontal walk step; on 25m re-snap Y to
  the sloped girder under the new X" — from opcodes and named memory. Its own verdict: **`ram.js`
  did the heavy lifting.** Named memory is what makes routines legible on sight. That is the
  argument for front-loading the RAM-naming pass and for keeping the names honest.

The one thing cycles still feed that this does *not* remove is **DMA sub-frame raster position** —
the already-accepted ~98px Pauline artifact. That is a pixel-only effect; it never touches RAM.

## The fidelity contract, going forward

Per routine, the gate is **memory-equivalence, not byte-exactness**:

- Compare RAM (minus `STACK_SCRATCH`) + `pc` + `SP` + the routine's *declared live-out* against the
  `loc_XXXX` lift. **Never** the full register file, **never** cycles.
- Determine live-out honestly by reading the exit successors (which registers/flags they read
  before overwriting). For most routines it is *memory only*; the flag/register plumbing the lift
  threads through every instruction is dead.
- The PRNG is entropy-pinned so runs are deterministic.
- Every gate carries **teeth** — a deliberately-broken twin it must catch — or it proves nothing.
- Validate via **unit-capture at real dispatches** (clone the machine at a captured entry, run
  oracle vs clean in isolation) **+ a reachability sweep** over natural dispatches **+ crafted
  identical-both-sides entries** for arms attract never reaches. The strict *whole-machine
  byte-exact* gate can no longer be used: a cycle-free routine under-charges cycles, which shifts
  NMI timing and false-fails the trace. That is not a regression — it is the memory-equivalence
  gate doing its job.

The capstone over the whole game stays **pixel-exact vs pinned MAME**. Per-routine
memory-equivalence is the fast local proxy; MAME pixels are the falsifiable ground truth.

## Testing a routine without running the game — capture, clone, replay

The per-routine gate needs realistic *inputs*: the exact machine state a routine is actually called
with. A routine buried in a cascade has gnarly live-in state — `IX` pointing at a specific object
record, particular RAM bytes, an exact register file — and constructing a *valid* one of those by
hand is painful and error-prone; you build unrealistic states and miss the ones that matter. So we
don't construct inputs. We **capture** them from the running game:

1. **Run the real machine** — boot, then a couple thousand frames of attract (or driven input). The
   game plays normally and, in the course of that, dispatches the target routine wherever it
   naturally occurs.
2. **Hook the routine's address in the dispatch registry.** `m.call(0xADDR)` resolves an address to
   a function through a table; we slip a wrapper in front of the target. Each time the game is
   *about* to run it, the wrapper first does `m.clone()` — a **deep copy of the entire machine** at
   that instant (all of RAM, the full register file, `SP`, `PC`, the cycle counter) — then lets the
   real routine run so the game continues undisturbed. Each snapshot is one **real captured
   dispatch**: the precise state the routine was actually invoked with, mid-play.
3. **Collect hundreds of them.** Over one run a routine may be dispatched many hundreds of times —
   `loc_1cd2` fires 557× in a plain attract run, each with a different real position, girder, and
   board state.
4. **Replay each in isolation.** For a snapshot: clone it twice, run the **oracle** on one copy and
   the **candidate** rewrite on the other, and diff the two resulting machines on the contract above
   (RAM − `STACK_SCRATCH`, `pc`, `SP`, live-out). Identical across every captured dispatch → the
   rewrite reproduces the oracle on every state the game really produces. The routine is never wired
   into the live game; it runs on snapshots, off to the side.

Why capture instead of construct — this is the part worth calling out:

- **Realism.** You test the exact state *combinations* the routine meets in play, not synthetic ones
  a human guessed at.
- **No guessing.** The running game mints valid, in-distribution inputs for free — you never have to
  work out what a legal deep-cascade live-in even looks like.
- **Coverage.** Hundreds of real invocations span the routine's real input distribution.
- **Isolation with a fair start.** The clone leaves the real run untouched (so it keeps producing
  captures) and hands oracle and candidate a *byte-identical* starting state, so any divergence is
  the rewrite's fault, never the input's.

For arms the real run never reaches — `loc_1cd2`'s non-25m-board path, say, since attract only plays
25m — take a real captured state and poke the *one* variable that forces the unhit path
(`BOARD = 2`), identically on both sides. That is the **crafted entry**: a real state with a
surgical nudge, not a wholesale fabrication. And every gate carries a **teeth** twin — a
deliberately-broken candidate the diff must catch — so a green run means something.

The helpers live in `core/equivalence.js` (`wholeMachineEquivalence`, `firstStateDiff`) and the
per-routine `capture*` functions in each `equivalence-<addr>.test.js`.

## Entropy pinning — keeping validation deterministic

Every divergence above is confined to dead memory and invisible in play. The **one channel that does
not behave this way is the RNG** — and because this method drops the cycle model, the timing-seeded
RNG *does* fork under validation unless we pin it. So pinning is not a rare fallback here; it is the
standard, **test-only** technique that keeps a cycle-free routine's validation deterministic. The
shipped game still runs the real timing-driven RNG (real randomness, just not MAME-bit-identical);
pinning lives only in the validation harness. How it works, and how it was built for Donkey Kong:

Donkey Kong seeds its randomness from timing: each vblank `sub_0057` does `RNG(0x6018) += FRAME +
SPIN_COUNT`, and `SPIN_COUNT(0x6019)` counts main-loop passes per frame — a pure function of how many
cycles the frame's work consumed. A *correct* collapse preserves each routine's **total**, so it
never changes the per-frame cycle budget, so `SPIN_COUNT` and the PRNG stay identical:
**total-preservation is what keeps the RNG out of the collapse's way.** But a wrong total *does*
reseed the PRNG (the one channel cycles feed into memory, above), and unlike a stack byte a wrong random draw does
not wash out — it compounds. The RNG is the one place where a timing error is permanent.

If a future game couples its RNG to timing more tightly than total-preservation can hold — sampled
from a free-running counter on *every read*, or coupled to beam position or analog noise — then no
converge/diverge gate can save it, and the fallback is to **replace the timing-seeded RNG with a
deterministic, timing-independent generator installed identically on both sides**: a ROM patch (or
memory hook) on the MAME oracle, and a matching `mem`-seam hook on the port, seeded
identically at reset. With the stream pinned, cycle differences can no longer move it, and
equivalence again isolates real logic bugs.

The catch makes this a tool, not a shipping path. Pinning the RNG **changes the game's actual
behaviour versus a real cabinet** — the enemy sequence is no longer the hardware's — so you have
replaced part of the oracle and forfeited falsifiability against real hardware. Use it as **a
diagnostic**: pin the RNG on both sides and see whether a stubborn divergence *vanishes*, which
cleanly separates a timing/RNG bug from a logic bug — then unpin and fix the timing. At most, use it
as a **last-resort shipping compromise**, documented loudly. For faithful shipping, keep the real
RNG — **the shipped game never pins.**

### Entropy pinning, as built for Donkey Kong

The paragraph above once ended "on Donkey Kong it is not needed" — total-preservation keeps a
*collapse* from adding any RNG drift, so the short validation windows (the 728-frame attract, the
move/prize suites) stay clean. That was true as far as it was tested. A **long, multi-board tape**
(`test_full_progression`, ~9500 frames, nine completions) took it further and found the residual the
short windows never exercised: the base translation is cycle-*accurate* but not cycle-*exact* with
MAME on the CPU-vs-beam race, so `SPIN_COUNT` (0x6019) forks against MAME within ~9 frames — even
for the frozen oracle, collapse or none — and every RNG-driven sprite then drifts. So the fallback
above is not merely theoretical here; it is **built, as a reusable test-only mode**, and used to
validate long runs. It is game-agnostic infrastructure, because the spin-counter idiom is genre-wide.

- **Discovery is automatic.** Diff attract-mode work RAM between the two engines per frame: exactly
  the entropy set forks, and the tell is that it forks *while the interrupt counter stays
  byte-identical* (the interrupt counter is the synced twin). For DK: `0x601a` identical through
  1214 frames; `0x6019` first at frame 9; the seed `0x6018` one frame later.
- **The pin makes the working set read a deterministic 0 on both engines.** Drop writes to the seed
  so it keeps its boot value (kills its single writer, the once-per-frame mix `sub_0057`), and point
  the spin counter's direct readers at the pinned seed. This is independent of the interrupt counter
  (which carries ±1 cutscene jitter from the DMA artifact) and of any spin-counter writer, and it is
  **cycle-neutral** — operand-only rewrites, never a NOP that changes an instruction's length (an
  early NOP-the-`inc` version shifted the frame timing and made the diff *worse*).
- **Realized on each side, from one config.** `manifest.entropyPin` (`seedBytes`, `redirectReads`,
  `romPatches`) declares it; `core/entropy-pin.js` `installEntropyPin` wraps the JS `mem` seam
  (`emit.js --pin-entropy`); `games/dkong/tools/lua/pin_entropy.lua` applies the mirror ROM patches
  on MAME (`mame_golden.py --pin-entropy "<spec>"`, spec from `entropyPinRomSpec`). Both sides
  express the *same* intent, twice, so they can be checked against each other.
- **What's left is the DMA cutscene artifact, so validate pinned runs with a convergent /
  align-tolerant diff.** With the pin on, the RNG-driven divergence is gone (attract seed
  byte-identical; on the long tape the convergent diff drops from mean 90 px / 25 frames >1% to mean
  43 px / 1 frame >1%). The residual ~1% is the Kong-climb DMA phase — the same accepted artifact —
  which no RNG work removes.

**Adding a new game:** attract-diff to find the spin counter (forks next to a synced counter) and
the seed its mix routine writes; fill `manifest.entropyPin` (`seedBytes` = the seed; `redirectReads`
= `{from: spin, to: seed}`; `romPatches` = the cycle-neutral operand rewrites — the seed store's
target to a ROM address so the write is ignored, each spin read's address to the seed); verify the
seed goes byte-identical in attract with the pin, then a gameplay tape converges to the DMA floor.

## Output conventions

- **Direct function calls.** No `m.call`/address registry, no `push16`/stack modelling. `m.call`
  is a runtime *linker* that existed to hot-swap oracle↔optimized during the sweep and to isolate
  a routine under test; the shipped artifact wants early binding — just call the function. The Z80
  stack becomes the JS call stack. Computed dispatch → a table of *function references*
  (`HANDLERS[state](m)`). The caller-skip idiom (`inc sp; inc sp; ret`) → a **boolean return** +
  `if (!callee(m)) return;`. Keep an address registry only for exotic address-level control flow
  (self-modifying code, wild computed jumps into mid-routine) — clean games don't have it.
- **Bottom-up.** Decompile callees before callers. A caller decompiled while its callee is still a
  raw ROM routine has to marshal the callee's register ABI by hand (`regs.h = x; push16; m.call;
  … regs.l`) — the one assembly leak left in the `loc_1cd2` v1 demo. Decompile the callee first
  into a real signature (`snapYToGirder(x, y, step) → newY`) and the marshalling dissolves into a
  named call. (Confirmed 2026-07-24: v2 did exactly this — `0x2333` decompiled to a *pure*
  `snapYToGirder_2333(x, y, step)`, validated exhaustively over all 131,072 inputs; `loc_1cd2`'s
  five-line marshalling block collapsed to one named call; the pair is leak-free — no `m.call`,
  `push16`, `m.step`, or register/flag marshalling in its own code. The only residue is the tail
  `loc_1ceb`, still the frozen oracle, which is simply the next thing bottom-up order would take.)
- **Naming.** Uniform `loc_<addr>` is the baseline. Drop the `sub_`/`entry_`/`handler_`/`arm_`/
  `guard_`/`branch_`/`tail_` prefix zoo — it is *pseudo-semantics*, a taxonomy applied ad hoc
  routine-by-routine that implies meaning it does not consistently carry. **Promote** to an English
  name only where the meaning is genuinely earned, and **always keep the address as an anchor**
  (suffix `snapYToGirder_2333`, or English-primary with a `// ROM 0x2333` tag). Routine names get
  the same evidence bar as RAM names (corroborated, proposer≠confirmer) — a *wrong* English name
  misleads worse than a neutral `loc_<addr>`; it is the routine-level sprite-record trap. The name
  encodes confidence: `loc_1cd2` = "correct but not yet understood," `walkStepCommit_1cd2` =
  "understood and confirmed."

## File format & directory layout

The go-forward layer lives in its own directory, **`games/dkong/idiomatic/`**, and new work is
generated there. The existing **`games/dkong/optimized/`** is frozen — it stays wired and shipped
for the ~224 routines already done, but nothing new goes into it, and its contents are removed
per-routine as their idiomatic replacements land. The manifest resolves each address to *either*
its `optimized/` or its `idiomatic/` module, so the two coexist during the transition; optimized/
is deleted once empty.

Two canonical file templates, so the format stops drifting:

**`translated/` — one line per routine (the faithful lift; permanent oracle):**
```js
/** <name>  (ROM 0x<start>–0x<end>) — <terse role>. */
```
Range always present; em-dash; behaviour body stays faithful (one statement per Z80 instruction,
`// <mnemonic>` per line, per [doc 2](02-translation.md)).

**`idiomatic/` — fixed header, fixed section order (memory-equivalent, cycle-free):**
```js
// SPDX-License-Identifier: GPL-3.0-only
/**
 * <name> — <one-line role>.  ROM 0x<addr>.
 *
 * Memory-equivalent to the frozen oracle — equivalence-<addr>.test.js.
 * GATE:     <strict | convergent | crafted-entry>; <reachability one-liner>.
 * LIVE-OUT: <memory-only | + which regs/flags>.
 * NAMES:    <imported ram.js names | hex-kept addrs + one-word why>.
 */
```
No `CYCLES`/`COLLAPSE` sections and no inline disassembly dumps — the cycle model is gone, so that
bulk (and most of the drift) goes with it. `optimized/`'s old rich headers are not retrofitted; the
idiomatic rewrite carries the final form.

## The pipeline for the next game

1. **Lift → `loc_XXXX()`** — the faithful per-instruction transliteration; the frozen oracle.
   (This is [doc 2](02-translation.md), with uniform address names from line one.)
2. **Call graph + reachability** — who calls whom, what is reachable, what is dead. This is the
   prerequisite that makes "bottom-up" meaningful.
3. **RAM naming pass** — evidence-based (control-poke, cross-routine corroboration,
   proposer≠confirmer, the sprite-record trap). Front-loaded, because named memory is the single
   biggest legibility lever; iterative, because some names only resolve during the decompile.
4. **Bottom-up decompile *and* routine naming, as one interleaved step** — leaves first, direct
   calls, drop cycles and dead registers/flags, recover structure, promote names where earned.
   Each routine gated **memory-equivalent** against its `loc_XXXX` lift (pinned PRNG, teeth). Seed
   the obvious routine names (RST vectors, leaf sound triggers, the NMI handler) up front, but
   expect most names to fall out *of* the decompile, not before it.
5. **Capstone: pixel-exact vs pinned MAME** — the ground-truth falsifiable check. DMA raster is
   the one accepted sub-frame residual.

## What this retires

The **strict `optimized/` stage** (translated → cycle-collapsed, register/cycle-exact) is no longer
a stage going forward. It was necessary discovery — it built the equivalence harness, the RAM-name
evidence, and the proof that cycles/registers are droppable, and none of the idiomatic insight
exists without having done the strict version first — but as a *permanent* pipeline layer it is an
intermediate tuned for a fidelity the final product abandons. The lean pipeline is three persisted
things: **ROM → `translated/` (frozen oracle) → idiomatic (memory-validated)**. The optimized
middle layer collapses out. `translated/` stays, as the trust anchor and the fast in-process
oracle.

## The tool question (separate from finishing DK)

The decompile in step 4 is **manual (LLM) today**, and for finishing DK that is the whole job — the
`loc_1cd2` demos show it produces genuinely readable, memory-proven output from the lift + names.
The **best** output is a hybrid: a mechanical decompiler pass (SSA → liveness/dead-code →
control-flow structuring → emit, cycle-free) for provably-correct clean *structure*, then an LLM
*semantic* pass for the names/comments/idiom, both memory-validated. Pure-mechanical is
correct-but-soulless; pure-hand is great but doesn't generalize. Build the mechanical tool only for
the **transfer thesis** (Frogger, then all of MAME), where the front/middle-end amortizes across
games — not to finish DK, where a retargeted manual sweep already clears the bar. A manual pass
cannot tell you whether a *mechanical* tool suffices (the LLM smuggles in understanding a tool
lacks); that question needs its own stripped/from-IR experiment.

## Traps

- **The NMI must fire at the vblank-poll yield.** An arbitrary preemption point forks real state
  (`GAME_STATE`) even with the PRNG pinned. This is a hard requirement of the cycle-free model, not
  a nicety.
- **The entropy pin is load-bearing for validation.** Without it, dropping cycles forks the seed at
  frame 5 and cascades. The shipped game still spins and produces randomness — just not
  MAME-bit-identical randomness, which is fine outside the harness.
- **Free-running per-frame service counters** (the `0x6384` prescaler class) can hold a small phase
  offset across a mode transition under frame-stepping. Bounded and non-propagating in every DK run
  measured, but verify per game that such a counter never reaches gameplay-visible state.
- **The register-ABI marshalling leak** persists until you decompile bottom-up. It is not
  fundamental; it is the artifact of decompiling one routine while its callee is still raw ROM.
