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

Pooyan's Z80 sees a small, sharply partitioned address space, and almost every moving
part of the game is a byte (or a short structure) somewhere inside it. The first 32 KB,
0x0000-0x7FFF, is program ROM. Everything above it is either RAM the program owns or a
hardware register masquerading as memory. Understanding the machine is largely a matter of
knowing which region a given cell lives in, because the region decides what writing there
*does*: paint a tile, move a sprite, hold game state, or poke a device.

### Two tile planes, two sprite banks

The visible playfield is a 32x32 grid of 8x8 cells described by two parallel planes, each
one KB. The colour plane at 0x8000-0x83FF holds one **attribute** byte per cell — its low
nibble picks a sixteen-colour (16-pen) palette bank, bit 6 flips the cell horizontally, bit 7 flips it
vertically. The code plane at 0x8400-0x87FF holds one **tile code** byte per cell. The two
are read together, cell for cell: the renderer walks all 32 columns of each row, pulls the
attribute from the colour plane and the code from the code plane at the same cell index, and
stamps the tile opaquely (colour pen 0 included, so the tilemap is a solid background). There
is no scroll offset and no second tile layer; the whole background is this one opaque pass.
When the software orientation flag is set for a cocktail flip, both the cell lookup and the
per-tile flip bits invert, which is exactly a plain 180° mirror of the native image.

Over that background come the sprites, and here the memory model has a wrinkle worth stating
plainly. The sprite region 0x9000-0x9FFF is decoded down to two 256-byte banks by a single
address bit (0x0400): bank 0 answers at 0x9000-0x90FF, bank 1 at 0x9400-0x94FF, and the other
address lines in between are don't-care mirror bits (mask 0x0B00), not offsets. The two banks
carry *halves* of the same sprite record at the same offset: bank 0 holds the sprite's X and
its tile code, bank 1 holds the colour-plus-flip control byte and (240 minus) its Y. Only the
even offsets 0x10 through 0x3E are live records, and they are scanned in ascending order so
that when two sprites overlap the higher offset wins. The board never enables or disables
video — there is no video-enable bit anywhere — so every row is always drawn.

Everything the outside world observes about the machine is the concatenation of these regions:
the colour plane, the code plane, the 2 KB of work RAM, and the two sprite banks, laid end to
end as a 4608-byte state image. That image is the diff surface against real hardware, which is
why the code keeps game state at its true address rather than shadowing it elsewhere.

### The hardware I/O window

From 0xA000 up, "memory" is really a bank of devices, and the cardinal rule is that a read and
a write at one address are two different devices. Reading 0xA000 returns dip-switch bank 1;
writing the same address kicks the watchdog. The four input-style reads are dip bank 1 at
0xA000, the three player/coin ports IN0/IN1/IN2 at 0xA080/0xA0A0/0xA0C0, and dip bank 0 at
0xA0E0, all decoded through don't-care masks. Inputs are active-low: an idle port reads all
ones, and a pressed control pulls its bit to zero, so the program complements each port the
instant it samples it.

The writes are just as device-specific. 0xA100 is the latch that hands a command byte to the
audio CPU. 0xA180-0xA187 is an eight-bit control latch wired **one address per bit** — the bit
written is the low three bits of the address, and the data is always bit 0 of the value. Those
eight lines are the machine's control surface: bit 0 is the vblank-NMI enable, bit 1 strobes
the audio interrupt, bit 2 mutes audio, bits 3 and 4 clock the two coin counters, bit 5 is an
unused payout line, and bit 7 is the flip-screen control — inverted, so a stored zero means a
flipped screen. Any access that falls outside this whole map is a hard error, not a quiet zero;
the address space throws, so a stray read or write surfaces as a fault instead of silently
corrupting the state diff.

### The shape of work RAM (0x8800-0x8FFF)

The 2 KB of work RAM is the game's entire mutable brain, and it is organised into a handful of
distinct territories.

**Boot-decoded configuration.** The dip switches are read exactly once, at power-up, and their
fields are complemented and fanned out into dedicated cells that the rest of the game reads
forever after — the ports themselves are never consulted again during play. The bonus/extra-life
schedule selector lands in `BONUS_AWARD_DSW` (0x8800) [code], the three-bit difficulty in
`DIFFICULTY_DSW` (0x8820) [code], the cabinet (upright/cocktail) flag in `CABINET_MODE_FLAG`
(0x880F) [code], and the two coin-slot coinage nibbles in `COINAGE_CONFIG` (0x882C) [seen] and
`COINAGE_CONFIG_SLOT2` (0x882F) [code], where a value of 0x0F means free play.

**Credit and player accounting.** `CREDIT_COUNT` (0x8802) [seen] is the BCD credit counter,
bumped by a coin and consumed by a start press. `ACTIVE_PLAYER` (0x880D) [seen] and
`TWO_PLAYER_FLAG` (0x880E) [seen] together select which player's banks are live. Each player's
running score is a three-byte BCD buffer — `P1_SCORE_BCD` (0x88A2) [seen] and `P2_SCORE_BCD`
(0x88A5) [seen] — and the all-time table is the sorted ten-entry `HIGH_SCORE_TABLE` (0x8A00)
[code], whose top score is compared most-significant-byte-first starting at `HIGH_SCORE_BCD_HI`
(0x88AA) [seen].

**The banked live page.** The per-player gameplay state is not two separate copies but one live
working page beginning at 0x8900, which is swapped in and out of two save banks —
`PLAYER0_STATE_BANK` (0x8940) [seen] and `PLAYER1_STATE_BANK` (0x8980) [seen] — each a 0x3F-byte
block. On a player change the live page is copied out to the departing player's bank and the
arriving player's bank is copied in, so the same working addresses always describe "the player
whose turn it is." Lives are held per player as `PLAYER0_LIVES` (0x8948) [seen] and
`PLAYER1_LIVES` (0x8988) [seen]. The live page itself carries the round-and-wave progression —
`SPEED_INDEX` (0x8900) [seen], `STAGE_COUNTDOWN` (0x8901) [seen], `WAVE_ARRIVAL_COUNTER`
(0x8903) [seen], `ROUND_IN_PROGRESS` (0x8904) [seen], `ROUND_COUNTER` (0x8907) [seen], and the
five-cell HUD `GAUGE_PHASE_COUNTER` (0x8908) [seen] among them — which is precisely why that
block is the thing that has to travel with the player.

**Machine-state selectors.** The whole program is a nest of tiny state machines, each one a
single integer cell that indexes a table of handler addresses. At the top sits `MAIN_GAME_STATE`
(0x8805) [seen], which picks between attract, intro, and play. Under it, play is driven by
`PLAY_STATE_INDEX` (0x880A) [seen] and attract by `ATTRACT_SUBSTATE` (0x8E51) [seen]; the
start-of-level sequence steps `INTRO_PHASE_INDEX` (0x8F51) [code], the power-on self-test walks
`SELFTEST_DISPATCH_STATE` (0x8921) [code], and the foreground loop's own housekeeping phase is
`MAINLOOP_SUBSTATE_SELECTOR` (0x8F5C) [code]. `GAME_ACTIVE_FLAG` (0x8806) [seen] gates the
gameplay handlers (they return early when a game is not in progress), and `BOARD_CLEAR_FLAG`
(0x89E5) [code] diverts the per-frame update away from normal play and into the board-clear /
level-intro path when a board has been finished.

**Timing and input sampling.** Nothing in the game polls hardware for its clock; the vblank
interrupt *is* the clock, and cadence is measured in cells. `FRAME_COUNTER` (0x8A5F) [seen]
free-runs downward one step per frame, its low bits phasing animation and its zero-crossings
gating periodic checks; alongside it a swarm of per-phase countdown timers pace transitions —
`PHASE_TIMER` (0x8808) [seen] and the tile-fill pair `FILL_ROW_COUNTER` (0x8809) [seen] /
`TILE_FILL_PTR` (0x880B) [seen] are typical. Each interrupt also snapshots the three inverted
input ports into an edge-detect ring headed at `INPUT_PORT0` (0x8810) [seen], keeping a short
history so the code can distinguish a fresh press from a held one.

**The actor arena and its record pools.** Live moving objects are stride-0x18 records. The main
arena is `ACTOR_TABLE` (0x8A80) [seen], zeroed at board init, whose slot 0 is the player/lead
actor: `LEAD_ACTOR_STATE` (0x8A82) [seen] drives its dispatch, `PLAYER_Y` (0x8A84) [seen] is the
vertical position the enemies aim at, and `PLAYER_AIM_FLAGS` (0x8A87) [code] folds the joystick
sample together with the on-target indicator bits. Higher in that same arena, `ENEMY_ACTOR_TABLE`
(0x8AE0) [seen] is not a separate pool but a sub-array at +0x60 — slot 4 onward of the 0x8A80
arena — holding the enemy records the spawn sweep walks. The genuinely separate pools lie further
up: `SPRITE_OBJECT_TABLE` (0x8B70) [seen], `OBJECT_STATE_RECORD_BASE` (0x8BA0) [code],
`FORMATION_TABLE` (0x8C30) [seen], `SPAWN_OBJECT_TABLE` (0x8C48) [seen], and the parity-paired
targets `ENEMY_TARGET_REC0` (0x8C90) / `ENEMY_TARGET_REC1` (0x8CA8) [seen]. `PROJECTILE_TABLE`
(0x8BE8) [seen] is likewise not independent — it is slot 3 of the `OBJECT_STATE_RECORD_BASE` array
(three 0x18 strides up from 0x8BA0), the object-state record span running straight into it. Each
per-frame sweep walks its pool by the fixed stride and dispatches every record on a per-record
state byte, so an "empty" slot is just a record whose active byte is clear.

**The sprite staging list.** Sprites are not written directly by the game logic. Records are
composed into a work-RAM display list at `SPRITE_DISPLAY_LIST` (0x8840) [seen] — a 24-entry,
four-bytes-each table rebuilt every frame — and it is the vblank service that copies four bytes
per record from this list out to the two hardware sprite banks. `SPRITE_ACTOR_RECORD_SLOTS`
(0x8848) [seen] and `SPRITE_TARGET_SLOTS` (0x887C) [seen] are stride-4 sub-regions of the same
list that the movement and collision drivers sweep in place.

**The two command rings.** Work-heavy operations are decoupled from the code that requests them
through two ring buffers. The display-command ring `DISPLAY_CMD_RING_BUFFER` (0x88C0-0x88FF)
[code] is 32 two-byte slots with a write cursor `DISPLAY_CMD_RING_WRITE_PTR` (0x88A0) [code] and
a read cursor `DISPLAY_CMD_RING_READ_PTR` (0x88A1) [code]; game logic posts drawing requests into
it and the foreground loop executes them into the tile planes. The sound-command ring
`SOUND_RING_BUFFER` (0x8A43-0x8A5E) [code] is drained one entry per frame and handed to the
audio CPU through the sound latch `SOUND_COMMAND_LATCH` (0xA100) [seen], with a pulse on
`AUDIO_IRQ_LATCH` (0xA181) [seen] to interrupt it.

**HUD and guard cells.** The scoreboard furniture lives in the tile planes: the status panel at
`PANEL_VRAM_DEST` (0x8567) [seen] is painted from `PANEL_TILE_SOURCE` (0x8E00) [code], the
vertical phase gauge builds up from `PHASE_GAUGE_BASE_TILE` (0x863F) [seen], and the
stage-countdown digits sit at `HUD_STAGE_DIGIT_LO` (0x8743) [seen]. Finally, orientation is
software state: `FLIP_SCREEN_FLAG` (0x881F) [seen] is copied out to the flip-screen latch every
frame. A family of anti-tamper cells, headed by `TAMPER_FREEZE_FLAG` (0x881E) [code], sits over
the whole thing — when any of them is tripped by a failed ROM/signature checksum it freezes
spawns and diverts the per-frame handlers into abort paths.

### The dispatch model: how a frame flows through the cells

Two engines run against this memory, and the split between them explains why so much of work
RAM is queues and selectors.

The foreground is a main loop that free-runs continuously — it never waits for the beam. Each
pass it reads the display-command ring at the read cursor. If the current slot is empty (its
byte's high bit is set, the empty marker), there is nothing to draw, so the loop runs its
once-per-frame housekeeping worker — the tile-column scroll refresh *or* the program-signature
self-check, selected by the low nibble of the 0x883f control byte — and that is the point the
machine treats as the frame boundary. If instead the
slot holds a real command (high bit clear), the loop frees the slot, advances the cursor by two
(wrapping within the ring), uses the command's low bits to index a handler table, and runs the
drawing handler, which returns to the top of the loop so the *rest* of the ring drains within
the same frame. This matters: the ring is emptied fully each frame, the way the real machine
empties it each vblank, rather than one command at a time.

At that frame boundary the vblank interrupt fires — but only while the NMI-enable control bit
is set, which is the software's throttle on the whole thing. The interrupt service is where the
real per-frame work happens. It saves the entire register file, disables further interrupts for
its duration, and refreshes the hardware sprite banks from the staging list (drawing four
column groups when the play sub-state is at its active-gameplay value and a single group
otherwise). It kicks the watchdog, samples the three inverted input ports into the edge-detect
ring, ticks the free-running frame counter and a companion countdown, runs the credit/coinage
bookkeeping chain (which bails immediately under free play), and drains one entry from the
sound ring. Only then does it dispatch the game itself: it reads `MAIN_GAME_STATE` and jumps
through the top-level handler table to exactly one of five modes — attract setup, the
attract/demo sequence, the start/level-intro bridge, play, or a deliberate no-op. When that
handler returns, the epilogue copies the flip-screen flag to its latch, restores every
register, re-arms the interrupt, and resumes the interrupted foreground.

Each mode is itself a table dispatch on a selector cell, and the pattern recurses. The
attract/demo sequence steps `ATTRACT_SUBSTATE` through its handler table, each handler
advancing the selector to walk the demo forward. Play first ticks the BCD play timer, then
dispatches on `PLAY_STATE_INDEX` (masked to its low bits) through the in-play handler table:
the field-setup handlers that flood the attribute columns and prime the message buffer, and —
at the active-gameplay entry — a coordinator that simply runs about fourteen sub-drivers in a
fixed order (read the joystick into the player actor, resolve the aim indicator, update the
objects, service enemy spawns, sweep the enemy and formation record pools, run the formation
and periodic-event managers, and rebuild the sprite staging list), every one of which reads its
own state straight out of the cells above and writes its results back. The level-intro sequence
and the per-object handlers work the same way, each keyed on its own small selector.

The unifying idea is that Pooyan has no central "game object." State is scattered across named
work-RAM cells; a handful of integer selector cells decide, each frame, which handlers get to
run; the countdown timers decide *when* selectors advance; and the two rings decouple the logic
that decides something needs drawing or sounding from the engines that actually touch the tile
planes and the audio latch. Advancing the game is nothing more than a handler mutating a few
cells — most importantly its own selector — before it returns.

## The frame loop and the vblank heartbeat

Pooyan keeps time in an unusual way for a game of its era: its main loop never waits for
anything. Rather than spin on a vblank flag and do a burst of work once per frame, the CPU
free-runs a tight service loop continuously, and the *vblank interrupt* — firing asynchronously
about sixty times a second, once per displayed frame (50688 CPU cycles apart, roughly 60.6 Hz) —
is the sole heartbeat. Everything that must happen exactly once per frame lives in the interrupt;
everything the loop does between interrupts is preparatory, idempotent housekeeping. Understanding
the machine means holding these two halves together: a producer (the interrupt, which advances the
game and queues drawing work) and a consumer (the loop, which drains that work and otherwise idles).

### Power-on: reset and the boot self-test

Control begins at the reset vector `loc_0000` [code]. Its first and only real act is to hold the
vblank interrupt *off* by clearing `NMI_ENABLE_LATCH` (the hardware enable bit at 0xa180) — the
heartbeat must not fire while the machine is still assembling itself — before handing straight to
the boot entry `loc_0092` [code].

The boot entry lays down the entire initial state of the machine. It first proves the program
memory is intact: it sums each of the eight 4K banks with a 24-bit rolling checksum and compares
each against a stored table, bumping a pass tally that the play path will later insist is a full
pass before it lets anyone start a game. It then zeroes work RAM, marks both the display-command
and sound-command ring buffers empty and parks each ring's read and write cursors at its origin,
floods the colour map, arms the row-by-row tile fill, and decodes the two DIP-switch banks into
their individual configuration cells (cabinet mode, bonus-award schedule, difficulty, demo sounds,
lives, and the coinage nibbles). Near the end of setup it re-enables the vblank interrupt, then
finishes a few remaining seeds — ten three-byte records at 0x8a00, a flag at 0x88aa, and a short
cleared run at 0x89c0 — before dropping into the main loop. From this point the boot's transient
interrupt-disable leaves no lasting trace — the machine is running framed.

### The free-running main loop

The loop is `mainLoop` / `loc_020f` [code], and its job is to service the *display-command ring*, a
32-slot buffer the interrupt fills with drawing requests. Each pass reads the slot under the read
cursor `DISPLAY_CMD_RING_READ_PTR` [code] (which walks the range 0xc0..0xff, paired with the write
cursor `DISPLAY_CMD_RING_WRITE_PTR` [code] the interrupt-side handlers advance). The slot's top bit
decides the pass: when it is clear the slot names a real command, so the loop dispatches the
matching drawing handler through the command-handler table at 0x0242, frees the slot, and comes
straight back for the next one; when the top bit is set the slot is idle, and the loop instead runs
the per-frame worker `loc_0254` [code] — which repaints the scrolling tile columns (or, when the
worker control byte's low nibble is set, runs the program-signature integrity check).

Because the loop never blocks, it empties the *whole* ring in the gap between two interrupts and
then settles into the worker, repainting scroll columns over and over until the next heartbeat
arrives. That worker/ring-idle point is therefore the true frame boundary of the machine: the moment
the loop has finished all of this frame's queued drawing and is merely marking time is exactly where
the next vblank interrupt lands.

### The vblank interrupt — the heartbeat itself

When vblank arrives and the enable latch is set, the CPU vectors through 0x0066 into the service
routine at `loc_066d`, the one place all per-frame work happens. It opens by saving the complete
register file (main set, shadow set, and both index registers) and immediately masking further
interrupts at `NMI_ENABLE_LATCH` — the frame's work must run to completion uninterrupted.

It then does the framed housekeeping in order. Through `loc_0714` [code] it copies the sprite
display list into the two hardware sprite-RAM banks at 0x9010 and 0x9410, reading `PLAY_STATE_INDEX`
[seen] to decide how the list is gathered — when that index reads 4 the twenty-four four-byte
entries are pulled in four segments from separate bases within the list, otherwise the same
twenty-four are taken as one contiguous block from its head. It kicks the watchdog (a write to
0xa000). It samples the three hardware input ports — coin/start at 0xa080,
the player-1 controls `IN1_PORT` [code], and the player-2 controls `IN2_PORT` [code] — each read is
complemented, since the ports are active-low, and stored into the head of the edge-detect input ring
at `INPUT_PORT0` [seen] and its two neighbours (0x8810..0x8812); just before sampling, the previous
frame's readings are shuffled down into shadow copies at 0x8813..0x8816 so a handler can tell a
held button from a fresh press by comparing this frame against last. It ticks the two per-frame
counters — the `WORKER_CONTROL_BYTE` [code] and the free-running `FRAME_COUNTER` [seen], whose low
bits phase animations and whose zero-crossings gate the integrity checks. Finally it advances the
credit and coinage bookkeeping (`loc_59e8`, which short-circuits under free play) and drains a single
entry from the sound-command ring through `drainSoundCommandRing` [seen].

### The per-frame state dispatch

The heart of the interrupt is the state dispatch. It reads `MAIN_GAME_STATE` [seen] (0x8805) and
uses it to index a five-entry table at 0x06f0, selecting which per-frame handler runs this frame:
the attract state-0 setup `loc_072d` [code], the attract/demo driver `dispatchAttractSubstate`
[code] for state 1, the intro-transition handler at 0x0c4e for state 2, the play-state frame
`runPlayStateFrame` [seen] for state 3, and the do-nothing `noopStateHandler` [code] for state 4.
This is the branch that gives the machine its personality frame to frame — attract cycling through
0, 1 and 3, gameplay stepping 0→1→2→3 as a game begins. Whichever handler runs, it is *this* handler
that produces the drawing requests the free-running loop will consume: the interrupt decides what the
screen should show, the loop paints it.

When the chosen handler returns, the routine runs its epilogue: it copies the screen-orientation flag
`FLIP_SCREEN_FLAG` [seen] into bit 7 of the flip-screen latch `FLIP_SCREEN_LATCH` (so a cocktail
flip takes effect for the coming frame), restores the full saved register file, re-enables the vblank
interrupt at `NMI_ENABLE_LATCH`, and returns to whatever point in the free-running loop it had
interrupted — which resumes draining the freshly-queued commands, one heartbeat later.

## Configuration, coinage and players

Everything the cabinet operator can decide — how much a coin is worth, how many lives a
player starts with, how hard the game plays, whether it stands upright or lies in a
cocktail table — is settled once at power-on and then lived off for the rest of the
session. The two DIP-switch banks are the operator's only voice; the boot code translates
them into a handful of work-RAM cells, and from that point on the running machine reads
those cells, never the switches again. This section follows that chain: the boot decode,
the per-frame acceptance of coins into credits, the spending of credits to begin a game,
and the way a two-player game keeps each contestant's world in a separate bank and hands
the machine back and forth between them.

### Power-on: the DIP switches become configuration cells

The boot entry `loc_0092` [code] runs the whole cold-start sequence. It first verifies the
eight 4K program banks against `ROM_SELFTEST_CHECKSUM_TABLE` [code], leaving a pass tally
in `ROM_SELFTEST_TALLY` [code] that a later setup handler insists on before it will finish
bringing the game up — but the part that matters here is what happens after: the two
switch banks are read and unpacked into the cells the game will consult forever.

Bank 1 is read from `DSW1_PORT` [code] (0xa000) and complemented at once, because the
switches idle high and close to ground — the complement turns "switch on" into a set bit.
The complemented byte is then peeled apart field by field. Bit 2 lands in
`CABINET_MODE_FLAG` [code] as the upright/cocktail selector. Bit 3 lands in
`BONUS_AWARD_DSW` [code], which later picks the extra-life award schedule. Bits 4 through 6
become the three-bit `DIFFICULTY_DSW` [code]. Bit 7 becomes `DEMO_SOUNDS_DSW` [code], the
attract-mode sound enable. The two low bits choose the starting-lives count and are mapped
through a small arithmetic rule into `LIVES_DSW` [code]: settings 0, 1 and 2 give three,
four and five lives, while the fourth setting yields 0xff — a very large life count rather
than a normal one. `LIVES_DSW` is the seed that both players' banks draw their opening
lives from at the start of a board.

Bank 0 is read from `DSW0_PORT` [code] (0xa0e0) and carries the coinage for the two coin
slots, one per nibble. Each nibble indexes `COINAGE_TABLE` [code] (a ROM byte table at
0x0053), and the looked-up value is stored: the low nibble drives coin slot 1 into
`COINAGE_CONFIG` [seen], the high nibble drives coin slot 2 into `COINAGE_CONFIG_SLOT2`
[code]. The default settings resolve to one coin for one credit. A coinage value of 0x0f
is the free-play sentinel, recognised throughout the credit logic.

Before it hands off to the running machine, the boot also fixes the initial orientation:
it writes 1 into both `FLIP_SCREEN_FLAG` [seen] and the hardware flip latch
`FLIP_SCREEN_LATCH` [code] (LS259 bit 7 at 0xa187), meaning upright and unflipped, and it
lays down the default ten-entry high-score table with `HIGH_SCORE_BCD_HI` [seen] holding
the top score's most-significant byte. From here on the game runs off the config cells
alone.

### Coinage and coin acceptance

Coins are taken in every frame from inside the vertical-blank service routine `loc_066d`.
That routine samples the three hardware input ports, inverts each (again, active-low
hardware), and stores them into the edge-detect ring headed by `INPUT_PORT0` [seen]
(0x8810) — coin and start buttons all live in this first port. Having refreshed the input
snapshot, the service routine calls the credit/coin update chain `loc_59e8`, and it is
that chain that turns coin pulses into credits.

The very first thing `loc_59e8` does is check for free play: if either coinage cell —
`COINAGE_CONFIG` [seen] or `COINAGE_CONFIG_SLOT2` [code] — reads the 0x0f sentinel, it
returns immediately and no coin accounting happens at all. Otherwise it runs three
per-slot acceptance steps, one for each of the two coin slots and one for the service
button. Each step reads its bit out of `INPUT_PORT0` [seen] and rotates it into a small
shift ring, firing only when the ring settles on a fixed pattern — a debounce that ignores
switch bounce and demands a clean, sustained closure before it counts a coin. `loc_5a06`
[code] handles the service input this way, and on a clean pulse it simply emits the coin
sound through `emitPresetSound` [code] and adds one credit outright, since a service coin
is worth exactly one credit with no coinage arithmetic.

The two real coin slots, handled by the sibling routines `loc_5a56` (slot 1) and `loc_5a1f`
(slot 2), do the full coinage accounting. On each accepted pulse a slot advances a small
unit accumulator by a fixed step and compares the running total against its coinage cell —
`COINAGE_CONFIG` [seen] for slot 1, `COINAGE_CONFIG_SLOT2` [code] for slot 2. The coinage
value encodes both how many coins are needed and how many credits they buy: once the
accumulator passes the threshold the slot awards the low nibble's worth of credits (with a
low nibble of 0x0f topping the credit counter straight to its maximum), then rolls the
accumulator back down to begin the next group. Every accepted coin, on either real slot,
also queues a pulse on that slot's electromechanical coin counter: slot 1 bumps
`COIN1_PULSE_COUNT` [code], which `loc_5a9c` [code] then plays out as a timed strobe on
LS259 latch bit 3 (0xa183), seeding the phase in `COIN1_PULSE_PHASE` [code], raising the
latch, holding it, and dropping it after the fixed count; slot 2 has a structurally
identical strobe generator driving LS259 bit 4 (0xa184). These counter pulses are the
audited record of coins taken, kept independent of the credits actually awarded.

Whichever path awards credits, they all funnel through one shared tail that adds the credit
amount into `CREDIT_COUNT` [seen] (0x8802) and clamps it to 0x63 — ninety-nine credits, the
counter's ceiling — then queues the display command that repaints the on-screen credit
count. So a coin's whole journey is: debounced pulse, coinage arithmetic, hardware counter
strobe, credit added and clamped, HUD refreshed.

### The credit total and its display

`CREDIT_COUNT` [seen] is the single source of truth for how many games are paid for. It is
drawn as a two-digit HUD field by `loc_05ee` [code], which reads the count, clamps it to
ninety-nine, converts it to packed BCD through `byteToPackedBcd` [code], and writes the
tens digit to `CREDIT_HUD_TENS_VRAM` [code] (only when that digit is non-zero, so a single
credit shows without a leading zero) and the units digit to `CREDIT_HUD_UNITS_VRAM` [code].
When the machine is set to free play, `queueCreditDisplayCommands` [code] notices the 0x0f
sentinel in `COINAGE_CONFIG` [seen] and queues an extra display command so the panel shows
the free-play message in place of a credit count.

### Starting a game — spending credits, choosing one or two players

Pressing a start button is caught by `startGameOnStartButtonPress` [seen]. It refuses to do
anything while `CREDIT_COUNT` [seen] is zero, and it refuses while a game is already live —
it folds together `TWO_PLAYER_FLAG` [seen], the inactive player's remaining lives and the
`GAUGE_PHASE_COUNTER` [seen] into a single status value and bails if any of it is set. Only
when a credit exists, the machine is idle, and the start bits are actually present in
`INPUT_PORT0` [seen] does it queue the start jingle and continue into the routine that
actually spends the credit and lays out the game.

That follow-on, `loc_0d78`, reads the start bits directly. A one-player start (the
`INPUT_PORT0` bit-3 button) decrements `CREDIT_COUNT` [seen] by one and begins the game with
the active-player pair cleared to zero — `ACTIVE_PLAYER` [seen] = 0 and `TWO_PLAYER_FLAG`
[seen] = 0. A two-player start (the bit-4 button) is honoured only when at least two credits
are banked; it subtracts two from `CREDIT_COUNT` [seen] and begins the game with the pair
set so that `ACTIVE_PLAYER` [seen] = 0 (player one goes first) and `TWO_PLAYER_FLAG` [seen]
= 1. Either way control reaches the common start-of-life setup `loc_0dab`, which seats that
active-player pair, refreshes the credit display, and flips the machine into play: it clears
`PLAY_STATE_INDEX` [seen], sets the top-level `MAIN_GAME_STATE` [seen] to its play value
(3), raises the in-play gate `GAME_ACTIVE_FLAG` [seen], and fires the round-setup display
events; in a two-player game it additionally raises the player-two setup event. (A start
button pressed with no credit does not begin a game — it only nudges the attract state
machine forward.)

### Per-player banks and alternation

A two-player game is really two independent games time-sliced onto one machine, and the
architecture is a live working page plus one saved bank per player. The live actor/state
page is based at `SPEED_INDEX` [seen] (0x8900) — a 0x3f-byte block that is whatever the
player on the machine right now is doing. Player one's world is preserved in
`PLAYER0_STATE_BANK` [seen] (0x8940) and player two's in `PLAYER1_STATE_BANK` [seen]
(0x8980); each bank keeps that player's remaining lives eight bytes in, at `PLAYER0_LIVES`
[seen] (0x8948) and `PLAYER1_LIVES` [seen] (0x8988). At the start of a board
`resetActorStateForBoard` [code] seeds both banks identically from the cabinet switches —
each player's lives from `LIVES_DSW` [code], a fixed opening X position, and a sprite colour
taken from `DIFFICULTY_DSW` [code].

Which bank is "live" is decided by `ACTIVE_PLAYER` [seen] (0x880d). The round-init handler
`loc_1601` [code] restores the active player's saved bank into the live page as each turn
begins — copying from `PLAYER0_STATE_BANK` [seen] when `ACTIVE_PLAYER` [seen] is zero, from
`PLAYER1_STATE_BANK` [seen] otherwise. When a turn ends the reverse happens and the flag is
flipped to the other player: `saveLivePageToPlayer0Bank` [code] snapshots the live page back
into player zero's bank and, in a two-player game whose player two still has lives, latches
`ACTIVE_PLAYER` [seen] to 1 so player two takes the machine next; the counterpart handler
`loc_1bcc` [code] saves the live page into player two's bank at the end of player two's turn
and hands control back by clearing `ACTIVE_PLAYER` [seen] to 0 whenever player zero still has
lives. So the flag swaps 0->1 as player one yields and 1->0 as player two yields, and the
loop continues until a player is out of lives. The general save into whichever bank is active
is available as `saveLiveStateToPlayerBank` [code].

Each player's score rides in its own three-byte packed-BCD buffer — `P1_SCORE_BCD` [seen]
(0x88a2) and `P2_SCORE_BCD` [seen] (0x88a5) — and `selectActivePlayerScoreBuffer` [code]
resolves which one is current by looking at bit 0 of `ACTIVE_PLAYER` [seen]. The score
accrual routine `loc_0496` [code] uses that selector: while `GAME_ACTIVE_FLAG` [seen] is
set it adds a BCD increment (a per-frame trickle from `PER_FRAME_SCORE_INCREMENT` [code], or
a table-chosen award for a scored event) into the active player's buffer, repaints that
player's score column, and then keeps the shared high score in step — comparing the buffer
most-significant byte first against the running high score `HIGH_SCORE_BCD` [code]
(0x88a8, top byte at `HIGH_SCORE_BCD_HI` [seen]) and copying the buffer over it when it pulls
ahead. The sorted marquee of best scores lives separately in `HIGH_SCORE_TABLE` [code]
(0x8a00). The extra-life award for the active player is metered by `loc_18da` [code], which
watches that same active-player score buffer's most-significant byte against a pending BCD
threshold in `AWARD_QUEUE` [code]: crossing the threshold bumps the saturating
`GAUGE_PHASE_COUNTER` [seen] and BCD-steps the queue to the next milestone, with the reload
value and step size both chosen by `BONUS_AWARD_DSW` [code] — the boot-decoded bonus
schedule switch.

### Cabinet orientation

The screen's orientation is a per-frame reassertion, not a one-time setting. The game holds
its intended orientation in `FLIP_SCREEN_FLAG` [seen] (0x881f) and the vertical-blank
service routine copies it out to the hardware flip latch `FLIP_SCREEN_LATCH` [code] (LS259
bit 7 at 0xa187) as part of its epilogue every frame, so the display always tracks the flag.
Boot seeds the flag to 1 (upright, unflipped). In a cocktail cabinet — selected when
`CABINET_MODE_FLAG` [code] is clear — the round-init handler `loc_1601` [code] rewrites the
flag from the active player as each two-player turn begins, so the picture turns to face
whichever side of the table is playing: player one's turn leaves it upright, player two's
turn flips it 180 degrees. When the flag is not overridden for cocktail play, it stays at
its upright boot value. The machine itself is a vertically-oriented game; the display is
presented rotated 90 degrees (ROT90) on a 256x224 raster.

### Configuration cells that feed the rest of the machine

Several of the boot-decoded cells exist only to be read by other subsystems, and they are
worth naming here because their values are frozen at power-on. `DIFFICULTY_DSW` [code]
(three bits, 0x8820) is the difficulty knob the enemy spawn schedulers consult to scale how
often and how aggressively waves arrive; it also supplies the sprite colour seeded into each
player's bank. `BONUS_AWARD_DSW` [code] (0x8800) selects the extra-life schedule read by the
award meter described above. `LIVES_DSW` [code] (0x8807) supplies each player's opening life
count. `DEMO_SOUNDS_DSW` [code] (0x8821) gates whether the attract loop is allowed to make
noise. None of these change once the boot decode has run; they are the operator's settings
made permanent for the session.

## In-play progression and timers

### The play frame and its sub-state dispatch

Once a coin has bought a game, the top-level selector `MAIN_GAME_STATE` (0x8805, [seen]) holds
its "play" value, and every frame the machine runs the play handler `runPlayStateFrame` ([seen]).
That handler is the spine of a running game: it first advances the active player's elapsed-time
clock (`loc_7912`, [code]), then dispatches whatever in-play sub-state is current, and finally
runs an end-of-life housekeeping pass, `resetToBoardBuildToContinuePlay` ([seen]).

Which sub-state runs is decided by `PLAY_STATE_INDEX` (0x880a, [seen]). The dispatcher masks that
byte to its low five bits and uses the result to index the handler table that lives at 0x15a8,
transferring control to the selected handler; when the handler is done, execution flows on into the
housekeeping pass. The table carries nineteen live entries, so the selector meaningfully ranges over
0x00–0x12, and because every handler writes only values inside that range the selector never walks
off the end of the table into the data that follows it.

The housekeeping pass is what closes out a game rather than a frame. While `GAME_ACTIVE_FLAG`
(0x8806, [seen]) is still set it does nothing and simply hands the frame back. Only once a game has
ended does it act: on a free-play cabinet (`COINAGE_CONFIG` reads 0x0f) it tails into the shared
attract epilogue; with no credit banked it returns and leaves the machine idle; but with a credit
available it drops `MAIN_GAME_STATE` back to the board-build value (2), zeroes `PLAY_STATE_INDEX`,
runs the board/HUD reset and the actor-arena clear, and blanks an eight-tile attribute column. In
other words, the same pass that ends a game is what re-arms the board for the next one.

### The round-and-life cycle through the sub-states

The nineteen table slots implement a loop that carries the player from board build-up, through a
round of play, to a death or a board transition, and back again. Round setup begins at selector 0
in `loc_1601` ([code]): it holds until the row-by-row tile fill has drained (watching
`FILL_ROW_COUNTER`, 0x8809, [seen], through the fill-progress check), then clears the round-init RAM
and the actor arena, and on the first entry of a two-player round raises a once-per-round latch
(`loc_89e3`) and posts the player-select display command. It seeds the phase pacing timer
`PHASE_TIMER` (0x8808, [seen]) — a short 0x02 in a one-player round, a long 0x80 on the first entry —
advances the selector to 1, copies the active player's saved bank up into the live page, derives the
rope-segment count from the arrival counter, and copies the round message string. Selector 1
(`loc_16b7`) is the phase-timer wait: it decrements `PHASE_TIMER` each frame and returns until it
expires, then performs the per-phase setup, chooses the round's graphic and layout pointers from a
small decision tree keyed first on `PLAY_MODE_LATCH` and then over `ROUND_IN_PROGRESS`,
`GAME_ACTIVE_FLAG` and `ROUND_COUNTER`, and steps the selector to 2 (when the play-mode latch is set
it instead forces the selector to 0x10).

Selector 2 is `startRoundAfterIntroDelay` ([seen]), the intro delay. It runs the display-list
interpreter each frame and holds behind two guards — `SUBPHASE_TICK` wrapping once every 0x1c
frames, and a two-hit one-shot that lets the first wrap pass and proceeds on the second. Past both,
it reads `PLAY_MODE_LATCH` (0x8f50, [code]), `ROUND_IN_PROGRESS` (0x8904, [seen]),
`GAME_ACTIVE_FLAG` and `ROUND_COUNTER` (0x8907, [seen]) to decide what to do: in the normal case it
raises `ROUND_IN_PROGRESS`, seats `WAVE_ARRIVAL_COUNTER` to 2, runs the level-start setup (the round
HUD, the phase gauge and round marker, the frame-delay/anim-hold/rope timers, the enemy-spawn driver
and the sprite-list rebuild), and forces the selector to 3; on the alternate arms it instead points
the selector at 0x0d. Selector 3, `spawnEnemyWave` ([seen]), builds the wave: it seeds the actor
records and publishes the tile-animation cursor, then either advances the selector by one (into the
active-play frame) while copying the intro string, arms 0x12, or — when the round calls for it —
fans out the enemy sprite group and points the selector at 0x0f.

Selector 4 is the active-play frame itself, `runActiveGameplayFrame` ([code]), with a sibling
coordinator `stepGameplayFrame` ([code]) at selector 5; these run the fixed sequence of per-frame
gameplay sub-handlers, and the selector simply stays at 4 for the duration of live play while the
progression cells below drive the difficulty and spawns.

The death and player-swap branch lives at selectors 6 and 7. Selector 7 (`loc_1a64`) tails into
selector 6's routine (`loc_1a01`) while the play-mode latch is set; otherwise it clears the
once-per-round latch and, with the in-play gate open, decrements `GAUGE_PHASE_COUNTER` (0x8908,
[seen]). When that counter reaches zero it tails to `loc_1a96` ([code]) — the phase-exhausted handler
that queues the phase-exhausted tile run, advances the play-state selector, clears the high-score
insert rank and two round cells, and hands off to the high-score insert-sort. While the counter is still nonzero it repaints the
gauge and, through `loc_1a85` ([code]), seats the selector at 0x0a for player 0 or 0x0b for player
1. Those two slots are the save-and-swap step: selector 0x0a runs `saveLivePageToPlayer0Bank`
([code]) and selector 0x0b runs `loc_1bcc` ([code]). Each snapshots the current player's live page
down into that player's saved bank, and in a two-player game hands off to the other player when the
other still has lives (flipping the active-player select), before resetting the selector to 0 so
round-init restarts for the next life or the next player.

Two more sibling handlers sit at selectors 8 and 9 (`loc_1b43`, [code], and `loc_1b8c`, [code]),
used at round transitions: each waits for the tile fill to drain, floods the attribute columns,
posts two display commands, runs the shared integrity/timer handler `loc_7960` ([code]), then
latches the selector to 0x0c and adjusts `PHASE_TIMER` (`loc_1b8c` reloads it to 0x60, `loc_1b43`
clears it). Selector 0x0d is the per-frame object driver `loc_1c53` ([code]), reached from the arm
path, and selector 0x12 is the bonus/eagle-stage phase sub-dispatcher `loc_71b9`. The remaining
slots the selector can be parked at — 0x0c, 0x0e, 0x0f, 0x10 and 0x11, which index the handlers at
0x1c03, 0x1c66, 0x1d9c, 0x1d6e and 0x6bb2 — carry roles that are not yet established.

### The per-player live page and its saved banks

Everything about the current player's game is stored in one contiguous 0x3f-byte "live page" based
at `SPEED_INDEX` (0x8900). `resetActorStateForBoard` ([code]) prepares it at board reset: it clears
the page, then seeds each player's saved bank from the cabinet switches — the lives count from the
lives switch into `PLAYER0_LIVES` (0x8948, [seen]) and `PLAYER1_LIVES` (0x8988, [seen]), a fixed
opening X into bank byte +1, and the sprite colour from the difficulty switch into bank byte +0 — 
clears the play-timer gates, and arms the row-by-row tile fill.

Two saved banks shadow that live page byte-for-byte: `PLAYER0_STATE_BANK` (0x8940, [seen]) and
`PLAYER1_STATE_BANK` (0x8980, [seen]). Round-init copies the active player's bank up into the live
page, and the save-and-swap sub-states copy the live page back down — `saveLivePageToPlayer0Bank`
into bank 0, `loc_1bcc` into bank 1, and the shared `saveLiveStateToPlayerBank` ([code]) into
whichever bank `ACTIVE_PLAYER` (0x880d, [seen]) selects. That active-player select, together with
`TWO_PLAYER_FLAG` (0x880e, [seen]), is what makes two players alternate: each save flips to the
other player when the other still has lives, and the following round-init pulls that player's bank
into the live page. Because the banks mirror the live page exactly, the live-page cell at 0x8908
(`GAUGE_PHASE_COUNTER`) occupies the very offset — bank byte +8 — that the saved banks name
`PLAYER0_LIVES` / `PLAYER1_LIVES`. In the live page the selector-7 handler drains this cell as the
phase gauge ([seen], counting 3 down to 0 then resetting) and a bonus-award step tops it up; at the
same saved-bank offset sits each player's life count. Whether these are one dual-use cell or an
aliasing coincidence is not yet reconciled (see the open questions). `startGameOnStartButtonPress`
([seen]) reads that offset to decide whether a start-button press begins or joins a game.

### The 0x8900 progression cells

The head of the live page is a run of cells that between them record how far the player has
progressed. `SPEED_INDEX` (0x8900, [seen]) is the enemy speed/difficulty index that escalates with
the wave and round while also doubling as the page's base byte. `STAGE_COUNTDOWN` (0x8901, [seen])
counts down from 0x20 across a stage, gating actor AI as it nears zero, with its starting value
selecting the stage label. `SPAWN_PHASE_COUNTER` (0x8902, [seen]) is a per-round step counter that
cycles up to 7 and is snapshotted into the rope-draw count, and `WAVE_ARRIVAL_COUNTER` (0x8903,
[seen]) counts enemy arrivals across a stage — it bounds the rope-segment count (`ROPE_SEGMENT_COUNT`,
0x8931, [seen], is held to at most this value minus two) and its parity picks a spawn variant.
`ROUND_IN_PROGRESS` (0x8904, [seen]) is raised to 1 at level start and keys several render and
state decisions, while `ROUND_COUNTER` (0x8907, [seen]) is the round number itself: it is rendered
plus one as the BCD HUD round, its bit 0 selects the stage-type and facing variant, and its low
bits index the difficulty tables the in-play handlers read.

The bonus and extra-life award threads through `loc_18da` ([code]) and the last of these cells. An
empty award queue (`AWARD_QUEUE`, 0x8909, [code]) is reloaded with its next threshold — 5 or 3
depending on `BONUS_AWARD_DSW` (0x8800, [code]) — and otherwise the handler waits for the active
player's score MSB to reach the queued threshold; when it does, it bumps `GAUGE_PHASE_COUNTER`
(saturating), BCD-steps the queue to its next threshold (8 or 7), repaints the gauge, and plays the
tally sound. This is why the same 0x8908 counter that the death branch drains can also be topped up
during play.

### The BCD play timers and their gates

Distinct from `PHASE_TIMER`, which merely paces the sub-state machine, the machine also keeps a real
elapsed-time clock for each player so a finishing time can be recorded on the high-score table. Each
clock is a three-byte BCD bank — `PLAY_TIMER_BCD_P1` (0x8a30, [code]) and `PLAY_TIMER_BCD_P2`
(0x8a33, [code]) — whose base byte is a frame sub-counter and whose next two bytes are the BCD
seconds and minutes digits. `loc_7912` ([code]) ticks the active player's clock every play frame: it
bails when `GAME_ACTIVE_FLAG` is clear or the player's gate byte is set, then advances the frame
sub-counter, which rolls at 0x3b or 0x3c — the extra frame chosen by bit 0 of the seconds byte, so
the average keeps step with wall-clock seconds. On each roll it BCD-carries into the seconds digit
and then, at sixty, into the minutes digit, each digit rolling its low nibble at 0x0a and its high
nibble at 0x60.

Two gate bytes can suppress the tick, one per player: `PLAY_TIMER_GATE_P1` (0x89e1, [code]) and
`PLAY_TIMER_GATE_P2` (0x89e2, [code]). `resetActorStateForBoard` clears both at board reset, which
is what starts a player's clock running; setting one freezes that player's clock. The shared handler
`loc_7960` ([code]), invoked by the round-transition siblings, is what puts the clock on screen: it
splits the active player's minutes and seconds BCD bytes into high/low nibble tiles up a video
column, parted by a spacer tile, and then clears those timer bytes.

The clock finally feeds the high-score table through `loc_1ab2` ([code]). When a score qualifies,
that routine inserts it into the sorted ten-entry table and, in parallel, shifts the play-time side
table `HIGH_SCORE_TIME_TABLE` (0x89e0, [code]) down and writes the finishing player's minutes and
seconds into the opened slot — and it sets that player's play-timer gate to 1, freezing the clock at
exactly the time being recorded.

## The actor arena

Everything that moves on the Pooyan playfield — the player's stacked bird, the diving and
balloon-borne wolves, the meat and arrows in flight, the falling debris — lives as a fixed-format
record in a small family of parallel arrays. Each record is 24 bytes (stride `0x18`), and the same
byte offsets mean the same thing in every array, so one set of helpers can animate, move, spawn, and
collide any of them. A frame's worth of "arena" work is a fixed pipeline over these records: seed new
actors when the cadence allows, run each active record's state handler, step every animation stream,
fan the results out into the sprite hardware list, scan for collisions, and — at board boundaries —
wipe the whole thing clean.

### The record arrays and the shape of a record

The arena is anchored at `ACTOR_TABLE` [seen], the base of the `0x18`-stride record array that is
zero-filled at board init; its slot 0 is the player/lead actor. The enemy records sit `0x60` bytes
further in, exposed under their own name `ENEMY_ACTOR_TABLE` [seen] — the enemy sub-array, whose
`byte0` is a record-active flag. A second, shorter array of six object-state records begins at
`OBJECT_STATE_RECORD_BASE` [code] (stride `0x18`, spilling into the projectile region beyond it).
Alongside these live-logic arrays is the sprite display list at `SPRITE_DISPLAY_LIST` [seen], rebuilt
every frame: its stride-4 `SPRITE_ACTOR_RECORD_SLOTS` [seen] carry the actor sprite records that the
arena's proximity scan reads as its collision targets, and its stride-4 `SPRITE_TARGET_SLOTS` [seen]
carry the coordinate/collision targets for a separate collision scan (`loc_6435`).

Within a record the low bytes carry liveness and dispatch state, the middle bytes carry motion and
timing, and the high bytes carry the animation cursor. The conventions that recur throughout the
arena code are: `+0`/`+1` hold activity flags (bit 0 = live); `+2` is the state byte whose low bits
select which handler runs; `+4` is a seeded position field; `+5` a sub-position accumulator and `+6`
its phase/frame counter; `+7` a flag byte; `+8` a commitment latch (bit 0); `+9`/`+0a` a velocity and
its negation; `+0b` an arm bit; `+0c`/`+0d` a little-endian pointer into an animation stream with
`+0e` its frame-hold countdown; `+0f`/`+10` the attribute and tile the animation last produced; `+11`
a dwell countdown; `+12` an animation-hold timer with `+13` its 2-bit phase; `+14` a match tag; `+16`
an armed bit (bit 1); and `+17` a "kind" byte that indexes the animation and speed tables at spawn.

### Two per-frame record walks

Two independent drivers walk records each frame. The first, `loc_76ea` [code], runs three subsystems
in order: it advances the object-state table through the record-walk dispatcher `loc_76f4` [code],
then runs the enemy animation tick, then rebuilds the sprite list. `loc_76f4` steps the six records of
`OBJECT_STATE_RECORD_BASE` in turn and hands each to `dispatchActiveObjectState` [code]. That
dispatcher ignores a record whose `+0`/`+1` activity bits are both clear; for a live record it reads
`(rec+2) & 3` and runs one of four state handlers — state 0 arms a fresh object from the spawn ring
(`armObjectFromSpawnRing` [seen]), state 1 moves an active object (`moveObject` [seen]), state 2 draws
the object's stacked tiles and counts down its frame timer (`drawObjectStackedTiles` [seen]), and
state 3 runs a periodic self-integrity check over the slot (`advanceAttractStateIfImageIntact`
[seen]). Each handler is the tail of the dispatch, so the object simply advances through these four
states across successive frames.

The second driver, `loc_6a7f` [code], services the enemy records. While the blink-phase byte is set it
walks eighteen records from `ENEMY_ACTOR_TABLE` and runs `loc_6a98` [code] on each. `loc_6a98` skips a
record whose `+1` byte is zero; otherwise it selects a handler by `(rec+2 - 1) & 3`, where index 0
steps a descending object down the screen (`loc_6aa8` [code]) and index 1 runs the screen re-init /
colour-map integrity path (`loc_67df` [code]). When the blink-phase byte is instead clear and the wave
index is exactly 2, `loc_6a7f` performs a one-shot checksum of the playfield tilemap — summing video
RAM column by column (skipping one column, stepping to the next row, stopping when the high address
byte leaves the tilemap) and comparing against a fixed total; a mismatch is unreachable with an intact
tilemap and signals corrupted work RAM.

### Animation stepping

An actor's on-screen appearance is driven by a small bytecode stream that the record's `+0c`/`+0d`
pointer walks. Pointing a record at a new stream is the job of `setActorAnimation` [code]: it stores
the little-endian stream pointer into `+0c`/`+0d` and resets the frame index `+0e` to zero, so the
actor restarts at the head of the sequence. `storeActorAnimationPointer` [code] does the same for a
record addressed through the alternate index register.

Stepping the stream one frame is `loc_4006` [code] (and its twin `advanceActorAnimFrame` [code], which
walks a record addressed by the other index register with identical logic). The `+0e` byte is a
frame-hold countdown: while it is non-zero the routine simply decrements it and returns, holding the
current frame on screen. When it reaches zero the stream is read: a `0xff` opcode reloads the stream
pointer from the next two bytes and re-reads (letting a sequence loop or jump); any other byte begins
a three-byte frame record — tile into `+10`, attribute into `+0f`, and the new hold value into `+0e` —
after which the advanced pointer is written back to `+0c`/`+0d`.

A separate hold mechanism, `tickActorAnimHold` [code], governs a record's multi-phase animation timer
at `+12`. It runs only when the per-record animate bit `+0b`.0 is set, or otherwise only on even
`ROUND_COUNTER` [seen] frames, and only for a record that is both live (`+0`.0) and armed (`+16`.1).
On each such frame it decrements the `+12` hold; when the hold underflows it steps the 2-bit phase at
`+13` down by one and re-arms `+16` for the next step, or — once the phase reaches zero — disarms the
record by clearing `+16`.

### The animation-tick walk

The enemy array carries a shared animation-tick walk with two entry points that differ only in how
many records they cover: `loc_7621` [code] seeds a count of fourteen and `loc_7625` [code] a count of
eight, both then running the common walk `loc_7627` [code] over `ENEMY_ACTOR_TABLE` at stride `0x18`.
The walk ticks each record through `loc_7638`, which dispatches on `(rec+2) & 3` to one of three
per-entry behaviours, and any tick may signal the walk to stop early, leaving the remaining records
untouched this frame.

In tick-state 0 an inactive record is passed over; a live one has its animation stepped by `loc_4006`,
then its `+5` sub-position is advanced by subtracting `+9` (a borrow rolling the `+6` frame counter
down), and it keeps animating while `+6` remains at or above 6. The moment `+6` drops below 6 the walk
reloads `SHARED_PHASE_COUNTDOWN` [code] to `0x20`, forces fourteen records' state bytes back to active,
and stops — a phase-transition reseed. Tick-state 1 also steps the record's animation, then counts
`SHARED_PHASE_COUNTDOWN` down; while it is non-zero the walk continues, but on reaching zero it
re-seeds the wave wholesale — eight enemy records' state bytes set to 2, six object-state records'
state bytes cleared, the spawn-ring counter cleared, and `ATTRACT_SUBSTATE` [seen] set to 8 — and
stops. Tick-state 2 is a gate: while `OBJECT_DRAWN_FLAG` [code] is set the record is held frozen, and
once it clears the animation steps; this state never stops the walk.

### Screen tile animation

Independent of the actor streams, a strip of playfield tiles is animated directly in video RAM by a
parity-driven pair. `TILE_ANIM_PARITY` [seen] is a per-frame counter, and `TILE_ANIM_CURSOR` [seen] is
a 16-bit pointer into the `0x84xx` tilemap. `advanceTileAnimForwardOnOdd` [code] bumps the parity
counter and acts only when it turns odd: if the tile under the cursor has reached the wrap code `0x37`
it steps the cursor forward one cell and reseeds that cell to `0x34`, otherwise it animates the
current cell's tile code up by one. Its even-frame counterpart `retreatTileAnimScript` [code] walks
the same cursor the other way — a `0x34` marker reloads the cell to the base code `0x10` and backs the
pointer up one cell, otherwise the tile code is decremented in place. Because the two share the parity
counter, exactly one of them acts on any given frame, and together they march a cycling tile strip
back and forth across the screen.

### Spawning

Populating the arena is done by cadence gates that, once their timer clears, sweep a record array and
seed the first free slot — arming exactly one actor per sweep, because the per-slot routine reports
back whether it filled a slot and the sweep stops the instant one is filled.

Two closely related gates handle the balloon/dive enemies. `loc_6905` [code] is delay-gated on
`SHARED_FRAME_DELAY_TIMER` [code]: while it runs, the gate just counts it down; once it clears the
gate spawns nothing if the wave has fully arrived (`WAVE_NUMBER` [code] caught up to
`WAVE_ARRIVAL_COUNTER` [seen]) or the wave has hit its limit of 8, and otherwise sweeps eight
enemy/state record pairs and fills the first empty pair (`loc_6931`). Filling a pair activates both
records and seeds their motion fields, arms the animation from `ANIM_TABLE_3838` [code] via
`setActorAnimation`, and reloads the frame-delay timer; on the very first fill of a wave it also
queues two display commands, paints the arrival count to the HUD as two BCD digits, and queues a round
sound run before bumping `WAVE_NUMBER`. The sibling gate `loc_6a0f` [code] runs while `BLINK_PHASE`
[code] is set, the phase toggle `ANIM_PHASE_TOGGLE_892C` [code] has not reached 6, and
`BLINK_COUNTDOWN` [code] has drained; it then sweeps eighteen enemy records and fills the first empty
one (`loc_6a35`), which seeds the record, arms the countdown, and picks a spawn animation by the
pre-bump phase toggle — early phases take `ANIM_PARAM_76D4` [code] (phase 1 re-arming the countdown to
`0x1c`), phase 2 takes `ANIM_PARAM_68EF` [code], and later phases `ANIM_PARAM_6B0A` [code].

A second cadence controls the ground-level enemy pool off `ENEMY_SPAWN_TIMER` [seen]. `loc_1171`
[code] counts that timer down and, at zero, spawns only when `STAGE_COUNTDOWN` [seen] leads the
`ACTIVE_ENEMY_COUNT` [seen] and fewer than six enemies are live; it then sweeps six records and
initialises the first free one (`loc_119a`), which stamps the opening fields, derives a facing byte
and its negation plus a spawn-timer reload from a round-indexed pair of tables
(`SPAWN_FACING_TABLE_1209` [code] and `SPAWN_TIMER_TABLE_11F9` [code]), arms `ANIM_TABLE_3829` [code],
and bumps the active count. The richer variant `loc_56e8` [code] uses the same timer but branches on
round parity: on an even `ROUND_COUNTER` it hands the spawn decision to the spawn gate `loc_5871`
[code] with the round as its seed; on an odd round it gates on the stage-countdown-versus-active
comparison plus a difficulty threshold derived from `SPEED_INDEX` [seen] (below 3, the threshold is
`SPEED_INDEX+4`, otherwise 6), then sweeps six slots and spawns at most one through `loc_572b`.

`loc_572b` [code] is the per-slot spawn used by several sweeps. A slot whose low activity bit is
already set is left alone so the sweep continues; an empty slot is initialised: its state, timer, and
animation fields are seeded, then a spawn column is computed — the difficulty switch `DIFFICULTY_DSW`
[code] clamped to 3, an optional late-gauge bias from `SPAWN_COLUMN_BIAS` [code] once the
`GAUGE_PHASE_COUNTER` [seen] reaches 4, an even-round early-stage shift via `adjustSpawnColumn` [code],
then the round added and the whole thing clamped below the arena width `0x1f`. That column indexes two
byte tables for the actor's velocity (`SPAWN_FIELD_TABLE` [code] / `SPAWN_FIELD_TABLE_ODD` [code], the
value negated into `+0a` for the mirrored field) and its spawn-timer reload
(`SPAWN_TIMER_TABLE_EVEN` [code] / `SPAWN_TIMER_TABLE_ODD` [code]); the animation is armed, the active
count bumped, and the actor's sub-state head run. The full record initialiser `loc_5489` [code] seeds
the fixed opening fields, then uses the record's kind byte `+17` to look up its animation sequence in
`ACTOR_ANIM_TABLE_5657` [code] and to select a row of `ACTOR_SPEED_TABLE_55D7` [code]; within that row
`3 × (ROUND_COUNTER & 7)` picks a byte that is negated into the speed field `+0a`.

Three scheduler tails share a slot-scan idiom: walk a run of blocks, find the first whose first two
bytes are both zero, stamp a kind byte pulled from a table, and hand the block to `loc_5489`.
`loc_54f9` [code] draws its kind from `ACTOR_SPAWN_TYPE_TABLE` [code] indexed by the low nibble of
`SPAWN_TYPE_CURSOR` [code]; `loc_5544` [code] draws from `SPAWN_KIND_TABLE_5647` [code] indexed by
`SPAWN_SEQUENCE_INDEX_8D13` [code]; and `loc_5594` [code] draws from `SPAWN_KIND_TABLE_5627` [code]
indexed by `SPAWN_SEQUENCE_INDEX_8D14` [code], additionally running an eight-byte anti-tamper
self-check that bumps `TAMPER_FREEZE_FLAG` [code] on a signature mismatch. `loc_588e` [code]
sweeps a run of sprite blocks with `loc_572b` under a fixed field seed, seeding the first free block
and stopping there — the same one-per-sweep idiom, since `loc_572b` reports a fill and the sweep aborts.
There is also a scripted spawn path, `spawnNextScriptedEnemy` [seen], which reads a live script byte,
ticks and reseeds its delay timer, advances the script pointer, then sweeps the six `ENEMY_ACTOR_TABLE`
records and activates each through the lane-slot activator.

### Per-record phase dispatch

Once spawned, an actor advances through a phase machine keyed on its `+6` byte, driven by `loc_362d`
[code]. Phases below 7 route to the end-of-move guard (`loc_361d` [code]) and phases at or above `0x14`
to a commitment guard (`loc_3625` [code], which does nothing while the actor's `+8` latch bit 0 is set
and otherwise runs the target-tile resolver `loc_357c` [code]). Phases in the middle band pass through
a global gate: while `WAVE_PROGRESS_COUNTER` [seen] has reached `0x0e` and the phase is still below
`0x13` the actor holds. Otherwise a per-actor delay `ACTOR_DELAY_COUNTER` [code] counts down; when it
elapses and the actor's X lies in the near half of the field, the delay is reloaded from
`DELAY_RELOAD_TABLE_368E` [code] (indexed by `ROUND_COUNTER & 7`) and control enters the pre-spawn
gate `loc_365d` [code].

The pre-spawn gate, when the actor's arm bit `+0b`.0 is set, requires that exactly one enemy record
carries the spawn state value 3 in its `+2` byte and bails if the count is anything else; with the arm
bit clear (or the count satisfied) it seats a five-slot sprite-object scan window and falls into the
slot spawner `loc_3680` [code]. (A short guard `loc_3617` [code] enters the same gate from the
target-tile resolver when its counter is below `0x20`.) `loc_3680` scans a slot table for the first
free entry; on a hit, when the template's `+7`.2 flag is set it bumps the spawn index
`SLOT_SPAWN_INDEX` [seen] — and, if lanes also remain, the lane counters `ACTIVE_LANE_COUNT` [seen]
and its countdown — then unconditionally
steps `ANIM_FRAME_COUNTER` [seen] into the template's `+14` (skipping the value 0 on wrap), seats an
animation vector chosen by `+7`.1 (`ANIM_SEQ_3994` [code] or `ANIM_SEQ_3988` [code]) along with fixed
timing fields, builds the attribute byte, and hands the found slot to the slot initialiser.

### Stacking the player sprite

The player is drawn as three sprites stacked vertically, and `deriveStackedSpriteYs` [code] keeps
their Y coordinates in register with the player's motion. It reads the player-actor vertical position
`PLAYER_Y` [seen] and writes it into the Y field of three actor slots: the bottom slot
(`ACTOR_TABLE + 0x4c`) gets the base Y, the middle slot (`+0x34`) gets Y − `0x10`, and the top slot
(`+0x1c`) gets Y − `0x10` + `0x0a`, seating the three sprites `0x10`/`0x0a` apart so they read as one
tall figure.

### The object-proximity collision scan

Collisions are found by a proximity scan driven each frame from the master actor updater
`runActorUpdatePipeline` [code], which runs eleven subsystem handlers in fixed order; the scan itself
is `loc_602f` [code]. It runs the per-slot scan once for each of the two target slots at
`SPRITE_ACTOR_RECORD_SLOTS` [seen] (stride 4), tagging each pass with its slot selector; a hit inside
a pass ends the routine, leaving the second slot unscanned that frame. Each pass enters `loc_6048`
[code], which picks the slot's presence block (`ENEMY_TARGET_REC0` [seen] or `ENEMY_TARGET_REC1`
[seen]): a block whose lead byte is empty (0) or already engaged (3) is inert, while a live block
latches its kind into `ACTIVE_OBJECT_TYPE` [seen] and enters the record scan over `SPRITE_OBJECT_TABLE`
[seen].

That scan is a tightly interlinked cluster of routines that walk the object table together, threading a
single control signal that either continues the walk or unwinds it the moment a hit is serviced. The
head `loc_6069` [code] classifies each record — a zero lead byte or a kind that is not the live kind 5
falls through to the epilogue `loc_60f2`, which advances to the next record and re-enters the head
while records remain, closing the loop. A live matching record is routed by round parity: an odd round
goes to the collision handler `loc_61b4` and an even round to the proximity gate `loc_6080`. The
proximity gate measures the axis gaps between actor and target (the X biased by `FLIP_SCREEN_FLAG`
[seen]) and, when both are within range, enters the hit handler, which matches an enemy record by its
`+14` tag and then either engages the struck target pair — activating its fields and enqueuing a
sound — or seeds a fresh actor record and re-scans. The collision handler dispatches on the high
nibble of a matched slot's state byte: some kinds defer back to the proximity gate or a sibling test,
while the award kinds latch the actor onto the record, add a round-indexed delta from
`POSITION_DELTA_TABLE_6358` [code] to both the record and the re-found slot, arm the slot, wipe the
parity target buffer, and play the award sound before unwinding the scan. Every serviced hit signals
the unwind, stopping the scan for that slot; the `ACTIVE_OBJECT_TYPE` latch, though, is cleared only on
the reset/no-match retire path (`loc_618a`) — the engage and award paths unwind with it left set, which
is harmless because the next slot's scan re-seeds it (`loc_6048`).

### Teardown

At board and phase boundaries the arena is wiped so nothing stale survives. `clearActorArena` [code]
zero-fills the `0x200`-byte record block at `ACTOR_TABLE` at board init, giving a fresh board a clean
slate. `clearActorArenaAndCounters` [code] is the heavier teardown: it zeroes a `0x241`-byte span from
`ACTOR_TABLE`, clears the spawn/wave/rope counters `SPAWN_PHASE_COUNTER` [seen],
`WAVE_ARRIVAL_COUNTER` [seen], and `ROPE_SEGMENT_COUNT` [seen], and forces the in-play sub-state
`PLAY_STATE_INDEX` [seen] to 6. `resetActorStateForBoard`
[code] prepares a new board from the cabinet switches: it clears the live-state page and a handful of
loose flags, seeds each player's saved bank with lives from the lives switch, a fixed opening X of
`0x20`, and a sprite colour taken from `DIFFICULTY_DSW` [code], and arms the row-by-row tile fill; when the
game is idle it stops there, and when a game is in progress it additionally clears the launch flags.

## Waves, rope and launch

Three cooperating machines populate the playfield while a round runs: the attack wave that flies
enemy records down into their grid slots, the rope column that grows down the screen and hangs
objects from its cells, and the launch sequences that raise the arrow and seed hunters at the
player. Each runs once per frame off the play-state coordinator and talks to the others only
through a small pool of work-RAM flags and counters, so the pieces stay loosely coupled — a wave
can be idling between attacks while the rope is still extending and the launch machine is mid-flip.

### The attack wave

loc_72a0 [code] is the body of the attack phase. Each frame it first runs the shared per-frame
object update (loc_20d4 [code]) and then hands the frame straight to the wave-launch driver
loc_72a7 [code], whose result rides back out unchanged.

loc_72a7 chooses one of three behaviours from two flags. When WAVE_LAUNCH_FLAG (0x8f3a [code]) is
clear no wave is live, so it seeds the next one and returns. When a wave is live but
WAVE_RECORD_COUNT (0x8f3c [code]) has drained to zero — every enemy has retired — it hands the
frame to the inter-wave idle handler. Otherwise it walks the wave's live records, two per
WAVE_INDEX (0x8f3d [seen]), stepping through the enemy-actor table ENEMY_ACTOR_TABLE (0x8ae0 [seen])
one record (stride 0x18) at a time and running each through the per-record state dispatcher loc_72cf.

Seeding a wave (loc_72e1 [code]) happens only while the first target slot ENEMY_TARGET_REC0
(0x8c90 [seen]) is clear, so a fresh wave can never overwrite an enemy still on screen. It raises
WAVE_LAUNCH_FLAG and advances WAVE_INDEX; on the fourth wave it deliberately spawns nothing,
merely bumping WAVE_OUTER_PHASE (0x8f38 [code]) and reloading the inter-wave hold WAVE_HOLD_TIMER
(0x8f36 [seen]) to 0x20. On the other waves it writes two records per wave index into
ENEMY_ACTOR_TABLE, marking each active and copying four fields — target column and target row
among them — from the four-byte-per-record EAGLE_WAVE_PARAM_TABLE (0x7409 [code]), plus a
fixed flag byte; the per-record speed is not among them — it is stamped in at a fixed value later,
on arrival. It then clears WAVE_OUTER_PHASE and the arrival tally WAVE_RECORDS_ARRIVED
(0x8f39 [seen]) so the new wave starts counting from zero.

The per-record dispatcher loc_72cf [code] skips any record whose active bit is clear, then routes on
the record's state byte into one of three handlers: approach (0), dive/climb (1), or retire (2). The
record advances through these states in turn as it completes each phase of its attack run.

In the approach state (loc_733c [code]) a record simply waits until the enemy's live grid position
matches the slot it was seeded for: its column, EAGLE_X_COORD (0x8c96 [code]) shifted down three
bits, must equal the target column or the one just before it, and its row, from EAGLE_Y_COORD
(0x8c94 [code]), must fall inside a five-row window above the target row. On arrival the record
advances its state, arms an animation and stamps in its fixed dive/climb speed — odd-indexed records
take EAGLE_ODD_RECORD_ANIM (0x7403 [code]) and speed 0x38; even-indexed ones take
EAGLE_EVEN_RECORD_ANIM (0x4086 [code]) and speed 0x40, bump
WAVE_RECORDS_ARRIVED, and once that tally equals the wave index (every record now in place) queue
the wave-arrival command from base WAVE_ARRIVAL_CMD_BASE (0x0630 [code]) offset by the count, so
the sound and display react to a fully-formed wave.

In the dive/climb state (loc_7395 [code]) the record runs its animation mover and then integrates a
16-bit vertical position by its own per-record speed. Even records descend — position plus speed, a
carry dropping the enemy one grid row — and odd records climb — position minus speed, a borrow
lifting a row. Reaching the bottom row limit while descending, or the top while climbing, advances
the record into its retire state.

Retiring (loc_73ce [code]) zero-fills the whole 0x18-byte record and decrements WAVE_RECORD_COUNT.
When that count hits zero the last enemy of the wave is gone, so it seeds WAVE_HOLD_TIMER to 0x30,
spacing out the next attack.

The inter-wave idle handler (loc_73e3 [code]) is what loc_72a7 runs when no records remain: while
WAVE_HOLD_TIMER is still nonzero it just ticks it down. On expiry, if a wave index is still set it
enqueues a command carrying that index, then reseeds the hold to 0x18 and clears WAVE_LAUNCH_FLAG —
which on the next frame steers loc_72a7 back into the seed path so the following wave can begin. The
hold timer, reloaded to different values by the seed, retire and idle paths, is the single clock
that paces one wave into the next.

### The rope

The rope shares one entry, loc_25a6 [code], that runs every frame but forks on the low bit of
ROUND_COUNTER (0x8907 [seen]) — the stage-type selector. On one parity loc_25a6 draws the
marker/lift column itself; on the other it delegates to loc_2d66 [code], which drives the actual
rope segments and cells. A given round therefore always takes the same fork.

On its own branch, loc_25a6 paces the work with ROPE_DRAW_STEP_TIMER (0x8f09 [code]) — nothing
happens until it expires — then stamps a glyph down a column from the saved layout pointer
MARKER_LAYOUT_PTR (0x8932 [code]) in one of three modes chosen off FORMATION_SLOT_TABLE
(0x8920 [seen]) and the sweep flags. In retract mode it blanks a band above the column and redraws
MARKER_RETRACT_GLYPH_SRC (0x2770 [code]). In extend mode it advances the draw count ROPE_DRAW_COUNT
(0x8934 [seen]) toward the per-round phase SPAWN_PHASE_COUNTER (0x8902 [seen]), sets
ROPE_DRAW_EXTEND_FLAG (0x8f05 [code]), points the layout at the sprite band SPRITE_BAND_86E3
(0x86e3 [code]), grows the column one row upward and pulses the new cell pair, using
MARKER_COLUMN_GLYPH_SRC (0x2768 [code]); when the sweep runs out it clears the extend flag and the
band-built latch ANIM_ARMED_LATCH (0x8f63 [code]), and when the layout pointer reaches its cap
offset it sets ROPE_DRAW_COMPLETE_FLAG (0x8f04 [code]). In steady mode it just redraws the column
glyph in place. Every pass the source variant is picked by the parity of ROPE_DRAW_ANIM_PHASE
(0x8f0a [code]), and a forward frame also appends the 3x3 cap glyph MARKER_GLYPH_SRC (0x2754 [code])
below the last row, so the column reads as a continuous growing/retracting strip.

The delegated branch, loc_2d66, first bails while a grab is in progress (GRAB_ACTIVE_FLAG
(0x8d32 [seen])) or while the arrival counter WAVE_ARRIVAL_COUNTER (0x8903 [seen]) still sits at its
hold value of 2; otherwise it runs the rope-extend state machine and then the per-cell driver, in
that order, so a newly-added segment exists before its cell is serviced.

The rope-extend state machine (loc_2d78 [code]) selects a handler on ROPE_EXTEND_STATE
(0x8f14 [code]) through the inline table ROPE_EXTEND_DISPATCH_TABLE (0x2d7c [code]): state 0 adds a
segment, state 1 plays that segment's growth animation. loc_2d80 [code] adds the segment. It stops
at once once the rope has grown to two below the stage's WAVE_ARRIVAL_COUNTER — that difference is
what caps the rope's length for the round. Otherwise it bumps the segment count ROPE_SEGMENT_COUNT
(0x8931 [seen]) and, while the segment index ROPE_EXTEND_INDEX (0x8f18 [code]) is below four,
advances that index, looks the new segment's video-RAM column low byte up from ROPE_CELL_COLUMN_TABLE
(0x2db8 [code]) and stores the full page-0x84 pointer in ROPE_COLUMN_VRAM_PTR (0x8f19 [code]),
reloads this segment's cell timer in the ROPE_CELL_TIMERS (0x8f28 [code]) array, advances the
sub-state to 1, and arms ROPE_EXTEND_TIMER (0x8f16 [code]). (At or beyond the four-segment limit the
extend continues only if the ROM-checksum strike counter TAMPER_STRIKES_ROM (0x89ef [code]) is
nonzero — an anti-tamper branch no valid play reaches.)

The state-1 handler advanceRopeExtendAnimation [code] holds between frames on ROPE_EXTEND_TIMER; on
each expiry it reloads that hold to eight and, until ROPE_EXTEND_FRAME_INDEX (0x8f1b [code]) reaches
eight, looks this frame's tile block up from ROPE_TILE_BLOCK_TABLE (0x2dee [code]) and blits it at
ROPE_COLUMN_VRAM_PTR, advancing the frame index. When the eight-frame sequence finishes it resets
the frame index, drops the machine back to state 0, and arms the next rope cell — so each added
segment plays its grow-in animation once before the next segment is even considered.

Once segments exist, loc_2e22 [code] services them: it walks ROPE_EXTEND_INDEX cells of the state
array ROPE_CELL_STATE_BASE (0x8f1c [code]) and hands each to the per-cell dispatcher
dispatchRopeCellState [seen], which skips an inactive cell (state 0) and routes the rest on their
state through the inline table ROPE_CELL_DISPATCH (0x2e3d [code]) into one of four handlers. Two are
understood. The state-1 handler loc_2e5e [code] acts on every fourth frame once the cell's own timer
elapses: it scans the three slots of SPAWN_OBJECT_TABLE (0x8c48 [seen]) for a free one and, finding
it, seeds a hanging object there — opening state 0x07, its coordinates, and a +4 field pulled from
ROPE_SPAWN_IY4_TABLE (0x2ec7 [code]) — then advances the cell state, blits the segment tile
ROPE_SEGMENT_TILE_SRC (0x2dfe [code]) at the column, and enqueues its display command; the fourth-
frame gate reads FRAME_COUNTER (0x8a5f [seen]) and the cell timer is re-armed with a reload scaled
by ROUND_COUNTER, so objects appear faster in later rounds. The state-4 handler retractRopeSegment
[code] fires when the cell timer expires and segments still remain: it picks a retract-animation
pointer from RETRACT_ANIM_TABLE (0x2f93 [code]) — indexed by ROUND_COUNTER shifted down two and
clamped, plus a term from DIFFICULTY_DSW (0x8820 [code]) — merges the paired cell's attribute bits,
clears the count-selected record in FORMATION_TABLE (0x8c30 [seen]), advances the cell state, and
blits the retract tile ROPE_RETRACT_TILE_SRC (0x2e1a [code]). Two shared helpers serve every cell:
loc_2e45 [code] ticks the frame timer selected by the low two bits of the cell's record index and
reports whether it reached zero, and loc_2e52 [code] recomputes a cell's video-RAM column base from
the same column table the extend driver uses.

### The launch sequences

Two independent machines throw objects at the player.

The launch state machine is driven by loc_2778 [code], which selects a handler on the low three bits
of LAUNCH_STATE (0x8f30 [seen]) through an inline jump table across five states, cycling 0→1→2→3→4
and back once the state is reset for the next launch.

State 0 (loc_278f [code]) arms the launch. LAUNCH_ARMED_FLAG (0x8f3f [seen]) is set once either the
lane countdown LANE_SPAWN_COUNTDOWN (0x8d75 [seen]) is still running with LAUNCH_ARM_LATCH
(0x8f20 [seen]) clear — which just bumps the latch — or the stage countdown STAGE_COUNTDOWN
(0x8901 [seen]) is nonzero and an exact multiple of eight. It then holds until the arrow has risen
far enough (ARROW_Y (0x8ab4 [code]) at or above 0x3c) and neither hunter-target record
ENEMY_TARGET_REC0 / ENEMY_TARGET_REC1 (0x8c90 / 0x8ca8 [seen]) carries the hit bit; clearing those
gates it advances the state, reseeds the tile-flip countdown LAUNCH_FLIP_COUNTDOWN (0x892f [code]),
refreshes the arm latch from LAUNCH_ARM_LATCH_SEED (0x8d7a [code]), lights the status cell
LAUNCH_HUD_TILE (0x8508 [code]) when the game sits idle, and blits the launch tile LAUNCH_TILE_SRC
(0x2d51 [code]) at LAUNCH_TILE_VRAM (0x84a7 [code]).

State 1 (loc_27f3 [code]) animates the arrow while it is still climbing (ARROW_Y at or above 0x34):
a flip countdown paces a two-frame tile swap between LAUNCH_TILE_SRC and its alternate
LAUNCH_TILE_SRC_ALT (0x2d55 [code]), the frame chosen by the parity of SHARED_PHASE_COUNTDOWN
(0x892e [code]). Once the arrow drops below that gate the handler scans the two target records for a
free one, marks it state 2 (arming a hunter target), queues a sound, blits the alternate tile, and
seeds three record fields — converting the risen arrow into a locked target.

State 2 (loc_2856 [code]) seeds the hunter itself. Unless the play-mode latch PLAY_MODE_LATCH
(0x8f50 [code]) is set, it scans the six slots of HUNTER_TABLE_BASE (0x8c78 [code]) downward
(stride 0x18) for a free one, stamps it with opening state, coordinates and tile ids, and records
its address in HUNTER_RECORD_PTR (0x8f32 [code]). It advances the launch state and then either
seeds the spawn countdown HUNTER_SPAWN_COUNTDOWN (0x8f34 [code]) to 0x20 and enqueues
HUNTER_SPAWN_DISPLAY_CMD (0x0315 [code]), or — when HUNTER_SPAWN_FLIP_FLAG (0x8f61 [code]) is set —
instead bumps HUNTER_SPAWN_SUBCOUNTER (0x8f5d [code]).

State 3 (loc_28ad [code]) runs the spawn hold: while HUNTER_SPAWN_COUNTDOWN is nonzero it just
decrements it; on expiry it advances the state and, unless the play-mode latch is set, clears the
0x18-byte record that HUNTER_RECORD_PTR points at. State 4 (loc_28c5 [code]) is a terminal no-op —
the machine idles here until LAUNCH_STATE is reset for the next launch.

The second machine is a scripted single-object launcher, gated by loc_6e75 [code]. With a valid ROM
— the signature and tamper guards SIGNATURE_MISMATCH_FLAG (0x8ef0 [code]) and TAMPER_FREEZE_FLAG
(0x881e [code]) both clear, the only other path being a dead trap — it runs the launcher loc_6e86
and then the per-record driver loc_6edb. loc_6e86 [code] paces itself on the delay word
INTRO_DELAY_CKSUM_WORD (0x8f48 [seen]); on each expiry it reloads that delay (0x2c or 0x20, chosen
by bit 1 of LAUNCH_SEQ_COUNTER (0x8f49 [code])), pulls the next byte from the launch script pointer
LAUNCH_SCRIPT_PTR (0x8f4a [seen]) — a 0xff byte ending the script for the frame — and reads that
byte as a one-based index into ENEMY_ACTOR_TABLE. If any of the three projectile slots
PROJECTILE_SLOT_STATE (0x8bea [code]) is free it arms the selected record (state 0x06), points it at
its animation SPAWN_ANIM_TABLE_396A (0x396a [code]), launches it through the shared projectile
allocator (loc_3a6c [code]), and bumps LAUNCH_SEQ_COUNTER; if every slot is busy it backs the
script pointer up one byte so the same entry is retried next frame. loc_6edb [code] then sweeps the
enemy-actor records each frame and, once the script has terminated and all three projectile slots are
idle, advances the intro phase and clears the target records — which is what ends the sequence.

## Rendering, HUD and display lists

Everything the player sees is assembled into three regions of the machine's address space and
handed to the video hardware. Two of them are parallel tile planes exactly 0x400 apart: the colour
RAM at 0x8000-0x83FF holds one attribute byte per screen cell, and the video RAM at 0x8400-0x87FF
holds the tile code for that same cell, so a cell at video-RAM offset X is coloured by the byte at
X-0x400. The third is the moving-object world: a work-RAM sprite display list that is rebuilt every
frame and copied out to the hardware sprite banks. Sitting between the game logic and these planes is
a small deferred-command ring, through which almost every subsystem asks for a rendering or spawn
action to be carried out later by the main loop. The HUD is not special hardware — it is ordinary
tiles painted into the two planes by a handful of BCD-to-digit primitives shared across the score,
round, stage and gauge fields.

Confidence tags are given inline at first mention: `[seen]` marks a cell whose role is grounded
against the observed RAM/VRAM trajectory, `[code]` a role established from behaviour with that
grounding still pending. The routines in this subsystem carry `[code]`; many of the cells they read
and write are `[seen]`.

### Clearing and filling the tile plane

A board starts by blanking the tile-code plane one row at a time under a small two-cell state:
`TILE_FILL_PTR` `[seen]` is a 16-bit write cursor into video RAM and `FILL_ROW_COUNTER` `[seen]` is a
down-counter of rows left to clear. `seedTileFillCursor` arms the pass — it stores the caller's video
pointer into `TILE_FILL_PTR` and seeds `FILL_ROW_COUNTER` to 0x20 (thirty-two rows), the row count it
also hands back so the caller can kick its watchdog. The fill itself is driven a row per call by
`loc_02ce` and its board-init sibling `loc_02c9`. Each blanks a run of cells at the cursor with the
blank tile 0x10, then advances the cursor by exactly one 0x20-wide row regardless of how many cells
were painted (the visible run plus the short row remainder), stores it back, and decrements
`FILL_ROW_COUNTER`; the routine reports, through the zero flag, whether the counter has drained, and
the driver keeps calling until it has. `loc_02c9` does the extra board-init work of zeroing the
sprite and actor RAM regions (via `loc_02b9`) before it blanks its row, and it clears a fixed visible
width of 0x1d cells. Underneath both sits `loc_0010`, the generic run-fill: it stamps a constant into
`count` consecutive bytes and leaves the advanced pointer behind (a zero count means a full 256-byte
run, the natural wrap of the underlying loop), so it doubles as both a tile-plane eraser and a
trailing-cell blanker for the HUD fields below.

### Painting the colour/attribute plane

The colour plane is flooded column by column by `fillAttributeColumns`, which walks 31 columns out
from `ATTRIB_MAP_BASE` `[seen]` (0x8040, the base of the tile-attribute map on the colour page). For
each column it takes one source byte and stamps it down all thirty rows at the 0x20 row stride, then
steps the source pointer one byte along — so a whole vertical strip of the screen takes a single
colour. The one value it hands back is the loop's terminal count 0x1f, which a caller stores verbatim
into a scratch cell; it carries no display meaning.

Larger set-pieces that need both planes stamped together go through the column blitter `loc_0cf8`. It
reads a source table of twelve-byte columns and writes each one *bottom-up* — stride -0x20, one video
row up per byte — into the tile-code plane starting at `COLUMN_BLIT_TILE_DEST` `[code]` (0x86a7),
drawing tile codes from `COLUMN_BLIT_TILE_SRC` `[code]`. After each column it reads a one-byte
steering marker: 0xff means "switch to the other plane", so it re-points its source to
`COLUMN_BLIT_ATTR_SRC` `[code]` and its destination to `COLUMN_BLIT_ATTR_DEST` `[code]` (0x82a7, the
colour-plane twin of the tile destination, exactly 0x400 lower) and keeps going; 0xee ends the stamp;
anything else is the first byte of the next column, one cell to the right. So a single call paints an
arbitrary shape's tile codes and then its colours, driven entirely by the interleaved data.

### The shared tile and glyph blitters

A family of small leaves does the actual byte-copying into the planes, and every higher-level painter
is built out of them. `blit2x2TileBlock` copies four source bytes into a 2x2 video square in the order
top-left, top-right, bottom-right, bottom-left (offsets +0, +1, +0x21, +0x20) and returns the
destination advanced to the bottom-left cell so a caller can step one row up before the next block —
this is the workhorse behind the animated status field below. `paintTileBlock2x2` and
`paintTileBlock2x2Above` are the tilemap-anchored variants, one anchored at the top-left and one at
the bottom-left with its top row a tilemap row above the anchor. `blitTile3x3Block` stamps a
three-wide, three-tall block, copying three source bytes per row and stepping the destination down a
full screen row (three written plus 0x1d) between rows; it advances *both* its destination (by 0x60)
and its source (by 9), because a chained caller stamps the next block straight from the advanced
source. `blitGlyphBlock4x3` is the four-row, three-column glyph stamper used for the HUD text blocks:
each row copies three bytes advancing only the destination's low byte (the row stays inside its
tilemap page), then steps +0x1d to the next row origin, and it too advances both pointers (destination
+0x80, source +12) so a caller can blank the trailing cells right after.

Two more leaves fill out the set. `copyBiasedTileString` copies a byte string into a destination
buffer adding a fixed tile bias of 0x08 to every byte — reindexing character codes into display-tile
codes — until it hits the 0xa0 end-of-string sentinel, which it does not store. `paintColumnBodyTiles`
and `paintColumnBodyTilesUp` stamp the lower two tiles of a three-tile vertical column (the mid tile
0x25 then the base tile 0x20), one stepping down by a caller-supplied stride and one stepping up by a
fixed -0x20; `blankTileColumn` erases a scrolled three-cell column back to the blank tile 0x10.
`loc_1ffb` picks between two fixed 3x3 glyph sources — `GLYPH_TILES_A` `[code]` when bit 5 of its
selector is clear, `GLYPH_TILES_B` `[code]` when set — and delegates the stamp to `blitTile3x3Block`,
landing it at `GLYPH_BLOCK_DEST` `[code]` (0x8062, on the colour page). The small word-table lookup
`loc_0c45` — double the index, add the base, read the little-endian word there — is the indirection
every table-driven painter uses to turn a phase, stage, or round index into a source-table pointer.

### The sprite display list

Moving objects are drawn from a 24-entry, stride-4 sprite display list based at `SPRITE_DISPLAY_LIST`
`[seen]` (0x8840), whose first byte is the leading sprite's Y and which is rebuilt from scratch every
frame. `loc_02ef` does the rebuild: it copies four record groups into the list in turn — the two lead
actors, the two enemy-target records, the eighteen moving-object records (with coordinate math applied
by `loc_0343`), and the two arrow/launch records — then nudges the arrow group's two sprite-Y bytes
down a pixel and falls into the shared display tail. The per-group copy is `copyObjectRecordsToDisplay-
List`: for each record it emits bytes +0x06, +0x10, +0x04, +0x0f into four successive list slots (the
list's low byte advancing alone so writes wrap within its page), steps the record pointer by the
record stride, and hands back the advanced list pointer so the next group chains on without reloading.
The stride-4 slots the list is composed of are named `SPRITE_ACTOR_RECORD_SLOTS` `[seen]` (0x8848, the
actively-rewritten actor records) and `SPRITE_TARGET_SLOTS` `[seen]` (0x887c, the coordinate/collision
target slots).

The player is drawn as three sprites stacked vertically, and `deriveStackedSpriteYs` fans the single
player-actor base Y — `PLAYER_Y` `[seen]` (0x8a84), the vertical position the enemy AI also targets —
out into three of the actor-table slots: the bottom slot gets the base Y, the middle slot gets Y-0x10,
and the top slot Y-0x10+0x0a, so the three sprites sit stacked with the right small overlap.

Flip-screen support lives in the shared tail `loc_0320`: it ticks a caller-supplied per-frame counter,
then consults `FLIP_SCREEN_FLAG` `[seen]` (0x881f, the orientation latch, nonzero for normal upright
play). While the screen is upright nothing more happens; once it reads zero — the screen flipped —
`mirrorSpriteListVertically` rewrites the whole 24-entry list in place, negating and offsetting each
entry's two coordinate bytes (-coord - 0x10) and toggling the two flip bits in each attribute byte
while preserving its low nibble. Alongside the list, `loc_0714` is the sprite-attribute copy loop that
marshals four bytes per pass into the attribute area and a position cursor, walking its source low byte
so it wraps inside its page and threading the advanced cursors and last byte back to its caller.

### The deferred-command ring and its interpreter

Rather than paint or spawn on the spot, most subsystems post a request into a small ring buffer that
the main loop drains. The ring is `DISPLAY_CMD_RING_BUFFER` `[code]` (0x88c0-0x88ff, sixty-four
one-byte slots holding thirty-two two-byte commands), with a write cursor `DISPLAY_CMD_RING_WRITE_PTR`
`[code]` (0x88a0) and a read/dispatch cursor `DISPLAY_CMD_RING_READ_PTR` `[code]` (0x88a1); both
low-byte cursors walk 0xc0..0xff and wrap back to 0xc0, and boot fills the buffer with 0xff to mark
every slot empty. The high bit of a slot is the free/occupied marker.

Posting a command is `loc_0038`: if the slot under the write cursor is free (bit 7 set) it stores the
command's high byte there and its low byte in the next slot, advances the write cursor by two and
wraps it; if the slot is occupied the command is simply dropped. The drain happens in `mainLoop` (0x020f), which reads the
slot at the read cursor: if the high bit is set the ring is empty, so it runs the per-frame worker
`loc_0254` and comes back; otherwise it has a real command, so it frees the slot (writes 0xff), takes
the second byte as a parameter, advances the read cursor, and dispatches through a sixteen-entry
handler table at ROM 0x0242 indexed by (high byte × 2) & 0x1f, passing the parameter byte to the
handler, which returns back into the loop. In other words the command's high byte selects a handler
class and its low byte is that handler's argument.

The command vocabulary is the set of `DISPLAY_CMD_*` words, each a two-byte value posted through
`loc_0038`. The overwhelming majority are class 0x06 — `OBJECT_SPAWN_DISPLAY_CMD` `[code]` (0x0611),
`WAVE_SPAWN_DISPLAY_CMD_A` `[code]` (0x0625), the five `PROMOTE_DISPLAY_CMD_*` words `[code]`
(0x062b-0x062f), `SIREN_DISPLAY_CMD_A` `[code]` (0x060f), `FLIP_ANIM_DISPLAY_CMD` `[code]` (0x0612),
`PHASE1_COMPLETE_DISPLAY_CMD` `[code]` (0x0635) and `TARGET_MATCH_DISPLAY_CMD` `[code]` (0x0610) among
them — so class 0x06 acts as a general event dispatcher whose low byte is a sub-event id covering
spawns, siren cues, screen-flip animation and object promotion. A handful use other classes:
`COUNTDOWN_EXPIRE_DISPLAY_CMD` `[code]` (0x0312), `HUNTER_SPAWN_DISPLAY_CMD` `[code]` (0x0315) and
`OBJECT_ANIM_DISPLAY_CMD_BASE` `[code]` (0x030f) are class 0x03, and `DISPLAY_CMD_0200` `[code]`
(0x0200) is class 0x02. The HUD itself is one of the ring's clients: `tickHudRefresh` bumps
`HUD_REFRESH_TICK` `[code]` (0x8f4d) each frame and, on every sixteen-frame boundary, posts a class-0x06
display-refresh command (argument 0xb5 or 0x35 depending on the counter's bit 4).

### HUD number primitives

The HUD's numbers all come from a few conversion-and-paint leaves. `binToPackedBcd` counts a binary
value up in BCD, returning the low two decimal digits packed into a byte and a separate hundreds tally
— a zero input means a full 256 passes (the loop is exit-tested), yielding 0x56 with a hundreds count
of 2. `byteToPackedBcd` converts a byte to its packed-BCD form modulo 100 the way the Z80 does it, one
decimal-adjust step at a time, and hands back just the packed result. Painting is done by three
routines that share a leading-zero convention. `splitBcdByte` writes a packed byte's low nibble as a
tile at the cursor, advances the cursor, and returns the high nibble together with a "high nibble is
zero" signal for leading-zero suppression. `drawStackedBcdDigits` paints a packed byte as two stacked
tiles — tens at the cursor, units one tilemap row above it (toward lower addresses) — blanking a zero
tens digit to the blank tile 0x10 rather than drawing "0". `renderDigitWithBlanking` paints a single
digit under a *blank budget*: a real (non-zero) digit stores as-is and ends the leading-blank run,
while a zero stores the blank tile as long as the budget lasts and a genuine "0" only once the budget
is spent; it threads the advanced cursor and the remaining budget out so a caller can walk the digits
of a multi-cell field.

### Score, high-score and panel fields

The three running totals — the two players' scores and the high score — are three-byte packed-BCD
counters painted down fixed video-RAM columns. `loc_056b` selects by an index: 0 picks
`P1_SCORE_BCD` `[seen]` (0x88a2) drawn at `P1_SCORE_VRAM` `[code]` (0x8781), 1 picks `P2_SCORE_BCD`
`[seen]` (0x88a5) at `P2_SCORE_VRAM` `[code]`, and anything else the high score at `HIGH_SCORE_VRAM`
`[code]`, reading down from the counter's most-significant byte (`HIGH_SCORE_BCD_HI` `[seen]`, 0x88aa,
the byte a new score is compared against most-significant-first). Each of the three bytes is split into
its high then low digit and painted one cell up the column through `renderDigitWithBlanking`, sharing a
single blank budget of four so the leading zeros of the six-digit field are suppressed until a real
digit appears. `loc_0552` is the reset-and-repaint twin: it zeroes the selected counter first, so its
first four digits paint as blanks and the last two as zeros.

The status panel is painted from a table by `renderPanelFromTable`: it walks ten rows of three cells,
reading tile codes from `PANEL_TILE_SOURCE` `[code]` (0x8e00, a work-RAM table) into
`PANEL_VRAM_DEST` `[seen]` (0x8567), substituting the blank tile 0x40 for any zero source cell. Within
a row the first two cells climb one video row (stride -0x20) and the third re-bases forward to the next
column (+0x42), tracing the panel's L-shaped layout. The bonus/award intermission uses the same digit
primitives through `loc_10c2`, which walks a counter toward a new value, stores it, and repaints a
three-field BCD display — field 1 drawn as double the counter, field 2 drawn raw when it is a single
digit or re-encoded to packed BCD otherwise, and field 3 (present only when its source is nonzero)
drawn doubled with its hundreds digit mirrored out — using `binToPackedBcd` and `drawStackedBcdDigits`
against the `SUBSTATE_FIELD*` cells before advancing the sub-state and queuing a sound cue.

The phase gauge is a five-cell vertical bar drawn by `renderPhaseGauge`, with an identical second ROM
copy `paintPhaseGauge` reached from another call site. It reads `GAUGE_PHASE_COUNTER` `[seen]` (0x8908):
a zero count leaves the gauge untouched, otherwise (count - 1) cells clamped to five are drawn with the
filled tile 0xb0 from `PHASE_GAUGE_BASE_TILE` `[seen]` (0x863f) upward, one tilemap row per cell, and
the cells above them are drawn with the blank tile 0x10 — so the bar rises and falls with the counter.

### Stage label, round number and status readouts

The stage countdown is shown as a small HUD number by `renderStageCountdownDigits`, which reads
`STAGE_COUNTDOWN` `[seen]` (0x8901) and writes its units nibble to `HUD_STAGE_DIGIT_LO` `[seen]`
(0x8743) and, unless it is a leading zero, its tens nibble one tilemap row over. A value below ten is
drawn as a single digit as-is; ten or more is converted to packed BCD first, and that two-digit path is
gated so it draws nothing while `PLAY_MODE_LATCH` `[code]` (0x8f50) is held.

The round-number-and-stage-label header exists as three closely related variants that differ only in
how they decide whether and which label to draw. All three, once they commit, do the same thing: on the
first stage (label column zero) they render the round number by counting `ROUND_COUNTER` `[seen]`
(0x8907) plus one up in BCD, selecting one of two glyph banks — `ROUND_DIGIT_GLYPHS` `[code]` (0x1fda)
or `ROUND_DIGIT_GLYPHS_ALT` `[code]` (0x1fe6) — by the tens bit of that BCD value, blitting it with
`blitGlyphBlock4x3` into `HUD_ROUND_TILE` `[code]` (0x8722, on the tile-code plane), blanking three
trailing cells with `loc_0010`, and mirroring `STAGE_COUNTDOWN` into `HUD_STAGE_DIGIT_LO`; then, on
every path, they draw the fixed stage label by looking the label pointer up in `STAGE_LABEL_PTR_TABLE`
`[code]` (0x1fa3) and blitting it to `HUD_STAGE_LABEL_TILE` `[code]` (0x8322, the colour-plane cell for
that field). `refreshRoundStageHud` is the per-frame form: it holds off entirely while any of the seven
`INTEGRITY_FLAG_SCAN_BASE` `[code]` (0x89e7) slots is armed, then derives the countdown's tens digit and
draws the round number only when that tens digit is zero. `drawStageLabelOncePerLevel` is the
once-per-level form: it returns immediately once `LEVEL_TAG_DONE_LATCH` `[code]` (0x8d56) is set, treats
a stage index below ten as column zero (arming the latch), and otherwise matches the index against the
five-entry `STAGE_TAG_COLUMN_TABLE` `[code]` (0x1f87), drawing nothing on a miss. `loc_1f40` is the
table-scan form: it scans a caller-supplied table for a target value and uses the matched slot as the
label column, rendering the round number only when the match lands at slot zero.

The one-time round HUD setup is `paintRoundNumberHud`, which runs only on a round's first pass, while
`TAMPER_FREEZE_FLAG` `[code]` (0x881e) is clear. It copies a 0x10-terminated attribute field from
`ROUND_HUD_FIELD_SRC` `[code]` (0x1ea7) bottom-up into the reset attribute column at
`RESET_ATTR_COLUMN` `[code]` (0x855f), BCD-converts the round plus one and paints its two digits into
`HUD_ROUND_DIGIT_HI` `[code]` / `HUD_ROUND_DIGIT_LO` `[code]` (0x849f / 0x847f, blanking a leading
zero), stamps the round glyph blocks — the tens bit picking a source word from
`ROUND_GLYPH_WORD_TABLE` `[code]` (0x200d) that `blitTile3x3Block` lays at `ROUND_TILE_DST` `[code]`
(0x8462) and whose advanced source `blitGlyphBlock4x3` continues into `HUD_ROUND_TILE` — stashes the
low digit into `ROUND_BCD_LOW_STASH` `[code]` (0x8483), and renders the selector glyph via `loc_1ffb`.
Whether or not the setup ran, it then falls into the per-frame chain of `refreshRoundStageHud` followed
by `renderStageCountdownDigits`.

Finally, the animated status readout is a two-stage tick. `loc_23a1` decrements a mod-8 ring counter
`STATUS_RENDER_RING` `[code]` (0x88bd); while it stays nonzero the display simply holds, and only on a
wrap does it borrow one from the mod-4 phase counter `STATUS_RENDER_PHASE` `[code]` (0x88bc) and fall
into the shared render tail `loc_23ad`. That tail masks the phase to 0..3, looks up a tile-block
descriptor for the phase from `STATUS_RENDER_TILE_TABLE` `[code]` (0x26f6), and stamps three 2x2 blocks
two video rows apart from `STATUS_RENDER_VRAM_BASE` `[code]` (0x8425), with the third block alternating
between `STATUS_FIELD_TILE_A` `[code]` (0x270a) and `STATUS_FIELD_TILE_B` `[code]` (0x270e) on the
phase's low bit — cycling the status field's appearance a step at a time on a slow, ring-gated cadence.

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
pushed through the gated append. This is the shared tail most run-producing emitters delegate
to rather than emitting a lone command — though not all: queueSoundRun28 [code] inlines the
same four-byte shape (0x28, 0x15, 0x16, 0x17) through four direct gated appends instead of
calling this helper.

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
  queueSoundCommands96And97And18And15 [code] drop several constants in order. One of these
  mixes doors within a single wrapper — queueSoundCommands96And97And18And15 appends two bytes
  through the gated path and then enqueues two more through the raw path; the other three keep
  to one door throughout.

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

Because the pump takes one byte per invocation, it must be called steadily. During normal
gameplay it runs from the vblank/interrupt service each frame; it is also drained by the
level-intro phase-1 per-frame body runLevelIntroPhase1Frame [code] as the last of its nine
sub-passes, but that second drain fires only during that intro phase. Either way, a
multi-byte sequence queued in one instant trickles out over successive frames.

### Reaching the sound latch

The final hand-off is sendSoundCommand [code], the single point where the main CPU touches
the audio hardware. It writes the command byte to SOUND_COMMAND_LATCH [seen] (0xa100), then
strobes AUDIO_IRQ_LATCH [seen] (0xa181) high and immediately back low. That rising edge
interrupts the audio CPU, which reads the latched byte and produces the sound. The strobe's
pulse is just a fixed timing gap with no state behind it, so it collapses to the back-to-back
high/low write. Both the drain path and emitPresetSound funnel through this one routine, so
every sound the machine makes — queued or immediate — leaves through this latch-and-strobe.

## Anti-tamper

Woven through the machine's ordinary gameplay code is a family of ROM- and signature-integrity
guards. Each one folds a small checksum over a fixed region of the program image and compares the
result against a sentinel that was baked into an intact ROM. None of them halts the machine on a bad
result. Instead a failing guard records its displeasure in a dedicated tally cell, and other
routines — spawners, the actor driver, the HUD painter, the joystick sampler — consult those cells
and quietly degrade what they do. The effect is a machine that keeps running on a tampered image but
stops spawning enemies, stops updating actors, stops reading the stick, and stops redrawing the HUD,
so an altered ROM plays as a dead, frozen board rather than announcing itself with a crash.

Two shapes of tally carry the verdicts. A handful of **freeze flags** are the loud ones: a nonzero
value in any of them is read live, the same frame, to suppress an activity. Behind them sits a
quieter **bank of strike counters**, all clustered in one integrity-flag block, each owned by a
single guard and bumped only when that guard's region fails to match. On an intact image every one of
these RAM tallies sits statically at zero — nothing in normal play ever writes them — which is why
they carry the `[code]` grounding tag: their zero-ness is inferred from the guard bodies, not yet
watched drifting under the real hardware. The checksum *bases* and *sentinels* the guards read are
fixed ROM addresses and likewise `[code]`, except the program-signature sample region and its
reference table, which are `[seen]`.

### The freeze flags

`TAMPER_FREEZE_FLAG` `[code]` is the central one. Three guards bump it — the checksum tripwire
in `loc_1b43`, the actor-spawn integrity guard in `loc_5594`, and the round-5 guard
`flagTamperOnRound5ChecksumMiss` — and three consumers read it. `loc_241e`, the per-frame driver for
the lead actor group, runs its three fixed sub-passes and then, if the flag is set, returns without
dispatching the lead actor record's state through the shared state-handler table, so the whole lead
group stops advancing. `loc_6e75`, the phase-1 spawner gate, runs its single-object launcher and
per-record driver only when the flag (and the signature flag below) are clear; its set-flag branch is
not a graceful skip but a dead trap — a jump into data, reachable only on a tampered image and modeled
as unreachable. And `paintRoundNumberHud` treats a set
flag as "not the first frame of the round": it skips the one-time round-number build entirely and runs
only the per-frame update chain, so a tampered image never repaints its round HUD.

`SIGNATURE_MISMATCH_FLAG` `[code]` is the spawn-side freeze. It is raised by the program-signature
check `verifyRomSignature` and by the actor-handler checksum in `loc_3865`. `loc_6e75` folds it
together with the freeze flag when deciding whether to spawn, and `loc_6523`, which seats a fresh
object record and enqueues its spawn display command, bails out the moment it finds this flag held —
so, like the freeze flag, it strangles new spawns.

`TAMPER_OBJECT_FREEZE_FLAG` `[code]` freezes the player. Each frame `loc_1e55` samples the joystick
into the player-actor state byte; if this flag (or the board-clear flag) is set it instead zeroes that
state byte and returns, so a tampered image ignores the stick.

`TAMPER_ROM_CHECK_FLAG` `[code]` is the verdict cell of the shared table-checksum helper described
next.

### The checksum guards

The guards vary in what they fold and where they store the verdict, but all share the pattern of
summing a fixed region and testing the total against a constant.

The **program-signature check** `verifyRomSignature` walks the 16-byte `SIGNATURE_REFERENCE_TABLE`
`[seen]` against every eighth byte of the sampled code region beginning at `SIGNATURE_SAMPLE_BASE`
`[seen]` (reference advances by one, sample by eight). On the first byte that differs it raises
`SIGNATURE_MISMATCH_FLAG` and stops; a clean sweep leaves the flag untouched.

The **actor state-4 signature check** lives inside `loc_2a79`. Before it does any of its state-handler
work it compares 0x68 bytes of a fixed program window at `STATE4_SIGCHECK_CODE_BASE_ADDR` `[code]`,
read upward, against a stored reference block at `STATE5_SIGCHECK_REF_TOP` `[code]`, also read upward.
A single mismatched byte transfers control into the state-1 handler `loc_29a0` — a tamper re-entry
rather than a tally bump. Only on a byte-perfect match does `loc_2a79` reseat the record's frame-hold,
clear its flip bit, and advance its state.

The **state-10 ROM checksum** `verifyRomChecksum` sums sixteen read-only program bytes descending from
`ROM_CHECKSUM_TOP` `[code]` into a single byte and then reads that byte's shape: a healthy image has
bit 0 clear and bits 5 and 7 set. Any other shape bumps `TAMPER_STRIKES_STATE10` `[code]`.

The **shared table-checksum tripwire** `verifyTableChecksum` is the reusable one: given a base, a byte
count, and a running low/high seed, it accumulates a 16-bit sum (each 8-bit carry rolling into the
high byte) and declares the region intact only when the sum lands at high 0x1d, low 0xc1; any other
total raises `TAMPER_ROM_CHECK_FLAG`. Its caller `loc_5835`, which spawns the singleton special actor,
tail-runs it over 0x52 bytes from `CHECKSUM_ROM_BASE` `[code]` as the last step of seeding that actor.

The **actor-spawn integrity guard** is embedded in `loc_5594`, one of two sibling spawn tails that
scan an actor-block table for the first free slot and seed it. At the free slot, before seeding,
`loc_5594` runs an eight-byte self-check: it adds each byte of the region at
`INTEGRITY_GUARD_REGION_0BAD` `[code]` to the matching byte of its two's-complement signature at
`INTEGRITY_GUARD_SIGNATURE_55B5` `[code]`; an intact pair sums to zero, and any nonzero result bumps
`TAMPER_FREEZE_FLAG`. Its sibling `loc_5544` performs the identical free-slot scan and seed but carries
no such check — only the `loc_5594` variant is a tamper tripwire.

The **catch-handler checksum** rides inside `loc_3f7c`, the object state-15 (catch) handler. On the
handler's special-path branch, after zeroing and repainting the stage countdown, it folds bytes
downward from `CATCH_TAMPER_CKSUM_TOP` `[code]` to a 0xc8 terminator, counting how many 8-bit carries
occur; the image is intact only when `(0xc8 - carries)` equals 0xc0, and any other result sets
`TAMPER_STRIKES_CATCH` `[code]`.

The **actor-handler checksum** rides inside `loc_3865`. After running its animation and timer work,
and only once the record pointer has reached the object-table band and the global frame gate is open,
it folds a program block downward from `ACTOR_TAMPER_CKSUM_TOP` `[code]` to a 0x1a terminator as a
wrapping 8-bit sum with a separate carry tally; if the combined result keeps any of the masked bits
(mask 0x9e) it bumps `SIGNATURE_MISMATCH_FLAG`, tying this actor-frame guard back into the spawn
freeze.

The **checksum tripwire** in `loc_1b43` (a play-state/round-transition handler) folds a 34-byte program block based at
`TAMPER_CKSUM_BASE_5593` `[code]` into a rolling checksum; a result other than 0x7c bumps
`TAMPER_FREEZE_FLAG`.

Finally, `flagTamperOnRound5ChecksumMiss` is armed only when `ROUND_COUNTER` reads 5. On that round it
sums six program bytes into a low sum plus a carry count; an intact image is tuned so that low sum,
carry count, and a 0x7f bias wrap exactly to zero, and any nonzero total bumps `TAMPER_FREEZE_FLAG`.
On every other round it touches nothing.

### The strike-counter bank

Where the freeze flags gate behaviour directly, the strike counters are a spread of one-byte tallies,
most of them packed into the integrity-flag block anchored at `INTEGRITY_FLAG_SCAN_BASE` `[code]`.
Each counter belongs to exactly one guard and is bumped only by that guard: `TAMPER_STRIKES_SLOTSWEEP`
`[code]` and `TAMPER_STRIKES_ROM` `[code]` for the slot-sweep and periodic-ROM guards,
`TAMPER_STRIKES_OBJMOVE` `[code]` and `TAMPER_STRIKES_OBJSIG` `[code]` for the object-move and
object-signature guards, `TAMPER_STRIKES_CATCH` `[code]` for the catch handler above,
`TAMPER_STRIKES_STATE0` `[code]` and `TAMPER_STRIKES_STATE10` `[code]` for the state-0 and state-10
code-window guards, `TAMPER_STRIKES_SIG` `[code]` for the frame-crossing signature checksum,
`TAMPER_STRIKES_HUD_GUARD` `[code]` for the credit-draw tripwire, and `TAMPER_STRIKES_TERMINATOR`
`[code]` for the terminator match-scan guard. Like the freeze flags they read out live: the
lead-actor state-0 handler `loc_2442` returns immediately, idling the record, while either
`TAMPER_STRIKES_SLOTSWEEP` or `TAMPER_STRIKES_ROM` is nonzero, and only advances the lead actor once
both read clear.

### What a nonzero tally does

Pulled together, the guards all feed one of three outcomes, and every outcome is a *withdrawal* of a
normal per-frame activity rather than an alarm:

- **Freeze spawns.** A set `TAMPER_FREEZE_FLAG` or `SIGNATURE_MISMATCH_FLAG` makes the fresh-record
  seater `loc_6523` bail before it can seat and enqueue a new object, so no new enemies appear; the
  phase-1 spawner gate `loc_6e75` instead guards its launcher behind a dead trap (a jump into data,
  unreachable with a valid ROM).

- **Abort actor updates.** A set `TAMPER_FREEZE_FLAG` makes the lead-actor driver `loc_241e` skip its
  state dispatch, a set slot-sweep or ROM strike makes the lead-actor state-0 handler `loc_2442` idle,
  and a set `TAMPER_OBJECT_FREEZE_FLAG` makes the joystick sampler `loc_1e55` zero the player-actor
  state byte — so the actors stop advancing and the player stops responding.

- **Skip the HUD.** A set `TAMPER_FREEZE_FLAG` makes `paintRoundNumberHud` skip its one-time
  round-number build, so a tampered image never (re)paints its round HUD.

## Open questions

These are the readings the code fixes but MAME has not yet confirmed, plus the paths no capture has exercised. Each is a work item for a following grounding pass.

- **Sound byte-to-effect map.** The page-0x8a sound-command FIFO is [seen] as a FIFO that reaches the audio CPU, but which specific sound each command byte (0x00..0x28, and the high-bit bytes 0x82/0x95/0x96/0x97) selects is [code]/[guess] — it needs an audio-side grounding pass that watches the audio CPU, not just the latch.
- **Foreground scroll worker 0x0254.** Whether it does load-bearing drawing during live play or is an attract/idle task is unsettled; its gating control byte 0x883f is [code]-only and its scroll-column duties overlap the vblank NMI's own column rebuild (0x0714).
- **Coin path beyond slot 1.** Slot 2 bumps a pulse counter at 0x8826 but only slot 1's counter (0x8824) has a wired coin-meter strobe, so whether 0x8826 drives a second physical meter is unconfirmed; and the third acceptor (input bit 2, flat +1 credit, no coinage or meter) is unlabelled as service-credit vs a third coin slot.
- **Phase-gauge cell 0x8908 dual use.** It is [seen] draining 3→0 as a phase gauge, yet another routine bumps the same cell saturating on a bonus-award threshold no golden reached; the two uses need a scoring-active capture to reconcile.
- **The six-slot object-state array 0x8ba0.** Its arm/advance/draw/integrity four-way machine and the per-pool overloading of the shared 0x18-byte record fields are [code]-only — no golden exercised a full cycle.
- **Formation / band-build / intro-launch.** The formation-spawn timer (0x8d30) and the band-build arm latch (0x8f63) are static-0 in every golden, so those paths — including the rope-extend tamper-strike branch and the formation phase-handler table at 0x30eb — are [code]-only, unconfirmed by MAME.
- **Display-command ring drain.** The ring cells are [code], never watched transitioning in a golden, and the display-command handler table's per-type mapping is not enumerated, so which screen region each command word repaints is inferred from the enqueue sites rather than confirmed by watching the ring drain.
