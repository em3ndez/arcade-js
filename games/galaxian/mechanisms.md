# Galaxian — mechanism map

A code-grounded model of how Galaxian plays, derived from the idiomatic + frozen-oracle routine bodies and
confirmed against the real ROM under MAME. This is a **living** document: it is regenerated whole as the
idiomatic decompile spiral climbs, and currently covers the **leaf helpers** lifted in decompile batches 1–8.
The higher-level per-frame orchestration that drives them — the main loop and the state dispatchers — is
translated but not yet idiomatically decompiled, so it is described here only as far as the leaves reveal it.

**Confidence tags** — never recalled, always grounded or derived: `[seen]` a MAME observation terminates the
chain (a write-tap value trajectory, a confirmed dispatch/consumer); `[code]` a confident reading from the
routine's behaviour with MAME not yet consulted for that specific claim (a register/VRAM/hardware-latch
output the work-RAM tap cannot see, or a state the captures did not reach); `[guess]` plausible, unverified.
The tag on each routine here is the one recorded in `idiomatic/names.js`, which is the single source for every
name/role/tag; this prose cites those names, never contradicts them. Cells named `loc_<addr>` are roles read
from the code but not yet promoted to a descriptive identifier — their role is described in prose regardless.

## System primitives: RNG, memory fill, table fetch, and the vblank interrupt

Beneath the game logic sit a handful of tiny, sharply-defined helpers that the rest of the machine leans on constantly: a pseudo-random generator, a block memory fill, an indexed table lookup, and the epilogue that keeps the per-frame interrupt alive. They are worth understanding first because so much higher-level behaviour is expressed in terms of them.

Randomness comes entirely from `advanceRandomSeed` [seen], a classic linear-congruential step. It reads the single seed byte `RNG_SEED` (0x401e), computes `seed*5 + 1` truncated to eight bits, writes that new value straight back into `RNG_SEED`, and hands the same byte back as this draw's random number. The important, slightly counterintuitive fact is that `RNG_SEED` is a live counter rather than a fixed base: every draw both consumes the current value and advances it, so two calls in a row never see the same seed. Callers take whatever slice of the byte they need — `chooseNextAttackerDirection` keeps only the low bit (`advanceRandomSeed(m) & 1`) to pick which way a new attacker curves, while `reseedFormationObjectState` uses the whole byte as a fresh random Y coordinate when it re-arms a formation object, and `computeControlledObjectMoveCommand` draws from it as well. There is no separate reseed ritual; the fixed multiply-and-increment recurrence is the whole generator.

The block fill is `fillMemoryBlock` [code], the machine's bulk memory-clear/set primitive (reached through the RST 10 shortcut). Given a destination pointer, a byte value, and a count, it stores the value into successive addresses, walking the pointer forward, until the count is exhausted; because the count is decremented and tested as a byte, a passed count of zero wraps to a full 256-byte fill rather than doing nothing. When it finishes it leaves the pointer sitting just past the region it wrote and the count spent to zero, so a caller can chain a second fill immediately after the first. This is how large regions get initialised in one stroke: `resetObjectRamAndAdvanceSequence`, for instance, zeroes the sprite shadow block at `SPRITE_SHADOW_BASE` and then two runs of the object page beginning at `loc_4260`, and the screen-clear paths use it to stamp a fill tile across video RAM. Because the pointer simply advances through the address space, the destination can be an ordinary RAM buffer or a memory-mapped hardware latch — the fill does not care which.

Its companion is `fetchIndexedTableByte` [code], the indexed table read (reached through the RST 20 shortcut). It takes a base pointer and an eight-bit index, adds the index to the pointer with the carry propagating into the high byte so the sum is a true sixteen-bit address, and returns the byte found there. It also leaves that advanced address in the pointer, which lets a caller continue reading nearby entries. This is the standard "look up entry N of a table" operation: `drawTileGlyphOrBlock` uses it to translate a glyph index into an actual tile code by indexing the glyph table based at `loc_2157`, and the screen-drawing routines use it the same way for their data tables.

`rearmVblankInterruptAndRestoreRegs` [code] is the tail end of the vblank interrupt handler, and it is what keeps the game running frame after frame. When a vblank interrupt is taken, the entry code saves the working registers and clears the interrupt-enable latch to acknowledge the current interrupt. This epilogue does the reverse in the right order: it first writes `IRQ_ENABLE` (0x7001) back to 1, re-arming the hardware so the next frame's vblank will interrupt again, and only then restores the six register pairs the entry saved — pulling back IY, IX, HL, DE, BC, and finally AF — before returning through the interrupted address to resume the main loop exactly where it left off. AF is restored last on purpose: the value 1 used to re-arm the latch passes through the accumulator, so the caller's original A and flags must be reloaded afterward to erase that transient. If this re-arm were ever skipped, only the very first vblank would ever fire and the whole per-frame loop would freeze, so this small routine is load-bearing for the entire game.

Finally, `loc_090b` [code] is a deliberately unnamed one-line epilogue: it restores the caller's previously-saved HL and returns, touching no memory. It exists only as the shared exit of the command-queue enqueue path — `commitQueueWriteHead` ends by falling into it — where an earlier saved HL needs to be handed back before the caller resumes. It is a genuine restore of a stacked value, not a load from any named cell.

## The attract / sequence state machine, dwell timers, credit transition, boot config, and playfield init

Everything the machine does between power-on and the first spawned wave is governed by two nested
selectors. The outer one is `GAME_STATE` (0x4005): once per frame the top of the machine reads it and
runs one of five handlers — a boot fill, the attract sequence, the post-credit "press start" screen, and
two play handlers. The inner selector is `SEQUENCE_STATE` (0x400a): every one of those five handlers, in
turn, indexes a small table of sub-state routines on it. So the whole front end is a state number and a
sub-state number, and almost every routine below either advances one of those two numbers or waits on a
timer that will.

### The dwell cascade — how a sub-state times out into the next one

The waiting is done by a two-tier down-counter that lives in the two bytes immediately below the
sub-state index: `loc_4008` (the fast/prescaler tier) and `loc_4009` (the dwell tier), with
`SEQUENCE_STATE` (0x400a) sitting directly above them. The counterintuitive fact worth stating plainly:
these are not independent counters that reset themselves on expiry. The shared engine is
`tickCascadeCountdown` [seen], which decrements the byte it is pointed at and, *only on the tick that
reaches zero*, steps to the very next byte in the page and increments **that**. So when the dwell tier
`loc_4009` runs out, the carry does not reload it — it bumps 0x400a, which is `SEQUENCE_STATE` itself.
The timer expiring *is* the sub-state advancing.

Two thin sub-state handlers feed that engine. `tickSequenceDwellTimer` [code] simply points at the dwell
tier `loc_4009` and ticks it — one dwell frame per game frame, carrying into the state index on the last
one. `tickPrescaledSequenceTimer` [seen] adds a prescaler in front: it decrements `loc_4008` each frame,
and only when *that* wraps does it reload `loc_4008` to 60 and tick the dwell tier `loc_4009` — a much
slower march to the next state. `armStepCountdownAndTickSequenceTimer` [seen] is the attract sub-state
that first raises the one-frame arm flag `loc_4019` and then runs the prescaled tick, so the prescaled
dwell begins the same frame the sub-state is entered.

A cluster of small helpers re-arm the dwell tier rather than let it carry. `reloadSequenceDwellTimer`
[code] stamps `loc_4009` back to 80. `advanceSubstateAndReloadDwell` [code] does the pair a handler
usually wants together: bump the sub-state counter it is handed (its callers pass `SEQUENCE_STATE`) and
then reload the dwell tier, so the machine moves to the next sub-state and immediately starts its dwell.
`setSequenceStateByModeAndReloadDwell` [code] is the branching version — it writes the sub-state cell to
either 4 or 14 depending on the mode bit in `loc_4006`, then reloads the dwell — a jump to one of two
fixed sub-states chosen by mode. `advanceSubstateAfterDwellAndQueue` [code] is a self-contained dwell
sub-state used in play: it ticks `loc_4009`, and on the zero-cross reloads it to 20, advances
`SEQUENCE_STATE`, and posts this state's command word. `enterSequenceStep1` [code] is the seed for that
whole cascade: it forces `SEQUENCE_STATE` to 1 and arms the step-1 dwell by writing 3 into both tier
bytes `loc_4008` and `loc_4009`, so step 1 counts down a short three-and-three before carrying on.

### Boot: filling the screen and latching the machine's configuration

`GAME_STATE` 0 is the boot handler, `fillScreenThenLatchConfigAndAdvanceState` [seen]. Each frame it
blanks one 32-byte strip of the tilemap at the fill cursor `VRAM_WRITE_PTR` (0x400b), then advances that
cursor by 32 so that over successive frames it wipes the whole grid from `VRAM_BASE` (0x5000) up through
0x53ff. While it wipes, it counts the per-state timer `loc_4008` down; the wipe simply fills the time.
On the frame that timer reaches zero the machine crosses out of boot: it sets `loc_4007` to 1, clears the
mode byte `loc_4006`, sets `GAME_STATE` to 1, and zeroes `SEQUENCE_STATE` — handing control to the
attract sequence at its first sub-state. In the same breath it reads the machine's DIP/cabinet
configuration *once* and latches it into the cells the rest of the game will consult: the top two bits of
`IN1_SHADOW` fold into `loc_4000`, bit 2 of `IN2_SHADOW` into `loc_401f`, bit 5 of `IN0_SHADOW` into the
flip flag `loc_400f`, and the low two bits of the live `IN2_PORT` (0x7000) pick a coinage byte out of the
four-entry table at `loc_0152` and store it in `loc_40ac`. It then unpacks the packed flag bitmap out of
the ROM template at `loc_051b`, seeds the object shadow, writes the three player-1 status glyphs into
`PLAYER1_STATUS_VRAM` (0x5340) and its neighbours `loc_5320`/`loc_5300`, and queues two deferred command
words. Those three latched config cells are the boot handler's lasting output: `loc_401f` is read much
later to arm an advance gate at game start, and `loc_400f` is mirrored into the screen-flip hardware when
a round begins.

### The attract sequence

`GAME_STATE` 1 runs the attract sequence as its own sub-state machine on `SEQUENCE_STATE`. Sub-state 0 is
`initSequenceEnableStarfield` [seen]: it queues two setup command words (a channel-7 and a channel-6
cue), switches the starfield on via `STARS_ENABLE` (0x7004), raises `loc_4007`, and resets the
per-sequence work cells — `CURRENT_PLAYER` (0x400d), `loc_400e`, the mode byte `loc_4006`, and the arm
flag `loc_4019` — before seeding the dwell cascade (`loc_4008` = 96, `loc_4009` = 16) and advancing the
sub-state. From there the prescaled-timer sub-states carry the attract demo forward one screen at a time
on their dwells, with `armStepCountdownAndTickSequenceTimer` and the tick handlers described above doing
the counting.

### The credit transition and game start

`GAME_STATE` 2 is the "press start" screen, handled by `runStartScreenAndLaunchGame` [code]. Each frame
it runs the per-frame formation prep, dispatches on `SEQUENCE_STATE` to one of four start-screen
sub-handlers (object-RAM reset, hold-start-lamps, blank-rows, and the lamp driver), and then — every
frame, regardless of sub-state — tail-runs `beginGameOnStartButton` [code], which is where credits turn
into a game. Credits live in `loc_4002`, topped up elsewhere as coins arrive. `beginGameOnStartButton`
reads the buffered start buttons in `IN1_SHADOW`: bit 0 hands off to `startOnePlayerGame` [code]; bit 1
begins a two-player game but only when at least two credits are in hand, in which case it spends two,
blits the 32-byte ROM row template from `loc_051b` into the saved-state snapshot `SAVED_STATE_SNAPSHOT`
(0x41a0), consults the latched config bit `loc_401f` to optionally arm the state-advance gate, and enters
the round with the two-player spawn word. `startOnePlayerGame` is the one-credit path: with no credit it
just forces `GAME_STATE` back to 1 (drop back to attract); with a credit it spends one, zeroes the
snapshot at `SAVED_STATE_SNAPSHOT`, and enters the round with a null spawn word. Both paths converge on
the shared round-start setup, which sets `GAME_STATE` to 3, clears `SEQUENCE_STATE`, and raises the mode
byte `loc_4006` — so a started game drops into the play handler at its first sub-state.

### Play init and the board-start sub-states

`GAME_STATE` 3 and 4 are the two play handlers, and they share most of their sub-state table. Sub-state 0
is `initPlayfieldState` [code]: it turns both start lamps off (`START_LAMP_0`/`START_LAMP_1`), zero-fills
the flag block at `FLAG_BITS_BASE` (0x4100) and the two object-state spans based at `OBJ_ACTIVE_FLAG`
(0x4200) and `loc_4260`, clears `loc_425f`, sets `loc_4226` to 1, advances `SEQUENCE_STATE`, arms the
dwell tier `loc_4009` to 32, and re-points the fill cursor `VRAM_WRITE_PTR` back at `VRAM_BASE` — a clean
slate for the board about to be drawn.

The board itself is laid out in sub-state 2, which is where the two play handlers diverge.
`restoreFormationAndEnterPlaySubstate` [seen] is the `GAME_STATE`-3 variant: it expands the packed flag
bitmap at `PACKED_FLAG_BITMAP` (0x4180) back into the flag grid, copies the eight template bytes that
follow it into the block at `loc_4218`, clears the status/flip/direction cells (`loc_425f`, `loc_4220`,
`loc_4018`) and the screen-flip latches `FLIP_SCREEN_X`/`FLIP_SCREEN_Y`, advances `SEQUENCE_STATE`, arms
a 150-tick dwell in `loc_4009`, and publishes a deferred-callback pointer (`loc_0640`) into `loc_4245`.
Then, when the sound gate `loc_4006` bit 0 is open, it fires the board-start sound: the paired-player
flag `loc_400e` selects `queueBoardStartSoundBurst` [code] (a channel-5 prologue word plus the standard
burst), otherwise it queues a plain channel-5 word and the same burst directly.
`restoreSavedStateAndEnterPlaySubstate` [code] is the `GAME_STATE`-4 mirror, used on the resume/continue
path: it expands the saved snapshot at `SAVED_STATE_SNAPSHOT` (0x41a0) rather than the fresh bitmap,
copies the same eight-byte template into `loc_4218`, and — crucially for a restored game — mirrors the
latched flip flag `loc_400f` into `loc_4018` and both screen-flip latches when it is set, so a cocktail
cabinet comes back up flipped. It advances the sub-state, arms the same 150-tick dwell, publishes a
different deferred pointer (`loc_0830`) into `loc_4245`, and, when the sound gate is open, queues its
five-word intro burst.

Sub-state 6 is the branch-heavy heart of the play loop, and again there are two mirrored versions.
`stepPlaySubstate6` [code] (`GAME_STATE` 3) keys off the arm gate `loc_421d` and two mode flags, the
advance gate `loc_41b5` and the paired-player flag `loc_400e`. With `loc_421d` open it either advances the
sub-state (when both mode flags are set) or sets the state by mode; with `loc_421d` closed and either flag
clear it runs the shared reset tail; and with the gate closed but both flags set it inlines the advance
itself — bump `SEQUENCE_STATE`, arm a 130-tick dwell in `loc_4009`, and, when the sound bit `loc_4006` is
set, queue two channel-6 words. `stepAltPlaySubstate6` [code] (`GAME_STATE` 4) is the same shape keyed on
the alternate advance gate `loc_4195` instead of `loc_41b5`, arming an 80-tick dwell on its show arm and a
130-tick dwell on its default arm. Both of them fall back to `advanceDwellOrResetToState1` [code], the
shared state-6 tail: when the mode bit `loc_4006` is clear it just advances the sub-state and reloads the
dwell, but when it is set it tears the game down — `GAME_STATE` back to 1, clear `loc_4006` and
`SEQUENCE_STATE`, silence the sound hardware and halt the interrupt/starfield, and queue a channel-6 word
— i.e. the exit from a finished game back to attract.

### The advance gates

Several of the handlers above turn on their "advance" path only when a gate byte reads nonzero, and two
small routines set those gates. `armStateAdvanceGate` [code] stamps the marker 3 into `loc_41b5`, which
`stepPlaySubstate6` tests to take its advance path; `armSubstateAdvanceGate` [seen] stamps the same
marker 3 into `loc_4195`, which `stepAltPlaySubstate6` tests. Both are armed off the same boot-latched
config bit `loc_401f` at game start (the two start paths choose which gate to arm), so a single DIP
setting decides whether a started game jumps straight past a sub-state or dwells through it.

### The behaviour gate and the object activity flag

A separate, faster gate drives the moment-to-moment behaviour of the formation during play, and it is
raised by `armBehaviorGateOnInputOrTimer` [code]. It does nothing unless the object-active flag
`OBJ_ACTIVE_FLAG` (0x4200) bit 0 is set and the gate `loc_4208` is not already armed. On its timer path
(mode bit `loc_4006` clear) it arms `loc_4208` only when the low five bits of the frame counter `loc_425f`
are all zero — roughly once every 32 frames. On its input path (mode bit set) it selects between the two
input shadows via `loc_4018`, tests bit 4 of the chosen line (`IN0_SHADOW`/`IN1_SHADOW`) against its guard
mask (`loc_4013`/`loc_4014`), and when the line is active raises both the gate `loc_4208` and its
companion flag `loc_41cc`. The gate is torn down again by `clearGateOnPendingRequest` [code]: when the
request flag `loc_420b` bit 0 is pending it acknowledges it (clears `loc_420b`) and clears the behaviour
gate `loc_4208` that the formation-sweep code tests.

### The difficulty ramp and the delayed-event one-shot

`rampCounterToCeiling` [code] is a slow difficulty/pace ramp. Gated by the same `OBJ_ACTIVE_FLAG` bit 0
and an inhibit flag `loc_422b` bit 0, it runs a two-tier prescaler (outer `loc_4218` reloading to 60,
inner `loc_4219` reloading to 20) and, on each full double-wrap, steps the 0..7 counter `loc_421a` up by
one and clamps it at 7 — so the value creeps toward its ceiling over a long time and holds there (the
stage-advance code resets it to 0 for a new stage).

The delayed-event mechanism is a three-routine one-shot. `scheduleDelayedEvent` [code] is the armer:
guarded by `OBJ_ACTIVE_FLAG` and `loc_41ef` set with the inhibit `loc_422b` clear, it runs its own
two-tier timer (outer `loc_4245` reload 60, inner `loc_4246`), and on a full cascade elapse arms the
delayed-event triple — with the mode bit `loc_4006` clear it writes fixed values (`DELAYED_EVENT_TIMER`
0x422f = 90, `loc_424a` = 45, `DELAYED_EVENT_ARMED` 0x422e = 1); with it set it derives the payload from
`loc_4221` or from the byte-sums of the word cells `loc_4177` and `loc_421a` and fans it into the triple
by rotation. `fireDelayedEventRequest` [code] is the countdown: while `DELAYED_EVENT_ARMED` is set it
counts `DELAYED_EVENT_TIMER` down each frame, and on the zero tick it disarms itself (a true one-shot) and
— only if `OBJ_ACTIVE_FLAG` and `loc_41ef` are both still set — raises `DELAYED_EVENT_REQUEST` (0x4229)
for the rest of the game to act on. `expireActivityGatedTimer` [code] is a related gated countdown: while
the arm flag `loc_422b` bit 0 is set *and* at least one activity gate is open (`loc_4224` nonzero,
`loc_4221` nonzero, or `loc_4226` bit 0), it ticks the counter `loc_422c` and clears the arm flag once the
counter reaches zero — ending an activity-gated timed phase.

### The command queue

The sound and spawn cues that all of the handlers above post go through a small ring of command words.
`enqueueCommandWord` [seen] appends a 16-bit word at the write-head index in `loc_40a0`: if the target
slot (in the 0x40c0-and-up window addressed as base `loc_4000` plus the head, the head floored at 0xc0) is
free — its high bit set — it stores the two bytes, advances the head by two, re-clamps it to the 0xc0
floor, and commits; otherwise it leaves the queue alone. `commitQueueWriteHead` [seen] is the tail that
persists an advanced head back into `loc_40a0` and returns through the shared stack epilogue
(`loc_090b`, the deliberately unnamed pop-and-return with no side effects). `enqueueCommandWordBurst`
[code] is the common five-word sound burst — two words on the caller's channel, one more on the next
channel, and two fixed cues on channel 7 — and `queueBoardStartSoundBurst` prefixes it with a
channel-5 prologue word for the board-start cue. The queue is where boot's two deferred words, the attract
setup words, the round-start spawn words, and every intro/board-start jingle all land.

### A shared clamp helper

`markValueOutOfRange` [code] is the odd one out here — it is not part of the sequence machinery at all but
a shared arithmetic arm reused by the tile-variant/scroll fold. It is the saturation branch of a value
clamp: when the folded input is out of range it snaps the working register to the fixed sentinel 128 and
returns, so a too-large input collapses to a single well-defined value rather than wrapping.

## The object / formation field: records, motion planning, sweep, occupancy, spawn/launch

Galaxian keeps its aliens in two overlapping worlds at once: a compact *formation grid* of on/off flags that says which cells of the standing swarm are still filled, and a set of full 32-byte *object records* that carry the handful of aliens currently flying, diving, or being drawn as sprites. This section follows how the machine seeds those records, sways the whole formation side to side, decides which cells are occupied, launches attackers out of the swarm, resolves the player's shot against it, and advances to the next stage.

### The interleaved shadow region and the strided per-column table

Two unrelated things share the byte range just below the sprite shadow, interleaved by parity. `seedObjectRamShadowField` [seen] walks a 32-byte source and lays it into every *other* cell starting at the odd address `loc_4021` (0x4021, 0x4023, ... 0x405f), so it fills one stride-2 field of the object-RAM shadow without disturbing the field woven between its cells. `seedObjectShadowFromRom` [seen] is the caller that gives that copier a purpose: it aims the copy at the fixed ROM template `STRIDED_TABLE_SRC` (0x1d71) and runs it, reseeding that shadow field to its at-rest layout whenever a screen or formation is (re)initialised.

Living in the *even* cells of the very same region is a nine-entry table at 0x4028 (0x4028, 0x402a, ... 0x4038) that holds the formation's current horizontal sway, one entry per column. `broadcastToStridedTable` [seen] is the primitive that fills it: it writes one byte into all nine cells. `clearStridedTable` [seen] is simply that primitive invoked with zero, wiping the table on a per-state reset. The sway is normally stored *negated*: `broadcastNegatedSweepToStridedTable` [seen] takes a low byte, forms its two's complement, and broadcasts that, while `broadcastNegatedFormationSweepToStridedTable` [code] is the convenience wrapper that reads the live swept word `loc_420e` and negates-and-broadcasts its low byte. The result is that every column of the swarm carries the same signed offset, refreshed each time the formation nudges.

### The formation sway oscillator

`advanceFormationSweepOscillator` [seen] is the heartbeat of that motion. It walks a 16-bit swept word at `loc_420e` back and forth between a pair of horizontal bounds, throttled so it only steps on one frame in four (it reads the low two bits of the phase cell `loc_425f` and does nothing unless they are zero). Direction is held in `OBJ_SWEEP_DIRECTION` (0x420d): while that flag is clear the word climbs, and when its low byte reaches the near bound (the low byte of `FORMATION_X_BOUNDS`, 0x4210) the routine calls `setSweepDescending` [seen] to set the flag to 1; while the flag is set the word falls, and when it crosses the far bound (the high byte of `FORMATION_X_BOUNDS`) it calls `setSweepAscending` [seen] to clear the flag back to 0 — the sign of the swept word lives in the top bit of its high byte, which is how the descending branch tells it has gone negative. After each real step it broadcasts the new negated low byte across the strided per-column table so the sprites shift with it. A leading proximity gate short-circuits all of that: when the player's shot gate `loc_4208` is armed, the shot's Y (`loc_4209`) sits in a narrow band, the shot's X-delta from the anchor (`loc_420a` minus `loc_420e`) lines up with a swept column, and that column reads occupied in `COLUMN_OCCUPANCY` (0x41f0), the routine skips the step entirely and jumps straight to re-broadcasting the current sway — freezing the swarm's horizontal position for the frame a shot is bearing down on it.

### Occupancy summary and the sweep bounds

`summarizeFormationOccupancy` [seen] is what reduces the raw grid into the compact facts the rest of the system reads, and it runs from the sequence handlers that (re)build a screen. It treats the formation flags as a 6-row by 10-column grid based at `OCCUPANCY_GRID` (0x4123, rows 16 bytes apart) and produces two OR-summaries: a per-row set at `ROW_OCCUPANCY` (0x41e8, behind two always-zero guard cells) and a per-column set at `COLUMN_OCCUPANCY` (0x41f0, behind three guards). From the column summary it derives the horizontal sweep limits: it scans inward from the rightmost column, stepping a from-right value up by 16 per empty column until it meets an occupied one, and inward from the leftmost column, stepping a from-left value down by 16, then packs the from-left/from-right pair into `FORMATION_X_BOUNDS` (0x4210) — so the sway automatically tightens its travel as the outer columns are cleared. Finally it folds four region-"clear" flags, each the bit0 of an OR inverted so that *empty means set*: `loc_4221` from the top four rows, `loc_4220` from the whole grid (this is the master "formation clear" gate the launch and stage logic consult), `loc_4226` from seven object-table slots, and `loc_4225` from eight sprite-source slots.

### Packing the flag grid and the sequence-state handlers that own it

The formation grid is stored two ways: as 128 one-byte-per-cell flags at `FLAG_BITS_BASE` (0x4100), which is easy to index, and as a 16-byte packed bitmap for compact storage. `unpackBitmaskToFlagBytes` [seen] expands a 16-byte mask (LSB first) into those 128 flag bytes and returns its source pointer advanced past the mask, so the caller can pick up the data that follows it; `packFlagBytesToBitmask` [code] is the exact inverse, reading bit0 of each of the 128 bytes back into a 16-byte bitmap and returning the destination advanced by 16 so a block copy can be chained onto it.

Several top-level sequence-state handlers drive the flag grid through screen setup and player hand-off. `loadDescriptorAndAdvanceSequence` [code] unpacks a packed descriptor bitmask from ROM `loc_051b` into the flag block, copies the 8-byte template that trails the mask into the buffer at `loc_4218`, clears `loc_425f`, sets `loc_421d` to 1, advances `SEQUENCE_STATE` (0x400a), stamps the VRAM fill cursor `VRAM_WRITE_PTR` (0x400b) to 150, and publishes the deferred-callback pointer `loc_0640` into `loc_4245`. `clearFlagBlockAndReseedObjectShadow` [code] handles an earlier setup step: it zero-fills all 128 flag bytes, clears the status cells `loc_425f` and `loc_4238`, arms a mid-tier dwell timer (`loc_4009` = 64), then hands off to `advanceSequenceStateAndReseedObjectShadow` [code]. That helper does a small piece of pointer arithmetic — it advances a pointer's low byte within its page and increments the byte that low byte now names — and since both callers arrive pointing at `loc_4009`, the increment lands on `SEQUENCE_STATE` at 0x400a; it then falls through into `seedObjectShadowFromRom` to relay the strided shadow.

Two mirror-image terminal handlers close out a player's turn on a dwell-timer expiry. Both tick `loc_4009` down and do nothing until it reaches zero. `packFlagsToBitmapAndSwitchPlayerState` [code] then clears `SEQUENCE_STATE`, `loc_4222`, and `loc_422b`, packs the flag bytes into `PACKED_FLAG_BITMAP` (0x4180), copies the 8-byte template from `loc_4218` right after the packed bytes, sets `CURRENT_PLAYER` (0x400d) to 1, and moves `GAME_STATE` (0x4005) to 4. `saveFlagsToSnapshotAndSwitchPlayerState` [code] is its twin for the other player: it clears `SEQUENCE_STATE`, sets `CURRENT_PLAYER` to 0 and `GAME_STATE` to 3, snapshots the flag bytes into `SAVED_STATE_SNAPSHOT` (0x41a0), and appends the companion 8-byte block from `loc_4218` — so each player's swarm survives as a packed snapshot while the other plays.

### Placing an object from its grid cell, and the per-object state handlers

Every flying object carries a *packed grid cell* in field +7 of its record: bits 4-6 are its formation row, bits 0-3 its column. `positionObjectFromGridCell` [code] turns that cell into screen coordinates the sprite renderer reads. It writes 0x7c (124) minus three-quarters of the row bits into record+3, and the live formation anchor `loc_420e` plus the column bits times sixteen plus a seven-pixel hotspot into record+4. The display axes are rotated a quarter-turn from the formation grid, so the grid's rows and columns map onto the two screen coordinates rather than lining up with them — the row drives one fixed-origin field and the column rides the swaying anchor.

`initSpawnedObjectFromGridCell` [code] is the first-tick handler (slot 0 of the object-AI state table) for a freshly launched attacker. It clears the step timer (record+23), raises the spawn flag `loc_41c2`, positions the sprite from the grid cell, and queues a spawn command word keyed by that cell. It then indexes the ROM `SPAWN_RECORD_TABLE` (0x1dd1) by the row nibble to fetch the object's sprite number (into record+22) and flight-curve seed (record+24); on the top row it also loads a display-attribute base of 24 and tallies how many of the two following object slots (record+32 and record+64) are active into `ACTIVE_NEIGHBOR_COUNT` (0x422a). Either way it seeds the motion counters (record+16 = 3, record+17 = 12, record+19 = 0), advances the sub-state, and sets a signed heading of +12 or -12 in record+5 from the direction bit in record+6.

`settleObjectIntoFormationCell` [code] (slot 6 of that table) flies an object *back into* its formation cell. It uses record+3 in a dual role: it bumps a frame counter there, lets `positionObjectFromGridCell` overwrite it with the grid-derived target, reads that target back, and stores the incremented counter — so the field counts up frame by frame until it equals the destination value. When the gap reaches zero the object deactivates (record+0 = 0), its formation cell is refilled (`FLAG_BITS_BASE` + record+7 set to 1), and a command word carrying that cell is queued; a small *even* gap nudges the phase field record+5 up or down by the direction bit, while a large (>= 25) or odd gap is left alone.

`reseedFormationObjectState` [code] (slot 5) re-initialises a formation object each pass: it snaps record+3 back to the left edge (8), zeroes the heading (record+5), and ticks a leg counter (record+23). If the packed cell's high bits are *not* all set it takes the ordinary reseed path — and there, only when the object subsystem is enabled (`OBJ_ACTIVE_FLAG` 0x4200 bit0) and one of the activity gates `loc_4224`/`loc_4221` is open, it rolls a fresh random Y via `advanceRandomSeed` into record+4, arms a 40-tick hold timer (record+16), and advances the state an extra step. When the cell's high bits *are* all set it instead recounts the two neighbour slots into `ACTIVE_NEIGHBOR_COUNT`, and once no neighbours remain it deactivates the object and ramps the phase counter `loc_421e` toward a ceiling of 2. Two small helpers serve the object-AI table around it: `noopAnimDispatchSlot` [code] is a do-nothing terminal slot so the object-animation dispatch table (used by `dispatchDeactivatedObjectAnim`) always has a valid target, and `bumpCountIfNeighborsInactive` [code] returns a count incremented by one only when both look-ahead slots (base+32 and base+64) are inactive, feeding the neighbour-aware scoring path in `awardKillScoreByBandAndDeactivate`.

### Pacing and launching attackers out of the swarm

Attackers peel off the formation on a timer. `paceEnemyLaunchTrigger` [code] is a gated prescaler: it runs only while `OBJ_ACTIVE_FLAG` is set and both inhibit flags `loc_4220` and `loc_422b` are clear. It ticks a master counter `loc_424a`, and until that expires it holds the spawn-trigger flag `SUBCOUNTER_REFILL_FLAG` (0x4228) low. On expiry it reloads the master from `SUBCOUNTER_RELOAD_TABLE` (0x15e3) and sweeps a difficulty-scaled span of attacker sub-counters — the span widens with the pace counter `loc_421a` and, once the stage selector `loc_421b` reaches 2, with the stage too — decrementing each and, for any that hit zero, refilling it from its reload-table entry and tallying the refill; if anything refilled it raises `SUBCOUNTER_REFILL_FLAG`.

`launchAttackerFromFormation` [code] consumes that one-shot. It only fires when `SUBCOUNTER_REFILL_FLAG` is set (which it immediately clears) and the master formation-clear gate `loc_4220` is *not* set. It derives a 1-to-4 slot budget by folding the sum of the pace counter `loc_421a` and stage selector `loc_421b`, then claims the first empty slot (both leading bytes zero) scanning downward from `loc_4391` at a 31-byte stride. It stamps the launch direction `loc_4215` into slot+6, and that direction picks which end of `COLUMN_OCCUPANCY` to scan for an occupied column (never the row's final cell, which would abort). A sweep-mode flag `loc_41ef` then selects the grid geometry — four rows from one base offset, or five from another — and the routine walks that column of the `FLAG_BITS_BASE` grid looking for a filled cell. On a hit it clears the formation cell, records the cell's low byte in slot+7, activates the slot (byte0 = 1, phase byte2 = 0), and queues a type-1 spawn command word — one standing alien becomes one new diver.

### The player's shot against the swarm

`flagPlayerShotHitOnFormation` [code] resolves a shot against the standing formation each frame the shot gate `loc_4208` is armed. It rejects shots outside the swarm's vertical span, then bands the shot's Y (`loc_4209`) into a row by repeatedly subtracting the 7-then-5 pixel bands from the top, and bands the shot's X-delta from the anchor (`loc_420a` minus `loc_420e`) into a column, rejecting anything outside the hit window. It packs row and column into a grid index (with a nibble-swap) and looks up `FLAG_BITS_BASE` + index; only if that cell holds a live alien does it clear the cell, queue a type-1 command word carrying the grid index, stamp the hit record (shot-retire flag `loc_420b` = 1, `loc_42b1` = 1, `loc_42b2` = 0, and the shot's position word into `loc_42b3`), and queue a second, type-3 command word whose column code is derived from the grid index — registering the kill and handing its scoring and sound events downstream.

### Arming and running a stage advance

When the swarm empties, the machine advances the stage. `armFormationAdvanceTrigger` [code] is the gated one-shot that requests it: only when both region gates `loc_4220` and `loc_4225` have bit0 set (both regions clear) and the pending word `loc_4222` is not already armed does it write `loc_4222` = 1 with a zeroed countdown byte at `loc_4223`. `advanceStageAndReseedFormation` [code] later consumes that arm: it waits for `loc_4222` bit0 to be set and the countdown at `loc_4223` to tick to zero, then disarms the enable, rebuilds all 128 flag bytes from the packed template at `loc_051b`, resets the pace counter `loc_421a` and phase cell `loc_425f`, reseeds the formation anchor `loc_420e` to 1, and steps the stage selector at `loc_421b` — its high byte counting up freely while its low byte advances but saturates at 7. It queues a command word (via the pointer `loc_0700`) and finally services a pending two-slot request held in `loc_421e`, raising `loc_4177` for the first slot and, if the count had more than one, `loc_4178` for the second.

### The spawn machinery

A family of small routines seeds new object slots from trigger flags. At the bottom, `activateObjectSlotAndEnqueueSpawn` [code] takes a trigger pointer, an object slot, and a spawn code: it consumes the trigger flag (writes 0 at the pointer), marks the slot active (byte0 = 1, phase byte2 = 0), records the spawn code in byte6 and the trigger pointer's low byte as the source index in byte7, and queues a type-1 spawn command word keyed by that index. `activateDescriptorSlot` [seen] is the parallel initialiser for the descriptor slots at `DESCRIPTOR_SLOT_TABLE` (0x4330): reached from the setup path, it reads a descriptor number at the pointer, selects the (number-1)th 32-byte slot, and stamps its fixed init fields — byte0 = 1 (active), byte1 = 0, byte2 = 13, byte4 = 0, byte5 = 12, byte7 = the slot index — leaving bytes 3 and 6 untouched.

`spawnIntoFreeDescriptorSlot` [code] scans the four descriptor slots high-to-low for one whose two guard bytes are both zero and, on a hit, tail-calls the activator to seed it and queue its spawn word. `spawnSecondaryObjectIntoSlot` [code] is the per-slot seeder for the "secondary" objects that trail a primary: it bails if either of the slot's two live flags is already set, otherwise consumes its trigger, marks the slot alive (byte0 = 1, state byte2 = 0), inherits field 6 from the source record, stashes the trigger index in byte7, and queues an activation command word. `spawnSecondaryObjectAndAdvanceWalk` [code] wraps that in a walk step: it seeds the current slot, advances the slot pointer by 32, decrements the budget, and when the budget is spent forces the enclosing loop counter to 1 so the walk ends after that pass.

Above those, `spawnPrimaryAndSecondaryObjects` [code] spawns a primary into `OBJ_TABLE` (0x42d0), then walks three trigger flags backed up 15 bytes from the primary trigger's low byte and, for each set flag, seeds a secondary into the next slot (starting at the table's second record) until a budget of two is spent. `spawnObjectsFromTriggerFlags` [code] scans the whole `PRIMARY_TRIGGER_BLOCK` (0x4176, four flags): the first set flag spawns a primary plus up to two secondaries pulled from the `SECONDARY_TRIGGER_BLOCK` (0x4165) at the matching offset; if no primary flag is set it scans the secondary block instead and, on its first set flag, seeds a free descriptor slot.

`spawnObjectsOnDelayedEvent` [code] is the per-frame dispatcher that decides whether any of this runs. It requires the region-clear flag `loc_4220` to be clear, the object subsystem `OBJ_ACTIVE_FLAG` enabled, and a pending `DELAYED_EVENT_REQUEST` (0x4229) — which it consumes as a one-shot — and it holds off entirely while the `OBJ_TABLE` head word is odd. When it does run, the low bit of the launch direction `loc_4215` routes the work: a set bit runs the full trigger-block spawn through `spawnObjectsFromTriggerFlags`; otherwise it scans the primary trigger block high-to-low for a set flag to run `spawnPrimaryAndSecondaryObjects`, then the secondary window (15 below the primary block) high-to-low to seed a free descriptor slot.

### Sprite staging

`stageObjectsToSpriteShadow` [seen] is the per-frame bridge from object records to hardware sprites: it renders eight consecutive source records from `SPRITE_SOURCE_OBJ_BASE` (0x42b0, 32-byte stride) into eight consecutive four-byte records at `SPRITE_SHADOW_BASE` (0x4060), laying them out as a band of three followed by a band of five. The orientation bit `loc_4018` picks the first band's Y offset (9 when set, 7 when clear); the trailing band settles at 8 either way, so the swarm's two visual tiers hold their vertical relationship regardless of screen flip.

A short unnamed epilogue at loc_090b [code] sits at the tail of the command-word-queue path: it pops the caller's saved register pair and returns, with no effect on work RAM.

## Player ship, projectiles, dive scheduling, object-AI paths, and collisions

This subsystem is the shooting half of the game: the ship the player (or the demo AI) steers along the bottom, the single bullet it fires straight up, the swarm of attackers that peel out of the formation and dive, and the box-tests that decide when bullet meets alien or alien meets ship. Almost everything here is threaded through two shared cells. `loc_4202` holds the controlled ship's horizontal position — the ship handler writes it from the controls, and nearly every attacker reads it back as the point to aim at or dive toward. And every attacker lives in a 32-byte object record addressed through `IX`, whose fields are reused heavily from one behavioral state to the next: a state index at +2, two position bytes at +3 and +4, a signed heading at +5, a direction flag at +6, a kind/seed byte at +7, a sub-pixel/step-delta at +9, a display-attribute base at +0x0f, a cluster of timers at +0x10/+0x11/+0x12, sprite and attribute fields at +0x12/+0x16, and a small integrator block at +0x18..+0x1c that doubles as a stored-target slot. Worth flagging up front: the grounded sprite builder reads +3 as screen X and +4 as screen Y, but the still-[code] movement, targeting, and collision routines don't label that pair consistently among themselves, so those routines are described here by field offset and by which reference cell they measure against rather than by a fixed X/Y claim.

### The player ship

`moveControlledObjectAndStageSprite` [code] is the ship's per-frame handler and the first thing the frame pipeline runs. When the object subsystem is live (bit 0 of `OBJ_ACTIVE_FLAG`, 0x4200), it chooses which byte supplies the movement bits: in demo/attract mode (bit 0 of `loc_4006` clear) it takes the auto command from `OBJ_MOVE_CMD` (0x423f); otherwise it reads a control port, `IN1_SHADOW` (0x4011) when `loc_4018` bit 0 is set, else `IN0_SHADOW` (0x4010). Bit 3 of that byte steps the position in `loc_4202` down by one while it stays at or above 23, and bit 2 steps it up by one while it stays below 233 — that pair of clamps is the ship's left/right travel limit. The position is then one's-complemented and offset by 128, and written together with code byte 6 into four consecutive (value, code) pairs at `OBJ_STAGE_BLOCK` (0x4054). If the primary flag is clear but the secondary flag `loc_4201` is set, it stages the current position unchanged under code 7 — the state the ship sits in while its death animation plays — and if both are clear it parks the position at zero.

The demo command that feeds the ship in attract mode is produced by `computeControlledObjectMoveCommand` [code], which fires only on the one frame in each 32 where `(loc_425f + 9) & 0x1f` is zero, and only while both master enables (`loc_4007` and `OBJ_ACTIVE_FLAG`) have bit 0 set. It sums a positional weight across two object tables — seven records of `OBJ_TABLE` (0x42d0) at stride 32, then seven of `loc_4260` at stride 5 — folds in a scaled offset derived from `loc_420e` + 128 − `loc_4202`, adds a random ±1 nudge, and buckets the biased result into the 0/4/8 selector it stores back into `OBJ_MOVE_CMD`, i.e. hold, drift one way, or drift the other. Each record's contribution is computed by `accumulateObjectPositionWeight` [code]: it ignores inactive objects, requires the record's row byte to sit at 128 or above and land in one of two 52-tall bands, and requires its column delta from `loc_4202` (minus 64) to stay in the lower half; when all that holds it assembles a 0–15 index from a flag bit, two delta bits, and the band, reads a signed step from `OBJ_STEP_TABLE` (0x1a45), and adds it into the running total. So the demo ship literally drifts according to a table-weighted read of where the live attackers are.

### The player's bullet

`advancePlayerShot` [code] services the four-cell shot block. While the gate `loc_4208` has bit 0 set, the shot is airborne: the counter `loc_4209` drains by four each frame, and on exactly the frames it reads 14 through 17 the flag `loc_420b` latches to 1 (the top-of-travel signal). When the gate is clear — no shot in flight — the counter is reset to 220 and the field `loc_420a` is loaded from the ship position `loc_4202` if the subsystem is active, else zeroed, capturing the muzzle X for the next shot. `advancePlayerShotAndStageSprite` [code] runs that service and then turns the block into screen coordinates: it reads the counter into the low byte and the field into the high byte and writes the bullet's hardware cells, `~field` into `loc_409d` and, into `loc_409f`, either `counter − 1` or `~counter + 252` depending on the flip bit in `loc_4018` (the cocktail/orientation choice).

### Drawing an attacker

`renderObjectSprite` [seen] builds one four-byte hardware sprite record from an object record. For a primary-active object it copies the sprite number from +0x16, sets X to +3 − 8 and Y to 255 − (+4) − a caller Y-offset, then folds the signed heading at +5 into a display attribute: it rotates the angle by whole 24-count sectors until it settles into one of four facing ranges, ORs in the facing bits, adds the attribute base at +0x0f, and on the diagonal cases nudges the sprite one pixel in X and/or Y. A secondary-active object (primary clear, +1 set) instead gets fixed sprite number 7 and the record's stored attribute at +0x12 — the explosion look. With both flags clear the sprite is parked off-screen at 248/248.

### The attacker state machine: picking and committing a horizontal target

Attackers advance through a chain of state handlers that first choose where to move horizontally, then walk a path down the screen. `advanceActorPhaseAndCommitMove` [code] bumps the record's phase counter at +3 and then branches on the kind field at +7: kind value 0x60 (masked with 0x70) routes to `commitMoveToStoredOrPlayerTargetX` [code], everything else to `commitMoveAcrossPlayerX` [code]. `commitMoveToStoredOrPlayerTargetX` looks at bit 0 of the first `OBJ_TABLE` record: when set it aims the actor at the object-table's own stored target X (at `OBJ_TABLE` + 0x19), otherwise it falls back to the crossover pick. `commitMoveAcrossPlayerX` is that crossover pick — it takes the signed gap between the actor's +4 byte and the reference `loc_4202`, halves it, and biases by 16 to choose a target on the *far* side of the ship: the 144–208 band when the actor is left of the reference, the 48–112 band when it is at or right of it, so the attacker sweeps across the player rather than toward him. All of these deliver a chosen target X to `commitMoveToTargetX` [seen], which stashes the target at +0x19, stores the signed per-frame step delta (current +4 minus target) at +9, zeroes the three accumulator bytes at +0x1a..+0x1c, and advances the sub-state at +2 so the mover takes over next frame. `commitMoveToStoredOrPlayerTargetX` is also reachable directly for the kind-0x60 actors.

`homeObjectXTowardPlayer` [code] is the continuous-homing alternative: each frame it ticks the frame counter at +3, computes the signed distance from +4 to `loc_4202`, and subtracts roughly four times that distance (carrying a small rounding bias) from the 16-bit position:sub-pixel pair held at +4:+9, so the object accelerates toward the ship's column; when its dwell timer at +0x10 reaches zero it advances the state at +2.

### Arming and restarting a dive

`armDirectedMoveWhenInWindow` [code] is the gate that decides when an attacker is lined up to commit. It ticks +3 and checks whether both +3 and +4 sit inside the [96,160) window; until they do it defers to the shared tail `beginObjectCrossPlayerMove` [code]. Once both are in the window it jumps the sub-state forward by two, seeds the move timers (+0x10 = 3, +0x11 = 12), clears the heading at +5 and the path cursor at +0x13, and sets the direction bit at +6 from whether `loc_4202` is below +4. `beginObjectCrossPlayerMove` runs the crossover target pick and then arms two more fields for the fresh run — the flight-curve step seed at +0x18 = 3 and the throttle at +0x10 = 100. `restartObjectMoveRun` [code] is the entry that kicks an object back into a move: it bumps +3, forces the state at +2 to 8, and hands off to that same tail.

### Walking the path down the screen

Once diving, an attacker walks a table of delta pairs at `PATH_STEP_TABLE` (0x1e00) indexed by its per-object cursor at +0x13. `advanceObjectPathStep` [code] adds the first delta of the pair to +3, then adds or subtracts the second delta to +4 according to the direction bit at +6; if the resulting coordinate (plus a 7-unit margin) wraps below 14 the object has run off the edge and is dropped to state 5. Otherwise it advances the cursor, and on each expiry of the throttle at +0x10 (reloaded to 4) it nudges the cross-step field at +5 by ±1 and ticks the leg counter at +0x11, advancing the state at +2 when a leg completes. `advanceObjectPathStepAlias` [code] is a bare dispatch slot that simply reuses that same handler.

The descending and ascending arms are near-mirrors of each other. `advanceObjectPathStepDescending` [code] subtracts the current table byte from +3, advances the cursor, and — unless the direction bit at +6 is set — subtracts the next byte from +4, then runs the same throttle/leg bookkeeping; when a leg finishes it advances the state, reloads the throttle to 3 and leg to 12, sets the heading at +5 to 0x0c, and resets the cursor. When that direction bit *is* set it hands the Y half to `advanceObjectPathStepAscending` [code], which adds the table byte to +4, steps the heading at +5 upward on each throttle expiry, and on a finished leg advances the state, reloads throttle/leg the same way, but sets the heading to 0xf4 and clears the cursor — the descending arm winds the heading toward +12, the ascending arm toward −12, which is what tips the sprite between diving and climbing when `renderObjectSprite` folds +5.

### The swoop and its curve

`advanceObjectDiveStep` [code] is the state slot that produces the characteristic curved swoop. It steps the progress byte at +3 by one or two (alternating on the parity bit of the frame counter `loc_425f`); if that byte lands in the short [6,9) window it just bumps the state and stops. Otherwise it runs `advanceObjectFlightCurve` [code] and then folds the curve's heading high byte at +0x19 together with the per-object increment at +9 into a new Y at +4 — but if that sum carries across the signed boundary (the swoop has run off the bottom) it bumps the state instead of storing. `advanceObjectFlightCurve` is the little rotation engine underneath: it runs ((+0x18) & 3) + 1 integration steps over the two 16-bit accumulators packed into +0x19..+0x1c, each step adding twice the *other* accumulator's high byte (sign-extended) into this one, with a guard that treats a resulting high byte of exactly 128 as overflow and reverts it — a cross-coupled integrator that traces a rotating (curving) vector.

`settleObjectXAtRest` [code] handles a resting state: it nudges +4 up one count per frame until the wrapped distance from 200 falls inside a 5-wide band, then holds — the object easing into and staying at its formation slot. `initObjectPhaseSteps` [seen] is the per-object phase-entry: from the seed at +7 it derives n = (~seed) & 3, records n+1 as the sprite number at +0x16, writes a derived code byte ((n+1)<<4 + 140) to +3, arms the phase timer at +0x10 to 24, advances the sub-state at +2, and clears the ready flag at +0x0f — then re-arms that flag to 24 only when n is zero.

### The dying-object animation

When an attacker is deactivated it plays a short animation driven by `dispatchDeactivatedObjectAnim` [code], which reads the sub-state at +2 and tail-dispatches to the matching phase handler: sub-state 0 to `armObjectAnimAndRequestSound`, 1 to `tickDeactivatedObjectAnim` [code], 2 to `endObjectAnimOnTimerExpiry` [code], and 3 to a terminal no-op. `tickDeactivatedObjectAnim` counts a fast field at +0x10 down; when it elapses it reloads to 4, steps a companion at +0x12, and counts the slow field at +0x11 down. When the slow field elapses it looks at +7: below 112 it clears the state byte at +1 to retire the object; at or above 112 it reloads the fast field to 50, seeds the companion from the global `loc_422d` plus 32, and advances the sub-state — so an object past that threshold gets an extended animation before it goes. `endObjectAnimOnTimerExpiry` is the plain expiry tick: it counts +0x10 down and, on the frame it reaches zero, clears the state byte at +1 to retire the actor.

### Dive scheduling and formation direction

`chooseNextAttackerDirection` [code] sets the 0/1 sweep-direction flag `loc_4215` from where the formation anchor `loc_420e` (a 16-bit value) sits relative to the sweep bounds `FORMATION_X_BOUNDS` (0x4210): the anchor's sign picks which bound to measure against, and if the anchor is within 28 of that bound the flag is forced away from the edge, otherwise a fresh random draw decides it. `selectAttackerRowScan` [code] chooses which formation row launches next: it scans up to four two-byte slots at `ROW_OCCUPANCY` (0x41e8) for the first byte with bit 0 set, seeding the search at slot 2 / base 157 when `loc_421b` is nonzero and slot 1 / base 132 otherwise, and stores the resulting (slot, base) pair into `loc_4213`.

### Collisions

Two sweeps run back to back each frame. `flagPlayerShotHitsOnObjects` [code] fires only when the shot gate `loc_4208` bit 0 is set, then box-tests the bullet against all seven records of `OBJ_TABLE` (stride 32) via `flagPlayerShotHitOnObject` [code]. That per-object test skips inactive entries and checks whether the record's +3 lands within a 6-wide window of `loc_4209` and its +4 within a 12-tall window of `loc_420a` (the bullet's two position cells); on overlap it raises the shot-retire flag `loc_420b` and tail-calls `awardKillScoreByBandAndDeactivate` to score and deactivate the alien. `flagObjectHitsOnPlayer` [code] mirrors that against the ship: gated on `OBJ_ACTIVE_FLAG` bit 0, it walks the same seven records through `flagObjectHitOnPlayer` [code], which classifies the object's +3 (biased by 33) into a near or a far proximity window and, in either, tests the object's +4 against `loc_4202` within that window's band; a hit raises `HIT_EVENT_FLAG` (0x4204) and again scores/deactivates the object.

`handlePlayerHitEvent` [code] consumes that event later in the same frame. If `HIT_EVENT_FLAG` bit 0 is clear it does nothing; otherwise it clears the flag, resets the object-active pair (`OBJ_ACTIVE_FLAG` to 0 and the secondary `loc_4201` to 1, which is what flips the ship into its death-animation staging), arms the two pulse counters `loc_4205` = 10 and `loc_4206` = 4, queues the hit sound as a command word, decrements the activity countdown `loc_421a` (floored at 0), steps the [0,5] cycle counter `loc_421d` (wrapping back to 5), and — when `loc_4006` bit 0 is set — pulses the sound latch `SOUND_W_REG3` (0x6803).

### Phase setup

Two sequence-table handlers stand the whole thing up. `resetObjectRamAndAdvanceSequence` [code] seeds the interleaved OBJRAM shadow field from the template at `loc_1d91`, zeroes the 64-byte sprite-shadow area at `SPRITE_SHADOW_BASE` (0x4060) and then a full 256-byte page from `loc_4260` plus an 80-byte tail after it, clears `loc_4238` and the message-scroller flag `MESSAGE_SCROLL_ENABLE`, points the VRAM cursor `VRAM_WRITE_PTR` two cells into `VRAM_BASE`, arms the dwell timer `loc_4009` to 16, and bumps `SEQUENCE_STATE`. `activateObjectsAndBeginPlayPhase` [code] then ticks that dwell timer and, when it expires, reloads it to 10, advances `SEQUENCE_STATE`, turns the object subsystem on (`OBJ_ACTIVE_FLAG` word set to 1), centers the ship by writing `loc_4202` = 128, refills the 16-byte sub-counter block at `loc_424a` from `SUBCOUNTER_RELOAD_TABLE` (0x15e3), clears the scratch cells `loc_4058` and `loc_405a`, and queues two command words (0x0703 then 0x0200) to kick off the play-phase sound.

The deliberately-unnamed `loc_090b` — a bare pop-HL/return with no work-RAM effect — is the shared stack epilogue of the command-enqueue path that `handlePlayerHitEvent` and `activateObjectsAndBeginPlayPhase` post their sound cues through.

## Sound

### The output stage and the per-frame driver

Galaxian's audio is driven entirely through a small set of shadow cells in work RAM. Game code stages values into those cells during a frame, and a driver copies them out to the discrete-sound registers and the pitch port at the end of the frame. The most important shadow is SOUND_PITCH (0x41c1), the byte that reaches the pitch port at 0x7800 (SOUND_PITCH_W) once per frame; sitting beside it is a composite cell at 0x41c0 whose byte is copied to sound write register 6 (0x6806) and, rotated right one bit, to register 7 (0x6807).

The heart of this is the per-frame sound driver at 0x16f5. It opens each pass by clearing the 0x41c0 composite to zero and pre-loading SOUND_PITCH with 0xff, so a frame in which no voice speaks latches that idle pitch. It then steps through seven voice and effect updaters in a fixed order — armSoundSequenceOnRequest [seen], updateSoundSweepVoice [code], armSoundSequenceBySelector [code], advanceAllSoundSequenceChannels [code], advancePulseToneEnvelope [code], driveRisingPitchRamp [code], and advanceGatedSquareTone [code] — and only after all seven have written into the shadows does it latch 0x41c0 and SOUND_PITCH to the hardware. Every one of those updaters writes into the shadow cells; the driver is the single point where the shadows reach the ports.

The most primitive way to fill the pitch shadow is stageSoundPitch [seen], which simply parks a byte into SOUND_PITCH and does nothing else. Two thin wrappers build on that idea. stagePitchAndRaiseSoundFlag [code] stores its argument minus one (the subtract wraps modulo 256, so an argument of zero becomes 0xff) into SOUND_PITCH and additionally raises the 0x41c0 composite to 1 — marking the pitch/composite pair as filled for the frame. The other two staging helpers, stageSoundPitchBySelector [code] and stagePitchFromSoundCounter [code], recompute a pitch from the running sound counter and are described with the sweep voice below.

### The sound-sequence player

Three descriptor cells act as the active-flag slots of a small note sequencer: 0x41d2, 0x41cf, and SOUND_SEQ_ACTIVE (0x41cd). A single working set backs them — SOUND_SEQ_PTR (0x41d3) is the 16-bit cursor into the current note table, the current tone byte lives at 0x41d5, and the note's remaining duration counts down in 0x41d6. advanceAllSoundSequenceChannels [code] simply steps each of the three slots once per frame, in the order 0x41d2, then 0x41cf, then SOUND_SEQ_ACTIVE.

The per-slot work is done by advanceSoundSequenceChannel [code]. Given a descriptor whose active byte is zero, it does nothing. For an active slot it publishes the current tone (0x41d5) into SOUND_PITCH and stamps the 0x41c0 composite to 2, then ticks the duration timer at 0x41d6 down one. While the timer still runs there is nothing more to do; when it expires the routine pulls the next command byte from the cursor. A command byte of 0xe0 is the end marker and deactivates the slot. Any other byte is split into two fields: its low five bits index the note-pitch table SOUND_TONE_TABLE (0x17a9) to yield the new current tone, and its high three bits index SOUND_DURATION_TABLE (0x17c8) to yield the new duration timer, after which the cursor advances past the consumed byte.

Sequences are armed from three entry points, each pointing the cursor at a different note table in ROM. armSoundSequenceOnRequest [seen] watches a request cell at 0x41d1: when it holds 1 it consumes it (writes 0), raises the 0x41d2 slot and its duration companion 0x41d6, and publishes the note table at 0x1e68. armSoundSequenceBySelector [code] runs only while the sound-driver enable at 0x4006 has bit 0 set; it reads the sound-request selector at 0x41df, and for the value 6 it arms the 0x41cf slot (unless SOUND_SEQ_ACTIVE is already set, in which case it leaves the playing sequence alone), raising 0x41d6 and publishing the note table at 0x1ebd. For any selector other than 6 it hands off to armSoundSequenceForSelector16 [code], which recognizes only the value 0x16: on a match it clears 0x41cf, raises SOUND_SEQ_ACTIVE and 0x41d6, and publishes the note table at 0x1edf; every other selector is another handler's business and passes through untouched.

### The pulsed tone envelope

advancePulseToneEnvelope [code] and pulseSoundToneFromCountdown [code] together run a two-byte decrementing envelope word whose low byte is at 0x41c7 and high byte at 0x41c8. Each frame advancePulseToneEnvelope looks at bit 0 of the low byte: if it is clear, it hands the high byte to pulseSoundToneFromCountdown; if it is set, it re-arms the word to its sentinel by writing 0 to the low byte and 128 to the high byte. pulseSoundToneFromCountdown idles when the high byte is already zero; otherwise it stores the high byte decremented and stages a two-level pulse through stagePitchAndRaiseSoundFlag — a nonzero shape value of 129 when bit 2 of the decremented byte is set, or 0 when it is clear. Because bit 2 flips every four counts, the staged pitch pulses on and off as the envelope drains, and each staged value raises the 0x41c0 composite.

### The rising pitch ramp

driveRisingPitchRamp [code] and advanceSoundPitchRamp [seen] produce a pitch that climbs by a fixed step. The ramp state is a three-byte block: an arm byte at 0x41c9, a countdown at 0x41ca, and the running pitch at 0x41cb. driveRisingPitchRamp tests the arm byte with a pre-decrement that it does not store — so while the arm byte holds anything but 1 (its usual resting value of 0 included), it advances the ramp one step; only on the pass where the arm byte holds exactly 1 does it reset, clearing the arm byte and reloading the countdown/pitch pair at 0x41ca to a countdown of 32 and a pitch of 0. advanceSoundPitchRamp does the stepping: while the countdown at the cell after its pointer is nonzero it decrements the countdown, adds four to the pitch, stores it back, publishes it to SOUND_PITCH, and clears the 0x41c0 composite to zero; a drained countdown makes it idle.

### The gated square-wave tone

The square-wave voice is a pair of routines fed by the frame flag at 0x4007, whose bit 0 toggles every frame. driveGatedSquareTone [code] is the per-tick emitter: while the duration counter SOUND_TONE_DURATION (0x41ce) is nonzero it counts one off it and writes the frame flag with bit 0 flipped into sound write register 5 (0x6805), which alternates the output frame to frame; once the duration is spent it writes 0 to silence that register. advanceGatedSquareTone [code] wraps it with a phase gate at 0x41cc, again tested with a pre-decrement that is not stored back: while the gate is anything other than 1 it drives driveGatedSquareTone each frame, and on the single frame where the gate holds 1 it instead parks the gate at 0 and re-arms SOUND_TONE_DURATION to 8, restarting the tone's run.

### The sweep / sound-counter voice

The widest voice is a sweep built around a running sound counter at 0x41c4 and a small block that precedes it. updateSoundSweepVoice [code] is its entry, and it runs only when bit 0 of the sound-driver enable 0x4006 is set. It treats 0x41c2 as a frame counter: while that cell holds anything but 1 it hands the block off to the sound-counter manager; on the frame where it holds 1 it reloads the idle template — 0 into 0x41c2, 2 into the sweep cell at 0x41c3, and 160 into the sound counter 0x41c4. That 160 is deliberately parked past the counter's ceiling of 96, so the sweep stops bumping until the counter decays back under the ceiling.

The manager head is advanceSoundSweepAndStagePitch [code]. It returns immediately while bit 0 of the gate at 0x4226 is set; otherwise it steps its pointer forward one cell (from the 0x41c2 frame counter to the 0x41c3 sweep cell). If bit 0 of a second gate at 0x425f is set it hands straight to the pitch-selector dispatcher; failing that it bumps the pointed sweep cell by one, but only while the sound counter 0x41c4 remains below its ceiling of 96, and then falls into the counter tick. That tick, tickSoundCounterAndStagePitch [seen], decrements the sound counter and stores it back whenever it is still nonzero, then in every case hands off to the pitch-selector dispatcher keyed on the current sweep cell.

The dispatcher is stageSoundPitchBySelector [code]. It reads the low two bits of the pointed sweep cell: a nonzero selector routes to stagePitchFromSoundCounter [code], while a zero selector stages a fixed pitch of 96 through stageSoundPitch. stagePitchFromSoundCounter recomputes the pitch from the sound counter: on an even selector it passes the counter value straight through, and on an odd selector it biases the counter by 96 and rotates the biased sum right one bit — with the add's carry rotating back into the top bit — producing a warble. Either way the result is staged into SOUND_PITCH. The net effect is a voice whose pitch tracks the decaying sound counter, warbling on odd sweep-cell values, and whose sweep cell creeps upward until the counter falls under 96.

### Play-pipeline effects and the shared sound-request cell

Three effects are ticked outside the 0x16f5 driver, from the play-pipeline ticker at 0x0661. driveGatedSoundStepSequence [code] runs only while bit 0 of the enable flag at 0x4201 is set; it uses a prescaler at 0x4205 that fires once every ten eligible frames, and on each fire it enqueues a command word built from opcode 2 and the current step at 0x4206, then steps that counter down. When the step counter drains to zero the sequence ends: it clears the enable flag and silences sound write register 3 (0x6803). Its command-word enqueue returns through the shared stack epilogue loc_090b (0x090b), a small pure-stack return path with no work-RAM effect.

driveDecayingSoundSweep [code] fades an effect to silence. It acts only on even frames (bit 0 of the frame flag 0x4007 clear) and only while its countdown is nonzero; on each active frame it emits that countdown rotated right two bits to sound write register 4 (0x6804) and ticks the countdown down one, so the emitted value shrinks toward zero. Its countdown lives in the same cell, 0x41df, that serves as the sound-request selector read by armSoundSequenceBySelector — so a request value posted there both selects a sequence (if it is 6 or 0x16) and, being nonzero, is drained by this decaying sweep. That request is posted by armObjectAnimAndRequestSound [code], the sub-state-0 entry of a deactivated object's animation: it seeds the object's animation timers, advances the object's sub-state so this entry runs once, and writes a position-keyed request into 0x41df — 0x07 when the object's position byte is below 112, 0x17 at or above it.

driveSoundVoicesFromOccupancy [code] is an even-frame "hum" driver keyed to how full the field is. On even frames it sums the 6-by-10 flag grid OCCUPANCY_GRID (0x4123, row stride 16) into an eight-bit tally seeded at 1, then lights that many of the three sound write latches at 0x6800 through 0x6802 — capped at three, and zeroing any latches past the point the tally runs out — and finally raises the near-empty flag at 0x4224 to 1 once the tally has nearly drained (below 2), or clears it to 0 otherwise.

### The LFO level

A separate low-frequency-oscillator level is broadcast across four frequency latches. broadcastSoundLfoLevel [seen] saves a level into SOUND_LFO_LEVEL (0x421f) and then fans it out across the four latches at SOUND_LFO_FREQ (0x6004), rotating the byte right one bit between each write so the four latches receive successively shifted copies. decaySoundLfoLevel [code] is the per-frame decay: only on the tick where the flag at 0x425f reads 0xff, and only while the saved level is nonzero, it drops the level by one and broadcasts the new value. driveSoundLfoLevel [code] is the dispatcher that the vblank handler at 0x0066 calls each frame: with no reset pending (SOUND_LFO_RESET_REQUEST at 0x41d0 is zero) it runs the normal decay; otherwise it consumes the request and slams the full level of 15 across the frequency latches.

### Silencing everything

silenceSoundAndDisableIrqStars [code] is the hardware quiesce used when audio and video must stop together. It sets the four SOUND_LFO_FREQ latches (0x6004 through 0x6007) to 1, clears the eight sound write registers starting at 0x6800, clears the video-interrupt enable IRQ_ENABLE (0x7001) and the starfield enable STARS_ENABLE (0x7004), and finally drives the pitch latch SOUND_PITCH_W (0x7800) fully high — halting the sound, the vblank interrupt, and the starfield in one pass.

## Coins, credits, the HUD, score display, and the message scroller

This subsystem turns coin pulses into banked credits, lights the start buttons, runs the attract/start-screen presentation (its text columns, its animated screen-fill wipe, and its scrolling message), and paints every number the player sees — the two player scores, the high score, the small player-status indicator, and the extra-life bonus markers. Many of these draws are not done inline. An event (a coin, a kill, a state advance) posts a short command word onto a small ring buffer in work RAM — a slot table based at loc_4000 (0x4000) with its write-head cursor in loc_40a0 — and a later pass reads that queue and performs the actual repaint or sound, keyed by a "channel" number the command carries in its high byte. Channel 7 carries credit/HUD-line redraws, channel 6 carries message-column renders, channel 4 carries score-field clears, and channel 3 carries score additions. The routines below are both the producers that post those words and the painters that consume them.

### Coin acceptance and the credit bank

Three routines run back-to-back every frame from the input-service cluster. First `serviceCoinInputs` [seen] reads the coin/credit mechanism. In coinage-config mode 3 (loc_4000 == 3, the free-play/preset setting) it hands straight to `presetCreditCount` [code], which forces the bank to a fixed nine credits (loc_4002 = 9) and clears the coin-phase flag (loc_4001 = 0). Otherwise it folds the two raw input shadows (IN0_SHADOW at 0x4010 with loc_4013), complements them, and masks the result through the two guard cells loc_4015 and loc_4016; if the coin bit (bit 7) survives it calls `addCreditForCoin` [code], and if not, the low two bits each advance the coarse coin-pulse counter loc_4004 once, up to twice.

Next `tickCoinMeterAndAwardCredits` [seen] runs the coin meter as a two-stage timer. While the fine reload cell loc_4003 is nonzero the frame is spent in `pulseCoinCounter` [seen], which drives the hardware coin-counter output (COIN_COUNTER_0_LATCH, 0x6003 — only its bit 0 is wired, fed from bit 3 of the value after a rotate-right by three) and ticks loc_4003 down. When loc_4003 reaches zero and the coarse counter loc_4004 still has pulses banked, it decrements loc_4004, refills loc_4003 to 15, and awards credits per the coinage mode in loc_4000: mode 3 awards nothing, mode 1 takes the two-coins-per-credit path, mode 2 awards two credits, and any other mode awards one.

Then `updateCoinLockoutFromCredits` [code] keeps the coin door in step with the bank: at nine or more credits it releases the mechanism through `clearCoinLockout` [code] (which writes 0 to COIN_LOCKOUT, 0x6002), and below nine it engages the lockout (COIN_LOCKOUT = 1).

The credit-award leaves feed loc_4002 (the credit bank), all sharing the same 99 ceiling. `awardCreditEverySecondCoin` [code] is the two-coins-per-credit path: the first coin of a pair (loc_4001 bit 0 clear) calls `setCoinPhaseFlag` [code] to raise the phase flag, and the second coin clears loc_4001 and advances the bank via `incrementCreditCount` [code]. `incrementCreditCount` steps loc_4002 toward 99 — at the ceiling it does nothing, an overshoot is pinned back to 99 by `clampCreditsToMax` [code], and a normal bump also raises the ready flag loc_41c9 and posts a channel-7 HUD-redraw word. `addCreditForCoin` is the direct one-credit-per-coin path used when the coin bit is seen live: below 99 it bumps loc_4002, raises loc_41c9, and posts the same channel-7 redraw; at the cap it does nothing. That channel-7 request repaints the credit/coin HUD line, where the raw bank byte is rendered as two decimal digits.

`reloadExpiredCounterAndTally` [seen] is a general refill helper rather than a coin-specific one: it copies a reload byte from a source table into an expired counter cell (re-arming it) and returns the refill tally incremented. Its live use is the enemy-launch pacing timer, so it is shared infrastructure that happens to sit alongside the coin counters.

### Start-button lamps and leaving attract mode

`driveStartButtonLamps` [code] mirrors the two start-button lamps to the bank, gated by bit 5 of loc_425f: with that bit clear both lamp latches (START_LAMP_0 at 0x6000, START_LAMP_1 at 0x6001) go dark; otherwise zero credits leaves the lamps as they are, one credit lights lamp 0, and two or more light both.

`advanceGameStateOnCredit` [code] is the hook that pulls the machine out of attract mode: when the bank loc_4002 is nonzero it advances the top-level GAME_STATE (0x4005) and clears the attract sub-state cluster — loc_4007, SEQUENCE_STATE (0x400a), loc_41c2, the sound-sweep countdown loc_41df, and MESSAGE_SCROLL_ENABLE (0x40b0); with zero credits it is a no-op. It runs as the post-step continuation after each attract sub-state handler, so inserting a coin (which fills the bank) is what makes the game move on.

Two handlers make up the start-screen sequence, selected by SEQUENCE_STATE (0x400a). `holdStartLampsThenAdvanceSequence` [code] (step 1) ticks the countdown loc_4019 and, while it stays nonzero, keeps the lamps current via `driveStartButtonLamps`; on its zero-crossing it advances SEQUENCE_STATE and clears the 128-byte flag block at FLAG_BITS_BASE (0x4100). `blankVramRowsThenDriveStartLamps` [code] (step 2) fills two 28-cell blank-tile (tile 16) rows through the VRAM write cursor VRAM_WRITE_PTR (0x400b), skipping a 4-cell gap between them, stores the advanced cursor, and ticks the row tier loc_4009; while rows remain it returns, and on the last row it advances SEQUENCE_STATE, clears the screen-flip latches FLIP_SCREEN_X/FLIP_SCREEN_Y (0x7006/0x7007) and the direction flag loc_4018, posts two command words, and drives the lamps once more. (Step 3 of this sequence is `driveStartButtonLamps` itself.)

`startGameRoundAndClearScores` [code] is the round-start entry. It stores the player-count/spawn word into CURRENT_PLAYER (0x400d), blits the 32-byte ROM row template at loc_051b into PACKED_FLAG_BITMAP (0x4180), arms a sub-state advance gate when loc_401f bit 0 is set, and enters play (GAME_STATE = 3, SEQUENCE_STATE = 0, loc_4006 = 1, loc_41d1 = 1). It then posts a channel-6 start-message word and two channel-4 score-field-clear words — the latter are what wipe the score displays clean for the new game.

### The scrolling message

`renderMessageColumn` [seen] is the message painter, indexed by a byte into MESSAGE_PTR_TABLE (0x235c); each record supplies a destination cell and a text pointer. The top two bits of the index pick the mode. Bit 7 blanks the message, overwriting each character cell up the column with the blank tile (64) to the 63 terminator. Bit 6 sets up a scroll: it records MESSAGE_DEST_PTR (0x40b5) and MESSAGE_TEXT_PTR (0x40b3), computes this column's own cursor cell as loc_4020 + col*2 and stores its address in MESSAGE_CURSOR_PTR (0x40b1), clears the whole 32-cell column to tile 16, seeds the cursor with a packed starting row, and arms MESSAGE_SCROLL_ENABLE (0x40b0). With neither top bit set it simply glyph-draws the string (each tile = character − 48) up the column, one row up per character. 

`advanceMessageScroller` [seen] is the per-frame step, active only while MESSAGE_SCROLL_ENABLE bit 0 is set. It reads the per-column counter through MESSAGE_CURSOR_PTR: while the counter's low three bits are set it just ticks it down (a paced delay between glyphs); at the string terminator it ticks and finishes; otherwise it emits one glyph into the MESSAGE_DEST_PTR cell, advances MESSAGE_TEXT_PTR by one, steps the destination up one row (−32), and ticks. The tick itself is `endMessageScrollOnExpiry` [seen], which decrements the counter and, on the exact zero-crossing, clears MESSAGE_SCROLL_ENABLE to stop the scroller; `endMessageScrollOnExpiryFromDe` [seen] is the identical tail entered with the counter pointer already in DE. So one packed counter both paces the reveal (low bits) and ends it (zero-crossing).

Messages are scheduled from two places. `advanceObjectAndQueueMessageColumn` [seen] is an attract-object step: it bumps the object's tick (record byte +4) and counts down its dwell timer (byte +16), and on expiry posts a channel-6 command carrying that object's payload selector (byte +7, biased by 75) — which reaches `renderMessageColumn` — before advancing the object's state. `emitMessageColumnsThenAdvanceSequence` [seen] is an attract sequence step (SEQUENCE_STATE step 4) that first runs the shared strided-table clear, then works a two-tier dwell (loc_4008 the sub-timer, loc_4009 the mid tier): each sub-timer expiry reloads loc_4008 to 80 and posts a channel-6 render whose index tracks the mid count (mid + 6), and the mid-tier expiry advances SEQUENCE_STATE, reloads both tiers (32 and 4), and clears SPRITE_SOURCE_OBJ_BASE (0x42b0) and the redraw count DRAWN_COLUMN_COUNT (0x4241). `postCreditAndMessageDrawsAndAdvance` [code] is another such step: it posts a channel-7 credit-line redraw and a channel-6 message draw, advances SEQUENCE_STATE, and re-arms the dwell cascade (loc_4008 = 96, loc_4009 = 16).

### Text columns

The fixed on-screen text (settings readouts, labels) is painted by a small family. `drawTextColumn` [code] is the primitive: for a given count it reads a source byte, maps it to a tile by subtracting 0x30 ('0'), stores it, and steps the source forward one byte and the destination by a signed stride — a −32 stride walks up a tilemap column — with a count of zero meaning a full 256 passes. `drawTextColumnFromDescriptor` [code] unpacks a 5-byte descriptor (source word, destination word, count byte) and paints that many characters up a column through `drawTextColumn`. `drawTextColumnByIndex` [code] indexes the ROM descriptor table TEXT_DESCRIPTOR_TABLE (0x1cf6) by a byte (5-byte stride) and paints that descriptor.

`drawInputTextColumnsAndSeedScreenFill` [seen] is the attract/reset initializer. It decodes three two-bit fields off the input/DIP ports — IN1 (0x6800) bits 6–7, IN2_PORT (0x7000) bits 0–1, and IN2 bit 2 — into descriptor indices and paints each as a column, which is how the current cabinet settings are shown. Then, unless IN0 (0x6000) bit 6 is asserted, it seeds the screen-fill state: loc_4006 = 0, loc_401a = 2, the dwell pair loc_4008/loc_4009 = 16/48, and VRAM_WRITE_PTR = VRAM_BASE (0x5000); it clears the four-byte lamp/coin latch block from START_LAMP_0 and silences the sound hardware. Two thin front-ends feed it while scanning inputs: `armInputFlagAndDrawInputColumns` [code] folds the two supplied input bytes and, if their shared bit 4 (start) is set, raises the companion flag loc_41cc before falling through into it, and `requestSound6AndContinueInputScan` [code] first seeds the sound-request selector loc_41df to 6 when either input has bits 2–3 set, then falls through into `armInputFlagAndDrawInputColumns`.

### The animated screen-fill wipe

The attract background is repainted as an animated tile strip that sweeps down the page and repeats. `advanceScreenFillStrip` [code] is the per-frame head: it pets the watchdog (a discarded read of SOUND_PITCH_W, 0x7800), then reads the strip gate loc_4008 — if zero there is no strip to draw so it restarts the outer dwell, and otherwise it loads the live cursor VRAM_WRITE_PTR and draws the first strip half. `drawScreenFillStripFirstHalf` [code] stamps `count` two-tile pairs (tiles 48 and 50) forward from the cursor, two cells per pass (count 0 wrapping to 256 pairs), then falls into `drawScreenFillStripSecondHalf` [code], which stamps a further sixteen pairs (tiles 52 and 54), saves the advanced cursor back to VRAM_WRITE_PTR (0x400b), and ticks the strip dwell loc_4008; on its expiry it restarts the outer dwell. That restart is `restartScreenFillOnDwellExpiry` [seen], which ticks the high tier (the byte just past the pointer, loc_4009) and — if it was already zero or reaches zero on this tick — re-seeds the whole fill via `resetScreenFillState` [seen]. The reset is input-gated (skipped while IN0 bit 6 is asserted): it rewinds VRAM_WRITE_PTR to VRAM_BASE, re-arms the fill length (loc_4008 = 32), and clears the dispatch flag loc_401a and GAME_STATE, so the wipe loops indefinitely.

### Scores and the numeric HUD

Numbers are stored as packed BCD and painted digit-by-digit. `byteToPackedBcd` [code] reduces a binary byte modulo 100 and packs it as two decimal digits (tens in the high nibble, units in the low). `drawBcdDigit` [code] paints one BCD nibble as a digit tile (digits 0–9 are the contiguous tiles 0x90–0x99, so tile = 0x90 + digit) with leading-zero blanking: while the blank budget is nonzero a leading zero is drawn as the blank tile (0x80 + 0x90 wraps to tile 0x10) and consumes one slot, and the first significant digit ends suppression. `drawBcdNumberColumn` [code] paints a three-byte packed-BCD value as six digit tiles up an IX column — walking the source downward from its most-significant byte, high nibble then low, stepping the cursor one row up (−32) per digit — under a four-digit leading-zero budget.

The score fields themselves are selected by a few small helpers. `selectCurrentPlayerScore` [code] returns the active player's three-byte score field (PLAYER1_SCORE_BCD 0x40a2 when CURRENT_PLAYER is 0, else PLAYER2_SCORE_BCD 0x40a5). `drawScoreToSelectedPlayerField` [code] chooses the VRAM digit field by a selector (0 → DIGIT_FIELD_PRIMARY 0x5381, else DIGIT_FIELD_ALT 0x5121) and paints the number column into it. `drawHighScoreDigits` [code] paints six digits into the fixed high-score field at loc_5241. `drawScoreFieldByIndex` [code] repaints one field by index — 0 is player 1's score in the primary field, 1 is player 2's score (drawn only when the two-player-live flag loc_400e is set, which also chooses the alt field), 2 is the high score — and an index of three or more recurses down, repainting every lower field. `clearAndRedrawScoreField` [seen] does the same by index but first zeroes the selected field's three digit bytes plus a per-player bonus companion cell (loc_40ad for player 1, loc_40ae for player 2; the high score simply re-zeroes its own first byte) before repainting; this is what the channel-4 clears posted at round start ultimately reach.

Gameplay feeds all of this through the kill handler. `awardKillScoreByBandAndDeactivate` [code] handles a destroyed enemy: it deactivates the object record (its first three slot bytes become 0, 1, 0) and sizes the award by which of three bands the object's packed field (record byte +7) falls into against the threshold 0x50, each missed band bumping the score-table index and dropping the field by sixteen. It posts a channel-3 score-add request carrying that index; on band-exhaust it also raises the inhibit word loc_422b (0xf001), folds in a neighbour bonus when the active-neighbour count ACTIVE_NEIGHBOR_COUNT (0x422a) is exactly two, and records the result at loc_422d. The channel-3 handler adds the indexed BCD increment into the current player's score and is where the pieces join: it repaints that player's score (`drawScoreToSelectedPlayerField`), compares the running total against the high-score field and — if it now leads — copies it into HIGH_SCORE_BCD (0x40a8) and repaints it via `drawHighScoreDigits`, and when the total crosses the per-player bonus threshold it awards a bonus marker.

### The player-status indicator column

A short column shows which player is currently up. `selectPlayerStatusVram` [code] returns that column's VRAM base (PLAYER1_STATUS_VRAM 0x5340 for player 1, else PLAYER2_STATUS_VRAM 0x50e0). `paintPlayerStatusColumn` [code] paints its three cells — the top from the player code + 1, then the fixed tiles 0x25 and 0x20 — and, only when the flags bit 4 is clear and the mode gate loc_4006 is zero, clears the status flag loc_40ab. `repaintPlayerStatusColumn` [code] drives it for the current player: with flags bit 4 clear it paints the active player's column, and with bit 4 set it blanks that column's three cells (tile 16) and, when the paired-player flag loc_400e is set, also paints the other player's (player ^ 1) column. `repaintPlayerStatusColumnIfSaved` [code] repaints only when the saved status byte loc_40ab is nonzero. `repaintPlayerStatusColumnFromModeGate` [seen] is the per-frame driver: when the mode gate loc_4006 is nonzero it latches that value into loc_40ab and repaints, and when the gate is zero it repaints only if loc_40ab is already set. loc_40ab is thus the latch that holds the indicator on across frames where the mode gate momentarily drops.

### Extra-life bonus markers

`awardBonusMarker` [code] gives the current player an extra-life marker exactly once per threshold crossing. It indexes the per-player guard-flag table loc_40ad by CURRENT_PLAYER (0x400d) — the same companion cells that `clearAndRedrawScoreField` zeroes, so a fresh game or player can earn the bonus again — and, if that slot is already flagged, does nothing. Otherwise it flags the slot, raises the sound-envelope trigger loc_41c7, bumps the marker counter loc_421d, and repaints the row with the new count. `drawMarkerRow` [code] redraws the five-slot marker row at MARKER_ROW_VRAM (0x539e): it paints `markers` marker tiles (tile 102, drawn as 2×2 blocks) growing upward, then blanks the remaining slots until a signed slot counter goes negative; when the object-active flag OBJ_ACTIVE_FLAG (0x4200) is set the displayed count is dropped by one, and if that empties it every slot is blanked instead.

Finally, loc_090b is a deliberately-unnamed pure-stack epilogue (ROM 0x090b–0x090c): it restores HL and returns, serving as the shared exit of one of the command-queue enqueue paths.

## Tile / VRAM drawing primitives and coordinate mapping

The tilemap is a 32-cell-wide grid based at VRAM_BASE (0x5000), and every routine here ultimately reduces to storing tile codes into that grid. Two atoms sit at the bottom of the stack. `stampTilePair` [code] writes a tile code into the destination cell and that code plus one into the very next cell, then walks the pointer forward past the pair (one cell) plus a caller-supplied stride while bumping the working tile code by two; because each store is a single byte, a seed of 0xff lays 0xff then 0x00. `drawDoubleHeightTile` [code] writes the same idea vertically instead: the seed at the destination and the seed-plus-two in the cell one tilemap row (32 cells) below, forming a two-cell-tall glyph.

From those two the block builders grow. `drawTileBlock2x2` [code] lays a 2x2 block from a seed by stamping a pair twice with a stride of 31 — since the pair-stamp already steps one cell past the pair, the net advance is a full 32-cell row, so the top pair (tile, tile+1) lands and the bottom pair (tile+2, tile+3) falls directly beneath it, and DE is left as the caller had it. `drawBottomTilePairRestoreDe` [code] is the shared bottom half of that family: it stamps the second pair and then hands the caller back the DE that was saved before the block began; the downward writer and its upward sibling both funnel out through it. `drawTileBlock2x2Up` [code] is that upward sibling — it stamps with a −33 stride so the pointer climbs one row after each pair, and it steps the second seed back four codes, so a block grown from the pointer occupies the pointer row (tile, tile+1) and the row above it (tile−2, tile−1), reaching upward rather than down; DE is preserved.

A thin layer of fixed-seed entry points hard-wire the decorative glyph family that begins at code 44 (0x2c). `drawFixedTilePairHorizontal` [code] hands seed 44 to the pair-stamp and returns its advanced tile and pointer so a caller loop can chain into the next pair; `drawFixedTilePairVertical` [code] hands the same seed to the double-height writer to paint one two-cell-tall glyph; `drawFixedTileBlock2x2` [code] hands it to the 2x2 builder to lay the four consecutive codes 44..47. The upward marker variant `drawFixedTileBlock2x2Up` [code] uses seed 46 instead and grows its block upward; it is how the marker row wipes its unused slots.

Two adapters let those builders be aimed and indexed. `drawTileBlock2x2AtDe` [code] swaps DE and HL so a destination that arrived in DE becomes the draw target (the old HL is handed back in DE), then lays a 2x2 block there. `drawIndexedTileBlock` [code] treats its argument as an index into the ROM 2x2-block code table TILE_BLOCK_TABLE (0x215b), reads the seed code stored there, and draws that block at the pending DE destination. `drawSelectedTileBlockOrFallback` [code] treats its selector as signed: a non-negative selector indexes the block table through `drawIndexedTileBlock`, while a negative one draws a fixed fallback block seeded with tile 0xa4 at the DE destination.

Coordinate mapping is the bridge from a packed one-byte position to a concrete tilemap cell. `mapPackedCoordToVram` [code] shuffles the coordinate's two nibble fields into an address: the low nibble, rotated right two bits, contributes the page's high address byte (0..3) and the top two bits of the low byte, while the high three-bit field is folded through a rotate, an add-with-carry of itself, a complement and a low-nibble mask to build the rest of the low byte; the final cell address is VRAM_BASE plus that offset. On the way out it leaves three usable results: the cell address, the coordinate's bits 6..5 in the accumulator, and — the one callers actually branch on — the coordinate's bit 4 as the carry.

Layered over that mapper is a small animation helper pair used when a figure's tile should shimmer with the frame timer. `computeTileVariantFromTimer` [code] folds a value into a two-bit variant index: at or above the range limit of 112 it saturates the value to the out-of-range marker 0x80 (via the shared saturate arm), and otherwise it nibble-swaps the free-running frame counter loc_425f, adds the value and an incoming carry, and keeps the low two bits. `computeTileVariantFromValueAndTimer` [code] wraps it for a raw value: values at or above 112 saturate straight to 0x80, otherwise it isolates the value's low nibble, sets a carry when the frame counter's low nibble is the smaller of the two, and folds through the timer helper — so the same figure cycles between four tile variants as the frame counter advances.

Three of these figure drawers are the leading handlers of a small display-list draw table in ROM at 0x203d, chosen per slot by the display-list walker. `drawAnimatedTileFigureAtPackedCoord` [code] is the first: it maps the packed coordinate to its cell, biases that same coordinate into a timer-animated variant, and then — when the coordinate's bit 4 is set — draws a 2x2 block, else a double-height glyph, at that cell. `drawFixedTileFigureAtPackedCoord` [code] is the un-animated counterpart: it maps the coordinate and stamps the fixed 0x2c-family figure there, a 2x2 fixed block when bit 4 is set and a fixed vertical pair otherwise. Both of those block-or-glyph decisions run through `drawTileGlyphOrBlock` [code], the shared dispatch keyed on the carry: carry set swaps DE/HL and stamps a selector-chosen block (through `drawSelectedTileBlockOrFallback`, so a negative selector still yields the 0xa4 fallback), while carry clear reads the glyph's tile code from the double-height code table at loc_2157 and paints a double-height glyph at the incoming HL.

The 4x4 forms are the third display-list handler and its parts. `blankTileBlock4x4` [code] writes the blank code 0x40 into a 4x4 patch of cells anchored at loc_51da (four rows of four, one row-block apart). `blank4x4AndDraw2x2Icon` [code] blanks that patch and then overlays a 2x2 block seeded with tile 96 at loc_51fc. `draw4x4TileForm` [code] selects among these by a form argument: form 0 is the blank-and-overlay, form 1 is a plain blank, and any other form folds (form−2) into the mid bits of a complemented tile code over a fixed 0xc0 base and stamps four 2x2 blocks that tile a contiguous 4x4 cell region — the top-left and top-right corners at loc_51da and loc_51dc, the bottom pair two rows down at loc_521a and loc_521c — with the seed advancing four codes between successive blocks.

A separate primitive draws whole tilemap columns rather than square blocks. `drawTileColumnTriple` [code] copies three source bytes up a single column: each byte lands at the destination, whose low address byte then steps up one row (−32) while the page's high byte stays fixed, and after the three cells the low byte advances by 98 to line up the next column, returning the advanced source and destination so successive columns chain. `blankTileColumns` [code] is the erase form of the same walk, starting at loc_5193: for each of B columns it writes the blank code 16 into three cells stepping up a row each — here as a true 16-bit decrement, so the step can borrow into the high byte — then advances the low byte by 98 to the next column, its count wrapping 0 into a full 256 columns. `redrawTileColumnsPeriodically` [code] drives both on a schedule: it does nothing until DRAWN_COLUMN_COUNT (0x4241) holds at least two, treats that count minus one as the number of columns, and gates on the frame counter loc_425f — phase 0 (low six bits) wipes the columns through the blank walk, phase 32 repaints them, taking the first column from the source-row table TILE_COLUMN_TABLE (0x039a) at the row selected by the counter's top two bits (into loc_5193) and the rest from the continuation stream TILE_COLUMN_TABLE_CONT (0x03a6), and every other phase leaves the columns untouched. That combination gives the columns a periodic wipe-then-redraw flicker keyed to the frame counter, which is a counter that free-runs, not a static base.

Several attract- and play-sequence steps use the fill machinery to sweep the screen a row at a time while advancing a step index. `primeVramFillAndAdvanceStep` [seen] sets one up: it clears the 128-byte flag-bits block at FLAG_BITS_BASE (0x4100) along with the frame counter loc_425f and the status byte loc_4224, points the fill cursor VRAM_WRITE_PTR (0x400b) two cells into the grid at VRAM_BASE+2, arms the page/dwell tier loc_4009 to 32, and increments the sequence step SEQUENCE_STATE (0x400a). `fillVramRowThenResetObjectState` [seen] is the per-frame worker that follows: each tick it paints a 28-cell strip of tile 16 at the cursor and steps the cursor a full 32-cell row on, then ticks loc_4009; while that dwell is still counting it simply returns, and on its expiry it advances the sequence step, re-arms the two-tier dwell (loc_4008=64, loc_4009=4), clears the 48-byte active-object block OBJ_ACTIVE_FLAG (0x4200), zeroes the screen-flip latches FLIP_SCREEN_X (0x7006) and FLIP_SCREEN_Y (0x7007) and the direction flag loc_4018, raises loc_4238, and reseeds the object-shadow field from the ROM template OBJ_SHADOW_RESEED_TEMPLATE (0x1db1). `blankVramRowThenResetSpriteState` [code] is a sibling step tuned for sprite state: it clears the strided table, blanks a 28-cell row of tile 16 at the cursor and steps it one row, ticks loc_4009, and on the dwell's expiry advances the sequence step, wipes the 256-byte object-source block SPRITE_SOURCE_OBJ_BASE (0x42b0) and the 64-byte sprite shadow SPRITE_SHADOW_BASE (0x4060), re-arms the same two-tier dwell, reseeds the object shadow, and queues command word 6 for the display list. `blankScreenRowsThenAdvanceSequence` [code] is the play-state clear used by both play tables: it blanks a full 32-cell row of tile 16 at the cursor, steps the cursor a row, ticks the phase counter loc_4009, and on the last phase advances the sequence state and reseeds the object shadow in one shared step.

Two of the routines here belong to the moving-object render path rather than the tilemap, integrating shot positions and painting them into the sprite shadow. `advanceAndRenderProjectiles` [code] walks the seven object records at loc_4260, each ten bytes wide holding two five-byte sub-slots; the frame counter's low bit picks which sub-slot leads this frame (when it is clear the first sub-slot's sub-position is nudged +2 and the second leads). For each leading sub-slot that is active it advances the sub-position by two and deactivates the slot if that sub-position runs off the end, otherwise integrating the 16-bit position by twice the sign-extended velocity byte and deactivating the slot when the high byte leaves the vertical window; deactivation zeroes the active byte, the sub-position and the position high byte. It then emits each sprite's Y and code into the sprite-shadow staging area at loc_4081 (four bytes per entry), mirrored according to the direction flag loc_4018 — the mirrored path complements and offsets the Y and the code, the un-mirrored path subtracts fixed offsets — with a ±1 code nudge applied to the first three records. The collision side is a pair. `flagProjectileHitOnPlayer` [code] tests one entry: an active entry (low bit of its first byte) is box-tested against the player, reading the player-X reference loc_4202 and choosing a near or far Y band from a caller-supplied delta; on overlap it clears the entry's first byte and raises HIT_EVENT_FLAG (0x4204). `flagProjectileHitsOnPlayer` [code] gates on OBJ_ACTIVE_FLAG (0x4200) bit 0 and then runs all fourteen entries (base loc_4260, five-byte stride) through that per-entry test — and a current subtlety worth stating plainly is that the band delta it passes is always the stride value 5 that the loop happens to leave in the delta register, never whatever a caller might have set.

Finally, a couple of these paths bottom out in tiny stack-only exits shared across the ROM, among them the deliberately-unnamed loc_090b, which does nothing but restore HL and return.

## Open questions

- The per-frame orchestration — the main loop and the top-level state dispatchers (the rst-28 handler and the
  jp(hl) dispatcher that select the sequence, formation, combat, and sound handlers each frame) — is translated
  but not yet idiomatically decompiled, so the way the handlers above are scheduled is inferred from the leaves
  they call, not yet read directly. Those dispatchers are the next spine to lift, and are what most of the
  remaining translated routines are reached through.
- Many handlers stay `[code]` because their state was not reached by the attract + coin/one-player captures (a
  deep formation/dive state, a later board), or because their only side effect lands in VRAM or a hardware latch
  the work-RAM tap cannot see; a deeper poke-cycle / video-visible capture is owed to lift them.
- Many work-RAM cells are still named `loc_<addr>`: their role is understood from the routines that touch them
  (described above) but a descriptive identifier is deferred to the cleanup phase rather than promoted piecemeal.
- A further tier of routines remains translated (not yet decompiled); the map grows to cover them as the spiral
  climbs. A group of leaves-first spine-unblock routines has most recently been lifted into JS — an 8-bit divide
  helper, the sound-driver per-frame tick, an input-port scan, the object-aim/slope-to-octant and slot-claim
  helpers, and two object state-handlers — correct-by-equivalence but still carrying `loc_<addr>` names and
  `[code]` certs pending their own understanding pass, which folds them into the sections above. The object
  dispatchers they feed (the 16-way object state dispatch and its callers) stay translated until their handlers
  are all lifted, at which point the dispatchers become the next spine to absorb.
