# Galaxian — mechanism map

A code-grounded model of how Galaxian plays, derived from the idiomatic and frozen-oracle routine bodies and
confirmed against the real ROM under MAME. This is a **living** document: it is regenerated whole as the
idiomatic decompile spiral climbs. It covers the play-pipeline leaf helpers and the object-figure draw walk; the
born-live spine that drives them — the free-running main loop, the vblank-NMI heartbeat, and the top-level state
dispatchers — is still the frozen oracle, so it is described here from its oracle body and from the leaves it
schedules, not yet as decompiled JS.

**Confidence tags** — never recalled, always grounded or derived: `[seen]` a MAME observation terminates the
chain (a write-tap value trajectory, a confirmed dispatch/consumer); `[code]` a confident reading from the
routine's behaviour with MAME not yet consulted for that specific claim; `[guess]` plausible, unverified. The
tag on each routine/cell here is the one recorded in `idiomatic/names.js`, the single source for every
name/role/tag; this prose cites those names, never contradicts them. Cells still named `loc_<addr>` are roles
read from the code but not yet promoted to a descriptive identifier — their role is described in prose regardless.

## System primitives: RNG, memory fill, table fetch, and the vblank interrupt

Everything the machine does rests on a handful of tiny page-zero routines and one interrupt handler
that runs once per displayed frame. The page-zero routines are the shared verbs — draw a random
number, fill a block of memory, look up a table byte, jump to a state handler — that the rest of the
game reaches for constantly. The interrupt handler is the heartbeat: the code that fires on every
vertical-blank, pushes the frame's graphics to hardware, samples the controls, runs the standing
per-frame services, and hands the frame to whichever game-state handler is currently in charge. This
section describes what one frame of the machine looks like from that vantage.

### The random-number generator

The game's single source of randomness is `advanceRandomSeed` [seen] at ROM 0x003c. It keeps one byte
of state, the seed `RNG_SEED` (0x401e [code]), and advances it with a linear-congruential step:
`seed' = (seed * 5 + 1) & 0xff`. The new seed is written straight back to 0x401e and also handed to the
caller as this draw's random value. There is no separate output stream — the seed *is* the number — so
each call both consumes and reproduces the machine's randomness. Attacker AI, spawn timing, and the
random position nudges elsewhere in the game all pull from this one cell, which is why the whole board's
behaviour is deterministic once 0x401e is pinned. The seed also has a quiet second life in the
object-RAM color pass reached through the alternate frame path (below): that pass reads 0x401e as the
starting value of a stepped color ramp — each successive OBJRAM byte is 0x2f greater than the last,
walked across the whole 256-byte page — so the same byte that seeds the AI also sets where the
sprite-color ramp begins.

### The RST block-fill and table-fetch primitives

Two of the Z80's restart vectors are wired to general-purpose memory helpers.

`fillMemoryBlock` [code] at ROM 0x0010 is the block-fill: given a destination pointer, a fill byte, and
a count, it stores the byte into `count` successive addresses, walking the pointer forward, and stops
when the count runs out. A count of zero is not a no-op — the countdown wraps, so a zero request fills a
full 256 bytes. It leaves the pointer sitting just past the filled region and the count spent at zero.
This is the routine that clears work-RAM spans and blanks stretches of the tile map wherever the game
needs a region wiped in one stroke.

`fetchIndexedTableByte` [code] at ROM 0x0020 is the indexed table read: given a table base pointer and
an 8-bit index, it adds the index to the pointer — carrying properly into the high byte so the lookup
survives a page crossing — and returns the byte found there, leaving the advanced pointer behind for a
caller that wants to keep reading. It is the standard "the n-th entry of this ROM table" verb.

### The RST state-dispatch primitive

The third page-zero primitive is the state dispatcher, the restart vector at ROM 0x0028. It is the
mechanism by which a single index selects and jumps to one of several handlers whose addresses are
listed in a table sitting immediately after the point of call. The dispatcher doubles the index (the
table stores 16-bit addresses, so entries are two bytes apart), takes the table's base, reads the
selected address out of it, and tail-jumps to that handler. Because the target is read from the table
at run time rather than baked into the code, the same dispatcher drives every data-driven state machine
in the game — most importantly the per-frame game-state fork described next.

### One frame: the vblank interrupt

The per-frame handler lives at ROM 0x0066 and runs on every vertical-blank interrupt. It opens by
saving all six register pairs so the interrupted foreground code can be resumed untouched, then clears
the interrupt-enable latch `IRQ_ENABLE` (0x7001 [code]) to acknowledge the interrupt. Re-arming for the
*next* frame is deferred to the very end.

Immediately after the acknowledgement the handler consults a mode flag at 0x401a and forks. When that
flag is zero — the normal case, all through attract and play — the frame takes the main path below.
When it is non-zero the frame is diverted wholesale to the alternate handler at ROM 0x1bcd (described in
its own subsection), and none of the main-path work happens that frame. Both forks eventually converge
on the same exit epilogue, so the fork is a choice of *which* per-frame work to do, not whether to
finish cleanly.

On the main path the handler first performs the graphics hand-off: it block-copies 128 bytes from the
object shadow at 0x4020 up to the sprite/scroll/bullet hardware at 0x5800. The game spends the rest of
its frame composing sprites into the 0x4020 shadow; this one copy is what actually makes them appear, so
it happens at the top of the frame with last frame's fully-composed picture. A read of the watchdog port
at 0x7800 then pets the watchdog, promising the hardware the program is still alive.

Next the handler latches the controls, and it does so with a two-frame history. Before it samples the
fresh ports it shifts the previous frame's readings down a chain of holding cells (0x4013 feeds 0x4015
feeds 0x4016, and the prior raw IN0/IN1 pair at the shadow cells is copied into 0x4013/0x4014), so the
service code downstream can see both this frame's inputs and last frame's and detect edges rather than
mere levels. It then reads the three hardware input ports and stores them into their shadows: IN2 (from
0x7000) into `IN2_SHADOW` (0x4012 [code]), IN1 (from 0x6800) into `IN1_SHADOW` (0x4011 [code]), and IN0
(from 0x6000) into `IN0_SHADOW` (0x4010 [code]). One bit of IN0 is checked on the spot: bit 6 is the
service/test switch, and if it is set the handler abandons the frame and jumps to the cold-reset vector
at 0x0000.

With inputs latched, the handler decrements the frame counter `FRAME_COUNTER` (0x425f [seen]), the
free-running once-per-frame tick whose low nibble paces the object-grid redraw and whose various bits
gate periodic work all over the game.

The handler then runs its fixed roster of six per-frame services, in this order every frame:
`serviceCoinInputs` [seen] (0x18ef), the coin/credit input front-end; `tickCoinMeterAndAwardCredits`
[seen] (0x1931), which pulses the coin meter and grants credits per the coinage setting;
`updateCoinLockoutFromCredits` [code] (0x197c), which engages or releases the coin lockout by the
current credit count; `driveSoundFrame` [code] (0x16f5), the sound driver's per-frame tick;
`driveSoundLfoLevel` [code] (0x1898), which drives the sound LFO level; and `advanceMessageScroller`
[seen] (0x18c0), which steps the scrolling-text effect one glyph up its column. These run regardless of
game state — coins, sound, and the scroller advance whether the machine is attracting, waiting for a
start press, or in play.

Finally the frame is handed to the game-state machine. The handler reads `GAME_STATE` (0x4005 [code])
and dispatches through the state-dispatch primitive against an inline five-entry table, routing the
frame to exactly one top-level handler: state 0 to `fillScreenThenLatchConfigAndAdvanceState` [seen]
(0x00e6), the boot/screen-fill and configuration-latch handler; state 1 to
`runAttractSequenceAndAdvanceOnCredit` [code] (0x0156), the attract/demo loop; state 2 to
`runStartScreenAndLaunchGame` [code] (0x03f2), the post-credit press-start screen; state 3 to
`runPlayerOnePlayFrame` [code] (0x0536), the first player's play frame; and state 4 to
`runPlayerTwoPlayFrame` [code] (0x077b), the second player's play frame. Whichever handler runs, it
returns to the shared exit epilogue `rearmVblankInterruptAndRestoreRegs` [code] (0x00d8), which writes
`IRQ_ENABLE` (0x7001) back to 1 to re-arm the next frame's interrupt, restores the six register pairs
saved at the top, and returns through the interrupted program counter. That re-arm is the single point
that keeps the heartbeat going; if it were skipped the interrupt would never fire again and the machine
would freeze.

### The alternate per-frame path

When the mode flag at 0x401a is non-zero the frame is diverted to the handler at ROM 0x1bcd, used during
the boot self-test and screen-fill phases. It is itself a small one-of-four dispatch keyed on the flag's
value, and it arranges for whichever handler it selects to return to the same exit epilogue at 0x00d8
that the main path uses, so re-arming and register restore still happen. Value 1 routes to
`driveSoundFrameAndScanInput` [code] (0x1c3a), which ticks the sound driver and sweep, pets the
watchdog, and scans IN0 for its arm bits. Value 2 routes to `advanceScreenFillStrip` [code] (0x1d28),
the per-frame tile-strip fill that paints the screen a strip at a time. Value 3 falls through into the
object-RAM color-fill pass (ROM 0x1be3), which takes the object hardware base (0x5800) and the current
random seed at 0x401e as the ramp's starting point, stepping the color +0x2f per cell across the
256-byte OBJRAM page. Any other value is treated as invalid and drops the machine to the
cold-reset vector at 0x0000. So during these boot and screen-clearing phases the frame does a single
focused job — audio, a strip of the fill, or the color pass — in place of the full main-path frame,
while still leaving the interrupt properly re-armed for the next tick.

## The attract / sequence state machine, dwell timers, credit transition, boot config, and playfield init

Everything the machine does across a frame hangs off a single top-level selector, `GAME_STATE` (0x4005)
[code], and, within every non-boot phase, a second selector, `SEQUENCE_STATE` (0x400a) [code]. The
vblank interrupt is the whole heartbeat: each frame it saves the registers, acknowledges the interrupt by
clearing the hardware enable latch (0x7001), copies the OBJRAM shadow at 0x4020 out to the sprite/scroll
hardware at 0x5800, latches this frame's raw input ports into their shadow cells with a one-frame shifted
history, decrements the free-running `FRAME_COUNTER` (0x425f) [seen], runs a fixed cluster of per-frame
services, and only then reads `GAME_STATE` and hands the frame to one of five phase handlers. The five
phases are boot (`fillScreenThenLatchConfigAndAdvanceState` [seen]), attract
(`runAttractSequenceAndAdvanceOnCredit` [code]), press-start (`runStartScreenAndLaunchGame` [code]), and the
two play handlers `runPlayerOnePlayFrame` [code] and `runPlayerTwoPlayFrame` [code]. When the handler
returns, `rearmVblankInterruptAndRestoreRegs` [code] restores the registers and re-arms the interrupt so the
next frame can fire; the machine idles between frames and every frame's work happens inside this interrupt.
A single mode byte, `loc_401a`, diverts the frame to an alternate per-frame service path (the screen-fill
overlay) when it is nonzero, but that path converges on the very same interrupt epilogue, so the re-arm is
shared.

### The dwell-timer cascade and how it advances the sequence

The sequence machine has no separate scheduler — it advances itself by counting down a small stack of
adjacent bytes and letting the carry ripple upward into the state index. Three consecutive cells form the
cascade: `loc_4008` (the fast sub-timer / prescaler), `loc_4009` (the dwell tier), and, immediately above
them, `SEQUENCE_STATE` (0x400a) itself. The shared tick, `tickCascadeCountdown` [seen], decrements the byte
its pointer names; while that byte is still nonzero it does nothing more, but on the frame it reaches zero
it steps to the next byte in the block and increments it. That single rule is the entire mechanism: ticking
`loc_4009` carries into `SEQUENCE_STATE`, so **the sequence advancing to its next sub-state is literally the
carry-out of the dwell timer expiring**. `tickSequenceDwellTimer` [code] ticks `loc_4009` directly each
frame; `tickPrescaledSequenceTimer` [seen] adds a stage below it, decrementing `loc_4008` each frame and,
only when it wraps, reloading it to 60 and passing one tick up into `loc_4009` — a slow dwell whose true
period is sixty frames times the tier count.

Because a handler that advances the state must leave the timer ready for the next one, several small helpers
re-arm the tiers. `reloadSequenceDwellTimer` [code] stamps `loc_4009` back to 80; `advanceSubstateAndReloadDwell`
[code] bumps the state index and then re-arms it; `setSequenceStateByModeAndReloadDwell` [code] jumps the
index to one of two fixed values chosen by the mode flag `loc_4006` before re-arming; and
`advanceSequenceStateAndReseedObjectShadow` [code] performs the same in-place carry (its pointer arrives on
`loc_4009`, so stepping to the next byte bumps `SEQUENCE_STATE`) and then reseeds the object shadow.
`enterSequenceStep1` [code] is the cold hand-in: it forces `SEQUENCE_STATE` to 1 and seeds a very short
dwell (`loc_4008` and `loc_4009` both = 3). A separate one-shot cell, `loc_4019`, gives certain steps a
per-step countdown independent of the cascade: `armStepCountdownAndTickSequenceTimer` [seen] re-arms it to 1
each frame while ticking the prescaled timer, and `holdStartLampsThenAdvanceSequence` [code] counts it down,
holding a step until it crosses zero.

### Boot: fill the screen, then latch the machine config

Power-on enters at the reset vector `loc_0000`: it clears the interrupt-enable latch (so no vblank interrupt
fires during boot) and jumps into the cold-boot wipe at 0x1a55. That wipe blanks all four pages of tile VRAM
(0x5000-0x53ff) with the blank tile, zeroes OBJRAM (0x5800-0x58ff), clears the 0x6000 output latches (start
lamps, coin lockout, coin counter), silences the eight sound registers at 0x6800 and the 0x7000 control
latches (interrupt enable, starfield, the two screen-flip latches), runs a walking-pattern test over work
RAM, and brings the machine up with `GAME_STATE` at 0.

Phase 0 is `fillScreenThenLatchConfigAndAdvanceState` [seen], and it does two jobs across many frames. Every
frame it fills a 32-byte block of the blank tile (value 16) at the VRAM write cursor `VRAM_WRITE_PTR`
(0x400b) [code] and advances that cursor, marching a clean fill across the whole tilemap while the
per-state timer `loc_4008` counts down. On the frame the timer expires it does the one-time machine setup:
it resets the state cluster (`loc_4007` = 1, `loc_4006` = 0, `GAME_STATE` = 1, `SEQUENCE_STATE` = 0) so the
next frame enters attract, and it folds the operator configuration out of the input/DIP shadows into their
working cells — the coinage mode `loc_4000` from the top two bits of `IN1_SHADOW`, the config bit `loc_401f`
from `IN2_SHADOW`, the screen-flip/cabinet bit `loc_400f` from `IN0_SHADOW`, and a coinage-table byte
`loc_40ac` selected from the ROM table `loc_0152` by the low two bits of the `IN2_PORT` (0x7000). It then
unpacks the packed 16-byte flag bitmask `loc_051b` into the 128-byte one-bit-per-cell flag block
`FLAG_BITS_BASE` (0x4100) [code] via `unpackBitmaskToFlagBytes` [seen], seeds the object shadow and the
player-one status glyphs, and appends two deferred command words. From here on the interrupt dispatches to
attract.

### The attract loop and the credit hand-off

`runAttractSequenceAndAdvanceOnCredit` [code] is the attract phase (`GAME_STATE` = 1). Each frame it runs the
per-frame formation prep — `advanceFormationSweepOscillator` [seen] to sway the alien block and
`summarizeFormationOccupancy` [seen] to fold the occupancy grid into its row/column summaries — then reads
`SEQUENCE_STATE` and runs the matching attract sub-state. The attract sequence is a long scripted show of
roughly nineteen steps that walks itself forward on the dwell cascade: `initSequenceEnableStarfield` [seen]
turns the starfield on (`STARS_ENABLE` 0x7004 [code]), resets the per-sequence cells, and seeds the dwell
cascade (`loc_4008` = 96, `loc_4009` = 16); `primeVramFillAndAdvanceStep` [seen], `fillVramRowThenResetObjectState`
[seen], and `blankVramRowThenResetSpriteState` [code] repaint the field a row at a time between beats;
`emitMessageColumnsThenAdvanceSequence` [seen], `queueColumnDrawAndAdvanceSequence` [seen],
`activateDescriptorSlotsThenAdvanceSequence` [seen], and `postCreditAndMessageDrawsAndAdvance` [code] emit
the title and message text as deferred draws; `dwellThenAdvanceSequence` [code] is a pure hold that only
runs the shared subsystem updates and ticks the prescaled timer; and `clearFlagBlockAndReseedObjectShadow`
[code] plus `loadDescriptorAndAdvanceSequence` [code] set up the demo. Notably, the late attract steps reuse
the live play handlers as their own sub-states — `activateObjectsAndBeginPlayPhase` [code],
`runGameplayFrameAndAdvanceOnFieldClear` [code], and `stepPlaySubstate6` [code] appear as attract steps
14-16 — so the demo you watch during attract is the real gameplay pipeline running a canned round; that
sharing is why the attract index runs to ~19 while a play round uses only eight.

After the sub-state, attract tail-runs `advanceGameStateOnCredit` [code], and this is the coin hand-off: if
the credit count `loc_4002` is nonzero it bumps `GAME_STATE` (attract → press-start) and wipes the attract
sub-cluster — `loc_4007`, `SEQUENCE_STATE`, `loc_41c2`, the sound-sweep request `loc_41df`, and
`MESSAGE_SCROLL_ENABLE` (0x40b0) [code] — so the next frame comes up cleanly on the press-start screen. A
zero credit count leaves attract untouched, so the show simply loops until a coin lands.

### Coins and credits

Credits accumulate in the background service cluster the interrupt runs ahead of every dispatch, regardless
of phase. `serviceCoinInputs` [seen] is the front-end: in the special preset mode (config mode 3) it hands
off to `presetCreditCount` [code], which pins the credit count to 9; otherwise it combines the input
shadows, masks them against the coin guard cells, and routes a coin edge either to `addCreditForCoin` [code]
(the direct-credit path) or to the coarse coin-pulse counter `loc_4004`. `tickCoinMeterAndAwardCredits`
[seen] then runs the mechanical coin-meter pulse and, per the coinage mode `loc_4000`, awards credits via
`incrementCreditCount` [code] or the two-coins-per-credit path `awardCreditEverySecondCoin` [code] — the
latter toggling the coin-phase flag through `setCoinPhaseFlag` [code] so the credit only lands on the second
coin, while `pulseCoinCounter` [seen] drives the external counter output. `incrementCreditCount` and
`addCreditForCoin` both raise a ready flag and stop at a ceiling of 99; the small clamp helper
`clampCreditsToMax` [code] exists purely to pin an overshoot back to exactly 99. Finally
`updateCoinLockoutFromCredits` [code] drives the coin-lockout latch `COIN_LOCKOUT` (0x6002) [code] straight
off the credit count, releasing it (via `clearCoinLockout` [code]) once nine credits are banked and engaging
it below that.

### Press-start and launching a round

`runStartScreenAndLaunchGame` [code] is the credit-inserted screen (`GAME_STATE` = 2). It runs the same
formation prep, dispatches on `SEQUENCE_STATE` across four short sub-states — `resetObjectRamAndAdvanceSequence`
[code] to clear the object records and reseed the shadow, `holdStartLampsThenAdvanceSequence` [code] to hold
while its countdown runs, `blankVramRowsThenDriveStartLamps` [code] to wipe two rows, and
`driveStartButtonLamps` [code] to light the buttons — then tail-runs `beginGameOnStartButton` [code] every
frame. The start-button lamps are driven from the credit count and gated on bit 5 of `FRAME_COUNTER`: with
the gate open, one credit lights the one-player lamp and two or more lights both.

`beginGameOnStartButton` is the launch decision. `IN1_SHADOW` bit 0 (the one-player start) hands off to
`startOnePlayerGame` [code]; bit 1 (two-player start) fires only with at least two credits banked, spending
two, copying the 32-byte row template `loc_051b` into `SAVED_STATE_SNAPSHOT` (0x41a0) [code], optionally
arming the state-advance gate when config bit `loc_401f` is set, and entering the round with the two-player
spawn word. `startOnePlayerGame` spends one credit and enters with a null spawn word, but if no credit
remains it forces `GAME_STATE` back to 1, dropping the machine back into attract. Both paths converge on
`startGameRoundAndClearScores` [code], which stores the player/spawn word into `CURRENT_PLAYER` (0x400d) [code]
(a 16-bit store whose high byte becomes the two-player flag), blits the row template into the packed board
buffer `PACKED_FLAG_BITMAP` (0x4180) [code], sets `SEQUENCE_STATE` = 0 and `GAME_STATE` = 3 to enter play,
raises the mode/sound gate `loc_4006` and `loc_41d1`, and queues the opening spawn command words. The next
frame is the first playable frame.

### The play frames and their sub-states

Play runs as two mirror-image phases that hand off to each other so two players can alternate:
`runPlayerOnePlayFrame` [code] at `GAME_STATE` = 3 and `runPlayerTwoPlayFrame` [code] at `GAME_STATE` = 4.
Both run the formation prep and then dispatch on `SEQUENCE_STATE` across eight sub-states that carry a round
from setup through play to hand-off:

- **0 — setup.** `initPlayfieldState` [code] turns off both start lamps, clears the flag block, the object
  records, and the template buffer, zeroes `FRAME_COUNTER`, arms the dwell timer `loc_4009` to 32, rewinds
  the VRAM cursor to `VRAM_BASE` (0x5000), and advances the state.
- **1 — clear.** `blankScreenRowsThenAdvanceSequence` [code] blanks 32 cells per frame at the cursor,
  ticking a phase counter in `loc_4009`; on the last phase it advances the state and reseeds the object
  shadow.
- **2 — restore the board.** This is where the two phases first differ: player one's
  `restoreFormationAndEnterPlaySubstate` [seen] unpacks the board from `PACKED_FLAG_BITMAP`, while player
  two's `restoreSavedStateAndEnterPlaySubstate` [code] unpacks it from `SAVED_STATE_SNAPSHOT`. Either way it
  copies the trailing 8-byte template into the working buffer `loc_4218`, clears the flip and direction
  cells, arms a long dwell (`loc_4009` = 150), publishes a deferred-callback pointer, and — when the sound
  gate `loc_4006` is open — cues the board-start sound.
- **3 — dwell.** `advanceSubstateAfterDwellAndQueue` [code] ticks `loc_4009`; on its zero-cross it reloads
  it to 20, advances the state, and enqueues this step's command word.
- **4 — go live.** `activateObjectsAndBeginPlayPhase` [code] ticks the dwell and, on expiry, reloads it to
  10, advances the state, raises `OBJ_ACTIVE_FLAG` (0x4200) [code] to switch on the object/AI/projectile
  subsystem, seeds the reference X, refills the 16-byte enemy-launch sub-counter block from
  `SUBCOUNTER_RELOAD_TABLE` (0x15e3) [code], and queues two display commands.
- **5 — play.** `runGameplayFrameAndAdvanceOnFieldClear` [code] is the actual per-frame gameplay pipeline.
  It runs the full run of gameplay updates and then — only while the field is quiescent (no active object,
  collision, or sub-slot bits and the stage-advance flag set) — ticks the dwell timer `loc_4009` and, on its
  zero-cross, advances `SEQUENCE_STATE`. So a round leaves the play sub-state precisely when the board has
  been cleared.
- **6 — branch.** `stepPlaySubstate6` [code] (and its player-two twin `stepAltPlaySubstate6` [code]) branch
  on the arm gate `loc_421d` and the mode flags `loc_41b5`/`loc_400e` to either advance the sub-state and
  re-arm the dwell (`loc_4009` = 130), redirect the sequence to a fixed step by mode
  (`setSequenceStateByModeAndReloadDwell`), or drop into the shared tail. That tail,
  `advanceDwellOrResetToState1` [code], is the fork between "carry on" and "game over": with `loc_4006`
  bit 0 clear it advances the sub-state and reloads the dwell, but with it set it resets to state 1 —
  `GAME_STATE` = 1, `SEQUENCE_STATE` and `loc_4006` cleared, sound and starfield/interrupt silenced via
  `silenceSoundAndDisableIrqStars`, and a final command word queued — dropping the machine back to attract.
- **7 — hand off.** The terminal ticks the dwell one last time and, on expiry, packs the live board back
  into storage and switches players. Player one's `packFlagsToBitmapAndSwitchPlayerState` [code] packs the
  flag bytes into `PACKED_FLAG_BITMAP`, sets `CURRENT_PLAYER` = 1, and sets `GAME_STATE` = 4; player two's
  `saveFlagsToSnapshotAndSwitchPlayerState` [code] packs into `SAVED_STATE_SNAPSHOT`, sets `CURRENT_PLAYER`
  = 0, and sets `GAME_STATE` = 3. Each keeps a template copied just after the packed bits. Because the two
  boards are stored in separate buffers, a two-player game ping-pongs between phases 3 and 4 and each player
  resumes exactly the field they left.

### The command queue

Handlers rarely draw or make sound inline; instead they append deferred work to a small ring buffer.
`enqueueCommandWord` [seen] takes a 16-bit word — the high byte a channel selector, the low byte a
parameter — and, if the current head slot is free (marked by bit 7), stores the two bytes, advances the
write head at `loc_40a0`, and clamps it up to its floor of 0xc0, so the queue body lives at 0x40c0-0x40ff;
`commitQueueWriteHead` [seen] persists that advanced head. Through this one path the state handlers defer
everything visible or audible — the credit-count HUD redraw, message columns, score-field clears, spawn
cues, and board-start sounds — as channel/parameter words rather than doing the work in place;
`enqueueCommandWordBurst` [code] pushes a fixed five-word sound cue in one call. A per-frame consumer,
`decodeDisplayListSlotAndDispatch` [seen], drains the ready slots, retires each, and vectors the channel to
its draw handler, which is where the deferred writes actually reach VRAM and the hardware.

### Background timers layered over play

Above whichever phase handler runs, the interrupt keeps a fixed background layer ticking every frame. The
free-running `FRAME_COUNTER` (0x425f) [seen] is decremented once per frame and its low bits pace draw phases
and the start-lamp gate; the coin/credit service described above runs unconditionally; the sound drivers
`driveSoundFrame` [code] and `driveSoundLfoLevel` [code] tick; and `advanceMessageScroller` [seen] steps one
glyph up its VRAM column each frame while `MESSAGE_SCROLL_ENABLE` [code] is set, stopping itself on its own
delay counter. Over gameplay specifically, the play pipeline layers two more timers on top of the sequence
machine's dwell clock. `scheduleDelayedEvent` [code] arms a two-tier delay while the object subsystem is
active and uninhibited; `fireDelayedEventRequest` [code] counts `DELAYED_EVENT_TIMER` (0x422f) [code] down
each frame and, as a one-shot on the zero tick, disarms itself and — only while the object subsystem is
enabled — raises `DELAYED_EVENT_REQUEST` (0x4229) [code]. Alongside it, `expireActivityGatedTimer` [code] is
a countdown that only advances while its arm flag `loc_422b` is set and at least one activity gate
(`loc_4224`, `loc_4221`, or `loc_4226`) is open, disarming when it reaches zero — a timer that pauses
whenever the field goes quiet and so measures active play rather than wall-clock frames. Two more once-per-frame
timers round out the layer. `rampCounterToCeiling` [code] is a slow pace/difficulty ramp: a two-tier prescaler
(outer `loc_4218` reload 60, inner `loc_4219` reload 20) that, while the object subsystem is active and the
inhibit `loc_422b` is clear, steps the 0..7 counter `loc_421a` up by one per double-wrap and clamps it at 7 (a
stage advance resets it to 0). And a behavior-gate pair drives `loc_4208`: `armBehaviorGateOnInputOrTimer` [code]
arms it — on the timer path (`loc_4006` bit0 clear) roughly every 32 frames, when the low five bits of
`FRAME_COUNTER` are zero, and on the input path (bit0 set) when bit 4 of the selected input shadow is active,
also arming the companion `loc_41cc` — while `clearGateOnPendingRequest` [code] is its acknowledger, consuming a
pending request in `loc_420b` bit0 by clearing both it and the gate `loc_4208`.

### The clamp helper

The one small shared arithmetic helper in this cluster is `clampCreditsToMax` [code]: it is the overshoot
arm of the credit ceiling, and its sole job is to force whatever counter cell it is handed back down to
exactly 99. It is reached only when an increment has already carried a count past that ceiling, keeping the
credit count from ever displaying or banking more than two digits.

## The object / formation field: records, motion planning, sweep, occupancy, spawn/launch

Everything that moves on the Galaxian playfield above the player's ship — the block of aliens
hanging in formation, the ones that peel off and dive, and the shots they rain down — is driven
out of one shared pool of object records, projected onto a compact set of grid and summary tables,
and finally rendered into a shadow copy of the sprite hardware. This section follows that field from
its records outward: how a record becomes a sprite, how the formation is seeded and swayed, how the
occupancy of the block is summarised, how attackers are paced and launched out of it, how the
player's shot resolves against it, and how a cleared board is rebuilt one stage harder.

### The object records and the sprite shadow

The objects live in an eight-slot array of 32-byte records based at `SPRITE_SOURCE_OBJ_BASE`
(0x42b0) [code]. `OBJ_TABLE` (0x42d0) [code] names the second slot of that same array and is the
handle the spawn and collision code use as the "primary" object table; the descriptor slots at
`DESCRIPTOR_SLOT_TABLE` (0x4330) [code] sit four records further in. Within a record the fields that
matter across the machine are fixed by the render convention: byte 0 bit0 is the primary active
flag, byte 1 bit0 is the secondary/dying-animation flag, byte 2 is the object-AI state index (0..15),
byte 3 is the sprite X, byte 4 the sprite Y, byte 5 the signed heading, byte 6 the direction bit (and
spawn code), and byte 7 the packed formation grid-cell. Later bytes carry per-object working state —
an attribute base at +15, a move throttle and leg counter around +16/+17, a walk cursor at +19, the
sprite number at +22, and a flight-curve seed and accumulators from +24 onward — and individual
handlers reuse a few of those slots for their own timers.

Every frame `stageObjectsToSpriteShadow` [seen] turns those eight records into eight four-byte
sprite-shadow records at `SPRITE_SHADOW_BASE` (0x4060) [code], laying them down as a band of three
followed by a band of five, each band at a shared vertical offset; the orientation flag `loc_4018`
picks whether the first band sits at offset 9 or 7 while the tail band settles at 8 either way. The
per-record work is `renderObjectSprite` [seen]: for an active object it copies the position (screen X
= object X − 8, screen Y = the one's-complement of object Y minus the band offset) and folds the
signed heading into a display attribute by rotating it in whole 24-count sectors, nudging the sprite a
pixel on the diagonal facings; for a secondary-active object it forces sprite number 7 and a fixed
alternate attribute; and when neither active flag is set it parks the sprite off-screen at (248,248).

Underneath all of that is the object-RAM shadow, a stride-2 interleaved region beginning at 0x4020
that the vblank service pushes wholesale to the sprite/scroll/bullet hardware each frame. Its two
interleaved lanes are seeded and driven separately: the odd lane (0x4021, 0x4023, … 0x405f) holds the
sprite codes and is seeded from ROM, while the even lane (0x4028, 0x402a, … 0x4038) holds the swept
column coordinate and is written live by the formation sway. `moveControlledObjectAndStageSprite`
stages the player object's negated position into the same region's `OBJ_STAGE_BLOCK` (0x4054) [code],
and `advanceAndRenderProjectiles` writes the enemy-shot sprites into the bullet band at 0x4081, just
above the sprite shadow.

### Seeding the object shadow from ROM

The odd (code) lane is filled by `seedObjectRamShadowField` [seen], which copies 32 bytes from a ROM
template into every other cell from 0x4021 upward. `seedObjectShadowFromRom` [seen] is the common
entry that aims it at `STRIDED_TABLE_SRC` (0x1d71) [code]; two sibling templates seed the same lane in
other phases — `loc_1d91` at the start screen and `OBJ_SHADOW_RESEED_TEMPLATE` (0x1db1) [code] in the
attract build-up. The reseed always rides a sequence boundary: `resetObjectRamAndAdvanceSequence` and
`clearFlagBlockAndReseedObjectShadow` (through `advanceSequenceStateAndReseedObjectShadow`), the boot
handler `fillScreenThenLatchConfigAndAdvanceState` [seen], and the attract-strip handlers each reseed
the lane while they zero the sprite shadow, clear the object-record region, and step the sequence
state. So each time the field is about to be rebuilt, the sprite codes are restored from ROM and the
live coordinate lane is left to be repainted by the sway and the object stagers.

### The formation flag block and its occupancy summaries

The standing formation itself is a bitmap of live aliens. `FLAG_BITS_BASE` (0x4100) [code] is a block
of 128 one-byte-per-cell flags, addressed by a packed grid-cell value whose high nibble is the row and
low nibble the column, with bit0 marking a live alien in that cell. The whole block converts to and
from a compact 16-byte bitmap: `unpackBitmaskToFlagBytes` [seen] expands a packed mask (LSB-first)
into the 128 flag bytes, and `packFlagBytesToBitmask` [code] is its exact inverse. Those packed forms
are where a board is stored between turns — `PACKED_FLAG_BITMAP` (0x4180) [code] and
`SAVED_STATE_SNAPSHOT` (0x41a0) [code] hold the two players' boards, packed on a player switch and
unpacked back into the flag block when that player resumes.

Co-resident in the same page is the object/occupancy grid based at `OBJECT_GRID_BASE` (0x4120) [code]:
six rows at a 16-byte stride, whose occupancy lane is `OCCUPANCY_GRID` (0x4123) [code].
`summarizeFormationOccupancy` [seen] reduces that six-row-by-ten-column occupancy view into the
summaries the rest of the field consults. It ORs each row into `ROW_OCCUPANCY` (0x41e8) [code] (behind
two always-empty guard cells) and each column into `COLUMN_OCCUPANCY` (0x41f0) [code] (behind three
guards). From the column ORs it derives the horizontal extent of the block into `FORMATION_X_BOUNDS`
(0x4210) [code]: scanning inward from the right end it starts at 34 and steps 16 per empty column to
form the low-byte bound, and scanning inward from the left it starts at 224 and steps down 16 per
empty column for the high-byte bound. Finally it folds four region-"clear" flags — `loc_4221` from the
top four row summaries and `loc_4220` from all six, `loc_4226` from seven object-table slots and
`loc_4225` from an eight-slot field — each stored as its OR XOR 1, so that bit0 set means "that region
is empty." Those clear flags gate launching, pacing, stage-advance and the shot pipeline downstream.

The same occupancy grid feeds audio: `driveSoundVoicesFromOccupancy` sums it to light a number of
sound latches proportional to how full the block still is, so the marching hum thins as the formation
is cleared.

### From a packed grid-cell to a sprite position

An object's formation slot is stored as the packed cell in record byte 7, and
`positionObjectFromGridCell` [code] turns it into on-screen coordinates using the same field
convention the renderer reads. The display axes are rotated ninety degrees from the formation grid: the
cell's row bits (mask 0x70) set the X field (record+3 = 124 − three-quarters of the row value), and the
cell's column bits (mask 0x0f) set the Y field (record+4 = the formation anchor `loc_420e` + column ×
16 + a 7-pixel hotspot). Because the column term is added to the moving anchor, every alien's Y tracks
the anchor, which is exactly what the sway drives.

### The formation sway

`advanceFormationSweepOscillator` [seen] is the side-to-side march of the whole block. It walks a swept
16-bit word at `loc_420e` — the formation anchor — one unit at a time, throttled to one step in four
frames by the low two bits of `FRAME_COUNTER` (0x425f) [seen]. `OBJ_SWEEP_DIRECTION` (0x420d) [code]
chooses the direction: while ascending the word climbs until its low byte reaches the low bound in
`FORMATION_X_BOUNDS`, at which point `setSweepDescending` [seen] flips the flag; while descending it
falls until it reaches the high bound, where `setSweepAscending` [seen] flips it back. After each step
the negated low byte of the anchor is broadcast across a nine-cell stride-2 table at 0x4028 (the
coordinate lane of the object shadow) by `broadcastNegatedSweepToStridedTable` [seen] over
`broadcastToStridedTable` [seen], so the shift reaches the hardware. A leading proximity gate
short-circuits the whole thing: when the player's shot is armed, lined up within a narrow window on the
column the anchor currently names, and that column reads occupied, it jumps straight to
`broadcastNegatedFormationSweepToStridedTable` — re-publishing the current anchor without stepping —
so the block does not slide the target column out from under an incoming shot on that frame. That same
coordinate lane is wiped at sequence-state transitions by `clearStridedTable` [seen], which broadcasts zero
across the nine cells (0x4028, stride 2) through the same `broadcastToStridedTable` primitive.

### The object-AI driver and its state handlers

Once per frame `driveAllObjectSlots` [code] walks all eight records and hands each to `driveObjectSlot`
[code]. That driver reads the record's flags and state index and routes: a record whose dying-animation
flag (byte 1 bit0) is set goes to `dispatchDeactivatedObjectAnim` [code], which sub-dispatches on byte
2 through the death-animation phases (arm/sound, tick, end-on-expiry, and a terminal no-op); an inactive
slot is skipped; and an active one runs the object-AI handler chosen by its state index (byte 2) from a
sixteen-entry table.

Those sixteen states are the attacker life-cycle. State 0, `initSpawnedObjectFromGridCell` [code], is
the first tick of a freshly launched object: it raises the spawn flag, positions the sprite from its
packed cell, looks up the sprite number and flight-curve seed from `SPAWN_RECORD_TABLE` (0x1dd1) [code]
by row (the top row also tallies its two neighbours into `ACTIVE_NEIGHBOR_COUNT` (0x422a) [code]), seeds
the motion counters, and sets the heading sign from the direction bit. State 1,
`advanceObjectPathStep` [code], walks a per-object cursor through `PATH_STEP_TABLE` (0x1e00) [code],
adding the first of each delta pair to record+3 (the sprite X) then a direction-controlled second
delta to record+4 (the sprite Y), dropping to the fall-away state if that record+4 value crosses the
near edge and otherwise advancing a leg at a time. State 2, `advanceActorPhaseAndCommitMove`
[code], picks the object's next horizontal target — a stored/player target for one kind of object, a
cross-player target for the rest. State 3, `advanceObjectFlightAndFire` [seen], and its homing sibling
state 9, `advanceHomingObjectFlightAndFire` [code], run the swoop: each frame they advance the flight
curve, fold its heading into a new screen Y, and — while the object subsystem is enabled — scan the row
table for the object's counter value and, on a match, fire an aimed shot. State 4,
`advanceObjectDiveStep` [code], steps the diving object down one or two pixels on frame parity and folds
the flight curve into Y until it runs off the bottom. State 5, `reseedFormationObjectState` [code],
re-initialises an object at the left edge and, when the activity gate is open, rolls a fresh random Y to
send it around again — or, when its cell's high bits are all set, recounts neighbours and eventually
deactivates and nudges a phase counter once none remain. State 6, `settleObjectIntoFormationCell`
[code], is how a diver returns home: it repositions from the grid cell each frame and, when its counter
catches the positioned value, deactivates the object, sets that cell's flag in the flag block to 1
(putting the alien back into the standing formation), and enqueues its landing event. The remaining
states cover homing toward the player (state 7), arming a directed move inside a window (state 8),
mirrored/descending path walks (states 10 and 11), a move-run restart (state 12) that ticks a
sub-counter, forces the state back to 8, and re-enters the cross-player move to re-arm the state-8
window, a phase-step init (state 13), a message-column emitter used in attract/bonus (state 14), and a
resting settle (state 15).

The shared motion-planning primitives sit beneath those handlers: `commitMoveAcrossPlayerX` [code] and
`commitMoveToTargetX` [seen] set up a horizontal run toward a chosen X; `advanceObjectFlightCurve`
[code] runs a cross-coupled fixed-point rotation over two accumulators in the record, whose high bytes
become the swoop offset; and `aimObjectAtTarget` [seen] with `computeDirectionOctantFromSlope` [seen]
turns the vector to the player into a heading octant. When a flight handler decides to fire,
`spawnAimedProjectileAtPlayer` [code] claims a free slot in the fourteen-entry projectile table at
0x4260 and seeds it with a player-ward velocity, which `advanceAndRenderProjectiles` then integrates
and renders.

### Pacing and launching attackers out of the formation

The trickle of divers is metered by `paceEnemyLaunchTrigger` [code]. Gated on the object subsystem
being enabled and neither the region-clear nor the inhibit flag set, it ticks a master counter
(`loc_424a`); until that expires it holds the refill flag low. On expiry it reloads the master from
`SUBCOUNTER_RELOAD_TABLE` (0x15e3) [code] and sweeps a span of per-attacker sub-counters — the span
widening with the pace counter and the stage — refilling each that reaches zero and raising
`SUBCOUNTER_REFILL_FLAG` (0x4228) [code] if any refilled. That refill flag is the one-shot trigger the
launcher consumes.

`launchAttackerFromFormation` [code] fires exactly when that flag is up and the region-clear gate is
open. It derives a one-to-four slot budget from the pace counter, then claims the first empty object
slot scanning downward through the record array, and stamps the chosen launch direction (`loc_4215`)
into the slot's direction byte. Direction picks which end of `COLUMN_OCCUPANCY` to scan for an occupied
column and the grid geometry to walk; it then climbs that column of the flag block looking for a filled
cell. On a hit it clears the formation cell, records the cell in the slot, activates the object at state
0, and enqueues its spawn — so an alien literally disappears from the standing block and reappears as a
diving attacker on the same frame. The launch direction is chosen ahead of time by
`chooseNextAttackerDirection` [code]: when the anchor sits within 28 pixels of a bound the direction is
forced away from that edge, otherwise a fresh random bit decides. `selectAttackerRowScan` [code]
similarly scans `ROW_OCCUPANCY` for the first occupied slot and records the (slot, base) pair in
`loc_4213` that the flight-and-fire handlers read to decide which rows may shoot.

### The player's shot against the field

Two collision passes close the loop from the player's shot back onto the field, both gated on the shot
being armed. `flagPlayerShotHitOnFormation` [code] handles the standing block directly in grid space: it bands
the shot's Y into a formation row (a repeating seven-then-five step down from the top) and its
X-distance from the anchor into a column, indexes the flag block by the nibble-swapped (column, row)
value, and — only if that cell holds a live alien — clears the cell, stamps a hit record
(`loc_42b1`/`loc_42b2`/`loc_42b3` plus the shot's position word), and enqueues one command word for the
kill and a second carrying a column-derived scoring code. For the divers, `flagPlayerShotHitsOnObjects`
[code] sweeps the seven object-table records and box-tests each against the shot reference via
`flagPlayerShotHitOnObject` [code]; a hit tail-calls `awardKillScoreByBandAndDeactivate` [code], which
deactivates the object, scores it by which band of its position/type field falls under the 0x50
threshold, and — when `ACTIVE_NEIGHBOR_COUNT` is exactly two — folds in a neighbour bonus recorded at
`loc_422d` before enqueuing the score event.

### Spawning secondary objects and delayed events

Beyond the paced launcher, a delayed-event path spawns extra objects. `scheduleDelayedEvent` [code] is a
gated two-tier timer that, on a cascade elapse, arms the delayed-event triple — `DELAYED_EVENT_TIMER`
(0x422f) [code], a companion counter, and `DELAYED_EVENT_ARMED` (0x422e) [code] — either to fixed values
or, in its mode-set branch, to values derived from work-RAM word sums. `fireDelayedEventRequest` [code]
then counts that timer down while armed and, on the zero tick, disarms and (when the subsystem is
enabled) raises `DELAYED_EVENT_REQUEST` (0x4229) [code]. `spawnObjectsOnDelayedEvent` [code] consumes
that request as a one-shot — gated on the region-clear flag being clear, the subsystem enabled, and the
object-table head word even — and routes by launch direction: one direction runs a full trigger-block
spawn (`spawnObjectsFromTriggerFlags` [code]), the other scans the `PRIMARY_TRIGGER_BLOCK` (0x4176)
[code] high-to-low for a set flag and spawns a primary plus up to two secondaries
(`spawnPrimaryAndSecondaryObjects` [code]), then falls to the secondary window and seeds a free
descriptor slot (`spawnIntoFreeDescriptorSlot` [code]). At the bottom of all these paths,
`activateObjectSlotAndEnqueueSpawn` [code] consumes the trigger flag it was found under, marks the slot
active with a cleared phase, records the spawn code and source index, and enqueues the object's spawn
word; `spawnSecondaryObjectIntoSlot` does the equivalent for a secondary, inheriting its direction from
the primary source record. The freshly activated slot then runs state 0 on its next drive.

### Advancing the stage and rebuilding the formation

When the block is emptied, the field advances to a harder stage. `armFormationAdvanceTrigger` [code] is
a one-shot arm: when both region-clear flags (`loc_4220` and `loc_4225`) show bit0 set and the pending
word `loc_4222` is not already armed, it writes the pending word to 1 with a zeroed countdown.
`advanceStageAndReseedFormation` [code] later consumes that: on the tick where the enable is set and its
countdown reaches zero, it disarms, rebuilds all 128 formation flags from the packed ROM template
`loc_051b` via `unpackBitmaskToFlagBytes`, resets the pace counter and `FRAME_COUNTER` to zero, reseeds
the formation anchor `loc_420e` to 1, and steps the stage selector `loc_421b` (its low byte advancing
but saturating at 7, its high byte counting up without limit). It enqueues a stage command word and
services any pending two-slot request in `loc_421e`, raising `loc_4177` and, while the count remains,
`loc_4178`. The reseeded flag block, the reset anchor, and the stepped stage selector together hand the
next board a fresh full formation whose launch pacing and difficulty are one notch higher.

## Player ship, projectiles, dive scheduling, object-AI paths, and collisions

This is the machinery that turns a screen full of aliens into a fight: the ship the
player steers along the bottom, the single shot it fires straight up, the swarm of
enemy objects that peel off the formation and dive, the aimed bullets those divers
drop, and the box-tests that decide when something has been hit. Almost every cell in
this subsystem is gated by the master switch `OBJ_ACTIVE_FLAG` [code]: its bit 0 is
set the moment play begins and cleared the instant the player is killed, and nearly
every routine below opens with a test of it. When it is clear the whole apparatus is
inert.

### The player ship and the demo-mode autopilot

The ship's horizontal position lives in a single cell, `loc_4202`. That one byte does
double duty: it is where the ship is, and — because every attacker aims at where the
ship is — it is also the target anchor the enemy AI reads. At the start of a life the
play-phase entry parks it at 128 (screen centre).

`moveControlledObjectAndStageSprite` [code] moves it once per frame. When
`OBJ_ACTIVE_FLAG` bit 0 is set it first chooses a source of movement bits: with the
mode flag `loc_4006` bit 0 clear it takes the auto/AI command `OBJ_MOVE_CMD` [code],
otherwise it reads a live controller — the second port `IN1_SHADOW` [code] when the
orientation flag `loc_4018` bit 0 is set, else the first port `IN0_SHADOW` [code]. From
whichever byte it got, bit 3 nudges the position down by one (but never below 22 — 23
is the comparison threshold, not the floor) and bit 2 nudges it up by one (never above the
ceiling of 233), so the ship
tracks smoothly and cannot walk off either edge. The updated position is then folded
into a sprite value — one's-complemented and offset by 128 — and written, together
with a fixed code byte (6), as four identical interleaved `(value, code)` pairs into
`OBJ_STAGE_BLOCK` [code]. When the ship is *not* active the routine still runs: in the
alternate mode signalled by `loc_4201` it stages the current position under code 7
without clamping (the death/animation pose), and otherwise it slams the position to
zero and stages that. The four-pair staging is how the ship's sprite reaches the
display regardless of which branch ran.

The `OBJ_MOVE_CMD` byte that the auto path consumes is the demo-mode brain, produced by
`computeControlledObjectMoveCommand` [code]. This runs only on one frame in
thirty-two — it waits for `FRAME_COUNTER` [seen] (offset by nine) to reach a multiple
of thirty-two — and only while both the demo enable `loc_4007` bit 0 and
`OBJ_ACTIVE_FLAG` bit 0 are set. On that frame it sums a *positional weight* over both
object tables (the seven attacker records at `OBJ_TABLE` [code], stride 32, and the
seven moving-shot records at `loc_4260`, stride 5) by folding each into a running total
through `accumulateObjectPositionWeight`. To that it adds a scaled offset between the
formation anchor `loc_420e` and the ship's own `loc_4202`, halves the result, applies a
random plus-or-minus-one jitter, and buckets the biased value into one of three
commands: the high (negative) bucket becomes 8 (move one way), a value of two or more
becomes 4 (move the other), and everything in between becomes 0 (hold). The effect is a
crude auto-pilot that drifts the demo ship toward wherever the threat density pulls it,
so attract-mode play looks purposeful without any human at the stick.

`accumulateObjectPositionWeight` [code] is the per-object scorer behind that sum, and it
writes nothing — it only returns an updated accumulator. It ignores an inactive object,
and ignores any whose Y is below 128 or beyond two stacked 52-row bands, or whose
horizontal delta from `loc_4202` sits in the upper half of the byte range. For an
object that clears those gates it folds a flag bit, two bits of the horizontal delta,
and the row band into a 0–15 index, reads a signed step from `OBJ_STEP_TABLE` [code],
and adds it to the total — so nearby, lower, threatening objects pull the demo ship
harder than distant ones.

### The player shot

The ship fires one shot at a time, tracked by four adjacent cells. `advancePlayerShot`
[code] is the whole timing engine. A gate byte `loc_4208` marks a shot in flight: while
its bit 0 is set, the shot's position counter `loc_4209` is drained by four every frame
(the bullet climbing the screen), and when that counter lands in the narrow window
14–17 near the top the retire flag `loc_420b` is raised. When the gate is clear — no
shot airborne — the routine resets the counter to 220 (parked at the bottom) and seeds
the shot's field cell `loc_420a` from the ship's X `loc_4202` if the object subsystem is
live, or to zero otherwise, so a freshly fired bullet inherits the ship's column.

`advancePlayerShotAndStageSprite` [code] wraps that: it services the shot, then reads
the `{loc_4209, loc_420a}` pair back as a coordinate and writes the shot's two render
cells `loc_409f` and `loc_409d`. The orientation flag `loc_4018` picks between two
low-byte X formulas (counter minus one, or its complement plus 252) so the bullet draws
correctly whether or not the screen is flipped, and the field byte is complemented into
the code cell.

### Enemy shots: integrating and rendering the moving-object table

The bullets the aliens drop live in the table at `loc_4260`, and the code views the
same memory two ways. `advanceAndRenderProjectiles` [code] treats it as seven ten-byte
records, each holding two five-byte sub-slots; the spawn and collision code treats it as
fourteen flat five-byte entries. Both are correct — fourteen entries paired up.

Each frame `advanceAndRenderProjectiles` picks which sub-slot of a record leads, using
`FRAME_COUNTER` [seen] bit 0 as a phase bit, and bumps the trailing sub-slot's
sub-position by two so the pair alternates. For the leading sub-slot of each of the
seven records, when it is active, it advances the sub-position (which is the on-screen Y
source) by two and deactivates the slot if that runs off the end; otherwise it
sign-extends the velocity byte and integrates the 16-bit position by twice that signed
velocity, deactivating the slot when the high byte leaves the vertical play window.
Deactivating zeros the active, sub-position, and high bytes. Finally it emits the
sprite: the Y comes from the sub-position (mirrored by `loc_4018` bit 0) and the code
from the complemented high byte, with a one-count code nudge on the first three records
so those bullets draw with a slightly different tile. The sprites land in the shadow
starting at `loc_4081`. This routine is what makes enemy shots actually move and appear;
the aiming that *creates* them is described further down.

### The enemy object slots and the per-frame driver

The eight object slots that carry the diving aliens begin at
`SPRITE_SOURCE_OBJ_BASE` [code] (0x42b0) with a 32-byte stride; `OBJ_TABLE` [code]
(0x42d0) names the second of these, the base of the seven records the spawn and
collision code treats as the live attackers. Every frame `driveAllObjectSlots` [code]
walks all eight, handing each in turn to `driveObjectSlot` [code].

`driveObjectSlot` is the object state machine's dispatcher. For one record it checks the
death flag (record+1 bit 0) first: a dying object is handed to the death-animation
dispatcher and nothing else runs. An inactive slot (record+0 bit 0 clear) is skipped.
Otherwise the record's state byte (record+2, 0–15) selects one of sixteen AI handlers
and runs it. The sixteen, in order, are the spawn-init handler, the path
walk, the actor-phase/move committer, the flight-and-fire handler, the dive stepper, the
formation-reseed handler, the settle-into-cell handler, the X-homing handler, the
arm-directed-move-in-window handler, the homing flight-and-fire handler, the descending
path walk, an alias that forwards to the path walk, the move-run restarter, the
phase-step initializer, the queue-a-message-column handler, and the settle-at-rest
handler. An object climbs through these states over its lifetime — spawned, walking a
path, committing horizontal moves, flying a curve, diving, and eventually either dying
or settling back.

### Object birth: pacing, launching, and spawning

New attackers are metered out, not spawned all at once. `paceEnemyLaunchTrigger` [code]
is the pacemaker: gated on `OBJ_ACTIVE_FLAG` and two inhibit flags (`loc_4220` and
`loc_422b` bits 0 clear), it ticks a master counter `loc_424a` and, until that expires,
holds the refill flag `SUBCOUNTER_REFILL_FLAG` [code] clear. On expiry it reloads the
master from `SUBCOUNTER_RELOAD_TABLE` [code] and sweeps a difficulty-scaled span of the
sub-counter block, refilling every one that reached zero (via
`reloadExpiredCounterAndTally`) and raising `SUBCOUNTER_REFILL_FLAG` if any refilled. The
span widens with the pace counter `loc_421a` and the stage `loc_421b`, so attackers
launch faster as the round wears on.

`launchAttackerFromFormation` [code] consumes that one-shot flag. If the refill flag is
set (and it clears it immediately) and the region-clear gate `loc_4220` is open, it
derives a slot budget of one to four from the pace counter, scans the attacker slot
table down from `loc_4391` (stride 31) for the first completely empty slot, and stamps
the launch direction `loc_4215` into it. It then finds an occupied formation column by
scanning `COLUMN_OCCUPANCY` [code] from one end or the other according to that
direction, walks that column of the formation flag grid `FLAG_BITS_BASE` [code] looking
for a filled cell, clears the cell (the alien is now leaving the formation), activates
the slot at state 0, and enqueues its spawn command. The grid geometry — four or five
rows, and the column step — depends on the sweep-mode flag `loc_41ef`. This is the
routine that literally pulls one alien out of the standing wall and sends it diving.

Which direction a launch takes is decided by `chooseNextAttackerDirection` [code]. It
reads the 16-bit formation anchor `loc_420e`; the anchor's sign picks which of the two
sweep bounds in `FORMATION_X_BOUNDS` [code] to measure against. When the anchor sits
within 28 pixels of that bound the flag is forced away from the edge (so attackers do
not launch into a wall), and otherwise a fresh random bit chooses. The result in
`loc_4215` seeds each new attacker's direction field and steers the launch column scan.

A second, delayed spawn path runs off a timer. `scheduleDelayedEvent` [code], guarded by
`OBJ_ACTIVE_FLAG`, `loc_41ef`, and `loc_422b`, runs a two-tier countdown (`loc_4245`
outer, `loc_4246` inner). With the mode flag `loc_4006` clear a full cascade elapse arms
the fixed delayed-event triple — `DELAYED_EVENT_TIMER` [code] to 90, `loc_424a` to 45,
`DELAYED_EVENT_ARMED` [code] to 1; with it set the routine instead derives the payload
from `loc_4221` or from the byte-sums of `loc_4177` and `loc_421a` and fans it into the
triple by rotation. `fireDelayedEventRequest` [code] then counts `DELAYED_EVENT_TIMER`
down while armed and, on the zero tick, disarms (one-shot) and — only if both enables
hold — raises `DELAYED_EVENT_REQUEST` [code].

That request is picked up by `spawnObjectsOnDelayedEvent` [code], which is gated on the
region-clear flag being clear, the subsystem enabled, and the request pending (which it
consumes), and only fires while the object-table head word is even. The launch direction
`loc_4215` bit 0 then routes it: set means a full trigger-block spawn via
`spawnObjectsFromTriggerFlags`, clear means it scans the primary trigger block
`PRIMARY_TRIGGER_BLOCK` [code] high-to-low for a set flag (spawning a primary plus its
secondaries) and, failing that, scans a secondary window to seed a free descriptor slot.

The actual slot-seeding is a small family of helpers.
`activateObjectSlotAndEnqueueSpawn` [code] is the common core: it consumes the trigger
flag it was found under, marks the object active with a cleared phase, records the spawn
code and the trigger's low byte as a source index, and enqueues a type-1 spawn command
keyed by that index. `spawnPrimaryAndSecondaryObjects` [code] uses it to spawn a primary
into `OBJ_TABLE`, then walks three trigger flags backed up from the primary and, for each
set flag within a budget of two, spawns a secondary into the next slot via
`spawnSecondaryObjectIntoSlot` [code] — which refuses a slot if either of its two live
flags is already set, and otherwise marks it alive, inherits field 6 from the source, stashes the
trigger index, and enqueues an activation word. `spawnSecondaryObjectAndAdvanceWalk`
[code] is the per-step form of that walk, advancing the slot pointer and forcing the
enclosing loop to end when its budget is spent. `spawnObjectsFromTriggerFlags` [code]
scans the primary trigger block (four flags): the first set flag spawns a primary plus up
to two secondaries from the secondary block `SECONDARY_TRIGGER_BLOCK` [code]; if no
primary flag is set it scans the secondary block and, on the first hit, seeds a free
descriptor slot. `spawnIntoFreeDescriptorSlot` [code] is the shared free-slot finder,
scanning the four descriptor slots in `DESCRIPTOR_SLOT_TABLE` [code] high-to-low for one
whose two guard bytes are both zero and seeding it.

Once a slot is claimed and reaches state 0, `initSpawnedObjectFromGridCell` [code] does
the first-tick setup: it clears the step timer, raises the spawn flag `loc_41c2`, derives
the sprite position from the packed grid cell (via `positionObjectFromGridCell`), enqueues
a type-1 spawn command, and looks up the object's sprite number and flight-curve seed from
`SPAWN_RECORD_TABLE` [code] indexed by the cell's row. For a top-row object it also tallies
how many of its two neighbour slots are still active into `ACTIVE_NEIGHBOR_COUNT` [code]
(this feeds the kill-bonus later). It then seeds the motion counters, advances the
sub-state, and sets the signed heading from the direction bit (−12 or +12).

`positionObjectFromGridCell` [code] is the shared unpacker: the display axes are rotated
ninety degrees from the formation grid, so the *row* bits of the packed cell drive the X
field (an origin of 124 minus three-quarters of the row) and the *column* bits drive the
Y field (the moving formation anchor `loc_420e` plus the column times sixteen, offset by
a seven-pixel sprite hotspot). Both this and `renderObjectSprite` read record+3 as X and
record+4 as Y, so the two agree on where the object sits.

### Object-AI motion: paths, dives, flight curves, homing, and settling

Once alive, an object works its way through the motion states. The **path walk**
(`advanceObjectPathStep` [code], state 1) reads pairs of deltas from
`PATH_STEP_TABLE` [code] through a per-object cursor: the first byte steps Y, the second
steps X in the direction the object's direction bit chooses. If X (plus a seven-pixel
margin) crosses the near screen edge the object is thrown into the fall-away state (5).
Otherwise it advances the cursor, ticks a throttle (reload 4) and, on throttle expiry,
nudges the cross-step field and ticks a leg counter, advancing to the next state when the
leg finishes. `advanceObjectPathStepDescending` [code] (state 10) is the mirror that
*subtracts* the deltas, handing the Y half to `advanceObjectPathStepAscending` [code]
when the direction bit is set; the ascending arm adds the step-table byte to Y, steps the
heading up, and on a finished leg reloads the next leg's throttle, counter, heading, and
cursor. `advanceObjectPathStepAlias` [code] (state 11) is a bare trampoline that forwards
to the ordinary path walk for whichever object is current — it holds no state of its own.

The **flight curve** is the swoop. `advanceObjectFlightCurve` [code] runs
`((seed & 3) + 1)` steps of a cross-coupled fixed-point rotation over two 16-bit
accumulators held in the record: each step adds twice the *other* accumulator's
sign-extended high byte into this one, with a guard that reverts any step whose high byte
lands exactly on 128 (the overflow boundary). The accumulator high bytes are the heading
the flight and dive handlers fold into screen Y, so the object traces the characteristic
curving dive of Galaxian rather than a straight line.

`advanceObjectFlightAndFire` [seen] (state 3) is the workhorse of a diving attacker.
Each frame it bumps the object's counter (record+3), runs the flight curve, and computes
a new screen Y (record+4) as the per-object increment (record+9) plus the curve heading
(record+0x19). If that Y is too high on screen it advances the state by two; if the
counter has run out it advances the state by one. Otherwise, gated by `OBJ_ACTIVE_FLAG`,
it aims at the ship (via `aimObjectAtTarget`) and — unless the inhibit flag `loc_422b` is
set — scans the row table `loc_4213` for its counter value, firing an aimed shot on a
match. `advanceObjectDiveStep` [code] (state 4) is the plunge: it steps the position
(record+3) by one or two depending on `FRAME_COUNTER` bit 0, and while that position sits
inside a small `[6, 9)` window it just bumps the state; outside the window it runs the
flight curve and folds heading plus increment into a new Y, bumping the state instead
when the swoop's carry crosses the signed boundary (meaning it ran off the bottom).

`advanceHomingObjectFlightAndFire` [code] (state 9) is the tracking variant. Before the
shared body it optionally homes the object's column (record+9) toward the ship's column
`loc_4202`, keyed on a mode byte (record+0x17): mode 4 homes only on odd frame parity,
modes above 4 always home, modes below 4 never. Its Y is the homed column plus the curve
heading; a too-high Y sends it to state 5, a wrapped counter to state 4, and otherwise a
move-throttle countdown steps the state back on expiry. Like the plain flight handler, when
none of those fire it aims and, if the inhibit flag is clear and a row matches, fires.

`homeObjectXTowardPlayer` [code] (state 7) steers the object's 16-bit X:subpixel pair
toward `loc_4202` by roughly four times the signed distance each frame, carrying the
hardware's rounding bias, and advances to the next state when a dwell timer drains.
`settleObjectXAtRest` [seen] (state 15) is the opposite — it nudges one field up one
count per frame until it lands within five of the rest value 200, then holds, which is
how an object comes to a stop and stays put.

`reseedFormationObjectState` [code] (state 5) is the return-to-formation / recycle
handler. It re-inits the record's X to 8 and heading to 0 and ticks the leg counter, then
branches on the packed cell's high bits: for an ordinary cell it rolls a fresh random Y
(when the subsystem is enabled and an activity gate is open) and advances the state; for
the special all-bits-set cell it recounts active neighbours and reseeds while any remain,
and once none are left it deactivates the object and ramps the phase counter `loc_421e`
toward a ceiling of two. `settleObjectIntoFormationCell` [code] (state 6) repositions the
sprite from its grid cell every frame and, when a frame counter catches up to the
positioned value, deactivates the object, flags its formation cell in `FLAG_BITS_BASE`,
and enqueues a command word — the object has rejoined the wall. `initObjectPhaseSteps`
[seen] (state 13) derives a small step count from the record's seed, records it and a
derived code byte, arms a phase timer, advances the sub-state, and re-arms a ready flag
only when the step count is zero. `advanceObjectAndQueueMessageColumn` [seen] (state 14)
ticks a dwell timer and, on expiry, enqueues a channel-6 command carrying the object's
payload selector and advances its state.

### Horizontal target planning

Several states share a small planner for choosing where an attacker should slide to
horizontally. `commitMoveToTargetX` [seen] is the commit primitive: given a chosen target
X it stashes the target in the record (record+0x19), stores the signed move delta
(current X minus target) at record+0x09, zeros the three-byte move accumulator, and bumps
the planner sub-state so subsequent frames steer toward the target.
`commitMoveAcrossPlayerX` [code] chooses that target relative to the ship: it takes the
signed gap between the actor's X and `loc_4202`, halves it, biases it by sixteen, and
clamps it to a band on the *far* side of the ship — the right band (144–208) when the
actor is left of the ship, the left band (48–112) otherwise — so divers cross over the
player rather than stalling above him, then commits via `commitMoveToTargetX`.
`commitMoveToStoredOrPlayerTargetX` [code] picks between two sources: if the object
table's mode flag has bit 0 set it steers toward the table's stored target X, otherwise it
runs the ordinary cross-player pick. `beginObjectCrossPlayerMove` [code] is the shared
tail that commits a cross-player move and then arms the object's flight-curve seed
(record+0x18 = 3, giving four curve steps) and move throttle (record+0x10 = 100) for the
fresh run.

Those primitives are driven by three states. `advanceActorPhaseAndCommitMove` [code]
(state 2) bumps the actor's phase counter and picks its move handler by the kind field:
kind 0x60 uses the stored-or-player target select, every other kind the cross-player
select. `armDirectedMoveWhenInWindow` [code] (state 8) ticks an arm counter and, until
both it and the position sit inside a `[96, 160)` window, keeps cruising cross-player;
once both are in the window it advances the sub-state by two, seeds the move timers,
clears the heading, and sets the direction from the ship-X compare. `restartObjectMoveRun`
[code] (state 12) bumps a sub-counter, forces the state back to 8 (re-entering the
arm-window state), and begins a fresh cross-player move.

### Aiming and firing enemy shots

When a diving attacker reaches a firing row it drops an aimed bullet.
`aimObjectAtTarget` [seen] computes the direction the object should face: from the
vertical drop (0xf0 down to the sprite's Y) and the horizontal delta from the sprite to
the ship's `loc_4202`, it derives a direction octant, mirroring the octant when the ship
is to the left, and stores it in the record's direction field.
`computeDirectionOctantFromSlope` [seen] turns that slope into a 0–7 octant by dividing
the two magnitudes, clamping a too-steep (top-bit-set) quotient to 0x80, and taking the
top three bits. The division itself is `divideUnsigned8` [code], an eight-round
compare-subtract-shift restoring divide that returns the quotient with no memory effect.

`spawnAimedProjectileAtPlayer` [code] creates the shot. It claims the first free entry in
the fourteen-entry table at `loc_4260` (stride 5, entry active when byte 0 bit 0 is set),
copies the sprite Y and X from the object, and stores a scaled X velocity aimed at
`loc_4202` — mirrored when the ship is to the left. The scaling is
`computeJitteredXVelocity` [code], which divides the slope, adds a bounded random draw
(0–31) and a floor of six, and clamps to 0x7f — so aimed shots track the player but with
enough jitter that they are not perfectly predictable. If the table is full the routine
does nothing. Once written, the shot is picked up by `advanceAndRenderProjectiles` above,
which integrates and draws it each frame.

Which row an attacker fires from is chosen by `selectAttackerRowScan` [code]. It seeds a
slot index and base value from the alt flag `loc_421b` (slot 2 / base 157 when set, else
slot 1 / base 132), scans up to four two-byte slots of `ROW_OCCUPANCY` [code] advancing
while neither byte of a slot is occupied, and stores the resulting `(slot, base)` pair in
`loc_4213` — the same pair the two flight-and-fire handlers read as their row-match
count and value. So the standing formation's occupancy decides at which screen row the
divers release their shots.

### Sprite rendering

`renderObjectSprite` [seen] builds one hardware sprite record (Y, attribute, sprite
number, X) from one object struct. For a primary-active object it copies the position
(X = objX − 8, Y = complement(objY) − offset) and folds the object's signed heading into a
display attribute added to the record's attribute base, with a one-pixel nudge on the
diagonal facings; for a secondary-active object it uses a fixed sprite number 7 and the
record's alternate attribute; and when neither flag is set it parks the sprite off-screen
at (248, 248). `stageObjectsToSpriteShadow` [seen] runs it across eight consecutive
objects from `SPRITE_SOURCE_OBJ_BASE` into eight sprite-shadow records at
`SPRITE_SHADOW_BASE` [code] (stride 4), as a band of three followed by a band of five,
each at a Y offset selected by the orientation flag `loc_4018` — this is the per-frame
staging that puts the whole diving swarm onto the sprite hardware.

### Collisions and the hit response

Four sweeps run each frame, all sharing the same box-test idiom of an active-flag gate
followed by an X-band and a Y-band comparison.

The player's shot is tested against two things. `flagPlayerShotHitsOnObjects` [code],
gated on the shot gate `loc_4208`, box-tests the shot reference (`loc_4209`/`loc_420a`)
against each of the seven objects in `OBJ_TABLE` via `flagPlayerShotHitOnObject` [code],
which uses a six-wide by twelve-tall window; on an overlap it raises the shot-retire flag
`loc_420b` and scores-and-deactivates the object. `flagPlayerShotHitOnFormation` [code]
tests the shot against the standing wall: it bands the shot's Y into a formation row and
its X-delta (against the anchor `loc_420e`) into a column, indexes the formation grid
`FLAG_BITS_BASE`, and if that cell holds a live alien it clears the cell, stamps a hit
record (`loc_420b` = 1, `loc_42b1` = 1, `loc_42b2` = 0, and the shot's position word into
`loc_42b3`), and enqueues two command words — one carrying the grid index, one a derived
column code — so the kill's scoring and sound follow.

The player is tested against the two enemy hazards. `flagObjectHitsOnPlayer` [code],
gated on `OBJ_ACTIVE_FLAG`, box-tests each of the seven objects against `loc_4202` via
`flagObjectHitOnPlayer` [code], which classifies the object's field into a near or far
proximity window and, on an overlap, raises `HIT_EVENT_FLAG` [code] and scores the
object. `flagProjectileHitsOnPlayer` [code], also gated on `OBJ_ACTIVE_FLAG`, loops all
fourteen entries of `loc_4260` through `flagProjectileHitOnPlayer` [code], which
box-tests each active enemy shot against the ship across a near/far Y band and, on an
overlap, deactivates the shot and raises `HIT_EVENT_FLAG`.

`awardKillScoreByBandAndDeactivate` [code] is the shared kill handler the
player-shot-vs-object test and the object-vs-player test both call. It deactivates the struck object (byte 0 = 0, byte 1 = 1, byte 2 = 0), then
scans three score bands of the object's packed field (record+7) against a threshold of
0x50, bumping a request parameter and dropping the field by sixteen on each missed band;
a matched band enqueues a channel-3 score-add command immediately. If all three bands are
exhausted it raises the inhibit/request word `loc_422b`, folds in a neighbour bonus when
`ACTIVE_NEIGHBOR_COUNT` is exactly two (checked through `bumpCountIfNeighborsInactive`
[code], which adds one only when both look-ahead slots are inactive), records the bonus in
`loc_422d`, and enqueues the folded score request — this is how shooting the last of a
diving trio pays a bonus.

`HIT_EVENT_FLAG` [code] is the player-death event, and `handlePlayerHitEvent` [code] is
its sole consumer. When the flag's bit 0 is set it clears the flag, clears
`OBJ_ACTIVE_FLAG` (freezing the whole object subsystem), and sets `loc_4201` — which is
what tips `moveControlledObjectAndStageSprite` into its death-pose branch. It arms the two
pulse counters `loc_4205` = 10 and `loc_4206` = 4 (the pair the hit-sound step sequence
counts down), enqueues the hit-sound command, decrements the pace counter `loc_421a`
(floored at zero, easing the launch pacing that follows), steps a `[0, 5]` cycle counter
`loc_421d`, and pulses the sound latch `SOUND_W_REG3` [code] when the mode bit `loc_4006`
is set. That single clear of `OBJ_ACTIVE_FLAG` is what quiets every gated routine in this
section until the next life begins.

### Object death animation

A killed object is not removed at once — its death flag (record+1 bit 0) diverts it, in
`driveObjectSlot`, to a short animation instead of an AI state.
`dispatchDeactivatedObjectAnim` [code] reads the record's animation sub-state (record+2)
and runs one of four phase handlers. Sub-state 0, `armObjectAnimAndRequestSound` [code],
seeds the animation timers, advances the sub-state so it runs only once, and posts a
sound request into `loc_41df` chosen by the object's position byte (the low effect below a
threshold of 112, the high effect at or above). Sub-state 1, `tickDeactivatedObjectAnim`
[code], runs a fast timer down (reloading it and stepping a companion field on each
elapse) and then a slow timer; when the slow timer elapses it either retires the object,
or — past the position threshold — reloads the fast timer, seeds the companion from the
global `loc_422d`, and advances the sub-state. Sub-state 2, `endObjectAnimOnTimerExpiry`
[code], simply counts a timer down and clears the record's state byte to retire the object
when it reaches zero. Sub-state 3, `noopAnimDispatchSlot` [code], does nothing — a valid
terminal slot for the table. When retirement clears the record the slot is free for the
next launch.

## Sound

All audio is produced by writing a small bank of discrete-sound hardware registers, and the machine
composes those writes each frame from a cluster of RAM shadow cells in the `0x41cx` range. The hardware
surface is three groups of latches: the eight write registers `SOUND_W_REG0` through `SOUND_W_REG7`
(0x6800-0x6807, all [code]) — note the read side of 0x6800 is the input port `IN1` [code] — the four
LFO frequency latches beginning at `SOUND_LFO_FREQ` (0x6004-0x6007, [code]), and the single pitch latch
`SOUND_PITCH_W` (0x7800, [code]). Nothing plays directly off the game logic; instead the various voices
write their intent into shadow cells, and a per-frame driver reconciles those shadows and latches the
result out to the hardware.

### The per-frame driver

`driveSoundFrame` [code] is the heart of the audio system, and it runs once per frame as part of the
per-frame audio-and-input service `driveSoundFrameAndScanInput` [code]. It opens each frame from a clean
slate: it clears the composite flag byte `loc_41c0` and primes the staged-pitch shadow `SOUND_PITCH`
[code] to 0xff. It then runs seven voice updaters in a fixed order — the sequence-arm-on-request step,
the sweep voice, the sequence-arm-by-selector step, the three melodic sequence channels, the pulse-tone
envelope, the rising pitch ramp, and the gated square-wave tone — each of which may leave its mark on
`SOUND_PITCH` and on the composite byte. Because they run in order and the pitch shadow is a single cell,
the last updater to touch `SOUND_PITCH` in a given frame is the one whose pitch is heard, so the ordering
is what arbitrates between competing voices.

Once the updaters have run, the driver latches the composed bytes to hardware. The composite flag byte
`loc_41c0` goes to `SOUND_W_REG6` [code]; a rotate-right of that same byte (its bit 0 wrapping up into
bit 7) goes to `SOUND_W_REG7` [code]; and the staged `SOUND_PITCH` shadow is copied out to the pitch
latch `SOUND_PITCH_W`. The composite byte therefore acts as a per-frame "which voice spoke" summary: the
sequence channels stamp it to 2, the pulse envelope stamps it to 1, and the pitch ramp clears it back to
0, with whatever survives being what the driver publishes.

Around the driver, `driveSoundFrameAndScanInput` also runs the decaying sweep effect (below), pets the
watchdog by reading `SOUND_PITCH_W`, and reads the input port `IN0` [code]: if any of that port's arm
bits (7, 1, and 0) is set it raises the pitch-ramp arm cell `loc_41c9`, before flowing on into the
input-scan chain that folds player input into sound requests.

### The melodic sequence channels

Three voice channels play scripted note sequences, advanced together by
`advanceAllSoundSequenceChannels` [code], which steps each of the three sequence descriptors —
`loc_41d2`, `loc_41cf`, and `SOUND_SEQ_ACTIVE` [code] — one tick per frame through the shared per-channel
worker `advanceSoundSequenceChannel` [code].

For each channel, an inactive descriptor (its flag byte zero) is skipped entirely. Only that flag byte
is per-channel, though: the tone `loc_41d5`, the duration timer `loc_41d6`, and the cursor
`SOUND_SEQ_PTR` are a single shared playback state that the worker hardwires and drives on behalf of
whichever channel flag is active. An active channel stamps the composite byte `loc_41c0` to 2 and
republishes the current shared tone `loc_41d5` into `SOUND_PITCH`, then ticks down the shared duration
timer `loc_41d6`. While the timer is still running there is nothing more to do; the note simply holds. When the timer expires, the channel reads the next
command byte from its shared playback cursor `SOUND_SEQ_PTR` [code]. A command byte of 0xe0 is an end
marker that deactivates the channel by zeroing its descriptor. Any other byte is a packed note: its low
five bits index the tone table `SOUND_TONE_TABLE` [code] to fetch the new tone into `loc_41d5`, its high
three bits index the duration table `SOUND_DURATION_TABLE` [code] to fetch the new timer into `loc_41d6`,
and the cursor advances past the consumed byte.

A channel is started ("armed") by one of two paths, both of which raise the channel's flags, prime the
shared duration timer `loc_41d6` to 1 so it triggers a note-fetch on the next tick, and point the shared
cursor `SOUND_SEQ_PTR` at that sequence's data table. `armSoundSequenceOnRequest` [seen] fires when the request
gate `loc_41d1` holds exactly 1: it consumes the gate, raises `loc_41d2`, and points the cursor at
`loc_1e68`. `armSoundSequenceBySelector` [code] runs only while the sound driver is enabled (bit 0 of
`loc_4006` set) and reads the shared request selector `loc_41df`: a value of 6 arms the channel pointed
at `loc_1ebd` (raising `loc_41cf`), but only if `SOUND_SEQ_ACTIVE` is not already set, while any other
selector value is handed on to `armSoundSequenceForSelector16` [code]. That last handler recognizes only
the selector value 0x16, on which it clears `loc_41cf`, raises `SOUND_SEQ_ACTIVE`, and points the cursor
at `loc_1edf`; every other selector falls through untouched, to be claimed by some other requester.

### The sweep voice

`updateSoundSweepVoice` [code] drives a pitch sweep and, like the sequence arming, only acts while the
sound driver is enabled (`loc_4006` bit 0). It runs a countdown in `loc_41c2`: on any frame where that
countdown, minus one, is still nonzero, it delegates the actual sweep step to the sound-counter manager
`advanceSoundSweepAndStagePitch` [code]. On the frame where the countdown finally reaches zero, it
reloads an idle template instead — zeroing `loc_41c2`, setting the sweep cell one byte above it to 2, and
parking the sound counter `loc_41c4` at 160, a value deliberately past the counter's working ceiling so
the sweep stops advancing until it is re-triggered.

The sound-counter manager `advanceSoundSweepAndStagePitch` is the shared machinery that turns the counter
state into a staged pitch. It bails out early while the gate `loc_4226` has bit 0 set; otherwise it steps
its working pointer forward one cell (to the sweep cell) and branches on frame parity: on odd frames (bit
0 of `FRAME_COUNTER` [seen] set) it goes straight to the pitch-selector dispatch, and on even frames it
first bumps the pointed sweep cell — but only while the sound counter `loc_41c4` sits below its ceiling of
96 — and then falls into the counter tick `tickSoundCounterAndStagePitch` [seen], which decrements the
sound counter if it is still running and then also dispatches the pitch selector.

The pitch selector `stageSoundPitchBySelector` [code] reads the low two bits of the sweep cell it is
handed. When those bits are zero it stages a fixed pitch of 96; when they are nonzero it recomputes a
pitch from the sound counter via `stagePitchFromSoundCounter` [code]. That recompute takes the counter
value `loc_41c4` and, on an odd selector, biases it by 96 and rotates the biased sum right — with the
add's carry rotating back into the top bit — to produce a warbling pitch, while an even selector passes
the counter value straight through. In all of these paths the final value is written into `SOUND_PITCH`
by `stageSoundPitch` [seen], the small shared helper that does nothing but park a byte in that shadow for
the driver to latch out later in the frame.

### The pulse-tone envelope

`advancePulseToneEnvelope` [code] runs a two-byte decrementing envelope word held in `loc_41c7` (low) and
`loc_41c8` (high). When bit 0 of the low byte is clear it hands the high byte to
`pulseSoundToneFromCountdown` [code]; when bit 0 is set it re-arms the word to its top-bit sentinel,
setting the low byte to 0 and the high byte to 128. The countdown handler idles whenever the high byte is
already zero; otherwise it stores the high byte decremented back into `loc_41c8` and then stages a
two-level pulse — a value of 129 when bit 2 of the decremented byte is set, otherwise 0 — through
`stagePitchAndRaiseSoundFlag` [code]. That helper writes its argument minus one (modulo 256) into
`SOUND_PITCH` and raises the composite flag `loc_41c0` to 1, marking the shadow pair filled for the
frame.

### The rising pitch ramp

`driveRisingPitchRamp` [code] produces a rising glide. It uses the arm cell `loc_41c9` as a one-frame
test: while that cell (minus one) is still nonzero it advances the ramp one step through
`advanceSoundPitchRamp` [seen], and when it reaches its reset point it clears `loc_41c9` and reloads the
ramp's two-byte {countdown, pitch} pair at `loc_41ca` to a countdown of 32 and a pitch of 0. Each active
step of `advanceSoundPitchRamp` consumes one count from the countdown cell (the byte just past the
pointer), adds a fixed step of 4 to the pitch cell above it, publishes that new pitch to `SOUND_PITCH`,
and clears the composite flag `loc_41c0` so the frame composes cleanly; a drained countdown makes the
step idle. The arm cell `loc_41c9` that gates the whole thing is raised by the input service
`driveSoundFrameAndScanInput` whenever the relevant `IN0` bits are pressed, which is how a player action
kicks off the glide.

### The gated square-wave tone

`advanceGatedSquareTone` [code] runs a phase counter `loc_41cc` for a square-wave voice. While that
counter is more than one step from expiry it drives the tone toggler `driveGatedSquareTone` [code] each
tick; on the expiry step it parks the counter at 0 and re-arms the tone's duration `SOUND_TONE_DURATION`
[code] to 8. The toggler itself, while `SOUND_TONE_DURATION` is nonzero, counts one tick off that
duration and drives `SOUND_W_REG5` [code] with the frame flag `loc_4007` XORed by 1 — a bit that
alternates from frame to frame, so the output squares up into a tone — and once the duration is spent it
writes 0 to silence the register.

### The LFO level

Layered over the frequency of the discrete-sound voices is a low-frequency modulation level that decays
over time. `driveSoundLfoLevel` [code] runs from the vblank interrupt service and dispatches on a reset
request: when `SOUND_LFO_RESET_REQUEST` [code] is zero it runs the ordinary per-frame decay through
`decaySoundLfoLevel` [code]; otherwise it consumes the request (clearing the flag) and slams the full
level of 15 across the frequency latches. The decay step is deliberately slow — it acts only on the tick
where the frame counter `FRAME_COUNTER` reads 0xff, and only while the level `SOUND_LFO_LEVEL` (0x421f,
[code]) is still nonzero — dropping the level by one and re-broadcasting it. Both the reset and the decay
route through `broadcastSoundLfoLevel` [seen], which saves the new level to `SOUND_LFO_LEVEL` and then
fans it out across the four `SOUND_LFO_FREQ` latches, rotating the byte right by one bit between each
write so the four latches receive successive rotations of the same value.

### Effects driven from the gameplay frame

A few sound effects are produced not by the sound driver but directly from the gameplay-frame pipeline,
writing their own hardware registers.

`driveSoundVoicesFromOccupancy` [code] is a hum whose pitch tracks how many enemies remain. It runs only
on even frames (bit 0 of the frame flag `loc_4007` clear). It sums the six-by-ten flag grid
`OCCUPANCY_GRID` [code] (rows sixteen bytes apart) into an eight-bit tally seeded at 1, then lights the
three write latches `SOUND_W_REG0`, `SOUND_W_REG1`, and `SOUND_W_REG2` one at a time, stopping the
instant the running tally drains to zero — so the number of lit latches (capped at three) rises with the
enemy count — and zeroing every latch past the stopping point. It also raises the near-empty flag
`loc_4224` once the tally has all but run out.

`driveDecayingSoundSweep` [code] emits a fading sweep on alternate frames. On even frames, while its
countdown `loc_41df` is nonzero, it writes the countdown rotated right by two bits into `SOUND_W_REG4`
[code] and ticks the countdown down by one, so the emitted value shrinks toward silence over successive
frames. This effect shares the cell `loc_41df` with the sequence selector, so the same byte serves as a
sound-request selector for the sequence channels and as a decay countdown for this sweep.

`driveGatedSoundStepSequence` [code] plays a stepped burst gated by bit 0 of `loc_4201`. A prescaler in
`loc_4205` (reloaded to 10) fires once every ten eligible frames; on each fire it emits a command word
built from opcode 2 and the current step value `loc_4206`, then steps that value down. When the step
count reaches zero the burst ends: it clears the enable flag `loc_4201` and silences `SOUND_W_REG3`
[code].

### Sound requests and the shared selector

The bridge from game events to the sound machinery is the shared control/request cell `loc_41df`, the
selector byte that `armSoundSequenceBySelector` and `armSoundSequenceForSelector16` read to decide which
sequence to arm. Several places seed it. A dying or deactivated object seeds it through
`armObjectAnimAndRequestSound` [code], which — as the entry phase of an object's death animation, run via
`dispatchDeactivatedObjectAnim` [code] — sets up the animation timers and then posts a sound request
keyed on the object's screen position: below a threshold it requests one effect, at or above it another.
Player input seeds it through the input-scan chain: `requestSoundOnInput1AndContinueScan` [code] reads
the input port `IN1` and seeds the selector to 0x16 when either of its low two bits is set, then hands
off to `requestSound6AndContinueInputScan` [code], which seeds the selector to 6 when the folded input
ports show bit 2 or 3 set. Board and level starts post their cue a different way, through
`queueBoardStartSoundBurst` [code], which enqueues a prologue command word on the cue channel (channel 5)
followed by the standard five-word burst that spans channels 5, 6, and 7.

### Silencing the hardware

`silenceSoundAndDisableIrqStars` [code] is the full quiesce path, used on attract-mode and reset
transitions. It sets all four `SOUND_LFO_FREQ` latches to 1, clears the eight sound write registers
`SOUND_W_REG0` through `SOUND_W_REG7`, drives the pitch latch `SOUND_PITCH_W` fully high, and — beyond
the audio hardware — clears `IRQ_ENABLE` [code] to stop the vblank interrupt and `STARS_ENABLE` [code] to
halt the starfield.

## Coins, credits, the HUD, score display, and the message scroller

Almost everything the machine paints outside the moving sprites — scores, the credit line,
messages, the flashing indicators, the standing formation's tiles — is drawn indirectly. Game
logic never writes those tilemap cells itself; instead it drops small work orders into a shared
command queue, and a separate drain loop empties that queue whenever the CPU would otherwise be
idle. This section covers that queue and its eight draw/command handlers, the coin and credit
plumbing that feeds off the same queue, the path from an inserted coin to a running game, the
packed-BCD score machinery, the HUD field and player-status painters, the message scroller and its
text columns, the attract-mode input readout with its animated screen fill, and the small
reload-and-tally helper the timers share.

### The command queue and its display-list drain

The queue is a 32-slot ring occupying `0x40c0`-`0x40ff` — sixty-four bytes on page `0x40`, two
per slot. A producer appends through a write head kept in `loc_40a0` [guess]; the drain consumes
through the read cursor `DISPLAY_LIST_CURSOR` (`0x40a1`) [code]. Both indices are single bytes that
name a low offset within page `0x40`, both step by two per slot, and both wrap back up to the
floor `0xc0` when they would drop below it, so the two chase each other around the same `0xc0`-`0xff`
window. A slot is free when the high bit of its first byte is set; a queued command clears that bit,
because a command word's control byte is a small channel number in the range 0-7.

`enqueueCommandWord` [seen] is the producer. It reads the write head, forms the slot address by
adding that 8-bit index to the page-`0x40` base, and only writes if the head slot is still free
(its bit 7 set). When it is, the routine stores the command word's high byte (the channel/control)
into the slot and the low byte (the handler argument) into the next cell, then advances the head by
two, clamps it up to the `0xc0` floor if the `+2` wrapped it below, and commits the new head. A full
queue (head slot occupied) is simply dropped — the append is skipped and the caller's pointer
returned unchanged. `commitQueueWriteHead` [seen] is the bare tail that stores a freshly computed
head back to `loc_40a0` and returns through the shared stack epilogue `loc_090b` [code], which
restores the caller's saved pointer and does no work of its own.

Callers that need a whole sound-and-draw cue at once use `enqueueCommandWordBurst` [code], which
posts five words in a fixed shape: three on the caller's channel and the one above it, then two
fixed cues on channel 7. Each word is `(channel << 8) | param`.

The consumer side is a scanning drain. It reads the cursor, forms the slot address on page `0x40`,
and tests the slot's first byte: if that byte's high bit is set the slot is empty, so the drain
does one step of idle background work — repainting a column of the standing formation's object-figure
grid — and rescans; if the high bit is clear a command is waiting, and control falls into
`decodeDisplayListSlotAndDispatch` [seen]. The dispatcher takes the control byte's low nibble as an
even handler index, retires both bytes of the slot to `0xff` (marking it free again), advances the
cursor past them (wrapping to `0xc0` on underflow), stores the advanced cursor back to
`DISPLAY_LIST_CURSOR`, and hands the slot's second byte — the argument — to the selected handler.
The even-index arithmetic is why channels run 0-7 while the handler table is keyed 0,2,…,0xe: the
drain doubles the control byte as part of its ready test, so a channel `N` lands on table entry
`2N`, one two-byte pointer per handler. An unknown index is a hard error.

The eight channels are: **0** `drawAnimatedTileFigureAtPackedCoord` [code] — map the argument, a
packed VRAM coordinate, to a tilemap cell (via `mapPackedCoordToVram` [code], which shuffles the
coordinate's nibble fields into a page-`0x50` cell address and leaves the coordinate's bit 4 as a
"draw a block, not a glyph" flag) and stamp a frame-timer-animated figure there; **1**
`drawFixedTileFigureAtPackedCoord` [code] — the same mapping but a fixed (unanimated) figure, a 2x2
block when the coordinate's bit 4 is set else a vertical tile pair; **2** `draw4x4TileForm` [code] —
draw one of three 4x4 indicator forms at a fixed screen region (blank-plus-icon, blank-only, or four
2x2 blocks of a folded tile code); **3** `addBcdScoreIncrementAndUpdateHighScore` [code] — add a
score increment for a scored event; **4** `clearAndRedrawScoreField` [seen] — zero and repaint a
score field; **5** `drawScoreFieldByIndex` [code] — repaint a score field in place; **6**
`renderMessageColumn` [seen] — paint, arm, or erase a text column; and **7**
`renderHudFieldBySelector` [code] — repaint one HUD field. Channels 0-2 are the tile-figure painters
that draw the formation and indicators; 3-5 are the score handlers; 6 is the message painter; 7 is
the HUD painter. Every handler returns straight to the drain loop and the loop rescans, so a burst of
queued commands is emptied over successive scans, interleaved with the idle object-figure drawing
whenever the ring goes empty.

### Coins and credits

Two per-frame routines cooperate to turn coin-mech pulses into banked credits. `serviceCoinInputs`
[seen] is the front end. In configuration mode 3 (the byte at `loc_4000` [guess] equal to 3, i.e.
free play) it hands off to `presetCreditCount` [code], which simply pins the credit count to 9 every
frame (clearing the coin-phase byte `loc_4001` [guess] and writing 9 into the credit count
`loc_4002` [guess]). Otherwise it folds the two input shadows (`IN0_SHADOW` `0x4010` [code] with
`loc_4013` [guess]), complements them, and masks the result by two guard cells (`loc_4015`,
`loc_4016` [guess]). If the top bit survives, a coin is granted immediately through `addCreditForCoin`
[code]; otherwise each of the low two bits ticks the coarse coin counter `loc_4004` [guess] once, up
to twice per frame — this is how a coin drop is registered for later metering.

The metering itself is `tickCoinMeterAndAwardCredits` [seen]. While the reload cell `loc_4003`
[guess] is nonzero it pulses the physical coin-counter output and counts that cell down; the pulse is
`pulseCoinCounter` [seen], which rotates the reload value right three bits so the value's bit 3 lands
in bit 0 — the only wired bit — and latches it to `COIN_COUNTER_0_LATCH` (`0x6003`) [code], then
decrements the timer. When the reload cell reaches zero the routine decrements the coarse counter
`loc_4004`, refills `loc_4003` to 15, and awards credit(s) according to the coinage mode `loc_4000`:
mode 3 does nothing, mode 1 runs the two-coins-per-credit path, mode 2 awards a credit twice
(one-coin/two-credits), and any other mode awards one. The two-coins-per-credit path is
`awardCreditEverySecondCoin` [code], a toggle on the coin-phase flag `loc_4001`: the first coin of a
pair merely raises the flag via `setCoinPhaseFlag` [code]; the second clears it and advances the
credit count. Every credit award funnels through `incrementCreditCount` [code], which walks the count
toward a ceiling of 99 — at the ceiling it does nothing, past it `clampCreditsToMax` [code] pins it
back to 99, and below it it bumps the count, raises a ready flag (`loc_41c9` [guess]), and queues a
channel-7 command to repaint the credit line. `addCreditForCoin` does the same bump-and-queue for the
directly granted top-bit coin. That the cell at `loc_4002` is the credit count is a firm code-level
reading corroborated across `addCreditForCoin`, `driveStartButtonLamps`, and
`advanceGameStateOnCredit`, though its identifier is still a placeholder pending grounding.

The coin mechanism's lockout coil follows the bank. `updateCoinLockoutFromCredits` [code] reads the
credit count and, at nine or more credits, releases the lockout through `clearCoinLockout` [code]
(writing 0 to `COIN_LOCKOUT`, `0x6002` [code]); below nine it engages it by writing 1. So the machine
stops accepting coins once nine credits are banked.

### From credit to game start

While no game is running the machine sits in its attract state, and the transition out of it is
credit-driven. `advanceGameStateOnCredit` [code] runs as the tail of the attract handler: whenever
the credit count `loc_4002` is nonzero it steps the top-level `GAME_STATE` (`0x4005`) [code] forward
one and clears the attract sub-state cluster — the frame flag `loc_4007` [guess], the sequence step
`SEQUENCE_STATE` (`0x400a`) [code], a pair of sound cells (`loc_41c2`, `loc_41df` [guess]), and the
scroller enable `MESSAGE_SCROLL_ENABLE` (`0x40b0`) [code] — moving the machine to the "press start"
screen; with zero credits it is a no-op.

On the press-start screen the two start-button lamps blink to invite play. `driveStartButtonLamps`
[code] gates on bit 5 of the free-running `FRAME_COUNTER` (`0x425f`) [seen]: while that bit is clear
both lamps (`START_LAMP_0` `0x6000`, `START_LAMP_1` `0x6001` [code] — the same board addresses that
read back as inputs) are forced off, and while it is set the lamps reflect the bank: no credit leaves
them, one credit lights lamp 0, two or more light both. Because bit 5 of the frame counter toggles
every thirty-two frames, the lit lamps flash.

Pressing start launches through `beginGameOnStartButton` [code], which reads the start buttons out of
`IN1_SHADOW` (`0x4011`): bit 0 begins a one-player game outright through `startOnePlayerGame` [code];
bit 1 begins a two-player game only if at least two credits are banked, spending both, blitting the
32-byte ROM row template `loc_051b` [guess] into the saved-state snapshot `SAVED_STATE_SNAPSHOT`
(`0x41a0`) [code], optionally arming the state advance gate (`armStateAdvanceGate`, writing `loc_41b5`
[guess]) on a config bit (`loc_401f` [guess]), and entering the round with a two-player spawn word. `startOnePlayerGame` spends one credit, zeros the
snapshot, and enters the round with a null spawn word; with no credit left it instead forces
`GAME_STATE` back to 1. Both funnel into `startGameRoundAndClearScores` [code], the common round
setup: it stores the 16-bit spawn word into `CURRENT_PLAYER` (`0x400d`) [code] and its neighbour —
so a one-player start leaves both bytes zero while a two-player start sets the paired-player flag
`loc_400e` [guess] — blits the ROM row template into the flag-bitmap buffer `PACKED_FLAG_BITMAP`
(`0x4180`) [code], arms the sub-state advance gate (`armSubstateAdvanceGate`, writing `loc_4195` [guess])
on the same config bit, enters play (`SEQUENCE_STATE` 0,
`GAME_STATE` 3, plus mode cells `loc_4006`/`loc_41d1` [guess] set to 1), and queues three command
words: a channel-6 start message and two channel-4 clears that wipe both players' score fields for
the fresh game.

### Scores

Each player owns a three-byte packed-BCD score — `PLAYER1_SCORE_BCD` (`0x40a2`) and
`PLAYER2_SCORE_BCD` (`0x40a5`), both [code] — and the machine keeps one shared `HIGH_SCORE_BCD`
(`0x40a8`) [code]. Scoring is a channel-3 command carrying a score-type index, dispatched to
`addBcdScoreIncrementAndUpdateHighScore` [code]. Gated off when the frame-skip flag `loc_4007`'s bit 0
is set, it otherwise selects the active player's field via `selectCurrentPlayerScore` [code] (player 1
→ `PLAYER1_SCORE_BCD`, else `PLAYER2_SCORE_BCD`), reads the matching 3-byte increment from
`SCORE_INCREMENT_TABLE` (`0x22d0`) [code] at `index*3`, and adds it into the score low byte first with
BCD carry propagation. It then derives a threshold value from the running total's high bytes and, once
that reaches the bonus-threshold byte `loc_40ac` [guess], awards a bonus marker. It repaints the
current player's digits, and finally compares the new total against the stored high score high-byte
first — copying the total into `HIGH_SCORE_BCD` and repainting the high-score digits only when the new
total is strictly higher.

The digit painting is a small stack of helpers. `drawScoreToSelectedPlayerField` [code] picks the
VRAM digit-field cursor from a selector — `DIGIT_FIELD_PRIMARY` (`0x5381`) [code] for the primary
player, `DIGIT_FIELD_ALT` (`0x5121`) [code] otherwise — and calls `drawBcdNumberColumn` [code], which
walks three packed-BCD bytes downward from the source and paints six digit tiles up the column, high
nibble then low, stepping the cursor one tile row up per digit. Each digit goes through `drawBcdDigit`
[code], which maps a nibble to its glyph (digits `0`-`9` are the contiguous tiles `0x90`-`0x99`) and
suppresses leading zeros against a four-slot blank budget: a leading zero paints the blank tile and
consumes one budget slot, the first significant digit ends suppression, and a genuine zero after that
paints a real `0`. `byteToPackedBcd` [code] is the binary-to-BCD converter (value mod 100 as two
nibbles) that the HUD and coin lines lean on; `drawHighScoreDigits` [code] is the fixed-cursor variant
that paints six digits into the high-score field `loc_5241` [guess].

Two channel handlers repaint whole fields on demand. `drawScoreFieldByIndex` [code] redraws the field
named by an index — 0 the player-1 score into the primary field, 1 the player-2 score into the alt
field but only while the paired-player flag `loc_400e` is set, 2 the high score — and an index of 3 or
more descends, redrawing every field from `index-1` down to 0 in one call. `clearAndRedrawScoreField`
[seen] first zeroes a field's three digit bytes plus a companion scratch byte (the per-player
bonus-marker flag for the two player fields; the high-score field re-zeros its own first byte) and
then repaints through `drawScoreFieldByIndex`; it descends the same way for an index of 3 or more,
which is exactly how round start clears both players at once.

The bonus markers are the row of little icons that count a player's spare lives. `awardBonusMarker`
[code] is a one-shot per current player: it indexes the per-player flag table at
`PLAYER1_BONUS_MARKER_AWARDED` (`0x40ad`, with the player-2 slot at `PLAYER2_BONUS_MARKER_AWARDED`
`0x40ae`, both [code]) by `CURRENT_PLAYER`, does nothing if that player's slot is already flagged, and
otherwise flags it, raises a sound-envelope trigger (`loc_41c7` [guess]), bumps the marker counter
`loc_421d` [guess], and repaints the row with the new count. `drawMarkerRow` [code] paints the count
as marker tiles (tile 102) growing upward from `MARKER_ROW_VRAM` (`0x539e`) [code] across five slots,
then blanks the remaining slots; when the object subsystem is live (`OBJ_ACTIVE_FLAG` `0x4200` [code]
set) it drops one from the displayed count — the life in play is not shown as a spare — and if that
empties the count it blanks every slot instead.

### The HUD field renderer and the player-status columns

`renderHudFieldBySelector` [code] is channel 7: a four-way switch on its argument that repaints one
HUD element. Selector 0 draws the coin/credit icon-tally row — gated off on odd frames by
`loc_4007` bit 0, it reads the tally `COIN_CREDIT_ROW_COUNT` (`0x421c`) [code], adds one, clamps to a
ceiling, converts to BCD, and stamps that many tens-blocks and units-pairs into
`COIN_CREDIT_ROW_VRAM` (`0x507e`) [code] before blanking the remainder of sixteen slots (and, when a
region flag `loc_4220` [guess] is set, it also requests a sound-LFO reset via `SOUND_LFO_RESET_REQUEST`
`0x41d0` [code]). Selector 1 draws the credit-count line — skipped while `loc_4006` bit 0 is set. When both dip bits in
`IN1_SHADOW` are set (free play) it paints the "free play" text column through `renderMessageColumn` and
returns, writing no credit digits; otherwise it paints the "credit" text column through
`renderMessageColumn` and then writes the credit count `loc_4002` (clamped to 99) as two nibbles into
`CREDIT_COUNT_TENS_VRAM` (`0x529f`) and `CREDIT_COUNT_UNITS_VRAM` (`0x527f`), both [code]. Selector 2 draws a two-nibble status readout from `loc_40ac` (skipped when
that byte is the `0xff` sentinel): a label column via `renderMessageColumn`, then the byte's low
nibble into `HUD_NIBBLE_LO_VRAM` (`0x5138`) and its nibble-swapped high half into `HUD_NIBBLE_HI_VRAM`
(`0x5158`), both [code]. Any other selector repaints the bonus-marker row through `drawMarkerRow`,
again gated on the odd-frame skip flag.

The player-status column is the small three-cell indicator marking whose turn it is. `paintPlayerStatusColumn`
[code] stamps a column of three cells from a base pointer stepping by a stride — the top cell an
incremented character code, then two fixed tiles — and afterward, when a hide bit is clear and the
mode gate `loc_4006` is zero, clears the status flag `loc_40ab` [guess]. `selectPlayerStatusVram`
[code] picks the base: player 1 → `PLAYER1_STATUS_VRAM` (`0x5340`), else `PLAYER2_STATUS_VRAM`
(`0x50e0`), both [code]. `repaintPlayerStatusColumn` [code] drives the whole thing off a flags byte:
with its bit 4 clear it paints the current player's column outright; with bit 4 set it blanks the
current column's three cells and, only when the paired-player flag `loc_400e` is set, also paints the
other player's column (player XOR 1). Two wrappers gate that repaint on the saved status byte:
`repaintPlayerStatusColumnIfSaved` [code] repaints only when `loc_40ab` is already nonzero, and
`repaintPlayerStatusColumnFromModeGate` [seen] latches a nonzero mode gate `loc_4006` into `loc_40ab`
and repaints, or falls back to the if-saved path when the gate is zero. This last is the form the idle
object-figure drain calls on its zeroth grid phase, so the status column is refreshed as part of the
background drawing.

### The message scroller and text columns

`renderMessageColumn` [seen] is channel 6, the message painter. Its argument's low five bits index
`MESSAGE_PTR_TABLE` (`0x235c`) [code] as an array of 2-byte record pointers; each record begins with a
2-byte destination VRAM word and is followed by the message's character bytes, terminated by the code
63. The argument's top two bits pick the mode. Bit 7 erases: it walks the text and overwrites each
character's cell up the column with the blank tile. Bit 6 arms the scroller: it records the
destination and text pointers into `MESSAGE_DEST_PTR` (`0x40b5`) and `MESSAGE_TEXT_PTR` (`0x40b3`),
both [code], derives a per-column delay/cursor pointer into the table at `loc_4020` [guess] and stores
it in `MESSAGE_CURSOR_PTR` (`0x40b1`) [code], clears the whole column to the clear tile, seeds the
cursor with a packed destination-row byte, and raises `MESSAGE_SCROLL_ENABLE` (`0x40b0`). With neither
top bit set it draws the message immediately, painting each character's tile up the column.

Once armed, `advanceMessageScroller` [seen] reveals the message one glyph per eligible frame. While
`MESSAGE_SCROLL_ENABLE` bit 0 is set it reads the delay counter through `MESSAGE_CURSOR_PTR`: if the
counter's low three bits are still set it merely ticks the counter and waits; at the text terminator
it ticks and finishes; otherwise it emits one glyph — mapping the character to a tile into the cell at
`MESSAGE_DEST_PTR`, advancing the text pointer forward one byte and the destination pointer up one row
— then ticks the counter. The ticking is `endMessageScrollOnExpiry` [seen], which counts the delay
cell down and, on the exact zero-crossing, clears `MESSAGE_SCROLL_ENABLE` so the scroller stops;
`endMessageScrollOnExpiryFromDe` [seen] is the same tail entered with the counter pointer in the
alternate register.

Static (non-scrolling) text uses a separate descriptor path. `drawTextColumn` [code] is the inner
loop: for a count of characters it reads a source byte, maps it to a tile by subtracting the `0`
character code, stores it, and steps the source forward and the destination by a signed stride (a
negative stride walks up a column). `drawTextColumnFromDescriptor` [code] unpacks a five-byte
descriptor — source word, destination word, count byte — and paints that many characters up the
column, and `drawTextColumnByIndex` [code] indexes the ROM descriptor table `TEXT_DESCRIPTOR_TABLE`
(`0x1cf6`) [code] by a small index to pick which descriptor to paint.

Several producers feed the message channel. The attract sequence's
`emitMessageColumnsThenAdvanceSequence` [seen] queues a channel-6 column on each low-tier dwell expiry
as it lays out a title screen; `postCreditAndMessageDrawsAndAdvance` [code] queues a credit-line
repaint and a message column together; and `advanceObjectAndQueueMessageColumn` [seen] lets a
scripted object, on its dwell expiry, queue a channel-6 column carrying its own payload selector.

### The attract input readout and the screen fill

During attract the machine displays the current dip-switch settings as text and animates a fill
across the screen. `drawInputTextColumnsAndSeedScreenFill` [seen] decodes three two-bit fields out of
the input ports — bits 6-7 of `IN1` (`0x6800`) [code], bits 0-1 and bit 2 of `IN2_PORT` (`0x7000`)
[code] — into text-descriptor indices and paints a column for each through `drawTextColumnByIndex`.
Then, unless bit 6 of `IN0` (`0x6000`) [code] is asserted, it seeds the screen-fill state: clears the
mode flag `loc_4006`, sets the dispatch flag `loc_401a` [guess] to 2, seeds the two dwell tiers
`loc_4008`/`loc_4009` [guess], rewinds the VRAM write cursor `VRAM_WRITE_PTR` (`0x400b`) [code] to
`VRAM_BASE` (`0x5000`) [code], clears the four-byte lamp/coin latch block, and silences the sound
hardware. `armInputFlagAndDrawInputColumns` [code] is the caller that first folds the two input bytes
and, if their shared bit 4 is set, raises the companion input flag `loc_41cc` [guess], then falls
through into this init.

The fill itself is an animated tile strip drawn a slice at a time. `advanceScreenFillStrip` [code]
heads it: it pets the watchdog by reading the pitch port, and if the strip gate `loc_4008` is zero
there is nothing to draw so it restarts the outer dwell; otherwise it loads the write cursor and draws
the strip's first half. `drawScreenFillStripFirstHalf` [code] stamps sixteen two-tile pairs (tiles 48
and 50) forward from the cursor and falls into `drawScreenFillStripSecondHalf` [code], which stamps
sixteen more pairs (tiles 52 and 54), saves the advanced cursor back to `VRAM_WRITE_PTR`, and ticks
the strip dwell `loc_4008`; while that dwell still runs the frame is done, and on its expiry it
restarts the outer dwell. `restartScreenFillOnDwellExpiry` [seen] ticks the high dwell tier (the byte
just past the strip gate) and, when that tier is already zero or reaches zero on this tick, re-seeds
the whole fill through `resetScreenFillState` [seen]. That reset is itself input-gated: unless `IN0`
bit 6 is asserted it rewinds the write cursor to `VRAM_BASE`, re-arms the fill length to a full page,
clears the dispatch flag `loc_401a`, and resets `GAME_STATE` to 0 — restarting the whole boot/attract
cycle.

### The shared refill primitive

Timers throughout the machine re-arm from ROM reload tables through one small helper,
`reloadExpiredCounterAndTally` [seen]. Given a source table pointer, a destination counter cell, and a
running tally, it copies the reload byte from the table into the expired cell — re-arming it — and
returns the tally incremented by one, so a caller sweeping a block of counters learns how many it
refilled this pass. Its principal consumer is the enemy-launch pacer, which sweeps a block of attacker
sub-counters against `SUBCOUNTER_RELOAD_TABLE` (`0x15e3`) [code] and raises the launch-trigger flag
`SUBCOUNTER_REFILL_FLAG` (`0x4228`) [code] on the refills. The related block-fill primitive
`fillMemoryBlock` [code] — store a byte across a run of cells (a count of zero meaning a full 256) —
is what the credit-to-start and attract-init paths use to zero the saved-state snapshot and the
lamp/coin latch block in a single stroke.

## Tile / VRAM drawing primitives and coordinate mapping

Everything the machine paints into its character map is built from a small kit of tile
stampers sitting on top of one address calculation. The kit has three visible layers:
a coordinate mapper that turns a game-space byte into a tilemap cell, a stack of
stamp primitives that write one, two, or four tiles at a pointer, and a set of figure
handlers that decide *which* tile to stamp — a fixed glyph, an indexed block, or a
frame-animated variant. Above those sits the per-frame draw walk that repaints the
playfield one column at a time, plus the bulk fills that wipe and repaint whole screens
between sequence steps.

### Mapping a packed coordinate to a VRAM cell

The single entry point that every figure draw runs through is `mapPackedCoordToVram`
[code]. It takes a packed coordinate byte and produces a tilemap-VRAM cell address by
shuffling the byte's nibble fields rather than doing plain arithmetic: the low nibble is
rotated to yield a two-bit high-address byte (0..3, choosing which quarter of the map)
and the top two bits of a low seed; the high nibble supplies a three-bit field whose
running complemented sum forms the low nibble of the address. The final cell address is
`VRAM_BASE` [code] plus `(high << 8)` plus that low byte. Beyond the address itself the
mapper hands back two live values its callers branch on: the coordinate's bits 6..5 and,
crucially, its bit 4 exposed as a carry flag. That carry is the block-versus-glyph
selector — a coordinate with bit 4 set draws a 2x2 tile block, clear draws a single
double-height glyph — so the same coordinate that positions a figure also chooses its
shape.

Table lookups elsewhere in the kit go through `fetchIndexedTableByte` [code], an indexed
fetch that adds an 8-bit index to a base pointer (carrying into the high byte), reads the
byte there, and leaves the advanced pointer behind for the caller. It is how a figure's
tile code is pulled from a glyph or block table by index.

### The stamp primitives

At the bottom sits `stampTilePair` [code]: it writes a tile code at the destination and
that code plus one at the next cell, then advances the pointer past the pair by a
caller-supplied stride and steps the tile code by two. Every block writer is built by
chaining this with different strides.

Vertical work uses `drawDoubleHeightTile` [code], which paints a glyph as a top/bottom
pair — the caller's tile at the destination cell and the tile code plus two one tilemap
row (32 cells) directly below — so a single logical glyph occupies two stacked cells.

The 2x2 block is `drawTileBlock2x2` [code]: two `stampTilePair` passes with a stride of
31 so that each pair's built-in +1 plus 31 lands the second pair exactly one tile row
down, laying the four consecutive codes tile..tile+3 in a square. `drawTileBlock2x2Up`
[code] is its mirror, growing upward with a -33 step and seeding the upper pair four
codes lower. `drawTileBlock2x2AtDe` [code] is a pointer-swap adapter: it exchanges the
two working pointers so a destination that arrived in the alternate register becomes the
draw target, which is how the block writers accept a destination staged by a different
caller path. `drawBottomTilePairRestoreDe` [code] is the shared tail those writers fall
into — it stamps the second pair and restores the caller's saved alternate pointer.

Several fixed-seed conveniences wrap these for the decorative glyph family whose codes
start at 44 (0x2c): `drawFixedTileBlock2x2` [code] lays a 2x2 block of codes 44..47,
`drawFixedTileBlock2x2Up` [code] does the upward block from seed 46,
`drawFixedTilePairHorizontal` [code] stamps a horizontal pair from 44, and
`drawFixedTilePairVertical` [code] stamps the double-height pair from 44.

### Choosing block, indexed block, or glyph

Two selectors decide what a figure looks like. `drawSelectedTileBlockOrFallback` [code]
reads a *signed* selector: a non-negative value is treated as an index into the ROM
tile-block source table `TILE_BLOCK_TABLE` [code] — the block code is fetched by index
(`drawIndexedTileBlock` [code]) and stamped at the pending destination — while a negative
value stamps a fixed fallback block seeded with tile 0xa4 instead.

The higher-level dispatch is `drawTileGlyphOrBlock` [code], keyed on the mapper's carry
live-out. With carry set it swaps to the block destination and stamps a 2x2 block through
`drawSelectedTileBlockOrFallback`; with carry clear it fetches the tile code for its index
from the glyph table `loc_2157` and paints it as a double-height glyph at the incoming
cell. The swap only stashes the destination across the pointer-clobbering fetch, so both
arms ultimately draw at the mapped cell.

### The animation variant selector

Animated figures cycle their tile through the free-running frame counter.
`computeTileVariantFromTimer` [code] folds an input value into a two-bit variant index:
when the value is below the range limit of 112 it computes `(nibble-swap(FRAME_COUNTER) +
value + C) & 3`, where C is the register 0x00 or 0xFF (not a 0/1 carry bit — 0xFF ≡ -1 mod
4, so a set C folds the phase back one step), so the two low bits — and hence the drawn tile of a four-frame
animation cycle — advance with `FRAME_COUNTER` [seen]; a value of 112 or above saturates
to the 0x80 out-of-range marker (via `markValueOutOfRange`) instead of folding.
`computeTileVariantFromValueAndTimer` [code] is the front door used by the figure
handlers: values at or above 112 saturate to the 0x80 marker, otherwise it takes the
value's low nibble, sets a carry when the frame counter's low nibble is the smaller of the
two, and folds through the timer routine — biasing the animation phase by the figure's own
coordinate so neighbouring figures do not all flip in lockstep.

### The display-list figure and form handlers

The draw kit is driven by a display list, drained by `decodeDisplayListSlotAndDispatch`
[seen]: it reads one ready slot, uses the control byte's low nibble to pick an even
handler index, retires both of the slot's bytes to 0xff, advances the read cursor
`DISPLAY_LIST_CURSOR` [code] past them (wrapping back to the list base 0xc0 when it
underflows), and hands the slot's second byte to the selected painter as its argument.
Three of those handlers are tile painters.

`drawFixedTileFigureAtPackedCoord` [code] maps its packed coordinate to a cell and stamps
a fixed decorative figure there — a 2x2 block when the coordinate's bit 4 is set, a
vertical tile pair otherwise. `drawAnimatedTileFigureAtPackedCoord` [code] is its animated
twin: it maps the coordinate, biases that same coordinate into a timer-animated variant
through `computeTileVariantFromValueAndTimer`, then stamps a 2x2 block or a double-height
glyph — again chosen by coordinate bit 4 — so the figure both sits at and animates from
its own position. `draw4x4TileForm` [code] draws a larger indicator at a fixed 4x4-cell
region (four 2x2-block anchors: `loc_51da`, `loc_51dc`, `loc_521a`, `loc_521c`) selected by
the command argument:
form 0 blanks the block and overlays a small 2x2 icon seeded with tile 96, form 1 just
blanks the block, and any other form folds its index into a complemented tile code over a
0xc0 base and stamps four 2x2 blocks across the region, the seed stepping four codes per
block. Its blanking helpers `blankTileBlock4x4` [code] (four rows of four cells of the
blank tile 0x40) and `blank4x4AndDraw2x2Icon` [code] are shared with form 0.

### The object-figure grid draw walk

The enemy figures on screen are painted not all at once but a column per frame, as the
idle-work step the display-list drain runs whenever its queue has nothing pending. The
head is `drawObjectFigureGridColumn` [seen]. It reads the *low nibble* of the frame
counter `FRAME_COUNTER` [seen] as a column phase — a value 0..15 that indexes which column
to paint this frame, not a count of how many figures exist. On phase 0 it repaints the
player-status column instead (`repaintPlayerStatusColumnFromModeGate` [seen]). On any
other phase it forms a pointer into the object grid `OBJECT_GRID_BASE` [code] offset by the
column (the add stays inside the low byte and cannot carry), and — unless
`OBJECT_DRAW_SUPPRESS` [seen] bit 0 is set, which gates the whole draw off while VRAM is
being bulk-filled — walks that column's six rows at a stride of 0x10.

Each row is routed by `routeObjectGridCellDraw` [seen]. The grid pointer's low byte *is*
the packed draw coordinate for that cell, and bit 0 of the cell's own flag byte chooses the
path: set means the cell is active and is drawn as a timer-animated figure
(`drawAnimatedObjectGridCellAndAdvance` [seen]); clear means it is stamped as a fixed tile
figure (`drawFixedTileFigureAtPackedCoord`) followed by the shared loop tail. The animated
path maps the coordinate to its cell, folds `FRAME_COUNTER` into a two-bit variant through
`computeTileVariantFromTimer`, stamps the glyph or block through `drawTileGlyphOrBlock`,
then advances the grid pointer's low byte by the row stride, spends one of the six rows,
and either loops to the next row or finishes the column. `objectGridWalkLoopEpilogue`
[seen] is the same tail reached from the fixed-figure path — it advances the pointer by the
stride and loops back to the router while rows remain. Because one column is chosen by the
frame phase each frame, the sixteen phases repaint the entire object grid (and the status
column) once every sixteen frames.

### Column drawing and its periodic refresh

A second, unrelated column facility repaints a run of tilemap columns from a ROM source.
`drawTileColumnTriple` [code] copies three source bytes up a single VRAM column — each
byte lands at the destination whose low address byte then steps up one row (-32) within a
fixed page — and afterwards advances the low byte by 98 to line up the next column,
returning the advanced source and destination so successive columns chain. `blankTileColumns`
[code] is its eraser twin, stamping the blank tile 16 into three cells per column (stepping
-32 per row, +98 per column) from `loc_5193`.

`redrawTileColumnsPeriodically` [code] schedules those two against the frame phase. It does
nothing unless at least two columns are queued in `DRAWN_COLUMN_COUNT` [code]. Then, keyed
on the low six bits of `FRAME_COUNTER` [seen], the phase-0 pass wipes the columns with
`blankTileColumns` and the phase-32 pass repaints them: the first column comes from a source
row picked by the frame counter's top two bits out of `TILE_COLUMN_TABLE` [code], and the
remaining columns stream consecutively from `TILE_COLUMN_TABLE_CONT` [code]. This is the
periodic refresh that keeps a run of decorative columns cycling.

### Sequence-driven full-screen fills

Between sequence steps the machine wipes and repaints whole regions of VRAM a strip at a
time, one strip per frame, so the fill animates and never stalls the frame. The lowest tool
is `fillMemoryBlock` [code], a memory fill that stores a byte into a count of cells from a
pointer (a count of zero wrapping to a full 256). The bulk-fill sequence states each carry a
live write cursor in `VRAM_WRITE_PTR` [code] and walk it across the 0x5000..0x53ff character
map: `fillScreenThenLatchConfigAndAdvanceState` [seen] fills 32-cell blank-tile blocks each
frame during the game-state-0 boot before latching configuration and advancing;
`fillVramRowThenResetObjectState` [seen] fills a 28-cell strip of tile 16 and advances the
cursor one full row (+32) per frame — and on completion (its last frame, on dwell expiry)
raises `OBJECT_DRAW_SUPPRESS` to 1, arming the object-grid suppression the following bulk
operations rely on;
`blankVramRowThenResetSpriteState` [code], `blankVramRowsThenDriveStartLamps` [code], and
`blankScreenRowsThenAdvanceSequence` [code] are the same row-blank pattern for their
respective sequence and play states.

The animated diagonal-fill effect is a three-piece chain. `advanceScreenFillStrip` [code] is
the head: it pets the watchdog (a read of `SOUND_PITCH_W`), and if the strip gate `loc_4008`
has run out it restarts the outer fill dwell, otherwise it loads the write cursor and draws
the strip's first half. `drawScreenFillStripFirstHalf` [code] stamps sixteen two-tile pairs
(codes 48 and 50) forward from the cursor and falls straight into
`drawScreenFillStripSecondHalf` [code], which stamps sixteen more pairs (codes 52 and 54),
saves the advanced cursor back to `VRAM_WRITE_PTR`, and ticks the strip dwell; on the dwell's
expiry `restartScreenFillOnDwellExpiry` [seen] bumps to the outer dwell tier and, on its
zero-crossing, hands off to `resetScreenFillState` [seen] which rewinds the cursor to base,
re-arms the full-page length, and clears the dispatch flag to loop the effect.

The block primitives are also what draws the HUD's marker row: `drawMarkerRow` [code]
repaints the five-slot marker row at `MARKER_ROW_VRAM` [code] by stamping marker tiles
(code 102) growing upward through `drawTileBlock2x2Up` and blanking the unused slots with
`drawFixedTileBlock2x2Up`, dropping one marker while the object subsystem is active.

### The projectile renderer and its collision siblings

`advanceAndRenderProjectiles` [code] both integrates and draws the moving projectiles. It
walks seven ten-byte records from `loc_4260`, each holding two five-byte sub-slots; the low
bit of `FRAME_COUNTER` [seen] selects which sub-slot leads this frame while the other's
sub-position is merely bumped. For the leading, active sub-slot it advances the sub-position
(deactivating on overflow), integrates the 16-bit position by twice the signed velocity, and
deactivates the slot when the position leaves the vertical window; deactivation zeros the
active, sub-position, and high bytes. It then writes each projectile's Y and tile code into
the sprite shadow at `loc_4081`, mirrored by the direction flag `loc_4018` (which both
complements the Y and flips a ±1 code nudge applied to the first three records).

The collision siblings walk the very same record array from a different angle.
`flagProjectileHitsOnPlayer` [code] runs only when the object subsystem flag
`OBJ_ACTIVE_FLAG` [code] bit 0 is set, and then sweeps all fourteen sub-slot entries (base
`loc_4260`, stride 5 — the same 70 bytes the renderer sees as seven ten-byte records)
through `flagProjectileHitOnPlayer` [code]. That per-entry test box-tests an active entry's
X against the player-X reference `loc_4202` and its Y across a near/far band, and on overlap
deactivates the entry and raises `HIT_EVENT_FLAG` [code] for the hit handler to consume.

## Open questions

- The born-live spine — the free-running main loop, the vblank-NMI heartbeat, and the top-level state
  dispatchers (the rst-28 handler and the jp(hl) dispatcher that select the sequence, formation, combat, and
  sound handlers each frame) — is still the frozen oracle, not yet decompiled to idiomatic JS, so the way the
  handlers here are scheduled is described from the oracle body and the leaves they call. That spine is the next
  lift, and is what most of the remaining translated routines are reached through.
- Many handlers stay `[code]` because their state was not reached by the attract + coin/one-player captures (a
  deep formation/dive state, a later board), or because their only side effect lands in VRAM or a hardware latch
  the work-RAM tap cannot see; a deeper poke-cycle / video-visible capture is owed to lift them.
- Many work-RAM cells are still named `loc_<addr>`: their role is understood from the routines that touch them
  but a descriptive identifier is deferred to the cleanup phase rather than promoted piecemeal.
- A further tier of routines remains translated (not yet decompiled); the map grows to cover them as the spiral
  climbs.
