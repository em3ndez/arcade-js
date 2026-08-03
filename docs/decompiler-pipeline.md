# 8. The decompiler pipeline — dropping fidelity down to what pixels need

The pipeline rewrites the [translated](translation.md) lift into idiomatic JavaScript, held
**memory-equivalent** to the oracle: it reproduces the memory the display reads — plus the
registers and flags a caller actually consumes — and is otherwise free to be ordinary JavaScript.
It does not hold the full register file, every flag, or exact per-branch cycle totals; those are
conservative proxies for what pixels need. The whole thing is one sentence:

> Register fidelity and cycle fidelity are **conservative proxies**. The only thing that has to be
> right is the memory the display reads. Reproduce *that* — plus the registers/flags a caller
> actually consumes — and the code is free to be ordinary JavaScript.

Everything below is the consequence of taking that seriously.

## Why the proxies are safe to drop

The registers/flags/cycles a routine leaves behind only matter if something downstream *reads*
them before they are overwritten. A dead value can be anything; it never reaches pixels. Three
properties fix where the live boundary is:

- **Registers, flags, and the stack are droppable.** A routine can have its *entire*
  register/pointer-walk dance deleted and its whole-machine RAM trace stays byte-exact across every
  dispatch — `entry_1a07` (a rst-0x28 router) holds byte-exact over 166 dispatches. The bytes the
  oracle pushes to the stack never surface — the stack region is dead scratch
  (`STACK_SCRATCH [0x6be0,0x6c00)`). The tell is consistent: corrupting a register on a
  naturally-run path is *not* caught by the whole-machine gate precisely when the register is dead.
  When it is live, the corruption propagates into memory and the gate catches it for free. So the
  whole-machine/pixel gate already gives exactly the register correctness that matters; a
  full-register unit check would only catch *dead* differences.

- **Cycles are droppable, under two conditions.** A frame-stepped engine — one that fires the
  vblank NMI at the main loop's natural vblank-poll yield (`0x02BD`) instead of at whatever
  instruction the cycle count lands on — produces per-frame RAM **identical** to a cycle-accurate
  engine, with the PRNG entropy-pinned on both sides: driven gameplay is byte-for-byte
  (reconverging), attract carrying only a single bounded, non-propagating difficulty-*prescaler*
  phase counter (`0x6384`, ±1–2, never reaches gameplay). This is teeth-verified: pin **off** forks
  974 addresses (the seed forks at frame 5); an injected canary byte is caught; a large arbitrary
  NMI-shift forks `GAME_STATE` even pinned. The two conditions are real requirements, not free
  lunch:
  1. **Keep the PRNG pinned for validation.** The timing-seeded spin counter (`0x6019`/seed
     `0x6018`) is the one channel cycles genuinely feed into memory; pinning redirects its readers
     to a constant so it cannot fork. (See *Entropy pinning*, below.)
  2. **Fire the NMI at the vblank-poll yield.** The real machine only accepts the NMI when the main
     loop is idling at its poll, so the handler always runs against completed, quiescent work —
     never a mid-flight data race. A cycle-free frame model does this naturally; it must not fire
     the NMI at an arbitrary point.

- **The lift plus the RAM names carry the decompile on their own.** A routine can be
  hand-decompiled from *only* `translated/state0.js` + `ram.js` — no purpose-prose — and its
  meaning recovered from opcodes and named memory: `loc_1cd2` reads out as "commit one horizontal
  walk step; on 25m re-snap Y to the sloped girder under the new X" from the lift and names alone.
  Named memory is what makes routines legible on sight — it does the heavy lifting. That is the
  argument for front-loading the RAM-naming pass and for keeping the names honest.

The one thing cycles still feed that this does *not* remove is **DMA sub-frame raster position** —
the already-accepted ~98px Pauline artifact. That is a pixel-only effect; it never touches RAM.

## The fidelity contract

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
  identical-both-sides entries** for arms attract never reaches. A whole-machine *byte-exact* gate
  does not apply here: a cycle-free routine under-charges cycles, which shifts NMI timing and
  false-fails the trace. The memory-equivalence gate sidesteps that by comparing only what pixels
  depend on.

The capstone over the whole game stays **pixel-exact vs pinned MAME**. Per-routine
memory-equivalence is the fast local proxy; MAME pixels are the falsifiable ground truth.

## Testing a routine without running the game — capture, clone, replay

The per-routine gate needs realistic *inputs*: the exact machine state a routine is actually called
with. A routine buried in a cascade has gnarly live-in state — `IX` pointing at a specific object
record, particular RAM bytes, an exact register file — and constructing a *valid* one of those by
hand is painful and error-prone; you build unrealistic states and miss the ones that matter. So
inputs are not constructed — they are **captured** from the running game:

1. **Run the real machine** — boot, then a couple thousand frames of attract (or driven input). The
   game plays normally and, in the course of that, dispatches the target routine wherever it
   naturally occurs.
2. **Hook the routine's address in the dispatch registry.** `m.call(0xADDR)` resolves an address to
   a function through a table; a wrapper is slipped in front of the target. Each time the game is
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
RNG *does* fork under validation unless it is pinned. So pinning is not a rare fallback here; it is
the standard, **test-only** technique that keeps a cycle-free routine's validation deterministic.
The shipped game still runs the real timing-driven RNG (real randomness, just not
MAME-bit-identical); pinning lives only in the validation harness. How it works, and the Donkey Kong
mechanism:

Donkey Kong seeds its randomness from timing: each vblank `sub_0057` does `RNG(0x6018) += FRAME +
SPIN_COUNT`, and `SPIN_COUNT(0x6019)` counts main-loop passes per frame — a pure function of how many
cycles the frame's work consumed. A *correct* collapse preserves each routine's **total**, so it
never changes the per-frame cycle budget, so `SPIN_COUNT` and the PRNG stay identical:
**total-preservation is what keeps the RNG out of the collapse's way.** But a wrong total *does*
reseed the PRNG (the one channel cycles feed into memory, above), and unlike a stack byte a wrong random draw does
not wash out — it compounds. The RNG is the one place where a timing error is permanent.

If a game couples its RNG to timing more tightly than total-preservation can hold — sampled
from a free-running counter on *every read*, or coupled to beam position or analog noise — then no
converge/diverge gate can save it, and the fallback is to **replace the timing-seeded RNG with a
deterministic, timing-independent generator installed identically on both sides**: a ROM patch (or
memory hook) on the MAME oracle, and a matching `mem`-seam hook on the port, seeded
identically at reset. With the stream pinned, cycle differences can no longer move it, and
equivalence again isolates real logic bugs.

The catch makes this a tool, not a shipping path. Pinning the RNG **changes the game's actual
behaviour versus a real cabinet** — the enemy sequence is no longer the hardware's — so it has
replaced part of the oracle and forfeited falsifiability against real hardware. Use it as **a
diagnostic**: pin the RNG on both sides and see whether a stubborn divergence *vanishes*, which
cleanly separates a timing/RNG bug from a logic bug — then unpin and fix the timing. At most, use it
as a **last-resort shipping compromise**, documented loudly. For faithful shipping, keep the real
RNG — **the shipped game never pins.**

### Entropy pinning for Donkey Kong

Total-preservation keeps a *collapse* from adding any RNG drift, so the short validation windows (the
728-frame attract, the move/prize suites) stay clean without a pin. Longer runs need it. A **long,
multi-board tape** (`test_full_progression`, ~9500 frames, nine completions) exercises the residual
the short windows never reach: the base translation is cycle-*accurate* but not cycle-*exact* with
MAME on the CPU-vs-beam race, so `SPIN_COUNT` (0x6019) forks against MAME within ~9 frames — even
for the frozen oracle, collapse or none — and every RNG-driven sprite then drifts. The pin is
therefore **a reusable test-only mode**, used to validate long runs. It is game-agnostic
infrastructure, because the spin-counter idiom is genre-wide.

- **Discovery is automatic.** Diff attract-mode work RAM between the two engines per frame: exactly
  the entropy set forks, and the tell is that it forks *while the interrupt counter stays
  byte-identical* (the interrupt counter is the synced twin). For DK: `0x601a` identical through
  1214 frames; `0x6019` first at frame 9; the seed `0x6018` one frame later.
- **The pin makes the working set read a deterministic 0 on both engines.** Drop writes to the seed
  so it keeps its boot value (kills its single writer, the once-per-frame mix `sub_0057`), and point
  the spin counter's direct readers at the pinned seed. This is independent of the interrupt counter
  (which carries ±1 cutscene jitter from the DMA artifact) and of any spin-counter writer, and it is
  **cycle-neutral** — operand-only rewrites, never a NOP that changes an instruction's length
  (NOP-ing the `inc` instead would shift the frame timing and make the diff *worse*).
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
  is a runtime *linker* — useful to swap oracle for candidate when isolating a routine under
  test — but the shipped artifact wants early binding: just call the function. The Z80
  stack becomes the JS call stack. Computed dispatch → a table of *function references*
  (`HANDLERS[state](m)`). The caller-skip idiom (`inc sp; inc sp; ret`) → a **boolean return** +
  `if (!callee(m)) return;`. Keep an address registry only for exotic address-level control flow
  (self-modifying code, wild computed jumps into mid-routine) — clean games don't have it.
- **Memory access is indexed: `mem8[ADDR]` / `mem16[ADDR]`.** Read and write memory through the
  machine's indexable views (`const { mem8, mem16 } = m; mem8[DIG_DIRS] = mem8[DIG_DIRS] - 1`), never
  `mem.read8`/`write8`. They are pure sugar over the same accessors (`core/mem-views.js`), so they
  wrap and diff identically — and because the byte store already truncates, no mask is ever needed
  *before* one. A helper that only touches memory takes `m` and destructures the views it needs, not a
  bare `mem`. Emit this form at decompile time; a still-hex address is fine (`mem8[0x8079]`) — the
  understanding pass swaps the literal for a `ram.js` name later and leaves the access form untouched.
- **Name locals by meaning, never by register.** A local that survives from a Z80 register keeps the
  register's *value*, not its name: `const b = OBJ_X + 3` is `probeX`, not `b`. A single-letter or
  register-letter local (`a`, `b`, `c`, `hl`) in idiomatic code is the variable-level version of the
  assembly-comment smell. The decompile pass must name it for what it does; and the understanding pass's
  variable-naming covers **locals too**, not only `ram.js` addresses — leaving `b`/`c` unrenamed
  (they were the Z80 `B`/`C`) was a real two-pass miss on The Pit's `classifyWallCollision`.
- **Bottom-up.** Decompile callees before callers. A caller decompiled while its callee is still a
  raw ROM routine has to marshal the callee's register ABI by hand (`regs.h = x; push16; m.call;
  … regs.l`) — an assembly leak. Decompile the callee first into a real signature
  (`snapYToGirder(x, y, step) → newY`) and the marshalling dissolves into a named call. `0x2333`
  decompiles to a *pure* `snapYToGirder(x, y, step)`, validated exhaustively over all 131,072
  inputs; `loc_1cd2`'s five-line marshalling block then collapses to one named call, and the pair is
  leak-free — no `m.call`, `push16`, `m.step`, or register/flag marshalling in its own code. (Its
  tail `loc_1ceb` stays the frozen oracle, simply the next routine bottom-up order takes.)
  **Before you write `m.call(0xADDR)`, check whether that callee is already decompiled** (grep
  `idiomatic/` for its address). If it is, import and call the idiomatic function directly with
  honest args — `m.call` is *only* for callees that have no idiomatic file yet. A stale
  `regs.a = 5; m.call(0x4ca5)` to an already-decompiled `enqueueSoundCommand` is a
  register-marshalling leak that the equivalence gate does **not** catch (both call paths are
  memory-equivalent), so it survives to the reviewer — who must reject it. It bit us on The Pit:
  a run of `requestSoundN` sound-trigger stubs marshalled `A` and `m.call`ed the enqueue tail while
  a dozen sibling stubs had already dissolved to `enqueueSoundCommand(m, N)`; the mislabelled ones
  even claimed the callee was "still-oracle." The gate is green either way — *readability and the
  honest-signature rule*, enforced at review, are what force the direct call.
- **Naming.** Uniform `loc_<addr>` is the baseline. Drop the `sub_`/`entry_`/`handler_`/`arm_`/
  `guard_`/`branch_`/`tail_` prefix zoo — it is *pseudo-semantics*, a taxonomy applied ad hoc
  routine-by-routine that implies meaning it does not consistently carry. **This holds even when the
  frozen `translated/` oracle still carries a zoo name — DK's translated layer does (250/434 files are
  `sub_`/`entry_`/`handler_`/`bootInit`…, never normalized). NEVER mirror the oracle's cute filename
  into the idiomatic file: the idiomatic file AND its export are `loc_<addr>`, and the frozen oracle
  keeps its own name (imported under that name). "we don't give cute names to our routines" (Karl).**
  **Promote** to an English
  name only where the meaning is genuinely earned, and **keep the identifier clean**
  — the address lives in the `ROUTINES` registry key, **never in the identifier and no longer in a
  header tag** (a header may not cite an address at all; see the file-local comment rule below). Routine names get
  the same evidence bar as RAM names (corroborated, proposer≠confirmer) — a *wrong* English name
  misleads worse than a neutral `loc_<addr>`; it is the routine-level sprite-record trap. The name
  encodes confidence: `loc_1cd2` = "correct but not yet understood," `walkStepCommit` =
  "understood and confirmed."
- **A claim budget per header, and open questions stay open.** A header's default shape is: what the
  routine does, the cells it reads and writes, its `LIVE-OUT:` (the routine's own signature), and
  **the one derivation that justifies its name, drawn from this file's own body**. Evidence from
  OUTSIDE the routine — a caller's use of the result, a sibling, a write-set diff — goes in the
  `ROUTINES` entry's `why` field instead; reviewer-rules R5 requires it there. The `ROM 0x<addr>` tag, `Memory-equivalent to …`,
  `GATE:` and `NAMES:` are **no longer part of an idiomatic header** — they name things outside the file.
  The address moved to the registry key, `Memory-equivalent`/`GATE:` to the test header, and
  `NAMES:` was dropped as a restatement of the import list (see the file-local comment rule below). `GATE:` remains load-bearing under reviewer-rules R17 where it now
  lives, in the test header; `NAMES:` is gone entirely, since the import list already states which
  `ram.js` cells a routine uses. Everything beyond THAT has to
  earn its verification cost, because prose is the most expensive thing in the repo to check (see
  `grounding.md`, "Naming an unknown address") — there is no oracle for it, only a human
  re-deriving the claim from the ROM. Elaboration written to
  make a file feel thorough is a liability: it reads as established fact to the next agent, who
  copies its framing into the neighbouring files.
  What a header must NOT do is state as settled anything the writer did not derive while writing it.
  Where the evidence stops, **say so in the file**. The model is one sentence, not one file:
  `spawnInterludeHeart`'s *WHAT THIS NAME DOES NOT CLAIM* clause, which grants that the routine's
  three blanked tilemap cells belong to the same opening tableau as the heart, then states flatly
  that what removing those cells clears off the screen was not separately grounded. Nine files
  carry a clause of that shape. It is the cheapest thing in a header to write and the only part
  guaranteed not to need redoing. A named
  open question is worth more than a confident guess and costs nothing to verify.
- **Name by EFFECT, not internal mechanism — the verb is what the output *causes*.** The "body =
  mechanism, callers = purpose" split is not enough on its own: an agent can fully understand a routine
  and still name it after its computation. Make it a hard rule — trace every value the routine writes to
  the LAST thing that consumes it and ask *what does that consumer DO as a result*; the name is that
  action. If a live-out is consumed as a command that drives an action (a move, a sound, a spawn, a
  state change), the routine **produces/drives** it: the verb is `steer`/`play`/`spawn`/`advance`,
  **never** `classify`/`compute`/`check`/`detect`/`find` (those name the internal method, almost never
  the routine's job). Tell: if the output is read *"in place of"* another input (a routine feeding the
  movement dispatcher where the joystick normally goes), the routine **generates** that input — name it
  for what it generates. This is exactly how `classifyWallCollision` was mis-named: its own header even
  described it as steering the demo along the maze walls, yet it was named after the internal
  probe-vs-wall test instead of the steering it produces.
- **Verify an action-driving name by OBSERVATION — it is automatable, so do it.** When a routine's
  output feeds a dispatcher or controller, do not stop at reading code: write a short trace that runs a
  real attract/boot session and logs this routine's output *and the downstream effect* (the object's
  position before/after, the sound queued, the tile written), then confirm the name matches what you
  SEE. A `classify`-named routine whose output visibly *moves* something is misnamed. The trace is ~30
  lines the agent writes itself, so naming is checkable at scale — no hand-verifying each routine.
- **Disprove the existing name; ignore rename cost.** In an understanding pass, re-derive the name as if the
  routine were an unnamed `loc_` — the current name is a hypothesis to BREAK, not a default to defend
  (the confirm agent that blessed `classifyWallCollision` anchored on it and kept it to avoid churn).
  Rename cost — test imports, every caller — is NEVER a reason to keep a name; the rename is mechanical
  and the lead applies it across importers.
- **Honest signatures, by default — not a late capstone.** Genuine register live-ins become named
  JS **parameters**; live-outs become **return** values; a routine that touches no RAM and only maps
  inputs → outputs becomes a **pure function** (`snapYToGirder(x, y, step) → newY`). Keep
  register-passing (`regs.h = …; m.call; … regs.l`) *only* at a genuine oracle boundary — calling a
  still-raw `translated/` callee, or being called by a still-oracle caller. Everywhere else it is an
  assembly leak, and bottom-up order is what lets you dissolve it.
- **Comments describe behaviour, not the assembly it came from.** No register names (`A`, `HL`,
  `regs.a`), no opcodes/mnemonics (`add a,(hl)`, `rrca`, `ret nc`), no "the Z80 does X" — that detail
  is invisible at this layer. The test for any comment: is it about behaviour visible here, or about
  the assembly underneath? Keep the former, cut the latter. Comments that explain *what/why* are the
  goal and are worth writing; low-level narration is the noise. And **name methods directly** —
  "the entropy pin", "capture/clone/replay", "the caller-skip idiom" — never a doc number or `.md`
  path (citations rot; the shipped code should read on its own).
- **A comment in `idiomatic/` describes THIS FILE, and nothing else. Ever.** Not the ROM, not MAME,
  not the frozen oracle, not a sibling module, not a test, not a doc, not a to-do. A count of what is
  *in* this file is fine; a count of anything outside it is not. Enforced by
  `tools/idiomatic_comments.py`, which the pre-commit hook runs. It is a gate rather than a reviewer
  rule because it tests REFERENCE, not truth — "does this sentence name something outside this file"
  is decidable by a script, which is not true of almost anything else we ask a reviewer for.

  Three paths are exempt, and they share one reason — their job *is* the cross-file map.
  `translated/**` comes from the disassembly, so a faithful translation of a ROM routine has to cite
  it; the address is that file's identity, not an outside reference. `idiomatic/ram.js` is the
  registry, the one place addresses, names and modules are meant to meet. `idiomatic/**/test/**`
  cannot describe itself without naming its subject (what a test may claim about its own coverage is
  reviewer-rules R17, which stays a rule because it is about truth).

  Why it is absolute rather than a matter of taste: **a cross-file claim in a routine header is a
  cache.** The fact lives somewhere else, nothing updates the copy, and it goes stale the moment
  understanding improves anywhere else in the tree — across hundreds of files, once per pass,
  forever. That is precisely what the understanding formula's step 8 was: hand-run cache
  invalidation over the whole layer. Delete the cache and the step disappears. Measured on Donkey
  Kong the day the rule landed: **every single file in the layer** broke it, and most of the layer
  was comment rather than code. Not drift — the convention had never been written down, so the
  whole layer was generated without it.

  **Neither game's layer is migrated yet.** The rule and its gate landed before the cleanup, so the
  hook enforces it on anything newly staged while the existing bulk is still to be swept as its own
  unit. Until `python3 tools/idiomatic_comments.py scan games/<game>` is green, do not read an
  existing header in that game as an example of this rule, and keep the routine layer inside step
  8's scope for it.

  Note what this section does NOT do: quote a count. `scan` prints violations and no totals, and
  nothing here reports how many there are. A tally of the tree is a derived fact — true when
  written, false after the next file is cleaned, and unfalsifiable to a later reader. It is the same
  disease one level up: **do not write a count of the tree into prose.** If you need the number,
  run the tool; it expires the moment you paste it.

  None of the content is lost — each piece has a home that a machine can keep honest:

  | displaced from the header | goes to |
  |---|---|
  | `ROM 0x<addr>` tag | the `ROUTINES` registry key — always its source of truth |
  | `GATE:` / `Memory-equivalent to …` | the test file's own header, where it is file-local |
  | `NAMES:` (which `ram.js` cells are used) | the import list, which already states it |
  | the evidence that justifies a PROMOTED name | the `ROUTINES` entry's `why` field (names-registry.md) — every form that evidence takes names a caller, a sibling or a doc |
  | a grounding finding | `mechanisms.md` — the one document whose job is cross-file facts, and which step 7 rewrites WHOLE every pass. That is cache invalidation done correctly, in exactly one place. |
- **Numbers are base-10.** Write decimal like normal JS. Reserve hex for an *irreducible* bit
  operation the behaviour genuinely depends on (a real mask or bit-flag). Most `& 0xff` / `& 0x0f` /
  `& 0x80` is a Z80 8-bit-width artifact, not behaviour: the register/memory model already truncates
  on assignment (see [the translation doc](translation.md)) and so does every memory store (`mem8[]`/`write8`), so
  a mask that lands in a register or memory — including one right before a store — is dropped outright.
  A wrap is load-bearing only on a **local** observed at its width (compared, indexed) in a way that
  would actually differ wrapped vs unwrapped, and not passing through a store — the routine's own
  equivalence gate is the arbiter, so drop the wrap and keep it dropped if the test stays green (a bare
  `=== 0` where the value can't alias 0 needs none). Where a wrap *is* load-bearing, use `u8(x)` /
  `u16(x)` (`core/int.js`), never `% 256` — which is not even a correct 8-bit wrap (`-1 % 256` is `-1`,
  `u8(-1)` is `255`). A genuine bit-flag lifts to a named predicate — taking the hex with it.

## File format & directory layout

The pipeline's validated output lives in **`games/dkong/idiomatic/`**, one module per routine,
resolved by address through the manifest. The frozen oracle lives in **`games/dkong/translated/`**,
one file per routine. The RAM names live in `games/dkong/idiomatic/ram.js`.

Two canonical file templates keep the format consistent:

**`translated/` — one line per routine (the faithful lift; permanent oracle):**
```js
/** <name>  (ROM 0x<start>–0x<end>) — <terse role>. */
```
Range always present; em-dash; behaviour body stays faithful (one statement per Z80 instruction,
`// <mnemonic>` per line, per [the translation doc](translation.md)).

**`idiomatic/` — fixed header, and it names nothing outside its own file:**
```js
// SPDX-License-Identifier: GPL-3.0-only
/**
 * <name> — <one-line role>.
 *
 * <what the routine does, in terms a reader of THIS file can check>
 * LIVE-OUT: <memory-only | + what it returns>.
 */
```
No `ROM 0x<addr>` tag, no `Memory-equivalent to …`, no `GATE:`, no `NAMES:` — every one of those
names something outside the file, and they moved to the registry, the test header and the import
list (see "Output conventions", the file-local comment rule). `tools/idiomatic_comments.py` refuses
a commit that puts them back. No `CYCLES`/`COLLAPSE` sections and no inline disassembly dumps
either — there is no cycle model to record, so that bulk (and most of the format drift) is absent.

**How a routine joins the layer.** The swap engine (`resolveAllIdiomatic` in `machine.js`, reading
the `ROUTINES` map in `ram.js`) lays each idiomatic routine over its `translated/` oracle at that
routine's ROM address, so the game runs idiomatic where developed and translated everywhere else.
A routine joins by: land `idiomatic/<name>.js`; land `idiomatic/test/equivalence-<addr>.test.js`;
add its address→`{name}` entry to `ROUTINES`; gate. All four, or it is not in the layer — a module
with no registry entry is written and never executed, which is how Donkey Kong accumulated a whole
batch of them without anyone noticing.

**`idiomatic/**/test/` — the header that carries the gate**, because a test cannot describe itself
without naming its subject, and because R17 needs somewhere to bite:
```js
/**
 * <subject> — memory-equivalent to the frozen oracle at ROM 0x<addr>.
 * GATE:  <strict | convergent | crafted-entry>; <what it actually exercises, holes stated>.
 */
```

## Running the spiral: Structure & Meaning in detail

> The *shape* this elaborates — one oracle (gate + probe), a Structure⇄Meaning spiral up the call
> graph, then Ship — is **[The Method](README.md)**. The numbered items below are those two moves
> elaborated for the next game, **not** a linear conveyor of stages.

**Understanding runs across all of this, it is not a step in it.** Start it on day one — you need
only the ROM and MAME to watch attract mode — and keep the living `games/<game>/mechanisms.md`
growing through every step below ([the understanding doc](understanding.md)). The observation
comes before the lift; the deepest understanding lands during the decompile; steps 3 and 4 consume
the map and can't be done well without it. It is required reading for anyone naming or decompiling.

> **RULE — every understanding pass REWRITES `mechanisms.md` from scratch, in the same landable unit as the
> renames — do not incrementally edit it.** The **first step of a rewrite is to read `gameplay.md`** —
> the outside-in, public-research view of how the game plays — as the frame, then re-derive the
> inside-out model from the *current* code and grounding (blind to the prior MECHANISMS). An understanding
> pass exists to convert *correct* code into
> *understood* code, and the earned names and resolved questions ARE that understanding — so the map
> must reflect them, and finishing the pass means re-deriving the whole map, not patching it. **Rewrite
> wholesale, not edit.** Incremental edits accumulate exactly the drift that keeps biting: a count that
> lags, `loc_` references that outlive their rename, stale "kept loc_" phrasings, rows that name old
> callees, an internally-inconsistent structure. A from-scratch rewrite each pass forces re-reading the
> *current* code state and producing a fresh, coherent, self-consistent map — it is the same discipline
> as the understanding pass itself (re-derive across the whole set, never defend the prior state). Regenerate
> the routine/RAM tables from what the idiomatic layer + `ram.js` actually contain *now*, re-synthesize
> the subsystem prose, move newly-answered questions to a "resolved" note and sharpen the still-open
> ones, and recount (decompiled / named / RAM-named) by measuring, not by adjusting the old numbers. A
> map that lags the code — or reads as a patchwork of edits — is the tell that an understanding pass was left
> half-done: the names shipped but the understanding was never re-written where the next agent reads it.
>
> **Enforced, not just advised:** `tools/understanding_gate.py` runs in the pre-commit hook and blocks any
> commit that renames routines / changes `ram.js` exports without staging `mechanisms.md`, or that
> leaves a retired name anywhere in the map. A recipe step that matters gets a gate — ungated prose
> loses to task momentum (this rule was nearly skipped once before it had teeth).

1. **Lift → `loc_XXXX()`** — the faithful per-instruction transliteration; the frozen oracle.
   (This is [the translation doc](translation.md), with uniform address names from line one.)
2. **Call graph + reachability** — who calls whom, what is reachable, what is dead. This is the
   prerequisite that makes "bottom-up" meaningful. **The routine worklist is every label the
   disassembler emits — every `loc_<addr>` — not just static `call` targets.** A call-target-only
   list silently omits code reached another way: a shared tail entered only by `jr` (Pit's
   sound-enqueue body `loc_4ca5` is reached by a `jr` from ~20 stubs *and* by fall-through, never by
   a `call`), and any computed-dispatch target. So close the worklist under the whole control-flow
   graph, not just calls: re-derive the set of referenced targets from the lift each pass and fold
   any new ones back in; treat a routine reached only through a jump table as first-class. Report
   progress as "≥N, still closing," never a fixed "N/total," until a pass adds nothing new. Code that
   is reachable only at runtime through a dispatch the tracer can't resolve statically needs a
   separate entry-discovery pass (a PC-trace of the live program) folded into the entry points.
3. **RAM naming pass** — evidence-based (control-poke, cross-routine corroboration,
   proposer≠confirmer, the sprite-record trap), and driven by the mechanism map above. Front-loaded,
   because named memory is the single biggest legibility lever; iterative, because some names only
   resolve during the decompile.
   - **A name is not done until the code USES it.** A name promoted to `ram.js` but left unreferenced
     is dead weight — the routines still read `mem.read8(0x8055)`, so nothing got more legible. Every
     naming batch ends by **retrofitting the referencing routines**: swap the hex literal for the
     imported constant. It is a pure rename, so each routine's memory-equivalence test stays green and
     is the safety net. So the full loop is: derive → review → land `ram.js` AND **the retrofit of every
     routine that uses the address** in ONE commit. Skipping the retrofit means the pass only *looks*
     done; splitting it across two commits means the reviewer cannot confirm the second half happened
     (see the formula's step 9 in [understanding](understanding.md)).
   - **proposer≠confirmer convergence is necessary, not sufficient — keep the third adversarial
     review.** Two independent derivations can converge on the *same wrong detail* when they read the
     same misleading evidence: on The Pit both derived `0x8076` as latching tile `0x27` (the goal
     tile) because the shared classify ladder records the `0x26` and `0x27` latches on adjacent lines;
     only a separate adversarial reviewer, re-deriving from scratch, caught that `0x8076` is the `0x26`
     latch. Promote on convergence, but still review the promoted names before they land — a
     confidently-wrong name is the sprite-record trap that all future work will trust.
4. **Alternate DECOMPILE passes with UNDERSTANDING passes.** Decompilation recovers correct,
   memory-equivalent routines (leaves first, drop cycles + dead registers/flags, gated against the
   `loc_XXXX` lift with pinned PRNG + teeth). An **understanding pass** then makes the accumulated routines
   *read* like the game. Keep the two separate — decompile is about correctness, understanding is about
   meaning — and understanding must run *after* and *across the whole set*, because a callee decompiled in a
   later batch is what makes an earlier caller's `m.call` dissolvable. An understanding pass is **two
   fan-outs, keyed differently**:
   - **Dissolve + promote the ABI (per-routine)** — (i) replace every `m.call` to an already-decompiled
     callee with a genuine function call (the dissolve invariant + lint above); (ii) **promote register
     live-ins to real parameters.** When a routine takes its inputs in registers (`waitFrames` reads the
     count from the accumulator) and those registers are set *only* by idiomatic callers — nothing
     reaches it through the registry (the idiomatic layer isn't wired live, and no idiomatic routine
     `m.call`s it) — change its signature to honest params (`waitFrames(m, count)`) and drop every
     caller's `regs.X =` marshalling. The still-*translated* callers are irrelevant: they `m.call` the
     frozen **oracle** copy, never this file. This rides along with the rename for free — a rename
     already rewrites every idiomatic caller, so promote the ABI in the same edit. Gated by the
     equivalence tests (the routine's *and* every caller's) + a review.
   - **Routine names (per-routine)** — **if you understand the routine, NAME it.** A `loc_XXXX` a human
     can't read is nonsense to the next reader; a routine whose **mechanism** is confident MUST get a
     descriptive name, *even when its game-purpose is still open* — record that open purpose as a
     `[guess]`, do not withhold the name over it. Name by the **mechanism** (what the body does) and
     sharpen with the **callers** (what it's *for*) when they resolve it — internals alone give
     `copyBytesToVram`, the callers reveal `drawScoreDigits`. `loc_` is reserved for a routine whose
     **mechanism itself** is genuinely unclear, NOT for one we understand but whose downstream meaning
     we haven't grounded yet (a mechanism name like `tickObjectDwellThenTransition` claims only what the
     body does and says nothing false about the unknown purpose). An open purpose is often a *grounding*
     question — name by mechanism now, and let grounding upgrade it to a purpose name later. **But
     distinguish an open *purpose* from a code-undecidable *identity*: if the mechanism itself has two
     readings the code cannot settle and downstream work will trust the pick (laser vs terrain-scroll,
     enemy vs ship), that is NOT a defer-and-upgrade case — ground it in-loop *before* committing the
     name, or the wrong pick propagates (The Pit's *"no laser"* / enemy-3-as-*"ship"*). Grounding gates
     a load-bearing pick; it only upgrades a low-stakes one.**
   - **Variable names (per-address, cross-routine)** — decided by the *consensus across every routine
     that touches an address*, never by one routine (a single routine's view of `0x8055` is "a loop
     count"; the ~18 routines that stage it reveal `PLOT_RUN_LENGTH` — left to themselves they pick
     divergent local names, which is the tell).

   **Both name kinds get the SAME three-look treatment** (be consistent): two agents derive the name
   *blind* to each other (routine → from body+callers; variable → over all uses of the address),
   promote only on convergence, then a **third adversarial review** before it lands — because two blind
   derivations can still converge on the same wrong reading (that is how `0x8076` slipped through until
   the third pass). Routine naming keeps `loc_` only when the **mechanism** is genuinely unresolved
   (don't invent a name for code you can't read) — a confident mechanism with an open *purpose* is
   **named, not held** — and still runs the full three looks. Every output stays gated
   (equivalence tests, the `no-stale-mcall` lint, the third review). Loop decompile ⇄ understanding to 100%;
   seed the obvious routine names (RST vectors, leaf sound triggers, the NMI handler) early, but expect
   most names to fall out *of* this loop, not before it.
   - **Finish every understanding pass by updating `mechanisms.md` in the same commit** (the rule above). The
     earned names + resolved questions are the pass's actual product; a pass that ships the names but
     not the map update is half-done.
5. **Capstone: pixel-exact vs pinned MAME** — the ground-truth falsifiable check. DMA raster is
   the one accepted sub-frame residual.

## The tool question — mechanical vs manual

The decompile in step 4 is **manual (LLM)**, and for a single game that is the whole job — it
produces genuinely readable, memory-proven output from the lift + names. The **best** output is a
hybrid: a mechanical decompiler pass (SSA → liveness/dead-code → control-flow structuring → emit,
cycle-free) for provably-correct clean *structure*, then an LLM *semantic* pass for the
names/comments/idiom, both memory-validated. Pure-mechanical is correct-but-soulless; pure-hand is
great but doesn't generalize. Build the mechanical tool for the **transfer thesis** (Frogger, then
all of MAME), where the front/middle-end amortizes across games — for a single game a manual sweep
already clears the bar. A manual pass cannot tell you whether a *mechanical* tool suffices (the LLM
smuggles in understanding a tool lacks); that question needs its own stripped/from-IR experiment.

## Traps

- **Symptom — running the idiomatic layer live HANGS** (a vblank busy-wait like `waitFrames` spinning on `FRAME_WAIT_COUNTDOWN` never returns; the main-loop vblank spin never exits). Expected, not a bug: idiomatic routines charge zero cycles, so the *cycle-driven* NMI never fires to tick the wait down. The fix is the frame-stepped engine above (fire the NMI at the vblank-poll yield), switched in as the whole-game capstone — **not** re-adding cycles to idiomatic routines to unstick it. (Re-derived the hard way 2026-07-30; the whole answer was already in this section.)
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
- **Decompiling a shared-helper leaf is not a landable unit on its own — the landable unit is
  decompile + dissolve-every-caller + migrate-the-strict-caller-tests.** Two coupled consequences
  fire the moment the leaf lands: (1) every caller's `m.call(0xADDR)` to it is now stale, so the
  `no-stale-mcall` dissolve-invariant lint goes red — the batch will not go green until all callers
  are dissolved to direct calls (on The Pit, decompiling one copy/fill helper stranded 25 `m.call`s
  across 15 files, including `push16` return-brackets). (2) Dissolving a *tail* `return m.call` or a
  bracketed call changes the Z80 pc/SP/stack, which false-fails any caller test still written to the
  **strict** pc/SP/whole-stack contract — those tests must be migrated to the memory-equivalence
  contract (exclude the dead `[SP-8, SP)` stack scratch, keep the RAM diff and teeth; model on the
  already-migrated `equivalence-18cf`/`-47e1`). Plan the batch as one unit: decompile the leaf,
  dissolve every caller (partition the caller files across agents so no two touch one file), migrate
  each stale strict test (each one must re-prove its relaxed gate still catches a broken-RAM twin at
  a *real* cell, not a stack-scratch ghost), then gate the whole set on the full suite + the lint
  before it lands. A per-agent "green" self-report is not the gate — a later dissolve in the same
  batch can move a dead stack byte that a caller test three files away was silently asserting, so run
  the whole suite yourself before committing.
- **A measurement that says "the game stalled / reset / diverged" is a claim about your *instrument*
  first.** Two traces of the same *deterministic* run disagreeing — one shows the game running, one
  shows it stuck — means an instrument is lying; stop and isolate which, never rationalize the
  contradiction into a game-behavior story. On The Pit this cost a long detour: a truncating MAME trace
  (an unheld write-tap GC'd at ~frame 185 — see grounding.md) made the game look like it *reset when the
  RNG was frozen*, and later like it *never entered the attract demo*. Both were false — the game runs
  fine with a pinned RNG, and demo entry (`GAME_STATE`→4, driven by the RNG-independent `loc_3a6f`
  delay loop) **converges**: JS frame 671 vs MAME 691, a bounded ~20-frame cycle-free drift. **And the
  explanation is a claim too:** the first root cause offered ("the frame notifier GC'd") was itself
  unverified and *wrong* — a two-line held-vs-unheld probe refuted it (the notifier was fine; the
  discarded *tap* token was the GC victim). Verify the *explanation*, not just the finding, and
  cross-check any stall/reset/divergence against an independent GC-immune signal — the screen frame
  counter, a fresh state dump, or a second agent — before you believe it or write it down.

### Whole-game go-live (all routines idiomatic at once)

Per-routine swaps validate under `runCycleFree` (poll-PC seam, poll routines still translated). Wiring
the whole game idiomatic is a different regime — these fired the first time The Pit ran end-to-end
idiomatic (2026-07-31), each cost real time, and each has a one-line answer now. See the runbook in
[integration-testing.md](integration-testing.md) "Go-live".

- **The poll-PC seam goes dark when the poll routines themselves are idiomatic.** `runCycleFree`
  fires the NMI when `m.step` reaches a poll PC; idiomatic code never calls `m.step`, so once
  `mainLoop`/`waitFrames` are idiomatic there is no `m.step` to catch and the run hangs. Fix: the
  second engine `runIdiomaticGame`, which fires the NMI on the **once-per-frame watchdog kick** (the
  I/O read those routines already do) instead. Do NOT try to keep a token `m.step(pollPC)` inside the
  idiomatic poll routine — it collides with the equivalence harness's own `m.step` hooks.
- **Idiomatic routines silently DROP load-bearing stack ops that were no-ops in the swap harness.**
  With the whole game running, two were missing and had to be restored: `mainLoop`'s per-pass SP
  re-seat (`m.regs.sp = 0x83ff`; without it the stack drifts down over a long round) and
  `serviceVblankNmi`'s normal-exit `ret` (pops the PC the NMI pushed; without it SP leaks 2 bytes
  every frame down into game state during the pre-mainLoop setup phase). Both were dropped because in
  the swap harness a *translated* caller balanced the stack, so they read as dead. Restoring them is
  the readability-leak class again — and both still pass their equivalence tests, because the
  restored op is exactly what the translated oracle does. When a whole-game run leaks/creeps stack,
  suspect a dropped `ld sp` / `ret` in a poll or NMI routine before anything exotic.
- **The mixed-migration stack leak is real but benign — bound the exclusion, don't "fix" the pop.** A
  still-translated caller `push16`s a return address an idiomatic callee never pops, so SP drifts ~2
  bytes/call until the main loop re-seats it. Game state is untouched (control flow is JS-driven), so
  it is dead stack scratch: set the state-diff's `stack` exclusion to the whole stack region **above
  the measured game-state ceiling** (highest direct store), not a hand-picked window that the next
  deeper-nesting routine overflows. Do NOT try to balance it by popping in `m.call` for overrides — a
  blanket pop OVER-pops the tail-`jp` routines (whose caller did not `push`), corrupting real state;
  it breaks more than it fixes.
- **`m.ret()` inside an idiomatic routine over-pops when reached idiomatic→idiomatic.** The ~10% of
  routines that keep an `m.ret()` (needed for their equivalence test's SP/pc live-out) pop a return
  address that a *direct-import* idiomatic caller never pushed → SP climbs above the stack top. In the
  steady state `mainLoop`'s per-frame SP re-seat heals it, leaving only bounded boot-transient scratch
  above game state — benign, but it is why the whole-game gate compares only `[0x8000, gameStateHi]`
  and excludes everything above the ceiling.
- **Sample the PRE-NMI state at the frame boundary.** `runIdiomaticGame` must sample in the same order
  as `runCycleFree` — at the poll, before firing the NMI. Sampling *after* the NMI shifts every
  NMI-updated cell (sound ring index, input debounce accumulators) by one frame and fakes a handful of
  "game-state divergences" that are pure measurement phase. (Cost ~an hour chasing six phantom cells.)
- **The NMI can LONG-JUMP into a new main loop — the in-NMI guard freezes it.** A frame-stepped engine
  fires the vblank NMI as a nested JS call and assumes it *returns*. But a coin/credit/start/game-over
  path is a warm restart driven FROM the interrupt: the handler resets SP to the stack top and
  tail-calls a new forever main loop (The Pit: `serviceVblankNmi` banks a credit → `showCreditScreen`
  resets SP → `holdFixedScreen` spins in `waitFrames`). That nested call never returns, and the guard
  that stops the handler re-triggering its own frame ALSO blocks the new loop's poll → the game freezes
  the instant a coin drops. Fix per engine: the **watchdog-keyed** `runIdiomaticGame` DROPS the guard —
  a watchdog READ while an NMI is on the stack means the handler long-jumped, and those reads are real
  frames; safe *iff the NMI handler never READS the watchdog* (The Pit only writes 0xb800 for sound —
  verify per game). The **poll-PC** `runCycleFree` KEEPS its guard (its translated handler's final `ret`
  steps back to the poll PC it interrupted, which would re-fire). The abandoned outer handler stays on
  the JS stack — one frame per warm-restart, bounded for a normal session; a coroutine/unwind engine
  would reclaim it. Also use a PER-FRAME read/step backstop (reset each frame), not a total cap, or a
  long healthy session trips it.
- **Attract-only gates are BLIND to input — replay the tapes.** The whole go-live gate (`golive.test.js`)
  and every per-routine/swap gate run ATTRACT, which takes no input, so the entire coin → credit →
  start → in-game → dig path is unexercised. "The whole game reproduces the oracle byte-for-byte" passed
  green while the browser froze on the first coin. Every game's gates MUST replay its input tapes
  (`games/<g>/tapes/*.lua`) through the runtime AND the oracle, and assert the game RESPONDS (a credit
  banks, the game starts at the tape's contract frame, the player moves/digs/scores) as well as
  idiomatic == translated through the play sequence. Pattern: `games/thepit/idiomatic/test/tape.test.js`.
  Expand thin tapes so they exercise much of the game, not just coin/start.
