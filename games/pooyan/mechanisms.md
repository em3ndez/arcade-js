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

Everything Pooyan does happens inside a single 64 KB Z80 address space, but only a
narrow band of it is mutable. The lower half, `0x0000`–`0x7FFF`, is the 32 KB program
ROM and never changes. Immediately above it sit the five RAM regions that together are
the machine's entire observable state — two video planes, a 2 KB block of work RAM,
and two sprite banks — followed by a window of memory-mapped hardware devices. Any
access that falls outside a mapped region is a hard fault: reads and writes to
unmapped addresses throw rather than floating a plausible value, so a stray pointer
surfaces as an error instead of quietly corrupting the picture. This section describes
that memory model and the state cells that live in the work-RAM band, then shows how
the per-frame dispatch reads those cells to decide what to do each frame.

### The address map

Above the ROM, the regions follow in a fixed order:

- **Colour RAM** at `0x8000`–`0x83FF` (1 KB) and **video RAM** at `0x8400`–`0x87FF`
  (1 KB) — the two tilemap planes, described below.
- **Work RAM** at `0x8800`–`0x8FFF` (2 KB) — all game state: the dispatch selectors,
  counters, tables, rings, per-player banks, and the CPU stack.
- **Sprite banks** at `0x9000`–`0x90FF` and `0x9400`–`0x94FF` (256 bytes each) —
  the moving-object attribute memory the display hardware reads.
- The **hardware I/O window** from `0xA000` up — dip switches, input ports, the
  watchdog, the sound port, and the LS259 control latch.

These five RAM regions — colour, video, work, and the two sprite banks — are exactly
what constitutes a snapshot of the running machine; concatenated in that order they
form the state image that is diffed to prove the port matches the original hardware.

### The two video planes

The picture is built from a 32×32 grid of 8×8 tiles laid over two parallel planes that
share the same cell index. Video RAM holds the **tile code** for each cell — which of
the 256 decoded 8×8 characters to draw — and colour RAM holds that cell's **attribute
byte**. The attribute is not itself a colour: its low nibble selects one of sixteen
palette groups for the cell, its bit 6 mirrors the tile horizontally, and its bit 7
mirrors it vertically. Tiles are four bits per pixel, and the tilemap is a single
opaque layer: every cell is painted, pen 0 included, so there is no transparency
within the background and no priority split — sprites are simply drawn on top
afterward. The visible raster is a native, unrotated 256×224 buffer — landscape as the
tile hardware addresses it — with the 32-row grid's native rows 16 through 239 forming
the output; the cabinet monitor is turned 90 degrees so the picture reads as a portrait,
but that rotation is a display-time transform applied after this raster. There is no separate
video-enable control, so the planes are always live; the only global geometry toggle is
the screen-flip flag discussed with the I/O latch below, which mirrors both the cell
addressing and each tile's own flip bits.

### The sprite banks

Moving objects are described by the two 256-byte sprite banks rather than by the
tilemap. The two banks hold complementary halves of each sprite record at the *same*
offset: bank 0 carries the sprite's screen X in its even byte and its tile code in the
odd byte, while bank 1 carries the control byte — palette group in the low nibble, an
(active-low) horizontal-flip bit, and a vertical-flip bit — in its even byte and the Y
position, stored as `240 − y`, in the odd byte. The renderer walks the records from the
lowest active offset upward, so when two sprites overlap the one at the higher offset
wins. These banks are not written directly by the game logic; they are refreshed
wholesale every frame from a display list held in work RAM (see the dispatch section),
which is what keeps the two split halves consistent.

### The hardware I/O window

From `0xA000` up, the same address can name two different devices depending on whether
it is read or written. Reads return the configuration and input hardware: DSW1 at
`0xA000`, the three input ports IN0/IN1/IN2 at `0xA080`/`0xA0A0`/`0xA0C0`, and DSW0 at
`0xA0E0`. All three input ports are active-low, reading `0xFF` when nothing is pressed.
Writes reach the machine's control hardware: a write to `0xA000` kicks the watchdog, a
write to `0xA100` hands a byte to the sound hardware, and the eight addresses
`0xA180`–`0xA187` are a single addressable latch, one bit per address. That latch holds
the small set of board-wide toggles: bit 0 is the vblank-interrupt enable, bit 1 and
bit 2 drive the sound hardware's interrupt and mute lines, bits 3 and 4 pulse the two
coin counters, bit 5 is an unused payout line, and bit 7 (stored inverted) is the
screen-flip control. There is deliberately no video-enable bit here.

The interrupt-enable bit is the hinge the whole frame loop turns on: the display
hardware raises a non-maskable interrupt once per vertical blank, but only while that
latch bit is set. Clearing it suppresses the interrupt, which is exactly how the
per-frame service routine protects itself while it runs.

### The shape of work RAM

The 2 KB of work RAM at `0x8800`–`0x8FFF` is where all game state lives, and it is
organized into recognizable zones. Its very top doubles as the CPU stack: the boot
code sets the stack pointer to `0x9000` and pushes downward from there, so the highest
work-RAM addresses (`BOOT_STACK_TOP` [code] at the top of the region, with the ROM
self-test's pass tally `ROM_SELFTEST_TALLY` [code] alongside it) sit at the base of
the descending stack. Everything below is organized state.

**Configuration decoded once at boot.** A cluster of cells near the base of work RAM
caches the operator settings so the running game never has to re-read the dip-switch
ports. From DSW1 come the bonus/extra-life schedule selector `BONUS_AWARD_DSW` [code],
the starting-lives count `LIVES_DSW` [code], the three-bit difficulty index
`DIFFICULTY_DSW` [code], the demo-sounds flag `DEMO_SOUNDS_DSW` [code], and the
cabinet-type flag `CABINET_MODE_FLAG` [code]; from DSW0 come the two coinage
descriptors `COINAGE_CONFIG` [seen] and `COINAGE_CONFIG_SLOT2` [code]. The boot entry
also writes the very first work-RAM cell (`BONUS_AWARD_DSW`) as it clears state and runs
its ROM checksum, and thereafter difficulty and bonus values are read from these mirrors
by the spawn and credit logic rather than from the hardware.

**Coins and credits.** `CREDIT_COUNT` [seen] is a BCD credit tally that a coin insert
increments and a game start consumes. It is fed by coin-slot pulse machinery — the
per-slot pulse counters such as `COIN1_PULSE_COUNT` [seen] — that debounces the raw
coin lines against the configured coinage before crediting.

**Input sampling.** `INPUT_PORT0` [seen] heads a short ring at `0x8810`–`0x8812` holding
one inverted sample of each of the three input ports. Each frame the service routine
shifts the previous samples down into companion cells and writes fresh (complemented)
readings of IN0, IN1, and IN2 into the ring, so the game can detect the *edge* of a
button press — coin, one- and two-player start, and the directional/fire inputs — rather
than just its steady level.

**The screen build and its cursors.** When a board is being drawn in, `FILL_ROW_COUNTER`
[seen] counts the remaining rows and `TILE_FILL_PTR` [seen] is the video-RAM write cursor
that marches forward one row (`0x20` cells) at a time; the counter reaching zero ends
the fill and lets the state advance.

**The sprite display list.** `SPRITE_DISPLAY_LIST` [seen] is the work-RAM staging area,
in stride-4 records, that is expanded into the hardware sprite banks each frame. Within
it, `SPRITE_ACTOR_RECORD_SLOTS` [seen] are the actively rewritten actor records and
`SPRITE_TARGET_SLOTS` [seen] are the coordinate slots scanned for collisions against
other objects.

**Scores.** The two players' running scores are BCD triples at `P1_SCORE_BCD` [seen] and
`P2_SCORE_BCD` [seen]; the all-time best is a BCD triple whose most-significant byte is
`HIGH_SCORE_BCD_HI` [seen] (with the low bytes at `HIGH_SCORE_BCD` [code]), compared
most-significant-byte-first when a game ends. The `HIGH_SCORE_TABLE` [code] region holds
the ranked initials-and-score entries.

**Rings for asynchronous work.** Two producer/consumer rings decouple the game logic
from the hardware it drives. The display-command ring — write cursor
`DISPLAY_CMD_RING_WRITE_PTR` [code], read cursor `DISPLAY_CMD_RING_READ_PTR` [code], and
the buffer `DISPLAY_CMD_RING_BUFFER` [code] occupying the top of the `0x88` page from
`0x88C0` to `0x88FF` — lets any routine queue a screen-drawing request that the
foreground loop drains later. The sound ring (`SOUND_RING_WRITE_PTR` [code],
`SOUND_RING_READ_PTR` [code], buffer `SOUND_RING_BUFFER` [code]) does the same for audio
commands headed to the sound port. A separate status-render pair, `STATUS_RENDER_PHASE`
[seen] and `STATUS_RENDER_RING` [seen], paces the periodic redraw of the HUD.

**The live gameplay page and the per-player banks.** The active round's actor and state
data occupies a page beginning at `SPEED_INDEX` [seen] (`0x8900`) — the enemy
speed/difficulty index is simply byte 0 of that page — and running through the round and
wave counters that follow it: `STAGE_COUNTDOWN` [seen], `ROUND_IN_PROGRESS` [seen],
`ROUND_COUNTER` [seen], and the spawn/wave bookkeeping around them. In a two-player game
this 0x3F-byte live page is treated as a swappable working copy: it is block-copied out
to whichever player's saved bank is inactive and the other player's bank is copied back
in on each turn change. The two banks are `PLAYER0_STATE_BANK` [seen] at `0x8940` and
`PLAYER1_STATE_BANK` [seen] at `0x8980` — spaced `0x40` apart in memory but each a
`0x3F`-byte mirror of the live page, and
each player's remaining-lives count lives at the same offset within its bank
(`PLAYER0_LIVES` [seen], `PLAYER1_LIVES` [seen]). The per-player play timers sit nearby
at `PLAY_TIMER_BCD_P1` [code]. Which bank is live at any moment is governed by
`ACTIVE_PLAYER` [seen], and whether a swap is even possible by `TWO_PLAYER_FLAG` [seen].

**The object tables.** The upper reaches of work RAM, from roughly `0x8A80` onward, hold
the fixed-stride record tables the gameplay subsystems own: `ACTOR_TABLE` [seen] for the
player-side actors, `ENEMY_ACTOR_TABLE` [seen] for the enemies, `SPRITE_OBJECT_TABLE`
[seen] and the object-state records for dropped/hanging objects, and `PROJECTILE_TABLE`
[seen] for shots and arrows, each with its own per-record state bytes that the play
sub-handlers step. Their internals belong to those subsystems; here they matter only as
the region of work RAM the state model hands off to.

### The per-frame dispatch model

Two agents run every frame, and both are steered by a handful of the state cells above.

The heartbeat is the **vblank service routine** (`loc_066d`, reached through the
non-maskable interrupt vector). On entry it saves the full register file — main
registers, shadow set, and both index registers — and immediately clears the interrupt-
enable latch bit so it cannot re-enter itself. It then does the frame's fixed
housekeeping: it rebuilds the hardware sprite banks by expanding the work-RAM display
list into them (via the copy loop `loc_0714` [code], which streams four bytes per sprite
into the two banks at once), samples the three input ports into the edge-detect ring,
kicks the watchdog, and decrements the two per-frame counters `WORKER_CONTROL_BYTE`
[code] and `FRAME_COUNTER` [seen]. Only then does it consult the game's mode: it reads
the top-level selector `MAIN_GAME_STATE` [seen] and jumps through a five-entry table to
the matching per-frame handler — the attract, intro, and play modes each have their own.
When that handler returns, the epilogue copies `FLIP_SCREEN_FLAG` [seen] out to the
screen-flip latch bit, restores every saved register, sets the interrupt-enable bit
again, and returns to whatever the CPU was doing. `MAIN_GAME_STATE` is thus the single
switch that decides what the machine *is* on any given frame.

Running underneath the interrupt is the **foreground main loop** (`loc_020f` [code]).
Its job is to drain the display-command ring:
it reads the ring's read cursor `DISPLAY_CMD_RING_READ_PTR`, looks at the entry it points
to, and branches on that entry's top bit. When the slot is free (top bit set) it runs
the per-frame scroll/display worker (`loc_0254` [code]) — which repaints the scrolling
tile columns, gated by `GAME_ACTIVE_FLAG` [seen], `TWO_PLAYER_FLAG`, and `ACTIVE_PLAYER`,
or instead runs the program-signature check when `WORKER_CONTROL_BYTE`'s low nibble is
nonzero — and this ring-idle pass is the effective frame boundary. When the slot instead
holds a pending command, the loop consumes that two-byte entry (a handler index plus a
data byte), advances the read cursor within the `0x88C0`–`0x88FF` buffer, and dispatches
the command through its own handler table, then keeps draining. Draining the *whole* ring
within one frame — rather than one command per interrupt — is what keeps the playfield
from showing stale queued tiles.

Within the play mode, dispatch nests one level deeper. The play handler
(`runPlayStateFrame` [seen], the state-3 entry of the top-level table) first ticks the
BCD play-timer, then reads the in-play sub-state selector `PLAY_STATE_INDEX` [seen],
masks it to five bits, and (through the sub-dispatcher `loc_15a1`) jumps through a second
table to the sub-handler for the current phase — board build, the level-intro phases, active play, round-end
teardown, and so on — with the return seated so control flows back out to the interrupt
epilogue afterward. Timing between these phases is carried by `PHASE_TIMER` [seen], a
countdown the sub-handlers decrement each frame and reload to schedule the next
transition. So the state model is a three-tier cascade: `MAIN_GAME_STATE` chooses the
mode each frame, `PLAY_STATE_INDEX` chooses the phase within play, and the phase handlers
in turn step the per-record state bytes in the actor, enemy, object, and rope tables. A
handful of guard flags cut across all of it — `GAME_ACTIVE_FLAG` gates the in-play work,
and `TAMPER_FREEZE_FLAG` [code], bumped by the ROM and signature checksum guards, freezes
spawns and aborts actor updates if the program image fails to verify.

## The frame loop and the vblank heartbeat

Two control flows run the machine, and the whole rhythm of the game emerges from how they interleave. One is a background loop that never stops turning; the other is a vblank interrupt that fires sixty times a second and does the real structural work of a frame. The interrupt is the heartbeat: the free-running loop between beats only consumes what the last beat produced. Understanding this producer/consumer split is the key to everything else, because almost every other subsystem is reached, once per frame, from inside that interrupt.

### Reset and arming the heartbeat

The machine comes up with its heartbeat deliberately stilled. The reset vector, `loc_0000` ([code]), does exactly one thing before handing off: it writes zero to `NMI_ENABLE_LATCH` ([code], the LS259 bit that gates the vblank NMI), so no interrupt can fire, and then tails into the boot entry `loc_0092` ([code]).

The heavy part of boot runs with that interrupt still masked, and the masking matters — a vblank landing in the middle of that work would service against half-built RAM. `loc_0092` sets the stack to the top of work RAM, checksums the eight program-ROM banks against an in-ROM reference table (tallying passes), clears the work-RAM pages, seeds the HUD tile and attribute maps, and decodes the DIP switches into the cabinet, coinage, difficulty, and lives settings the rest of the game reads. It primes the display-command ring's pointers, floods colour RAM, and sets the screen-orientation flag to its upright value. Near the end of boot it writes one to `NMI_ENABLE_LATCH` — arming the heartbeat — then seeds a last few RAM cells before falling into the main loop at `loc_020f`. That arming is the birth of the running machine: from the next vblank onward, frames are being serviced, and the game is live before it has drawn anything a player would recognize.

### The free-running main loop

The main loop, `mainLoop` at `loc_020f` ([code]), is the background consumer, and its whole job is to drain the display-command ring and keep the scrolling columns painted. It carries no wait for vblank of its own — its cadence is imposed entirely from outside, by the interrupt. Each turn it reads the ring's read cursor, `DISPLAY_CMD_RING_READ_PTR` ([code]), which walks the two-byte slots of the ring buffer living high in page `0x88`, and inspects the slot it points at. The high bit of that slot is the signal: when it is set the ring is idle — there is no pending command — and the loop instead runs the per-frame scroll worker `loc_0254` ([code]), which either repaints the scrolling tile columns or — when the worker control byte's low nibble is nonzero — runs the program-signature integrity check instead. That ring-idle turn is the natural quiet point of a frame, reached once the loop has caught up with all the work the last interrupt queued.

When the slot's high bit is instead clear, a command is waiting. The loop frees the slot, advances the read cursor (wrapping it back to the ring's start when it runs off the end), pulls the command's handler address out of the dispatch table, and jumps to that handler, which paints its piece of the screen and returns to the top of the loop. The loop keeps pulling commands this way until the ring runs dry, so the entire ring is drained within a single frame — the same all-at-once flush the real hardware performs each vblank — rather than dribbling out one command per beat and leaving stale tiles behind. The commands themselves are deposited by the rest of the game through the enqueue helper `loc_0038` ([code]), which appends a two-byte command at the write cursor `DISPLAY_CMD_RING_WRITE_PTR` ([code]); the producers of that stream are the per-frame state handlers that the interrupt dispatches, so the ring is exactly the channel through which the heartbeat hands drawing work to the background loop.

### The vblank interrupt: one beat of work

The heartbeat itself enters at `loc_0066`, a bare jump into the service routine `loc_066d`. That routine is where a frame's structural work actually happens, and it runs to a fixed shape every beat. It first saves the entire register file — main set, shadow set, and both index registers — because it has interrupted the main loop at an arbitrary point and must leave no trace. It masks its own source by clearing `NMI_ENABLE_LATCH`, so a second vblank cannot re-enter it mid-service.

It then stages this frame's sprites, copying the sprite display list (`SPRITE_DISPLAY_LIST`, [seen]) into the two hardware sprite banks (`SPRITE0_CLEAR_BASE` and `SPRITE1_CLEAR_BASE`, [code]) through the sprite-attribute copy loop `loc_0714` ([code]), and how many record groups it copies depends on where the game is: it reads `PLAY_STATE_INDEX` ([seen]) and, in the one sub-state whose value is four, copies the full set of groups, otherwise a single taller group. It kicks the watchdog, then rolls the input subsystem forward: it samples the three hardware controller/coin ports, inverting each active-low reading, into a short history ring whose head is `INPUT_PORT0` ([seen]), keeping a two-frame record so later code can tell a fresh button press from a held one. It ticks the two per-frame counters that pace the rest of the game — the worker control byte (`WORKER_CONTROL_BYTE`, [code]) and the free-running frame counter `FRAME_COUNTER` ([seen]), whose low bits phase animation and whose zero-crossings gate the integrity guards. It services coin and credit accounting through `serviceCoinCreditAndCountersUnlessFreePlay` ([code]) and releases one queued sound to the audio processor via `drainSoundCommandRing` ([seen]). Only then does it dispatch the frame's game logic.

When that logic returns, the epilogue winds everything back: it copies the screen-orientation flag `FLIP_SCREEN_FLAG` ([seen]) into the hardware `FLIP_SCREEN_LATCH` ([code], bit 7), restores every saved register in reverse, re-arms the interrupt by writing one back to `NMI_ENABLE_LATCH`, and returns to whatever point in the main loop it interrupted. The background loop resumes exactly where it left off, now with a fresh batch of display commands to drain and freshly sampled input for the next beat to act on.

### The once-per-frame state branch

The one decision that gives each beat its meaning is the main-state dispatch. Near the end of its work the interrupt reads `MAIN_GAME_STATE` ([seen]) — the top-level selector that says whether the machine is in attract, coming up through the board-build and intro sequence, or in live play — and uses it to index a five-entry handler table. State 0 runs the attract state-0 handler `loc_072d` ([code]); state 1 runs the attract/demo sequence driver `dispatchAttractSubstate` ([seen]); state 2 runs the board-build dispatcher `dispatchBoardBuildSubstate` ([seen]); state 3 runs the play-frame handler `runPlayStateFrame` ([seen]); and state 4 runs `noopStateHandler` ([code]), a bare return that draws nothing. Whichever handler is chosen runs entirely inside the interrupt and returns to the epilogue, so the whole of a frame's game behavior — advancing the attract reel, laying out a board, or stepping a round of play — is one branch taken once per beat. That branch is also where most of the display commands for the coming frame are queued, closing the loop: the heartbeat decides what should happen and enqueues the drawing, and the free-running main loop, between beats, makes it appear on screen.

## Configuration, coinage and players

Everything the operator sets on the two DIP-switch banks, everything the coin door
does, and everything that distinguishes a one-player game from a two-player game
flows through a small cluster of work-RAM cells that are seeded once at power-on and
then read (never rewritten from the switches) for the rest of the machine's life.
This section follows that data from the switch ports, through coin acceptance and
credit accrual, into the act of starting a game, and finally into the per-player
score/lives/state banks and the way the machine alternates between two players.

### Power-on: reading the DIP switches into config cells

The boot entry `loc_0092` [code] runs the program-memory self-test, wipes work RAM,
arms the display and sound rings, and then — the part that matters here — samples the
two hardware DIP-switch ports and decodes them into the config cells the rest of the
game consults. The two banks are decoded differently: bank 1 is read active-low, so the boot
complements it before pulling its fields out, while bank 0 is read raw and its two nibbles
index the coinage table directly.

Bank 1 is read from `DSW1_PORT` [code] (0xa000) and unpacked field by field by rotating
the complemented byte and masking one field at a time:

- `CABINET_MODE_FLAG` [code] — the cocktail/upright selector (DSW1 bit 2, complemented).
  A one-bit boolean read later by round-init to decide whether the picture flips between
  players.
- `BONUS_AWARD_DSW` [code] — DSW1 bit 3, complemented. Selects the extra-life award
  schedule; its two settings later drive an award-queue reload of 5 versus 3 and a BCD
  step of 8 versus 7.
- `DIFFICULTY_DSW` [code] — the three-bit difficulty field (DSW1 bits 4-6, complemented).
  Beyond difficulty proper it is the only writer of this cell, and it feeds the enemy
  spawn schedules discussed below.
- `DEMO_SOUNDS_DSW` [code] — DSW1 bit 7, complemented. Enables attract-mode ("demo")
  sounds and gates queued sound dispatch while the game sits idle.
- `LIVES_DSW` [code] — the two low bits of bank 1 pick the starting life count. Settings
  0, 1 and 2 store 3, 4 and 5 lives respectively; the fourth setting stores 0xff.

Bank 0 is read from `DSW0_PORT` [code] (0xa0e0) and carries coinage. Its two nibbles are
each passed through the ROM coinage lookup `COINAGE_TABLE` [code] (0x0053) and stored: the
high nibble becomes `COINAGE_CONFIG_SLOT2` [code] and the low nibble becomes
`COINAGE_CONFIG` [seen]. Each resulting byte is a packed coinage descriptor whose high
nibble sets how many coins make a credit-group and whose low nibble sets how many credits
that group awards; the sentinel value 0x0f means free play. Because these cells are set
once at boot and only read thereafter, they are static in normal play — hence most of the
config cluster is grounded only at the `[code]` level, with `COINAGE_CONFIG` reaching
`[seen]` because the boot write of the default 1-coin/1-credit value is observable.

The same boot pass lays down the default high-score table, silences the audio CPU, and
enables the per-frame vblank interrupt, but those belong to other subsystems.

### Cabinet orientation

The machine is a vertical cabinet presented at MAME `ROT90` — the manifest fixes the raw
screen as 256x224 rotated 90 degrees. On top of that fixed physical rotation the game
carries a runtime flip: `FLIP_SCREEN_FLAG` [seen] (0x881f) is initialised to 1 (upright)
at boot and copied every frame into bit 7 of the hardware flip latch `FLIP_SCREEN_LATCH`
[code] (0xa187); the flag also gates the software vertical-mirror pass, which runs only
when it is clear. `CABINET_MODE_FLAG` [code] ties orientation to the cocktail setting: in
round-init (`loc_1601` [code]), when this flag reads as a cocktail cabinet the flip flag is
derived from the active-player index, so the display turns over for the second player's
turn; on an upright cabinet the flag leaves orientation alone and the picture stays upright
for both players.

### Coin acceptance and credit accrual

Coin service runs once per frame through `serviceCoinCreditAndCountersUnlessFreePlay`
[code]. Its first act is a free-play gate: if either coinage descriptor holds the 0x0f
sentinel the whole chain returns immediately and no coins are read, no credits accrue, and
the coin counters never strobe. Otherwise it runs three coin-input steps, then the counter-1
pulse generator, the periodic anti-tamper check, and the counter-2 pulse generator — the
anti-tamper check falls between the two coin-counter strobes, not before both.

Each of the three coin-input steps watches one bit of the inverted coin/start sample
`INPUT_PORT0` [seen] (0x8810) and debounces it through its own one-byte ring, acting only
when the ring's low three bits settle on the fire phase (a clean, single edge):

- `accrueCreditFromCoin1Pulse` [seen] watches coin-slot-1 (input bit 0) through
  `DRIP_RING_C` [code]. On a clean pulse it emits the coin sound, bumps the queued
  coin-counter-1 pulse count `COIN1_PULSE_COUNT` [seen], and advances the slot-1 coinage
  accumulator by 0x10, comparing it against `COINAGE_CONFIG` [seen]. When the accumulator
  overtakes the descriptor it wraps back and awards credits — the descriptor's low nibble
  many, or a full 0x63 when that nibble is 0x0f. (The slot-1 accumulator byte lives in the
  cell `TAMPER_ROM_CHECK_FLAG` [code] at 0x882b, which this coinage path uses as its coord
  byte; the cell is multiplexed with an unrelated checksum role.)
- `accrueCreditsFromCoinSlot2` [code] is the slot-2 twin: it watches coin-slot-2 (input
  bit 1) through `DRIP_RING_B` [code], bumps `COIN2_PULSE_COUNT` [code], and advances the
  coord pair at `DRIP_COORD_B` [code] against `COINAGE_CONFIG_SLOT2` [code] with the same
  wrap-and-award logic.
- `loc_5a06` [code] watches the service switch (input bit 2) through `DRIP_RING_A` [code];
  it carries no coinage ratio, adding one credit directly on each clean pulse — a service
  credit.

All three converge on the shared accumulate tail. `addCreditsAndQueueDisplay` [seen] adds
the awarded amount to the running credit total `CREDIT_COUNT` [seen] (0x8802), clamps the
stored byte at 0x63, and queues the HUD refresh via `queueCreditDisplayRefresh` [code]; the
full-wrap case routes through `addFullWrapCreditAmount` [code], which merely seeds the
amount 0x63 before falling into that same tail. The credit total is BCD, capped at 0x63,
and drawn as the two HUD digits at `CREDIT_HUD_UNITS_VRAM` [code] and
`CREDIT_HUD_TENS_VRAM` [code] (the tens cell written only when its nibble is nonzero). A
coin insertion is thus visible as `COIN1_PULSE_COUNT` ticking up and, once the ratio is
met, `CREDIT_COUNT` incrementing.

### The physical coin counters

The queued pulse counts are turned into timed strobes on the electromechanical coin
counters by two structurally identical generators, `loc_5a9c` [code] (counter 1) and
`pulseCoinCounter2Latch` [code] (counter 2). With no pulses queued each returns. On a fresh
pulse it seeds a phase timer to 0x30 and raises its latch bit — `COIN1_COUNTER_LATCH` [code]
(0xa183, LS259 bit 3) or `COIN2_COUNTER_LATCH` [code] (0xa184, LS259 bit 4). While counting
it steps the phase timer (`COIN1_PULSE_PHASE` [code] / `COIN2_PULSE_PHASE` [code]) down,
drops the latch at phase 0x18, and retires one queued pulse when the phase reaches zero.
The result is one clean electromechanical count per accepted coin.

### Starting a game and consuming credits

Two paths reach the start of a game, and both begin by requiring a waiting credit unless
free play is set.

In attract, the shared epilogue `advanceGameStateOnCreditOrStartPress` [seen] runs the
coin/credit gate: when coinage is not free play, a nonzero `CREDIT_COUNT` advances the
top-level state `MAIN_GAME_STATE` [seen] and resets the play sub-state `PLAY_STATE_INDEX`
[seen] — nudging the machine out of attract toward the start screens. Under free play there
are no credits to wait on, so the same routine instead reads the start bits of
`INPUT_PORT0` directly and routes 1P-start into the single-player builder or 2P-start into
`beginTwoPlayerStartOfLife` [code].

The button-driven path is `startGameOnStartButtonPress` [seen]: it bails while
`CREDIT_COUNT` is zero, folds the gauge-phase counter with the life count of the bank the
active-player flag selects and bails if that is nonzero (a game is already in progress),
and only then — with the 1P/2P start bits of `INPUT_PORT0` set — enqueues the start sound
and continues into `startSelectedPlayerGameConsumingCredits` [code]. That routine reads the
edge bits: 1P-start (bit 3) hands off to `startOnePlayerGameOnCredit` [seen]; 2P-start
(bit 4) consumes two credits (returning if fewer than two are banked), runs an integrity
checksum over `CREDIT_CHECKSUM_TABLE` [code] that bumps `CREDIT_TAMPER_COUNTER` [code] on a
bad fold, and then enters the two-player start-of-life. `startOnePlayerGameOnCredit` spends
a single credit and starts a fresh single-player game.

Both start branches funnel into `startNewGamePlay` [seen], the start-of-life setup. It
records the active-player word — its low byte into `ACTIVE_PLAYER` [seen], its high byte
into `TWO_PLAYER_FLAG` [seen] — so a 1P start seats player index 0 with the two-player flag
clear and a 2P start (seeded via `beginTwoPlayerStartOfLife`) seats the flag. It then runs
the pre-play credit-display setup, sets the in-play gate `GAME_ACTIVE_FLAG` [seen], drives
`MAIN_GAME_STATE` to its in-play value, clears `PLAY_STATE_INDEX`, forces the flip flag to
upright, resets the actor tables for a fresh board, and enqueues the start-of-life sound.
On a two-player game it also enqueues the second-player sound variant and clears a small
panel block. The credit-display step it calls, `queueCreditDisplayCommands` [code], also
enqueues an extra free-play banner command when the coinage descriptor holds the free-play
sentinel.

### Per-player score, lives and turn alternation

The machine keeps a complete duplicate set of state for each of two players and switches
between them by re-pointing at the appropriate bank.

Lives are seeded from the cabinet at board reset: `resetActorStateForBoard` [seen] copies
`LIVES_DSW` into both `PLAYER0_LIVES` [seen] (0x8948) and `PLAYER1_LIVES` [seen] (0x8988),
and (config-adjacent) seeds each player's saved bank with a fixed opening X and a sprite
colour taken from `DIFFICULTY_DSW`. Each life count drains on death and gates the
player-switch and game-over logic.

Scores live in two three-byte BCD buffers, `P1_SCORE_BCD` [seen] (0x88a2) and `P2_SCORE_BCD`
[seen] (0x88a5); `selectActivePlayerScoreBuffer` [code] hands out a pointer to whichever the
active-player flag selects (bit 0 clear -> player 1, set -> player 2).

The full live actor/state page (based at `SPEED_INDEX` [seen], 0x8900) is what a player
actually plays with; each player also owns a 0x3f-byte saved bank —
`PLAYER0_STATE_BANK` [seen] (0x8940) and `PLAYER1_STATE_BANK` [seen] (0x8980). `ACTIVE_PLAYER`
[seen] (0x880d) selects between them: zero picks player 0's banks, nonzero picks player 1's;
`TWO_PLAYER_FLAG` [seen] (0x880e) marks the game as two-player and thereby enables the whole
alternation.

Alternation happens on death. `saveLivePageToPlayer0Bank` [seen] snapshots the live page into
player 0's saved bank — always that bank — and, in a two-player game with the other player
still alive, latches the active-player flag to player 1; `saveLiveStateToPlayerBank` [code]
snapshots the live page into the active player's saved bank (player 0's unless the
active-player flag is set) but leaves that flag untouched. Round-init `loc_1601` [code]
performs the reverse — it restores the
newly-selected player's saved bank back into the live page — so the incoming player resumes
exactly where they left off. `reseedOtherPlayerForTurn` [code] handles the turn hand-off
itself: with the other player out of lives it delegates to the game-over/continue teardown,
otherwise it zero-fills the outgoing bank and marks player 1 active for the reseed. When
the credit gate is finally closed and no player remains, `resetGameToAttractState` [seen]
tears the game down back to the attract loop.

### Config-adjacent scheduling cells

Two boot-decoded config cells reach beyond their immediate subsystems. `DIFFICULTY_DSW`
scales the enemy spawn schedules — it is read by the interval-based spawners and indexes
difficulty tables such as `ACTOR_ATTR_BASE_TABLE` [code], which is looked up at
2*`DIFFICULTY_DSW` plus the clamped round counter — so the operator's difficulty switch
directly sets how aggressively enemies appear as rounds progress. `BONUS_AWARD_DSW` selects
the award schedule whose pending score threshold is held in `AWARD_QUEUE` [code] and is
advanced by a hardcoded BCD step (8 or 7 per the switch), not from any table. When the active
player's score MSB reaches the queued threshold, the tally bumps the saturating phase-gauge
counter `GAUGE_PHASE_COUNTER` [seen] and appends a sound; the switch name's "extra-life"
reading is `[code]`/unobservable and remains unconfirmed. Both are static config in normal
play, hence grounded at the `[code]` level.

## In-play progression and timers

Once a game is running, one top-level state governs the whole of play, and beneath it a small
sub-state machine walks a single round from its blank-screen build, through the enemy-wave setup,
into live gameplay, and out the far side into the round-clear, player-swap, and continue logic. The
progression cells that this machine reads and writes live in a compact block at the top of work RAM
(the `0x8900` page), and each player keeps a private copy of that block so a two-player game can hand
the machine back and forth without either player losing their place. Layered on top are two kinds of
timer: short per-frame countdowns that pace the sub-state transitions, and a pair of long BCD wall
clocks that run for the duration of a life.

### The per-frame play loop and its sub-state selector

The top-level selector `MAIN_GAME_STATE` [seen] chooses between attract, the round intro, and play;
while it holds the play value, `runPlayStateFrame` [seen] runs once per frame. It does two things in
order. First it ticks the active player's BCD play clock (see *The BCD play timers* below). Then it
reads `PLAY_STATE_INDEX` [seen], masks it to its low five bits, and jumps to the handler sitting at
that slot of the in-play handler table at `0x15a8`. That table's twelve identified slots, in index
order, are `loc_1601` [code], `selectRoundDisplayListAndAdvancePhase` [seen], `startRoundAfterIntroDelay`
[seen], `spawnEnemyWave` [seen], `runActiveGameplayFrame` [code], `advancePhaseGaugeCountdown`
[seen], `loc_1b43` [code], `saveLivePageToPlayer0Bank` [seen],
`advancePlayStateAndStageHighScoreEntryOnTimer` [seen], `loc_1c53` [code],
`dispatchRoundEndElseWipeColumn` [seen], and `loc_71b9`; the machine reaches higher index values too,
which is why several handlers latch indices such as `0x0c`, `0x0e`, `0x0f`, `0x10`, and `0x12` rather
than simply incrementing.

The essential discipline is that each handler runs exactly one frame of its own phase and then, when
that phase is finished, writes the index of the *next* phase into `PLAY_STATE_INDEX` so the following
frame lands on a different handler. A handler that is not yet finished simply returns, leaving the
index untouched, so the same handler runs again next frame — this is how the machine "waits" on a
timer or an event without spinning. After the selected handler returns,
`resetToBoardBuildToContinuePlay` [seen] runs as the loop's tail: while the game is still active it
does nothing, but once a life or the whole game has ended (the in-play gate `GAME_ACTIVE_FLAG` [seen]
cleared) it drops `MAIN_GAME_STATE` back to the board-build state with `PLAY_STATE_INDEX` reset to 0,
so the machine rebuilds the board for the next life or bows out to attract.

### Building a round: the setup phases

The first four handlers turn a blank screen into a populated playfield. `loc_1601` [code] is the
round-init phase: it stalls, returning each frame, until the row-by-row tilemap fill drains
(`FILL_ROW_COUNTER` [seen] reaching its end), and only then clears the actor arena and the round-init
RAM. It seeds `PHASE_TIMER` [seen] — the general-purpose per-frame countdown that gates most of the
setup transitions — to a short value for a one-player round or a long value on the first entry of a
two-player round, advances the sub-state index by one, and, crucially, restores the active player's
saved state block into the live progression block (the bank-to-live copy described below). It also
derives `ROPE_SEGMENT_COUNT` from `WAVE_ARRIVAL_COUNTER` [seen] and copies the round's message string
into the display buffer.

`selectRoundDisplayListAndAdvancePhase` [seen] is a pure `PHASE_TIMER` gate: it decrements the timer
every frame and returns until it hits zero, at which point it chooses a graphic/layout display-list
pair from a decision tree keyed on `PLAY_MODE_LATCH` [code], `ROUND_IN_PROGRESS` [seen],
`GAME_ACTIVE_FLAG` [seen], and `ROUND_COUNTER` [seen], seeds the enemy-spawn timer, and bumps the
sub-state index (or, when the play-mode latch's low bit is set, forces the index to `0x10`).

`startRoundAfterIntroDelay` [seen] paints the display list each frame and then waits on two nested
gates before it will proceed: `SUBPHASE_TICK` [seen], a counter that wraps every `0x1c` frames, and a
one-shot that must be armed on one wrap and cleared on the next. Only past both does it pick an
action from the same latch/flag/round quartet: either arm a later sub-state, or run the level-start
batch — HUD setup, the phase gauge, per-actor timer seeds, the enemy-spawn driver, and a sprite
rebuild — while raising `ROUND_IN_PROGRESS` [seen], seating `WAVE_ARRIVAL_COUNTER` to 2, and forcing
the play index to the wave-spawn phase.

`spawnEnemyWave` [seen] seeds four actor records from a per-round seed table (selected by
`PLAY_MODE_LATCH` and `ROUND_COUNTER` parity) and then forks: the zero-latch path either arms a later
sub-state or bumps the index and copies the intro string into the display buffer, while the nonzero
path fans out a whole enemy sprite group whose size scales from `ROUND_COUNTER` (its bit 1 gates the
fan-out) and arms sub-state `0x0f`.

### Active gameplay and the progression drivers

The live game runs under `runActiveGameplayFrame` [code], a coordinator that calls fourteen
per-frame sub-passes in fixed order — enemy spawns, the enemy / formation / object state dispatchers,
the actor update pipeline, sprite rebuilds, and the stage-label paint — and marshals nothing between
them, since each sub-pass reads its own state from RAM. This handler does not itself advance
`PLAY_STATE_INDEX`; the transition out of live play is driven by the sub-passes.

Three of those sub-passes are the progression engine. `loc_191c` selects the enemy speed value for a
new target group: it runs only while `STAGE_COUNTDOWN` [seen] and the lead-actor state are idle and
no enemy slot is busy, and when it fires it bumps `PLAY_STATE_INDEX`, computes a value from
`DIFFICULTY_DSW` plus a round-derived term (`ROUND_COUNTER` halved and added to
`WAVE_ARRIVAL_COUNTER` on even rounds), clamps it below `0x20`, and stores it in `SPEED_INDEX`
[seen]. `loc_196e` is the gated periodic driver: it reads `SPAWN_PHASE_COUNTER` [seen] as a mode
selector (exactly 5 arms the warning siren, above 5 latches a higher mode) and runs a shared event
countdown that periodically raises the wave-event latch and fires the siren run. And `loc_18da` is
the bonus-award tally: it services `AWARD_QUEUE` [code], the pending BCD award threshold — an empty
queue reloads its slot (5 or 3 depending on `BONUS_AWARD_DSW`), and otherwise, once the active
player's score high byte reaches the queued threshold, it bumps the saturating `GAUGE_PHASE_COUNTER`
[seen], BCD-steps the queue to its next threshold (by 8 or 7), and redraws the gauge.

### Leaving a round: phase-out, player switch, and continue

Past live play the machine runs a chain of teardown and transition handlers.
`advancePhaseGaugeCountdown` [seen] handles the phase-gauge stage: while `PLAY_MODE_LATCH` is set it
tails into the gameplay-arming handler, otherwise it runs the board-reset pair and, with the credit
gate (`GAME_ACTIVE_FLAG`) open, drains `GAUGE_PHASE_COUNTER` [seen] one step; on reaching zero it
tails into the phase-exhausted handler `loc_1a96`, and otherwise seeds `PLAY_STATE_INDEX` to `0x0a`
or `0x0b` depending on `ACTIVE_PLAYER` [seen]. A closed credit gate here drops the machine all the
way back to attract.

`loc_1b43` [code] and its sibling `loc_1b8c` [code] are transition handlers that wait for the tilemap
clear to drain, flood the attribute columns, enqueue display commands, latch the play index to
`0x0c`, and reload or clear `PHASE_TIMER`; `loc_1b43` additionally folds a program-memory checksum
and bumps an anti-tamper tally on a mismatch. `advancePlayStateAndStageHighScoreEntryOnTimer` [seen]
is another `PHASE_TIMER`-gated step: on expiry it advances the index and, when a high-score insert
rank is pending, stages the high-score-entry column. `loc_1c53` [code] is a light per-frame object
driver split on `ROUND_COUNTER` parity, and `loc_71b9` is a nested phase dispatcher for the
bonus/eagle stage, keyed on its own selector.

The master of round-clear and player-swap is `dispatchRoundEndElseWipeColumn` [seen]. It ticks
`PHASE_TIMER` every frame; when a reset latch is armed and the timer has expired it stamps the reset
column, verifies an integrity checksum over a HUD strip (a byte sum that must equal a fixed magic
value) before it will re-init, disarms the latch, and then branches on `TWO_PLAYER_FLAG` [seen],
`ACTIVE_PLAYER`, and `PLAYER0_LIVES` [seen] into one of three tails: a full clear-and-continue, a
hand-over to the other player, or a swap back to player one. Until the reset fires, every eighth tick
it wipes a vertical VRAM column with an advancing fill tile — the between-rounds screen wipe. The
continue tail, `clearActorsAndEnterContinueState` [code], zero-fills the whole `0xbf` live page (the
`0x3f` block plus both player banks), and if any
credit remains it clears the in-play gate and returns the machine to the board-build/continue state;
with no credit it tears down cold to attract.

### The live progression block and the per-player state banks

The progression cells named above are not scattered — they form one contiguous `0x3f`-byte block at
the top of work RAM whose base byte is `SPEED_INDEX` [seen] (`0x8900`). This is the *live* copy,
belonging to whichever player is currently up. Each player also owns a saved copy of the identical
layout: `PLAYER0_STATE_BANK` [seen] (`0x8940`) and `PLAYER1_STATE_BANK` [seen] (`0x8980`). The
machine moves a whole round's worth of state between live and saved by block-copying the entire
block: `loc_1601` restores the active player's bank into the live block at round-init, while
`saveLivePageToPlayer0Bank` [seen] and `loc_1bcc` [code] snapshot the live block back to player one's
or player two's bank on a death or turn change (`saveLiveStateToPlayerBank` picks the destination
bank from `ACTIVE_PLAYER`). Because the copy is layout-preserving, every progression cell has a
per-player saved counterpart at the same offset inside each bank — so `SPEED_INDEX`,
`STAGE_COUNTDOWN`, `SPAWN_PHASE_COUNTER`, `WAVE_ARRIVAL_COUNTER`, `ROUND_IN_PROGRESS`, and
`ROUND_COUNTER` are all carried across a two-player alternation intact rather than reset each turn.

Within that block, the individual cells drive distinct parts of progression. `STAGE_COUNTDOWN` [seen]
(`0x8901`) is seeded to `0x20` and counts down across a stage; as it nears zero it gates actor AI,
and its initial value selects which stage label is drawn. `SPAWN_PHASE_COUNTER` [seen] (`0x8902`) is
the per-round step counter that cycles up to 7 and selects spawn/fire mode branches; when it reaches
its cap the board reset reseeds it (and the rope-draw count) to 4. `WAVE_ARRIVAL_COUNTER` [seen]
(`0x8903`) is bumped as enemies arrive and bounds the rope-segment count. `ROUND_IN_PROGRESS` [seen]
(`0x8904`) is the simple 0/1 flag that is 1 while a round is actually running and keys the
render/state decision trees used all through setup. `ROUND_COUNTER` [seen] (`0x8907`) is the round
number itself: incremented at each stage transition, BCD-rendered as the HUD round digits, with its
low bits indexing the difficulty tables, bit 0 selecting the stage-type/facing/rope variant, and bit
1 gating the enemy-group fan-out. The reseed handler `reseedSpawnCountersAndArmPlayMode` [code] is
where `ROUND_COUNTER` is bumped, `STAGE_COUNTDOWN` is re-seated (`0x30` from round two onward, else
`0x28`), and — off an even-frame, latch-clear path — the play-mode latch is armed for the next
sequence.

### Lives and the player-alternation gates

Each player's remaining lives live at offset 8 of that player's bank — `PLAYER0_LIVES` [seen]
(`0x8948`) and `PLAYER1_LIVES` [seen] (`0x8988`) — which is the same offset that
`GAUGE_PHASE_COUNTER` [seen] (`0x8908`) occupies in the live block. Both lives cells are seeded from
the lives cabinet switch by `resetActorStateForBoard`, which first clears the whole `0xbf` live page —
the `0x3f` block plus both player banks — and its loose flags at the start of a board, then re-seeds
each bank's lives, opening X, and colour after the wipe. Lives are the pivot of the end-of-life logic: `dispatchRoundEndElseWipeColumn`
and its `reseedOtherPlayerForTurn` [code] tail read `PLAYER0_LIVES` / `PLAYER1_LIVES` to decide
whether to hand the turn to the other player, reseed a fresh player, or, when the relevant count has
reached zero, fall through to the full clear-and-continue. `ACTIVE_PLAYER` [seen] (`0x880d`) selects
which bank is live and which lives/score buffers are read, and `TWO_PLAYER_FLAG` [seen] (`0x880e`)
gates whether the alternation happens at all; the swap tails flip `ACTIVE_PLAYER`, zero-fill the
outgoing player's bank, and reset `PLAY_STATE_INDEX` to 0 so the incoming player restarts at
round-init.

### The BCD play timers

Independent of the sub-state chain, `runPlayStateFrame` ticks a long-running clock at the top of every
play frame via `loc_7912`. It does nothing while `GAME_ACTIVE_FLAG` is clear, then selects the active
player's gate/timer pair by `ACTIVE_PLAYER`: `PLAY_TIMER_GATE_P1` [code] / `PLAY_TIMER_GATE_P2`
[code] and `PLAY_TIMER_BCD_P1` [code] / `PLAY_TIMER_BCD_P2` [code]. A set gate byte suppresses the
tick entirely — this is how the clock is frozen during non-counting stretches — and the gates are
cleared by `resetActorStateForBoard` at board start. Each timer is a three-byte bank: the base byte
is a frame sub-counter that rolls over at `0x3b` or `0x3c` (the extra frame chosen by bit 0 of the
seconds digit, so the clock stays honest against the ~60 Hz frame rate), and on that roll it carries
into a BCD seconds digit and then a BCD minutes digit: the seconds digit rolls its low nibble at
`0x0a` and its high nibble at `0x60` (carrying into minutes at 60), while the minutes digit rolls its
low nibble at `0x0a` into an uncapped high nibble. The result is a proper minutes:seconds wall clock kept per player, advanced
one frame at a time and paused by its gate.

## The actor arena

Almost everything that moves on screen — the player, the eagles and their young, the balloons and
wolves, the arrows and boulders, the intro formation — lives in a handful of parallel arrays of
fixed-size records. Each record is a 24-byte (0x18) block, and the arrays are laid end to end through
work RAM so that a single register stepping by 0x18 walks any one of them. The player and its immediate
followers occupy the front of `ACTOR_TABLE` [seen] at 0x8a80, with slot 0 being the lead/player actor;
the enemy records begin at `ENEMY_ACTOR_TABLE` [seen] (0x8ae0, the same arena continued 0x60 bytes in);
the per-frame object-state records live at `OBJECT_STATE_RECORD_BASE` [seen] (0x8ba0) and run straight
into `PROJECTILE_TABLE` [seen] (0x8be8); the formation that flies in at board start sits in
`FORMATION_TABLE` [seen] (0x8c30); a secondary pool of five slots is kept at `SPRITE_OBJECT_TABLE`
[seen] (0x8b70); and a two-entry pair of target records, `ENEMY_TARGET_REC0` [seen] (0x8c90) and
`ENEMY_TARGET_REC1` [seen] (0x8ca8), holds whatever the player's projectiles are currently checked
against.

The record layout is consistent enough across the arrays that the same handlers read the same offsets
regardless of which array a record belongs to. Byte +0x00 and byte +0x01 carry the record's
active/presence bits — a record is dead when the low bit of both is clear, and a scan for a free slot
looks for exactly that. Byte +0x02 is the state byte, and its low bits select which handler runs.
Bytes around +0x03..+0x05 hold sub-pixel position and the coordinate the sprite is drawn at (+0x04 is
the on-screen Y), +0x06 doubles as a phase or frame counter depending on the array, +0x07 carries
variant flags that steer which animation is armed, +0x09/+0x0a hold a step size and a signed velocity,
and +0x0b holds an arm bit consulted before a spawn. The three bytes +0x0c/+0x0d/+0x0e are the beating
heart of the animation system: +0x0c:+0x0d is a little-endian pointer into an animation script and
+0x0e is a frame-hold countdown. The bytes the renderer actually consumes are +0x0f (attribute/colour)
and +0x10 (tile code). Later fields (+0x11 a reload delay, +0x14 a slot id, +0x17 a spawn-kind
selector) matter only to particular subsystems.

### Sweeping the records each frame

Several drivers walk these arrays once per frame, and they share a common shape: point at a base,
set a stride of 0x18, set a count, and call a per-record handler in a loop. The object-record sweep at
`loc_76f4` runs six records from `OBJECT_STATE_RECORD_BASE` through `dispatchActiveObjectState` [seen].
That dispatcher first rejects any record whose +0x00/+0x01 active bits are both clear, and for a live
record it reads the state byte at +0x02, masks its low two bits, and hands off to one of four state
handlers — so the same record advances through a small state machine frame by frame with no work done
on the frames it is asleep. A second, structurally similar dispatcher, `loc_6a98` [code], services a
different object cluster: it treats a record as inactive when +0x01 is zero, and otherwise selects a
handler from a two-entry table using `(state − 1) & 3`, so its records effectively toggle between two
behaviours. The enemy-actor array has its own pair of sweeps, `dispatchAllEnemyActorStates` [seen]
walking the fourteen enemy records in order and `dispatchActiveEnemyActorState` [seen] deciding each
one's low-state handler; the four formation records are driven the same way by
`dispatchFormationObjectStates` [code].

Layered above these low-level state handlers is a richer per-record phase dispatcher rooted at
`loc_362d` [code], which reads the phase byte at +0x06 of the record it is pointed at and routes on its
value. Phases below 7 tail off to the early-phase guard `loc_361d` [code] (which bails when +0x08's
low bit is clear and otherwise tails to the end-of-move dispatch `finishActorOrArmTurnaround` [code]),
and phases of 0x14 and up tail off to the mirror-image late-phase guard `loc_3625` [code] (which bails
when +0x08's low bit is set, otherwise handing control to the movement path). The interesting middle band (phases 7 through 0x13) is where a spawn can happen: once
`WAVE_PROGRESS_COUNTER` [seen] (0x8d7d) has climbed to 0x0e or above, any phase below 0x13 returns early,
so late in a wave only phase 0x13 stays live; then a per-actor delay at `ACTOR_DELAY_COUNTER` [code]
(0x8d6b) counts down and the record does nothing until it drains. When the delay reaches zero, the routine reloads it from
`DELAY_RELOAD_TABLE_368E` [code] (0x368e) indexed by the low three bits of `ROUND_COUNTER` [seen]
(0x8907) — so higher rounds re-arm the delay to different cadences — and falls straight into the
pre-spawn logic. That whole family, together with the broader group dispatch anchored at
`ACTOR_GROUP_STATE_DISPATCH` [code] (0x2436), is how one record's timer expiring turns into a new actor
appearing.

### Stepping an animation

An actor's on-screen appearance is driven entirely by the +0x0c:+0x0d script pointer and the +0x0e
hold counter. Arming an animation is a leaf operation: `setActorAnimation` [seen] (and its twin
`storeActorAnimationPointer` [seen], which does the same for a record addressed differently) writes the
chosen script's address into +0x0c/+0x0d and zeroes the frame index at +0x0e, so the actor restarts its
new sequence from the top. Dozens of sites arm an animation this way, each loading the address of a
short ROM script — for example `ANIM_TABLE_3829` [code] for an actor's standard loop and its sibling
`ANIM_TABLE_3838` [code] for the descending object's animation, or the phase-selected pointers
`ANIM_PARAM_76D4`/`ANIM_PARAM_68EF`/`ANIM_PARAM_6B0A`
[code] used at spawn — and calling the setter.

Advancing an armed animation is the job of `advanceObjectAnimationFrame` [seen] (the routine at
loc_4006). It first checks the hold counter at +0x0e: while that is non-zero it simply decrements it and
returns, which is what makes a frame linger for several game frames. When the hold reaches zero it walks
the script the pointer addresses. A 0xff byte in the stream is a jump opcode — the next two bytes are
reloaded as the new pointer and reading continues from there, which is how a script loops back on
itself. Any other byte begins a three-byte frame record: the first byte becomes the tile at +0x10, the
second the attribute at +0x0f, and the third the new hold value at +0x0e, after which the advanced
pointer is written back to +0x0c/+0x0d. So each expiry of the hold advances exactly one frame and sets
up the dwell for the next.

Whole groups of actors are stepped together. `advanceActorAnimationsUnlessGrabbing` [code] runs the
animation stepper across four consecutive `ACTOR_TABLE` records (0x8a80, 0x8a98, 0x8ab0, 0x8ac8), but
only when `GRAB_ACTIVE_FLAG` [seen] (0x8d32) is clear — while a rope-grab is in progress the player's
animation is frozen so the grab pose holds.

A distinct, more elaborate animation walk drives the timed intro formation over the enemy-actor array.
`loc_7625` [code] seeds a count of eight and falls into the shared body `loc_7627` [code], which ticks
that many records at `ENEMY_ACTOR_TABLE` through a per-entry handler. Each entry is dispatched on the low
two bits of its state byte into one of three behaviours. In state 0 (`loc_7644`), while the entry is
active the routine steps its sprite frame via the animation stepper, advances its sub-position at +0x05
by the step at +0x09, and decrements the frame counter at +0x06 on each sub-position underflow; once
that counter falls below 6 the whole phase ends — it seeds the shared timer `SHARED_PHASE_COUNTDOWN`
[code] (0x892e) to 0x20, rewrites all fourteen
records' state bytes to 1, and aborts the rest of the walk so the transition takes effect atomically.
In state 1 (`loc_7675`) the routine steps frames and counts `SHARED_PHASE_COUNTDOWN` down; when it
expires it reseeds the eight enemy records to state 2, clears the six object records, clears
`SPAWN_RING_COUNTER` [code] (0x8d57), advances the sequence selector `ATTRACT_SUBSTATE` [seen] (0x8e51)
to 8, and again aborts the walk. In state 2 (`loc_76a6`) it simply holds while `OBJECT_DRAWN_FLAG`
[code] (0x8d58) is set and otherwise steps the frame. The net effect is a self-timing three-beat
sequence: the formation animates in, waits out a timer, and then flips the whole cast into the next
mode.

Separately from the sprite scripts, a strip of background tiles is animated in place. A cursor,
`TILE_ANIM_CURSOR` [seen] (0x88be), points into video RAM, and a parity counter, `TILE_ANIM_PARITY`
[seen] (0x8f37), is bumped every frame to alternate direction. On odd frames
`advanceTileAnimForwardOnOdd` [seen] marches the cursor forward, incrementing the tile code it points at
until it reaches 0x37, at which point it steps to the next cell and reseeds 0x34; on even frames
`retreatTileAnimScript` [seen] walks the same cursor back, reloading 0x10 and backing up when it finds
0x34. Cycling those tile codes (0x10/0x34/0x37) is what makes the strip appear to shimmer.

### Spawning new actors

New actors are introduced by scanning one of the record arrays for a free slot and seeding it. The
scan pattern is uniform — combine +0x00 and +0x01, test the low bit, and take the first slot whose bit
is clear — and every spawner is deliberately built to seed exactly one slot per sweep, aborting the
remaining scan the instant it plants an actor so a single call never fills the array.

The steady drip of enemies is timed by a countdown at `ENEMY_SPAWN_TIMER` [seen] (0x8d07). `loc_1171`
[code] decrements it every tick and does nothing else until it hits zero; then it gates on the stage timer
`STAGE_COUNTDOWN` [seen] (0x8901) against the live count `ACTIVE_ENEMY_COUNT` [seen] (0x8d40) — if the
two are equal, or the countdown has fallen below the count, or the count has already reached six, no
spawn is due — and otherwise sweeps the six enemy records seeding the first free one. `loc_56e8` [code]
is the richer variant used on the alternate stage type: it applies the same timer and the same
`STAGE_COUNTDOWN`-versus-`ACTIVE_ENEMY_COUNT` gate, but when `ROUND_COUNTER` bit0 is set it derives a
spawn threshold from `SPEED_INDEX` [seen] (0x8900, yielding 6 at high difficulty else a smaller bound)
and only sweeps when the active count is under it, handing each candidate slot to the per-slot spawner.

That per-slot spawner, `loc_572b`, is where an enemy's initial fields are actually written: it marks
the slot active, sets its state and coordinate bytes, then computes a spawn column in a register — seeded
from the difficulty word `DIFFICULTY_DSW` [code] (0x8820, clamped to 3), optionally biased, adjusted by
`ROUND_COUNTER`, and clamped below 0x20 — before looking up a velocity byte and arming the standard
animation `ANIM_TABLE_3829`. That velocity byte (written to +0x09, its two's-complement into +0x0a) is
indexed from `SPAWN_FIELD_TABLE_ODD` [code] (0x58e0) or `SPAWN_FIELD_TABLE` [code] (0x5902), chosen by
`ROUND_COUNTER` bit0; a separate pair, `SPAWN_TIMER_TABLE_ODD` [code] (0x589b) and
`SPAWN_TIMER_TABLE_EVEN` [code] (0x58c0) — again chosen by `ROUND_COUNTER` bit0 — supplies only the
reseed value written back to `ENEMY_SPAWN_TIMER` [seen] (0x8d07). It also bumps `ACTIVE_ENEMY_COUNT` as
it plants the actor. `loc_588e` [code] drives this per-slot spawner in bulk, looping `loc_572b` (with E
set to 4) over a run of consecutive blocks to lay down an eagle formation.

A second family of spawners seeds actors from ROM descriptor tables under the control of rotating
cursors, which is how scripted waves lay down specific enemy kinds in sequence. `loc_54f9` [code] scans
for a free block and, on finding one, reads its kind word from `ACTOR_SPAWN_TYPE_TABLE` [code] (0x5637)
indexed by `SPAWN_TYPE_CURSOR` [code] (0x8d12), stores it into the block's +0x17 selector, and calls the
shared initialiser. `loc_5544` [code] does the same but pulls its selector from `SPAWN_KIND_TABLE_5647`
[code] (0x5647) indexed by `SPAWN_SEQUENCE_INDEX_8D13` [code] (0x8d13), and `loc_5594` [code] uses
`SPAWN_KIND_TABLE_5627` [code] (0x5627) indexed by `SPAWN_SEQUENCE_INDEX_8D14` [code] (0x8d14) — and
before it seeds, it sums an eight-byte ROM guard against a local signature and, on any mismatch, bumps
the anti-tamper miss tally. All three converge on `loc_5489`, the block initialiser, which stamps the
fixed opening fields, looks up and installs the block's animation via `ACTOR_ANIM_TABLE_5657` [code]
(0x5657), and picks a signed speed by indexing `ACTOR_SPEED_TABLE_55D7` [code] (0x55d7) — first by the
block's own selector, then by three-times-`(ROUND_COUNTER & 7)` — negating it so the enemy heads the
right way.

The eagle/hunter dive waves are seeded by their own paired drivers. `loc_6905` [code] gates on the
shared delay `SHARED_FRAME_DELAY_TIMER` [code] (0x8929) — decrementing it and returning until it
clears — then, provided the wave is neither complete (`WAVE_NUMBER` [code] at 0x892d having reached its
target `WAVE_ARRIVAL_COUNTER`) nor at its limit of eight, walks eight enemy/object record pairs and
spawns into the first empty one via `loc_6931`. That seeder activates both the enemy record and its
paired object record, arms the four-frame `ANIM_TABLE_3838` animation, and on the very first spawn of a
wave (when `WAVE_NUMBER` is still zero) also paints the wave count as two BCD digits into the HUD before
bumping `WAVE_NUMBER`. The companion driver `loc_6a0f` [code] is gated instead by the phase bytes at
`BLINK_PHASE` [code] (0x892b) and `ANIM_PHASE_TOGGLE_892C` [code] (0x892c) plus the delay
`BLINK_COUNTDOWN` [code] (0x892a); once armed it sweeps eighteen enemy records through `loc_6a35`, which
activates a free record, seeds it, arms `BLINK_COUNTDOWN`, and then reads and bumps
`ANIM_PHASE_TOGGLE_892C` to pick the spawn animation pointer — phase 0 or 1 selecting `ANIM_PARAM_76D4`,
phase 2 `ANIM_PARAM_68EF`, and higher phases `ANIM_PARAM_6B0A` — before installing it. Both drivers seed
one record per sweep and stop.

The phase-driven path described earlier terminates in the same free-slot idiom. `loc_362d`, once its
per-actor delay expires, falls into the pre-spawn gate `loc_365d` [code]: when the record's arm bit
(+0x0b bit0) is set it counts the enemy records currently sitting in state 3 and only proceeds when
exactly one of them is, a guard that prevents a second spawn while one is mid-launch. Passing the gate,
it points at the five-slot `SPRITE_OBJECT_TABLE` window and falls into `spawnObjectIntoFreeSlot` [seen]
(loc_3680), which finds a free slot and initialises it: it bumps the spawn tallies at `SLOT_SPAWN_INDEX`
[seen] (0x8d7b), consumes a pending count from `ACTIVE_LANE_COUNT` [seen] (0x8d79), and advances
`ANIM_FRAME_COUNTER` [seen] (0x8d41) as a rolling sprite id (skipping zero when it wraps), then chooses
the animation pointer by +0x07's variant bit and seeds the slot's state, hold, and reload fields before
handing off to the movement path.

### Stacking the player sprite

The player is drawn as three stacked cells rather than one, and `deriveStackedSpriteYs` [seen] computes
their vertical positions each frame. It reads the lead actor's base Y (+0x04 of `ACTOR_TABLE`) and
writes three derived Y coordinates into the sprite Y fields of the three following slots — the base Y for
the lowest cell, base minus 0x10 for the top cell, and base minus 6 for the middle — so the three-tile
figure moves and lines up as a single body.

### The object-proximity collision scan

Collisions between the player's projectiles and the enemies are found by a proximity scan rather than
any pixel test. `loc_602f` [code] runs the scan once for each of the two target slots at
`SPRITE_ACTOR_RECORD_SLOTS` [seen] (0x8848), stepping a parity index between passes; a hit inside a pass
aborts before the remaining slot is examined. Each pass enters at `loc_6048` [code], which picks the
relevant target record — `ENEMY_TARGET_REC0` when the parity index is zero, otherwise `ENEMY_TARGET_REC1`
— and skips out immediately if that record's leading byte is 0 (empty) or 3 (already resolved),
otherwise latching that type byte into `ACTIVE_OBJECT_TYPE` [seen] (0x8d44) and continuing into the box
test.

That test lives in the connected group of routines beginning at `loc_6069` and `loc_6080`. It first
qualifies the candidate (its type must be present and equal to 5), then computes a signed horizontal
delta — the record's X plus a small offset whose sign depends on the screen-orientation flag — and
requires its magnitude to be under 9, and a signed vertical delta required to be under 8; either gap too
large is a miss and the pass moves on. When both gaps are inside the box, `loc_60bc` scans the six enemy
records at `ENEMY_ACTOR_TABLE` for the one whose slot id matches the struck object. Two outcomes are
possible. If a matching enemy is found whose state byte marks it hittable (+0x16 bit1 set) and
`ACTIVE_OBJECT_TYPE` is anything other than 3, the routine arms the parity-selected target record of the
`ENEMY_TARGET_REC0`/`ENEMY_TARGET_REC1` pair (setting its +0x01 and +0x07 to 1) and ends the scan
immediately, so the second target slot is never examined that frame. In every other case — no match, a
match whose hittable bit is clear, or a match while `ACTIVE_OBJECT_TYPE` reads 3 — it takes the main
path: it raises the parity-selected hit flag `OBJ_HIT_FLAG_I0` [seen] (0x8d1b) or `OBJ_HIT_FLAG_I1`
[seen] (0x8d1c), stamps a fresh record via `initActorRecord` [seen], and continues. Those hit flags are
the output the collision system leaves behind; the object-state handlers read them the next frame to
tear the struck object down and award its points.

### Teardown

The arena is wiped and rebuilt at board boundaries. `clearActorArena` [seen] zeroes the whole
0x18-stride record array at board init, and `clearActorArenaAndCounters` [code] does the same while also
resetting the spawn and wave counters. `resetActorStateForBoard` [seen] re-establishes the actor and
sprite state for a new board (including reseeding the lives count from the lives DSW), and individual
records are blanked on the fly by `clearTargetActorRecord` [code], which zeroes a single 24-byte record
when an object leaves play. Because every array shares the same record shape and the same free-slot
convention, clearing a record to zero is all it takes to return its slot to the pool for the next
spawner to claim.

## Waves, rope and launch

Three cooperating machines put enemies onto the playfield and drive them there. An **attack
wave** flies a whole formation in on a shared grid and then peels each member off to dive or
climb; the **rope** grows down the screen one segment at a time and, as each segment lands,
hangs a grabbable object from it; and the **launch** logic — an arrow-gated hunter launcher for
normal play, plus a script-driven spawner used while a stage is being built — decides when the
next enemy actually appears. All three run once per frame off the shared gameplay update, and
they share the same record conventions: an enemy lives in a 24-byte (`0x18`) slot, its state is
a small integer at record offset `+2`, and a per-frame driver walks the live slots and hands
each to a state-indexed handler.

### The enemy attack wave

The wave is driven every frame by `loc_72a7` [code], the per-frame wave-launch driver (reached
through `loc_72a0` [code], the phase body that first runs the shared per-frame update and then
this driver). It branches on `WAVE_LAUNCH_FLAG` [code]: while the flag is clear there is no live
wave, so it calls the seeder `loc_72e1` [code] and returns; once a wave is up, if
`WAVE_RECORD_COUNT` [code] has fallen to zero it hands off to the between-waves idle handler
`loc_73e3` [code]; otherwise it walks the live records — two per wave, i.e. `2 * WAVE_INDEX`
[seen] slots of `ENEMY_ACTOR_TABLE` [seen] at stride `0x18` — passing each to the per-record
dispatcher `loc_72cf` [code].

The seeder only fires once the target region `ENEMY_TARGET_REC0` [seen] is clear. It raises
`WAVE_LAUNCH_FLAG` and advances `WAVE_INDEX`; on the fourth wave it takes a short path that only
re-arms `WAVE_OUTER_PHASE` [seen] and sets the inter-wave hold `WAVE_HOLD_TIMER` [seen] to
`0x20`. Otherwise it initialises `2 * WAVE_INDEX` records from the four-bytes-per-record
`EAGLE_WAVE_PARAM_TABLE` [code]: each record is marked active (`+0` = 1) and stocked with its
target grid column (`+6`), a companion field (`+0x10`), its target row (`+4`) and one more field
(`+0x0f`), and every record also gets `+5` = `0x80` unconditionally; records whose slot index has
bit 3 set (the odd member of each pair) additionally get `+3` = `0x80`. It leaves the state byte
`+2` at zero, so every fresh record starts in the approach state, and finally clears
`WAVE_OUTER_PHASE` and its neighbour `WAVE_RECORDS_ARRIVED` [seen] to zero.

`loc_72cf` is the gatekeeper for one record: it first tests the record's active bit (bit 0 of
`+0` OR `+1`) and returns immediately for an inactive slot, then routes on the state byte `+2`
to one of three handlers — **approach** (0), **dive/climb** (1) or **retire** (2).

**Approach** (`loc_733c` [code]) holds the record still until a shared formation cursor sweeps
over it. The whole wave flies in as a grid whose position lives in `EAGLE_X_COORD` [code] and
`EAGLE_Y_COORD` [code]; the handler compares the cursor's column (`EAGLE_X_COORD >> 3`) against
the record's assigned column `+6`, and its row (`EAGLE_Y_COORD >> 3`, offset by four) against the
record's assigned row `+4` within a small tolerance window, and returns whenever the cursor has
not yet reached this record's cell. On a match it advances the state byte, points the record at
its animation — `EAGLE_EVEN_RECORD_ANIM` [code] for even members, `EAGLE_ODD_RECORD_ANIM` [code]
for odd — and seeds the descent speed at `+9` (`0x40` even, `0x38` odd). Even members also tally
into `WAVE_RECORDS_ARRIVED` [seen]; once that equals `WAVE_INDEX` — the whole formation has
arrived — the handler queues the wave-arrival sound at `WAVE_ARRIVAL_CMD_BASE` [code] offset by
the wave number. A separate guard, `loc_7287` [code], watches `EAGLE_Y_COORD` reach the field
edge (`0xd0`) and latches the wave-finished flag before running a phase-reset epilogue.

**Dive/climb** (`loc_7395` [code]) first advances the record's animation frame, then integrates the
record's 16-bit vertical position (`+3` low, `+4` row) by the per-record speed at `+9`. The two
members of a pair go opposite ways: an even record descends (speed added, row carried up on
overflow) and advances to retire once its row reaches `0x1d` at the bottom; an odd record ascends
(speed subtracted, row borrowed down) and advances once its row drops below `0x04` at the top.

**Retire** (`loc_73ce` [code]) blanks the whole 24-byte record and decrements
`WAVE_RECORD_COUNT`; when the last record of the wave clears, it seeds the inter-wave hold
`WAVE_HOLD_TIMER` to `0x30`. While the wave count is zero, `loc_72a7` routes to the idle handler
`loc_73e3`, which ticks `WAVE_HOLD_TIMER` down; on expiry it queues an end-of-wave sound (a
second arrival command base offset by `WAVE_INDEX`), reseeds the hold to `0x18`, and clears
`WAVE_LAUNCH_FLAG` so the next seeder pass can start a fresh wave.

### The rope

The rope is a single per-frame driver, `loc_25a6` [code], that splits its work by the low bit of
`ROUND_COUNTER` [seen]: on odd frames it draws the visible rope column, and on even frames it
delegates to `driveRopeExtendAndRenderCells` [code], which grows the rope and animates the
objects hanging from it. The two halves share the same underlying rope state but touch different
cells.

**Drawing the column** (the `loc_25a6` body). A step timer, `ROPE_DRAW_STEP_TIMER` [code], paces
the work; the driver returns until it expires, then reloads it to `0x10`. Nothing is drawn while
`SPAWN_PHASE_COUNTER` [seen] is zero. The direction flag `FORMATION_SLOT_TABLE` [seen] selects
one of three modes. When it is set the rope **retracts**: the driver blanks a band above the
column, redraws a retract glyph, and queues the retract sound. When it is clear the rope moves
**forward** — either steady or extending. A forward pass advances the sweep: if the phase has not
yet caught up to `ROPE_DRAW_COUNT` [seen] and the extend flag `ROPE_DRAW_EXTEND_FLAG` [code] is
clear, it begins a new extend sweep by bumping `ROPE_DRAW_COUNT`, setting the extend flag, and
resetting the write pointer `MARKER_LAYOUT_PTR` [code] to the column base `SPRITE_BAND_86E3`
[code]; when an extend sweep reaches its limit it clears the extend flag and the
`ANIM_ARMED_LATCH` [code]. While extending, it grows the column one row upward, pulses the new
cell pair, lengthens the step timer to `0x1c`, and queues the two extend sounds. When the write
pointer reaches the cap position the driver latches `ROPE_DRAW_COMPLETE_FLAG` [code]. Whichever
mode is chosen, the driver then stamps the selected glyph — one of the `MARKER_GLYPH_SRC` [code]
family, its variant picked by the parity of `ROPE_DRAW_ANIM_PHASE` [code] — down the column
record by record, appends a cap glyph below the last record on forward frames, and advances the
animation parity.

**Growing the rope and hanging objects** (the even-frame branch,
`driveRopeExtendAndRenderCells`). It idles entirely while a grab is in progress
(`GRAB_ACTIVE_FLAG` [seen]) or while `WAVE_ARRIVAL_COUNTER` [seen] still sits at its hold value
of 2; otherwise it runs the extend state machine and then the per-cell driver in order.

The extend state machine, `dispatchRopeExtendState` [seen], routes on `ROPE_EXTEND_STATE` [seen]
through `ROPE_EXTEND_DISPATCH_TABLE` [code] into two sub-states. Sub-state 0,
`addRopeSegmentAndAdvanceExtendState` [seen], adds one segment: it stops once the rope has grown
to two below `WAVE_ARRIVAL_COUNTER` (the per-stage target length), otherwise it bumps
`ROPE_SEGMENT_COUNT` [seen] and, while `ROPE_EXTEND_INDEX` [seen] is below four (or a tamper
strike is pending), advances that index, looks the new segment's video-column low byte up from
`ROPE_CELL_COLUMN_TABLE` [code] and stores the full pointer in `ROPE_COLUMN_VRAM_PTR` [seen],
reloads this segment's timer in `ROPE_CELL_TIMERS` [seen], advances the sub-state, and arms the
sub-timer `ROPE_EXTEND_TIMER` [seen] to `0x10`. Sub-state 1,
`advanceRopeExtendAnimation` [seen], plays the drop-in animation for the segment just added: it
counts `ROPE_EXTEND_TIMER` down, and on each expiry reloads it to 8 and either advances
`ROPE_EXTEND_FRAME_INDEX` [seen] by blitting this frame's tile block from
`ROPE_TILE_BLOCK_TABLE` [code] at the segment's column, or — once the frame index has reached 8 —
resets the index and state and activates the new rope cell by writing 1 into the matching entry
of `ROPE_CELL_STATE_BASE` [seen].

The per-cell driver, `driveActiveRopeCells` [code], walks `ROPE_EXTEND_INDEX` cells from
`ROPE_CELL_STATE_BASE` and hands each to `dispatchRopeCellState` [seen], which returns at once for
an inactive cell (state 0) and otherwise routes the cell's `state - 1` through `ROPE_CELL_DISPATCH`
[code] into four handlers that march a hung object through its life. State 1,
`spawnHangingRopeObject` [seen], acts only on every fourth frame and only once the cell's frame
timer (one of four in `ROPE_CELL_TIMERS`, selected by the low two bits of the cell index via the
shared helper `tickRopeCellFrameTimer` [seen]) elapses: it finds a free slot in
`SPAWN_OBJECT_TABLE` [seen], seeds it with an opening state, coordinates and a `+4` field taken
from `ROPE_SPAWN_IY4_TABLE` [code], records the slot index back into the timer cell with a
round-scaled reload, advances the cell state, blits the segment tile (`ROPE_SEGMENT_TILE_SRC`
[code]) at the cell's column (computed by `computeRopeCellVramColumn` [code]) and queues its
display command. State 2, `advanceHangingRopeObject` [seen], fires on its timer and steps the
paired record in `FORMATION_TABLE` [seen] — bumping its tile field (`+0x0f`), clearing its position
byte (`+0x05`) to zero and dropping another field (`+0x06`) — then advances the cell state and
blits the alternate segment tile (`ROPE_SEGMENT_TILE_SRC_ALT` [code]). State 3,
`advanceHangingRopeObjectWithGrabCheck` [seen], first abandons the whole update if a grab has fired
that frame; otherwise it is the mirror image — the tile field (`+0x0f`) is dropped, the position
byte (`+0x05`) is forced to `0xc0`, the other field (`+0x06`) is bumped — before it advances the
cell state and blits the plain segment tile (`ROPE_SEGMENT_TILE_SRC` [code]). State 4,
`retractRopeSegment` [code], reels a segment back in once its timer expires and segments remain: it
picks a retract-animation pointer from `RETRACT_ANIM_TABLE`
[code] (keyed on the round counter and difficulty), merges the segment's attribute, clears the
count-selected `FORMATION_TABLE` record, resets the cell, and blits the retract tile
(`ROPE_RETRACT_TILE_SRC` [code]).

### The arrow and the launch

Two independent launch mechanisms decide when a new enemy is put in play. During normal play a
five-state machine, gated on a rising arrow, drips hunters onto the ropes; while a stage is being
built a script-driven spawner arms enemy-actor records from a byte list.

**The arrow-gated hunter launcher.** The frame pipeline `runLaunchAndTargetActorPipeline` [seen]
runs the state driver `dispatchLaunchState` [seen] first each frame; it routes the low three bits
of `LAUNCH_STATE` [seen] through an inline table into five handlers that cycle 0 → 1 → 2 → 3 → 4 →
0. State 0, `armLaunchAndAdvanceToHunterSpawn` [seen], arms the launch once its preconditions
hold — it bumps `LAUNCH_ARM_LATCH` [seen] when `LANE_SPAWN_COUNTDOWN` [seen] is up and the latch
is still clear, otherwise it requires `STAGE_COUNTDOWN` [seen] to be a nonzero multiple of eight —
setting `LAUNCH_ARMED_FLAG` [seen]. It then gates on the arrow: it returns unless `ARROW_Y`
[seen] — the Y coordinate of the arrow/launch object, which the object's motion steps every
frame — is at or above its gate value `0x3c`, and unless both target records `ENEMY_TARGET_REC0`
[seen] and `ENEMY_TARGET_REC1` [seen] are clear of their hit bit. Clearing those gates, it advances the state, reseeds a
tile-flip countdown, may light a HUD cell (`LAUNCH_HUD_TILE` [seen]), refreshes the arm latch
from `LAUNCH_ARM_LATCH_SEED` [code], and blits the launch tile (`LAUNCH_TILE_SRC` [code] into
`LAUNCH_TILE_VRAM` [seen]). State 1, `spawnEnemyTargetOrAnimateLaunchFlipTile` [seen], forks on
the same arrow: while the arrow is at or above `0x34` it animates the arrow tile, counting
`LAUNCH_FLIP_COUNTDOWN` [code] down and, on each expiry, stepping `SHARED_PHASE_COUNTDOWN` [code]
and blitting one of two arrow tiles (`LAUNCH_TILE_SRC` / its alternate) by that byte's parity;
below the gate it instead seeds a free one of the two `ENEMY_TARGET_REC*` records. State 2,
`spawnHunterIntoTableAndAdvanceLaunch` [seen], scans the six-slot `HUNTER_TABLE_BASE` [code]
downward for a free record, stamps it with an opening state, coordinates and tile ids, records
its address in `HUNTER_RECORD_PTR` [seen], advances the launch state, and then — depending on the
flip flag `HUNTER_SPAWN_FLIP_FLAG` [code] — either seeds `HUNTER_SPAWN_COUNTDOWN` [seen] to
`0x20` and queues `HUNTER_SPAWN_DISPLAY_CMD` [code] or bumps `HUNTER_SPAWN_SUBCOUNTER` [code].
State 3, `advanceLaunchOnDelayAndClearHunterRecord` [seen], runs `HUNTER_SPAWN_COUNTDOWN` down as
a hold, then advances the state and clears the pointed-to hunter record. State 4 is
`loc_28c5` [code], a pure no-op that neither advances nor resets `LAUNCH_STATE`; the machine idles
there until an outside reset returns it to state 0 — a spent-object despawn in
`advanceTargetActorAlongVelocityElseDespawn` [seen], or a board reset in `resetActorStateForBoard`
[seen].
Throughout, `PLAY_MODE_LATCH` [code] gates the actual seeding and clearing steps, so while it is
set the machine cycles its states without populating the tables.

**The script-driven spawner.** A specific build phase reaches `loc_6e75` [code], a gate that runs
the spawner only when neither `TAMPER_FREEZE_FLAG` [code] nor `SIGNATURE_MISMATCH_FLAG` [code] is
set (its
skip-spawn arm targets a data address and is unreachable with a valid ROM), then calls the
single-object launcher `loc_6e86` [code] followed by the sibling per-record driver `loc_6edb`
[code]. `loc_6e86` ticks a launch delay down each frame in `INTRO_DELAY_CKSUM_WORD` [seen]; on
expiry it reloads that delay from bit 1 of `LAUNCH_SEQ_COUNTER` [code] — `0x20` or `0x2c`, so the
cadence changes every two launches — and reads the next byte from the script pointer
`LAUNCH_SCRIPT_PTR` [seen], where `0xff` terminates the script. That byte selects an enemy-actor
record (counting stride-`0x18` records up from one stride below `ENEMY_ACTOR_TABLE`, so a byte of
1 lands on the table's first record). Before committing it scans the three-slot
`PROJECTILE_SLOT_STATE` [seen] table for a free slot; if none is free it backs the script pointer
up by one to retry next frame, and if one is free it arms the selected record's state to 6, points
it at the spawn animation `SPAWN_ANIM_TABLE_396A` [code] via `setActorAnimation` [seen], launches
the projectile through `launchProjectileIntoFreeSlot` [seen], and increments `LAUNCH_SEQ_COUNTER`
to carry the cadence forward.

## Rendering, HUD and display lists

Everything the player sees is assembled into two memory-mapped tile planes and a work-RAM
sprite list, then handed to the video hardware. The tile-code plane lives at `VIDEO_RAM_BASE`
`[code]` (`0x8400`-`0x87ff`): a 32-cell-wide grid whose row stride is `0x20`, one byte per cell
naming the character graphic drawn there. Alongside it sits the colour/attribute plane at
`COLOR_RAM_BASE` `[code]` (`0x8000`-`0x83ff`), the same 32-wide geometry but one attribute byte per
cell selecting its palette. Almost every routine in this subsystem is a walk over one of those two
grids at the `0x20` row stride, and the recurring idioms — "advance the low byte only so the write
wraps inside the 256-byte page", "step `-0x20` to climb one row toward lower addresses" — are the
same grid arithmetic seen over and over.

### Clearing and filling the tile plane

The coarsest primitive is a byte-fill leaf, `loc_0010` `[code]`: it writes a constant into a run of
cells and hands back the advanced pointer, with a zero length meaning a full 256-cell pass (the
hardware down-counter never distinguishes zero from wrap). A whole screen is cleared not in one call
but a row at a time so the work spreads across frames. `loc_02ce` `[code]` does one row of that
spread: it blanks a run of cells from the fill cursor `TILE_FILL_PTR` `[seen]` with the blank tile
`0x10`, advances the cursor by exactly one row regardless of how many cells it blanked (it adds the
row's remainder after the fill), stores the cursor back, and decrements the row counter
`FILL_ROW_COUNTER` `[seen]`; the Z flag it returns tells the driver when the counter has drained and
the fill is complete. The fill is armed by seeding those two cells — the counter to `0x20` (a full
screen of rows) and the cursor to a chosen origin — which is what `loc_02e3` `[code]` does when it
starts the playfield fill from `PLAYFIELD_TILE_BASE` `[code]` (`0x8402`). Because the counter counts
frames' worth of rows, the row-by-row fill doubles as the timed board wipe/build.

Two smaller fills paint fixed screen furniture. `loc_039b` `[code]` maintains an eight-cell vertical
gauge at `COUNT_COLUMN_VRAM` `[code]`: while the game is active it lights the top N cells with the
fill tile `0x0c` and blanks the rest, where N is the actor table's slot-0 active flag (`ACTOR_TABLE`
`[seen]`, which toggles 0/1 as the lead actor becomes active) plus one, clamped to the column height —
so in normal play the gauge stands one or two cells tall. And `loc_0a52` `[code]`
stamps two 2x2 tile blocks from one shared four-byte pattern (`TILE_BLOCK_2X2_SRC` `[code]`) into two
fixed video-RAM anchors, `VRAM_TILE_BLOCK_DEST_A` `[seen]` and `VRAM_TILE_BLOCK_DEST_B` `[seen]`.

### Painting the colour/attribute plane

The colour plane is flooded wholesale by `fillAttributeColumns` `[seen]`. It walks 31 columns from
`ATTRIB_MAP_BASE` `[seen]` (`0x8040`), and for each column takes a single source byte and stamps it
down all 30 rows at the `0x20` stride, advancing the source one byte per column — so each screen
column gets one uniform attribute value, and the whole colour map is set from a compact 31-byte
source row. Its only register result is the loop's terminal value `0x1f`, which a caller stashes
verbatim as a scratch byte; it carries no colour meaning.

### The two-plane column blitter

Where the flood paints uniform columns, `loc_0cf8` `[code]` stamps a graphic column strip into
*both* planes at once. It reads `0x0c`-byte columns from a tile source (`COLUMN_BLIT_TILE_SRC`
`[code]`) and writes each column bottom-up (stride `-0x20`) into the tile plane from
`COLUMN_BLIT_TILE_DEST` `[code]`. After each column a steering byte in the source decides what comes
next: an ordinary byte means "the next column, one cell to the right"; `0xff` switches the routine
over to the attribute source `COLUMN_BLIT_ATTR_SRC` `[code]` and the attribute-plane destination
`COLUMN_BLIT_ATTR_DEST` `[code]`, so the same loop then lays down the matching colour columns; and
`0xee` ends the stamp. One driver thus paints a region's tile codes and then its colours from a
single self-terminating stream.

### The scrolling columns

During play a per-frame worker keeps two three-tile columns marching. It is reached through the main
state driver: `loc_0254` `[code]` is dispatched when there is no queued command to service (see the
command ring below). If the worker control byte `WORKER_CONTROL_BYTE` `[code]` has its low nibble
set it only runs the ROM signature check and returns; otherwise, while a game is active, it repaints
the scroll columns. In one-player mode it blanks four columns from the cap cell `COLUMN_CAP_VRAM`
`[code]` (chaining `blankTileColumn` `[seen]`, which writes the blank tile `0x10` into three cells a
row apart and returns the advanced pointer for the next column); in two-player mode it instead stamps
a capped body column there. Either way it then stamps the second scroll column at `WORKER_COLUMN_VRAM`
`[seen]` via `loc_02a8` `[code]`, which lays a cap tile and delegates the two body tiles to
`paintColumnBodyTiles` `[seen]` (mid tile `0x25`, base tile `0x20`, one row apart). A final gated pass
blanks one more column when the control byte's bit 4 and the game-active bit are both set. The
building blocks recur elsewhere: `stampSecondScrollColumn` `[seen]` and `paintColumnBodyTilesUp`
`[seen]`/`loc_1ce7` `[code]` stamp the same cap-plus-two-body shape climbing upward.

A separate small animation marches a short tile strip across the screen using the cursor
`TILE_ANIM_CURSOR` `[seen]`: on odd frames `advanceTileAnimForwardOnOdd` `[seen]` steps it forward and
on even frames `retreatTileAnimScript` `[seen]` walks it back, cycling a few tile codes so the strip
appears to shimmer in place.

### The block-stamp primitives

Fixed-size graphic blocks — glyphs, round markers, status icons — are laid down by a small family of
copiers, split by width in how they step to the next row. The 3-wide members write three cells then
step `+0x1d` to reach the next row's origin (three cells plus `0x1d` equals the `0x20` row stride):
`blitTile3x3Block` `[seen]` stamps a 3-wide, 3-tall block and returns *both* the advanced destination
and the advanced source, so a caller can stamp the next block straight from where the source left off,
and `blitGlyphBlock4x3` `[seen]` does the same for a four-row, three-column glyph, advancing the
destination low byte only within its page (three low-byte bumps plus `+0x1d` netting one row). The 2x2
members instead write two cells per row and step with the plain `0x20` row stride and a ±1 column
nudge: `blit2x2TileBlock` `[seen]` copies four source bytes into a 2x2 square (top-left, top-right at
`+0x01`, bottom-right at `+0x21`, bottom-left at `+0x20`) and returns the anchor advanced one row down
so stacked blits chain, and `paintTileBlock2x2` `[seen]` is the plain 2x2 stamp. These are the
workhorses under the HUD text and number blocks below.

### The sprite display list

Sprites are not drawn cell by cell; they are described in a 24-entry, four-bytes-per-entry list at
`SPRITE_DISPLAY_LIST` `[seen]` (`0x8840`) that the hardware DMAs to the sprite generator. That list is
rebuilt from scratch every frame by `loc_02ef` `[code]`, which gathers four groups of object records
into it in turn: the two lead actors and the two enemy-target records from `ACTOR_TABLE` `[seen]` and
`ENEMY_TARGET_REC0` `[seen]`, the eighteen moving-object records from `ENEMY_ACTOR_TABLE` `[seen]`,
and finally the two arrow/launch records. The simple groups go through `copyObjectRecordsToDisplayList`
`[seen]`, which lifts four raw bytes out of each record (its `+0x06`, `+0x10`, `+0x04`, `+0x0f`
fields — coordinate, attribute, coordinate, tile) into four successive list slots and returns the
advanced list pointer so the next group appends behind it. The moving objects need coordinate math, so
they go through `loc_0343` `[code]`: it reads each record's two 16-bit sub-pixel position pairs and
reduces each to an 8-bit screen coordinate (shift the fixed-point value down by five and bias by
`-8`), interleaving those with the raw attribute/tile bytes. After the four groups, `loc_02ef` nudges
the arrow group's two sprite-Y bytes down one pixel and falls into `loc_0320` `[code]`, which ticks a
per-frame counter and, when the screen-orientation flag `FLIP_SCREEN_FLAG` says the screen is flipped,
mirrors the whole list. That mirror, `mirrorSpriteListVertically` `[code]`, walks the stride-4 list in
place: it negates and offsets each entry's two coordinate bytes (`-x - 0x10`) and toggles the two
flip bits in the attribute byte while preserving its low nibble, so an upside-down cabinet shows the
same scene correctly oriented.

### The display-command ring

Deferred display and phase-setup work is queued through a 32-slot, two-byte-per-slot ring buffer at
`DISPLAY_CMD_RING_BUFFER` `[code]` (`0x88c0`-`0x88ff`), which boot fills with `0xff` to mark every slot
empty. A producer enqueues a command with `loc_0038` `[code]`: it looks at the slot under the write
pointer `DISPLAY_CMD_RING_WRITE_PTR` `[code]`, and only if that slot is free (bit 7 set) stores the
command's high byte there and its low byte in the next slot, then advances the write pointer by two
and wraps it back to the ring start once it runs below it. An occupied slot means the ring is full and
the command is simply dropped.

The main state driver drains the ring. Each iteration it reads the slot under the read pointer
`DISPLAY_CMD_RING_READ_PTR` `[code]`: if that slot is still free the ring is idle, so it runs the
per-frame scroll worker (`loc_0254`, above) and loops; if the slot is occupied it consumes the
command — marking both slots free again and advancing the read pointer with the same wrap-at-ring-start
rule — and dispatches it. The command's *high* byte selects a handler through a jump table, and its
*low* byte is passed to that handler as the argument. This is why the command vocabulary is grouped by
high byte: the `0x06xx` family carries the bulk of the in-play events (object spawns, siren cues, phase
setup, promotion steps), while `0x04xx` marks start-of-life, and `0x03xx`/`0x05xx`/`0x02xx` carry
attract and setup work; the low byte within each family picks the specific action. The producers are
scattered across the machine — for example `tickHudRefresh` `[code]` bumps `HUD_REFRESH_TICK` `[code]`
each frame and, on every sixteenth frame, enqueues a `0x06`-family display-refresh command whose low
byte carries a variant bit.

### The display-list interpreter

Larger blocks of tilemap layout — full screens of background, banners, the fixed panels — are
described as byte streams in ROM and blitted by `paintDisplayListRunToVram` `[seen]`, a small
interpreter. It first chooses which pointer pair to work with: the primary destination/source pair
`DISPLAY_LIST_DST_PTR` `[seen]`/`DISPLAY_LIST_SRC_PTR` `[seen]`, or the alternate pair
`DISPLAY_LIST_DST_PTR_ALT` `[seen]`/`DISPLAY_LIST_SRC_PTR_ALT` `[seen]` when `FORMATION_SLOT_TABLE`
`[seen]` is nonzero. It then processes up to `0x1d` source bytes: an ordinary byte is copied to the
destination and both pointers step forward; a `0x10` opcode is a skip that advances the destination by
the following byte and shrinks the remaining budget; and an `0xff` opcode reloads the destination
pointer from the next two stream bytes and folds the byte after that into the sub-phase tick
`SUBPHASE_TICK` `[seen]`, ending the run. On exit the advanced pointer pair is written back, so the
next call resumes exactly where this one stopped — a long layout is drawn as a sequence of bounded
runs across frames.

### BCD and the HUD number primitives

Every on-screen number is packed BCD, and a handful of leaves convert and paint it. `binToPackedBcd`
`[code]` turns a binary count into two packed decimal digits plus a hundreds tally by counting up in
BCD (a zero counter means a full 256 passes, the exit-tested loop's wrap). `byteToPackedBcd` `[code]`
does the value-mod-100 conversion the Z80 way, weighting the high nibble by decimal 16 through
repeated decimal-adjust so it stays bit-exact. Once a value is packed, two painters put it on screen.
`drawStackedBcdDigits` `[code]` writes a byte as two stacked tiles — the tens digit at the cursor and
the units one row up — blanking a leading-zero tens digit to the blank tile `0x10`. `splitBcdByte`
`[seen]` is the finer tool for multi-digit fields: it drops the low nibble as a tile at the cursor,
advances the cursor, and hands back the high nibble (with a zero-sense flag) for the caller to place.
And `renderDigitWithBlanking` `[seen]` threads leading-zero suppression across a whole field: it
carries a blank budget, painting the blank tile while the budget lasts and a digit reaches zero, and
painting a real digit (which ends the blank run) otherwise, stepping the cursor by the row stride each
call. Numbers are drawn most-significant digit first, climbing the column at the `-0x20` stride.

### Scores, the high-score table, and the panels

Each score is a three-byte packed-BCD counter drawn down a screen column. Player one's live buffer is
`P1_SCORE_BCD` `[seen]` painted at `P1_SCORE_VRAM` `[seen]`, player two's `P2_SCORE_BCD` `[seen]` at
`P2_SCORE_VRAM` `[code]`, and the running high score `HIGH_SCORE_BCD` `[code]`/`HIGH_SCORE_BCD_HI`
`[seen]` at `HIGH_SCORE_VRAM` `[code]`. `loc_056b` `[code]` draws one of the three: the selector picks
the counter and its column, and it splits each of the three source bytes into its high then low digit,
painting them a cell apart up the column with a shared four-digit blank budget so leading zeros
disappear. `loc_0552` `[code]` is the reset-and-repaint variant used at start of life: it zeroes the
selected counter's three bytes first, so the same digit painter draws the field as four blanks
followed by two zeros. Because the low BCD pair of each score buffer is always zero (scores step in
hundreds), the visible field is effectively the upper digits.

The attract screen assembles the whole scoreboard through `loc_03e9` `[code]`. It draws eleven
selector-indexed character fields, then renders the ten-entry high-score table `HIGH_SCORE_TABLE`
`[code]` at `HIGH_SCORE_TABLE_VRAM` `[code]` as stacked BCD digit pairs — each of a row's three bytes
split into low-then-high nibble a row apart, the top digit's leading zero suppressed, and the column
re-based two cells to the right for the next row. It then repaints two panels. `loc_0439` `[code]`
renders the digit panel: ten rows drawn from `PANEL_DIGIT_SOURCE_TABLE` `[code]` into
`PANEL_DIGIT_VRAM_DEST` `[code]`, two BCD digit pairs per row with a fixed separator tile `0x51`
wedged between them. And `renderPanelFromTable` `[seen]` paints the status panel: it walks ten rows of
three cells from the work-RAM tile table `PANEL_TILE_SOURCE` `[code]` into `PANEL_VRAM_DEST` `[seen]`,
painting each source byte or the blank tile `0x40` for an empty cell, the first two cells of a row
climbing one row and the third re-basing forward to the next column.

A related multi-field HUD updater, `loc_10c2` `[code]`, walks a counter toward a new value one BCD step
at a time and repaints three stacked-BCD fields at `SUBSTATE_FIELD1_VRAM` `[code]`,
`SUBSTATE_FIELD2_VRAM` `[code]` and `SUBSTATE_FIELD3_VRAM` `[code]` (the third mirroring a hundreds
digit out to `SUBSTATE_FIELD3_HUNDREDS_VRAM` `[code]` when it overflows), each drawn through
`drawStackedBcdDigits`.

### Round, stage label, and countdown readouts

The playfield header — round number, stage label, and the stage countdown — is refreshed from the two
game-state cells `ROUND_COUNTER` `[seen]` and `STAGE_COUNTDOWN` `[seen]`. The round number is drawn by
converting round-plus-one to BCD and blitting one of two 4x3 glyph banks, `ROUND_DIGIT_GLYPHS`
`[code]` or `ROUND_DIGIT_GLYPHS_ALT` `[code]`, chosen by a tens bit, into `HUD_ROUND_TILE` `[seen]`;
the fixed stage label is then selected from `STAGE_LABEL_PTR_TABLE` `[code]` and blitted into
`HUD_STAGE_LABEL_TILE` `[seen]`. Several routines share this shape for different triggers.
`refreshRoundStageHud` `[code]` is the per-frame refresh: it holds off entirely while any of seven
integrity-flag slots at `INTEGRITY_FLAG_SCAN_BASE` `[code]` is armed, then derives the countdown's tens
digit and — only on the first stage of a round (tens zero) — redraws the round number, blanks three
trailing tiles, and mirrors the countdown into its HUD digit `HUD_STAGE_DIGIT_LO` `[seen]`; both paths
then draw the stage label. `drawStageLabelOncePerLevel` `[code]` is the once-per-level variant, gated
by the done-latch `LEVEL_TAG_DONE_LATCH` `[code]`: a low stage index passes straight through as column
zero and arms the latch, a higher index is matched against the five-entry column table
`STAGE_TAG_COLUMN_TABLE` `[code]` (a miss draws nothing), and column zero draws the round number before
every path draws the label. `loc_1f40` `[code]` is the table-scan entry: it searches a caller-supplied
table for a value and, on a match, draws the round number when the match is at slot zero and always
draws the stage label for the matched slot.

The full round-HUD build lives in `paintRoundNumberHud` `[seen]`. Unless the tamper-freeze flag
`TAMPER_FREEZE_FLAG` `[code]` (`0x881e`) is set — which in normal play it never is — it copies an
attribute field from `ROUND_HUD_FIELD_SRC` `[code]` bottom-up into the
reset column `RESET_ATTR_COLUMN` `[seen]` through its `0x10` sentinel, BCD-converts round-plus-one and
paints the two round digits into `HUD_ROUND_DIGIT_HI` `[seen]`/`HUD_ROUND_DIGIT_LO` `[seen]` (blanking
a leading zero), stamps the round glyph blocks — the tens bit selecting a word from
`ROUND_GLYPH_WORD_TABLE` `[code]`, stamped at `ROUND_TILE_DST` `[seen]` — stashes the low digit in
`ROUND_BCD_LOW_STASH` `[seen]`, and renders a selector glyph through `loc_1ffb` `[code]` (which picks
`GLYPH_TILES_A` `[code]` or `GLYPH_TILES_B` `[code]` by a bit of the value and stamps it at
`GLYPH_BLOCK_DEST` `[seen]`). Both first-pass and steady-state entries then run the per-frame chain:
`refreshRoundStageHud` followed by `renderStageCountdownDigits` `[seen]`. That last routine paints the
countdown as a two-cell number — a value under ten drawn as a single digit as-is, ten or more converted
to packed BCD first (that path held while the play-mode latch is set) — writing the units nibble to
`HUD_STAGE_DIGIT_LO` and, unless it is a leading zero, the tens nibble one row over.

### The status-render ring

A small icon triplet is repainted on a slow, self-timed cadence so it does not rewrite every frame.
`tickStatusRenderRingAndRedrawOnWrap` `[seen]` decrements a mod-8 ring counter `STATUS_RENDER_RING`
`[seen]`; while it stays nonzero the display simply holds. Only on the wrap does it borrow one from the
mod-4 phase counter `STATUS_RENDER_PHASE` `[seen]` and fall into
`wrapRenderPhaseAndPaintTileTriplet` `[seen]`, which masks the phase to 0..3, looks up a tile-block
descriptor for that phase from `STATUS_RENDER_TILE_TABLE` `[code]`, and stamps three 2x2 blocks two
rows apart from `STATUS_RENDER_VRAM_BASE` `[seen]`. The third block alternates between two sources,
`STATUS_FIELD_TILE_A` `[code]` and `STATUS_FIELD_TILE_B` `[code]`, on the phase's low bit, so the icon
animates through its cycle a few frames at a time.

## Sound

All audio in Pooyan is produced by a second processor that the main CPU never talks to
directly beyond one byte at a time. The main program decides *what* should be heard and
expresses each decision as a single command code; a separate audio CPU turns that code into
waveform. The whole of the main-CPU sound machinery therefore reduces to one job — getting a
command byte across to the audio side at the right moment — and everything below is either the
gate that hands a byte over, the buffer that stages bytes until a frame is ready to release
one, or the game-event drivers that decide which byte to stage.

### Handing a byte to the audio CPU

The narrow waist is `sendSoundCommand` [seen]. It writes the command code into the
`SOUND_COMMAND_LATCH` [seen] at 0xa100 and then pulses the `AUDIO_IRQ_LATCH` [seen] at 0xa181
high and immediately back low. That rising edge is what wakes the audio CPU: the latched byte
sits at 0xa100 waiting to be read, and the strobe is the doorbell that tells the audio side a
fresh command is present. The pulse itself carries no state — it is a bare high-then-low on a
single latch bit — so the command *value* is the only thing that matters to the machine's
audible behaviour. This is the single choke point every sound ultimately passes through; there
is no other route from the main CPU to the audio CPU.

Two things reach that choke point. The first is an immediate hand-off: `emitPresetSound`
[code] carries one fixed code (0x0b) straight into `sendSoundCommand`, bypassing any staging.
The second, and the path most game events take, is the command ring described next, which
`sendSoundCommand` empties one byte at a time. At power-on the boot routine `loc_0092` [code]
performs the same hand-off with a command of 0 to silence the audio CPU before the game begins,
and only then arms the per-frame interrupt.

### The command ring

Because many game events want to request sound during a single frame — and because the audio
CPU can only be handed one byte per doorbell — the main program stages commands in a small
ring buffer rather than latching each one the instant it is decided. The ring lives at
`SOUND_RING_BUFFER` [code], occupying slots 0x8a43 through 0x8a5e (0x1c slots on page 0x8a),
with `SOUND_RING_WRITE_PTR` [code] and `SOUND_RING_READ_PTR` [code] as its tail and head. An
empty slot holds the marker 0xff; the boot routine fills every slot with that marker so the
ring starts empty, and both pointers begin at the first slot (index 0x43). Each pointer walks
forward through the slots and wraps from the last slot back to the first, so the buffer is a
true circular queue.

Bytes enter through two enqueue styles that share the same ring and the same write pointer.
`enqueueSoundCommandRing` [seen] simply stores the byte at the slot the write pointer names and
advances the pointer with wrap — an unconditional enqueue. `appendSoundCommandGated` [code]
does the same store-and-advance but first stashes the incoming byte and then only commits it
while a game is active (`GAME_ACTIVE_FLAG` [seen]) or the play-mode latch (`PLAY_MODE_LATCH`
[code]) is set; when both are clear the append is dropped. On top of the gated append sits
`appendSoundCommandRun` [code], which stages a four-byte *run* — the caller's lead byte
followed by the fixed trio 0x15, 0x16, 0x17 — so that one game event can queue a small
multi-byte sequence in a single call.

Draining is the mirror image. `drainSoundCommandRing` [seen] reads the slot the head pointer
names; if that slot holds the empty marker it returns having done nothing, otherwise it hands
the queued byte to `sendSoundCommand`, frees the slot back to 0xff, and advances the head with
wrap. Crucially it drains exactly one entry per call, and it is gated: the byte is forwarded to
the audio CPU only when demo/attract sound is enabled (`DEMO_SOUNDS_DSW` [code] bit 0) or a
game is in progress, so the machine stays silent when both conditions fail. The drain is
invoked once per video frame from the vblank interrupt service (loc_066d), and again as the
final sub-pass of the level-intro phase-1 frame body (`runLevelIntroPhase1Frame`). Since events
can append several bytes in a frame while only one leaves per drain, the ring naturally
smooths bursts into a steady one-command-per-frame stream to the audio CPU.

### The command set the game emits

The command codes themselves form a dense low range. A family of thin emitters —
`queueSoundCommand00` through `queueSoundCommand14` [code] — covers most codes in the 0x00..0x14
range, each standing for one fixed code and pushing it into the ring; most are one-line wrappers
over the enqueue or the gated-append helper. The span is not solid: 0x03 and 0x10 appear only
inside bundle emitters (below), and 0x04 exists only as the conditional
`queueSoundCommand04IfNotBusy` described later. A few emitters bundle codes: `queueSoundCommands82And03`,
`queueSoundCommands82And95`, `queueSoundCommands95And10`, `queueSoundCommands95And03And11`,
`queueSoundCommands96And97And18And15`, `queueSoundCommands19And15`, and
`queueSoundCommands27And15` [code] each queue a fixed short sequence, while `queueSoundRun1D`,
`queueSoundRun26`, `queueSoundRun28`, and `queueSound82ThenRun1C` [code] open a run with a lead
byte and let the run helper complete it. Some emissions are chosen at runtime:
`queueRoundSoundCommandRun` and `queueRoundVariantSoundRun` [code] both fold two bits of the
`ROUND_COUNTER` [seen] into a 0..3 selector and bias it onto one of four consecutive codes
(the 0x1e.. and 0x22.. groups), so the sound varies by stage. And some are conditional:
`queueSoundCommand04IfNotBusy` [code] drops its 0x04 request entirely while a wave is tearing
down (`WAVE_TEARDOWN_STATE` [seen]) or a grab is in progress (`GRAB_ACTIVE_FLAG` [seen]),
appending the command only when neither is busy.

There is no symbolic name attached to any individual code inside the machine. The audio map
that the game ships (`audio/sounds.js`) is a *clips* model keyed on the soundlatch address
0xa100 alone: each distinct byte the main CPU latches selects one recorded clip, captured once
per command by the offline recorder, so no per-command name table lives in the map. The audio
CPU's own program is not modelled at all — the machine treats "latch code N" as "play clip N"
and leaves the synthesis to the recording. Consequently the command *set* is exactly the range
of codes the emitters above put on the wire, and the codes are known by their numeric value.

### The drip driver — coin and credit ticks

The audible tick that accompanies coins and credits being tallied up is produced by a trio of
near-identical per-frame steps run in fixed order by `serviceCoinCreditAndCountersUnlessFreePlay`:
`loc_5a06` [code] (variant A), `accrueCreditFromCoin1Pulse` [seen] (variant C), and
`accrueCreditsFromCoinSlot2` [code] (variant B). Each step keeps its own small cadence ring —
`DRIP_RING_A` [code], `DRIP_RING_C` [code], and `DRIP_RING_B` [code] respectively — into which
it rotates one bit sampled from the input port every frame. Only when a ring's low three bits
settle on the fire phase (value 1) does the step act: it calls `emitPresetSound` to latch the
preset drip code 0x0b directly, then advances its credit bookkeeping — bumping the running
`CREDIT_COUNT` [seen] through the shared tail `addCreditsAndQueueDisplay` [seen] (variant A) or
stepping the coin-pulse counters `COIN1_PULSE_COUNT` [seen] / `COIN2_PULSE_COUNT` [code] and
their coinage coordinate pairs before folding into the same accumulate tail (variants B and C).
The cadence ring is what turns a held-steady input level into a paced series of individual
"drip" chirps rather than one continuous tone: the sound fires on a phase of the ring, not on
every frame, so credits appear to count up one tick at a time.

### The fire and hit driver

Contact between the player's shot and an enemy is announced through the ring rather than the
immediate path. The proximity scan `loc_5f11` [code] walks the active enemy slots, and on a
slot that falls within the horizontal and vertical hit window it marks the slot struck, sets
the interrupt-parity flash cell (`FLASH_CELL_BASE` [code]) so the target flashes, and tails
into `loc_5f02` [code], a thin trampoline over `queueSoundCommand05` — enqueuing the hit code
0x05. The related reset handler `loc_6166` [code] picks between two codes when it clears an
actor record back to idle: it enqueues 0x08 when the active object type is 3 and 0x05
otherwise, so the sound of an object being cleared depends on what kind of object it was
(`ACTIVE_OBJECT_TYPE` [seen]). The enemy-record finder `loc_611f` [code] likewise enqueues 0x05
when its scan finds no match, except when the object type is 3.

### The siren driver

The warning that a wave is imminent is armed by `loc_196e` [code], a gated periodic driver run
each active-gameplay frame. It does nothing while its busy latch (`PERIODIC_MODE_LATCH` [code])
is set. The spawn-phase value (`SPAWN_PHASE_COUNTER` [seen]) selects the behaviour: at exactly
phase 5 it arms a pair of enable cells — the siren gate (`SIREN_ENABLE_GATE` [code]) when no
grab is active, otherwise a caller-supplied pair — and, when the pair's first cell was free,
fires the mode-five run `queueSoundCommands96And97And18And15`; above phase 5 it latches the
value into the busy latch and, when no grab is active, fires `queueSoundCommands19And15`. After
that mode work it runs a shared event countdown: unless the wave-event latch
(`WAVE_EVENT_LATCH` [seen]) or the wave-teardown state (`WAVE_TEARDOWN_STATE` [seen]) is
already set, it ticks `PERIODIC_EVENT_TIMER` [code] down, and on expiry reloads the timer
(0x20), raises the wave-event latch, and fires `queueSirenSoundRun` [code]. That run appends,
when the siren gate is clear, a round-selected lead byte (base 0x1a, plus the round counter's
low bit) followed by the completing run — so the siren note alternates with the stage.

A companion tick, `loc_19ca` [code], drives the attract-mode siren animation rather than the
audio ring: it runs only while no game is active and the siren-enable gate is set, decrements a
frame countdown (reload 0x18), and on each expiry toggles the siren phase byte
(`SIREN_PHASE_BYTE` [code]) and enqueues one of two *display* commands (`SIREN_DISPLAY_CMD_A` /
`SIREN_DISPLAY_CMD_B` [code]) — the visible warning tiles that accompany the siren feature,
distinct from the latched audio codes above.

### The record/replay audio model

At the machine boundary the audio subsystem is modelled by replay of recorded clips, not by
emulating the audio CPU. The manifest declares a `clips` model with a single `soundLatch` at
0xa100 and deliberately exposes no separate control port: the IRQ-strobe latch at 0xa181 is
never surfaced to the player, so the replay engine keys purely off the write to 0xa100. Every
byte the main CPU latches there selects the clip recorded for that command; the offline
recorder captured one clip per command code, and the audio-CPU ROM is carried only as a
disassembly target, never executed in the port. In machine terms, then, the entire audible
output is a function of the sequence of bytes that arrive at the soundlatch — precisely the
stream the command ring meters out one byte per frame — and reproducing that byte stream
reproduces the game's sound.

## Anti-tamper

Pooyan's program does not trust itself. Scattered through nearly every subsystem — spawning, actor
stepping, the HUD, credit accounting, the high-score table — sit small integrity guards that
re-checksum fixed regions of the ROM against baked-in reference values and quietly record any
deviation. What makes the scheme resistant to defeat is that a guard almost never reacts where it
fires: detection and punishment live in different routines, usually subsystems apart. A patched byte
therefore does not crash the game at the guard that notices it; the machine degrades later, and
elsewhere, in a plausible-looking way. The whole is a web of tripwires and deferred sabotage rather
than one boot-time checksum.

The regions two guards sample through hardware-visible reads — `SIGNATURE_SAMPLE_BASE` [seen] against
`SIGNATURE_REFERENCE_TABLE` [seen], and `HISCORE_CHECKSUM_BASE` [seen] — are confirmed against the
real ROM. The guard routines themselves and the tally cells they write read [code]: on an intact
image every tally stays at zero, which is where they sit throughout normal play.

### The guards, and where they hide

The guards take two shapes. Some **compare** a live program window byte-for-byte against a stored
reference; others **fold** a fixed block into a rolling sum (or carry count) and test it against a
hard sentinel constant. Both kinds are deliberately buried inside routines that have unrelated,
legitimate day-jobs, so the check runs organically as the game plays rather than as a conspicuous
verifier.

The clearest comparison guards ride inside the actor state machine. `loc_2a79` [code], the actor
state-4 handler, runs a 0x68-byte byte-for-byte compare of a fixed program window
(`STATE4_SIGCHECK_CODE_BASE_ADDR` [code]) against a stored reference block
(`STATE5_SIGCHECK_REF_TOP` [code]), both read upward; the first differing byte tail-jumps into the
state-1 handler `loc_29a0` — a tamper re-entry off the normal path — while an intact image matches
all 0x68 bytes and the handler simply reseats the record's frame-hold, clears its flip bit, and
advances its state. `loc_2a96` [code], the state-5 handler, does the mirror check: a 0x20-byte
reversed-signature compare of the `loc_67df` code window against its reference block, advancing the
record on a full match and tail-jumping the state-2 handler on any mismatch. Disguised as ordinary
per-actor animation stepping, these run every time those actor states are serviced.

The fold guards are woven into the spawn and per-frame paths. `loc_5594` [code], the frame-timer
spawner tail, walks an actor-block table for the first free slot and, before seeding it, sums the
eight bytes of `INTEGRITY_GUARD_REGION_0BAD` [code] against its two's-complement signature
`INTEGRITY_GUARD_SIGNATURE_55B5` [code]; if any byte-pair fails to cancel to zero it bumps
`TAMPER_FREEZE_FLAG` [code]. Its twin `loc_5544` [code] is the identical spawn-scheduler tail with
no check — the guard is folded into one of the two spawn paths so it fires whenever that spawner
seeds an actor. In the same spirit `loc_5835` [code], which spawns the singleton actor, tail-runs
`verifyTableChecksum` over `CHECKSUM_ROM_BASE` [code] (0x52 bytes) as its final act.

`advanceFallingEnemyAndTallyCatchOnLanding` [code], the object catch handler, folds bytes downward
from `CATCH_TAMPER_CKSUM_TOP` [code] to a terminator while counting carries, and expects exactly
eight carries; a wrong count raises `TAMPER_STRIKES_CATCH` [code]. The check hides on the special
path of the routine that scores a caught enemy and zeroes the stage countdown.
`advanceActorStateOnTimerWithTamperCheck` [seen] carries another: only when a record has advanced
into the object-table band (`SPRITE_OBJECT_TABLE` [seen]) *and* the free-running `FRAME_COUNTER`
[seen] is at its zero crossing does it fold `ACTOR_TAMPER_CKSUM_TOP` [code] backward to a `0x1a`
terminator and test the masked result; a nonzero result bumps `SIGNATURE_MISMATCH_FLAG` [code].
`loc_4103` [code] performs a companion frame-zero-crossing signature fold that bumps
`TAMPER_STRIKES_SIG` [code].

Two more fire on play-state transitions. `loc_1b43` [code], a play-state handler, folds a 34-byte
block from `TAMPER_CKSUM_BASE_5593` [code] with a mask/rotate/add-with-carry step and demands the
result be exactly `0x7c`; anything else bumps `TAMPER_FREEZE_FLAG`.
`flagTamperOnRound5ChecksumMiss` [code] is armed only once `ROUND_COUNTER` reaches 5: it sums six
program bytes and requires `(low sum + carry count + 0x7f)` to wrap to zero, bumping
`TAMPER_FREEZE_FLAG` on any imbalance — a tripwire that only bites a player who has gotten deep.

The attract/boot-time guards read as dedicated verifiers. `verifyRomSignature` [code] compares
`SIGNATURE_REFERENCE_TABLE` against every eighth byte of `SIGNATURE_SAMPLE_BASE` and sets
`SIGNATURE_MISMATCH_FLAG` on the first byte that differs. `verifyRomChecksum` [code] sums sixteen
bytes descending from `ROM_CHECKSUM_TOP` [code] and requires a precise bit shape (bit 0 clear, bit 5
set, bit 7 set); any other shape bumps `TAMPER_STRIKES_STATE10` [code]. `verifyTableChecksum` [code]
is the parametric summer the others reuse — it accumulates a run into a 16-bit total and demands high
byte `0x1d`, low byte `0xc1`, raising `TAMPER_ROM_CHECK_FLAG` [code] otherwise.
`flagHighScoreTableCorruptOnChecksumMiss` [code] guards the saved scores: the block's header byte
must be the `0xc8` marker and the four-byte sum minus its carry count must equal `0x59`, else it sets
`HISCORE_TABLE_CORRUPT_FLAG` [code].

The same fold-and-compare pattern recurs beyond these — the credit-draw tripwire `loc_05ee` [code],
the gated slot sweep `loc_52f6` [code], the periodic ROM guard `loc_7e6d` [code], the shared
integrity/timer handler `loc_7960` [code] and its tail checksum `loc_79e9` [code], the once-only
playfield tile-region checksums `loc_68ac` [code] and `loc_6a7f` [code], the level-intro
block-against-copy compare `loc_6f9d` [code], and the player-bank signature tripwire `loc_1bcc`
[code] — each summing its own fixed block and writing its own tally on deviation.

### The tally cells

The guards report into a small population of flags and counters, all [code] and all zero on a clean
image.

Two flags act as master freezes that gate whole subsystems. `TAMPER_FREEZE_FLAG` is the primary one,
bumped by `loc_5594`, `loc_1b43`, and `flagTamperOnRound5ChecksumMiss`; nonzero it freezes spawns,
aborts the lead-actor dispatch, and suppresses HUD setup. `SIGNATURE_MISMATCH_FLAG`, bumped by
`verifyRomSignature` and `advanceActorStateOnTimerWithTamperCheck`, gates the spawn path and object
seating. `TAMPER_OBJECT_FREEZE_FLAG` [code] is set by the attract-reset guard and cleared at board
reset; combined with the board-clear flag it freezes per-frame object work. `TAMPER_ROM_CHECK_FLAG`
and `HISCORE_TABLE_CORRUPT_FLAG` are consumed on the credit and high-score paths.

The strike **counters** cluster in an integrity-flag table that begins at `INTEGRITY_FLAG_SCAN_BASE`
(0x89e7): `TAMPER_STRIKES_SLOTSWEEP`, `TAMPER_STRIKES_OBJMOVE`, `CREDIT_TAMPER_COUNTER`,
`TAMPER_STRIKES_CATCH`, and `TAMPER_STRIKES_STATE0` [code] sit here, with a second cluster near
0x8a38 — `TAMPER_STRIKES_SIG`, `TAMPER_STRIKES_STATE10`, `TAMPER_STRIKES_OBJSIG`,
`TAMPER_STRIKES_HUD_GUARD` [code] — and `TAMPER_STRIKES_TERMINATOR` [code] standing alone at 0x8df9.
Each counter is the private tally of a single guard, and each is read back by a different routine
entirely.

### What a nonzero tally does

A raised tally never halts the machine cleanly; it steers a distant routine into subtly wrong
behavior. The consequences fall into three broad families plus a scattering of point sabotages.

**Freeze spawns.** `loc_6e75` [code], the phase-1 spawner gate, runs the object launcher and
per-record driver only while both `SIGNATURE_MISMATCH_FLAG` and `TAMPER_FREEZE_FLAG` are clear; with
either set, its alternate path jumps into what is data rather than code — a dead trap that spawns
nothing. `loc_6523` [code] refuses to seat a fresh object record while `SIGNATURE_MISMATCH_FLAG` is
held. And because `loc_5594`'s own guard bumps `TAMPER_FREEZE_FLAG`, a tampered image feeds that
freeze straight back into these gates.

**Abort actor updates.** `advanceLeadActorPrimaryState` [seen] runs its three per-frame sub-passes
and then, if `TAMPER_FREEZE_FLAG` is set, returns before dispatching the lead actor's state handler
at all — the player-controlled actor stops advancing. `loc_1e55` [code], the per-frame joystick
sampler, zeroes the player's aim byte whenever `TAMPER_OBJECT_FREEZE_FLAG` (or the board-clear flag)
is set, killing input. `dropLeadActorAfterDelay` [seen] is quieter still: on its timer expiry it
normally reseeds the delay and advances the actor's state, but if `TAMPER_STRIKES_STATE10` is nonzero
it instead writes that strike value into an unrelated address, corrupting rather than advancing.
`beginLeadActorLiftOnClear` [seen] simply declines to start the lead-actor lift while
`TAMPER_STRIKES_SLOTSWEEP` or `TAMPER_STRIKES_ROM` is set. `addRopeSegmentAndAdvanceExtendState`
[seen] turns a strike into visible garbage: past its normal segment limit it keeps extending the rope
only when `TAMPER_STRIKES_ROM` is nonzero, and then uses the strike value itself as the index into
the rope-column table — drawing the rope from the wrong columns.

**Skip or divert the HUD.** `paintRoundNumberHud` [seen] builds the round-number HUD only on the pass
where `TAMPER_FREEZE_FLAG` is clear; with the freeze up it jumps straight to the per-frame update
chain and never redraws the round indicator. `tickHudRefresh` [code] falls through into the state-3
gameplay dispatch only while `TAMPER_STRIKES_ROM` is nonzero, so a tampered image leaves the HUD tick
along a different control path than a clean one. `copyDisplayTilesIntoActorRecords` [seen] diverts to
the board/HUD reset path when `TAMPER_STRIKES_TERMINATOR` (or the board-clear flag) is set.

**Point sabotages.** `spawnTargetActorOnLaunchTrigger` [seen], finding both target slots busy, tails
into a tamper re-scan only if `TAMPER_STRIKES_HUD_GUARD` is nonzero. `movePlayerDownAndTickStatusRender`
[seen] scans the `TAMPER_STRIKES_SIG` block and forces a render branch when any of those strikes is
set. On the coin path, `verifyTableChecksum`'s `TAMPER_ROM_CHECK_FLAG` and the `CREDIT_TAMPER_COUNTER`
are read by `accrueCreditFromCoin1Pulse` [seen] and `startSelectedPlayerGameConsumingCredits` [code],
letting a tampered image misbehave around credit accounting.

The through-line is consistent: each guard writes a cell, and a distant, ordinary-looking routine
reads it and does something slightly wrong — a mis-indexed rope, an un-drawn round number, a dispatch
that takes the other branch, a spawn that lands in data. Because the punishing routine is far from the
checking routine, and because the punishment mimics a plausible malfunction rather than an obvious
crash, the protection resists both static patching and casual observation.

## Open questions

These are the readings the code fixes but MAME has not yet confirmed, plus the paths no capture has exercised. Each is a work item for a following grounding pass.

- **Sound byte-to-effect map.** The page-0x8a sound-command FIFO is [seen] as a FIFO that reaches the audio CPU, but which specific sound each command byte (0x00..0x28, and the high-bit bytes 0x82/0x95/0x96/0x97) selects is [code]/[guess] — it needs an audio-side grounding pass that watches the audio CPU, not just the latch.
- **Foreground scroll worker 0x0254.** Whether it does load-bearing drawing during live play or is an attract/idle task is unsettled; its gating control byte 0x883f is [code]-only and its scroll-column duties overlap the vblank NMI's own column rebuild (0x0714).
- **Coin path beyond slot 1.** Slot 2 bumps a pulse counter at 0x8826 but only slot 1's counter (0x8824) has a wired coin-meter strobe, so whether 0x8826 drives a second physical meter is unconfirmed; and the third acceptor (input bit 2, flat +1 credit, no coinage or meter) is unlabelled as service-credit vs a third coin slot.
- **Phase-gauge cell 0x8908 dual use.** It is [seen] draining 3→0 as a phase gauge, yet another routine bumps the same cell saturating on a bonus-award threshold no golden reached; the two uses need a scoring-active capture to reconcile.
- **The six-slot object-state array 0x8ba0.** Its arm/advance/draw/integrity four-way machine and the per-pool overloading of the shared 0x18-byte record fields are [code]-only — no golden exercised a full cycle.
- **Formation / band-build / intro-launch.** The formation-spawn timer (0x8d30) and the band-build arm latch (0x8f63) are static-0 in every golden, so those paths — including the rope-extend tamper-strike branch and the formation phase-handler table at 0x30eb — are [code]-only, unconfirmed by MAME.
- **Display-command ring drain.** The ring cells are [code], never watched transitioning in a golden, and the display-command handler table's per-type mapping is not enumerated, so which screen region each command word repaints is inferred from the enqueue sites rather than confirmed by watching the ring drain.
