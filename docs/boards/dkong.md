# Donkey Kong board — timing, hardware, and the `games/dkong/machine.js` rationale

`games/dkong/machine.js` is the Donkey Kong machine: address space + I/O + register file, plus the
frame accounting both validation modes are indexed by. Its comments keep only checkable one-liners
(the file is held under the `comment_gate` density cap); the measurements, MAME-driver facts and
why-a-wrong-choice-corrupts arguments behind them live here, one section per symbol.

## Frame sampling contract (do not drift)

State and frame buffers are sampled at the frame boundary BEFORE that frame's CPU execution.

- `state[0]` = power-on state, before a single instruction runs
- `state[N]` = state after frames 0..N-1 have executed

This matches what MAME's frame notifier provides, so both sides sample identically. Sampling after
execution instead puts every frame off by one and reads as a translation bug.

## `CYCLES_PER_FRAME = 50688` — derived, not fitted

    frame rate = pixclock / (htotal * vtotal) = 6144000 / (384 * 264)
               = 60.606060... Hz
    cycles     = 3072000 / 60.60606... = 50688 exactly

It comes out an exact integer, which is a good sign we have the right numbers rather than
approximately the right ones.

**Why cycle counting is needed at all:** boot's RAM clear is ~29 T-states per byte
(`ld (hl),a`=7, `inc hl`=6, `dec c`=4, `jr nz` taken=12) over 6144 bytes, which is 3.5 frames. So
the first several frame boundaries fall INSIDE the boot loops, and `state[1..3]` cannot be produced
by "run boot, then sample" — they require suspending mid-loop at the exact cycle the boundary lands
on.

## `NMI_CYCLE_IN_FRAME = 0` — the vblank NMI asserts AT the frame boundary

The vblank NMI asserts at cycle `N * 50688`, not partway into the frame.

Measured by tapping reads of 0x0066 (the NMI vector, so the tap fires when the handler's first byte
is fetched): NMI entries at 202771, 253451, 304141, 354826, 405518, 456213 — every one at frame
N.000x.

A PREVIOUS VERSION HAD 46080 HERE, from 50688 * 240 / 264 (VBSTART/VTOTAL). That arithmetic is
correct; the ERROR WAS UPSTREAM OF IT. MAME's frame origin for this driver is the vblank point
itself, not the top of the visible display, so "46080 cycles into the frame" measures from the
wrong origin. The failure mode is instructive: the constant was not slightly off, the REFERENCE
FRAME was wrong, and fitting a better-looking number would have made one frame agree while hiding
that.

The 10-21 cycle spread in the measurements is the CPU finishing whatever instruction it was in
before accepting the interrupt. It is not modelled as a constant: the NMI is checked at instruction
boundaries, so the jitter falls out of where the boundary happens to land.

## `FramesComplete`

Thrown to unwind out of the translated code once enough frames have been captured. Boot is a
straight-line routine with no "stop here" concept, so the only way to suspend it at an arbitrary
cycle is to unwind. Not an error condition — `runFrames()` catches it.

## `SEAM_CALLER_SKIP`

ROM addresses whose FROZEN ORACLE twin implements the Z80 CALLER-SKIP idiom, so that a `false`
return means the oracle consumed TWO stack words rather than one.

The idiom (`inc sp / inc sp / ret` or `pop hl / ret`) discards the routine's own return address
before returning, so control resumes in the CALLER'S CALLER — the caller is skipped. The idiomatic
rewrite models that as a plain `return false` and touches no stack at all (its callers guard it
with `if (!f(m)) return;`), so the seam owes TWO brackets on that path, not one. This is the second
arm of the same defect the seam closes; without it the flip leaks 2 bytes per skip.

**Derived from `translated/`, not guessed.** Every entry either (a) was MEASURED at +4 on its
`false` path in an instrumented 600-frame pure-oracle attract run, or (b) has the two-word discard
literally in its oracle body immediately before the `ret` that precedes `return false`. Membership
is re-derived and asserted by `idiomatic/test/idiomatic.test.js` ("the caller-skip table matches the
frozen oracle"), so the table cannot drift away from the oracle silently.

**What this table cannot express:** a few oracle routines return `false` from MORE THAN ONE path
with DIFFERENT stack effects — 0x2B29 skips two words when it tails into 0x2B51, but only one when
it propagates 0x2B9B's double-skip (which consumed its words inside 0x2BE1). A per-address table
picks one. 0x2B29 is listed for the two-word path because that is the only one reachable in the
measured runs; the one-word path needs 0x2BE1's `A <= C` arm, never observed. The exact fix for
that class is to move the caller's `push16` into the seam when `translated/` is next regenerated:
emit the return address into the seam at the call site, so the callee's bracket is data rather than
an inference from adjacency.

**Deliberately absent** (they return `false` but consume only ONE word, so listing them would make
the seam over-pop): 0x2B53 / 0x2B9B / 0x2BE1 (the double-skip is performed inside 0x2BE1, which
discards the word 0x2B53 itself pushed — net one bracket at the seam), 0x06B8 (its oracle notes the
`false` is NOT a skip signal), and 0x2880 (its oracle's extra word is an ENTRY-side `pop hl`
recovering a value its dispatcher pushed, not a skip; its idiomatic twin returns `true` on every
path by design).

**0x3E99 is deliberately NOT listed even though its oracle nets +4.** That +4 is a consumed
ARGUMENT, not a discarded return address: the dispatcher pushes a bounds word and idiomatic
`loc_3e99` pops it ITSELF (`const bounds = m.pop16()`), so the seam's ordinary one-word bracket
already balances the frame. Listing it would in fact be INERT rather than harmful — MEASURED:
`seamWrap` applies the skip only under `r === false`, and `loc_3e99` returns a NUMBER (0/1/3/7);
the `sp !== spEntry` guard also declines it, since its own `pop16` has already moved SP. It is
omitted because it is not a caller-skip, not because listing it would over-pop (an earlier comment
said the latter and was wrong). **A +4 measurement alone does not mean caller-skip — check WHICH
word was consumed.**

Per-entry evidence (entry tags in `machine.js` carry the same MEASURED / idiom shape):

| addr | name | idiom | evidence |
|---|---|---|---|
| 0x1E8C | runHitEffectInsteadOfPlay (effect-latch frame gate) | pop hl / ret | MEASURED false:+4 x146 of 1938 |
| 0x30FA | loc_30fa (difficulty->gate selector) | pop hl / ret | MEASURED false:+4 x896 of 1792 |
| 0x33A1 | loc_33a1 (movement-path height gate) | inc sp x2 / ret | SOURCE-JUSTIFIED, see below |
| 0x0008 | loc_0008 gameActiveGuard | inc sp x2 / ret | measured false:+4 |
| 0x0010 | loc_0010 marioActiveGuard | inc sp x2 / ret | measured false:+4 |
| 0x0018 | loc_0018 tickSubstateTimer | inc sp x2 / ret | measured false:+4 |
| 0x0020 | loc_0020 tickSubstatePrescaler | pop hl / ret | measured false:+4 |
| 0x0030 | loc_0030 boardBitGate | pop hl / ret | measured false:+4 |
| 0x1783 | loc_1783 allSlotsClear | jp 0x0026 -> pop hl / ret | source |
| 0x1A2A | loc_1a2a advanceSubstateWhenGrounded | pop hl + tail 0x19d2 whose ret pops | source |
| 0x1E85 | loc_1e85 enterBoardAdvanceAndUnwind | pop hl / ret | source |
| 0x2257 | loc_2257 | pop hl / ret | source |
| 0x236E | findOppositeLadderEnd | pop hl / ret | source |
| 0x2913 | loc_2913 findCollidingObject | pop ix / inc sp x2 / ret | source |
| 0x2B29 | loc_2b29 | tails into 0x2b51 | measured false:+4 |
| 0x2B51 | loc_2b51 | pop hl / ret | measured false:+4 |
| 0x2B74 | loc_2b74 | pop hl / ret | source |
| 0x2B91 | loc_2b91 | pop hl / ret | source |
| 0x3110 | loc_3110 | inc sp x2 / ret | measured false:+4 |
| 0x311B | loc_311b | inc sp x2 / ret | source |
| 0x3126 | loc_3126 | inc sp x2 / ret | source |
| 0x3131 | loc_3131 | inc sp x2 / ret | source |
| 0x313C | spawnRequestedFireAndRecolorLiveFires | inc sp x2 / ret | measured false:+4 |


**0x33A1 is source-justified, not measured:** ROM 0x33A1 = `3e 07 f7 dd 7e 0f fe 59 d0 33 33 c9`;
the `33 33 c9` tail IS the idiom. Attract reaches only the `ret nc` arm, so an oracle run CANNOT see
this one. (Counts vary sharply with engine and pin: 13 in a 4000-frame unpinned `runCycleFree`
pass, 0 in an 8000-frame PINNED run, 49 unpinned — so no single number is quoted. What is invariant
across all of them is that the skip arm is never taken.) It is listed on the ROM bytes, like the
other unmeasured entries.

## `SEAM_TAIL_NO_RET`

ROM addresses reached by a translated `jp` TAIL whose frozen oracle twin does NOT return through a
`ret`, so the seam must consume nothing.

The emitter writes a `jp` tail as a bare `m.call(T)` with no push. Almost every such target ends in
`ret` and so consumes the bracket the outermost `call` in the tail chain opened — measured +2 on
every tail-entered address in an instrumented 900-frame pure-oracle attract run EXCEPT these four,
which are the board-layout walk: 0x0DD3 and its three segment drawers (0x0E19 drawLadder, 0x0E2A
drawSegmentEndCap, 0x0E4F drawGirderSpan) all end by jumping BACK to the walk head at 0x0DA7, so the
chain is a loop and its guest-stack delta is exactly 0. Consuming a bracket for them steals a word
from the enclosing frame (it shows up immediately as `UnmappedAccess: unmapped read at 0x6c00` when
the NMI epilogue then rets off the top of the stack).

**Coverage of this claim:** the +2 default is measured over the ATTRACT sequence only (900 frames,
every tail-entered dispatch). A gameplay-only tail chain that likewise never rets would not be in
this set and would over-pop. It would not pass silently — the whole-flip gate in
`idiomatic/test/idiomatic.test.js` asserts SP is unchanged at every vblank yield, and an over-pop
drives SP UP, which that assertion catches on the first frame.

Both tables are exported so the gate can re-derive them from the frozen oracle.

## `installCallBracketSeam` — the translated->idiomatic seam

Closes the Z80 call bracket that a frozen translated caller opened for an idiomatic callee.

**The defect this exists to fix.** A translated call site is emitted as
`m.push16(RET); m.step(T, 17); m.call(T)` — the push lives in the CALLER and the matching pop lives
in the CALLEE's `ret`. That is fine while both sides are translated, and fine while both sides are
idiomatic (an idiomatic caller direct-calls its idiomatic callee and emits no push at all). It
breaks at the SEAM: a frozen translated caller cannot drop its push, and an idiomatic callee models
the `ret` as a plain JS `return` and never pops. Every such transition leaked exactly 2 bytes of
guest stack. Under `resolveAllIdiomatic()` that is 12-14 bytes PER FRAME; SP walked from 0x6C00
down into the task ring at 0x60C0-0x60FF by frame 237 and the game died on dispatched stack garbage.

**Why here and not in `Machine.call`.** There are THREE dispatch paths into an override, not one:
`this.routines` (built by copying `this.overrides`), and the two translated computed-`jp`
dispatchers that bypass `Machine.call` entirely and invoke `m.overrides.get(target)(m)` directly
(`translated/loc_02e3.js` and `translated/loc_00ca.js` — between them exactly the 2 bytes/frame that
separated the measured -12 from the -14). Wrapping each override ONCE where it is registered covers
all three with one implementation; a fix inside `Machine.call` would cover only two.

**Why the bracket is not inferred from SP.** "Is the word at SP an unpopped push?" has a false
positive: at a tail-`jp` site emitted as a bare `m.call(T)` with NO push, the word at SP can be a
REGISTER SAVE (the NMI prologue's `push hl`), which an SP-only test cannot tell from a call bracket,
and popping it corrupts the frame. So the bracket is taken from the EMISSION SHAPE instead, which is
exact: the emitter writes the push IMMEDIATELY before the dispatch for a `call` and writes no push
at all for a `jp` tail. `lastPushSp === sp at dispatch` is therefore a precise test for "my caller
opened a bracket for me", not a heuristic. `opened` is decided at the dispatch in the `m.call`
wrapper, while the adjacency is still observable.

**Precondition (load-bearing, easy to lose):** adjacency is exact only while nothing can interleave
between the emitter's `push16(RET)` and its `m.call(T)`. Both cycle-free engines suppress the
scheduler NMI, so it holds everywhere the seam runs today. `runFrames`' `tick()` CAN fire
mid-sequence, which would clear `lastPushSp` and under-pop; that path has no override users today
(its only callers install delegating hooks), but wiring overrides into a scheduler-driven run would
break this assumption and must re-derive the bracket.

The computed-`jp` dispatchers are the one case where that adjacency is not visible (0x00CA's
continuation is pushed, then `rst 0x28`'s own return address is pushed and popped by `loc_0028`
before the target is reached). Those two sites are recognised structurally — they do not go through
`Machine.call`, so the wrapper sees no matching dispatch frame — and a dispatched target ALWAYS
returns through a continuation its dispatcher's caller pushed (0x02BD for the task ring, 0x00D2 for
the NMI state table), so its bracket is open by construction.

**Safety properties:**

- The consumption is guarded on SP being back where the wrapper entered. A capturing hook that
  delegates to the oracle (the memory-equivalence capturing hook) has already let the oracle's `ret`
  move SP, so the wrapper declines — self-correcting, no special case.
- Nothing here runs unless at least one override is installed. With an empty override map the
  Machine's own prototype methods are untouched, so the pure-oracle path is unchanged BY
  CONSTRUCTION.

## `consumeBracketAtSp`

Consumes ONE open call bracket sitting at the CURRENT SP, walking OUT through the live dispatch
frames, and reports whether one was found. It serves two of the three shapes the oracle's `ret` can
take at the seam:

- a `jp` TAIL into an idiomatic routine. The emitter writes a bare `m.call(T)` with no push, so the
  tail routine has no bracket OF ITS OWN — the oracle's `ret` there returns on its caller's behalf,
  consuming the bracket the OUTERMOST `call` in the tail chain opened. Several dispatch frames can
  share one SP (a chain of tails), which is why it keeps walking outward past unbracketed frames
  instead of stopping at the first one.
- the caller-skip's SECOND word: after the callee's own `ret`, SP has reached the caller's frame and
  the oracle's skip pops the bracket the caller's own caller opened.

Finding nothing is a real answer, not a failure: when the chain was entered by a plain JS call from
idiomatic code the bracket was dissolved at emission and there is correctly nothing to pop. That is
also what keeps a routine whose oracle twin does NOT `ret` (the board-layout walk, measured net-zero
on the guest stack) from being over-popped — no frame stands at its SP.

## `seamWrap`

Wraps ONE resolved override so it closes the call bracket its translated caller opened. A generator
is the engine-driven control spine (boot/mainLoop): it is entered by `runIdiomaticGame`, never by a
translated caller, and opens no bracket, so it is returned unwrapped. On the `own === undefined`
path the override was reached without a `Machine.call` dispatch frame of its own — one of the two
computed-`jp` dispatchers invoked it — so its bracket is open by construction (see above). On a `jp`
tail where either the oracle twin does not `ret` (`SEAM_TAIL_NO_RET`) or no bracket exists out the
chain (entered from idiomatic code, dissolved at emission), the oracle would not have consumed a
word, so neither does the wrapper, and there is no skip to apply.

## `buildOverrides` — the per-routine override map

Dispatch/call target (a number) -> handler function. This is what lets an idiomatic rewrite (or the
gate's capturing hook) replace its `translated/` counterpart WITHOUT editing the call site —
`m.call(addr)` consults the layered registry, and `dispatchGameState` / `dispatchTask` consult this
map before their translated chain.

**Input shape.** `spec` is a caller-supplied object/Map. A value is either an ALREADY-RESOLVED
function (what `resolveAllIdiomatic` and the memory-equivalence gate hand in) or the declarative
form `{ "0xADDR": { module: "./idiomatic/<name>.js", export: "<name>" } }`. The KEY is the rst-0x28
dispatch target — the exact address `dispatchGameState` switches on — as a hex string (a number is
also accepted from a test). The VALUE names the module (relative to this game's directory) and the
export to route that address to.

**Resolution is async, so it is NOT done here.** Turning `{ module, export }` into a function needs
a dynamic `import()`, which a constructor cannot await, so the declarative form is resolved by
`resolveOverrides()` BEFORE construction and handed in via `opts.overrides`. This split keeps the
resolution identical in Node and in the browser worker: both call `resolveOverrides()`, which uses
the dynamic import available in both. No game currently ships a declarative `manifest.optimized`
block; the resolver stays for when one is added, and `buildOverrides` throws on a raw
`{ module, export }` value so a missing resolver is named loudly rather than silently ignored.

**The call bracket is closed here.** Each resolved override is wrapped ONCE, at registration, by
`seamWrap`. The wrapped function is the one value that lands in BOTH `this.overrides` (which the two
translated computed-`jp` dispatchers read directly) and `this.routines` (built by copying it), so
all three dispatch paths get one implementation.

**An empty spec produces an empty map and nothing else.** The seam bookkeeping and the wrapper are
created only after an override has actually been seen, so a Machine with no overrides — every
oracle test, every convergence baseline — keeps the Machine's own prototype `push16` / `pop16` /
`call` and runs the identical code it ran before: every such player gets the exact translated
behaviour, and the override branch in `dispatchGameState` / `dispatchTask` is inert. (The shipped DK
player is NOT on this path: `manifest.js` sets `runtime: "idiomatic"`, so `web/worker.js` hands the
player `resolveAllIdiomatic(...)` — the full override map, seam installed. The player's cover is
`idiomatic/test/idiomatic.test.js` test 2.)

## `resolveOverrides`

Resolves a declarative `manifest.optimized` block to a `Map<number, function>` ready for
`new Machine(rom, { overrides })`. Async because it dynamic-imports each module; dynamic import
exists in Node and the browser worker alike, so one resolver serves both. Module paths resolve
relative to `baseUrl`, which defaults to `games/dkong/machine.js`, so entries like
`./idiomatic/<name>.js` resolve against the game directory — the same base the audio paths use.

## Constructor state

- `this.rom` / `this.assets` are retained so `clone()` can build a fresh Machine on the SAME rom +
  assets without the caller re-supplying them.
- `mem8` / `mem16` are indexable views for the idiomatic layer's readability (`mem8[ADDR]`,
  `mem16[ADDR]` forward to `read8/write8`, `read16/write16`) — pure sugar; the oracle and the live
  engine keep calling `this.mem` directly. Rebuilt per instance so `clone()` gets views bound to its
  own memory. See `core/mem-views.js`.
- `this.routines` is the whole dispatch table: the oracle registry (`routines.js`) with overrides
  laid over the top, so an override replaces its oracle at EVERY call site, not just at a dispatch
  point. With no overrides it is the oracle table, byte-identical to pure translated code. A FRESH
  Map is taken so the passed-in registry (also held in `this.assets`) is never mutated — `clone()`
  rebuilds from it and re-layers.
- `nextNmi` advances every frame whether or not the NMI is masked — vblank happens regardless; the
  mask only decides whether the CPU notices.
- Video decode is done once at construction: tile ROMs and PROMs are immutable. `gfx2` is optional:
  without it the tilemap still renders and sprites are simply not drawn; with it, the sprite
  post-pass in `finishRasterFrame` runs.
- `pc` is the ROM address of the NEXT instruction — what the Z80 pushes when it accepts an NMI.
  Maintained by `step()`; `tick()` invalidates it.
- Poke tape `[{addr,val,frame,dur}]` is set by `emit.js --poke` (tools/emit-core.js): `once` is dur 1, `holdN` is dur N, plain `hold` is dur null.
  Applied at each frame boundary BEFORE that frame's CPU exec (and before the state sample, so
  `state[N]` reflects the poke). `dur` frames from `p.frame` (null = indefinite hold); holdN releases
  after N so the game's own code manages the byte during play.
- Input tape `[{port,bits,frame,dur}]` is set by `emit.js --input`. Asserts coin/start/joystick
  bits on IN0/IN1/IN2 so the ROM's own credit/start logic drives gameplay. `once` = frame N only (a
  momentary pulse, the default), `hold` = every frame from N (a held direction); `dur` 6 = MAME's
  coin hold. `io.inputAssert` stays active for the whole frame's reads (the NMI may read IN2
  mid-frame) and is recomputed at the next boundary so a `once` pulse clears the frame after.

## `step(nextAddr, cycles)` — why the PC rides along

If an NMI is accepted here, the Z80 pushes the address of the next instruction, and that value
lands on the stack inside the work RAM that is diffed against MAME. Keeping the PC as separate
bookkeeping meant it went stale the moment control entered a routine that did not maintain it — a
review found the first real NMI pushing 0x02C5 while two calls deep in 0x06xx code. Carrying it as
an argument makes the stale case unrepresentable rather than merely discouraged.

## `fireNmi`

Vectors the vblank NMI exactly as the Z80 would: push the current PC and jump to 0x0066.

**The pushed PC matters and is not a free choice.** It lands on the stack at the top of work RAM,
inside the 5120 bytes diffed against MAME, so it must be the value the ROM would have had there —
not a sentinel, not zero. That is why translated code maintains `m.pc`, and why an unknown PC throws
rather than pushing a guess.

**No reentrancy guard, deliberately:** the handler's first real act is `xor a / ld (0x7d84),a`,
clearing the NMI mask. The hardware gate is the guard, so modelling it faithfully gets the mutual
exclusion for free rather than bolting on a JS flag that could disagree with it.

**11 T-states of NMI acceptance.** The Z80 spends 11 T-states accepting an NMI before the handler's
first byte is fetched: an acknowledge M1 cycle plus the PC push. Charging nothing started the
handler 11 cycles early on every interrupt. Found as a CONSTANT 11-cycle offset — not jitter —
between our NMI entry (202760) and MAME's (202771), and again at sub_0141's entry (202908 vs
202919). A constant offset at two points inside the same handler is a missing fixed cost, not
instruction-boundary alignment.

## `tick(n)`

Advances the T-state clock and captures a state dump whenever a frame boundary is crossed.
Translated instructions call it with their real T-state cost, so boundaries land exactly where they
do on hardware. The capture happens MID-INSTRUCTION-STREAM by design: `state[N]` is whatever memory
holds at the instant the boundary is crossed, which is how MAME's frame notifier samples too.

**Order matters and is not arbitrary.** The state sample and the NMI assertion happen at the SAME
instant (cycle N * 50688), and sampling is defined to occur BEFORE execution — so `state[N]` must
never contain frame N's own NMI effects. Capturing first is what makes that true.

**Drain the raster BEFORE the boundary check — the ordering is the guarantee, not a margin.** Row
223 is due at N*50688 + 50496, only 192 cycles before the frame ends, and the largest real tick is
the 3121-cycle DMA stall. So the margin is NEGATIVE by 16x and would drop frames constantly if
safety depended on it. It does not: entering the boundary loop requires cycles >= (N+1)*50688 >
row 223's due time, so draining first paints every row regardless of tick size. (These numbers were
45888 and "4800 cycles early" while `VBLANK_LINES` was mistakenly VBEND. A reader checking "is
3121 < 4800?" would have concluded there was headroom. There is none.)

At the boundary, the frame the beam has just FINISHED painting is complete, so that is where it is
published: `videoFrames[N]` is the image of frame N, composed row by row DURING frame N, not
snapshotted at either end of it.

**Stopping is bounded by CYCLES, not frame count.** Conflating them cost a real artifact: throwing
the instant the last frame was captured stopped execution at the frame boundary, which is exactly
one instant BEFORE the NMI is checked — so a 5-frame run produced a hardware write trace containing
no NMI writes at all. Frame capture is a sampling concern; how far to execute is not.

Vblank is checked at an instruction boundary, which is where `tick()` is called from — the Z80 also
only accepts an NMI between instructions, which is where the measured 10-21 cycle entry jitter comes
from.

**`pcKnown = false` at the END, after the NMI check.** A bare `tick()` is an instruction whose
successor address was never recorded, so the PC is stale until the next `step()`. Invalidating
after the NMI check is what makes the guard in `fireNmi` able to fire at all: it lets `pcKnown`
return to false once a `step()` has run. Not every routine maintains the PC (boot.js and nmi.js
still do not), so without this invalidation the guard would be inert.

## `runFrames(count)`

Frame 0 starts being PAINTED at the start of the run and is published when the boundary into frame
1 is crossed — nothing to snapshot, the image of frame 0 is not knowable until frame 0 has executed.
The run goes one frame past the last sampled frame (`maxCycles = (count + 1) * CYCLES_PER_FRAME`)
so per-frame side effects that land just after a boundary — the NMI is 11-30 cycles after it — are
still executed and traced; frames beyond `count` are not captured. `NotImplemented` means
translation ran out: the frames already captured are still valid, so they are kept and WHY it
stopped is recorded rather than discarding the run or pretending it completed. The `finally` resets
the limits to leave the Machine usable — without it the frame limit stays armed and every later
tick throws.

`reset()` is the Z80 reset (entry at PC=0x0000) and faithfully NEVER RETURNS — boot falls through
into the main loop, which spins forever waiting on vblank. It exits only via `FramesComplete` or a
`NotImplemented` stub.

## `Machine.create`

Async factory mirroring `games/thepit/machine.js`'s `Machine.create`, so the SHARED cross-game tools
have one construction interface. DK's registry is available synchronously (`buildRoutines()` copies
`ORACLE_ROUTINES`, statically imported), so this adds no capability the constructor lacks — it adds
the SHAPE the tools expect. `tools/swap_check.mjs` calls `Machine.create(rom, …)`; without it the
tool died with `TypeError: Machine.create is not a function` for DK, so the whole-game swap gate had
never once run for this game. Fixed in the Machine rather than the tool: the tool is shared, The Pit
already offers this entry point, and `makeMachineFactory` is a different shape that would have
needed a second code path in every shared tool forever.

## `push16` / `pop16` / `ret` — the stack is real memory and it is diffed

Control flow between translated routines is ordinary JS calling, but that is not sufficient: the Z80
stack lives at the top of work RAM (`ld sp,0x6c00` puts it at 0x6BFF downward), inside the 5120-byte
region diffed against MAME. If a translated `call` does not write its return address to memory, our
RAM differs from MAME's at addresses no routine ever names.

It also matters semantically: `rst 0x28` reads its own return address off the stack to find an
inline jump table, and the `pop hl / ret` idiom returns past its caller. Those only work if the
bytes are actually there.

The Z80 does NOT clear popped bytes — they stay in RAM after the `ret`, which is why post-boot
0x6BFE/0x6BFF hold 0xB8/0x02 rather than zero. So each translated `call NNNN` pushes its literal
return address (known at translation time) and the callee's `ret` pops it. `ret` pops into
`step()` because the popped value IS the next PC — which is why `ret` cannot just be a JS `return`.

## `call(addr, ...args)`

Invokes the routine at `addr` through the swap registry: the idiomatic rewrite if one is registered,
else the translated oracle. Every inter-routine call is written this way (`m.call(0x0874)` for
`call 0x0874`), which is what makes any routine independently swappable rather than only the two
dispatch targets. It dispatches WHICH implementation runs; the `push16`/`step` that model the CALL's
stack push and cycle cost stay at the call site, so with an empty override map this is
byte-identical to a direct call. Extra args are forwarded for the two routines the translation
parameterised (`sub_0028`, `draw_0578`); the return value is forwarded for the rst skip-idiom
(`if (!m.call(0x0008)) return;`).

## Rendering

**`renderFrame` sprite post-pass.** `renderFrameRGB` paints the TILEMAP ONLY. Without the post-pass,
everything that is a sprite — Mario, Kong, the barrels, Pauline, the hammers — is simply absent, and
the frame still looks plausible because the girders, ladders and HUD are all tilemap. It is the
identical pass, with identical opts, to the raster path's end-of-frame sprite layer in
`finishRasterFrame`; the two render paths must agree or the runtime that uses this one (the
idiomatic runtime — `web/worker.js` renders on demand here) draws a spriteless game.

**`drainRaster`** paints every scanline the beam has passed since the last call, each from video RAM
AS IT STANDS AT THAT MOMENT, so a mid-frame flip or VRAM rewrite comes out as the composite the
hardware actually produces rather than a snapshot of either side of it. GRANULARITY IS THE TICK, NOT
THE SCANLINE: rows are painted after an instruction completes, using flip and palette-bank state as
of then, so a tick spanning several lines paints them all with end-of-tick state. Harmless for the
3121-cycle DMA stall (it targets sprite RAM at 0x7000, touches neither videoRam nor flip), but it is
an approximation, not a scanline-exact model.

**`startRasterFrame`.** The first DISPLAYED scanline starts `VBLANK_LINES` (40) in from the frame
origin, which is the VBLANK POINT — not VBEND (16), which numbers raster lines from a different
zero.

**`finishRasterFrame`.** Sprites are a frame-level pass on top of the painted tilemap, from OUR
sprite RAM at end-of-frame. This is the end-to-end counterpart of the earlier isolated draw check,
where GOLDEN sprite RAM was fed into the same sprite pass — here the sprite RAM is what our own CPU +
DMA produced, so a red now is translation-or-timing, never the draw model (proven correct against
golden sprite RAM). Sprite RAM is zero on the pre-sprite frames, so `drawSprites` is a no-op there
and frames 0-516 are byte-unchanged.

A frame whose scanlines were not all painted is DROPPED rather than published half-black: an
incomplete frame that looks real would diff as a rendering fault rather than as the short run it
is. That branch is NOT reachable on the run-stopped-mid-frame path — that path THROWS and never
returns here (measured: a 7-frame run stopping at 0x0763 leaves `rasterRow` at 6 and drops nothing).
With `drainRaster()` running before the boundary, the only way to arrive with rows outstanding is a
tick longer than a frame; the branch is a tripwire for exactly that.

The next frame starts at `frames.length - 1`: the state for the current boundary has ALREADY been
pushed, so `frames.length` is N+1 when frame N begins. Passing `frames.length` put `nextRowCycle` a
whole frame ahead, no scanline ever came due, and every frame was silently dropped as unfinished —
caught by the emitter's count assertion rather than writing a one-frame file.

## `dumpState` / `clone`

`dumpState` is the 5120-byte state dump: work + sprite + video RAM, per the frame-sampling contract.

`clone()` is a fresh Machine on this one's ROM + assets, restored to its observable state: all RAM,
the full register file, and IO value-state. The clone's frame machinery is neutralised
(boundaries/NMI/budget set to Infinity) so running ONE routine on it in isolation cannot trip a
frame sample, fire an NMI, or throw `FramesComplete` — the unit gate measures the routine, not the
scheduler. A clone rebuilds from `this.assets`, so it carries whatever `overrides` the source was
built with — including the unit gate's snapshot override. That is harmless: the unit gate invokes
the routine under test DIRECTLY (translatedFn/idiomaticFn on the clone), so the override map is
consulted only for an `m.call` the target makes INTO itself, where the snapshot delegates to the
oracle — exactly the callee-is-oracle isolation the unit gate wants. (Whole-machine equivalence
backstops the one case this can't distinguish: an idiomatic routine that recurses into itself.)

## `resolveAllIdiomatic`

Resolves the WHOLE idiomatic layer — every routine in `idiomatic/names.js`'s ROUTINES — to an
override map. This is what `web/worker.js` ships and what the full-flip gate wires.

**Module from `name`, export from `entry ?? name`.** The module is always `idiomatic/<name>.js` —
`name` IS the filename, one-to-one. The EXPORT may differ because a wired address is dispatched as
`fn(m)`, one argument, and a few idiomatic routines are deliberately PURE functions of their Z80
register inputs (`snapYToGirder(x, y, step)`) so their idiomatic callers can pass proper arguments.
Registering a pure function at a ROM address hands it the Machine as its first coordinate and it
silently degrades to a no-op. `entry` names the ROM-level ABI wrapper beside it — same module,
machine-shaped — so the address gets a correct entry point without disturbing the pure function.
See the `entry` note in `idiomatic/names.js`.
