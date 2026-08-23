# Pooyan — how the machine works

This document describes how the Pooyan machine actually runs, subsystem by subsystem, from the
current code. It is a present-state description, not a history: it says what each routine and cell
does now, with a grounding tag on every role.

The machine is a single Z80 driving a tile-and-sprite video board. A power-on reset builds the work
RAM and runs a program self-test; from then on the game free-runs a main loop while the vblank NMI,
firing once per frame, does all the per-frame work — sampling inputs, draining the display-command
ring into video RAM, and stepping the game-state machine. Work RAM at 0x8800-0x8FFF holds the config,
the per-frame game state, the actor arena, and the display/sound rings; the video planes live at
0x8000 (colour), 0x8400 (tiles) and 0x9000/0x9400 (sprites); hardware I/O sits from 0xA000 up.

The sections below follow the machine from the ground up: the memory map and state model it all rests
on, the frame loop that drives it, the power-on configuration and coin/start handling, the in-play
progression state machine and its timers, the actor arena where enemies live and spawn, the enemy
attack waves, how all of it is turned into pixels, the sound-command path, and the anti-tamper guards.

## Legend

Every cell and routine role carries a confidence tag:

- **[seen]** — the reading ends in a MAME observation (a value watched change, a poke, a write tap).
- **[code]** — read from the code: consistent across the routines that touch it, MAME-grounding pending.
- **[guess]** — inferred; the least certain, flagged so it is not trusted as fact.

A cell with no tag is named but its role is not yet pinned. Where a reading is counterintuitive, a
callout warns about it in place.

## The work RAM and its state model

Pooyan keeps its entire mutable state in the 2 KB work-RAM window from 0x8800 to 0x8FFF. The
whole machine is driven from a single top-level state byte in that window, `MAIN_GAME_STATE`
[seen], and everything else — the demo attract, the board build-up, the live round, the credit
and player bookkeeping — hangs off the value of that byte. This section describes how that state
model is laid down at boot and how it advances itself frame by frame.

### How the frame drives the machine

There are two spines. The `loc_0092` boot entry hands control to a free-running main-loop
generator that drains the display-command ring, and a vblank interrupt fires the per-frame
service routine `loc_066d` on top of it. `loc_066d` is where the state model actually turns: each
vblank it saves the full register file, masks the NMI, rebuilds the scrolling tile columns,
samples the three input ports (complemented, active-low) into the `INPUT_PORT0` [seen]
edge-detect ring, ticks the free-running `FRAME_COUNTER` [seen], and then reads `MAIN_GAME_STATE`
and dispatches through a five-entry jump table in ROM at 0x06f0. The selected handler runs, then
returns into the service routine's epilogue, which restores every register and re-arms the NMI.
Because the whole thing runs inside a saved/restored register frame, the only way any state
handler communicates forward is by writing work RAM — the register file it leaves behind is
thrown away.

The 0x06f0 table has one word per value of `MAIN_GAME_STATE`:

- **State 0 — attract board setup** (`loc_072d`). Blanks one row of the row-by-row tile fill per
  call, early-returning while rows remain; once the fill drains it advances the machine into
  attract-demo.
- **State 1 — attract/demo driver** (`loc_0899`). Runs the demo sequence.
- **State 2 — board build** (`loc_0c4e`). Constructs the playfield for a fresh life/board.
- **State 3 — play** (`loc_159b`). The live round.
- **State 4 — idle** (`noopStateHandler`). A bare return that advances nothing; dispatching it
  simply does nothing for that frame.

So `MAIN_GAME_STATE` is a small selector, not a rich value — the observed run visits 0, 1, 2, and
3 (four distinct values) [seen], and each handler is responsible for writing the next value into
the byte when its phase is done.

### The two nested sub-state dispatchers

Two of the top-level handlers are themselves selectors over a second state byte, and both use the
same shape: read a sub-state index, jump through an inline word table to the chosen handler, and
have that handler return into a continuation seated just past the table.

`PLAY_STATE_INDEX` [seen] is the in-play sub-state. In state 3, `loc_159b` first ticks the BCD
play-timer, then dispatches `PLAY_STATE_INDEX & 0x1f` through the table at 0x15a8 (via the shared
dispatcher `loc_15a1`). Its value is a discrete phase step — the run walks it through values like
1, 2, 3, 4, 7, 10, 13 and 18 [seen] as the round moves through its intro and round phases — not a
dense counter. The play handler always returns into `loc_15d1`, the end-of-life housekeeping step
described below. `PLAY_STATE_INDEX` is *also* the sub-state that state 2 (`loc_0c4e`) dispatches
on, this time through a small table at 0x0c56 whose three entries build the board across
successive frames before the machine moves on to play.

`ATTRACT_SUBSTATE` [seen] is the demo sub-state. In state 1, `loc_0899` reads it and dispatches
through the table at 0x08a1 into the nine-entry demo handler set; the run cycles it 0..8 [seen]
as the attract animation and demo playthrough advance, each handler bumping or setting it to move
to the next phase.

### The observed attract/play cycle

Following the state bytes end to end: the boot lands the machine in state 0, where the attract
board is drawn a row at a time. When the tile fill finishes, `loc_072d` — gated on the boot
self-test having passed (it requires `ROM_SELFTEST_TALLY` [code] to read as a full pass, else it
abandons setup) — clears `GAME_ACTIVE_FLAG` [seen] to 0, sets `MAIN_GAME_STATE` to 1, zeroes
`PLAY_STATE_INDEX`, floods the attribute map, and clears `ATTRACT_SUBSTATE`. The machine is now in
attract-demo (state 1).

A game starts on a coin plus a start press (`GAME_ACTIVE_FLAG` goes 0->1 at start, coinciding with
the top-level state leaving attract) [seen]. The start path drops the machine into the board-build
state (state 2): it clears `GAME_ACTIVE_FLAG`, zeroes `PLAY_STATE_INDEX`, and writes 2 into
`MAIN_GAME_STATE`. State 2 constructs the board across a few frames and then advances into play
(state 3), where the round actually runs.

Between lives and boards, the play handler's continuation `loc_15d1` closes the loop. It runs
every frame after the play dispatch returns, and its logic is the hinge of the whole cycle: while
`GAME_ACTIVE_FLAG` is still nonzero it does nothing (the round is live); on free play
(`COINAGE_CONFIG` [seen] reads the free-play value 0x0f) it tails to the shared attract epilogue;
with no credit left (`CREDIT_COUNT` [seen] is 0) it simply returns. Otherwise — a life ended and
there is credit to continue — it forces the machine back to the board-build state (writes 2 into
`MAIN_GAME_STATE`, zeroes `PLAY_STATE_INDEX`), runs the board/HUD reset and the actor-arena clear,
and blanks an eight-tile attribute column. That is what carries the machine from the end of one
life or board around to the build of the next. At game over the machine is reset the other way,
back toward attract: `GAME_ACTIVE_FLAG`, `PLAY_STATE_INDEX`, `ACTIVE_PLAYER`, `TWO_PLAYER_FLAG`
and `ATTRACT_SUBSTATE` are all cleared and `MAIN_GAME_STATE` is set to 1.

### The game-active gate and game-over

`GAME_ACTIVE_FLAG` is the single in-play gate. It is set to 1 at the start of a life and cleared
to 0 at game over [seen]; the play-side handlers return early when it reads 0, and `loc_15d1`
reads it to decide whether the round is still live. It is the one flag that distinguishes "a round
is being played" from "the machine is running its state machine with no live player," and it is
distinct from `MAIN_GAME_STATE`: the top-level state can be in play (state 3) while the active
flag has just been cleared, which is exactly the window `loc_15d1` uses to unwind the round.

Remaining lives are tracked per player, not globally. `PLAYER0_LIVES` [seen] and `PLAYER1_LIVES`
[seen] are each seeded from the cabinet lives count `LIVES_DSW` [code] at board reset, decrement
on death, and gate the player-switch and game-over decisions when they hit zero.

### The play-mode and player latches

`ACTIVE_PLAYER` [seen] selects which player's banks are live: bit 0 clear selects player 1's
score and state banks, set selects player 2's. In a two-player game it toggles between the two
players exactly on each swap (on a player's death) [seen]. `TWO_PLAYER_FLAG` [seen] is nonzero for
a two-player game; it is set when a two-player game starts and gates the per-player bank selection
(together with `ACTIVE_PLAYER`) and the two-player start event. Both are cleared on the return to
attract.

`PLAY_MODE_LATCH` [code] is a separate, multi-valued (0/1/2) mode latch set by the gameplay
handlers and by the post-countdown path; it selects alternate update paths and table variants. It
is not a player index (both players run with it at 0) and not an attract flag — it is purely a
play-side branch selector.

### The boot layout of work RAM (0x8800-0x8FFF)

The `loc_0092` boot entry lays down the entire initial state. First it runs the program-memory
self-test — a 24-bit rolling checksum over the eight 4 KB program banks, seeded with the bank
count and bumped once per matching bank, landing at twice the bank count (0x10) on a wholly-intact
image — and writes that tally to `ROM_SELFTEST_TALLY` at the very top of the window. That cell is
deliberately placed above the boot stack (the boot seeds its stack pointer one word below the top
so the per-frame register-save cannot clobber the tally), because the attract-setup handler later
refuses to finish unless the tally reads as a full pass.

It then zeroes the whole work-RAM span except that tally word, marks both the display-command and
sound-command ring buffers empty (0xff in every slot) and parks their read and write cursors at
their origins, sets `FLIP_SCREEN_FLAG` [seen] to 1 (upright orientation — this flag is copied into
the hardware flip latch every frame by the service routine), floods the colour map, and arms the
row-by-row tile fill.

The DIP switches are decoded once here into their work-RAM config cells, and they are boot-only —
nothing rewrites them during play. From DIP bank 1 (read active-low, so the port is complemented
first) it derives `CABINET_MODE_FLAG` [code] (cocktail/upright), `BONUS_AWARD_DSW` [code] (the
extra-life award schedule), `DIFFICULTY_DSW` [code] (three bits scaling the enemy spawn
schedules), `DEMO_SOUNDS_DSW` [code] (attract-sound enable), and the lives count `LIVES_DSW`
[code]. From DIP bank 0 it decodes the two coinage nibbles through the coinage table into
`COINAGE_CONFIG` [seen] (slot 1) and `COINAGE_CONFIG_SLOT2` [code] (slot 2), where the value 0x0f
means free play.

Finally the boot clears the sprite banks and blanks the lower tile map, silences the audio CPU,
enables the vblank interrupt (writing `NMI_ENABLE_LATCH` [code]), lays down the default
ten-entry high-score table (each entry seeded to a nominal 10000 via a (0,0,1) triple, plus the
top-score high byte `HIGH_SCORE_BCD_HI` [seen] set to 1), clears the status-panel digit source,
and hands control to the main-loop generator. At the instant control reaches the main loop,
`MAIN_GAME_STATE` is 0 (its cleared value), so the first frames run the attract board setup and
the cycle above begins.

The core state cells all sit in the low part of the window: the DIP-derived config bytes and the
credit counter near 0x8800, the top-level and sub-state selectors and the game-active flag in the
0x8805-0x880e cluster, the input-sample ring at 0x8810, and the orientation and coinage cells just
above. The play-timers, fill counters, sprite display list, per-player score and state banks, and
the round/wave machinery occupy the rest of the window, all of it zeroed at boot and rebuilt by
the state handlers as the machine moves through attract, build, and play.

## The frame loop and the vblank heartbeat

Pooyan runs on two interleaved threads of control: a foreground main loop that never
waits, and a vblank NMI that fires once per displayed frame. The foreground consumes
work that the NMI produces, and the NMI advances the game one step and refills the
foreground's work queue. Understanding the machine means seeing how these two hand
off to each other, and where the frame boundary actually lands.

### Arming the heartbeat at boot

The power-on reset vector `loc_0000` [code] does one thing before anything else: it
writes 0 to `NMI_ENABLE_LATCH` [code], holding the vblank interrupt off. That mask is
only for the duration of boot — the game must not take an interrupt while it is still
laying down its initial state — and it leaves no lasting mark, because the boot entry
re-arms the latch before it hands off.

Control falls straight into the boot entry `loc_0092` [code], which builds the whole
initial machine: it self-tests the program memory, zeroes work RAM, floods the colour
map, decodes the DIP switches, seeds the default high-score table, and — the part that
matters here — initialises both command rings. Both the display-command ring and the
sound-command ring are marked empty (every slot stamped with the free marker) and
their read and write cursors are parked at the ring origin, so the foreground starts
with nothing to drain. The screen-orientation flag `FLIP_SCREEN_FLAG` [seen] is set to
the upright value. Only at the very end, after the audio CPU has been silenced, does
the boot write 1 to `NMI_ENABLE_LATCH` [code] — that single write arms the heartbeat.
From this instant the machine is live: the next vblank will fire the NMI. The boot then
hands control to the foreground loop and never returns.

### The foreground loop: draining the display-command ring

The foreground is the main-loop state driver `mainLoop` [code]. It free-runs with no
wait for vblank — it simply spins. Each pass looks at the display-command ring's read
cursor `DISPLAY_CMD_RING_READ_PTR` [code], which walks the ring buffer
`DISPLAY_CMD_RING_BUFFER` [code], and inspects the slot it points at. Two things can
happen:

- **The slot is occupied** (its high bit is clear). This is a pending display command.
  The loop pulls the two-byte command out, frees the slot, advances the read cursor
  (wrapping it back to the ring origin at the top of the ring), and jumps through a
  handler table indexed by the command's type. The handler writes tile and sprite data
  into video RAM. Then the loop goes round again to look at the next slot. This is how
  drawing reaches the screen: the game never touches video RAM directly from its
  per-frame logic; it *enqueues* commands, and the foreground interprets them.

- **The slot is free** (its high bit is set). The ring is drained — there is no more
  queued drawing to do. Now the loop runs the per-frame worker `loc_0254` [code], which
  repaints the scrolling tile columns (and, when the worker control byte's low nibble
  is set, runs a program-signature integrity check instead). Reaching this ring-idle
  state, worker included, is the machine's real per-frame quantum.

The important consequence is that the ring is drained **completely** each frame, not one
command per interrupt. A backlog built up on the credit screen must clear in one pass,
or stale attract tiles would linger on the playfield. So the foreground keeps
dispatching commands until the ring runs dry, and only then does it run the worker.

### The synthetic frame boundary

Real hardware would have the foreground busy-wait on a vblank status bit; here the
frame boundary is synthetic. It is defined as the worker/ring-idle pass — the moment the
foreground has drained every queued command and run `loc_0254` [code]. That is the one
pass per frame that corresponds to "everything for this frame is now drawn." At exactly
that point the machine fires the vblank NMI, then resumes the foreground. Every other
pass of the loop — the ones that dispatch a command and go round again — is *inside* one
frame, not a frame of its own. So a frame is: drain the ring, run the worker, take the
NMI, repeat.

### The vblank NMI worklist

The NMI service routine (entered at the vblank vector, which tails immediately into
`loc_066d`) is the heartbeat. It runs a fixed worklist in order:

1. **Save state and go quiet.** It pushes the entire register file — main set, shadow
   set, and both index registers — then writes 0 to `NMI_ENABLE_LATCH` [code] to mask
   further interrupts while it works.

2. **Rebuild the sprite display list.** It copies sprite-attribute records into the
   hardware sprite registers via `loc_0714` [code]. In the tile-fill state it copies
   four column groups; in every other state, a single tall group.

3. **Kick the watchdog.** A write to the hardware watchdog port keeps the board from
   resetting — proof of life that must happen every frame.

4. **Sample the inputs into the edge-detect ring.** The three input ports are read
   active-low and complemented, then written to the head of the input ring at
   `INPUT_PORT0` [seen] and its two neighbours (coin on bit 0, 1P-start on bit 3,
   2P-start on bit 4). Before that, the routine shifts the previous frames' samples
   down the ring so state handlers can detect a fresh press as an edge rather than a
   held level.

5. **Tick the frame counters.** It decrements the worker control byte
   `WORKER_CONTROL_BYTE` [code] and the free-running `FRAME_COUNTER` [seen]. Note both
   are *down*-counters, decremented once per NMI; `FRAME_COUNTER` wraps 0→255 and its
   low bits phase animations while its zero-crossings gate periodic integrity checks.

6. **Service credits and sound.** It runs the credit/coinage update chain, then drains
   one entry from the sound-command ring via `drainSoundCommandRing` [seen], handing the
   queued byte to the audio CPU (unless both demo-sounds and the in-play gate are off,
   in which case it stays silent). Unlike the display ring, the sound ring is drained one
   entry per frame, not to empty.

7. **Step the game state.** It reads the top-level state selector
   `MAIN_GAME_STATE` [seen] and jumps through a state table into the handler for
   attract, intro, or play. This handler is where the game's per-frame logic lives — it
   moves actors, runs collision, updates the HUD — and, crucially, it is what *enqueues*
   the display commands that the foreground will drain on the next lap. The handler
   returns to the NMI epilogue.

8. **Latch orientation, restore, re-arm.** The epilogue copies `FLIP_SCREEN_FLAG` [seen]
   into the hardware flip-screen latch `FLIP_SCREEN_LATCH` [code] (bit 7), restores every
   saved register, writes 1 to `NMI_ENABLE_LATCH` [code] to re-arm the heartbeat, and
   returns to the interrupted foreground.

### The per-frame order, end to end

Putting the two threads together, one frame runs like this. The foreground drains the
display-command ring, dispatching each queued command into video RAM until the ring is
empty, then runs the per-frame scroll worker `loc_0254` [code]. That ring-idle pass is
the frame boundary, so the vblank NMI fires: it saves state, rebuilds the sprite list,
kicks the watchdog, samples inputs into the edge-detect ring, ticks the frame counters,
services credits and one sound command, and steps the game state through the
`MAIN_GAME_STATE` [seen] table. That state handler produces the *next* frame's drawing
by enqueuing display commands. The NMI re-arms itself and returns; the foreground picks
back up and drains the freshly-queued commands, and the cycle repeats. Production in the
NMI, consumption in the foreground, with the ring buffers as the boundary between them.

## Configuration, coinage and players

This subsystem turns the cabinet's two DIP-switch banks and its coin/start inputs into the machine's
run-time configuration: how many lives a player starts with, how hard the game plays, how coins
convert to credits, and how a credit is spent to seed one or two players into a live game. Almost
all
of it is established once at power-on and then merely consumed; the coin/credit path is the part
that
stays live frame to frame.

### Power-on configuration

The boot entry `loc_0092` [code] reads both DIP banks and decodes them into work-RAM config cells
that
the rest of the game treats as the settled configuration. DIP bank 1 (`DSW1_PORT` [code], the read
side of the watchdog address) is sampled active-low, so the boot complements it and then rotates the
byte through a series of positions, peeling off one field at a time. The complemented byte yields,
in
order, the cabinet orientation into `CABINET_MODE_FLAG` [code] (a single bit choosing upright versus
cocktail), the bonus-award schedule selector into `BONUS_AWARD_DSW` [code], a three-bit difficulty
value into `DIFFICULTY_DSW` [code], and the attract-mode demo-sound enable into `DEMO_SOUNDS_DSW`
[seen]. The two low bits of the same byte choose the lives count: they are read directly (not
complemented) and mapped into `LIVES_DSW` [code] — a raw `3` becomes the sentinel `0xff` (the
free/unlimited setting), any other value is offset up by three, so the switch selects three, four,
or
five starting lives.

Coinage comes from DIP bank 0 (`DSW0_PORT` [code]). Its two nibbles are looked up independently
through the ROM `COINAGE_TABLE` [code] at 0x0053: the high nibble becomes the second coin slot's
coinage in `COINAGE_CONFIG_SLOT2` [code] and the low nibble becomes the first slot's coinage in
`COINAGE_CONFIG` [seen]. The value `0x0f` in either cell is the free-play sentinel, and that
sentinel
is consulted in several places later rather than being resolved to a flag here. With the config in
place the boot also lays down the default ten-entry high-score table, marks the command rings empty,
enables the vblank interrupt, and hands off to the born-live main loop.

### The three coin acceptors and the credit counter

Every vblank the NMI service routine (`loc_066d`) samples the three hardware input ports active-low
into an edge-detect ring whose head is `INPUT_PORT0` [seen]; the coin and start lines live in that
sample. From the same interrupt it runs the credit/coinage chain at `loc_59e8`, but only after a
guard: if either coinage cell holds the free-play sentinel the whole chain is skipped, since on free
play there is nothing to count.

When it does run, the chain drives three coin acceptors, each a small per-frame step that watches
its
own phase of the coin sample and, on a coin edge, converts inserted coins into credits deposited in
the shared `CREDIT_COUNT` [seen]. The simplest, `loc_5a06` [code] (variant A), rotates one input
phase
bit into a cadence ring (`DRIP_RING_A` [code]) each frame and, when the ring settles on its fire
phase, adds one straight into the credit counter. The other two acceptors carry their own
coin-insert
accumulators and divide by the configured coinage: an accepted coin advances the accumulator, and
only
once the accumulator overtakes the slot's coinage value does it wrap and grant credit — variant C
against `COINAGE_CONFIG`, variant B against `COINAGE_CONFIG_SLOT2`. All three funnel through a
shared
accumulate tail that adds to `CREDIT_COUNT` and clamps it at 99 (0x63), so the counter can never
overflow its two-digit display, and each queues a credit-display refresh command.

Each accepted coin on the metered slots also bumps a queued pulse count for the physical coin meter
—
`COIN1_PULSE_COUNT` [code] for the first meter and a sibling count for the second. `loc_5a9c` [code]
turns those queued pulses into a timed strobe on the hardware coin-counter line
`COIN1_COUNTER_LATCH`
[code]: a fresh pulse seeds the phase timer `COIN1_PULSE_PHASE` [code] and raises the latch, the
phase
then counts down, the latch drops at a fixed mid-point, and one queued pulse is retired when the
phase
reaches zero. This gives the mechanical coin meter a clean on/off pulse of the right width per coin.

### Displaying credits and free play

The credit field is drawn by `loc_05ee` [code], which reads `CREDIT_COUNT`, clamps it to 99, and
converts it to packed BCD: the tens digit is written to `CREDIT_HUD_TENS_VRAM` [code] only when it
is
non-zero (so a single-digit credit count shows without a leading zero) and the units digit always to
`CREDIT_HUD_UNITS_VRAM` [code]. Riding on that same routine is a hidden anti-tamper tripwire: only
when
the units digit is exactly 2 does it sum a fixed 31-byte program block and, if the sum misses the
sentinel a clean ROM image produces, bump a tamper-strike counter — a check disguised as ordinary
HUD
work.

Which prompt the credit line shows is chosen by `queueCreditDisplayCommands` [code]: it always
enqueues the primary display command, and when `COINAGE_CONFIG` holds the free-play sentinel it
additionally enqueues the free-play label command, so a free-play cabinet reads "FREE PLAY" instead
of
a coins/credits prompt.

### Spending a credit and starting a game

Starting is gated in the attract state. The guarded trigger `loc_7fd6` [code], reached through the
attract dispatch, refuses to do anything while `CREDIT_COUNT` is zero. It then confirms a game is
not
already in progress — folding the two-player flag, the active player's remaining lives, and the
gauge
counter into a status byte that must be zero — and finally checks that the start bits (the 0x18
mask,
covering the one- and two-player start lines) are set in the input sample. Only then does it emit a
start sound and enter the start handler.

The start handler reads the coin/start sample and branches by which start button was pressed. The
one-player path requires and consumes a single credit, decrementing `CREDIT_COUNT` and beginning the
game as a one-player game. The two-player path requires at least two credits, subtracts two, runs
its
own checksum tripwire, and begins as a two-player game. Either way it reaches the common
start-of-life
setup, which writes the player-selection word: `ACTIVE_PLAYER` [seen] (which bank the live game
reads)
and `TWO_PLAYER_FLAG` [seen] (non-zero only for a two-player game). That setup raises the in-play
gate
`GAME_ACTIVE_FLAG` [seen] to 1, advances the top-level game state `MAIN_GAME_STATE` [seen] to the
play
state (3), re-queues the credit display, fires the start sound events, and — for a two-player game
only
— clears an extra per-game state block.

`MAIN_GAME_STATE` is itself the selector for a jump table the NMI dispatches through each frame: the
setup handler `loc_072d` [code] runs the attract-to-play handoff once the boot self-test has passed
(clearing the in-play gate and flooding the play field), the attract driver `loc_0899` [code] runs
the
demo sequence, and the higher states run board build and live play. At the end of a life the play
dispatcher's continuation `loc_15d1` [code] decides what happens next from the same config: while a
game is still active it does nothing, on free play it tails into the shared attract epilogue, with
no
credit left it stays put, and otherwise it drops the machine back to the board-build state to
continue.

### Seeding players and lives

When a board is (re)built, `resetActorStateForBoard` [code] seeds both players from the cabinet
switches. It clears the live-state page and loose flags, then copies `LIVES_DSW` into both
`PLAYER0_LIVES` [seen] and `PLAYER1_LIVES` [seen], writes each player's opening sprite X, and takes
the
sprite colour from `DIFFICULTY_DSW`. Both players are seeded even in a one-player game; which bank
the
game actually plays is chosen later by `ACTIVE_PLAYER`. If the in-play gate is clear the routine
stops
there; with a game running it also clears the launch flags. From then on the per-player life counts
are
the decisive countdown — decremented on death and driving the player-switch and game-over decisions.

### Configuration consumed elsewhere

The decoded config feeds the rest of the machine. `DIFFICULTY_DSW` scales enemy spawn schedules —
for
example the spawn scheduler `loc_54c5` [code] uses it to veto early-round ticks below a difficulty
threshold — and it also supplies the seeded sprite colour and indexes difficulty tables. The lives
value seeds every new board, and its unlimited sentinel changes the countdown behaviour.
`BONUS_AWARD_DSW` selects the bonus/extra-life schedule in the award-tally step `loc_18da` [code]:
an empty award queue `AWARD_QUEUE` [code] reloads with 5 or 3 depending on the switch, and each
award
BCD-steps the queue's next threshold by 8 or 7. `CABINET_MODE_FLAG` selects upright versus cocktail
orientation and thus which player-control port is read and whether the screen is flipped, and
`DEMO_SOUNDS_DSW` gates whether the attract mode plays audio. The free-play sentinel in
`COINAGE_CONFIG` is the single most widely consulted config value — read by the coin/credit chain to
skip counting, by the credit display to switch prompts, and by the end-of-life continuation to
decide
whether a game can restart without a credit.

## In-play progression and timers

Pooyan's frame is driven entirely from the vblank NMI service (`loc_066d`): it saves the register
file, masks the interrupt, rebuilds the scrolling tile columns, samples the three input ports into
an
edge-detect ring, ticks two free-running frame counters, and then dispatches on the top-level game
state. Everything the player experiences as "progression" hangs off two nested state selectors — a
coarse machine-mode byte and a fine in-play sub-state byte — plus a handful of round/wave counters
and countdown timers that those handlers read and reload.

### The top-level state selector

`MAIN_GAME_STATE` [seen] is the coarse mode byte. Once per NMI `loc_066d` reads it and jumps through
a
five-entry table into the handler for the current mode: state 0 is the attract-blank/boot handler
`loc_072d`, state 1 the attract/demo driver `loc_0899`, state 2 the board-build handler `loc_0c4e`,
state 3 the in-play handler `loc_159b`, and state 4 a column-draw variant (the NMI itself
special-cases
state 4 to redraw four column groups instead of one). The selected handler runs to completion and
returns to the NMI epilogue, which restores the registers, re-arms the interrupt, and returns to the
interrupted program.

Mode transitions are written by the setup routines, not by the selector. Pressing start (with a
board-build precondition met) drops the machine into state 2 and zeroes the in-play gate and
sub-state
(`loc_1d15`). Start-of-life setup (`loc_0dab`) commits the play mode: it zeroes the sub-state,
writes `MAIN_GAME_STATE` = 3, and raises the in-play gate. Game-over housekeeping (`loc_1d3c`)
returns
the machine to attract (state 1) and clears the gate.

### The in-play gate

`GAME_ACTIVE_FLAG` [seen] is the in-play gate — set to 1 at start-of-life and cleared to 0 at
game-over.
It is the guard the gameplay handlers consult before doing per-frame work: score accrual runs only
while its bit 0 is set (`loc_0496`), the BCD play-timer bails immediately when it reads zero
(`loc_7912`), and several sub-state handlers branch on it to distinguish a fresh level from a
mid-game continuation (`loc_175d`, `loc_17c1`). The end-of-life continuation `loc_15d1`, which runs
after every in-play frame, keys entirely off it: while the gate is still set it does nothing; once
the
game is over it either tails to the attract epilogue (on free play), stays put (no credit), or drops
the machine back to the board-build state (`MAIN_GAME_STATE` = 2, `PLAY_STATE_INDEX` = 0), runs the
board/HUD reset, clears the arena, and blanks an attribute column — arming the next game.

### The in-play sub-state machine

The play handler `loc_159b` runs two things every frame: it ticks the BCD play-timer, then
dispatches
the in-play sub-state. `PLAY_STATE_INDEX` [seen] is that fine state byte; the dispatcher
(`loc_15a1`)
masks it to five bits and jumps through a twelve-entry table into the handler for the current phase.
The selected handler returns into `loc_15d1` (the end-of-life continuation above), which then
returns
to the NMI epilogue. Observed index values step through a fixed set of phase numbers (1, 2, 3, 4, 7,
10, 13, 18), i.e. handlers advance the byte in jumps, not by a uniform +1.

The phases chain as a level's life-cycle:

- **Phase-setup (`loc_16b7`, index 1)** is timer-gated. It decrements `PHASE_TIMER` [seen] every frame
  and returns until it hits zero; only then does it run the per-phase graphics setup, pick a
  (graphic, layout) pointer pair from a decision tree keyed on `PLAY_MODE_LATCH` [code],
  `ROUND_IN_PROGRESS` [seen], the in-play gate, and `ROUND_COUNTER` [seen], seat the fixed cursors,
  seed the enemy spawn timer, bump `PLAY_STATE_INDEX` to the next phase, and enqueue a display
command.
- **Phase-hold (`loc_175d`, index 2)** runs the display-list interpreter, then gates on two counters:
  a mod-0x1c subphase tick, and a two-hit one-shot latch. Past both it decides the level's shape
from
  `PLAY_MODE_LATCH`, `ROUND_IN_PROGRESS`, the in-play gate, and `ROUND_COUNTER` parity — either
arming
  a later sub-state or running the level-start batch (round-number HUD, phase gauge, timer seeds,
  spawn driver, sprite rebuild), setting `ROUND_IN_PROGRESS` and seating the wave-arrival counter,
then
  forcing sub-state 3.
- **Wave setup/spawn (`loc_17c1`, index 3)** seeds four lead actor records from a round/latch-selected
  table and, when `ROUND_COUNTER` bit 1 is set, fans out an enemy sprite group: the group size and
  tile base are derived from the round (`ROUND_COUNTER >> 1`, clamped at 8), and the count is stored
to
  `TARGET_GROUP_COUNT` [seen] for the end-level bonus comparison. It then arms a later sub-state.

Phase exhaustion is a distinct exit rather than a death: when the phase gauge drains to zero, the
phase-exhausted handler `loc_1a96` advances the sub-state (an extra step for player one), clears the
round cells, and tail-hands to the high-score insert-sort.

### The round counter and difficulty escalation

`ROUND_COUNTER` [seen] is the master progression counter, bumped by one on each stage transition
(`loc_1a01`) and BCD-rendered as the on-screen round number. It is read as difficulty input almost
everywhere: bit 0 selects the stage-type/facing variant and the alternate seed/tile tables, bit 1
gates the target-group fan-out, and its low bits index the spawn-schedule, speed, and sound tables.
`loc_1a01` also mirrors difficulty into the sprite attribute — attribute 0x30 once the round reaches
2, 0x28 before that.

Two independent difficulty inputs feed the escalation. `DIFFICULTY_DSW` [code] is a 3-bit
operator-dip value decoded once at boot; it is the *base*. The live enemy speed is computed each new
target group by `loc_191c`, which — only while the stage countdown and lead-actor state are both
idle,
and no enemy slot is still busy — bumps the sub-state and builds the speed value as the difficulty
base
plus a round-derived term (the round itself on odd rounds, or half the round plus the wave-arrival
count on even rounds), clamped below 0x20, and commits it to `SPEED_INDEX` [seen]. So the on-screen
enemy pace ramps with both the dip base and the round, per wave.

Alongside the round counter, several per-stage/per-wave counters shape a level's interior:
`STAGE_COUNTDOWN` [seen] counts down over a stage (its initial value also selects the stage label),
`SPAWN_PHASE_COUNTER` [seen] cycles to 7 selecting spawn/fire modes and is reseeded to 4 at the cap
by
the board reset (`loc_2527`), `WAVE_ARRIVAL_COUNTER` [seen] and `WAVE_PROGRESS_COUNTER` [seen] tally
enemy arrivals and ramp fire aggressiveness, and `GAUGE_PHASE_COUNTER` [seen] is the five-cell HUD
phase gauge that triggers the phase-exhausted exit when it reaches zero.

### Timers

Progression is paced by several countdowns of different periods:

- **`PHASE_TIMER` [seen]** — a per-frame down-counter that the setup handler decrements and returns on
  until it reaches zero, gating each phase transition; it is reloaded (e.g. to 0x60) when a new
phase
  arms.
- **`FRAME_COUNTER` [seen]** — a free-running byte decremented every NMI; its low bits phase animation
  and its zero-crossing gates the periodic integrity checks. A second per-frame byte
  `WORKER_CONTROL_BYTE` [code] is decremented in the same NMI pass.
- **The BCD play-timer (`loc_7912`)** — ticked once per in-play frame from `loc_159b`. It bails if the
  in-play gate is clear, selects the active player's bank (`PLAY_TIMER_BCD_P1` / `PLAY_TIMER_BCD_P2`
  [code]) by `ACTIVE_PLAYER` [seen], and — unless the matching gate byte (`PLAY_TIMER_GATE_P1` /
  `PLAY_TIMER_GATE_P2` [code]) is set — advances a per-frame sub-counter that rolls at 0x3b or 0x3c
  frames (roughly one second), carrying BCD into the seconds/minutes digits. This play-time is saved
  into a side-table alongside a new high-score entry.
- **Per-stage / per-wave countdowns** — `STAGE_COUNTDOWN` [seen] drains across a stage, and the
  intro-phase handlers run their own delay timers (e.g. the phase-3 gate `loc_6f5e` reloads a 0x60
  delay between intro steps).

### Scoring

Each player owns a three-byte packed-BCD score buffer (`P1_SCORE_BCD` / `P2_SCORE_BCD` [seen],
scores
carried x100). Accrual runs through `loc_0496`, gated on the in-play flag: an award index of 0 pulls
the per-frame increment (`PER_FRAME_SCORE_INCREMENT` [code]); any other index reads a three-byte
entry
from the award table (`SCORE_AWARD_TABLE` [code]). The increment is BCD-added (faithful to the Z80
`daa`) into the active player's buffer, the score column is repainted, and the buffer is then
compared
most-significant-byte-first against the running high score (`HIGH_SCORE_BCD_HI` [seen] and its two
lower bytes); a strictly greater score is copied over the high score and repainted.

Extra-life awards run as a separate schedule in `loc_18da`. An empty award queue (`AWARD_QUEUE`
[code])
reloads from a boot-selected schedule (5 or 3, chosen by `BONUS_AWARD_DSW` [code]); otherwise it
waits
until the active player's score MSB reaches the queued threshold, then bumps the saturating gauge,
BCD-steps the queue to the next threshold (step 8 or 7, again per the dip), redraws the HUD gauge,
and
appends the tally sound.

At game over the active player's score is inserted into the sorted ten-entry high-score table
(`HIGH_SCORE_TABLE` [code]) by `loc_1ab2`, which shifts the table (and its parallel play-time and
display-tile side-tables) down and records the winning rank in `HIGH_SCORE_INSERT_RANK` [code]. The
per-life bookkeeping around this — `PLAYER0_LIVES` [seen] draining on death and gating the
player-switch / game-over decision — is what ultimately clears the in-play gate and returns the
machine to attract.

### Grounding

The two selectors and the counters that drive progression are MAME-grounded: `MAIN_GAME_STATE`,
`GAME_ACTIVE_FLAG`, `PLAY_STATE_INDEX`, `PHASE_TIMER`, `FRAME_COUNTER`, `ROUND_COUNTER`,
`SPEED_INDEX`,
`STAGE_COUNTDOWN`, `SPAWN_PHASE_COUNTER`, the wave counters, the phase gauge, `ACTIVE_PLAYER`, the
live
score buffers, the default high score, and `PLAYER0_LIVES` are all tagged [seen] from the attract,
gameplay, 2-player, and round-advance goldens. The operator-configured and rarely-exercised cells
are
code-level only, tagged [code]: `DIFFICULTY_DSW` and `BONUS_AWARD_DSW` (both static at default dip
settings), `PLAY_MODE_LATCH` and `INTRO_PHASE_INDEX` (idle in the captures), `HIT_TALLY`, the
per-frame/award score sources and the high-score table, the play-timer banks and their gate bytes,
and
the high-score insert rank. Note `PHASE_TIMER` and `FRAME_COUNTER` are live counters, not static
bases — each wraps continuously per frame.

### Open questions

Several in-play sub-state indices (the dispatch table's slots 5, 6, 9, 11, 15, 16, 17) are not yet
MAME-confirmed, and two of the sub-state handlers remain untranslated, so the exact ordering of the
later phases past wave-spawn is inferred from the code rather than observed. `PLAY_MODE_LATCH` is a
multi-valued mode byte whose branches steer the phase-setup and hold handlers, but it stays zero in
every capture, so its non-zero paths (and the alternate graphics/layout pairs they select) are
un-grounded. The bonus/extra-life schedule (`loc_18da`, `BONUS_AWARD_DSW`) and the award-table score
values are likewise code-level, exercised only under non-default dips or scores not reached in the
short captures. Finally, the precise threshold at which `ROUND_COUNTER` saturation feeds the
difficulty
tables (versus the per-wave `SPEED_INDEX` clamp) is understood from the arithmetic but has not been
watched escalate across many rounds against MAME.

## The actor arena

Everything that moves in Pooyan — the player, the enemies, their shots, the things that fall, the
launched arrows — lives in one uniform pool of fixed-size records. A record is 0x18 bytes, and the
pool is a contiguous block of them, so any handler can walk from one record to the next just by
adding the stride. The whole subsystem is built around that shape: seed a record, tick its state
byte each frame through a jump table, and once per frame flatten the live records into the hardware
sprite list.

### The record and its arena

The primary array is ACTOR_TABLE [seen], the 0x18-stride block at 0x8a80 that is zero-filled at
board init. Slot 0 is the player/lead actor: its vertical position is PLAYER_Y [seen] and its
state/phase byte is LEAD_ACTOR_STATE [seen], which steps 0→1→2→3→4→5→0 to drive a six-way dispatch.
The player's joystick and aim-indicator bits sit in PLAYER_AIM_FLAGS [code]. Several more record
arrays share the identical 0x18 layout and are reached the same way: ENEMY_ACTOR_TABLE [seen] sits
at +0x60 inside the same arena; OBJECT_STATE_RECORD_BASE [code] at 0x8ba0 is the six-slot per-frame
object-state pool (it spans into PROJECTILE_TABLE [seen]); SPRITE_OBJECT_TABLE [seen] is a five-slot
child pool; SPAWN_OBJECT_TABLE [seen] and FORMATION_TABLE [seen] and the I-parity pair
ENEMY_TARGET_REC0 [seen]/ENEMY_TARGET_REC1 [seen] round out the set.

The field layout inside a record is consistent across the handlers that touch it. The first two
bytes (+0x00, +0x01) carry the active flag in bit 0 — a record is live when either byte's bit 0 is
set, and free otherwise, which is how every allocator and dispatcher tells occupied slots from empty
ones. +0x02 is the state/dispatch index. Vertical motion is 16-bit fixed point: the fraction in
+0x03 and the integer row (also used as base Y) in +0x04. +0x06 holds an X or a shape index
depending on the actor; +0x08 an attribute byte; +0x09 a fall velocity; +0x0a a signed per-frame
speed (whose two's-complement negation is the facing). +0x0b is a frame/animate counter. The
animation script pointer is little-endian at +0x0c:+0x0d with the step/hold index at +0x0e, the
colour attribute at +0x0f, and the tile code at +0x10. +0x11 is a general per-frame delay countdown;
+0x12 a hold timer or 0xff marker; +0x13 a phase or spawn index; +0x14 a tag; +0x15:+0x16 a word or
state bits; +0x17 a datum high byte.

### Board reset and seeding

resetActorStateForBoard [code] is the top of a fresh board. It clears the 0xbf-byte live-state page
based at SPEED_INDEX [seen], zeroes PLAY_STATE_INDEX [seen] and a handful of loose gates, then seeds
each player's saved bank from the cabinet switches — lives from the lives switch, a fixed opening X
of 0x20, and the sprite colour from the difficulty switch — and arms the row-by-row tile fill. When
the game is idle it stops there; in a running game it also clears the launch flags. The arena itself
is wiped by clearActorArena [code], which zero-fills the 0x200-byte block from ACTOR_TABLE so no
stale record survives into the new board. clearActorArenaAndCounters [code] is the heavier teardown
used as a dispatch state: it zeroes a 0x241-byte span from ACTOR_TABLE, clears the spawn/wave/rope
counters (SPAWN_PHASE_COUNTER [seen], WAVE_ARRIVAL_COUNTER [seen], ROPE_SEGMENT_COUNT [seen]), and
forces the in-play sub-state to 6.

New records are stamped rather than memcpy'd. initActorRecord [code] writes the fixed opening
constants (+0x00=0, +0x01=1, +0x02=8, the +0x12 marker 0xff) and a little-endian datum at
+0x16:+0x17, leaving a pointer parked just past the record for the caller's build loop to continue
from. seedObjectRecord [code] fills one record from two parallel streams — a two-byte descriptor
stream (into +0x06 and +0x04) and a two-byte little-endian coordinate stream (into +0x0c:+0x0d) —
and clears the +0x0e timer, advancing both source pointers by two. A build loop (in the attract
sub-state-4 handler loc_099c [code], for example) zero-fills the arena and then calls
seedObjectRecord repeatedly, stepping the record base itself, until the descriptor stream hits its
0xff sentinel.

### The per-slot scan loops

Each frame the arena is walked by several fixed-count loops, each responsible for one aspect. The
animation-script pass loc_22b1 [code] steps four records one stride apart starting at the arena base
— but only while the rope-grab latch GRAB_ACTIVE_FLAG [seen] is clear; a grab in progress skips the
whole pass so the grabbed actors freeze. The object-state pass loc_76f4 iterates six records from
OBJECT_STATE_RECORD_BASE, calling the per-record dispatcher on each with the loop counter and stride
parked in the alternate register set so the handlers may freely clobber the general registers. The
lead-actor driver loc_241e [code] runs three per-frame sub-passes, aborts if the anti-tamper freeze
flag TAMPER_FREEZE_FLAG [code] is set, and otherwise dispatches slot 0's state through the six-way
table indexed by LEAD_ACTOR_STATE. Two more loops, loc_5e78 [code] and loc_5f6a [code], sweep the
stride-4 target/record slots for proximity work (described below).

### The object state machine

dispatchActiveObjectState [code] is the core of the per-record update. It first skips any record
whose active bit is clear (bit 0 of +0x00 OR +0x01), then reads the low two bits of the state byte
+0x02 and jumps to one of four handlers, each of which returns straight to the record-scan loop. The
four states form the natural life cycle of a spawned object:

- State 0 (loc_771d [code]) **arms** a new object. While the +0x11 frame countdown is non-zero it just
  ticks and returns; on expiry it pulls the next index from a spawn ring counter, records it at +0x13,
  looks up a screen-pointer word into +0x15:+0x16, seeds the speed field, advances the state, and
  falls straight into state 1 so the fresh object also moves this same frame.
- State 1 (loc_7740 [code]) **moves** the object: it steps the +0x03 sub-position by the signed speed
  at +0x0a, borrowing into the +0x04 row on underflow, and once the cell fraction crosses a threshold
  it advances the state, reloads the frame timer, and queues a display command. A five-byte ROM
  checksum guard runs at the tail.
- State 2 (loc_7790 [code]) **draws** the object twice — once at its screen pointer and once at the
  row above — sets a "drawn" flag, then falls into the record-clear routine.
- State 3 (loc_7881 [code]) is a periodic **self-integrity** pass folded into the state table: it
  checksums ROM and video RAM and, on a clean pass, re-inits the actor slot; a mismatch tail-jumps to
  the tamper path.

The lead actor uses a wider six-entry table off LEAD_ACTOR_STATE rather than the two-bit selector.
Its state-0 step loc_2901 [code] resets the frame hold and drives the base Y downward: while still
above the floor it refreshes the derived sprite Ys and advances the script, and on reaching the
floor it loads the landing shape, reseeds the record, and runs two integrity checks. The individual
motion primitives are small leaves the state handlers call: advanceFallStep [code] adds the fall
velocity into the fixed-point fraction and reports (via carry) whether the actor is still above the
landing row; advanceRisingActorStep [code] drives a rising actor upward, flipping its display tile
every fourth frame and, at the top, nudging the base Y and advancing to the next state;
advanceActorDropStateOnDelay [code] counts down the +0x11 delay and only at zero nudges the actor
down, restamps its tile, reseeds the delay, and advances the state. A do-nothing entry,
noopStateHandler [code], fills dispatch slots that should return without acting.

### Animation

An actor's on-screen appearance is driven by an animation script addressed by the +0x0c:+0x0d
pointer. advanceActorAnimFrame [code] is the general stepper: +0x0e is a frame-hold counter, and
while it is non-zero the current frame simply holds; at zero it walks the script stream, where a
0xff opcode reloads the pointer from the next two bytes (a jump) and any other byte begins a
three-byte frame record (tile → +0x10, colour → +0x0f, new hold → +0x0e). loc_22e6 [code] is the
sibling stepper that reads from a *shared* script cursor (ANIM_SCRIPT_CURSOR [seen]) rather than a
per-record pointer, copying a {tile, colour, delay} triple into the record and advancing the cursor,
with a 0xff marker meaning an inline cursor jump. (A rival full reset to the base script is present
but never fires: the target-presence fold it gates on seeds 0 and is only rotated, so the marker
always resolves as the jump.) setActorAnimation [code] and storeActorAnimationPointer [code] both
install a new script pointer into a record and reset its step index to 0 — the former into an IX
record, the latter into an IY record. tickActorAnimHold [code] runs a separate hold countdown gated
on a per-record animate bit (or, failing that, on even rounds via ROUND_COUNTER [seen]): on
underflow it steps a two-bit phase and re-arms, disarming at phase end.

### Collision, display, and the sprite list

Collision is proximity testing between actor coordinates and object coordinates. loc_6435 [code]
picks its object set by the play-mode latch (the spawned-object table plus a player-1 coordinate
set, or the projectile table plus the shared target slots SPRITE_TARGET_SLOTS [seen]), then tests up
to three records: a record hits when it is active and its biased X and Y both fall within a
near-limit of the actor. On a hit it resets the struck record, raises an I-parity hit flag, restarts
its animation, queues the hit sound, bumps HIT_TALLY [code], and runs a terminator guard.
precheckCollisionBounds [code] is the small helper that biases an actor's X by the flip-screen
orientation and tests whether its Y-plus-margin still clears the bottom of the play area. The
two-slot sweeps loc_5e78 and loc_5f6a each hand a target box and an I-parity selector to a per-slot
proximity handler, aborting the moment a pass claims a hit; loc_5e78 additionally runs only on odd
rounds.

Once per frame the live records are flattened into the hardware sprite list, based at
SPRITE_DISPLAY_LIST [seen] — a 24-entry, stride-4 list whose stride-4 sub-region
SPRITE_ACTOR_RECORD_SLOTS [seen] the display drivers rewrite in place.
copyObjectRecordsToDisplayList [code] is the workhorse: for each of N records it emits four record
bytes (+0x06, +0x10, +0x04, +0x0f) into four successive list slots and steps to the next record; the
list's low byte advances alone, so the writes wrap within the list's 256-byte page. loc_02ef [code]
orchestrates the full rebuild, copying four record groups in turn — the two lead actors, the two
enemy-target records, the eighteen moving-object records, and the two arrow/launch records — then
ticking the arrow group's two sprite-Y bytes down a pixel and running the shared tail. The player is
drawn as three vertically stacked sprites, so deriveStackedSpriteYs [code] fans the single PLAYER_Y
out into three list Y fields (base Y, Y−0x10, and 0x0a below that). When the cabinet is in
cocktail/flip mode, mirrorSpriteListVertically [code] rewrites the whole 24-entry list in place,
negating and offsetting each coordinate and toggling the two flip bits in each attribute byte.

### Player banks

Two players share one live arena by swapping it in and out of per-player saved banks. ACTIVE_PLAYER
[seen] selects the current player (bit 0: 0 → player 0, 1 → player 1) and TWO_PLAYER_FLAG [seen]
marks a two-player game. saveLiveStateToPlayerBank [code] block-copies the 0x3f-byte live state page
(based at SPEED_INDEX, which doubles as the page's byte 0) into PLAYER0_STATE_BANK [seen] or player
1's bank per ACTIVE_PLAYER, and zeroes PLAY_STATE_INDEX. saveLivePageToPlayer0Bank [code] is the
player-0 variant that also, in a two-player game with player 1 still alive, latches the
active-player flag before the copy. selectActivePlayerScoreBuffer [code] returns the active player's
three-byte BCD score buffer (P1_SCORE_BCD [seen] or P2_SCORE_BCD [seen]) picked by bit 0 of
ACTIVE_PLAYER — the mechanism by which each player's running score accumulates only during that
player's turn.

### Open questions

The +0x15:+0x16 word field is a screen pointer in the object move/draw handlers but carries
state/flag bits elsewhere (the enemy-target scan reads bit 1 of +0x16 as an engage condition); a
single unified reading of that field across every array is not yet pinned. The play-mode latch that
steers loc_6435 between object sets, and the I-parity selector threaded through the proximity sweeps
and the hit-flag slots, are code-confident but their two-player split behaviour is not distinctly
MAME-observed. loc_6435 and its allocation/finder companions (loc_60bc, loc_60d9) are described from
the code only and are absent from the routine grounding map. Finally, several arrays
(FORMATION_TABLE, the four-slot formation pointer table) show only sparse activity in captured play,
so their seeding and per-record roles rest on the code rather than on watched transitions.

## Waves, rope and launch

The enemy side of Pooyan is built from three interlocking machines: a set of spawn schedulers that
meter enemies into the actor arena, a rope that grows and retracts a column of segments on screen,
and two launch state machines — one that arms the arrow/hunter launch during ordinary play, and one
that runs the eagle attack waves. They share a common vocabulary of records: every actor, whether
enemy, hunter, formation slot, or eagle, is a 0x18-byte record, and the tables that hold them
(ENEMY_ACTOR_TABLE [seen], FORMATION_TABLE [seen], the actor arena at ACTOR_TABLE [seen]) are all
swept the same way — one record per stride, first-free-slot wins, at most one spawn per frame.

### Setting up an enemy wave

When the in-play sub-state reaches its wave-setup index, loc_17c1 lays out a fresh wave. It first
chooses a seed table and a tile-animation cursor from two inputs: PLAY_MODE_LATCH [code] and the low
bit of ROUND_COUNTER [seen]. The two-player mode and even rounds take one seed table; odd rounds
take the other, with a different tile cursor. It then stamps four records at the head of ACTOR_TABLE
[seen] — each getting its active flag plus a target position (+4) and a column (+6) pulled in pairs
from the chosen seed table. When the screen is not flipped (FLIP_SCREEN_FLAG), the lead record's
column is nudged down by two so the flipped and unflipped layouts line up. With the records seeded
it seats the shared animation-script cursor and steps the four actors' animation scripts once
(through loc_22b1, which itself refuses to run while a grab is in progress).

The tail of loc_17c1 splits on PLAY_MODE_LATCH [code]. In the zero branch it either arms the "wave
ready" play sub-state (0x12) when the attract gate holds, or advances the sub-state and copies a
0x43-terminated intro string into the display buffer with a fixed byte bias. In the nonzero branch —
and only when bit 1 of ROUND_COUNTER [seen] is set — it fans out a whole sprite group into
ENEMY_ACTOR_TABLE [seen]: the group size and a tile-base index are derived from the round (rising in
steps of one, saturating at eight members / tile index three), the size is published to
TARGET_GROUP_COUNT [seen], and each slot is packed with a tile id and a coordinate built by rippling
the low nibble of the tile-base word across the group so the members fan out in a diagonal. It
closes by arming the running-wave play sub-state (0x0f).

### Metering enemies in: the spawn schedulers

Once a wave is running, several small drivers decide when the next enemy actually appears. They all
share one shape: a countdown ticks every frame, and only on the frame it hits zero does a gated
slot-sweep run.

The simplest is loc_1171. While ENEMY_SPAWN_TIMER [seen] is nonzero it just counts down; at zero it
sweeps the six enemy records and seeds the first free one — but only if STAGE_COUNTDOWN [seen] is
still ahead of ACTIVE_ENEMY_COUNT [seen] and fewer than six enemies are live. loc_56e8 is the richer
variant of the same idea: on an even ROUND_COUNTER [seen] it hands the whole decision to the spawn
gate (below), while on an odd round it computes a spawn column as the gap between STAGE_COUNTDOWN
[seen] and the active count, and gates the sweep on a difficulty threshold derived from SPEED_INDEX
[seen] (below three it is SPEED_INDEX+4, otherwise six). Both drivers spawn at most one enemy per
frame, because the per-record initialiser reports "already active, keep scanning" as it walks and
"just seeded a free slot" the instant it fills one, and that second answer ends the sweep.

The spawn gate itself, loc_5871, latches an incoming value into SPEED_INDEX [seen] and then launches
a fresh batch only when ACTIVE_ENEMY_COUNT [seen] is strictly below STAGE_COUNTDOWN [seen] and below
the cap of six; when it does, it raises SPAWN_ACTIVE_FLAG [code] and seeds six records at once.

Two further schedulers, loc_54c5 and loc_5519, meter a second kind of spawn on a per-type cadence
and are gated by difficulty in the early rounds. loc_54c5 (scheduler A) vetoes its own tick below
round four unless DIFFICULTY_DSW [code] clears a round-dependent bar (rounds under two need
difficulty at least three; rounds two and three need at least two); past the gate it drains its
countdown, reloads it from a ROM table indexed by the low nibble of a schedule cursor, advances the
cursor, and falls into the formation-spawn loop over FORMATION_TABLE [seen]. loc_5519 (scheduler B)
is the same pattern with its own gate (round two and up skip the difficulty check) and feeds the
spawn loop over SPAWN_OBJECT_TABLE [seen].

Formation enemies come in through loc_540d, gated on the low bit of ROUND_COUNTER [seen] — even
rounds spawn no formation. On an odd round it blanks two six-byte state rows and then initialises
three formation records in turn via loc_5433. Each init bails if the record is already live,
otherwise stamps the fixed opening state and draws four parameters keyed by a shared spawn index — a
motion byte, a speed byte stored as its two's-complement partner, and an animation-script byte with
its sequence pointer — then bumps the shared index so the next record draws the next parameter-table
entry, giving the three-member formation its staggered look.

Two helpers shape *where* and *how fast* enemies arrive. adjustSpawnColumn shifts the spawn column
by the wave's progress, but only in the early stages: once STAGE_COUNTDOWN [seen] has advanced
(three or more) or while WAVE_PROGRESS_COUNTER [seen] is still below 0x0c the column is left alone,
otherwise it adds (progress − 0x0c). loc_191c chooses the speed/aggression value for a new target
group, running only while STAGE_COUNTDOWN [seen] and the lead-actor state are both idle and aborting
if any of the six enemy records already holds the busy state; the value it commits to SPEED_INDEX
[seen] is built from the difficulty base plus the round (on even rounds folding in
WAVE_ARRIVAL_COUNTER [seen]), clamped below 0x20, after which it clears the aim flags. Note that
SPEED_INDEX [seen] is a difficulty *index*, not a raw velocity — it is read clamped below eight to
index the velocity tables, and it escalates as the round advances.

A separate delay-gated sweep, loc_6905, drives spawns from a shared frame-delay timer against
WAVE_NUMBER [code]: once the timer clears it spawns nothing if the wave has already fully arrived
(WAVE_NUMBER caught up to WAVE_ARRIVAL_COUNTER [seen]) or the wave limit of eight is reached,
otherwise it walks eight enemy/state record pairs and fills the first empty one — again one spawn
per call.

### The rope

The rope is a vertical column that grows one segment at a time and later retracts, drawn as a stack
of 2x2 tile blocks. Its length is bounded by the wave: the segment count ROPE_SEGMENT_COUNT [seen]
is only ever grown up to two below WAVE_ARRIVAL_COUNTER [seen], so a rope can never outrun how far
the wave has progressed.

An even-frame driver, loc_2d66, guards the whole rope subsystem: it bails while GRAB_ACTIVE_FLAG
[seen] is set (a grab is in flight) or while WAVE_ARRIVAL_COUNTER [seen] still sits at its hold
value of two, and otherwise runs two passes in order — the extend state machine, then the per-cell
writer. The extend machine, driven by loc_2d78, is a two-state affair selected by ROPE_EXTEND_STATE
[code]. State 0 (loc_2d80) adds a segment: it returns once ROPE_SEGMENT_COUNT [seen] has reached its
per-wave limit, otherwise bumps the count, and — while ROPE_EXTEND_INDEX [code] is below four —
advances that index, looks this segment's video-column low byte up from ROPE_CELL_COLUMN_TABLE
[code] and pairs it with the fixed 0x84 tilemap page into ROPE_COLUMN_VRAM_PTR [code], reloads the
new segment's per-cell timer in ROPE_CELL_TIMERS [code], steps the sub-state, and arms
ROPE_EXTEND_TIMER [code]. State 1 (loc_2dbc) animates the extension: it holds on ROPE_EXTEND_TIMER
[code], and on each expiry blits the next tile block of an eight-frame growth sequence keyed by
ROPE_EXTEND_FRAME_INDEX [code]; when the sequence completes it resets index and state and arms the
newly-grown rope cell.

The second pass, loc_2e22, walks every active rope cell (as many as ROPE_EXTEND_INDEX [code])
through the per-cell dispatcher loc_2e36. A cell with state 0 is inactive and skipped; otherwise its
state selects one of four per-cell handlers. Each cell owns one of four frame timers (loc_2e45 ticks
the timer picked by the low two bits of the cell index and reports reached-zero) and one video
column (loc_2e52 rebuilds the column base from ROPE_CELL_COLUMN_TABLE [code] the same way the extend
does). The handlers form the cell's life cycle:

- State 1 (loc_2e5e) runs on every fourth frame and, once the cell timer elapses, tries to spawn a
  bonus object into a free slot of SPAWN_OBJECT_TABLE [seen]. With no free slot it leaves the timer
  armed at 1 and waits; with one it seeds the slot (state 0x07, coordinates, a +4 field from a fixed
  table keyed by the cell index), reloads the cell timer with a round-scaled value, advances the cell
  state, and draws the segment tile plus its sound command.
- States 2 and 3 (loc_2ecb, loc_2f01) are timer-gated formation updaters that, on each expiry, reach
  into FORMATION_TABLE [seen] by the byte following the timer and nudge one record's tile / position /
  drop fields — loc_2ecb writes a round-derived tile index and bumps the tile field, loc_2f01 first
  runs the grab trigger and abandons the update if a grab fires, then drops the tile field and forces
  the position byte to 0xc0. Both bump the cell state and blit the segment.
- State 4 (loc_2f2f) retracts a segment: it fires only when the cell timer expires and segments
  remain, picks a retract-animation row from ROUND_COUNTER [seen] (>>2, clamped) plus a difficulty
  term, merges this segment's attribute into the timer cell (carrying the paired cell's bits unless it
  is the terminal column), clears the count-selected formation record, resets the cell state, and
  blits the retract tile.

The rope thus threads directly into the grab and collision logic: loc_2f01 can be cut short by an
in-progress grab, and the whole driver stands down whenever GRAB_ACTIVE_FLAG [seen] is set.

### The arrow / hunter launch state machine

During ordinary play the arrow launch is a five-state machine selected by the low three bits of
LAUNCH_STATE [seen] and driven each frame by loc_2778.

State 0 (loc_278f) arms and gates the launch. It raises LAUNCH_ARMED_FLAG [seen] once its
preconditions hold — either LANE_SPAWN_COUNTDOWN [seen] is up with LAUNCH_ARM_LATCH [seen] still
clear (in which case it just bumps the latch), or STAGE_COUNTDOWN [seen] is nonzero and a multiple
of eight. Even once armed it will not advance until ARROW_Y [code] has risen past its gate (0x3c)
and neither hunter-target record (ENEMY_TARGET_REC0 [seen] / ENEMY_TARGET_REC1 [seen]) is flagged
hit; clearing those, it steps the state, reseeds the flip countdown, may light a HUD cell, refreshes
the arm latch from its seed, and blits the launch tile.

State 1 (loc_27f3) does one of two things depending on arrow height. While ARROW_Y [code] is still
high it animates the arrow — running a flip countdown and, on each expiry, stepping
SHARED_PHASE_COUNTDOWN [code] and blitting one of two arrow tiles by its parity. Once the arrow has
descended below its gate it looks for a free hunter-target record; finding one it advances straight
to state 2 (the hunter marker), marks the record, queues a sound, blits the alternate tile, and
seeds three record fields.

State 2 (loc_2856) seeds an actual hunter. Unless PLAY_MODE_LATCH [code] is set, it scans the
six-slot hunter table at HUNTER_TABLE_BASE [code] *downward* for a free slot and stamps the fixed
opening state, coordinates and tile ids into it, recording the slot address in HUNTER_RECORD_PTR
[code]. It then advances the launch state and, on the flip flag, either seeds the spawn countdown
and enqueues a display command or bumps a sub-counter. State 3 (loc_28ad) is a hold: it drains the
spawn countdown, and on expiry advances the state and (unless PLAY_MODE_LATCH [code] is set) clears
the 0x18-byte hunter record that HUNTER_RECORD_PTR [code] points at. The remaining launch state is
an idle no-op (loc_28c5) that simply returns, parking the machine until it is re-armed.

### The eagle attack waves

The eagle stage runs its own wave machine, distinct from the ordinary spawn schedulers. The
per-frame driver loc_72a7 has three states selected by two flags. When WAVE_LAUNCH_FLAG [code] is
clear it seeds the next wave (loc_72e1) and returns; when WAVE_RECORD_COUNT [code] is zero it hands
off to the inter-wave idle handler; otherwise it walks the wave's live records — two per WAVE_INDEX
[seen] — through the per-record dispatcher loc_72cf.

Seeding a wave (loc_72e1) runs only while the target slot is clear. It raises WAVE_LAUNCH_FLAG
[code] and advances WAVE_INDEX [seen]; on the fourth wave it merely re-arms WAVE_OUTER_PHASE [code]
and reloads WAVE_HOLD_TIMER [seen]. Otherwise it initialises two records per wave in
ENEMY_ACTOR_TABLE [seen] from the four-byte-per-record EAGLE_WAVE_PARAM_TABLE [code] — each marked
active with its column, row, and two tile/flag fields copied in, records whose own low address has
bit 3 set also getting an extra flag — then clears WAVE_OUTER_PHASE [code] and WAVE_RECORDS_ARRIVED
[seen].

Each eagle record is a three-state actor, dispatched by loc_72cf on its state byte (an inactive
record is skipped). State 0 (loc_733c) is the approach: the record does nothing until the eagle has
reached its grid slot — its column (EAGLE_X_COORD [code] >> 3) must equal the record's target column
or the one just before it, and its row must fall inside a five-row window above the target — at
which point it advances the record state and arms an animation. Odd records (bit 3 of the record
index) get one animation; even records get another, bump WAVE_RECORDS_ARRIVED [seen], and when the
whole wave has arrived queue the wave-arrival command from WAVE_ARRIVAL_CMD_BASE [code]. State 1
(loc_7395) is the dive/climb: it integrates the record's 16-bit vertical position by its per-record
speed, even records descending until the bottom row and odd records climbing until the top, each
advancing the state at its limit. State 2 (loc_73ce) retires the record: it zero-fills the whole
0x18-byte record, decrements WAVE_RECORD_COUNT [code], and when the last record of the wave retires
seeds the inter-wave hold in WAVE_HOLD_TIMER [seen].

When no records remain, loc_73e3 idles between waves: it drains WAVE_HOLD_TIMER [seen], and on
expiry — if a wave index is still set — enqueues a command carrying that index, reseeds the hold,
and clears WAVE_LAUNCH_FLAG [code] so the driver seeds a fresh wave next frame.

A parallel approach machine, loc_71ce, drives the on-screen aim indicator and the grid marker during
the eagle stage. It is gated by WAVE_HOLD_TIMER [seen], and once that clears it sets the player aim
bits in PLAYER_AIM_FLAGS [code] from the eagle's approach coordinate against a near threshold (0x59)
and a far threshold (0x60), latching LATCHED_ENEMY_X [seen] when the coordinate crosses the far one.
When the coordinate sits exactly at the near threshold it steps a records-arrived sub-phase, and on
the final sub-phase — once armed — it advances the eagle grid marker every eighth frame (gated by
EAGLE_GRID_STEP_TICK [code]), stamping a marker tile and colour attribute into the grid region at
EAGLE_GRID_VRAM_BASE [code]. The grid advance is bounded by loc_7287, which hands the advancing
coordinate back until it reaches the grid edge (0xd0) and then arms EAGLE_FINISH_FLAG [code] and
runs the phase-reset epilogue advanceEaglePhaseAndClearAim — which drops the aim flags and
LATCHED_ENEMY_X [seen], steps the outer phase, and clears WAVE_RECORDS_ARRIVED [seen] so the next
phase starts fresh.

The bonus/eagle stage is entered through two phase bodies — loc_71c7 (phase 0: run the approach
machine, then the shared per-frame object update) and loc_72a0 (phase 1: the shared update, then the
wave-launch driver) — and torn down by loc_7421 (phase 2), which holds on WAVE_HOLD_TIMER [seen],
then zeroes the wave/phase block and the enemy-record region, clears the play sub-state and
LATCHED_ENEMY_X [seen], and sets the attract sub-state selector to 7 to hand control back out of the
stage.

## Rendering, HUD and display lists

Pooyan turns memory into pixels through three cooperating machines: a small command
ring that decouples "something changed" from "draw it", a family of blitters that stamp
rectangular tile blocks and stacked digit columns into video RAM, and a sprite display
list rebuilt from the object records every frame. This section follows each in turn.

### The display-command ring and its dispatcher

Gameplay code rarely draws directly. Instead it posts a two-byte *display command* into a
ring buffer and lets the main loop drain it. The ring is `DISPLAY_CMD_RING_BUFFER` [code] —
thirty-two two-byte slots on page 0x88 — with a write cursor `DISPLAY_CMD_RING_WRITE_PTR`
[code] and a read cursor `DISPLAY_CMD_RING_READ_PTR` [code]. Boot fills every slot with
0xff, and 0xff (bit 7 set) is precisely the "slot free" marker.

`loc_0038` [code] is the one enqueue path. Given a 16-bit command it checks the slot the
write cursor points at: if bit 7 is set the slot is free, so it stores the command's high
byte there and its low byte in the next slot, then advances the write cursor by two,
wrapping back to the ring start (low byte 0xc0) once it walks off the end. If the slot is
occupied the command is simply dropped — the ring never blocks, it overflows silently. The
high byte is a handler selector and the low byte its argument; almost every visible change
(HUD refreshes, flip toggles, siren markers, spawn effects) is queued as one of these.

The main-loop spine consumes the ring. Each iteration reads the slot under the read cursor.
When that slot is free (bit 7 set, i.e. no pending command) the loop runs the per-frame
worker and treats *that* iteration as the frame boundary; the machine free-runs with no
vblank wait, so a full frame is one worker pass, and the whole backlog of queued commands is
drained within a single frame rather than one command per interrupt. When the slot instead
holds a command, the loop marks both of its bytes free again (0xff), advances the read cursor
by two (wrapping at 0xc0), and dispatches: the command's high byte, doubled and masked to a
5-bit even offset, indexes a handler-pointer table in ROM (at 0x0242), and control jumps to
that handler with the argument byte in hand; the handler returns straight to the top of the
loop, which then looks at the next slot. Several table entries point at `noopStateHandler`
[code], a bare return — a dispatch slot that intentionally draws nothing.

### The row-by-row tilemap fill

Clearing or repainting the whole playfield is spread across many frames so it never stalls a
single one. `seedTileFillCursor` [code] arms the job: it stores a starting VRAM address in the
16-bit `TILE_FILL_PTR` [seen] write cursor and seeds `FILL_ROW_COUNTER` [seen] to 0x20 (32
rows). `loc_02e3` [code] is the convenience entry that arms it from the fixed playfield origin
`PLAYFIELD_TILE_BASE`. Thereafter, one tick at a time, `loc_02ce` [code] blanks a run of cells
from the cursor, then advances the cursor forward by exactly one 0x20-wide row regardless of the
run length (it adds `0x20 - count` after the run), stores it back, and decrements the row
counter; the zero flag it returns tells the driver the fill has drained. Attract and play
state handlers call this each frame until `FILL_ROW_COUNTER` hits zero, at which point the
state advances.

Vertical columns of the scenery are stamped by a small set of three-cell column painters.
`paintColumnBodyTiles` [code] writes a column's middle tile (0x25) and base tile (0x20) one
row-stride apart; `loc_02a8` [code] prefixes it with a cap tile (0x01) to complete a
cap-mid-base column, and `loc_1ce7` [code]/`paintColumnBodyTilesUp` build the same column
growing *upward* (each cell one row toward lower addresses) with cap tile 0x02. `blankTileColumn`
[code] is the eraser: three blank tiles (0x10) a stride apart, returning the advanced pointer so
a caller can chain straight into the next column. `loc_039b` [code] draws the count column: gated
on the game-active flag, it fills the top N cells of an eight-cell column with tile 0x0c (N taken
from the actor-table count, plus one, clamped to eight) and blanks the rest — a live "how many"
bar.

### Tile-block and glyph blitters

Above the single-column primitives sits a family of rectangular blitters, all pure leaves that
copy a source pattern into a rectangle of video RAM. `paintTileBlock2x2` [code] and
`paintTileBlock2x2Above` [code] stamp a 2x2 block anchored at the top-left or bottom-left
respectively; `blit2x2TileBlock` [code] does the same but returns the pointer advanced to the
block's bottom-left cell so the two-tile animators can step one row up and blit again.
`loc_0a52` [code] fires `paintTileBlock2x2` twice from one shared four-byte source to place the
same 2x2 pattern at two anchors.

For larger glyphs, `blitTile3x3Block` [code] copies a 3-wide, 3-tall block (stepping the
destination +0x20 per row) and `blitGlyphBlock4x3` [code] copies a 4-row, 3-column glyph. Both
advance *and hand back* both their destination and source pointers, because callers chain them:
a routine that stamps one glyph then keeps stamping from the advanced source, or memsets through
the advanced destination to clear trailing cells. `loc_1ffb` [code] wraps the 3x3 blitter to
draw one of two fixed glyph tables, chosen by bit 5 of a selector.

### HUD digits and BCD

Score-style numbers are packed BCD (two decimal digits per byte) turned into tiles by a small
digit toolkit. `splitBcdByte` [code] is the atom: it writes a byte's low nibble as the units
tile, advances the cursor, and hands back the high nibble (a zero high nibble is the
leading-zero signal). `renderDigitWithBlanking` [code] paints one digit while threading a
"blank budget" — leading zeros come out as the blank tile (0x10) until a real non-zero digit
ends the run, after which zeros print as genuine "0"s. `drawStackedBcdDigits` [code] paints a
byte as two vertically stacked tiles (tens at the cursor, units one row up), and
`byteToPackedBcd` [code]/`binToPackedBcd` [code] convert a binary value into packed-BCD digits
(the latter also returning a hundreds tally) the same way the Z80 did with repeated
decimal-adjust — a binary count of zero means a full 256-step wrap, not zero.

These compose into the score and panel painters. `loc_0552` [code] zeros one of three 3-byte
BCD counters (player 1, player 2, or high score) and repaints it top byte first down its HUD
column with a leading-zero budget of four; `loc_056b` [code] repaints such a counter without
clearing it. `loc_05b2` [code] draws a table-selected field of stacked characters bottom-up —
its selector's low seven bits index a record table, each record being a destination address
followed by an inline string terminated by '.', with '?' ending the whole run; bit 7 of the
selector switches between drawing each character as a digit tile and blanking every cell.
`loc_05ee` [code] draws the credit count: it renders the credit field, clamps `CREDIT_COUNT`
[seen] to 99, converts to BCD, and paints the tens (suppressed when zero) and units tiles —
then, only when the units digit is exactly 2, sums a fixed 31-byte program block and bumps an
anti-tamper strike counter if the checksum misses.

The status panel has two source forms. `renderPanelFromTable` [code] walks ten rows of three
cells from `PANEL_TILE_SOURCE` [code], painting each non-zero source byte as its tile and each
zero as blank tile 0x40, into `PANEL_VRAM_DEST` [seen]; within a row the first two cells climb
one row and the third re-bases forward a column. `loc_0439` [code] renders ten rows of packed-BCD
panel digits, reading two of every three source bytes and drawing each as a digit pair with a
fixed separator tile between them. The attract-screen painter `loc_03e9` [code] ties it together:
eleven selector-indexed character fields, then the ten-entry high-score table rendered as stacked
BCD digit pairs, then the digit panel and status panel.

### The phase gauge

The phase counter is shown as a small vertical bar. `renderPhaseGauge` [code] (and its identical
twin `paintPhaseGauge` [code]) reads `GAUGE_PHASE_COUNTER` [seen]: a zero count leaves the gauge
untouched, otherwise `count - 1` cells (clamped to five) are filled with tile 0xb0 from
`PHASE_GAUGE_BASE_TILE` [seen] upward — one tilemap row per cell — and the remaining cells above
are blanked with tile 0x10. `loc_1a85` [code] redraws the gauge and then sets the play sub-state.

### Round and stage HUD

The round/stage header is refreshed each frame by a chain of related routines that share the same
building blocks: convert `ROUND_COUNTER` [seen] + 1 to BCD, blit the round-number glyph (one of two
glyph banks chosen by a tens bit), blank the three trailing cells, and mirror `STAGE_COUNTDOWN`
[seen] into its HUD digit and a fixed stage label. `loc_1f18` [code] is the per-frame version: it
holds off entirely while any of seven integrity-flag slots is armed, derives the countdown's tens
digit, and only on the first stage (tens zero) redraws the round number before drawing the stage
label. `loc_1f2f` [code] is a once-per-level one-shot guarded by a done-latch, matching the stage
value against a five-entry column table; `loc_1f40` [code] is the table-scan variant that draws the
header only when it finds its target. `loc_1ead` [code] performs the first-pass round-HUD *setup*
(copying a ROM attribute field bottom-up into the attribute column, painting the round digits into
`HUD_ROUND_DIGIT_HI`/`_LO`, stamping the round glyph blocks into `HUD_ROUND_TILE` [code]) and then
runs the per-frame chain. `renderStageCountdownDigits` [code] paints the stage number as up to two
HUD tiles at `HUD_STAGE_DIGIT_LO` [seen]: a value below ten is a single digit, ten or more converts
to BCD first (and that path is suppressed while the play-mode latch is held). `loc_1583` [code] is
the frame's HUD-refresh tick — it bumps a counter and, on every sixteenth frame, queues a
display-refresh command (0xb5 or 0x35 by a counter bit). `loc_4a0b` [code] draws the round marker:
gated on the round counter's low bit, it snapshots the spawn-phase count and paints that many
stacked marker pairs down a column with the marker glyph beneath.

### The sprite display list

Sprites are not drawn where the game logic keeps them; they live in fat object records and are
projected each frame into a compact 24-entry, stride-4 sprite display list at `SPRITE_DISPLAY_LIST`
[seen] (each entry: Y, attribute, X, tile). `loc_02ef` [code] is the per-frame rebuild. It copies
four record groups into the list in turn — the two lead actors, the two enemy-target records, the
eighteen moving-object records, and the two arrow/launch records — then nudges the arrow group's two
sprite-Y bytes down a pixel each and falls into the shared flip/mirror tail.

Two copiers do the projection. `copyObjectRecordsToDisplayList` [code] copies four *raw* record
bytes (offsets +6, +0x10, +4, +0xf) into four successive list slots per record, advancing the list's
low byte alone so writes wrap inside the list's 256-byte page. `loc_0343` [code] is the same shape
but with coordinate math for moving objects: two of the four bytes are 16-bit sub-pixel position
pairs reduced to screen pixels (value shifted right five, biased by minus eight), the other two
copied raw. Both return the advanced list pointer so `loc_02ef` chains one group straight into the
next.

The player is drawn as three stacked sprites. `deriveStackedSpriteYs` [code] fans `PLAYER_Y` [seen]
out to the Y fields of stacked slots 3/2/1 (base Y, Y-0x10, and Y-0x10+0x0a), so a single logical
position becomes a three-high sprite stack. `loc_09f8` [code] first steps four object records'
animations and then calls the rebuild, keeping the list current with the freshly animated records.

Finally the list is corrected for a flipped cabinet. `loc_0320` [code] decrements a caller's frame
counter and, when the screen-orientation flag reads flipped (zero), runs
`mirrorSpriteListVertically` [code]: it walks all 24 stride-4 entries in place, negating and
offsetting each coordinate byte (`-value - 0x10`) and toggling the two flip bits in the attribute
byte while preserving its low nibble. In upright orientation the mirror pass is skipped and the list
is emitted as built. A separate `loc_0714` [code] copies sprite-attribute and position bytes in
pairs for callers that thread attribute and position cursors across successive copies.

## Sound

Game events never talk to the audio hardware directly. Instead they drop a one-byte
command into a ring buffer, and a per-frame pump pulls one byte at a time back out and
hands it to the audio CPU. This decouples the moment a sound is requested (which can be
deep inside a gameplay handler) from the moment it is actually delivered (once per frame,
in a fixed spot), and it lets a burst of requests spread out across frames instead of
racing the sound latch.

### The command ring

The ring lives inside page 0x8a00 — the same page whose base is HIGH_SCORE_TABLE [code] —
occupying the slots at offsets 0x43 through 0x5e. Two one-byte cursors track it, and
neither holds a full address: each is just a slot offset within the page, so a store
reconstructs the real slot as `0x8a00 + cursor`. SOUND_RING_WRITE_PTR [code] is the tail
where the next command is deposited; SOUND_RING_READ_PTR [code] is the head the pump reads
from. Both begin at slot 0x43 and, on reaching the last slot 0x5e, wrap back to 0x43 rather
than incrementing — a circular buffer of 28 slots.

An empty slot is marked with 0xff. This is both the "nothing queued" sentinel the pump
tests for and the value written back to free a slot once its command has been consumed.

### Enqueuing a command

There are two front doors onto the ring, and both advance the *same* write pointer into the
*same* slots — the ring is shared, not duplicated.

The raw path is enqueueSoundCommandRing [seen]: it stores the byte at the current tail slot
and advances the write pointer (wrapping 0x5e back to 0x43). It is unconditional — whoever
calls it always lands a byte in the ring.

The gated path is appendSoundCommandGated [code]. It first stashes the incoming byte into
SOUND_RING_PENDING_BYTE [code] (0x8d20) — the stash happens *before* the gate test, so the
byte survives whatever the gate decides. It then appends only while a game is live: if both
GAME_ACTIVE_FLAG [seen] and PLAY_MODE_LATCH [code] are zero it drops the command and returns
with A = 0. When either gate is open it performs the same store-and-advance as the raw path,
but leaves the advanced cursor value in A on the way out, because its callers are dispatched
in a way that reads that result back.

On top of the single-byte append sits appendSoundCommandRun [code], which lays down a
four-byte run: the caller's byte followed by the three fixed bytes 0x15, 0x16, 0x17, each
pushed through the gated append. This is the shared tail used by every emitter that needs a
complete run rather than a lone command.

### The emitter wrappers

A large family of tiny wrappers exists so that a caller can request one specific sound by
calling one named routine, with the command byte baked in as a constant. They fall into a
few shapes:

- Single fixed byte. The queueSoundCommandNN [code] wrappers each carry one constant and
  hand it to the ring. Which door they use is not uniform: some go through the raw enqueuer
  (for example queueSoundCommand00, whose byte 0x00 is the silence/stop code, and
  queueSoundCommand02, queueSoundCommand05, queueSoundCommand09), while others go through the
  gated append (queueSoundCommand01 and most of the rest).

- Conditional single byte. queueSoundCommand04IfNotBusy [code] guards its append with two
  extra gates: it drops command 0x04 outright while WAVE_TEARDOWN_STATE [seen] or
  GRAB_ACTIVE_FLAG [seen] is non-zero, appending only when both are clear. It is the request
  that must not stomp on a sound already owed to those states.

- Fixed multi-byte sequences. Wrappers like queueSoundCommands19And15 [code],
  queueSoundCommands82And03 [code], queueSoundCommands95And03And11 [code] and
  queueSoundCommands96And97And18And15 [code] drop several constants in order. Some mix doors
  within one wrapper — the last of these appends two bytes through the gated path and then
  enqueues two more through the raw path.

- Four-byte runs. queueSoundRun1D [code], queueSound82ThenRun1C [code] and the round-derived
  variants all end by delegating to appendSoundCommandRun, so the caller's chosen lead byte is
  followed by the fixed 0x15/0x16/0x17 completion.

- Round-derived selection. A few wrappers pick their lead byte from the current wave rather
  than a constant. queueRoundSoundCommandRun [code] and queueRoundVariantSoundRun [code] both
  index off ROUND_COUNTER [seen] with `(round >> 1) & 3` and add a base, so the sound shifts
  as the game progresses. Note ROUND_COUNTER is a live, escalating counter, not a fixed base.
  queueSirenSoundRun [code] is similar but first checks SIREN_ENABLE_GATE [code]: while the
  gate is non-zero it emits nothing; otherwise it picks a lead offset by the round counter's
  low bit and lays down the run.

One emitter deliberately skips the ring entirely: emitPresetSound [code] hands its fixed
command 0x0b straight to the audio CPU (see below), delivering immediately rather than
queuing for the next frame.

### Draining to the audio CPU

drainSoundCommandRing [seen] is the pump, and it moves exactly one entry per call. It reads
the head slot; if that slot holds the 0xff empty marker it returns having done nothing. With
a real byte present it consults a silence gate: playback is suppressed only when demo/attract
sounds are disabled *and* no game is active — that is, when DEMO_SOUNDS_DSW [code] bit 0 is
clear and GAME_ACTIVE_FLAG [seen] is zero. In every other case the byte is handed off for
delivery. Either way — whether the byte was delivered or silenced — the slot is then freed
(written back to 0xff) and the read pointer advanced (wrapping 0x5e to 0x43). A silenced
command is therefore *dropped*, not held for later; the ring keeps draining regardless.

Because the pump takes one byte per invocation, it must be called steadily. It runs from the
vblank/interrupt service each frame and from the per-frame driver body loc_6e59 [code] as the
last of that body's fixed sub-passes, so a multi-byte sequence queued in one instant trickles
out over successive frames.

### Reaching the sound latch

The final hand-off is sendSoundCommand [code], the single point where the main CPU touches
the audio hardware. It writes the command byte to SOUND_COMMAND_LATCH [seen] (0xa100), then
strobes AUDIO_IRQ_LATCH [seen] (0xa181) high and immediately back low. That rising edge
interrupts the audio CPU, which reads the latched byte and produces the sound. The strobe's
pulse is just a fixed timing gap with no state behind it, so it collapses to the back-to-back
high/low write. Both the drain path and emitPresetSound funnel through this one routine, so
every sound the machine makes — queued or immediate — leaves through this latch-and-strobe.

## Anti-tamper

The machine is riddled with self-integrity guards: dozens of small routines, scattered through boot,
attract, the per-frame drivers and the actor state handlers, that re-derive a checksum or signature
over their own program image (or over video RAM) and compare it against a baked-in sentinel. Because
the ROM the game ships with is intact, every one of these guards passes on a genuine board, and the
divergent branches are only reachable once someone has altered the code, the graphics tables, or
work RAM. What a guard does on a miss falls into three families: it bumps a *strike counter* that
later handlers poll, it raises a *freeze flag* that halts spawning and object updates, or it takes
an immediate destructive action — jumping into non-code, wiping work RAM, or (in the JS port)
throwing because the target is data that can never be a valid continuation.

### The strike counters and freeze flags

Two kinds of durable state record a detected tamper. The first is a cluster of one-byte **strike
counters**, each owned by a particular guard and bumped only when that guard's checksum deviates:
TAMPER_STRIKES_ROM [code] for the periodic ROM checksum, TAMPER_STRIKES_SIG [code] for the
program-signature folds, TAMPER_STRIKES_STATE10 [code] and TAMPER_STRIKES_STATE0 [code] for two of
the state-machine guards, TAMPER_STRIKES_SLOTSWEEP [code], TAMPER_STRIKES_HUD_GUARD [code], and
TAMPER_STRIKES_TERMINATOR [code]. Several of these sit consecutively at INTEGRITY_FLAG_SCAN_BASE
[code] as a small block of adjacent flags, which matters because a later handler scans that whole
block at once (below). On an intact board every counter stays at zero.

The second kind is a set of **freeze flags** whose non-zero value directly gates gameplay:
TAMPER_FREEZE_FLAG [code] and TAMPER_OBJECT_FREEZE_FLAG [code] halt spawns and per-frame object
work, SIGNATURE_MISMATCH_FLAG [code] and TAMPER_ROM_CHECK_FLAG [code] mark a program/table mismatch,
and HISCORE_TABLE_CORRUPT_FLAG [code] marks the score table. Inline warning: TAMPER_FREEZE_FLAG is a
counter that guards *increment*, not a boolean they set — its meaning is "non-zero means tampered",
so repeated misses simply bump it further.

### The ROM / program-image checksum guards

The most numerous guards sum a fixed block of read-only program bytes and check the total's shape
against a sentinel tuned so the intact image passes.

`verifyRomChecksum` sums sixteen program bytes descending from ROM_CHECKSUM_TOP [code] into one byte
and demands a specific bit shape (bit0 clear, bit5 and bit7 set); any other shape bumps
TAMPER_STRIKES_STATE10 [code]. `loc_7e6d` runs the same idea periodically but only when
PLAYER1_LIVES [seen] is at least four (a state only the harder lives-DSW settings reach) and only at
the FRAME_COUNTER [seen] zero crossing: it sums downward from TAMPER_CKSUM_TOP_ADDR [code] to a 0x34
terminator byte, accumulating both the running byte-sum and a count of its carries, and if `(carries
+ sum)` keeps any bit of 0xb0 it bumps TAMPER_STRIKES_ROM [code].

Several play-state and per-object handlers carry an embedded fold. `loc_1b43`, a play-state handler,
folds a 34-byte block from TAMPER_CKSUM_BASE_5593 [code] with a mask-rotate-add-with-carry
recurrence; a result other than 0x7c bumps TAMPER_FREEZE_FLAG [code].
`flagTamperOnRound5ChecksumMiss` arms only when ROUND_COUNTER [seen] equals five, sums six program
bytes with a separate carry tally, and bumps the same TAMPER_FREEZE_FLAG [code] unless `(sum +
carries + 0x7f)` wraps to zero. `loc_3865`, an actor state handler, folds a block backward from
ACTOR_TAMPER_CKSUM_TOP [code] to a 0x1a terminator — but only once the record pointer has reached
the object-table band and only on the frame-counter zero crossing — and bumps
SIGNATURE_MISMATCH_FLAG [code] if the masked result survives. `loc_4103`, a per-object frame-advance
step, folds the low nibbles of a 56-byte block at TAMPER_NIBBLE_SUM_BLOCK [code], again gated on the
frame-counter zero crossing, and bumps TAMPER_STRIKES_SIG [code] unless the running low byte is 0x67
with exactly one carry.

Two guards hide behind ordinary-looking triggers. `loc_05ee` draws the credit count as HUD digits,
and *only when the units digit happens to be 2* sums a 31-byte block descending from
HUD_GUARD_CKSUM_TOP [code], bumping TAMPER_STRIKES_HUD_GUARD [code] on any total but 0x8c.
`loc_52f6` runs a slot sweep gated by SCRIPT_ADVANCE_GUARD [seen] and a once-only latch; having
found at least four free actor slots it folds a 23-byte code block from SLOT_SWEEP_CKSUM_BASE [code]
and bumps TAMPER_STRIKES_SLOTSWEEP [code] unless the 16-bit sum matches. And `loc_3be3`, the object
state-0 handler, at the tail of its gated lane reset (upright screen, low stage countdown) sums a
code window at STATE0_CKSUM_BASE [code] and bumps TAMPER_STRIKES_STATE0 [code] on a sentinel miss.

### The program-signature checks

A second style compares the program against a stored reference rather than reducing it to one
number. `verifyRomSignature` walks a 16-byte reference at SIGNATURE_REFERENCE_TABLE [seen] against
every eighth byte of the sampled code region from SIGNATURE_SAMPLE_BASE [seen]; the first byte that
differs raises SIGNATURE_MISMATCH_FLAG [code] and stops. This is the check `loc_0254`, the per-frame
scroll worker, runs whenever the worker control byte's low nibble is set — instead of repainting
scroll columns it runs the signature check and returns.

`loc_1bcc` snapshots the live state page into player 1's saved bank, then folds the low five bits of
a fixed block at TAMPER_CHECKSUM_CODE_BASE [code] onto the pointer the copy left behind (inline
warning: the fold seeds from the advanced bank pointer, not from zero, so the expected 0x8a60
sentinel is an absolute pointer value, not a plain sum); a miss bumps TAMPER_STRIKES_SIG [code].
`loc_744e`, the attract/self-test state-0 handler, runs a two-stage compare: the first eight boot
bytes against a reference copy, then a 0x74-byte program window against its reference copy — and a
mismatch in the second stage abandons attract and hands off to the screen re-init handler
`loc_67df`. `loc_2a96`, an actor state-5 handler, compares a 0x20-byte code window read upward
against a *reversed* reference block read downward; a single mismatch tail-jumps into the state-2
handler `loc_2a01` (a tamper re-entry rather than a strike).

### The video-RAM tilemap and colour-RAM guards

Some guards checksum the picture rather than the code, catching tampering that has reached the video
page. `loc_68ac` (and its sibling `loc_3278`) run once per arm, guarded by TILE_CHECKSUM_LATCH
[code]: they sum the playfield tile region from PLAYFIELD_TILE_BASE [code], walking each row's cells
and skipping the inter-row gap until the page reaches 0x88, then look the low-byte sum up in
TILE_CHECKSUM_TABLE [code] and, on a hit, match the wrap count against the table's paired entries. A
low-byte or wrap-count miss is unreachable with an intact tilemap, so the port throws — the original
branches into data. `loc_6a7f`, the per-frame object driver, arms a similar one-shot tilemap sum
(latched, only at WAVE_NUMBER [code] == 2) beginning a short way into video RAM and skipping one
column; the intact total is 0x29b8 and any other value throws. `loc_7517`, display-dispatch state 1,
column-sums two fixed video-RAM strips at HUD_INTEGRITY_STRIP_A [code] and HUD_INTEGRITY_STRIP_B
[code] (14 tiles each, one row up per cell) and requires the combined total 0x014f exactly before
advancing to state 2 — any other total is a hard integrity trap.

`loc_67df` itself is gated on a colour-map checksum: it sums ten colour cells one row apart from
HUD_INTEGRITY_STRIP_A [code], and only when the sum is the 0x5a sentinel does it re-arm a fresh
screen (round flags, timers, actor arena wipe, playfield repaint); a mismatch instead tails into the
per-object frame updater, so a corrupted colour map quietly denies the screen re-init. `loc_77c8`
re-seeds an actor slot behind a stricter colour-RAM walk: ten cells from HUD_INTEGRITY_STRIP_A
[code] must each equal their neighbour one row up (a neighbour mismatch jumps into non-code,
modelled as a throw) and the running sum plus 0x83 must equal COLORRAM_CHECKSUM_SENTINEL [code], a
sum miss tail-jumping to the tamper handler `loc_2334`. `loc_2a01`, the actor state-2 handler,
checksums the field attribute source table (a 0x20-byte sum that must total 1) and tail-jumps the
hunter guard on a mismatch. `loc_08e9`, attract sub-state 1, straddles its colour-map flood with two
data-table integrity guards (sums that must equal 0x63 and 0xaa over blocks including
ATTRACT_INTEGRITY_CKSUM_BASE [code]); either miss is unreachable with intact tables and traps.

### The byte-for-byte copy self-checks

Two guards keep a verbatim second copy of a code block in ROM and compare the original against it.
`loc_30f1`, the hunter-formation launch handler, compares the routine body at
SELFCHECK_ROUTINE_BASE_ADDR [code] against the copy at TAMPER_COPY_3278 [code] (past a two-byte
pointer header); a mismatch propagates zero across work RAM upward from BONUS_AWARD_DSW, bricking
the run. `loc_6f9d`, level-intro phase 4, compares a 0x44-byte block at PHASE4_TAMPER_ORIG [code]
against its copy at PHASE4_TAMPER_COPY [code]: a full match queues a sound and a display command,
while any mismatch wipes the work-RAM page forward from its base.

### The table checksums

`verifyTableChecksum` sums an arbitrary table into a 16-bit accumulator (low byte plus a carry count
as the high byte) and raises TAMPER_ROM_CHECK_FLAG [code] unless the result is exactly high 0x1d,
low 0xc1. `flagHighScoreTableCorruptOnChecksumMiss` guards the score table at HISCORE_CHECKSUM_BASE
[seen]: the block's first byte must be the 0xc8 header marker, and the four bytes summed minus their
carry count must equal 0x59; a bad header or a mismatched total raises HISCORE_TABLE_CORRUPT_FLAG
[code].

### The shared integrity handler and the flag scan

`loc_7960` is the shared integrity-plus-timer handler several play-state handlers call. Before it
renders the play timer it folds a 16-bit checksum (plus a second sum taken only at even offsets)
over a code block at INTEGRITY_CHECKSUM_CODE_BLOCK [code] and matches all four result bytes against
the four guard bytes trailing the block — a disagreement is unreachable with intact data and traps.
After rendering, it scans the seven-byte flag block at INTEGRITY_FLAG_SCAN_BASE [code]; if any flag
is set it runs a *tail* checksum from the first set flag to a 0xc9 sentinel and verifies the
two-byte result against TAIL_CHECKSUM_GUARD [code], a low-byte miss trapping and a high-byte miss
repainting the phase gauge instead. Because the strike counters live inside that flag block, a
strike raised anywhere earlier is what diverts `loc_7960` into this tail check. `loc_79e9` is a
standalone version of the same idea: it sums a fixed routine forward to its terminating 0xc9 and
checks the total against TAIL_CHECKSUM_GUARD [code], trapping on a low-byte miss and diverting to
the phase-gauge path on a high-byte miss. `loc_2334`, reached as the tamper handler tail-jumped from
`loc_77c8`, also scans the seven integrity flags as one of its "work pending" triggers.

### What a strike does downstream

The strike counters and freeze flags are not merely recorded — later handlers poll them and divert.
`loc_6e75`, the phase-1 spawner, refuses to launch when either SIGNATURE_MISMATCH_FLAG [code] or
TAMPER_FREEZE_FLAG [code] is set; the original takes a skip-spawn jump into data, so the port treats
it as unreachable. `loc_241e`, the lead-actor-group driver, runs its per-frame sub-passes but then,
if TAMPER_FREEZE_FLAG [code] is set, skips dispatching the actor's state handler entirely — a set
freeze flag stalls actor updates. `loc_2514` ORs TAMPER_STRIKES_TERMINATOR [code] with the
board-clear flag after copying its tile run and, if either is set, diverts into the board/HUD reset
`loc_2527`; that reset in turn mirrors TAMPER_OBJECT_FREEZE_FLAG [code] into the lead actor state
and several enemy/target cells, so a raised object-freeze flag propagates into the actor records and
stops object motion. And `loc_08b3`, attract sub-state 0, runs a backward ROM checksum from 0x64d5
and raises the object-freeze flag TAMPER_OBJECT_FREEZE_FLAG [code] on a mismatch, seeding that same
freeze the reset later spreads.

## Open questions

These are the readings the code fixes but MAME has not yet confirmed, plus the paths no capture has
exercised. Each is a work item for a following grounding pass.

- **Sound byte-to-effect map.** The page-0x8a sound-command FIFO is [seen] as a FIFO that reaches the
  audio CPU, but which specific sound each command byte (0x00..0x28, and the high-bit bytes
  0x82/0x95/0x96/0x97) selects is [code]/[guess] — it needs an audio-side grounding pass that watches
  the audio CPU, not just the latch.
- **Foreground scroll worker 0x0254.** Whether it does load-bearing drawing during live play or is an
  attract/idle task is unsettled; its gating control byte 0x883f is [code]-only and its scroll-column
  duties overlap the vblank NMI's own column rebuild (0x0714).
- **Coin path beyond slot 1.** Slot 2 bumps a pulse counter at 0x8826 but only slot 1's counter
  (0x8824) has a wired coin-meter strobe, so whether 0x8826 drives a second physical meter is
  unconfirmed; and the third acceptor (input bit 2, flat +1 credit, no coinage or meter) is unlabelled
  as service-credit vs a third coin slot.
- **Phase-gauge cell 0x8908 dual use.** It is [seen] draining 3→0 as a phase gauge, yet another
  routine bumps the same cell saturating on a bonus-award threshold no golden reached; the two uses
  need a scoring-active capture to reconcile.
- **The six-slot object-state array 0x8ba0.** Its arm/advance/draw/integrity four-way machine and the
  per-pool overloading of the shared 0x18-byte record fields are [code]-only — no golden exercised a
  full cycle.
- **Formation / band-build / intro-launch.** The formation-spawn timer (0x8d30) and the band-build arm
  latch (0x8f63) are static-0 in every golden, so those paths — including the rope-extend
  tamper-strike branch and the formation phase-handler table at 0x30eb — are [code]-only, unconfirmed
  by MAME.
- **Display-command ring drain.** The ring cells are [code], never watched transitioning in a golden,
  and the display-command handler table's per-type mapping is not enumerated, so which screen region
  each command word repaints is inferred from the enqueue sites rather than confirmed by watching the
  ring drain.
