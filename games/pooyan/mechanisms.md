# Pooyan — how the machine works

This document describes the running machine as it is now, and is regenerated whole each
understanding pass. Confidence tags mirror `idiomatic/names.js`: **[seen]** = the cell's role is
confirmed by a MAME golden observation, **[code]** = read from the translated behaviour with
MAME-grounding still open (the cell is static or unobservable in the attract and gameplay goldens).
The map now covers both the machine's **state architecture** — the work-RAM layout and the variables
the game runs on — and its **control flow**: the free-running main loop, the vblank interrupt that is
the machine's only per-frame heartbeat, and the state machines that drive configuration, play, the
actor arena, the wave/rope/launch cycle, rendering and the ROM self-checks.

## The work RAM and its state model

All mutable game state lives in the 2 KB work RAM at `0x8800–0x8FFF`; the video planes sit outside it
(colour/attribute RAM at `0x8000`, tile codes at `0x8400`, and the two sprite-hardware banks at
`0x9000`/`0x9400`). The low block `0x8800–0x882f` holds the machine's configuration and top-level
control — the decoded dip switches, credits, the active-player selection and the score/coinage
bookkeeping — with a small command queue occupying the tail of the page around `0x88c0–0x88ff`. The
middle block `0x8900–0x8bff` holds per-round game state and the actor arena's live page, and the object
record tables run through `0x8a80–0x8cbf` on a shared `0x18`-byte stride. The high block
`0x8d00–0x8fff` drives the enemy-spawn cadence, the wave/rope/launch machinery, the display-list
interpreter and the attract/intro scripts. Two hardware-facing address ranges bracket all of this:
the input ports and DIP switches are read from `0xa000`/`0xa080`/`0xa0a0`/`0xa0c0`/`0xa0e0`, and the
board's control latches (watchdog, NMI enable, flip-screen, the sound command/IRQ) are written in the
`0xa000`/`0xa100`/`0xa180` range — where a read and a write at the same address are different devices
(reading `0xa000` returns DIP switch bank 1; writing it kicks the watchdog).

## The frame loop and the vblank heartbeat

The machine's foreground is a single unbounded loop at `loc_020f` that never terminates on its own —
the only thing that pulls the CPU out of it is the once-per-frame vblank interrupt. Each pass builds a
pointer into page `0x88` from a one-byte read cursor at `0x88a1` (kept in the `0x88c0..0x88ff` window,
a 64-byte command queue seeded to `0xff` at boot and paired with a companion write cursor at `0x88a0`)
and reads the byte in the slot it points at. That byte's top bit decides everything: a free slot is
marked `0xff`, so whenever the loop sees the high bit set it simply runs the per-frame worker
`loc_0254` and loops again — an empty queue means the machine just spins doing per-frame housekeeping.
A posted command has its high bit clear; the loop consumes it by writing `0xff` back over both the
command byte and the argument byte that follows it (freeing the entry), pulling that argument into a
register, advancing the cursor by two with a wrap back to `0xc0` whenever it would leave the window,
and then using the command value (doubled, masked to an even offset) as an index into the handler
table at `0x0242`. The loop address `0x020f` is left on the stack as the handler's return, so every
command handler runs with the argument in `A` and falls straight back into the loop when it finishes.
When `loc_0254` runs, it reads the per-frame gate byte at `0x883f`: while the low nibble is nonzero it
just calls a light helper (`0x208c`) and returns, but when the low nibble reaches zero and
GAME_ACTIVE_FLAG [seen] reports a live game it walks a sprite-scroll shift across the `0x84e0`/`0x8740`
regions (helpers `0x02a8`/`0x02aa`/`0x02b1`), further gated by TWO_PLAYER_FLAG [code], ACTIVE_PLAYER
[code] and bit 4 of the `0x883f` byte.

The real per-frame work lives in the vblank NMI service `loc_066d`, the machine's sole heartbeat: the
video hardware raises the interrupt once per frame, yanking the CPU out of `loc_020f` into this routine
and returning it afterward. It first saves the entire register file — main set, shadow set, and both
index registers — then immediately masks further NMIs by writing 0 to bit 0 of the LS259 control latch
at `0xa180`. Next it streams the assembled sprite display list into the sprite hardware through
`loc_0714`, which copies the four-byte sprite records from the `0x8840` list region into the two sprite
banks at `0x9010` and `0x9410`, splitting each record across the pair; how much it copies is chosen by
PLAY_STATE_INDEX [seen] (`0x880a`), not the top-level state — index 4 copies four separate record
slices anchored at `0x8840`/`0x887c`/`0x8850`/`0x8888`, otherwise a single 24-entry block. It kicks the
watchdog with a write to `0xa000`, then advances the input edge-detect ring: the previous samples shift
down into the history cells (`0x8813`–`0x8816`) while fresh reads of the three input ports IN0/IN1/IN2
at `0xa080`/`0xa0a0`/`0xa0c0` are complemented (the inputs are active-low) and latched into INPUT_PORT0
[seen] (`0x8810`) and its two neighbours `0x8811`/`0x8812`. Two per-frame counters are decremented in
place — the gate byte `0x883f` and FRAME_COUNTER [seen] (`0x8a5f`), the latter a free-running
down-counter whose low bits phase animation — followed by two service routines, a coin/credit update
chain (`0x59e8`) and a page-`0x8a` command-ring consumer (`0x0e64`). Finally it dispatches the top-level
game by reading MAIN_GAME_STATE [seen] (`0x8805`) and indexing the word table at `0x06f0` (selectors
0..4 → `0x072d`/`0x0899`/`0x0c4e`/`0x159b`/`0x0e53`), with the chosen handler seated to return into the
epilogue at `0x06fa`. That epilogue copies FLIP_SCREEN_FLAG [seen] (`0x881f`) to bit 7 of the
flip-screen latch at `0xa187`, restores every saved register, re-arms the NMI (LS259 bit 0 ← 1 at
`0xa180`), and returns to the exact PC the interrupt fired at, dropping the CPU back into the foreground
loop.

The five top-level handlers selected by MAIN_GAME_STATE cover the machine's coarse phases. State 0
(`0x072d`) is the setup/boot-into-attract state: it keeps filling tile rows and, only once the
self-test tally at `0x8fff` reads `0x10`, finishes initialization by clearing GAME_ACTIVE_FLAG,
advancing MAIN_GAME_STATE to 1, zeroing PLAY_STATE_INDEX, and enqueuing display commands. State 1
(`0x0899`) is the attract-mode driver, itself a sub-dispatcher indexing a seven-entry table at `0x08a1`
on its own selector at `0x8e51`. State 2 (`0x0c4e`) is a further dispatcher that branches on
PLAY_STATE_INDEX through the table at `0x0c56`, occupying the phase between attract and full play. State
3 (`0x159b`) is active gameplay: it ticks a BCD counter and dispatches the in-play sub-state on
PLAY_STATE_INDEX `& 0x1f` through the table at `0x15a8`. State 4 (`0x0e53`) is a bare return — a no-op
top-level state that runs no game logic while selected; note this is the MAIN_GAME_STATE **value** 4
and is unrelated to the PLAY_STATE_INDEX value 4 that selects the four-slice sprite copy above.

## Configuration, coinage and players

At reset `loc_0092` reads the two DIP ports once and freezes their meaning into work RAM. The settings
port DSW1 (`0xa000`) is read, complemented with `cpl`, and then bit-sliced: successive rotate/mask
steps peel off a cabinet bit into `0x880f`, the bonus-award select bit into BONUS_AWARD_DSW [code]
(bit 3), the 3-bit difficulty into DIFFICULTY_DSW [code] (bits 4–6), and a further bit into `0x8821`;
a second complemented read masks the low two bits to compute the starting lives, storing `0xff` for
setting 3 and otherwise `bits+3` (i.e. 3/4/5) into the cabinet lives byte `0x8807`. The coinage port
DSW0 (`0xa0e0`) is read **without** complement; its high and low nibbles are each passed through the
lookup helper at `0x0020` against the 16-entry table at ROM `0x0053`
(`0f 33 31 24 22 21 15 13 11 07 06 05 04 03 02 01`), depositing the per-slot coinage byte for coin
slot 2 at `0x882f` and for coin slot 1 at COINAGE_CONFIG [seen] (`0x882c`). In that byte the high
nibble encodes coins-required and the low nibble credits-granted, and the sole out-of-pattern entry
`0x0f` (DSW nibble 0) is the free-play sentinel every downstream reader tests for. Boot also enables the
vblank interrupt, seeds the sorted high-score table and default top score, and drops into the main
loop.

Credits are accrued by the coinage-gated update chain `loc_59e8`, which returns immediately if either
coinage nibble (`0x882c` or `0x882f`) is `0x0f` — in free play no coin accounting runs at all.
Otherwise it fans out to the coin-service routines; `loc_5a56` samples INPUT_PORT0, clocks the coin bit
through a debounce shift-ring at `0x882a`, and on a clean edge bumps a coin tally (`0x8824`) and
accumulates `0x10` per coin at `0x882b`; once that reaches the coinage byte's coins-required threshold
it adds the credits-granted nibble to CREDIT_COUNT [seen] (`0x8802`, BCD, clamped to `0x63`). Credits
are consumed at the start buttons: `loc_0d78` reads `0x8810`, treats bit 3 as 1-player start (decrement
CREDIT_COUNT by one, enter play with `HL=0`) and bit 4 as 2-player start (requires CREDIT_COUNT ≥ 2,
subtract two, enter with `HL=0x0100`); under free play `loc_0bb5` reaches the same start routines
without spending anything. The start routine `loc_0dab` writes `HL` into the 16-bit pair
ACTIVE_PLAYER/TWO_PLAYER_FLAG (`0x880d`/`0x880e`), so a 1-player game leaves both zero while a 2-player
game sets TWO_PLAYER_FLAG = 1 with player 0 active, then it enters play state (MAIN_GAME_STATE = 3,
GAME_ACTIVE_FLAG = 1) and calls the seeder `loc_0e00`. That seeder clears the `0x3f`-byte live page at
SPEED_INDEX [code] (`0x8900`), copies the cabinet lives byte `0x8807` into PLAYER0_LIVES [seen]
(`0x8948`) and PLAYER1_LIVES [seen] (`0x8988`), sets each starting X to `0x20`, and seeds each bank's
colour byte (PLAYER0_STATE_BANK [code] / PLAYER1_STATE_BANK [code], byte 0) from `0x8820`.

Thereafter the active player is selected by ACTIVE_PLAYER bit 0 throughout: `selectActivePlayerScoreBuffer`
[code] returns P1_SCORE_BCD [code] (`0x88a2`) or P2_SCORE_BCD [code] (`0x88a5`); the extra-award
tracker `loc_18da` gates on the active player's score MSB (`0x88a4` vs `0x88a7`) reaching a queued
threshold, reloading the queue slot with `0x05`/`0x03` and stepping it by `0x08`/`0x07` per
BONUS_AWARD_DSW; and `loc_7fd6` (only when credits remain in a 2-player game) picks that player's lives
bank as the mid-game second-player trigger. The two `0x3f`-byte per-player banks are the persistence
mechanism for alternating turns: `saveLiveStateToPlayerBank` [code] copies the live page (`0x8900`)
into whichever bank ACTIVE_PLAYER selects, while `saveLivePageToPlayer0Bank` [code] (on a death during
a 2-player game whose player 1 still has lives) latches ACTIVE_PLAYER = 1 and snapshots the live page
into player 0's bank, so each player's lives and state swap between the shared live page and their own
bank across turns.

## In-play progression and timers

Once the machine is running a game, a finer state machine governs each round, driven by
PLAY_STATE_INDEX [seen]: `loc_15a1` reads that byte, masks it to five bits, and dispatches through the
word table at `0x15a8`. The table holds real handlers only for indices 0 through 18; the bytes beyond
that are data, and the game never lets the index climb into them. Each handler runs one frame of work
for its sub-state and returns, and the handlers advance the index themselves — sometimes by a plain
increment, sometimes by writing a specific target. The round is paced by two independent counters.
PHASE_TIMER [seen] is a per-frame countdown: the round-init handler (`loc_1601`) seeds it (`0x80`) and
bumps PLAY_STATE_INDEX to the next sub-state; the following handler (`loc_16b7`) does nothing but
decrement PHASE_TIMER and return while it is nonzero, holding the sub-state until the timer elapses,
whereupon it runs the per-phase field setup (`loc_1dd3`), repaints the gauge (`loc_03c2`), clears
SUBPHASE_TICK [seen], and bumps the index again (other sub-states reload PHASE_TIMER to their own
values, e.g. `0x60`). SUBPHASE_TICK is the second, coarser tick: `loc_175d` increments it every frame
and returns until it reaches `0x1c`, then resets it and, on that wrap, toggles the one-shot at
FORMATION_SLOT_TABLE [seen] to pace the intro/formation animation. Past its guards `loc_175d` either
arms sub-state `0x0d` or, on the level-start branch, runs the level-start batch and forces
PLAY_STATE_INDEX to 3, so a fresh round always resumes at a known sub-state.

That level-start branch is where a round is marked live: it writes ROUND_IN_PROGRESS [seen] = 1 (and
seeds the adjacent wave counter) before running the level build-out. ROUND_IN_PROGRESS is then read as a
decision key throughout the round — `loc_16b7` folds it (with GAME_ACTIVE_FLAG [seen] and
ROUND_COUNTER [code] bit 0) into which graphic/layout pointer pair to load, and `loc_1dd3` folds the
same set to choose which field-paint job to run. GAME_ACTIVE_FLAG is the overall in-play gate:
`loc_16b7`, `loc_1dd3`, `loc_1a64` and `loc_1e55` all test it and take a closed-gate branch when it is
zero. Phase progress inside a round is metered by GAUGE_PHASE_COUNTER [seen]. The gauge-drain handler
(`loc_1a64`) reads it, and if it is already zero or reaches zero on this decrement it hands off to
`loc_1a96`; otherwise it renders the gauge and seeds PLAY_STATE_INDEX to `0x0a` (`0x0b` for the second
player) to run active play. `loc_03c2` draws that counter as a five-cell vertical HUD gauge. When the
gauge empties, `loc_1a96` is a phase transition, not a death: it advances PLAY_STATE_INDEX (once for
player 0, twice for player 1), zeroes ROPE_SEGMENT_COUNT [seen] and its neighbours, and hands off to
the next-phase setup. Running alongside is STAGE_COUNTDOWN [seen], a coarser per-stage depth counter
seeded around `0x20` and drained during the stage (decremented in `loc_34b0` and rendered into two HUD
tiles); its value near zero gates actor setup (`loc_191c` and `loc_1171` refuse to run while it is
nonzero/mismatched), giving the stage a defined end independent of the fine per-frame timing.

Board completion diverts this whole apparatus onto the level-intro path through a single flag,
BOARD_CLEAR_FLAG [code]. It is armed to 1 in `loc_0bb5`, whose playfield-consistency check scans the
`0x86bc` list against a ROM byte stream and cross-checks a table lookup; when those disagree it sets
the flag. `loc_0bb5` is the only routine that arms it; it returns to zero as part of the bulk RAM wipe
at round/life reset. Once set, the flag
has three effects. It freezes the player object: `loc_1e55`, which normally samples the input port and
complements it into the object's state byte, instead bails immediately and zeroes that byte. It
redirects the enemy hunters: `loc_324d`, ticking a per-slot counter down, tail-jumps to the board-clear
check `loc_3278` on borrow whenever the flag is set. And `loc_3278` (guarded to run once per arming)
sums the playfield tilemap columns into a 16-bit total and matches it against a four-entry table at
`0x68eb` — a full match means the board matches a stored completed layout and returns cleanly, while a
byte miss lands in a ROM-integrity trap a valid ROM never reaches. The same flag pulls the surrounding
machinery into the intro sequence, so object updates stop and control flows into the level-intro/
next-board build rather than continuing the round.

## The actor arena

Every moving thing on screen lives in one array of fixed `0x18`-byte records based at ACTOR_TABLE
[seen] (`0x8a80`). At board init the whole block is wiped to zero — `loc_19bc` seeds the first byte and
propagates it forward across `0x200` bytes, and the state-7 teardown handler `loc_2ae8` does the same
across a wider `0x240`-byte span before also clearing the phase counters SPAWN_PHASE_COUNTER [code],
WAVE_ARRIVAL_COUNTER [seen] and ROPE_SEGMENT_COUNT [seen] and forcing PLAY_STATE_INDEX to 6 — so a
fresh board (and every wave teardown) starts with no stale actor state. The array is carved into
sub-pools purely by offset from the same base: slot 0 is the player/lead actor; ENEMY_ACTOR_TABLE
[seen] (`0x8ae0`) is slot 4, the head of the enemy sub-array; and further out sit the secondary record
pools — SPRITE_OBJECT_TABLE [seen], PROJECTILE_TABLE [seen], FORMATION_TABLE [code], SPAWN_OBJECT_TABLE
[seen] and the I-parity target pair ENEMY_TARGET_REC0 [seen]/ENEMY_TARGET_REC1 [seen], all on the same
`0x18` stride. A record's occupancy lives in the low bit of its first two bytes: a free-slot scan such
as `loc_13bc` reads `(rec+0)|(rec+1)`, tests bit 0, and takes the first record whose bit is clear;
allocation stamps that record's fields and marks it active, and teardown either zero-fills or clears
the bit.

Slot 0 is the player, and its three named cells are record offsets into that first slot: LEAD_ACTOR_STATE
[seen] is `rec+0x02`, PLAYER_Y [seen] the base-Y integer at `rec+0x04`, and PLAYER_AIM_FLAGS [code] the
state-bits byte at `rec+0x07`. Player control flows through `loc_1e55`, which — after gating out when
BOARD_CLEAR_FLAG (or its neighbour `0x89fb`) is set, when GAME_ACTIVE_FLAG is clear, when the record's
byte 2 is busy, or when WAVE_TEARDOWN_STATE [code] is nonzero — samples one of two joystick ports
(chosen by FLIP_SCREEN_FLAG [seen]), complements it into `rec+0x07`, and debounces the fire bit through
a small latch at `0x8f03`; the aim-indicator bits 2/3 of that same byte are set elsewhere and reset
(with LATCHED_ENEMY_X [seen]) by `advanceEaglePhaseAndClearAim` [code] at phase end. The lead actor's
motion is a scripted state machine: the state byte `rec+0x02` is masked to three bits and used as a
jump-table index. Two per-frame drivers exist for this slot, selected by game context — `loc_241e`
(gated on the tamper-freeze flag, six handlers `0x2442..0x24fb`) and `loc_28c6` (which forces state 6
when ROUND_COUNTER bit 0 is clear, state 4 when FORMATION_STATE [code] is set, otherwise dispatches
eight handlers `0x2901..0x2ae8`). The handlers walk the actor through phased base-Y motion — driving
`rec+0x04` down toward the floor row `0xdc` or up toward `0xc0`, swapping the display tile, reloading
the per-frame delay and incrementing `rec+0x02` to advance to the next phase. Because the player is
drawn as three vertically stacked sprites, `deriveStackedSpriteYs` [code] fans PLAYER_Y out into the Y
fields of slots 1/2/3 (Y, Y−0x10, Y−0x10+0x0a); the animation stepper (`loc_22b1`) runs across the
first four slots only while GRAB_ACTIVE_FLAG [seen] is zero, so a rope-grab freezes the stack.

Enemy records are timed onto the field by ENEMY_SPAWN_TIMER [seen] (`0x8d07`): `loc_1171` decrements it
each tick while nonzero, and only at zero does it gate — comparing STAGE_COUNTDOWN against the live
ACTIVE_ENEMY_COUNT [seen] and bailing if they match, if the countdown is smaller, or if the count has
hit the cap of 6 — before sweeping the six enemy slots and calling the initializer `loc_119a` on each.
`loc_119a` skips a record whose id bit is set, otherwise activates it, zeroes its scratch, queues an
animation, derives a facing byte and attribute from ROUND_COUNTER through two ROM tables, reseeds
ENEMY_SPAWN_TIMER, bumps ACTIVE_ENEMY_COUNT, and returns one level up the call chain, so exactly one
enemy is born per timer expiry (a parallel formation cadence hangs off FORMATION_SPAWN_TIMER [code]).
Each live record is then serviced by small leaf primitives [code] that read and write only that record:
its animation is a stream of three-byte {tile, tile, hold} frames addressed at `rec+0x0c/0x0d` —
`setActorAnimation` and `storeActorAnimationPointer` install that pointer and reset the step index,
`advanceActorAnimFrame` walks it (an `0xff` opcode reloads the pointer, any other byte emits a frame and
reloads the hold), and `tickActorAnimHold` counts the hold down and steps a two-bit phase while an arm
bit is set. Vertical position is 16-bit fixed point (fraction `rec+0x03`, integer row `rec+0x04`):
`advanceFallStep` adds the fall velocity into the fraction and carries a whole row on overflow,
reporting whether the actor is still above the landing row, while `advanceActorDropStateOnDelay` and
`advanceRisingActorStep` apply scripted drop/rise nudges once a per-record delay elapses. Object records
in the secondary pools are built by `seedObjectRecord`, `stampObjectAndDecCounter` and `initActorRecord`,
with `adjustSpawnColumn` skewing the spawn column by WAVE_PROGRESS_COUNTER [seen] in the early stages,
and are driven per-frame by `dispatchActiveObjectState`, which skips a record unless bit 0 of its first
two bytes is set and then routes `(rec+0x02)&3` into one of four handlers. Collision resolution surfaces
in the state cells rather than these leaves: OBJ_HIT_FLAG_I0 [seen]/OBJ_HIT_FLAG_I1 [seen] pulse for one
frame when a shot strikes the corresponding I-parity target record, ACTIVE_OBJECT_TYPE [seen] latches
the struck record's type byte, and the teardown path clears the hit flag and dismantles the record.

## Waves, rope and launch

A round is played as a short sequence of attack waves paced by a cluster of counters at
`0x8f30–0x8f3f`. The wave seeder (`loc_72e1`) runs once its target cell is clear: it sets an internal
launch flag and increments WAVE_INDEX [seen]. If WAVE_INDEX has not yet reached 4 it lays down
2×WAVE_INDEX enemy records in ENEMY_ACTOR_TABLE from the ROM parameter table at `0x7409` — each seeded
active — and zeroes WAVE_RECORDS_ARRIVED [seen]; so successive waves carry 2, 4, then 6 enemies. On the
4th wave it instead stops seeding and reloads WAVE_HOLD_TIMER [seen] to `0x20`, ending the round's wave
sequence. The launch driver (`loc_72a7`) uses the launch flag as its gate: while it is 0 it (re)seeds a
wave; once set it walks the placed records through their per-record approach machine, and when the
record count reaches 0 it hands to the idle handler (`loc_73e3`). That idle handler ticks
WAVE_HOLD_TIMER down one per frame; on expiry it queues a between-waves sound, reloads the hold to
`0x18`, and clears the launch flag so the next wave can seed — this hold is the inter-wave pause. As
each enemy reaches its target grid cell (`loc_733c`) WAVE_RECORDS_ARRIVED is bumped, and when it equals
WAVE_INDEX the wave-complete sound is queued. Independently, every object arrival (`loc_3be3`) bumps
both WAVE_ARRIVAL_COUNTER and WAVE_PROGRESS_COUNTER while decrementing ACTIVE_ENEMY_COUNT;
WAVE_PROGRESS_COUNTER then nudges the spawn column outward once it passes `0x0c` (only while
STAGE_COUNTDOWN < 3), ramping pressure late in a wave. WAVE_ARRIVAL_COUNTER is capped at 9→8 and bounds
the rope (below). The whole `0x8f00` block — the wave counters, LAUNCH_STATE and the launch flags — is
zeroed as a unit at board reset (`loc_2527` clears `0x4f` bytes from `0x8f00`), which is where these
counters return to 0.

The arrow/rope launch is a five-state machine in LAUNCH_STATE [seen], dispatched `&7` each frame by
`loc_2778` into handlers 0..4, cycling 0→1→2→3→4→0. State 0 does the arming: it first checks
LAUNCH_ARMED_FLAG [seen], and if not already set the preconditions are LANE_SPAWN_COUNTDOWN [seen] == 0
and LAUNCH_ARM_LATCH [seen] == 0 (a nonzero latch is a one-shot that blocks re-arming and is simply
incremented when clear), plus, on one path, STAGE_COUNTDOWN being nonzero and not a multiple of 8 —
when satisfied it sets LAUNCH_ARMED_FLAG = 1. The fire gate then requires the arrow Y to have reached
`0x3c` and both hunter-hit bits clear; passing it advances LAUNCH_STATE, optionally paints a HUD tile
(gated by PLAY_MODE_LATCH [code] or LAUNCH_ARMED_FLAG), and copies `0x8d7a` into LAUNCH_ARM_LATCH.
LAUNCH_ARM_LATCH and LANE_SPAWN_COUNTDOWN are cleared together at wave end (`loc_3be3` also zeroes
SCRIPT_ADVANCE_GUARD [seen] there). Lane pacing feeds this: `loc_5374` activates a lane entry only if
its id is zero, marking it active and incrementing ACTIVE_LANE_COUNT [seen]; `loc_3680` finds a free
actor slot, decrements ACTIVE_LANE_COUNT, snapshots its pre-decrement value into LANE_SPAWN_COUNTDOWN,
and bumps SLOT_SPAWN_INDEX [seen].

The rope/lift extends and retracts segment by segment. `loc_2d80` grows ROPE_SEGMENT_COUNT up to
WAVE_ARRIVAL_COUNTER − 2: each step advances an internal sub-index, looks up a video-column base from
ROM into a scratch cell, and arms two per-cell sub-timers. Retraction (`loc_2f2f`) runs on the per-cell
timer while ROPE_SEGMENT_COUNT > 0: it selects a retract-animation pointer from a ROM table keyed by
ROUND_COUNTER >> 2 (clamped to 3) plus the cabinet bit, reads an attribute byte for the current segment,
clears the matching FORMATION_TABLE record, advances the cell, and blits the segment; the pull path
aborts while GRAB_ACTIVE_FLAG is set or WAVE_ARRIVAL_COUNTER == 2. ROPE_DRAW_COUNT [code] is reseeded to
4 (alongside the `0x8902` phase) by the board/HUD reset once that phase reaches 7, setting the drawn
rope-row count for the next cycle. Two latches govern the sliding-enemy band: `loc_343e` advances a
moving object's tile column and, when its masked column reaches TURN_COLUMN_LIMIT [code], either starts
the turn animation or — if ANIM_ARMED_LATCH [code] is still clear — builds the interior sprite band,
reloads TURN_COLUMN_LIMIT from ROM, and sets ANIM_ARMED_LATCH = 1 to block rebuilding; the interior
entry instead forces TURN_COLUMN_LIMIT = `0xff`. The rope grab is armed by `loc_305f`: it reads a
catch-window half-width from ROM keyed by a slot index and fires only when the rope-hook X sits within
±7 of the player X and neither WAVE_TEARDOWN_STATE nor FORMATION_STATE is busy — then it sets
GRAB_ACTIVE_FLAG = 1 and aborts the caller.

The hunter formation gathers, launches, and tears down through FORMATION_STATE. `loc_308b` runs only
when its enable cell is set; while FORMATION_STATE == 0 it scans the enemy records for launch-ready ones,
registers each record pointer into the next FORMATION_SLOT_TABLE slot (stride 2), marks it state 5, and
once four slots are registered arms FORMATION_STATE = 1. Thereafter it dispatches `(FORMATION_STATE&3)−1`
into launch handlers behind the shared teardown epilogue `loc_32bd`. The launch handler `loc_30f1` seeds
all four registered hunters with anim/coord/tile bytes from ROM and a `0x30`-frame delay, primes a wave
timer, advances FORMATION_STATE, and seats the launch script pointer at LAUNCH_SCRIPT_PTR [code].
Teardown (`loc_32bd`) keys on WAVE_TEARDOWN_STATE: state 1 clears WAVE_EVENT_LATCH [seen] and reloads its
timer, then advances the state; state 2 drives a shared vertical cell downward by two per frame until it
passes `0xdb`, then sets a completion flag and advances; a nonzero WAVE_TEARDOWN_STATE also marks the
machine busy so no new grab or periodic event fires. That periodic event is the WAVE_EVENT_LATCH
mechanism (`loc_196e`): gated by SPAWN_PHASE_COUNTER, its shared tail runs a countdown that, on expiry —
and only while WAVE_EVENT_LATCH and WAVE_TEARDOWN_STATE are both clear — reloads, sets WAVE_EVENT_LATCH
= 1, and fires the periodic event; teardown clears the latch again. During the eagle approach
(`loc_71ce`, gated on WAVE_HOLD_TIMER == 0) the enemy's screen X is compared to thresholds `0x59`/`0x60`:
crossing `0x60` captures X into LATCHED_ENEMY_X and, while that latch holds, forces the aim-indicator
bits; LATCHED_ENEMY_X is cleared at the eagle-phase reset. Finally, round framing and scoring:
level-intro is a seven-phase machine in INTRO_PHASE_INDEX [code] dispatched through the table at
`0x6daa`, whose phase-0 handler seats a script-timer word from ROM (indexed by `min(7, ROUND_COUNTER>>2)`)
into LAUNCH_SCRIPT_PTR, primes INTRO_DELAY_CKSUM_WORD [seen] to `0x40`, and advances the phase; a later
phase advances when the script hits its `0xff` terminator. Target scoring uses TARGET_GROUP_COUNT
[code], computed from ROUND_COUNTER and clamped to 5..8 when the sprite group is fanned out, against
HIT_TALLY [code], which is incremented on every proximity hit; at end-of-phase the handler compares
3×TARGET_GROUP_COUNT to HIT_TALLY and, on an exact match, forces the bonus phase and the perfect-clear
value. HIT_TALLY and ANIM_ARMED_LATCH are cleared at board reset.

## Rendering, HUD and display lists

The machine rebuilds a 24-entry sprite display list at SPRITE_DISPLAY_LIST [seen] (`0x8840`) every
frame. `loc_02ef` assembles it by pulling groups of object records into the list: most groups are
copied raw by `copyObjectRecordsToDisplayList` [code], which emits record bytes `+0x06`, `+0x10`,
`+0x04`, `+0x0f` — a Y byte, a code byte, an attribute byte and an X byte — into each four-byte slot,
while the moving-object records in the arena go through a variant that derives the two coordinate bytes
instead of copying them: it takes each object's 16-bit sub-pixel pair, shifts it left three, and biases
by −8 to land a screen coordinate. Records feeding the list come from SPRITE_ACTOR_RECORD_SLOTS [seen],
SPRITE_TARGET_SLOTS [seen] and the moving-object block at ENEMY_ACTOR_TABLE. Once a shared counter
reaches zero the whole list is vertically mirrored for a flipped cabinet by `mirrorSpriteListVertically`
[code]: each entry's two coordinate bytes are rewritten to `−(byte)−0x10` and its attribute byte keeps
its palette nibble but has its two flip bits toggled — and this pass is gated so it only runs when
FLIP_SCREEN_FLAG marks the screen flipped. The finished list is never drawn by the CPU directly; the
vblank service `loc_066d` streams it from `0x8840` into the two sprite-hardware banks at `0x9010` and
`0x9410` (the `loc_0714` copy loop, splitting each four-byte record across the two banks), and the
epilogue copies FLIP_SCREEN_FLAG into the hardware flip-screen latch at `0xa187` bit 7.

The tilemap itself is painted through several primitives. `seedTileFillCursor` [code] arms a row-by-row
fill by storing a write cursor to TILE_FILL_PTR [seen] and seeding FILL_ROW_COUNTER [seen] to `0x20`;
`loc_02ce` then, one pass per call, fills B blank tiles (code `0x10`) at the cursor, advances the cursor
by a net full row (`+0x20`), and decrements FILL_ROW_COUNTER, so 32 passes paint a B-wide strip 32 rows
tall. `fillAttributeColumns` [code] floods the colour/attribute map at ATTRIB_MAP_BASE [code]
(`0x8040`), walking 31 columns and stamping one source byte down all 30 rows of each at the `0x20`
stride. Fixed graphics are stamped by block blitters — `blitTile3x3Block`, `blit2x2TileBlock`,
`paintTileBlock2x2` and `paintTileBlock2x2Above` (the "Above" variant anchored bottom-left with its top
row one row up), `blitGlyphBlock4x3` (a 4-row by 3-column glyph that advances only the destination low
byte per cell so it stays inside its 256-byte page), and `copyBiasedTileString` (copies a string adding
a `+8` tile bias, ending on a `0xa0` terminator) — while `paintColumnBodyTiles`, `paintColumnBodyTilesUp`
and `blankTileColumn` paint or erase three-tall vertical columns. Separately, a VRAM layout stream is
drawn by the display-list interpreter `loc_4381`: it copies bytes from a source stream to a destination
VRAM pointer — the pointer pair taken from DISPLAY_LIST_DST_PTR [seen]/DISPLAY_LIST_SRC_PTR [seen] or
from an alternate pair depending on the display sub-phase — honoring a `0x10` skip opcode and a `0xff`
opcode (reload the destination and add a byte into SUBPHASE_TICK), then writing the advanced pointers
back.

Two animation cursors run against this backdrop. ANIM_SCRIPT_CURSOR [seen] (`0x8f00`) is a per-actor
animation-script pointer stepped by `loc_22e6`: each actor record carries a frame countdown, and while
it is nonzero the routine only decrements it; at zero it pulls the next three-byte {tile, colour, delay}
entry from the cursor and advances it, with a `0xff` lead byte acting as a control marker that either
resets the cursor to a fixed script address or loads an inline two-byte cursor. The second cursor,
TILE_ANIM_CURSOR [seen] (`0x88be`), animates a tile strip directly in video RAM under the parity gate
TILE_ANIM_PARITY [code]: every pass bumps the parity tick, and `advanceTileAnimForwardOnOdd` acts only
on odd ticks — stepping the tile code under the cursor up and, at the wrap code, stepping the cursor
forward and reseeding — while `retreatTileAnimScript` acts only on even ticks, stepping the code back
down and, at its marker, reloading the base code and backing the cursor up; the common parity tick makes
successive passes alternate direction, so the strip animates forward then back.

The HUD is repainted from BCD and state cells. Scores flow through `loc_0496`: an index selects a
three-byte BCD increment, it is BCD-added into the active player's counter — the buffer chosen from
ACTIVE_PLAYER bit 0, either P1_SCORE_BCD or P2_SCORE_BCD — the column is re-rendered, and the new value
is then compared most-significant-byte-first against the high score at HIGH_SCORE_BCD_HI [seen]
(`0x88aa`); if it is higher it is copied down and re-rendered. The shared BCD-to-tile splitters are
`splitBcdByte` [code] and `drawStackedBcdDigits` [code], with `binToPackedBcd`/`byteToPackedBcd`
converting binary counts to packed BCD and `renderDigitWithBlanking` writing each digit tile (or a blank
for a suppressed leading zero) stepping up one row. The vertical phase gauge is drawn by `renderPhaseGauge`/
`paintPhaseGauge` [code]: they read GAUGE_PHASE_COUNTER and draw `count−1` filled tiles (`0xb0`) clamped
to five upward from PHASE_GAUGE_BASE_TILE [code] (`0x863f`), blanking the rest. The stage number comes
from `renderStageCountdownDigits` [code], which draws STAGE_COUNTDOWN as up to two digits at
HUD_STAGE_DIGIT_LO [code] (`0x8743`), BCD-converting values of ten or more (that path gated by
PLAY_MODE_LATCH) and suppressing a leading-zero tens digit; `loc_1f2f` renders the round tag from
ROUND_COUNTER + 1. The status panel is painted by `renderPanelFromTable` [code], walking ten rows of
three cells from PANEL_TILE_SOURCE [code] (`0x8e00`) into PANEL_VRAM_DEST [code] (`0x8567`) and
substituting a blank tile for any zero source cell. The high-score screen is built by `loc_03e9`, which
draws its label fields through a table-indexed text renderer and then renders the ten-entry
HIGH_SCORE_TABLE [code] (`0x8a00`), splitting each stored byte into BCD nibble tiles with leading-zero
suppression.

The attract mode lays its text down over time. ATTRACT_SUBSTATE [seen] (`0x8e51`) selects one of seven
handlers each vblank, and text is written incrementally under a timed script: SCRIPT_FRAME_TIMER [seen]
(`0x8e50`) counts down every frame, and only on its expiry does a handler pull the next byte from a
script source and write it through SCRIPT_WRITE_PTR [seen] (`0x8e56`), backing the write pointer up one
tilemap row, while a slower secondary tick reseeds the timers and runs a rolling column checksum of what
was placed. DISPLAY_MSG_BUF [seen] (`0x89f0`) is a small message buffer that ROM strings are decoded
into (each byte biased by −0x88 into a tile code), where other code matches it for completion and clears
it.

## Sound

The main CPU carries no sound-generating hardware of its own; every effect and tune is produced by a
second, independent Z80 (the audio board), and the main CPU's entire involvement is to hand that CPU a
one-byte command and knock on its door. That handoff is the whole of the sound-command emitter
(`sendSoundCommand`). With the command byte in the accumulator, the routine writes it into
SOUND_COMMAND_LATCH [code] (`0xa100`) — the shared latch the audio CPU reads to learn which sound to
play. Writing the command alone does nothing audible; the audio CPU must be told a fresh command has
arrived, so the emitter then strobes the audio-IRQ line, driving one bit of the board's addressable
output latch, AUDIO_IRQ_LATCH [code] (`0xa181`, mainlatch bit 1): it writes 1 to raise the line, holds
the pulse for a fixed width, then writes 0 to lower it. That rising-then-falling edge asserts an
interrupt on the audio CPU, which wakes, reads the byte in SOUND_COMMAND_LATCH, and plays the
corresponding effect. The only lasting effects are the latched command byte and the interrupt pulse; how
the audio CPU decodes a command value into a specific sound lives entirely on that second processor.

## Anti-tamper

Pooyan salts its ROM with a family of self-check routines that each fold a fixed block of program bytes
into a small checksum, compare that result against a hard-coded sentinel or reference, and — only on a
mismatch — raise a flag or bump a strike counter. Every guard has a quiet pass path: on an authentic
image the fold hits its expected value and the routine returns having touched nothing, so on an intact
ROM every one of these cells stays at zero. The guards differ in what block they cover and how they fold
it. The signature sampler `verifyRomSignature` [code] walks the sixteen bytes of SIGNATURE_REFERENCE_TABLE
[code] against every eighth byte of the code region beginning at SIGNATURE_SAMPLE_BASE [code] (stepping
the sample pointer by 8, the reference by 1), and on the first byte that differs it writes
SIGNATURE_MISMATCH_FLAG [code] = 1 and stops. The state-10 guard `verifyRomChecksum` [code] sums sixteen
bytes descending from ROM_CHECKSUM_TOP [code] into a single byte, then reads its shape: a healthy sum
has bit 0 clear, bit 5 set and bit 7 set, and any other pattern increments TAMPER_STRIKES_STATE10
[code]. The high-score-table guard `flagHighScoreTableCorruptOnChecksumMiss` [code] checks the four-byte
block at HISCORE_CHECKSUM_BASE [code] — its header byte must be the `0xc8` marker, then the four bytes
are summed with carries counted separately and (sum minus carry count) must equal `0x59`; a wrong header
or total sets HISCORE_TABLE_CORRUPT_FLAG [code] = 1. Because that block lives in work RAM and is
maintained by the game's own score writer, it too reads trusted in normal play.

Several more guards are woven into ordinary gameplay routines. Two signature checksums feed
TAMPER_STRIKES_SIG [code]: `loc_1bcc` folds fourteen bytes at `0x5328` (each masked to its low five
bits) and — counterintuitively — does not freshly zero its accumulator, inheriting the `0x89bf` left in
`DE` by the block-copy that immediately precedes the fold, so the sentinel is tuned around that seed;
while `loc_4103` sums the low nibbles of fifty-six bytes at `0x557f` and expects a specific total. The
ROM-block guard `loc_7e6d`, armed only when a lives count is at least four and the frame counter is
zero, sums ROM downward from `0x64be` until it meets a sentinel byte and strikes TAMPER_STRIKES_ROM
[code] on a bad total. `verifyTableChecksum` [code] performs a plain sixteen-bit sum over a table and
demands a fixed low/high pair, otherwise raising TAMPER_ROM_CHECK_FLAG [code] = 1. The master freeze
tally TAMPER_FREEZE_FLAG [code] is bumped by three guards — `loc_1b43` (a thirty-four-byte fold expecting
`0x7c`), `loc_5594` (an eight-byte guard summed against a local signature table), and
`flagTamperOnRound5ChecksumMiss` [code] (which fires only at round five). A wrapping-sum guard `loc_3865`
raises SIGNATURE_MISMATCH_FLAG, the same cell the sampler uses.

The raised cells are read back by the normal per-frame machinery, so a detected tamper degrades the
game rather than halting the CPU. TAMPER_FREEZE_FLAG is the broadest: the actor-group driver `loc_241e`
aborts before its state dispatch when it is nonzero, so actor updates stop; the phase-1 spawner
`loc_6e75` ORs it with SIGNATURE_MISMATCH_FLAG and, if either is set, jumps its skip-spawn branch to an
address that is actually data, so spawns never run on a tampered image; and the round/bonus HUD routine
`loc_1ead` skips its field blit and round-number render when the flag is set. The signature strike
counters are read as a contiguous block — a colour-parity render requires all three of
TAMPER_STRIKES_SIG/TAMPER_STRIKES_STATE10 (and the byte after) to be zero before it runs — and
TAMPER_STRIKES_ROM gates lead-actor progression and is consulted by several per-frame routines, while
HISCORE_TABLE_CORRUPT_FLAG is probed by the object-update gate. Because an authentic ROM passes every
guard, all of these consumers take their normal path in ordinary play; the tamper machinery is invisible
until the image is altered.
