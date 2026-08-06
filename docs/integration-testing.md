# 5. Integration testing — the MAME ground-truth harness

Unit tests prove a routine matches the disassembly. Integration testing proves the *whole machine*
matches reality, where reality is **MAME** running the same ROM. The comparison is only meaningful
if both sides are deterministic and produce the same artifacts, so most of the harness is about
pinning determinism. The one channel this cannot hold — the timing-seeded RNG — has a shared
**entropy-pin** mode (`--pin-entropy` on both the golden and the port); see the *Entropy pinning*
section of [idiomatic generation](idiomatic-generation.md).

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

## PLUMB `--input` AND `--poke` BEFORE YOU TRUST ANY OF IT

Until a tape can press a button, the only thing a new game's harness validates is **attract mode**,
and attract exercises a fraction of the ROM. Do this on day one, not when the layer looks finished.

It is three small seams, and every board needs all three:

1. **`io.inputAssert`** — a `{portAddress: pressedBits}` map, folded into the port reads with the
   board's own polarity. Keep the tape in PRESSED-BIT form even when the hardware is active-low, so
   one tape reads the same here as the MAME lua one, which sets named fields rather than a port byte.
2. **`Machine.applyInputs(frameIndex)` / `applyPokes(frameIndex)`**, called at the frame boundary
   **before** the state dump, so both are in effect DURING that frame. Call them for frame 0 too,
   or a `@0` tape entry is silently dropped, and clear the assert map at the start of a run or a
   Machine reused after stopping mid-hold begins with the button still down. Rebuild the map from
   scratch each frame — then a press releases itself and a held bit stays down without the tape
   restating it.

   **This does NOT make the two sides agree on frame numbers, and assuming it does will cost you a
   day.** MAME's frame notifier and the JS boundary sample count from different origins: the
   notifier fires at the END of frame N. So the same tape lands at a different emulated frame on
   each side, and the offset is a per-game CONSTANT THAT MUST BE MEASURED — The Pit's is +2, and
   its tape carries the number in a header contract with the experiment that established it.
   **The offset lives beside the tape and nowhere else. Never take it from a `machine.js`
   comment** — the seam's own comment describes where inputs are applied, which is a different
   question, and a board whose comment claims the two sides align is wrong rather than
   authoritative.
   Measure yours, write it beside the tape, and re-verify it whenever the tape's timing changes.
   Time Pilot's is not measured yet, so its tape carries no such note and no cross-side comparison
   using it should be trusted until one exists.
3. **`emit.js`** passing `machine.inputTape` / `machine.pokes` through from the parsed arguments.

**What it is worth, measured on Time Pilot the day it was plumbed.** Attract had run 20000 frames
with no translation gap and the layer looked complete. Insert a coin and press start, and against
an attract baseline of the same length the run reached fifty-odd routines attract never touches —
and with two ROM regions that had never been transcribed, the same tape hard-stopped at frame 610.
Both regions were dispatched from a table through a computed jump, so no static tracer found them
and no attract run executed them. **The harness was reporting a complete layer because it could
not press the button that breaks it.**

### Finding the input bits without trusting the driver's port table

Do not transcribe a bit map out of MAME's source and hope. Press each bit in turn through the tape
and diff the whole run against a no-input baseline **with an identical call structure** — same
number of `runFrames` calls, only the held value differing, or you measure your own harness. The
answer separates itself: a coin diverges the entire run, while a start button moves only the byte
the ROM samples the port into, because the game ignores it until there is a credit.

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

## Unit equivalence — one routine at a time, without the boot chain

Everything above drives the machine from reset, so a defect anywhere shows up as one failing frame
number and localizing it means bisecting. The unit harness inverts that: `unit_capture.lua` taps a
routine's entry and its exits under MAME, records the register and memory state at each end, and
`unit_equiv.mjs` replays the same entry state through the translated routine and compares the exit.
`routine_extents.py` supplies the exit addresses; `unit_equiv.sh` wires the three together.

It is the only gate here that can fail a single routine by name, and the only one that reaches
routines the attract mode never executes — which, on a typical batch, is over half of them.

Two cautions, both learned by being burned:

- **A window is only valid if nothing interrupted it.** The Lua side aborts and retries when an NMI
  lands inside the window or the stack pointer moves under it, and the retry counters ride along in
  the exit metadata. Those counters say how many tries it took; they do NOT mean the accepted pair
  is bad, and reading them that way rejects sound captures.
- **An empty capture directory is not a pass.** Zero comparisons performed and zero failures
  reported is the same exit code as success. Check that the harness compared what you think it did
  before quoting it.

## Cycle-free convergence — validating the whole game with no T-state clock

The diffs above assume a cycle-*driven* run (the NMI fires at an absolute T-state count). The
idiomatic layer is cycle-*free*, so it needs the frame-stepped engine (fire the NMI at the
vblank-poll yield — see [idiomatic generation](idiomatic-generation.md), "Cycles are droppable").
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
     freeze it with a frame-notifier or an un-held `install_write_tap` (see [idiomatic-generation.md](idiomatic-generation.md)
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
RAM diff auto-identifies it; see idiomatic-generation.md). Put both in `manifest.convergence` /
`manifest.entropyPin` and the tool works unchanged.

**Three ports in, two of those facts turn out to hide assumptions.** Check both against the new
game before trusting a number out of any of these tools.

- **A game need not poll a VBLANK flag at all.** Time Pilot polls none anywhere in the ROM: the
  NMI is gated by an LS259 bit the service clears on entry and sets in its epilogue, all game logic
  runs inside the service, and the foreground is a command-ring drain that spins on an empty ring.
  Its poll PC is that drain's top by elimination. (It does poll the RASTER counter, in the sprite
  multiplexer — "polls nothing" is the wrong reading, and one word too wide is where this project's
  errors live.) The price is stated where the poll PC is declared, in `games/timeplt/manifest.js`
  `convergence`: the drain gets one pass per NMI instead of a frame's worth, so the ring backs up
  where the cycle-driven engine never lets it. That is sound for a **transparency** gate, where
  both runs are the same engine and only their difference is read; it is not a model to converge
  against MAME with. When you cannot find a yield, say which loop you picked and what it costs.
- **The mixed layer only survives if SP gets back where it started.** A translated call site pushes
  the return address and the translated callee's `ret` pops it; an idiomatic rewrite has no `ret`
  and returns to JS, so every translated → idiomatic dispatch leaks two bytes of stack. **Ask what
  heals that in the new game, and do not assume anything heals it.** The three ported so far answer
  differently: The Pit re-seats SP from a literal at the top of every main-loop pass, so its leak
  is gone once a frame; DK's idiomatic callers drop the oracle's `push16`/`ret` bracket at the call
  site, so the bytes are never pushed (`games/dkong/manifest.js`); Time Pilot does neither — it
  seats SP once at boot and never again, and unhealed the stack walks out of its scratch band and
  through live work RAM inside a frame or two, ending in an unmapped write out of the foreground
  loop holding a garbage pointer. Where nothing heals it, the seam must:
  `games/timeplt/machine.js` `withOmittedRet` performs the omitted `ret` (pop AND pc — a foreground
  loop that tests where a handler returned to needs both) around every resolved override, so the
  whole layer and a hand-picked subset go in over one seam.
- **A seam that supplies a `ret` has a PRECONDITION, and it is violated in practice.** It is right
  only for a routine whose ROM form has a net stack effect of exactly one `ret`. A rewrite of a
  routine that pops more than its caller pushed gets OVER-popped, and its SP climbs *above* the
  power-on seat until a push lands in whatever sits above the stack. Wiring an untested batch of
  Time Pilot rewrites produced exactly this on five of seven addresses. Measure SP across every
  dispatch rather than trusting the byte diff to explain it — the byte diff reports a corrupted
  sprite cell and names no routine.
- **Bound the stack exclusion by the MEASURED STACK, never by the game-state ceiling.** Those are
  different numbers and the gap between them is dead space that nothing writes — which is exactly
  where a leaking SP lands first. Excluding it buys blindness at the one place the seam can fail:
  on Time Pilot the tooth's bounded leak is invisible for an ENTIRE run under a ceiling-floored
  window and is caught in the first few dozen frames under a stack-floored one.

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

**The go-live gate above runs ATTRACT — which takes no input. That is only half the machine.** A
runtime can reproduce the attract loop byte-for-byte and still freeze the instant a player inserts a
coin (The Pit did: the coin/credit warm-restart long-jumps out of the NMI — see idiomatic-generation.md
Traps). So the gate set MUST also **replay the input tapes**. `games/<game>/idiomatic/test/tape.test.js`
replays `games/<game>/tapes/*.lua` through the idiomatic runtime AND the translated oracle (both under
`runIdiomaticGame` — pure-translated runs under it too, since the translated poll loops also kick the
watchdog and the translated NMI handler doesn't read it). It asserts the game RESPONDS — a credit
banks, the game starts at the tape's contract frame, the player moves/digs — and that idiomatic == the
oracle through coin → start → in-game → dig. Port it with the tape: press the same bits the lua tape
does via `io.inputAssert` (the JS mirror is offset a couple frames — the tape file documents it), and
expand a thin coin/start tape until it exercises much of the game.

## Go-live, the RIGHT way — the coroutine engine (`runGeneratorGame`)

`runIdiomaticGame` (above) fires the vblank NMI as a NESTED JS call at the watchdog read. It works,
but a warm restart (coin/start/level/game-over) long-jumps into a *new* forever main loop that never
returns, so the JS HOST stack grows ~one frame per restart — bounded for a normal session, but a leak,
and it needs a per-game "find the forever loops" analysis. **The coroutine engine removes both.** It is
the recommended go-live model and the template every future game should use.

**The model.** The idiomatic control SPINE — the boot chain, the main loops, the wait/hold loops — are
GENERATORS (`function*`) that `yield` at each vblank wait; everything else (per-frame services, physics,
render) stays a plain function. `core/frame-stepped.js` `runGeneratorGame(machine, {nmiReturnPC, onFrame,
maxFrames})` drives the CURRENT main generator one frame at a time: resume it to its next `yield`, sample
the pre-NMI state, fire the vblank NMI (a plain handler), repeat. A state change is a WARM RESTART: the
handler (or a spine tail) sets `machine.nextMain = () => nextLoop(m)` and the engine swaps the generator;
the abandoned one is garbage-collected, so **the host stack stays flat forever** (measured spread 0
across boot→attract→coin→credit→start→game, vs +20 for the nested engine). A `yield` suspends the whole
call tree wherever it sits, so it is fully general — deep waits, interrupt-driven loops, any control flow,
no per-game analysis. Perf is a non-issue: the generator tax lands on the low-frequency spine
(~one yield/frame), measured at ~0.0002 ms/frame against a 16.67 ms budget.

**The conversion recipe (mechanical, per game):**
1. **Spine = every routine that can reach a vblank wait via a normal call.** Convert each to `function*`;
   convert every call *to a spine routine* into `yield*` (including `yield* m.call(0xADDR)`, since calling
   a generator through the registry returns the generator object). **The #1 bug: a `function*` you call
   without `yield*` — it builds a generator and never runs it, silently skipping the wait.**
2. **The vblank wait becomes `yield`.** Keep the watchdog kick / countdown read next to it; the engine
   fires the NMI at the yield (same order the watchdog engine fired it at the read).
3. **A warm restart is a boundary, NOT a `yield*`.** Where the old code long-jumped into a *new* forever
   loop, set `machine.nextMain = () => theNewLoop(m)` and hand off instead of entering it — this is what
   keeps the gameplay/physics code PLAIN by stopping the generator propagation. There are two kinds:
   - **Top-of-frame restart** (the NMI's coin/start hand-off): the plain NMI handler sets `nextMain` and
     returns; the engine swaps at the top of its next iteration. No throw needed — the handler already
     runs between frames.
   - **Mid-frame restart** (a level/round/game-over transition from a per-frame service buried deep in the
     plain gameplay tree): the service must ABANDON the rest of the frame and swap the whole main loop.
     Making the entire call tree `yield*` just to bubble that up would drag gameplay into generators, so
     instead it's a non-local exit: `machine.restartMain(() => theNewLoop(m))` sets `nextMain` and throws
     the per-machine `RESTART` sentinel. Nothing in the plain tree catches it, so it unwinds out of the
     mainLoop generator's `.next()`; `runGeneratorGame` catches `RESTART`, swaps in the successor, and the
     aborted frame fires no NMI (its vblank never arrived). The frozen oracle reached the same place by a
     tail-`jp` into a nested never-returning main loop — the throw is the faithful coroutine analogue.
     On The Pit these are `dispatchObjectFrameByStateTimer` / `tickObjectDwellThenTransition` (the timer
     expiry) handing off to `advanceToNextLevel` (level clear) or `dockManAndDispatchRoundBoundary` (life
     lost → next round / game-over teardown), all of which are generators.
4. **Leave the Z80 stack ops (`push16`/`m.ret`) alone** — they model the *emulated* CPU's stack in RAM
   and are orthogonal to the host-side `yield`.

**Validation — byte-exact against the prior engine.** Before converting, capture a golden of the used
game-state region per frame from the current (validated) engine for each tape scenario. After converting,
run the coroutine game and assert byte-identical per frame (minus the cycle-proxy cells — note
`MAIN_LOOP_DELAY`-style busy-wait-length cells belong in that exclusion). On The Pit this was byte-clean
across attract, coin/start and dig, AND — critically for the transition tree the tapes never reach — through
FORCED transitions: drive the game live, then poke the ROM's own transition trigger (arm the master
countdown to expire next frame with its level-vs-life selector set) and assert the coroutine game still
matches the translated oracle frame-for-frame through the mid-frame `RESTART` and out into the next round.
The whole-game gates that lock this in: `idiomatic/test/golive.test.js` (boot→attract), `tape.test.js`
(coin/start/dig), `transition.test.js` (level clear / round boundary / game-over teardown). Then flip the
worker to `runGeneratorGame` and re-run them all on it, plus a check that VIDEO RAM (0x9000+, which the
gates' work-RAM window excludes) is byte-identical too — that is the browser's render.

**Retiring the swap-era gates.** The coroutine gates SUBSUME the per-routine `equivalence-<addr>.test.js`
for every control-SPINE routine (boot chain, main/wait/hold loops, transitions) and the `assembled-swap`
gate: those drove a spine routine as one plain call under `runCycleFree`, which cannot express a
never-returning generator or a mid-frame throw, and `assembled-swap` only ever passed because attract
never reaches the converted routines. Skip them with a pointer here (keep the file for its crafted-entry
harness + rationale); the leaf/gameplay `equivalence-<addr>.test.js` that DON'T touch the spine stay live.
`manifest.idiomatic` + `tools/swap_check.mjs` (the one-leaf-at-a-time promotion set/classifier) are retired
with them — the whole idiomatic layer now runs live, so there is no promotion subset to track.
