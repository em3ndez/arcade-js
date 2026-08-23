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

Pooyan keeps all of its mutable state on a single scratch page that begins at
`0x8800`. At power-on the boot code (the routine at `0x0092`) floods this page
with zero — a block clear that runs from `0x8800` up through `0x8ffd` — so every
state cell described below starts life holding `0`. The one deliberate exception
lives just past the top of that clear: the ROM self-test tally at `0x8fff`
[code], which the boot self-test seeds and which physically sits at the very top
of the boot stack, safely above the region the frame interrupt saves registers
into. Everything else the machine cares about — which screen it is showing, how
far into a board it is, whether a game is in progress — is a byte or two on this
page, and the whole program is organized around one top-level selector reading
those bytes each frame.

### The top-level selector and its jump table

The heart of the design is the **main-state selector at `0x8805`** [seen]. It is
a small integer, `0..4`, and each value names one of five broad modes the machine
can be in. Nothing polls it in a loop; instead it is consulted exactly once per
video frame, from inside the vblank interrupt service at `0x066d`. That routine
does the housekeeping every frame needs — it saves the entire register file
(main set, shadow set, and both index registers), masks further interrupts,
rebuilds the scrolling tile columns, samples the three input ports, and ticks a
pair of per-frame countdowns at `0x883f` and `0x8a5f` — and then, as its final
act before restoring everything, it reads `0x8805` and dispatches through the
five-entry jump table at `0x06f0`. The table maps the selector straight onto a
handler:

- **state 0 → `0x072d`** — attract/boot board setup,
- **state 1 → `0x0899`** — the attract and demo sequence,
- **state 2 → `0x0c4e`** — the board-intro / stage build,
- **state 3 → `0x159b`** — live gameplay,
- **state 4 → `noopStateHandler` (`0x0e53`)** — a bare return that touches
  nothing.

The dispatched handler runs to completion and control returns into the interrupt
epilogue at `0x06fa`, which restores the saved registers, copies the flip-screen
flag at `0x881f` [seen] out to the video latch, re-arms the interrupt, and
returns to whatever the main program was doing. In effect the main program spends
most of its time idling; the state machine *is* the game, advanced one step per
frame by the interrupt.

Two of the five slots deserve a note as the code stands today. State 4's handler
is a phantom — it returns immediately, drawing and changing nothing — and no code
path was found that ever writes `4` into `0x8805`; observed play only ever cycles
the selector through `0..3` [seen], so the fifth slot reads as a defensive entry
rather than a live mode. And state 0 is likewise nearly a one-shot: because the
boot RAM clear is the only thing that leaves `0x8805` holding `0`, the boot-setup
handler runs during power-up and, once it hands off, the attract loop is always
re-entered at state 1. The game-over paths reset the selector to `1` or `2`, never
back to `0`.

### The observed cycle and how each state advances it

Across a normal session the selector walks `0 → 1 → 2 → 3` and then folds back
toward the intro [seen], and each handler is responsible for pushing the selector
onward when its own work is done.

**State 0, the boot/attract setup (`0x072d`).** This handler blanks the tilemap
one row at a time, leaning on the row-by-row fill machinery: it drives the fill
down-counter at `0x8809` [seen] and the 16-bit VRAM write cursor at `0x880b`
[seen], returning early each frame while rows remain so the clear is spread across
many frames. When the fill finally drains it consults the ROM self-test tally at
`0x8fff` [code] and refuses to proceed unless it reads as passed (`0x10`);
failing that it simply abandons setup. On success it performs the attract handoff:
it clears the game-active flag `0x8806` to `0`, advances the selector `0x8805` to
`1`, resets the sub-state index `0x880a` to `0`, floods the colour/attribute map
from a fixed table, enqueues three display commands, and clears the attract
sub-state `0x8e51` to `0`.

**State 1, attract and demo (`0x0899`).** This state does not act directly;
instead it runs a *nested* state machine. It reads the attract sub-state selector
at `0x8e51` [seen] and dispatches through a second jump table at `0x08a1`, whose
nine handlers walk the attract-mode choreography — the title and score screens,
the demonstration play, the how-to-play panels — each handler advancing `0x8e51`
to sequence the next phase. All nine share a common tail at `0x0bb5`, an epilogue
that gates on `0x8806`/`0x8805`, checks for free play via the coinage cell
`0x882c` [seen] (`0x0f` meaning free play), and routes toward the screen builders
when a coin/start is seen. It is this attract layer that eventually pushes the
top-level selector forward into the board build.

**State 2, board intro / stage build (`0x0c4e`).** Like the attract state, this is
a dispatcher over a nested machine, but this one keys on the **play sub-state
index `0x880a`** [seen] through the table at `0x0c56`, which has three phases.
Phase 0 clears scratch bytes, clears the game-active flag `0x8806`, seats the tile
pointer `0x880b`, seeds the fill counter `0x8809` to `0x0f`, and bumps `0x880a`
onward. Phase 1 performs two tile fills per frame and, once its own `0x8809`
countdown expires, runs the board-build sequence — including a ROM checksum guard
— before advancing the sub-state and assembling the intro display. Phase 2 fires
board sound. Crucially, this state's own post-dispatch continuation at `0x0d78`
polls the freshly sampled inputs at `0x8810`: an inserted coin adjusts the credit
counter `0x8802`, and a 1-player or 2-player start button drives into
**start-of-life** at `0x0dab`.

**Start-of-life (`0x0dab`)** is the pivot from setup into play. It resets the play
sub-index `0x880a` to `0`, drives the selector `0x8805` to `3`, sets the
game-active flag `0x8806` to `1`, raises the flip/orientation flag `0x881f`, and
selects the player-1 bank via the active-player cell `0x880d` [seen]. The
transition of `0x8806` from `0` to `1` coincides exactly with `0x8805` reaching
`3` [seen] — game-active going high *is* the machine entering play.

**State 3, gameplay (`0x159b`).** Each frame this state first ticks a BCD counter,
then dispatches on the **play sub-state index `0x880a`**, this time masked with
`0x1f`, through the large jump table at `0x15a8`. That table's dozen-plus entries
are the round and intro phases of actual play — the per-phase handlers that move
Pooyan, run the balloon-borne wolves, resolve the arrow/rope launches, and step
the level along. The play sub-index is stepped through discrete phase values
(1, 2, 3, 4, 7, …) [seen] by those handlers, and it is the same `0x880a` cell that
the interrupt's tile-column rebuild inspects up front: when `0x880a` reads `4`, the
frame service redraws four full column groups (the whole playfield) rather than the
single tall column group it paints in every other phase. Gameplay's own
post-dispatch continuation at `0x15d1` decides what happens at the end of a life:
it returns immediately while the game-active flag `0x8806` is still set, honours
free play (`0x882c == 0x0f`), returns when no credit remains, and otherwise forces
the selector `0x8805` back to `2` and the sub-index `0x880a` back to `0` —
re-entering the board-build state to reconstruct the screen.

### The game-active flag and game over

The **game-active flag at `0x8806`** [seen] is the single most consulted piece of
state after the selector itself. It is set to `1` at start-of-life and cleared to
`0` at game over [seen], and a large fraction of the gameplay and sound routines
open with a read of it and return early when it is zero — it is the gate that
distinguishes "a game is being played" from "the attract loop is running the same
code for show". The sound-command drainer, the siren tick, the collision and
object-update paths, and many others all defer to it.

Game over runs through the reset routines around `0x1d15`/`0x1d3c`. They clear
`0x8806` to `0`, clear the play sub-index `0x880a`, and then choose a destination
by credit: with credit remaining, the machine is pointed back at the board-build
state (selector `0x8805 = 2`) to start the next game; with none, it clears the
active-player and two-player cells (`0x880d`, `0x880e` [seen]) and the attract
sub-state `0x8e51`, and drops the selector to `1`, returning to the attract/demo
loop.

### The play-mode latch

Layered on top of the play state is a second, subtler mode byte: the **play-mode
latch at `0x8f50`** [code]. It is multi-valued (it takes `0`, `1`, and `2`) and,
rather than steering the top-level dispatch, it selects between alternate update
paths *inside* gameplay. Many state-3 sub-handlers read it and change behaviour
when it is non-zero: a phase-countdown handler tails away instead of counting,
the object-update gate clears its work, the hunter-seeding steps are skipped, and
the two-pass collision driver guards on it. The handler at `0x1a01` is one of the
routines that raises it (to `1`). It stays `0` throughout ordinary captured play
and attract, which is why its role is grounded from the code rather than from
observed value changes — hence its [code] tag — but the shape is clear: it is a
latch that suspends or diverts the normal per-frame gameplay logic during special
sub-phases.

### The supporting work-RAM cells

Around these selectors sit a handful of cells the state machine reads and writes as
it runs. The **phase timer at `0x8808`** [seen] is a per-frame countdown the play
handlers reload (for example to `0x60`) and decrement to time phase transitions.
The **fill-row counter `0x8809`** [seen] and its paired **VRAM write cursor
`0x880b`** [seen] drive the row-by-row tilemap fills used by both the boot setup
and the board build; the counter is seeded (`0x20` for a full clear, `0x0f` for
the board build) and the cursor advances one row (`0x20` bytes) per pass until the
counter reaches zero and the fill ends. The **active-player cell `0x880d`** [seen]
selects which player's score and counter banks are live (bit 0 clear for player 1,
set for player 2), and the **two-player flag `0x880e`** [seen] marks a two-player
game and gates the per-player bank swap. The **flip-screen flag `0x881f`** [seen]
is copied out to the hardware orientation latch every frame by the interrupt
epilogue. Two more cells belong to the intro/anti-tamper edges of the machine and
carry [code] grounding only: the **intro-phase index `0x8f51`** [code], a
`0..6` selector dispatched through its own jump table while a level's introduction
plays; and the **tamper-freeze flag `0x881e`** [code], bumped by the ROM and
signature checksum guards, whose non-zero value freezes spawns and aborts actor
updates — a defensive latch that stays `0` on an intact ROM.

## The frame loop and the vblank heartbeat

Pooyan's per-frame behaviour is split across two flows that share the one CPU. There is a
free-running foreground loop — the main-loop state driver at 0x020f [code] — that never waits
for the video beam, and there is the vblank NMI service at 0x066d [code] that interrupts it
once per screen refresh. It is worth stating plainly up front, because it is counterintuitive:
the NMI is the real heartbeat. The per-frame game logic — object motion, collisions, scoring,
the whole state machine that the rest of this document hangs off — runs *inside* the vblank
interrupt. The foreground loop's job is the humbler pair of chores of keeping the
display-command ring drained and repainting the scrolling tile columns while nothing is
queued.

### Arming the heartbeat at boot

The heartbeat is deliberately silent until the machine is ready for it. The power-on reset
vector at 0x0000 [code] does almost nothing before it hands off: it writes 0 to the NMI-enable
latch at 0xa180 [code] — an LS259 latch bit whose bit 0 gates the vblank interrupt — so that no
interrupt can fire while RAM is still garbage, and then falls straight into the boot entry at
0x0092 [code]. Boot runs the ROM self-test, clears work RAM, seeds the display-command ring's
two cursors (both the write pointer 0x88a0 [code] and the read cursor 0x88a1 [code] are set to
0xc0, and the 64-byte ring body at 0x88c0..0x88ff is flooded with 0xff), and only once
everything is initialised does it write 1 back to the enable latch at 0xa180 to arm the vblank
NMI. Immediately after arming, boot jumps into the main-loop state driver at 0x020f. From that
instant the loop is free-running and the interrupt is live, and the two flows co-exist for the
rest of the machine's life. (A failed self-test reaches the same 0x020f entry by a different
path, so the foreground loop always runs regardless of the self-test verdict.)

### The foreground loop: draining the display-command ring

The main-loop state driver at 0x020f [code] is a tight infinite loop over the display-command
ring. Each pass reads the ring's read cursor at 0x88a1 [code] — a value that walks the range
0xc0..0xff and indexes into page 0x88 — and fetches the byte in the slot it points at. It then
tests that byte's high bit. The distinction is the whole trick of the loop: a *free* slot holds
0xff, whose bit 7 is set, whereas an *occupied* slot holds a command index, whose bit 7 is
clear.

When the cursor lands on a free slot (bit 7 set), the ring is idle — there is nothing to draw —
so the loop runs the per-frame scroll worker at 0x0254 [code] and comes back to the top. When
the cursor lands on an occupied slot (bit 7 clear), it is a queued display command: the loop
masks the doubled index down to an even byte offset, frees the command slot and the argument
byte that follows it (writing 0xff into both), advances the read cursor by two and wraps it back
to 0xc0 when it would run off the end, then looks up a two-byte handler address from the
dispatch table at 0x0242 and runs it. That handler paints to video RAM and returns to the top of
the loop, where the next slot is examined. So each command occupies a command/argument pair in
the ring, the read cursor chases the write cursor two bytes at a time, and the loop alternates
between two behaviours: while commands are pending it dispatches them back-to-back, and the
moment the ring runs dry it falls into the scroll worker instead.

The scroll worker at 0x0254 [code] is the foreground's once-per-idle-pass drawing pass. It
reads the worker control byte at 0x883f [code]; if that byte's low nibble is non-zero it runs
only the ROM signature check and returns, and otherwise — provided a game is active — it
repaints the scrolling tile columns, stepping one tilemap row upward per cell (blank columns
plus the shared column in one-player mode, or a capped body column in two-player mode), and
conditionally blanks one further column when both bit 4 of the control byte and the game-active
low bit are set.

### The synthetic frame boundary

On the real hardware the foreground loop has no vblank wait of its own — it simply spins, and
the vblank NMI reaches in and preempts it roughly sixty times a second. The current model draws
its frame boundary at the worker/ring-idle iteration of that loop: the foreground keeps
dispatching queued display commands within a single frame, mirroring the way the hardware drains
the *whole* ring each vblank rather than one command per interrupt, and the frame's worth of
foreground work is considered complete when the ring goes idle and the scroll worker runs. That
idle iteration is where the vblank service fires and the next frame begins.

This carries one live warning about the code as it stands: a backlog of ring commands — the kind
that builds up during the credit screen — must all drain within a single frame. If the loop
were allowed to hand out only one command per vblank, the backlog would trickle out over many
frames and leave stale attract tiles sitting on the playfield. The ring drain is therefore
inside-the-frame by design.

### The vblank NMI: the per-frame worklist

The vblank NMI service routine at 0x066d [code] (ROM 0x066d..0x0713) is the frame's real body of
work. Because it can interrupt the foreground loop at any instruction, it opens by saving the
entire register file — the main set, then the shadow set after exchanging into it, then IX and
IY — so the interrupted code sees nothing disturbed on return. It then writes 0 to the
NMI-enable latch at 0xa180 [code] to mask further interrupts, so the service cannot re-enter
itself mid-frame. From there it works through a fixed per-frame order:

1. **Rebuild the scrolling tile columns.** It runs the sprite-attribute copy loop at 0x0714
   [code]: in the top game-state that corresponds to active play it redraws four separate column
   groups (from bases 0x8840, 0x887c, 0x8850 and 0x8888), and in every other state a single
   0x18-tall group.
2. **Kick the watchdog** with a write to 0xa000, the same reset-suppressing poke the boot code
   scatters through its setup.
3. **Snapshot the inputs into an edge-detect ring.** It shifts the previous samples down through
   0x8813/0x8815/0x8816, then reads the three input ports — IN2 at 0xa0c0, IN1 at 0xa0a0, IN0 at
   0xa080 — complementing each because the ports are active-low, and stores them at
   0x8812/0x8811/0x8810. The IN0 sample lands at the head of that ring, 0x8810 [seen], carrying
   coin on bit 0, one-player start on bit 3 and two-player start on bit 4. This is how exactly
   one fresh input reading per frame becomes available to the rest of the game, with the prior
   reading kept alongside so edges (a press this frame that was not pressed last frame) can be
   detected.
4. **Tick the two frame counters.** It decrements the worker control/timing byte at 0x883f
   [code] and the free-running frame counter at 0x8a5f [seen]. That frame counter sweeps
   255->254->...->0 one step per frame and wraps; its low bits phase animations and its
   zero-crossing gates the periodic tilemap-integrity checks, so it is the machine's coarse sense
   of elapsed time.
5. **Service credits and one sound command.** It runs the credit/coinage update chain at 0x59e8
   (coin-in accounting and credit maintenance, short-circuited to nothing under free play) and
   then drains a single entry from the sound-command ring via drainSoundCommandRing at 0x0e64
   [seen], handing one queued sound to the audio CPU. Sound, like display, is fed one queued item
   per frame from a ring.
6. **Dispatch the main game state.** It reads the top-level game state at 0x8805 [seen] and
   dispatches through the table at 0x06f0, whose five entries select handlers for the top-level
   modes (attract, intro, play). The chosen handler is the true main body of the frame — it
   advances the whole game one step — and it returns into the NMI's own epilogue rather than back
   to the loop.

The epilogue then copies the screen-orientation flag at 0x881f [seen] into bit 7 of the
flip-screen latch at 0xa187 [code], so the display mirrors vertically when the cabinet is set
inverted; restores every register it saved in the reverse order; re-arms the NMI by writing 1
back to the enable latch at 0xa180; and returns to the exact foreground instruction it
interrupted.

### Per-frame order, end to end

Putting the two flows together, one frame's worth of work looks like this. Between interrupts,
the foreground loop drains whatever display commands are queued in the ring and, once the ring is
idle, repaints the scroll columns through the worker. At the vblank boundary the NMI takes over:
it freezes its own re-entry, redraws the scroll columns, kicks the watchdog, snapshots the
inputs into the edge-detect ring, ticks the worker byte and the free-running frame counter,
services credits and one sound command, and then runs the state-selected main body that drives
everything the player sees. It finishes by latching flip-screen, restoring state and re-arming
itself. Everything else described in this document — the object drivers, the collision passes,
the scoring, the state machines — runs once per frame because it hangs off that single
state dispatch at 0x8805, executed from inside the heartbeat.

## Configuration, coinage and players

All of the operator's cabinet settings enter the machine exactly once, at power-on, when the
boot routine `loc_0092` reads the two DIP-switch ports and decodes them into a handful of
work-RAM config cells. From then on nothing re-reads the switches; the game runs entirely off
the decoded copies. Coins arrive continuously during attract and play, are validated and turned
into credits, and a start button spends those credits to seed a one- or two-player game.

### Decoding the DIP switches

Both switch banks read active-low, so the boot decoder works from the complemented port value.
DIP bank 1 (`DSW1_PORT` 0xa000) is complemented and then rotated field-by-field into five cells.
Reading from the low bits up: bits 0-1 supply the lives field, bit 2 becomes the
`CABINET_MODE_FLAG` (0x880f) [code] that upright/cocktail handling later gates on, bit 3 becomes
the `BONUS_AWARD_DSW` (0x8800) [code] extra-life schedule selector, bits 4-6 become the 3-bit
`DIFFICULTY_DSW` (0x8820) [code], and bit 7 becomes the `DEMO_SOUNDS_DSW` (0x8821) [code]
attract-audio enable.

The lives field is not stored raw: `LIVES_DSW` (0x8807) [code] gets `(DSW1 & 0x03) + 3`, so the
four switch positions mean 3, 4 and 5 lives, while the position 3 is treated specially and stored
as 0xff. The default position yields the ordinary 3-life game, which the lives banks are seen to
take at board reset.

DIP bank 0 (`DSW0_PORT` 0xa0e0) carries coinage and is used *without* complementing. Its two
nibbles are each mapped through the ROM `COINAGE_TABLE` (0x0053) [code] into a coinage-config
byte: the high nibble drives coin slot 2's config `COINAGE_CONFIG_SLOT2` (0x882f) [code] and the
low nibble drives coin slot 1's config `COINAGE_CONFIG` (0x882c) [seen]. A config byte encodes the
exchange rate in its two nibbles (coins required in the high nibble, credits awarded in the low),
and the whole-byte value 0x0f is the free-play sentinel. At the default coinage setting the config
is seen to decode to the 1-coin/1-credit value.

The rest of `loc_0092` is machine bring-up rather than configuration proper: it self-tests the
eight 4K program banks against their checksum table, zeroes work RAM, marks the display- and
sound-command rings empty, floods the colour map, silences the audio CPU, arms the vblank
interrupt, and lays down the default high-score table before handing control to the
main loop.

### Seeding players and lives

The number of players is not a switch — it is chosen at start time by which button is pressed —
but the per-player state it seeds lives in this subsystem. At every board reset
`resetActorStateForBoard` copies `LIVES_DSW` into both players' life counters, `PLAYER0_LIVES`
(0x8948) [seen] and `PLAYER1_LIVES` (0x8988) [seen]; from there each drains one per death and gates
player-switch and game-over. The same reset also seeds each player's saved state bank with a fixed
opening X and, in its colour byte, the value of `DIFFICULTY_DSW` — so the difficulty switch doubles
as the player sprite's colour source (both are zero at the default difficulty, so the colour is
seen as 0).

Two flags track the player configuration during a game. `ACTIVE_PLAYER` (0x880d) [seen] selects
which player's score and counter banks are live (bit 0 clear = player 1, set = player 2), and
`TWO_PLAYER_FLAG` (0x880e) [seen] is nonzero for a two-player game and gates the per-player bank
swap and the two-player start event. Both are written together at start-of-life, described below.

### The three coin acceptors

Coin handling runs once per frame from the vblank service, which samples the three hardware input
ports — inverting each because they are active-low — into a small edge-detect ring at 0x8810. The
head of that ring, `INPUT_PORT0` (0x8810) [seen], carries the coin bit (bit 0), the 1P-start bit
(bit 3) and the 2P-start bit (bit 4). The service routine then calls the coin/credit chain
`loc_59e8`.

`loc_59e8` is the free-play gate: it reads both coinage configs and, if *either* `COINAGE_CONFIG`
or `COINAGE_CONFIG_SLOT2` holds the 0x0f free-play sentinel, it returns immediately — in free play
no coins are counted. Otherwise it runs the three coin acceptors in turn plus the coin-counter
strobe and a periodic integrity check.

Each acceptor is one of three sibling routines that share a common shape. Every frame it picks one
bit of the inverted input sample and rotates it into a per-slot debounce ring, then masks the
ring's low three bits and fires only when they settle on the pattern 0x01 — i.e. on a clean, held
edge rather than switch noise. The three differ in which input bit and which cells they use:

- **Coin slot 1** (`loc_5a56`) [code] samples input bit 0 into the ring at 0x882a. On a validated
  coin it bumps `COIN1_PULSE_COUNT` (0x8824) [code] (queueing a physical coin-meter pulse), then
  adds 0x10 to its coin accumulator at 0x882b and compares the running accumulator against
  `COINAGE_CONFIG`: while the config value still covers the accumulator it awards nothing and
  waits for more coins; once the accumulator overtakes the coins-required threshold it subtracts
  that threshold back out and awards the config's low-nibble count of credits (or the maximum when
  that nibble is 0x0f). Note that the accumulator cell 0x882b is `TAMPER_ROM_CHECK_FLAG` [code],
  which other code multiplexes for an unrelated purpose.
- **Coin slot 2** (`loc_5a1f`) [code] is the same mechanism one bit over: it samples input bit 1
  into the ring at 0x882d, bumps its own pulse counter at 0x8826, and accumulates at 0x882e against
  `COINAGE_CONFIG_SLOT2`.
- **The third acceptor** (`loc_5a06`) [code] samples input bit 2 into the ring `DRIP_RING_A`
  (0x8829) [code] and, on a validated edge, awards a flat single credit — it applies no coinage
  division and bumps no coin-meter pulse counter.

All three converge on a shared award tail (`loc_5a8c`): it adds the awarded amount to the credit
counter `CREDIT_COUNT` (0x8802) [seen], clamps the total at 0x63 (99 credits), and queues a
display command to refresh the on-screen credit line. A coin is seen to take this counter from 0
to 1. **Warning about the code as it stands:** the frozen bodies of these three routines and their
shared tail still carry comments that call 0x8802 a "score byte" and the routines "score-drip"
steps; the grounded role of 0x8802 is the BCD credit counter, and these routines are the coin
acceptors that fill it.

### Driving the physical coin meter

`loc_5a9c` [code] turns queued coin pulses into a timed strobe on the hardware coin-counter latch
`COIN1_COUNTER_LATCH` (0xa183) [code]. With no pulses queued it does nothing. On a fresh pulse
(the phase timer idle) it seeds `COIN1_PULSE_PHASE` (0x8825) [code] to 0x30 and raises the latch;
on subsequent frames it counts the phase down, drops the latch at phase 0x18, and retires one
queued pulse from `COIN1_PULSE_COUNT` when the phase reaches zero. The result is one clean,
correctly-timed meter pulse per accepted coin on slot 1.

### Displaying credits and free play

`queueCreditDisplayCommands` (0x0e54) [code] is what asks the display subsystem to show the credit
state. It enqueues one primary display command — high byte 0x07, argument 0x01 — into the
page-0x88 display-command ring, and *only* when `COINAGE_CONFIG` holds the 0x0f free-play sentinel
does it enqueue a second command (0x06, 0x06), the FREE PLAY variant. The enqueue itself
(`loc_0038`) writes the two command bytes into the next free slot of the ring buffer
`DISPLAY_CMD_RING_BUFFER` (0x88c0), advancing and wrapping the write pointer at
`DISPLAY_CMD_RING_WRITE_PTR` (0x88a0) [code]; an occupied slot silently drops the command. This
same primary command is what the coin-award tail queues after every credit change.

The credit *digits* are drawn by `loc_05ee` [code]: it reads `CREDIT_COUNT`, clamps it to 99,
converts to packed BCD, and writes the units nibble to `CREDIT_HUD_UNITS_VRAM` (0x869f) [code] and
the tens nibble to `CREDIT_HUD_TENS_VRAM` (0x86bf) [code], skipping the tens tile when it is zero.
Hidden behind that draw is an anti-tamper tripwire: only when the units digit is exactly 2 does it
sum a fixed 31-byte program block downward from a top address, and if that sum misses its 0x8c
sentinel it bumps a tamper-strike counter — a copy-protection check disguised as part of the
credit HUD.

### Spending credits and starting a game

When a start button is pressed the credit is spent and a game is seeded. On the 1-player path,
if `CREDIT_COUNT` is nonzero it is decremented by one and the start setup runs with both player
flags cleared (`ACTIVE_PLAYER`=0, `TWO_PLAYER_FLAG`=0): a one-player game with player 1 active. On
the 2-player path the handler first checks that at least two credits are present, subtracts two,
runs a small program checksum, and then runs the same start setup but with `TWO_PLAYER_FLAG` set:
a two-player game, again with player 1 active first. These match the seen behaviour of the credit
counter — a coin adds one, a 1P start consumes one, a 2P start consumes two.

The start setup itself (`loc_0dab`) writes the active-player and two-player flags, calls
`queueCreditDisplayCommands` to refresh the credit line, seeds the main game state and the in-play
gate, fires the start-of-game sound events, kicks the first screen builder, and — for a two-player
game — fires the additional two-player start event and clears a per-game block. Under free play
the start branches skip the credit accounting entirely and enter the game directly, which is why
the free-play sentinel is tested at every gate along this path.

### Configuration consumed elsewhere

Two of the boot-decoded switch cells are read outside this subsystem but originate here. The
`BONUS_AWARD_DSW` bit selects the extra-life award schedule — the tally step `loc_18da` [code]
uses it to choose its award-queue reload (5 vs 3) and its BCD step (8 vs 7). The `LIVES_DSW`
value, besides seeding lives, is what makes a periodic ROM integrity check (`loc_7e6d`, the last
step of the coin/credit chain) [code] run at all: that check is gated on a player having four or
more lives, so it is active only under the higher lives settings.

## In-play progression and timers

Once a game is running, the machine's forward motion is carried by a small stack of
state selectors, a family of countdown timers, a round counter that escalates
difficulty, and a scoring path that keeps each player's total and the high score in
step. This section follows those pieces and how they hand control to one another
during active play.

### The top-level state selector and the in-play gate

The heartbeat is the vblank service routine `loc_066d`. Every frame it samples the
three input ports into the edge-detect ring at `0x8810`, ticks a pair of free-running
frame counters, and then dispatches on the top-level game state in `MAIN_GAME_STATE`
(`0x8805`) through the handler table at `0x06f0`. That byte is grounded [seen] as a
discrete selector — it cycles `0/1/2/3` across a game — and value `3` is the play
state, routed to the in-play dispatcher at `loc_159b`/`loc_15a1`. Attract and intro
sit at the lower values, so simply reading `MAIN_GAME_STATE == 3` is what "the game is
in play" means at the coarsest level.

Underneath that sits the in-play gate `GAME_ACTIVE_FLAG` (`0x8806`), grounded [seen]:
it flips `0 -> 1` at start of life (in lockstep with `MAIN_GAME_STATE` reaching `3`)
and back to `0` at game over. Many of the gameplay handlers described below open with
a read of this flag and return immediately when it is clear, so it acts as a master
enable for scoring, the play clock, and per-frame object work while a life is live.

### The in-play sub-state machine

Within the play state, the fine-grained progression lives in `PLAY_STATE_INDEX`
(`0x880a`). The dispatcher `loc_15a1` masks it to five bits and uses it as an index
into the handler table at `0x15a8`, whose entries run round setup, per-phase setup,
active play, and the phase-exhausted path. The byte is grounded [seen] stepping
through the discrete values `1/2/3/4/7/10/13/18`, i.e. it does not walk every integer
— handlers deliberately jump it forward. The interesting stops are:

- **Index 0 — round init (`loc_1601`).** Reached at the very start of a round. It
  drains a tilemap-clear pass first (returning early each frame until the fill
  finishes), then clears the actor arena and a block of round-init cells, and on the
  first entry of a two-player round raises a once-per-round latch, enqueues a
  player-select display command, and floods the colour/attribute map. Its shared tail
  seeds the phase timer (`PHASE_TIMER`, value `0x02` normally or `0x80` on the first
  entry), advances `PLAY_STATE_INDEX` by one, restores the active player's saved
  `0x3f`-byte state page back into the live page at `SPEED_INDEX` (`0x8900`), derives
  the rope-segment count from the arrival counter, and copies the round message table
  into the display buffer.

- **Index 1 — phase setup gated by the phase timer (`loc_16b7`).** This handler simply
  decrements `PHASE_TIMER` (`0x8808`) and returns while it is still nonzero; only when
  the timer expires does it run the per-phase setup, choose a graphic/layout pair from a
  decision tree keyed on the round counter and several flags, seed the fixed display
  pointers, and bump `PLAY_STATE_INDEX` to the next stop. This is the canonical shape
  of a timed transition here: a countdown gates the step, the step reloads the next
  phase, and the sub-state advances.

- **Index 5 — the per-phase controller (`loc_1a64`).** This is where a round's phases
  are counted out. When the round-advance latch `0x8f50` is set it tails into the
  round-advance step `loc_1a01` (below). Otherwise, with the in-play gate open, it
  drains the phase gauge `GAUGE_PHASE_COUNTER` (`0x8908`) by one; if the gauge is (or
  reaches) zero it tails into the phase-exhausted handler `loc_1a96`, and if the gauge
  still has count it repaints the gauge and reseeds `PLAY_STATE_INDEX` to `0x0a`
  (`0x0b` for player one) — the value that re-enters an active-play phase. So each pass
  of index 5 spends one unit of the phase gauge and loops the sub-state back into a
  phase until the gauge is empty.

- **Index 6 — active-play tick (`loc_1b43`/`loc_1b8c`).** These siblings run the shared
  integrity-and-timer handler (`loc_7960`, below), flood attribute columns, enqueue
  display commands, then latch the play sub-state index and phase timer for the next
  step (the `loc_1b8c` variant seeds `PLAY_STATE_INDEX = 0x0c` and `PHASE_TIMER =
  0x60`).

- **Phase-exhausted (`loc_1a96`).** Reached when the phase gauge drains to zero. It
  queues the phase-exhausted sound run, advances `PLAY_STATE_INDEX` once
  unconditionally (and an extra step for player one), clears the high-score insert
  rank and two round cells, and hands off to the high-score insert-sort — the path by
  which a finished run flows toward score entry.

A companion flag, `ROUND_IN_PROGRESS` (`0x8904`), is grounded [seen] as a plain `0/1`
that reads `1` while a round runs and resets at stage and life transitions. It is
raised (along with `PHASE_TIMER` and `PLAY_STATE_INDEX`, all seeded to `1`) by the
screen re-init `loc_67df`, which fires only behind a clean colour-map checksum: on a
match it arms those three cells, clears the per-frame timer block, wipes the actor
arena, and repaints the playfield; on a mismatch it quietly hands off to the per-object
frame updater instead. Downstream field-paint code such as `loc_1dd3` keys its
choice of attribute-source table and marker layout on `ROUND_IN_PROGRESS`,
`GAME_ACTIVE_FLAG`, and the round counter's parity together.

There is also a second, independent sub-state selector for the non-interrupt main
loop: `MAINLOOP_SUBSTATE_SELECTOR` (`0x8f5c`, [code]), masked to three bits and
dispatched through the inline table at `0x0fe3`. The counter-and-three-field routine
`loc_10c2` walks a HUD counter toward a new value one step at a time, redraws three
stacked-BCD fields (each drawn at double its value), and then advances this selector
by one before queuing a sound cue — the shape of a round/bonus tally screen driven by
its own little state machine rather than the in-play index.

### The round counter and difficulty escalation

`ROUND_COUNTER` (`0x8907`) is the game's progression odometer, grounded [seen]:
captures show it incrementing by one on each stage transition (e.g. `2 -> 3`, `3 ->
4`). Its increment is performed by `loc_1a01`, the gameplay-state step that index 5
tails into once the round-advance latch is set. That routine first reseeds the
per-round phase counter `SPAWN_PHASE_COUNTER` (`0x8902`, [seen]) via the board/HUD
reset `loc_2527` (which, when that counter has hit its cap of `7`, reseeds it and the
rope-draw count to `4`), seats the lead sprite's attribute byte at `0x8901` (`0x30`
once the round counter reaches `2`, else `0x28`), and bumps the round counter. A
subtlety worth stating as it stands in the code: on the even-frame path the bump is
provisional — the first pass sets the `0x8f50` latch and *undoes* the increment,
so the round counter only truly advances once the latch has been armed, which is
what sequences the round transition cleanly across frames.

The round counter is read far more often than it is written, and its bits carry
distinct meaning (all [seen] roles on the cell):

- **Bit 0 (parity)** selects the stage-type / facing variant. Odd rounds take the rope
  path and mirror enemy facing (`loc_142c`, `loc_379d` negate the velocity), pick the
  alternate attribute-source tables (`loc_1dd3`), and enable the round marker
  (`loc_4a0b` returns early on an even round) and the odd-round actor sweep
  (`loc_5e78`).
- **Bit 1** gates the target-group fan-out — the target-group count is written only
  when this bit is set.
- **Bit 2** feeds branch choices such as the hit-flash animation selection in
  `loc_3a6c`.
- **The low bits as a table index.** Many spawn/motion routines derive an index from
  the round counter: `(round & 0x3f) >> 2` picks the facing and spawn-timer reloads
  in `loc_119a`; `(round >> 1) + 1` clamped to `6` is the spawn speed index in
  `loc_53b0`; `round & 0x07` and `(round & 0x07) >> 1` index difficulty tables in
  several enemy handlers.

Escalation also flows through `SPEED_INDEX` (`0x8900`, [seen]), which captures show
climbing `0 -> 2 -> 4 -> ... -> 14` as the round steps up. `loc_191c` computes it for
each new target group: gated on the stage countdown and lead-actor state being idle
and no enemy record already busy, it bumps the play sub-state, builds a value from the
difficulty base plus a round-derived term (the raw round on odd rounds, half the round
plus the wave-arrival count on even rounds), clamps it below `0x20`, stores it as the
speed index, and clears the aim flags. Difficulty proper is seeded once at boot from
the DSW into `DIFFICULTY_DSW` (`0x8820`, [code], static in the captures), and that base
feeds the speed computation and various threshold tables.

On the HUD, the round number itself is drawn by `loc_1f40`: when its table scan lands
on slot 0 it counts `ROUND_COUNTER + 1` into BCD, picks one of two 4x3 glyph blocks by
the tens bit, blits it, and mirrors the stage countdown into its HUD digit; every
match then draws the fixed stage label. `loc_4a0b` paints the round marker column and
its 3x3 glyph, but only on odd rounds.

### The timers

Several countdowns run concurrently during play, at different granularities:

- **The phase timer `PHASE_TIMER` (`0x8808`, [seen]).** A per-frame down-counter that
  wraps and reloads; it is decremented by the in-play handlers (`loc_16b7` at index 1,
  and `loc_2b23`, which also re-enters the integrity reset scan when a reset latch is
  armed and the timer has just hit zero) and reloaded to values like `0x60`, `0x02`, or
  `0x80` by the setup handlers to pace phase transitions.

- **The phase gauge `GAUGE_PHASE_COUNTER` (`0x8908`, [seen]).** Grounded draining
  `3 -> 2 -> 1 -> 0` then resetting to `3`, and drawn as a five-cell vertical HUD gauge
  by `renderPhaseGauge`/`paintPhaseGauge`. As described above, index 5 (`loc_1a64`)
  spends one unit of it per phase, and exhaustion routes to `loc_1a96`. It measures the
  phases remaining in the current round.

- **The play clock (`loc_7912`, rendered by `loc_7960`).** A genuine minutes:seconds
  timer kept per player. `loc_7912` bails when the in-play gate is clear, selects the
  active player's gate/timer pair (`PLAY_TIMER_GATE_P1/P2` at `0x89e1`/`0x89e2` and
  `PLAY_TIMER_BCD_P1/P2` at `0x8a30`/`0x8a33`, all [code]), and bails if that player's
  gate byte is set. The timer's base byte is a frame sub-counter that rolls at `0x3b`
  or `0x3c` (the extra frame chosen by bit 0 of the seconds byte, correcting the second
  length); on the roll it BCD-carries the seconds digit — low nibble at `0x0a`, high
  nibble at `0x60` for a true sixty — then the minutes digit. The shared handler
  `loc_7960` splits the active player's minutes/seconds BCD bytes into nibble tiles up
  the `PLAY_TIMER_DIGIT_VRAM` (`0x862d`, [code]) column with a spacer between them, then
  clears those timer bytes, so the clock is re-rendered fresh each pass. On a high-score
  insert the two play-timer bytes are shifted into the per-entry side table
  `HIGH_SCORE_TIME_TABLE` (`0x89e0`, [code]).

- **The shared frame-delay timer `SHARED_FRAME_DELAY_TIMER` (`0x8929`, [code]).**
  Decremented while nonzero to gate several per-object update sweeps; it sits at the
  head of a nine-byte per-frame timer/flag block (`FRAME_TIMER_BLOCK_BASE`, `0x8928`)
  that the screen re-init clears wholesale.

- **The inter-wave hold `WAVE_HOLD_TIMER` (`0x8f36`, [seen]).** Grounded draining `48`
  toward `0` one step per frame and reseeded (`0x18`/`0x20`/`0x30`) to gate the next
  attack wave. The wave-arrival/progress counters `WAVE_ARRIVAL_COUNTER` (`0x8903`,
  [seen]) and `WAVE_PROGRESS_COUNTER` (`0x8d7d`, [seen]) ramp with arrivals and feed
  both the rope-segment bound and late-wave aggressiveness.

### Scoring

Score accrual runs through `loc_0496`, which fires only while the in-play gate's bit 0
is set. An award index picks the increment: index `0` uses the per-frame increment cell
`PER_FRAME_SCORE_INCREMENT` (`0x88ab`, [code]), and any other index reads a three-byte
entry from `SCORE_AWARD_TABLE` (`0x0501`, [code], stride 3). The chosen three-byte
packed-BCD increment is added — with a faithful BCD carry chained from the least
significant byte up — into the active player's counter, whose base is chosen by
`selectActivePlayerScoreBuffer` from bit 0 of `ACTIVE_PLAYER` (`0x880d`, [seen]):
`P1_SCORE_BCD` (`0x88a2`) for player one, `P2_SCORE_BCD` (`0x88a5`) for player two,
both grounded [seen] as live per-player buffers that accumulate only during their own
player's turn. After the add, `loc_0496` repaints that player's score column and then
compares the counter against the running high score most-significant byte first;
a strictly greater counter is copied over the high-score bytes (`HIGH_SCORE_BCD` at
`0x88a8`, MSB `HIGH_SCORE_BCD_HI` at `0x88aa`, [seen]) and its column repainted. The
column painters are shared: `loc_056b` draws any of the three counters (player one,
player two, or high score) down its screen column with leading-zero blanking, and
`loc_0552` zeroes a counter and repaints it (used at reset).

A separate, slower award path handles the bonus/extra-award schedule in `loc_18da`.
The pending threshold lives in `AWARD_QUEUE` (`0x8909`, [code]): when it is zero the
routine reloads it from the schedule (`5` or `3`, chosen by the boot-decoded
`BONUS_AWARD_DSW` at `0x8800`, [code]) and returns. When it is nonzero it gates on the
active player's score MSB reaching the queued value; on a match it bumps a saturating
counter at `GAUGE_PHASE_COUNTER` (`0x8908`), BCD-steps the queue to its next threshold
(step `8` or `7`, again per the DSW), redraws the gauge, and appends the tally sound.
Because the DSW cell is static in the captures and scores stayed low, this whole award
path is [code] — read from the routine body, not exercised by the golden runs.

Alongside the score, the credit count `CREDIT_COUNT` (`0x8802`, [seen]) is drawn as two
HUD digits by `loc_05ee` (clamped to 99, tens digit suppressed when zero), which also
hides an anti-tamper checksum tripwire behind the specific case of the units digit
being `2`.

### Grounding

The core progression *cells* are [seen] against the MAME golden trajectories: the
top-level state `MAIN_GAME_STATE` (`0x8805`), the in-play gate `GAME_ACTIVE_FLAG`
(`0x8806`), the phase timer `PHASE_TIMER` (`0x8808`), the sub-state index
`PLAY_STATE_INDEX` (`0x880a`), the active-player select `ACTIVE_PLAYER` (`0x880d`),
the speed index `SPEED_INDEX` (`0x8900`), the per-round phase counters (`0x8902`,
`0x8903`), `ROUND_IN_PROGRESS` (`0x8904`), the round counter `ROUND_COUNTER`
(`0x8907`) and phase gauge `GAUGE_PHASE_COUNTER` (`0x8908`), the wave hold timer
(`0x8f36`) and progress counter (`0x8d7d`), and the per-player scores plus high score.
The *routine mechanics* that read and write them are [code] (read from the code,
MAME-grounding via the cells), and the bonus-award queue (`0x8909`), the
per-frame/table score increments (`0x88ab`, `0x0501`), the difficulty DSW (`0x8820`),
and the play-clock cells (`0x8a30`/`0x8a33`, gates `0x89e1`/`0x89e2`, digits `0x862d`)
are [code] — their values stayed static or unobserved in the captures.

### Open questions

The cell at `0x8908` is grounded [seen] as a phase gauge that *drains* `3 -> 0`
(consumed one unit per phase by `loc_1a64`, exhaustion routed to `loc_1a96`), yet the
bonus-award step `loc_18da` reads and *bumps* the same cell saturating toward `0xff` on
a score-threshold crossing the golden runs never reached; how the drain and the
saturating bonus-award use of `0x8908` reconcile (multiplexing, mode-dependence, or a
dormant path) is not settled and needs a scoring-active MAME capture to ground.

## The actor arena

Everything that moves on screen in Pooyan — the player on his elevator, the wolves that
climb and dive, the arrows and meat and balloons — lives as a record in one big arena of
fixed-size structures. The arena proper begins at `ACTOR_TABLE` (0x8a80) [seen], a block
whose slot 0 is the player/lead actor and whose records march at a stride of 0x18 bytes. It
is confirmed alive by the golden RAM trace: slot 0's first field toggles to 1 exactly when
the player becomes active, and the whole 0x8a80 region is zero-filled at board init. Several
sibling record pools share the identical 0x18 layout and are swept by their own loops: an
enemy sub-array at `ENEMY_ACTOR_TABLE` (0x8ae0) [seen], a five-slot secondary object pool at
`SPRITE_OBJECT_TABLE` (0x8b70) [seen], the six-slot per-frame object-state array at
`OBJECT_STATE_RECORD_BASE` (0x8ba0) [code], the three-slot projectile pool at
`PROJECTILE_TABLE` (0x8be8) [seen], a four-slot formation table at `FORMATION_TABLE`
(0x8c30) [seen], a three-slot spawned-object table at `SPAWN_OBJECT_TABLE` (0x8c48) [seen],
and a two-entry target pair at `ENEMY_TARGET_REC0` / `ENEMY_TARGET_REC1` (0x8c90 / 0x8ca8)
[seen]. All of these are grounded as live, actively-rewritten record regions by the golden
capture; the routines that manipulate them are read from the code and carry [code] tags.

### The record layout

You never see a struct definition — the layout emerges from how every routine touches the
same offsets. Byte +0x00 and +0x01 carry the presence/active bit: a record counts as live
when bit 0 of *either* of the first two bytes is set, which is why the free-slot search and
the state dispatcher both fold `(rec+0) | (rec+1)` and test bit 0. Byte +0x02 is the
state/phase selector that drives dispatch; different pools mask it differently (the lead
actor takes `&7` into a six-way table, the per-frame objects take `&3` into a four-way one),
but the byte is always "which handler runs this frame," and handlers advance an actor by
incrementing it. Byte +0x03 is a fractional sub-position and +0x04 the integer row/Y that it
carries into; +0x06 holds an X (or column) position; +0x09 is a fall velocity and +0x0a a
signed movement speed. The animation block sits at +0x0c/+0x0d (a little-endian sequence
pointer), +0x0e (the frame/step index or hold count), +0x0f and +0x10 (the two display-tile
bytes). Byte +0x11 is a per-frame delay/frame countdown used by nearly every motion and draw
handler; +0x12 is an animation-hold timer (and doubles as a 0xff "fresh record" marker);
+0x13 is a phase or spawn-index sub-state; +0x14 is a match key identifying the record;
+0x15/+0x16 hold a 16-bit word (a screen pointer or datum, with +0x16 also carrying an
armed-bit at bit 1); +0x17 extends into a 16-bit datum. Field meanings are overloaded per
pool, but these anchor offsets — presence at +0x00/+0x01, state at +0x02, the +0x0c..+0x11
animation/timing block — hold everywhere.

### Board reset and seeding

A new board wipes and re-seeds the machine through `resetActorStateForBoard` (0e00) [code].
It first clears 0xbf bytes of the live-state page that starts at `SPEED_INDEX` (0x8900) —
the per-board bank of speed index, stage countdown, spawn/wave counters and rope counts —
then knocks down a handful of loose flags: `PLAY_STATE_INDEX` (0x880a), the two per-player
play-timer gates, a scratch cell at 0x89e3, and `LATCHED_ENEMY_X` (0x8f5b). It reads the
lives DIP switch and stamps it into both `PLAYER0_LIVES` (0x8948) and `PLAYER1_LIVES`
(0x8988) [seen], seeds each player's saved bank with a fixed opening X of 0x20 at bank+1 and
the sprite colour from the difficulty switch at bank+0, and arms the row-by-row VRAM tile
fill. The reset then forks on the in-play gate `GAME_ACTIVE_FLAG` (0x8806): when the game is
idle it stops there, and only when a game is actually running does it also clear the launch
flags `LAUNCH_ARMED_FLAG` (0x8f3f) and `LAUNCH_STATE` (0x8f30) and two adjacent launch
cells. Both exits leave the accumulator zero; the memory writes are the substance.

The actor arena itself is zeroed separately. `clearActorArena` (19bc) [code] blanks the
whole 0x200-byte block from `ACTOR_TABLE` so a fresh board carries no stale record state,
and `clearActorArenaAndCounters` (2ae8) [code] is the heavier teardown reached as a dispatch
state: it zeroes a 0x241-byte span from `ACTOR_TABLE`, clears the spawn/wave/rope tallies
(`SPAWN_PHASE_COUNTER` 0x8902, `WAVE_ARRIVAL_COUNTER` 0x8903, `ROPE_SEGMENT_COUNT` 0x8931,
all [seen]), and forces the in-play sub-state to 6 so the next phase picks up cleanly.

Individual records are stamped as they are handed out. `initActorRecord` (619f) [code] seeds
a fresh 0x18-byte record with its opening constants — +0x00=0x00, +0x01=0x01 (the presence
bit), +0x02=0x08 (an opening state), the 0xff fresh-record marker at +0x12 — and writes a
16-bit datum little-endian into +0x16/+0x17, leaving the scan pointer advanced to +0x17 for
the caller's build loop to continue from. `seedObjectRecord` (0a0c) [code] fills a record
from two parallel streams: a two-byte descriptor (into +0x06 and +0x04) and a two-byte
little-endian coordinate (into +0x0c/+0x0d), then clears the timer at +0x0e, advancing both
source pointers by two so a build loop can walk a table of descriptors and coordinates in
lockstep. When a spawn needs a home, `loc_13bc` scans the five secondary-pool slots at
0x8b70 for one whose presence bit is clear; finding one, it bumps the wrapping sprite-id
counter `ANIM_FRAME_COUNTER` (0x8d41, skipping 0), stamps that id into +0x14, points the
record at an animation script, and seeds +0x11=0x28 and +0x02=0x04 to launch it into motion.
The spawn column can be nudged by `adjustSpawnColumn` (57b4) [code], which in the early part
of a stage — while `STAGE_COUNTDOWN` (0x8901) is still below 3 and `WAVE_PROGRESS_COUNTER`
(0x8d7d) has passed 0x0c — shifts the column right by `(progress − 0x0c)`, and otherwise
leaves it untouched.

### The per-slot scan loops

The arena is driven by a family of fixed-stride sweeps, each pointing an index register at a
pool base and stepping by 0x18. The lead-actor driver reads `ACTOR_TABLE`'s state byte at
+0x02, masks `&7`, and dispatches slot 0 through a six-entry table — the phase index
`LEAD_ACTOR_STATE` (0x8a82) [seen] is confirmed to cycle 0→1→2→3→4→5→0 at roughly
sixteen-frame intervals, matching exactly the six handler slots, and it also gates spawn and
formation logic once it reaches 3 or more. Before dispatching, that driver aborts the whole
group if the tamper freeze flag (0x881e) is nonzero, so a checksum failure quietly stops
actor updates. A second sweep runs the animation stepper over four records at 0x8a80, 0x8a98,
0x8ab0 and 0x8ac8, gated shut whenever a rope-grab is in progress (`GRAB_ACTIVE_FLAG`
0x8d32). The six-slot object-state array at 0x8ba0 is swept record-by-record, calling the
four-way state dispatcher on each. Enemy records at 0x8ae0 are searched by key: given a key
byte, the scan compares it against +0x14 of up to six enemy records and, on a match, tails
into the matched-record handler; a miss either returns quietly or runs a shared helper
depending on the active object type latch (0x8d44). These loops share a discipline — set the
base, set stride 0x18, count down the slots — and differ only in which pool and which
per-record action they carry.

### The object state machine

The heart of the arena is a compact four-state machine, one instance per object record,
selected by `dispatchActiveObjectState` (7707) [code]. It first skips any record whose
presence bit is clear, then reads +0x02, masks `&3`, and runs one of four handlers, each of
which returns straight to the sweep — no continuation is stacked, so a handler can advance
the state and let the *next* frame pick up the new one, or fall straight through into the
following state within the same frame.

State 0 (ROM 0x771d) arms a new object: while the frame countdown at +0x11 is still ticking
it just returns, and on expiry it pulls the next index from the spawn ring counter
`SPAWN_RING_COUNTER` (0x8d57) [code] (read then incremented), stores it as the spawn index at
+0x13, looks up a word from a ROM table into +0x15/+0x16, seeds the speed at +0x0a to 0xec,
advances the state, and falls straight through into state 1 so the freshly-armed object also
moves this same frame. State 1 (ROM 0x7740) advances one object: it steps the sub-position at
+0x03 by the signed speed at +0x0a, borrowing one cell into +0x04 on underflow, and while the
cell fraction stays at or above 9 it simply returns; once the object crosses into the next
cell it advances the state, reloads the frame timer +0x11 to 0x18, installs the sprite via
the animation-pointer path, and then runs a five-byte ROM checksum guard that bumps a tamper
counter (0x89e9) on a mismatch. State 2 (ROM 0x7790) draws the object twice — once from one
character table at the object's screen pointer in +0x15/+0x16, and again from a second table
one row above — then sets the drawn flag `OBJECT_DRAWN_FLAG` (0x8d58) [code] if it was clear
and falls through into the record-clear epilogue. State 3 (ROM 0x7881) is a periodic
self-integrity pass gated by the same +0x11 countdown: it sums nine 32-byte ROM blocks
against an expected-sum table and a serpentine sum over video RAM, diverting to the tamper
path on any mismatch, and on success clears two RAM spans and re-inits the slot. When a
record is genuinely idle the dispatcher can land on a phantom `noopStateHandler` (0e53)
[code] — a bare return that draws nothing.

The lead actor's six-way table is a parallel machine over slot 0's +0x02, and several of its
states are small per-frame steppers. A rising actor (`advanceRisingActorStep`, 2ab3 [code])
reloads a short delay into +0x11, bumps a frame counter at +0x0b and flips its display tile
between 0x15 and 0x1e every fourth frame, drives its rise position at +0x06 upward, and once
it reaches the top (0xc0) nudges the base Y at +0x04 up by 3, advances the state, and seeds a
long inter-state delay of 0x40. A falling actor (`advanceFallStep`, 3fd5 [code]) treats its
vertical position as 16-bit fixed point — fraction at +0x03, integer row at +0x04 — adding
the fall velocity at +0x09 into the fraction and carrying one whole row on 8-bit overflow;
it reports "still airborne" while the row stays above the landing row 0x1e. A settling actor
(`advanceActorDropStateOnDelay`, 24db [code]) counts down +0x11 and, only at zero, nudges its
Y down by 4 and its X back by 8, restamps the display tile to 0x1a, reseeds the delay to 0x30,
and advances to the next dispatch state. And the bonus/eagle wave ends its phase through
`advanceEaglePhaseAndClearAim` (7292 [code]), which drops the player aim flags and the latched
enemy X, steps the eagle-wave phase selector one place, and clears the records-arrived count
so the next phase begins fresh.

### Animation

Each record's on-screen appearance is a little bytecode interpreter over the +0x0c/+0x0d
sequence pointer. To point a record at a new sequence, `setActorAnimation` (381e) [code] and
its sibling `storeActorAnimationPointer` (5c75) [code] write the pointer little-endian into
+0x0c/+0x0d and reset the step index at +0x0e to 0, so the actor restarts its script at step
0. `advanceActorAnimFrame` (403c) [code] steps that script: byte +0x0e is a frame-hold
counter, and while it is nonzero it simply decrements and holds the current frame; on expiry
it walks the stream, treating a 0xff opcode as "reload the stream pointer from the next two
bytes and re-read" (so a sequence can loop or jump), and any other byte as the first of a
three-byte frame record — tile into +0x10, a second tile byte into +0x0f, and the new hold
into +0x0e — after which it writes the advanced pointer back. A separate, coarser hold lives
in `tickActorAnimHold` (5d1e) [code]: it proceeds only for records with a per-record animate
bit set (+0x0b bit 0) or, lacking that, only on even rounds of `ROUND_COUNTER` (0x8907), and
only for records that are present (+0x00 bit 0) and armed (+0x16 bit 1); it counts the hold
timer at +0x12 down and, on underflow, steps the two-bit phase at +0x13 down and re-arms,
disarming the record entirely when the phase is exhausted.

### Collision, display and the sprite list

Collision starts with a bounds precheck. `precheckCollisionBounds` (5f53) [code] reads the
flip-screen flag (0x881f) to choose an X bias (+6 upright, −2 flipped), forms the biased X in
E, computes the Y-plus-margin in A, and reports whether that Y clears the bottom limit 0xe0 —
the off-screen gate its caller reads before doing any real hit test. The
presence of the two I-parity target records is folded by `foldTargetPresenceBits` (22d0)
[code], which walks the pair at 0x8c90/0x8ca8 and rotate-folds each present record's bit into
an accumulator; note that the accumulator is seeded to 0 and only ever rotated, so as the
code stands the fold always resolves to 0 before its `cp 0x03` — the rotate is reproduced
faithfully but is degenerate for the live seed. When a hit is registered,
`stampObjectAndDecCounter` (57e5) [code] reads a control byte, decrements a shared one-byte
counter in place (its zero-crossing becoming the caller's exit condition), and stamps the two
fixed state bytes +0x13=0x01 and +0x16=0xc1 into the struck record.

The player is drawn as three vertically-stacked sprites, and `deriveStackedSpriteYs` (23d7)
[code] fans the player-actor base Y at `PLAYER_Y` (0x8a84) [seen] out to the Y fields of
stacked slots 3, 2 and 1: slot 3 gets the base Y at 0x8a80+0x4c, slot 2 gets Y−0x10 at +0x34,
and slot 1 gets Y−0x10+0x0a at +0x1c. Records are projected into the hardware sprite list by
`copyObjectRecordsToDisplayList` (032a) [code], which for each of a count of records emits four
record fields — +0x06, +0x10, +0x04, +0x0f — into four successive display-list bytes, stepping
the record pointer by a caller-supplied stride while the list's low byte advances alone so the
writes wrap inside the list's 256-byte page. For a flipped cabinet, `mirrorSpriteListVertically`
(0378) [code] walks the 24-entry stride-4 sprite list at `SPRITE_DISPLAY_LIST` (0x8840) [seen],
negating and offsetting each entry's two coordinate bytes and toggling the two flip bits in the
attribute byte while preserving its low nibble. A small utility, `clearBit2AcrossSixSlots`
(0e46) [code], clears bit 2 of the first byte in each of six stride-4 entries — a per-frame flag
reset across a run of sprite slots.

### Player banks

Because two players alternate on the same live state, the arena's per-board page is swapped
in and out of per-player banks. The live state page begins at `SPEED_INDEX` (0x8900), and its
first 0x3f bytes are the per-player block. `saveLivePageToPlayer0Bank` (1bab) [code] snapshots
that page into player 0's bank at `PLAYER0_STATE_BANK` (0x8940) [seen] and resets the play
sub-state index to 0, first latching the active-player flag when this is a two-player game
whose player 1 is still alive. The more general `saveLiveStateToPlayerBank` (1a47) [code]
clears a status byte in the caller's page, then copies the 0x3f-byte live page into whichever
bank `ACTIVE_PLAYER` (0x880d) selects — player 0's at 0x8940, or player 1's at
`PLAYER1_STATE_BANK` (0x8980) [seen] — and zeroes the play sub-state index. On the swap back
in (the restore direction) the same banks feed the live page, so each player resumes his own
board exactly where he left it, colour byte and opening X included.

### Open questions

The six-slot object-state array at `OBJECT_STATE_RECORD_BASE` (0x8ba0) and its four-way state
machine are read entirely from the code ([code]) — the golden captures did not exercise a
full arm→advance→draw→integrity cycle on this pool, so the handlers' behaviour and the exact
per-pool overloading of the shared 0x18-byte fields remain MAME-grounding pending.

## Waves, rope and launch

Everything in this subsystem hangs off a small cluster of RAM counters that measure "how
far into the round are we": a spawn-phase counter that ratchets upward as enemies are
cleared, a per-stage arrival tally, and a five-notch phase gauge on the HUD. Those numbers
in turn gate three visible machines — the rope/lift column that grows and retracts up the
playfield, the arrow-launch state machine that fires and re-arms, and the eagle attack-wave
driver that seeds, walks and tears down each swarm — and a background siren driver that
ticks a periodic event on top of all of it. This section follows that spine from the
counters outward.

### The spawn-phase counter and its snapshots

The spawn-phase counter at `0x8902` [seen] is the round's step index. It is bumped one at a
time by the shared enemy-despawn tail: whenever an actor is retired, that tail drops the
active-enemy count and the stage countdown, and — only while the play sub-state index sits
at its fourth value — nudges `0x8902` up by one. So the phase counter advances as the player
grinds through the fourth phase of a stage. It is not allowed to run away: the board/HUD
reset routine watches for the counter reaching its cap of `0x07`, and on that it reseeds both
the phase counter and the rope-draw count (`0x8934`) back down to `4`, then blanks the
formation slot table and a spread of actor/HUD cells. The counter's live value therefore
cycles up toward 7 and snaps back to 4 [seen].

Two mirror cells carry a copy of the phase for the drawing machines. The round-marker
renderer — which runs only on odd frames of the round counter (`0x8907` bit0) [seen] — reads
`0x8902` and stamps it into both the spawn-phase snapshot at `0x8d43` [code] and the
rope-draw count at `0x8934` [seen], then paints that many stacked marker pairs down a
tilemap column (or, for a zero count, stamps a single glyph block at a fixed anchor). The
snapshot at `0x8d43` is what the interior-band arm code reads and steps, so gameplay's turn
logic works from a frame-delayed copy of the phase, not the live counter.

### The phase gauge and phase exhaustion

Alongside the numeric phase there is a separate depletion gauge at `0x8908` [seen], drawn as
a five-cell vertical bar rising from the base tile at `0x863f` [seen]. The renderer reads the
gauge count, draws `count − 1` filled tiles (`0xb0`) upward one tilemap row at a time —
clamped to five cells — and blanks the cells above them with tile `0x10`; a zero count leaves
the bar untouched. In play this gauge is observed draining `3 → 2 → 1 → 0` and then resetting
to 3 [seen]. Reaching zero does not kill the player: it fires the phase-exhausted handler,
which queues the phase-exhausted tile run, advances the play sub-state index (an extra step
for player one, then one unconditionally), and — the load-bearing side effect for this
subsystem — zeroes the rope-segment count at `0x8931` and the marker layout pointer before
tailing into the high-score insert path. Phase exhaustion is thus the event that tears the
rope back down. (The same gauge cell is also read by the spawner as a difficulty threshold —
a phase at or above `4` adds a column bias to freshly-spawned enemies [code] — but its
grounded role is the HUD depletion bar.)

### The rope mechanic

The rope is tracked by two counters that sit one frame apart. The logical segment count at
`0x8931` [seen] is the "how many segments are extended" tally, an up-counter that climbs
0..4; the draw count at `0x8934` [seen] is the phase snapshot the renderer works from. At a
phase transition the round-init setup seeds the segment count directly from the stage's
arrival tally: when the wave-arrival counter (`0x8903`, below) is non-zero it writes
`0x8931 = 0x8903 − 2` [seen]. So the rope's length for a stage is bound to how many enemies
have arrived in it.

Growth is run by a small two-state rope-extend machine whose selector lives at `0x8f14`
[code]. Its state-0 handler adds exactly one segment per invocation. It first bails the
moment the rope has reached its per-stage length — the guard `(0x8903 − 2) == 0x8931` — and
otherwise increments the segment count. Below a segment index of four (`0x8f18` [code]) the
extend runs freely; at or above four it will only continue while a tamper strike is pending,
using the strike value as its table index instead. It then looks this segment's video-RAM
column low byte out of the four-entry ROM column table at `0x2db8` [code], pairs it with the
fixed video page `0x84` to form the column base in `0x8f19` [code], reloads that segment's
cell timer in the per-cell timer array at `0x8f28` [code], advances the rope sub-state, and
arms the sub-timer at `0x8f16` [code] to `0x10`.

The visible column of glyphs is painted by a separate per-frame lift/marker driver, which
does the growing, retracting and steady redraw of the rope column. It runs on odd round
frames only (even frames divert to a sibling), and paces itself on the rope-draw step timer
at `0x8f09` [code]. When that timer expires it reloads and picks one of three modes off the
formation slot table at `0x8920`: if that table is non-zero it *retracts* — blanking a band
of cell-pairs above the layout pointer with tile `0x80` and queuing the retract command;
otherwise it runs the *forward* path. Forward, it compares the live phase (`0x8902`) against
the draw count (`0x8934`): a mismatch with the extend flag (`0x8f05` [code]) clear begins a
new extend sweep — bumping the draw count, raising the extend flag, and repointing the layout
cursor at the sprite band base — and once the sweep reaches its limit it drops the extend flag
and clears the interior-band armed latch (`0x8f63`). While extending it grows the column one
row upward each pass, pulses the new cell pair, and queues the two extend commands; when the
cursor reaches the cap mark it raises the rope-draw-complete flag (`0x8f04` [code]). Either
mode ends by stamping the chosen glyph source down the counted rows, and the forward path
appends a 3×3 cap glyph below the last record. Animation parity (`0x8f0a` [code]) alternates
the glyph source between its even and odd ROM variants each frame. The rope's cell tiles come
from the 2×2 ROM sources at `0x2dfe` and `0x2e1e` [code], and each spawned rope slot's field
is seeded from the four-byte table at `0x2ec7` [code] indexed by the low two bits of the cell.

### The rope-grab latch

Whether an enemy has caught the rope is held in the grab-active latch at `0x8d32` [seen]. The
grab test looks this cell's catch-window half-width out of a table keyed by the low two bits
of the cell index, then checks the tracked player coordinate against a fixed fourteen-wide
window around it. Outside the window, or with the formation state (`0x8f08`) or wave-teardown
state (`0x8f24`) already busy, no grab fires and the caller keeps updating the cell. Inside
the window and idle, it raises `0x8d32`, queues the grab command, and signals the calling
rope-cell handler to abandon that cell's update for the frame. Once set, the grab latch acts
as a global "grab in progress" gate: the siren driver reroutes around it, and it is torn back
down at wave teardown [seen].

The interior sprite band that the enemy climbs onto is armed by the object X-movement
handler. As an object walks its tile column past a turn-column limit (`0x8d4b`), the handler
compares the masked column to that limit: below it, nothing; above it, it flags the record and
arms a turn-around animation; exactly at the limit — and only while the play sub-state permits
it — it either just latches the record (if the band is already built) or, on the first arm,
steps the capped phase snapshot (`0x8d43`), looks the new turn-column limit out of the ROM row
table at `0x3418`, stamps the four interior-band tiles `0xd8..0xdb` into the sprite band at
`0x86e3`, raises the anim-armed latch at `0x8f63` [code], and falls into the shared despawn
tail. That latch is a one-shot gate against rebuilding the band; it is cleared on board reset
and at the rope's terminal, and the band-build path is [code]-confident (not observed live).

### The arrow-launch state machine

Firing the arrow is a five-state machine selected by the low three bits of `0x8f30` [seen],
dispatched once per frame into handlers for states 0..4:

- **State 0 — arm and gate.** It arms the launch flag `0x8f3f` [seen] once its preconditions
  hold: if the lane-spawn countdown (`0x8d75` [seen]) is up and the arm latch `0x8f20` [seen]
  is still clear, it bumps the arm latch and skips the stage check; otherwise it requires the
  stage countdown (`0x8901`) to be non-zero and a multiple of eight. With the flag armed it
  returns unless the arrow has risen to at least `0x3c` in `0x8ab4` [code] and neither hunter
  target record shows its hit bit. Clearing those gates, it steps the launch state, reseeds the
  flip countdown (`0x892f`), may light a HUD cell, refreshes the arm latch from its seed at
  `0x8d7a` [code], and blits the launch tile from `0x2d51` into `0x84a7`.
- **State 1 — animate or seed.** While the arrow sits at or above `0x34` it runs the flip
  countdown and, on each expiry, alternates the two arrow tile sources (`0x2d51` / `0x2d55`
  [code]) by a shared phase byte's parity. Once the arrow drops below the gate it scans the
  two enemy-target records for a free one; finding one, it jumps the launch state straight to
  `2`, marks that record, queues the launch sound, blits the alternate tile, and seeds three
  record fields.
- **State 2 — seed a hunter.** Unless the play-mode latch (`0x8f50`) is set, it scans six
  hunter records for a free slot and stamps in the opening state, coordinates and tile ids,
  recording the slot's address. It then advances the state, and either seeds the hunter-spawn
  countdown (`0x8f34`) and enqueues a display command, or — when the flip flag is set — bumps a
  sub-counter instead.
- **State 3 — hold then clear.** It runs the hunter-spawn countdown; while non-zero it just
  decrements. On expiry it advances the state and, unless the play-mode latch is set, zero-fills
  the `0x18`-byte record the launch-clear pointer names.
- **State 4 — idle.** A bare no-op; the machine parks here until it is reset.

The cycle closes when the launched arrow-object leaves the screen. The two-axis object stepper
integrates the launch velocity into the object each frame; once its Y high byte reaches `0xe8`
the object is spent, and the stepper zeroes `0x8f30` and the launch flag `0x8f3f` together
(along with the object's scratch cells) and blanks the record. Board reset does the same,
forcing both back to zero. The object's motion follows the dual-use script/countdown pointer at
`0x8f4a` [seen], a `0xff`-terminated launch/dive script that also fires a countdown at `0x40`.

### Enemy-formation launch and wave teardown

Formations of enemies are gathered and dispatched through the formation state at `0x8f08`
[seen]. While the formation-enable flag (also `0x8f04`) is clear the manager does nothing. With
the formation idle (state 0) it scans seventeen actor records for launch-ready slots — idle or
queued with a clear ready byte — registers each record pointer into the slot table at `0x8920`
and marks it queued; when the fourth entry fills the table (its low byte reaching `0x28`) it
arms the formation to state 1 and seeds the rope-draw step timer to `0x20`. When the formation
is active it dispatches `(state & 3) − 1` into the phase-handler table at `0x30eb` and then runs
the shared teardown epilogue. The formation state is observed cycling `0 → 1 → 2 → 3 → 0`
(gather → full → dispatch → reset) [seen].

Teardown is keyed on the wave-teardown state at `0x8f24` [seen]. State 1 dismantles the wave:
it clears the wave-event latch (`0x8d21`), reseeds the periodic-event timer (`0x8d22`) to
`0x20`, runs the teardown helper, advances the state, and then runs a running-sum self-check
over a `0x20`-byte block whose masked non-zero result diverts into the anti-tamper path. State 2
walks the boss/lead actor down two pixels per frame — refreshing the derived sprite Ys while it
stays above `0xdb` — and once it reaches that limit queues the completion command and, if the
gate byte is clear, raises the completion latch and advances the state. States 0 and ≥3 return.
While `0x8f24` is non-zero it reads as "busy" and blocks new grabs and launches; it is observed
cycling `0 → 2 → 3 → 0` in lockstep with the formation [seen].

### The eagle attack-wave driver

The recurring swarm — seeded, walked, and retired once per frame — runs off a bank of wave
cells: the wave index at `0x8f3d` [seen], the launch flag at `0x8f3a` [code], the live record
count at `0x8f3c` [code], the outer-phase counter at `0x8f38` [code], the records-arrived
sub-count at `0x8f39` [seen], and the inter-wave hold timer at `0x8f36` [seen]. The top-level
driver picks one of three states: with the launch flag clear it seeds the next wave; with the
record count zero it hands off to the inter-wave idle handler; otherwise it walks the wave's
live records — two records per wave index — through the per-record state handler.

**Seeding.** The seed runs only while the target slot is clear. It raises the launch flag and
advances the wave index; on the fourth wave it merely re-arms the outer phase and reloads the
hold timer to `0x20`. Otherwise it writes the record count as `2 × index`, initialises that many
records in the enemy-actor table (stride `0x18`) from the four-byte-per-record ROM parameter
table at `0x7409` [code] — each marked active with four copied fields, records whose own low
address has bit 3 set also get a flag field — and finally clears the outer-phase and
records-arrived counters. The wave index is observed marching `0 → 1 → 2 → 3 → 4 → 0` [seen].

**Approach.** Each record's approach handler waits until the eagle has reached that record's
grid slot — its column within one of the target column, its row inside a five-row window above
the target row — then advances the record state and arms an animation. Odd records (bit 3 of
the record's low address) take one animation and a flag byte; even records take another, bump
the records-arrived count, and — once every record of the wave has arrived (`arrived == index`)
— queue the wave-arrival command offset by the arrived count. A parallel approach machine drives
the player's aim-indicator flags off the eagle's advancing coordinate against a near threshold
(`0x59`) and a far threshold (`0x60`): it latches the enemy X into `0x8f5b` [seen] once the
coordinate crosses `0x60`, and when the coordinate sits exactly on `0x59` it steps the
records-arrived sub-phase (`0 → 1` clears aim, anything-but-2 `→ 2` arms aim, `2 →` the grid
step). On the final sub-phase, once armed, it advances a grid cursor every eighth frame
(`0x8f3b` [code] low three bits), stamping a marker tile `0x2c` and a colour attribute into the
eagle grid region based at `0x87e0` [code]; reaching the grid edge sets the finish latch
`0x8f3e` [code] and diverts into the phase-reset epilogue, which drops the aim flags and the
latched X, advances the outer phase, and clears the arrived count.

**Idle and retirement.** The inter-wave idle handler drains the hold timer; on expiry, if a wave
index still stands, it enqueues a command carrying that index, then reseeds the hold timer to
`0x18` and clears the launch flag — so the next frame's driver seeds a fresh wave. When an
individual eagle record retires it is zero-filled and the live record count is dropped; the last
record's retirement reseeds the hold timer to `0x30`. The bonus-stage teardown, gated on the
same hold timer, finally zeroes the nine-byte wave/phase block and the enemy-record region,
clears the play sub-state index and the latched enemy X, and hands control back to the attract
sub-state (setting it to `7`).

A separate formation-spawn tick services the formation-spawn countdown at `0x8d30` [code]: while
the wave-arrival count is still below 2 it runs a ready-sprite helper (abandoning the tick if the
indicator is already painted), then decrements the countdown, and on expiry runs the spawn scan
over the formation record table. And through all of this the wave-arrival counter at `0x8903`
[seen] is bumped on each enemy arrival — capped at 8 when it would reach 9 — its parity picking a
spawn variant, while the wave-progress counter at `0x8d7d` [seen] ramps `0 → 4` to escalate enemy
fire aggressiveness across the stage.

### Siren gating and the periodic event

Sitting on top of the wave machinery is a gated periodic driver that arms the warning siren and
ticks a shared event countdown. The whole routine is disabled while the periodic mode latch at
`0x8d55` [code] is non-zero. Otherwise it reads the live spawn-phase counter (`0x8902`) as a
mode selector: below 5 it falls straight to the shared tail; at exactly 5 it arms a two-cell pair
— the siren-enable gate at `0x8d68` when the grab flag is clear, otherwise a caller-supplied pair
— and fires the mode-5 sound run when that pair's first cell is free; above 5 it records the value
in the mode latch and fires the higher-mode sound run while the grab flag is clear. The shared
tail then returns immediately if either the wave-event latch (`0x8d21`) or the wave-teardown state
(`0x8f24`) is set; with both clear it ticks the periodic-event timer at `0x8d22` [code] down, and
on expiry reloads it to `0x20`, raises the wave-event latch, and fires the siren-tile run. The
wave-event latch at `0x8d21` [seen] is thus a one-shot "the periodic event fired" flag, held until
the wave is torn down (teardown state 1 clears it). The siren mode is therefore driven directly by
the spawn-phase counter — the same counter that paces the rope draw — which is what ties the
audible warning to how deep into the round the player has pushed.

The object cluster maintains its own small ring: the spawn-ring counter at `0x8d57` [code] is
read and incremented per object-arm by the cluster's state-0 handler, and cleared to zero by the
state-1 animation tick when the shared phase countdown expires and the wave is re-seeded (eight
enemy records set to state 2, six object-state records cleared, the attract sub-state set to 8).

## Rendering, HUD and display lists

Pooyan paints its screen through three memory surfaces on the 0x8000 video page and one deferred-work queue that feeds them. The colour/attribute map lives at 0x8000-0x83ff [code], the tile-code RAM at 0x8400-0x87ff [code], and the sprite display list at 0x8840 [seen]. Because the cabinet runs a rotated monitor, "down one screen row" is a step of 0x20 in memory and "across one cell" is a step of 0x01; nearly every blit in the game is built from those two strides. The queue that drives the tilemap work is the display-command ring on page 0x88, and it is the spine of this section: game logic never repaints the screen directly, it posts a two-byte command and the main loop dispatches it.

### The display-command ring

The ring buffer occupies 0x88c0-0x88ff [code] — thirty-two two-byte slots — with a write cursor at 0x88a0 [code] and a read cursor at 0x88a1 [code]. Both cursors are single low bytes that index the fixed 0x88 page; they walk 0xc0..0xff and wrap back to 0xc0, never leaving the page. A slot is "free" when its first byte has bit 7 set, which is why boot floods the whole ring with 0xff: an all-ones byte is both the empty marker and a slot whose high bit is set. `loc_0092` [code], the power-on boot entry, does exactly this — it writes 0xff across the 0x40-byte ring, then parks both the write and read cursors at the 0xc0 origin so producer and consumer start aligned on the same empty slot.

Producers post a command through `loc_0038` [code], the enqueue helper reached by the rst 0x38 restart vector with the command word in hand. It reads the write cursor, forms the target slot on page 0x88, and checks that slot's free bit. If the slot is occupied (bit 7 clear) the command is silently dropped — a full ring loses work rather than corrupting a pending entry. If the slot is free it stores the command's high byte there, stores the low byte in the very next slot, and advances the write cursor by two, wrapping back up to 0xc0 whenever the advance would fall below it. A command is therefore always a two-byte pair: a high byte that selects what to draw and a low byte that parameterises it. The whole game speaks in these words — the many `DISPLAY_CMD_*` constants [code] such as the wave-spawn pair 0x0625/0x060a, the credit-screen setup words 0x0500/0x0502/0x0604, the hunter-spawn 0x0315, the countdown-expiry 0x0312, and the deferred-object promotion set 0x062b..0x062f are all just such pairs, each posted through this same rst 0x38 path from wherever in the game logic the event fires.

### Draining the ring: the main dispatch loop

The consumer is the loop at 0x020f (`loc_020f` [code]). Once per pass it reads the read cursor at 0x88a1, forms the pointed slot on page 0x88, and fetches that slot's first byte. It then doubles that byte, which lifts bit 7 into the carry and so tests the free bit in one operation. When the slot is free (the ring is caught up to the writer), the loop runs the per-frame worker at 0x0254 and treats that as the frame boundary — the point the real machine ties to the vblank interrupt. When the slot is occupied, the loop instead dispatches the queued command: it masks the doubled command type to an even offset in the 0x1f range, frees the current slot by writing 0xff back into it, reads the command's low byte out of the following slot and frees that too, advances the read cursor by one (wrapping to 0xc0 at the top), and then indexes the sixteen-entry handler table at 0x0242 with the type offset to reach a screen-painting handler, handing it the command's low byte as its parameter. The handlers repaint their specific regions and return to the loop, which immediately looks at the next slot. The consequence worth holding onto: the machine drains the entire backlog of queued commands within a single frame — a ring that filled up during, say, the credit screen empties completely before the next vblank, rather than one command per frame, which would leave stale tiles smeared across the playfield.

### The per-frame worker

`loc_0254` [code] is the ring-idle worker — the thing that runs on the frame boundary when no command is pending. It is gated by the worker control byte at 0x883f [code], which sits one below the sprite list. If that byte's low nibble is nonzero the worker only runs the program-signature integrity check and returns, doing no drawing. Otherwise, while a game is active, it repaints the scrolling tile columns: in one-player mode it blanks four three-cell columns (a cap column plus the shared column, each cleared to the blank tile), and in two-player mode it stamps a capped body column instead. Every column is walked one tilemap row up per cell (stride -0x20). Finally, when the control byte's bit 4 and the game-active low bit are both set, it blanks one more column — either the shared worker column at 0x8740 [code] or the cap column at 0x84e0 [code], chosen by the active-player select. This is the machine's per-frame scroll refresh, keeping the animated background columns clean as the field scrolls.

### The tile-blit family

Underneath the worker and the command handlers is a small library of leaf blitters, all built on the 0x20 row stride and the "advance a pointer and return it for chaining" convention. The simplest, `blit2x2TileBlock` [code], copies four source bytes into a 2x2 video square in the order top-left, top-right (+0x01), bottom-right (+0x21), bottom-left (+0x20), and hands back the pointer advanced to the bottom-left cell so a two-tile animator can step one row up before its next blit. `blitTile3x3Block` [code] stamps a three-wide, three-tall block: three source bytes per row into consecutive cells, then a step to the next screen row (three written plus 0x1d makes a full 0x20), advancing both the destination and — load-bearingly — the source, because a chained caller stamps its next block straight from the advanced source. `blitGlyphBlock4x3` [code] copies a four-row, three-column glyph, but advances only the destination's low byte per cell so each row stays inside its tilemap page, stepping +0x1d between rows for the same net 0x20; it returns both pointers because a caller memsets through the advanced destination immediately after.

The column primitives serve the scroll worker and the board-clear paths. `blankTileColumn` [code] writes the blank tile 0x10 into three cells one stride apart, erasing a scrolled column and returning the advanced pointer for chaining into the next. `paintColumnBodyTiles` [code] stamps the lower two cells of a three-tile column — mid tile 0x25 then base tile 0x20 — and `loc_02a8` [code] wraps it by first writing the cap tile 0x01 at the start cell, completing the cap-mid-base column. Two more leaves round out the family: `copyBiasedTileString` [code] copies a source string into a tile buffer, adding a fixed 0x08 tile bias to every byte (reindexing character codes into display-tile codes) until it hits the 0xa0 terminator; and `fillAttributeColumns` [code] floods the colour map — walking 31 columns from the attribute-map base at 0x8040 [seen], stamping one source byte down all 30 rows of each column at the 0x20 stride, one source byte consumed per column.

### The row-by-row tile fill

Blanking the whole tilemap is spread across many frames so it never stalls the machine. Boot arms it: after flooding the colour map with the 0x10 attribute value, `loc_0092` calls `seedTileFillCursor` [code], which stores the tile-map base into the 16-bit fill cursor at 0x880b [seen] and seeds the row counter at 0x8809 [seen] to 0x20 — thirty-two rows to clear. `loc_01ea` [code] does the adjacent boot clear: it fills the top of both sprite banks with an incoming byte and blanks the lower tile region to an erase tile. Thereafter the fill is walked one row per pass by `loc_02c9` [code] and `loc_02ce` [code]: each blanks a run of cells from the fill cursor, advances the cursor by exactly one full row (the visible run plus the short row remainder), stores it back, decrements the row counter, and reports through the zero flag whether the counter has drained — the driver keeps calling until it does. The cursor's low byte therefore steps 0x00, 0x20, 0x40, … 0xe0, 0x00 across the fill, matching the observed cadence [seen].

### The sprite display list

The sprite list at 0x8840 [seen] is twenty-four four-byte entries handed to the sprite hardware each frame; its first byte is the leading sprite's Y coordinate, observed descending live in play [seen]. Within each entry, positions 0 and 2 are the two coordinate bytes and positions 1 and 3 carry the tile/attribute bytes, with the pair of flip bits living in position 1. Two sub-regions of the list are swept by other systems: the stride-4 actor-record slots at 0x8848 [seen] and the target/collision slots at 0x887c [seen], the latter scanned as proximity targets.

The list is rebuilt from the object-record banks each frame by `loc_02ef` [code]. It copies four record groups in turn: the two lead actors and the two enemy-target records through `copyObjectRecordsToDisplayList` [code], which lifts record bytes +0x06, +0x10, +0x04, +0x0f into four successive slots per record and advances only the list's low byte so writes wrap within its 256-byte page; the eighteen moving-object records through `loc_0343` [code], which is the same shape but applies coordinate math — each of the two coordinate bytes is derived from a 16-bit sub-pixel pair reduced to a screen pixel by shifting right five and biasing by -8; and finally the two arrow/launch records through the plain copy again. `loc_02ef` then nudges the arrow group's two sprite-Y bytes down one pixel each and hands the second to `loc_0320` [code], which decrements a per-frame counter and, when the screen-orientation flag reads flipped (zero), mirrors the entire list.

That mirror is `mirrorSpriteListVertically` [code] (the same transform as `loc_0378` [code]): walking the stride-4 list in place, it negates and offsets each entry's two coordinate bytes (-x - 0x10) and toggles the two flip bits in the attribute byte while preserving its low nibble, leaving the fourth byte untouched — the vertical flip for a flipped cabinet. Separately, the player is drawn as three vertically stacked sprites: `deriveStackedSpriteYs` [code] fans the player's base Y out into the Y fields of three actor slots (stride 0x18) — the bottom slot gets the base Y, the middle Y-0x10, and the top Y-0x10+0x0a — so the object-record build then renders the stack from those slots.

### The HUD: gauge, scores, and panels

The phase gauge is a five-cell vertical bar drawn by `loc_03c2` [code] from the phase counter at 0x8908 [seen]. From the base tile at 0x863f [seen] it climbs one row per cell (stride -0x20): a zero count draws nothing, otherwise it paints min(count-1, 5) filled tiles (0xb0) and blanks the remaining cells up to five with the blank tile (0x10). The gauge cell holds 0xb0 filled or 0x10 blank as the phase drains [seen].

The live score and its companion fields are repainted by `loc_10c2` [code], which walks a counter toward a new value one step at a time, stores it, and paints three BCD fields. It leans on `drawStackedBcdDigits` [code], the two-tile digit painter: it draws a packed-BCD byte as tens at the cursor and units one tilemap row above (toward lower addresses), suppressing a leading zero by drawing the blank tile 0x10 instead of a "0". The binary-to-packed-BCD conversion feeding it comes from `binToPackedBcd`, and the third field folds a hundreds digit out when nonzero. Which score buffer is current is decided by `loc_04f2` [code]: it reads bit 0 of the active-player mode byte and points at the player-1 buffer 0x88a2 [seen] or the player-2 buffer 0x88a5 [seen], preserving the caller's registers across the probe. The two-cell stage-countdown number reaches its units tile at 0x8743 [seen], and the wave-arrival count draws its high digit at 0x863b [code] with the low digit a row below.

The attract screen's static HUD is built by `loc_03e9` [code]. It first draws eleven table-selected character fields through `loc_05b2` [code] — a field renderer that indexes a ROM pointer table at 0x7a0d [code] by the selector's low seven bits (doubled), then walks each record's inline string bottom-up (one row up per character, stride -0x20), writing each character as a digit tile (char minus '0') or, when the selector's bit 7 is set, as the blank tile; a '.' ends a record and a '?' ends the whole field. `loc_03e9` then renders the ten-entry high-score table from 0x8a00 [code] into the video column at 0x85c7 [code] as stacked BCD digit pairs — each source byte split by `splitBcdByte` [code] into its low (units) nibble at the cursor and its high (tens) nibble a row apart, with the top digit's leading zero suppressed and the column re-based two cells right per row. Finally it repaints two panels: the packed-BCD digit panel via `loc_0439` [code], which draws ten rows of two digit pairs from the source table at 0x89c0 [code] into the panel base at 0x8467 [code] with a fixed separator tile 0x51 wedged between the pairs; and the status panel via `renderPanelFromTable` [code], which walks ten rows of three cells from the tile-source table at 0x8e00 [code] into the panel destination at 0x8567 [seen], painting each nonzero source byte and substituting the blank tile 0x40 for a zero — the first two cells of each row climbing one row and the third re-basing forward to the next column.

## Sound

Pooyan's main CPU never plays a note directly. Instead it hands one-byte *sound commands* to a
second, dedicated audio processor, and the two are decoupled by a small ring buffer so that the
game logic can fire off a sound whenever it wants without waiting on the audio side. That ring is
a genuine sound-command FIFO — confirmed under emulation, where every byte pushed in comes back
out, in order, at the audio port and nowhere else [seen]. (It shares its memory page with the
high-score table, which sits in the low part of the same page; that is a memory-map coincidence,
not a shared purpose.)

### The ring

The buffer lives on page 0x8a00. Its usable slots run from 0x8a43 through 0x8a5e — a little under
thirty entries — and two one-byte cursors sit just below them: `SOUND_RING_WRITE_PTR` at 0x8a40
holds the index of the next slot to fill [code], and `SOUND_RING_READ_PTR` at 0x8a41 holds the
index of the next slot to consume [code]. Both cursors carry only the low byte of the address
(0x43..0x5e); the page base 0x8a is supplied at access time. When a cursor reaches the last slot,
0x5e, it wraps back to 0x43 rather than incrementing — that wrap is what makes the linear span of
slots behave as a circular queue. An empty slot is marked with 0xff, which boot-time
initialization writes across the whole span, and both cursors start seeded at 0x43.

### Filling the ring: two writers, one buffer

There are two routines that push a byte into this ring, and both target the exact same slots with
the same cursor and the same wrap — they differ only in whether they respect the game's play state.

`enqueueSoundCommandRing` is the unconditional writer [seen]. It reads the write cursor, stores the
command byte into that slot (page base plus cursor), and then advances the cursor, wrapping 0x5e
back to 0x43. It always writes — there is no gate — so a byte handed to it lands in the queue
regardless of what the game is doing.

`appendSoundCommandGated` is the play-gated writer [code]. Before doing anything else it stashes the
incoming byte in a holding cell, `SOUND_RING_PENDING_BYTE` at 0x8d20 [code]. It then checks two
flags: `GAME_ACTIVE_FLAG` (0x8806) and `PLAY_MODE_LATCH` (0x8f50). If *both* are clear the append is
abandoned — the routine returns immediately, leaving the accumulator at zero and never touching the
ring, so the sound is silently dropped when no game is in play. (Note that the pending byte at 0x8d20
was already written before the gate was tested, so it holds the last byte that was *offered*, whether
or not it was actually queued.) When at least one gate is open, it pulls the byte back out of the
pending cell, writes it into the slot the cursor names, advances and wraps the cursor exactly as the
unconditional writer does, and hands the *advanced cursor* back in the accumulator — a return value
its callers rely on, since several of them chain appends and read that cursor between steps.

### Draining the ring to the audio CPU

`drainSoundCommandRing` is the sole consumer [seen], and it moves one entry per call. It looks at the
head slot named by the read cursor. If that slot holds the 0xff empty marker there is nothing to do
and it returns. Otherwise it decides whether the byte should actually be heard: it dispatches the
byte when demo sounds are enabled (bit 0 of `DEMO_SOUNDS_DSW` at 0x8821 [code]) *or* when a game is
active (`GAME_ACTIVE_FLAG`); only when both of those are clear does it stay silent. Crucially, the
slot is freed and the read cursor advanced (with the same 0x5e→0x43 wrap) *regardless* of that
decision — so in silent attract mode the queued bytes are consumed and thrown away rather than piling
up. When the byte is to be heard, it is handed to `sendSoundCommand`.

`sendSoundCommand` is the actual hardware handoff [code]. It latches the command byte at the sound
port, `SOUND_COMMAND_LATCH` at 0xa100 [code], then pulses the audio-CPU interrupt line by driving
`AUDIO_IRQ_LATCH` at 0xa181 [code] high and then low. That rising edge is what wakes the audio
processor to read the latched byte; the width of the pulse is a pure timing delay with no state, so
it carries no game meaning. Under emulation the enqueued bytes were observed arriving at 0xa100 in
FIFO order, matching the enqueue sequence exactly [seen].

There is one path that skips the ring entirely: `emitPresetSound` calls `sendSoundCommand` directly
with a fixed command code (0x0b) [code], latching it straight to the audio CPU without ever queuing.
It is the one immediate, ungated way to make a sound.

### The command emitters

On top of the two writers sits a large family of thin emitters, each of which names one or a few
fixed command bytes and pushes them into the ring. They split along the same gated/ungated line as
the two writers they call, all [code].

The **unconditional selectors** go through `enqueueSoundCommandRing`, so their bytes are queued no
matter the play state: `queueSoundCommand00` (byte 0x00, the silence command), `queueSoundCommand02`,
`queueSoundCommand05`, and `queueSoundCommand09` each push a single byte, while
`queueSoundCommands27And15`, `queueSoundCommands19And15`, `queueSoundCommands82And03`, and
`queueSoundCommands82And95` push two bytes in order.

The **play-gated emitters** go through `appendSoundCommandGated`, so their bytes are dropped when no
game is active: the single-byte stubs `queueSoundCommand01`, `06`, `07`, `08`, `0A`, `0B`, `0C`,
`0D`, `0E`, `0F`, `11`, `12`, `13`, and `14`, plus the multi-byte `queueSoundCommands95And03And11`
and `queueSoundCommands95And10`. `queueSoundCommand04IfNotBusy` is the same idea with an extra
interlock: it refuses to append its 0x04 byte while either `WAVE_TEARDOWN_STATE` (0x8f24) or
`GRAB_ACTIVE_FLAG` (0x8d32) is set, and only appends once both are clear.

One emitter deliberately **mixes** the two writers: `queueSoundCommands96And97And18And15` appends
0x96 and 0x97 through the gated path — so those two are dropped outside of play — and then pushes
0x18 and 0x15 through the unconditional path, so that pair always lands.

### Multi-byte "run" commands

Several sounds are emitted as a short fixed *run* rather than a single byte. `appendSoundCommandRun`
is the shared builder [code]: it appends a caller-supplied lead byte followed by the three fixed
bytes 0x15, 0x16, 0x17, all through the gated appender. The straightforward run emitters just supply
their lead byte and delegate: `queueSoundRun1D` (lead 0x1d), `queueSoundRun26` (lead 0x26), and
`queueSound82ThenRun1C`, which first appends a fixed 0x82 and then builds a run led by 0x1c.
`queueSoundRun28` spells the same shape out by hand, appending 0x28, 0x15, 0x16, 0x17 as four
separate gated appends.

Two run emitters derive their lead byte from the current round. `queueRoundSoundCommandRun` takes
bits 1–2 of `ROUND_COUNTER` (that is, `(round >> 1) & 3`), adds a base of 0x1e, and builds a run led
by the resulting one-of-four byte (0x1e..0x21). `queueRoundVariantSoundRun` uses the same two-bit
selector but a base of 0x22, yielding a run led by one of 0x22..0x25. In both, the round counter
picks which variant of the sound plays.

`queueSirenSoundRun` is the warning-siren emitter, gated on `SIREN_ENABLE_GATE` at 0x8d68 [seen] —
the one-shot latch that the periodic-event timer sets when it expires and that wave-teardown clears.
While that gate is nonzero the siren is suppressed and the routine returns. When it is clear, the
routine selects a lead tile of 0x1a offset by the low bit of the round counter (so 0x1a or 0x1b),
appends it through the gated appender, and then hands off to `appendSoundCommandRun` to append the
completing 0x15/0x16/0x17 run. Be aware of a quirk in this one path: because the siren invokes the
run builder *without* supplying a fresh lead byte, the builder's first byte comes from the
accumulator left behind by the preceding append — which is the advanced ring cursor, not a chosen
command code. The siren therefore lays down its selected lead tile, then that stray cursor value,
then the fixed three-byte tail.

### What the bytes mean

Every command in this section is an opaque one-byte code destined for the audio CPU; the ring and
its plumbing are what is confirmed as a sound FIFO [seen]. Which specific voice, effect, or jingle
each individual byte value selects on the audio side is a separate grounding that has not yet been
carried out — those mappings remain [code]/[guess] and are not asserted here.

## Anti-tamper

Pooyan defends its own image at runtime. Scattered through the program is a fan of small,
independent checksum guards that re-read the ROM (and, in a couple of cases, the live tilemap)
and compare a folded sum against a hard-coded sentinel that only an unaltered image produces.
None of these guards trusts another; each carries its own block base, its own fold, its own
sentinel, and its own failure arm, so a bootleg that patches one region still trips a different
guard somewhere else. In the shipped image every one of these checks passes, so the whole
subsystem is normally invisible — a fact worth stating plainly, because the tamper flags and
strike counters it writes are all static zero in both captured golden runs (they are [code]-tagged
precisely because the intact ROM never bumps them).

The guards split cleanly into two response families. The **soft** family increments a *strike
tally* — a work-RAM byte other code later consults to freeze or divert gameplay; a soft guard
never crashes, it just leaves a mark. The **hard** family, on failure, branches to an address
that is actually *data* (a table, a text block, the middle of another routine) — code the CPU was
never meant to execute. With a valid ROM those hard arms are dead: the sentinel always matches and
the branch is never taken. In the current code those unreachable arms are guarded so that, if a
corrupted image ever forced one, it stops rather than silently running data as instructions. That
"dead failure arm aimed at data" is a recurring shape here, so watch for it: several of these
routines look like they can jump into the tile tables or the attract text, but on the shipped
image they cannot.

### The boot self-test

The first and broadest check runs at power-on, inside the boot entry `loc_0092` [code]. Before it
builds any machine state it walks all eight 4K program-memory banks, keeping a 24-bit rolling sum
per bank as three bytes (low, mid, high), and compares each bank's three-byte result against its
entry in the 24-byte checksum table `ROM_SELFTEST_CHECKSUM_TABLE` at 0x0079 [code]. A pass tally
is seeded with the bank count (8) and bumped once for every bank that matches, so a wholly-intact
image finishes at twice the bank count — 0x10. That tally lives at `ROM_SELFTEST_TALLY` (0x8fff)
[code], deliberately parked one word above the boot stack so the per-frame interrupt's register
save can never clobber it. The gate is downstream: the attract-setup handler `loc_072d` [code]
refuses to finish its setup unless the tally reads exactly 0x10, so a single mismatched bank quietly
strands the machine in the pre-game main loop and it never reaches play.

### The soft guards and their strike tallies

Once the game is live a rotation of soft guards keeps re-summing pieces of the image. Most of them
are gated on the free-running frame counter `FRAME_COUNTER` at 0x8a5f [seen] — a byte the vblank
interrupt decrements every frame — so an individual guard only actually folds its block on the
frames where that counter (or its low bits) reads zero, spreading the work out and keeping any one
frame cheap.

`verifyRomChecksum` [code] is the state-10 image check. It sums sixteen read-only bytes descending
from `ROM_CHECKSUM_TOP` (0x7780) [code] into a single byte and then reads that byte's *shape*
rather than a fixed value: a healthy image leaves bit 0 clear, bit 5 set and bit 7 set. Any other
shape means the block was altered, and the guard bumps the state-10 strike counter
`TAMPER_STRIKES_STATE10` at 0x8a39 [code].

`verifyRomSignature` [code] compares a sixteen-byte reference table `SIGNATURE_REFERENCE_TABLE`
(0x20aa) [seen] against every eighth byte of a sampled code region starting at
`SIGNATURE_SAMPLE_BASE` (0x066d) [seen] — reference advances by one, the sample pointer by eight,
sixteen times. On the first byte that disagrees it raises `SIGNATURE_MISMATCH_FLAG` at 0x8ef0
[code] and stops; a clean pass leaves the flag alone.

The periodic guard at 0x7e6d [code] is doubly gated — it runs only when player-one's life count
`PLAYER1_LIVES` at 0x8988 [seen] has reached at least four (a condition only the four- or five-life
DIP setting produces) and the frame counter is zero. It then sums ROM *downward* from 0x64be until
it meets a 0x34 sentinel byte, accumulating the running sum in one register and a separate carry
count in another. If the combined `(carry + sum) & 0xb0` is non-zero the image is bad and it bumps
the ROM strike counter `TAMPER_STRIKES_ROM` at 0x89ef [code].

The slot-sweep guard `loc_52f6` [code] rides on the enemy-spawn housekeeping: it runs only while
the script-advance guard `SCRIPT_ADVANCE_GUARD` (0x8d6d) [seen] is set and its own one-shot latch
is still clear, and only once at least four of the six enemy slots are free. Having latched that
free count it folds a running sum over a fixed twenty-three-byte code block descending from its
base and checks the sum's low byte against 0x15 and high byte against 0x09. A miss bumps
`TAMPER_STRIKES_SLOTSWEEP` at 0x89e8 [code].

The object state-0 handler `loc_3be3` [code] carries its check inside the gated lane reset it runs
on an enemy's arrival: while the screen is upright and the stage countdown is still low it sums a
fixed code window backward from 0x01d5, and unless the running byte sum equals 0x55 it bumps the
state-0 strike counter `TAMPER_STRIKES_STATE0` at 0x89ed [code].

Two more soft guards feed a *shared* freeze flag. The play-state handler `loc_1b43` [code], amid
its normal tilemap and display work, folds a thirty-four-byte block starting at 0x5593 with a
per-byte recipe — mask with 0x37, rotate right, add-with-carry into an accumulator — and if the
final accumulator is not 0x7c it increments the freeze flag `TAMPER_FREEZE_FLAG` at 0x881e [code].
`flagTamperOnRound5ChecksumMiss` [code] arms only when the round counter `ROUND_COUNTER` (0x8907)
[seen] equals five: it sums six program bytes (base built byte-swapped as high 0x15, low 0x53,
i.e. 0x1553), counting carries separately, and if `(low sum + carry count + 0x7f)` fails to wrap to
zero it bumps the same freeze flag. And the actor-table spawner tail `loc_5594` [code], at the first
free actor block it finds, sums an eight-byte guard region at 0x0bad against a local sixteen-byte
signature table at 0x55b5; if any pair sums non-zero it bumps the freeze flag before seeding the
block.

The remaining soft guards each own a private flag. The actor-state handler `loc_3865` [code] — only
once the actor it drives has descended past screen row 0x8b70 and the frame counter is zero — sums
ROM backward from 0x4282 to a 0x1a terminator and, if `(carry + sum) & 0x9e` is non-zero, bumps the
signature-mismatch flag 0x8ef0. The per-object frame-advance `loc_4103` [code], again gated on the
frame counter being zero, accumulates the *low nibbles* of fifty-six bytes from 0x557f into a
low-byte/carry-count pair; the sentinel is a low byte of 0x67 with exactly one carry, and any other
result bumps the signature-strike counter `TAMPER_STRIKES_SIG` at 0x8a38 [code]. The terminator
match-scan `loc_64be` [code] walks one region descending and a table ascending until a byte differs
or a table entry counts down to zero; a mismatch bumps the terminator strike counter
`TAMPER_STRIKES_TERMINATOR` at 0x8df9 [code]. `verifyTableChecksum` [code] sums a caller-supplied
table into a sixteen-bit accumulator and, unless the total is exactly high 0x1d / low 0xc1, raises
the ROM-check flag `TAMPER_ROM_CHECK_FLAG` at 0x882b [code].

Finally the high-score table gets its own integrity check, `flagHighScoreTableCorruptOnChecksumMiss`
[code], which runs against the four-byte block at `HISCORE_CHECKSUM_BASE` (0x778a) [seen]. The block's
header byte must be the 0xc8 marker; then the four bytes are summed (each byte-carry counted
separately) and the summed total minus that carry count must equal 0x59. A bad header or a wrong
total raises the high-score-corrupt flag `HISCORE_TABLE_CORRUPT_FLAG` at 0x8df8 [code].

### The strike paths — how a mark changes the game

The strike tallies and flags are not read where they are written; downstream gameplay code consults
them to fail the machine gracefully. The freeze flag 0x881e is the most consequential. The lead-actor
per-frame driver `loc_241e` [code] runs its three sub-passes and then, if the freeze flag is set,
simply skips dispatching the lead actor's state — actor updates stop cold. The lead-actor state-0
handler `loc_2442` [code] idles entirely while *either* the slot-sweep or ROM strike counter
(0x89e8 or 0x89ef) is non-zero, so a strike there stalls the actor arena. The object-update gate
`loc_20d4` [code], on frames where the play-mode latch is busy, hands the frame straight to the
lead-actor driver when the terminator strike counter (0x8df9) and the high-score-corrupt flag
(0x8df8) are *both* set — a corrupted image is quietly diverted away from the normal update chain.
And the phase-1 spawner gate `loc_6e75` [code] runs its launcher only when both the signature-mismatch
flag (0x8ef0) and the freeze flag are clear; with either set it would take a skip-spawn branch that
points into data, so on a tampered image the spawner effectively falls off the road. The net effect
of the soft family is a game that, once any guard trips, gradually seizes up — spawns stop, actors
freeze, HUD setup is skipped — rather than displaying an obvious error.

### The hard guards and their dead arms into data

The hard family verifies structure rather than a rolling sum, and its failure branches target data
addresses. The playfield tile-region checksum exists in two closely related forms, `loc_68ac` [code]
and `loc_3278` [code] (the first two bytes of 0x3278 also double as the compare value another guard
reads). Each, once per arm via a one-shot latch, sixteen-bit-sums the tile columns of the playfield
from 0x8402 upward and matches the two sum bytes against the four-entry table at 0x68eb: a low-byte
miss aims at 0x76d4 and a high-byte miss at 0x3829, both of which are data, not routines. With the
correct tilemap the sum always matches and neither arm is reachable.

The code-region self-check `loc_79e9` [code] sums the bytes of the routine at 0x68ac forward until it
reads that routine's terminating byte (0xc9), then compares the sixteen-bit result against the stored
word at 0x7a0b. A low-byte mismatch aims at 0x07d0 — a dead data trap — while a high-byte mismatch
diverts instead to `loc_1a85` [code], which is an ordinary routine that redraws the phase gauge and
resets the play sub-state; so even the "reachable" arm of this guard is a soft cosmetic reset rather
than a crash. The shared integrity-and-timer handler `loc_7960` [code] carries two checks around its
timer-render work: an entry check that folds a fixed code block into a four-byte result and matches it
against the guard bytes trailing the block (mismatch is a dead trap), and a flag-gated tail check —
after rendering it scans a seven-byte flag block at `INTEGRITY_FLAG_SCAN_BASE` (0x89e7) [code], and if
any flag is set it runs a second summed check whose low-byte miss is a dead trap and whose high-byte
miss again diverts to the benign `loc_1a85` gauge redraw.

Two hard guards respond to a mismatch by *wiping work RAM* — the most destructive answer in the
subsystem. The hunter-formation launch `loc_30f1` [code], after seeding its formation, byte-compares
the body of the routine at 0x3278 (skipping a two-byte pointer header) against a reference copy at
0x68ac; on the first differing byte it clears 0x8800 and block-fills the whole work-RAM page forward
from there, bricking the run. The level-intro phase-4 handler `loc_6f9d` [code] does the same in a
different place: after latching and scaling the target-group count it compares a 0x44-byte program
block at `PHASE4_TAMPER_ORIG` (0x6ac5) [code] against its data copy at `PHASE4_TAMPER_COPY` (0x6fed)
[code]; a full match queues a sound command and a display command, and any mismatch wipes the work-RAM
page from its base. The self-test/display state-1 handler `loc_7517` [code] column-sums two fourteen-
tile video-RAM strips — the colour strip at `HUD_INTEGRITY_STRIP_A` (0x82bc) [code] and the tile strip
at `HUD_INTEGRITY_STRIP_B` (0x86bc) [code] — and only advances to state 2 when the combined sum reads
low 0x4f / high 0x01; a low or high miss aims at 0x43e1 or 0x462c respectively, both data.

The attract loop guards itself differently again. Its sub-state-1 handler `loc_08e9` [code], once its
frame timer drains, sums the ROM block 0x0859..0x0878 and requires 0x63, then (after flooding the
attribute map) sums 0x0831..0x0839 and requires 0xaa. Rather than branching to data, a failed sum
re-enters the check, so a tampered attract image simply spins in place — the attract screen hangs
instead of advancing. Only when both sums are right does it queue its display commands and set the
next sub-state.

## Open questions

These are the readings the code fixes but MAME has not yet confirmed, plus the paths no capture has exercised. Each is a work item for a following grounding pass.

- **Sound byte-to-effect map.** The page-0x8a sound-command FIFO is [seen] as a FIFO that reaches the audio CPU, but which specific sound each command byte (0x00..0x28, and the high-bit bytes 0x82/0x95/0x96/0x97) selects is [code]/[guess] — it needs an audio-side grounding pass that watches the audio CPU, not just the latch.
- **Foreground scroll worker 0x0254.** Whether it does load-bearing drawing during live play or is an attract/idle task is unsettled; its gating control byte 0x883f is [code]-only and its scroll-column duties overlap the vblank NMI's own column rebuild (0x0714).
- **Coin path beyond slot 1.** Slot 2 bumps a pulse counter at 0x8826 but only slot 1's counter (0x8824) has a wired coin-meter strobe, so whether 0x8826 drives a second physical meter is unconfirmed; and the third acceptor (input bit 2, flat +1 credit, no coinage or meter) is unlabelled as service-credit vs a third coin slot.
- **Phase-gauge cell 0x8908 dual use.** It is [seen] draining 3→0 as a phase gauge, yet another routine bumps the same cell saturating on a bonus-award threshold no golden reached; the two uses need a scoring-active capture to reconcile.
- **The six-slot object-state array 0x8ba0.** Its arm/advance/draw/integrity four-way machine and the per-pool overloading of the shared 0x18-byte record fields are [code]-only — no golden exercised a full cycle.
- **Formation / band-build / intro-launch.** The formation-spawn timer (0x8d30) and the band-build arm latch (0x8f63) are static-0 in every golden, so those paths — including the rope-extend tamper-strike branch and the formation phase-handler table at 0x30eb — are [code]-only, unconfirmed by MAME.
- **Display-command ring drain.** The ring cells are [code], never watched transitioning in a golden, and the display-command handler table's per-type mapping is not enumerated, so which screen region each command word repaints is inferred from the enqueue sites rather than confirmed by watching the ring drain.
