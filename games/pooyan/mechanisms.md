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

Every mutable thing about a Pooyan machine — one credit, the current attack wave, where
the player is on the rope, the ten high scores — lives in one flat Z80 address space. The
lower half is the 32KB program ROM at `0x0000`-`0x7FFF`; the upper half is a small set of
RAM regions and a memory-mapped I/O window. Two of those regions are the picture the CRT
draws, two more are the sprite hardware's shadow registers, and one 2KB block is the game's
entire scratch state — the counters, flags, pointers, and record tables the code reads and
rewrites every frame. Understanding the machine is largely a matter of understanding how
that 2KB block is partitioned and how a small set of state selectors in it steer the
per-frame work.

### The address space and its two video planes

The picture is built from two parallel planes that cover the same 32-by-32 grid of 8-by-8
tiles. **Video RAM** at `0x8400`-`0x87FF` holds one *tile code* per cell, and **colour RAM**
at `0x8000`-`0x83FF` holds one *attribute byte* per cell at the matching offset. The two are
read together when a cell is painted: the code selects one of 256 four-bit-per-pixel tile
images, the attribute's low nibble selects which sixteen-colour palette bank the tile draws
in, and attribute bits 6 and 7 flip the tile in X and Y. The tilemap is a single opaque
layer — every cell is drawn, pen 0 included, with no priority split — so it forms the
backdrop that sprites are then painted over. There is no hardware scroll; the code animates
the playfield by rewriting tile codes in place (the marching tile strip driven from
`TILE_ANIM_CURSOR` [seen] is a typical example), and a flipped screen is handled at paint
time as a plain mirror of both the cell index and the per-tile flip flags.

Sprites live in a separate pair of 256-byte banks at `0x9000` and `0x9400`, selected by
address bit `0x0400` (the surrounding range is a don't-care mirror of these two banks). A
sprite's four bytes are split across the two banks at the same offset: bank 0 carries its X
position and tile code, bank 1 carries a control byte (colour in the low nibble, an
active-low flip-X bit, a flip-Y bit) and its Y as `240 - y`. The renderer walks the display
entries from the low offset upward to the high one, so when two sprites overlap the
higher-offset entry wins — the opposite convention from the tilemap, and a place a
plausible-but-wrong port would invert the priority.

### The hardware I/O window

Everything from `0xA000` up is device space, decoded by don't-care bit masks rather than
tidy ranges, and a read and a write to the same address are two different devices. `0xA000`
reads dip-switch bank `DSW1_PORT` [code] but writes kick the watchdog; the three controller
ports `IN0`/`IN1`/`IN2` sit at `0xA080`/`IN1_PORT` [code]/`IN2_PORT` [code] and read
*active-low* (an idle port reads `0xFF`, a pressed bit reads 0); `DSW0_PORT` [code] is at
`0xA0E0`. Writes to `0xA100` drop a byte into the `SOUND_COMMAND_LATCH` [seen] bound for the
audio CPU. The board's eight discrete control outputs are an LS259 latch strung across
`0xA180`-`0xA187`, one address per bit: the write's data bit lands in the bit selected by the
low three address lines. Those bits are the vblank-NMI enable at `NMI_ENABLE_LATCH` [code],
the audio IRQ strobe and mute, the two coin counters, an unused payout line, and the
inverted flip-screen output at `FLIP_SCREEN_LATCH` [code] (latch 0 means a flipped screen).
Notably there is *no* video-enable bit — the display is always on.

### The work-RAM state model — `0x8800`-`0x8FFF`

The 2KB work RAM is the machine's state, and it is laid out in recognisable zones.

**Machine and configuration, at the base.** The bytes just above `0x8800` hold the
cabinet-level state that outlives any one life: the BCD `CREDIT_COUNT` [seen] (bumped by a
coin, spent one per single-player start and two per two-player start), and a cluster of
values the boot code decodes once from the dip switches and leaves standing — the
`LIVES_DSW` [code] life count, the three-bit `DIFFICULTY_DSW` [code] that scales the spawn
schedules, the `COINAGE_CONFIG` [seen] nibble that credit logic tests for free play, the
`CABINET_MODE_FLAG` [code], `DEMO_SOUNDS_DSW` [code], and the `BONUS_AWARD_DSW` [code] that
picks the extra-life schedule. Two flags here gate almost everything downstream:
`GAME_ACTIVE_FLAG` [seen] is set at the start of a life and cleared at game over (idle
gameplay handlers return early when it is clear), and `FLIP_SCREEN_FLAG` [seen] is the
software copy of the screen orientation that the interrupt epilogue pushes out to the
flip-screen latch each frame. The anti-tamper `TAMPER_FREEZE_FLAG` [code] also lives here;
when the program's own ROM checksums miss, it goes nonzero and freezes spawns and actor
updates — a dead path in honest play.

**The input edge-detect ring.** Directly above the config block, `INPUT_PORT0` [seen] and
its two neighbours hold the current frame's three controller ports, sampled and complemented
so a pressed bit reads as a 1. The interrupt service keeps a rolling copy of the prior
frames just above them, so edge-triggered controls (coin insert, start buttons, a single
shot) can be detected as a bit that is set this frame but was clear last frame rather than
re-firing while a button is held.

**The sprite display list and the two output rings.** A 24-entry, four-byte-per-entry sprite
display list is assembled in work RAM at `SPRITE_DISPLAY_LIST` [seen], with the actor-record
slots (`SPRITE_ACTOR_RECORD_SLOTS` [seen]) and proximity-target slots (`SPRITE_TARGET_SLOTS`
[seen]) interleaved through it; it is rebuilt every frame and copied out to the sprite banks.
Just below it the `WORKER_CONTROL_BYTE` [code] flags what the per-frame worker must do.
Two ring buffers decouple the game logic from its two slower outputs. The **display-command
ring** occupies `DISPLAY_CMD_RING_BUFFER` [code] (`0x88C0`-`0x88FF`, thirty-two two-byte
slots that boot fills with `0xFF` for empty), with producers advancing `DISPLAY_CMD_RING_WRITE_PTR`
[code] and the main loop consuming at `DISPLAY_CMD_RING_READ_PTR` [code]. The **sound-command
ring** works the same way at `SOUND_RING_BUFFER` [code] with its own write and read cursors,
feeding bytes to the audio CPU through the sound latch. Both rings are how work done inside
the frame is handed to a consumer that drains it after.

**Scores and the high-score table.** Each player keeps a three-byte packed-BCD score buffer —
`P1_SCORE_BCD` [seen] and `P2_SCORE_BCD` [seen] — and the active buffer is chosen by the
current player selector. The all-time top score sits just above them ending at
`HIGH_SCORE_BCD_HI` [seen], and the full sorted ten-entry, three-byte-per-entry
`HIGH_SCORE_TABLE` [code] lives on the `0x8A` page, insert-sorted at game over and rendered
onto the attract screen.

**The live page and the two player banks.** This is the central idea of the state model for a
two-player game. One "live" page beginning at `0x8900` holds the state of the round currently
being played — the `SPEED_INDEX` [seen], the per-stage `STAGE_COUNTDOWN` [seen], the
`ROUND_COUNTER` [seen] and `ROUND_IN_PROGRESS` [seen] flag, the rope's `ROPE_SEGMENT_COUNT`
[seen], the `GAUGE_PHASE_COUNTER` [seen] drawn as the vertical HUD gauge, and the rest of the
per-round bookkeeping. When play passes between the two players, that whole page is copied
into a saved bank — `PLAYER0_STATE_BANK` [seen] or `PLAYER1_STATE_BANK` [seen], each a
`0x3F`-byte block — and the other player's saved bank is copied back into the live page. The
choice of which bank is live is driven by `ACTIVE_PLAYER` [seen] (with `TWO_PLAYER_FLAG`
[seen] marking a two-player game at all); each bank carries that player's remaining
`PLAYER0_LIVES` [seen] / `PLAYER1_LIVES` [seen], seeded from the lives dip switch and drained
one per death, and it is a life reaching zero that gates the player switch and, eventually,
game over.

**The actor arena and its record tables.** The moving objects share one array of fixed-size
records. The main arena begins at `ACTOR_TABLE` [seen], `0x18` bytes per record, zero-filled
at board init; slot 0 is the player/lead actor, whose vertical position is `PLAYER_Y` [seen]
(the sprite Y values are derived from it, and enemy AI reads it to aim dives), whose joystick
and aim bits are `PLAYER_AIM_FLAGS` [seen], and whose animation phase is `LEAD_ACTOR_STATE`
[seen]. The enemy actors continue in the same stride from `ENEMY_ACTOR_TABLE` [seen], and a
family of parallel record tables handles the other object classes at the same `0x18` stride —
the projectile table at `PROJECTILE_TABLE` [seen], the object/sprite pool at
`SPRITE_OBJECT_TABLE` [seen], the formation records at `FORMATION_TABLE` [seen], the hunter
records at `HUNTER_TABLE_BASE` [code], and the two I-parity target records `ENEMY_TARGET_REC0`
[seen] / `ENEMY_TARGET_REC1` [seen] with their live `EAGLE_X_COORD` [code] / `EAGLE_Y_COORD`
[code]. The per-frame code walks these tables and dispatches each record on a sub-state byte
inside it, so the record tables are themselves a large part of the state model.

**Sub-machine state on the high pages.** The `0x8D`, `0x8E`, and `0x8F` pages carry the
per-frame counters and the state selectors for the individual sub-systems: spawn cadence
(`ENEMY_SPAWN_TIMER` [seen], `ACTIVE_ENEMY_COUNT` [seen]), the attract text script
(`SCRIPT_FRAME_TIMER` [seen], `SCRIPT_WRITE_PTR` [seen]), the display-list interpreter's
source and destination pointers (`DISPLAY_LIST_SRC_PTR` [seen], `DISPLAY_LIST_DST_PTR`
[seen]), and the small state machines that drive launches and formations —
`LAUNCH_STATE` [seen], `FORMATION_STATE` [seen], `WAVE_TEARDOWN_STATE` [seen],
`WAVE_INDEX` [seen], the `INTRO_PHASE_INDEX` [code] level-intro selector, and the
`PLAY_MODE_LATCH` [code]. A free-running `FRAME_COUNTER` [seen] on the `0x8A` page,
decremented every interrupt, provides the shared time base whose low bits phase animations
and whose zero-crossings gate the periodic integrity checks.

**The stack.** The very top of work RAM is the CPU stack: boot seeds the stack pointer to
`0x9000` and the stack grows downward through the `STACK_SCRATCH` window (`0x8FC0`-`0x9000`).
One deliberate unbalanced push at boot reserves the top word so that `ROM_SELFTEST_TALLY`
[code] at `0x8FFF` sits just above the stack and the interrupt's register save cannot clobber
it.

### The dispatch model — how per-frame work reads the state cells

Two engines run against this state each frame, and they are decoupled through the
display-command ring.

The heartbeat is the **vblank NMI service** (`loc_066d`), taken once per frame while the
NMI-enable latch bit is set. It saves the full register file, masks its own interrupt,
rebuilds the scrolling tile columns, and samples the three controller ports (complemented)
into the input ring while shuffling the previous frame's samples up for edge detection. It
kicks the watchdog, ticks the two per-frame counters — `WORKER_CONTROL_BYTE` and the
free-running `FRAME_COUNTER` [seen] — and then makes the machine's top-level decision: it
reads `MAIN_GAME_STATE` [seen] and dispatches through a five-entry jump table to the handler
for that state — the boot/attract-setup handler (`loc_072d`), the attract/demo driver
(`dispatchAttractSubstate`), the board-build state dispatcher (`loc_0c4e`), the play handler
(`runPlayStateFrame`), and a no-op state (`noopStateHandler`). Whichever handler runs returns into the service routine's
epilogue, which copies `FLIP_SCREEN_FLAG` [seen] out to the flip-screen latch, restores every
register, re-arms the NMI, and returns to the interrupted foreground.

The top-level state selector is only the first of several nested selectors, each a work-RAM
cell dispatched through its own table. Inside the attract state, `ATTRACT_SUBSTATE` [seen]
steps the demo sequence through the table at `ATTRACT_SUBSTATE_DISPATCH` [code]. Inside the
play state, `PLAY_STATE_INDEX` [seen] (masked to five bits) selects the in-play sub-phase.
Below those, the object handlers dispatch each actor record on its own sub-state byte, and the
launch, formation, teardown, and level-intro machines each turn on their own selector cell.
The whole per-frame behaviour is thus a tree of table dispatches rooted at `MAIN_GAME_STATE`,
every node of which is a byte in this same 2KB block.

The second engine is the **foreground main loop** (`mainLoop`, at ROM `0x020F`), and it is
where the display-command ring closes the loop. The main loop free-runs with no wait of its
own: each pass it reads the ring read cursor and looks at the slot it points to. A slot marked
empty (the boot `0xFF` fill, whose high bit is set) means there is no command pending, so the
pass runs the **per-frame worker** — the routine that assembles the sprite display list and
paints the pending video work; a slot holding a real command index instead dispatches that
command through the display-command handler table and advances the ring cursor, wrapping
within the `0x88C0`-`0x88FF` buffer. The NMI-side game handlers never draw directly: as they
run they *enqueue* display commands into the ring, and the main loop drains every queued
command before the worker runs again. That draining is the true frame boundary — the machine
keeps consuming commands until the ring is empty and only then does the worker produce a
frame — which is why a backlog built up during, say, the credit screen must be flushed within
a single frame rather than one command per interrupt. Sound is handed off the same way,
through the sound-command ring to the audio CPU. The anti-tamper freeze flags
(`TAMPER_FREEZE_FLAG` [code], `BOARD_CLEAR_FLAG` [code], and their siblings) sit across this
whole flow as gates: when set they short-circuit the per-frame object updates and divert the
handlers, so in honest play they read zero and the dispatch tree runs to completion every
frame.

## The frame loop and the vblank heartbeat

Pooyan runs on two cooperating spines. A foreground main loop never stops turning: it
renders whatever the game has asked for and stays busy doing so. A vblank interrupt fires
sixty times a second and is where the game actually thinks — it reads the controls, ticks
the clocks, and advances the top-level state machine, dropping drawing work onto a queue
that the foreground loop then consumes. The two never call each other directly; they meet
only over the display-command ring, one filling it and the other draining it. Boot exists to
build that arrangement and set it running.

### Reset and boot

Power-on lands at `loc_0000`, the reset vector. Its first act is to hold the vblank interrupt
off — it clears `NMI_ENABLE_LATCH` [code] (bit 0 of the output latch) so nothing can preempt
the setup that follows — and then it falls straight into the boot entry `loc_0092`. The
interrupt-off is only a shutter over the boot: `loc_0092` re-opens it before finishing, so once
the machine is live this transient leaves no lasting mark.

`loc_0092` first proves the program memory is intact, then lays down the entire initial state.
The self-test walks the eight program banks, keeping a 24-bit rolling sum per bank as three
bytes and comparing each against a checksum table; a tally seeded with the bank count is
bumped once per matching bank, so a wholly-intact image lands at exactly twice the bank count.
That tally is deliberately parked at the very top of work RAM, above the stack, so the register
save that every later vblank performs cannot overwrite it — a passing tally is the gate the
attract-to-play setup will later insist on. With the memory vouched for, the boot zeroes work
RAM, marks both the display-command ring (`DISPLAY_CMD_RING_BUFFER`) and the sound-command
ring (`SOUND_RING_BUFFER`) empty and parks each ring's read and write cursors at its origin,
sets the orientation to upright by writing both `FLIP_SCREEN_FLAG` [seen] and its hardware
`FLIP_SCREEN_LATCH` [code], floods the colour map, arms the row-by-row tile fill, decodes the
two DIP-switch ports into their config cells, clears the sprite banks and blanks the lower
tile map, and silences the audio processor. Only then does it re-enable the heartbeat, writing
1 to `NMI_ENABLE_LATCH` [code], and lay down the default high-score table. Its final act is to
enter the main loop — from here the machine is live, and control never returns to boot.

### The foreground main loop

The main loop is `loc_020f` (`mainLoop`) [code], and its defining trait is that it never blocks.
There is no wait-for-vblank, no idle spin: the loop is a consumer of the display-command ring.
Each turn it reads the ring's read cursor `DISPLAY_CMD_RING_READ_PTR` [code] — a low byte that
walks the 0xc0..0xff window of page 0x88 — and fetches the slot it points at. A slot whose top
bit is set means the ring is idle; that is the loop's signal to run the per-frame scroll worker
`loc_0254` [code], which repaints the two scrolling tile columns (the second of them at
`WORKER_COLUMN_VRAM` [seen]) or, when the worker control byte's low nibble is set, runs a program-
signature check instead. Any other slot is a pending drawing request: the loop frees that slot, advances
the read cursor (wrapping back to the 0xc0 origin at the top of the window), and runs the named
display handler, which returns to the loop top. So within a single frame the loop empties the
ring — every request the vblank left behind — and only when nothing remains does it run the
worker and let the frame close. Draining the whole ring per frame, rather than one request per
interrupt, is what keeps a backlog built during one screen from bleeding stale tiles onto the
next.

Because the loop stays busy this way, the machine's timing does not come from the foreground at
all. The rhythm is imposed entirely from outside, by the interrupt.

### The vblank heartbeat

Once per vertical blank the interrupt preempts whatever the foreground was doing. `loc_0066` is
a bare hop into the service routine `loc_066d`, which is the true per-frame worker. It opens by
pushing the complete register file — main set, shadow set, and both index registers — so the
interrupted foreground can be resumed untouched, and immediately masks itself by clearing
`NMI_ENABLE_LATCH` [code] so no second vblank can re-enter while it runs.

With the machine to itself, it does the frame's housekeeping in order. It refreshes the screen's
moving parts, copying the sprite display list `SPRITE_DISPLAY_LIST` [seen] into the hardware
sprite registers through `loc_0714` [code] — four separate groups when the play sub-state index
`PLAY_STATE_INDEX` [seen] is at its fourth value, otherwise a single taller group. It kicks the
hardware watchdog (the write side of `DSW1_PORT` [code]) so the board does not reset out from
under it. It then samples the controls: it slides the previous frame's readings down into a
history so handlers can spot a freshly-pressed edge, and reads the three hardware input ports
`IN2_PORT`, `IN1_PORT`, and `IN0_PORT` [code], complementing each (the ports are active-low) into
the sample ring headed by `INPUT_PORT0` [seen], where coin sits in bit 0, one-player start in
bit 3, and two-player start in bit 4. It advances the frame clocks: the free-running
`FRAME_COUNTER` [seen], whose low bits phase the animation and whose zero-crossings gate the
integrity checks, and the `WORKER_CONTROL_BYTE` [code], whose countdown is what periodically arms
the foreground worker's signature check. Finally it services credits and coinage through
`loc_59e8` [code] and hands one queued entry from the sound ring to the audio processor via
`drainSoundCommandRing` [seen].

Then comes the frame's real work — the state dispatch below — after which the routine reaches its
epilogue. There it publishes the orientation, copying `FLIP_SCREEN_FLAG` [seen] into the hardware
`FLIP_SCREEN_LATCH` [code], restores every register it saved, re-arms itself by writing 1 back to
`NMI_ENABLE_LATCH` [code], and returns to the exact foreground instruction it interrupted. The
foreground picks up mid-drain and consumes whatever new drawing requests the interrupt just
enqueued. Producer and consumer, meeting only over the ring: the vblank writes commands (behind
`DISPLAY_CMD_RING_WRITE_PTR` [code]), the main loop reads them (behind `DISPLAY_CMD_RING_READ_PTR`
[code]).

### The main-state dispatch

The centre of every vblank is a single outermost mode switch. `loc_066d` reads the top-level
selector `MAIN_GAME_STATE` [seen] and jumps through a five-entry table, so exactly one of the
machine's worlds gets a tick this frame:

- **0 — attract setup** (`loc_072d` [code]): blanks the tile map one row at a time, and once the
  boot self-test has been vouched, finishes the attract-to-play setup and steps the selector on.
- **1 — attract/demo** (`dispatchAttractSubstate` [seen]): drives the attract sequence and its
  self-playing demo.
- **2 — board build** (`loc_0c4e` [code]): the dispatcher that assembles a board before play.
- **3 — play** (`runPlayStateFrame` [seen]): the in-play frame handler — the gameplay itself.
- **4 — idle** (`noopStateHandler` [code]): a handler that draws nothing and returns at once.

Whichever handler runs returns into the vblank epilogue described above, so the selection is
made fresh every frame. The handlers themselves are what change `MAIN_GAME_STATE` as the game
crosses between phases — attract giving way to a build, a build to play, play back to attract —
so this one selector is the spine along which the whole machine walks from mode to mode, and each
heartbeat asks it anew which world to advance.

## Configuration, coinage and players

Everything the operator sets on the two DIP-switch banks, everything the coin door reports, and
everything that distinguishes one player's game from a second player's is funnelled through a small
band of work-RAM cells at the bottom of the 0x8800 page. The boot decodes the switches into that band
exactly once, the vblank service routine keeps the coin door and credit total current every frame, and
the play code reads the band whenever it needs to know how many lives to hand out, whether a second
player is waiting, or which way the monitor is pointing. This section follows that config band from
power-on through inserting a coin, pressing start, and handing the machine back and forth between two
players.

### Cabinet orientation

Pooyan is a vertical game: the emulated screen is 256x224 presented at ROT90. The board can also be
mounted in a cocktail cabinet, and the machine carries two separate notions of "which way is up." The
static one is `CABINET_MODE_FLAG` (0x880f) [code], decoded once at boot from a DIP switch — nonzero for
an upright cabinet, zero for a cocktail table where two players sit across from each other. The dynamic
one is `FLIP_SCREEN_FLAG` (0x881f) [seen], which says whether the picture is currently drawn normally or
turned around: 1 is normal upright, 0 is flipped. The boot seeds both the flag and the hardware latch to
1 (normal), and every vblank the service routine copies `FLIP_SCREEN_FLAG` out to the flip-screen bit of
the addressed output latch `FLIP_SCREEN_LATCH` (0xa187) [code], so the monitor tracks the flag one frame
at a time.

The flag does more than drive the hardware latch; it also decides whether sprites are geometrically
mirrored in software. `loc_0320` [code] — the routine that ticks a caller's frame counter — reads
`FLIP_SCREEN_FLAG` immediately after, and while it is nonzero it does nothing further, but once it reads
zero it mirrors the whole sprite display list vertically. That is the software half of a flip: the
hardware turns the raster around and this pass turns the sprite coordinates to match.

The two notions meet at the start of a two-player round. When a fresh round is built (`loc_1601` [code])
and the cabinet is a cocktail (`CABINET_MODE_FLAG` reads zero), the round-init code sets
`FLIP_SCREEN_FLAG` from the active player: player one's turn leaves it normal, player two's turn flips
it, so the player sitting opposite sees the screen the right way up. On an upright cabinet the flag is
left alone and the screen never turns. Player controls follow the same split — the service routine
samples player one's stick from `IN1_PORT` (0xa0a0) [code] and the second, cocktail-side stick from
`IN2_PORT` (0xa0c0) [code] — so the flipped picture is paired with the opposite player's inputs.

### Power-on: self-test and DIP decode

The boot entry `loc_0092` [code] builds the entire initial machine state, and part of that is turning the
two DIP-switch banks into the config band. It first runs the program-memory self-test — a 24-bit rolling
sum of each of the eight 4 KB banks compared against a checksum table, bumping a pass tally
(`ROM_SELFTEST_TALLY`, 0x8fff [code]) that a later attract gate insists reach its full-pass value — then
zeroes work RAM, marks both command rings empty, floods the colour map, and silences the audio side. With
that scaffolding in place it reads the switches.

DIP bank 1 is read from `DSW1_PORT` (0xa000) [code] (the read side; the write side of that same address is
the watchdog). The switches are active-low, so the port byte is complemented first, then rotated field by
field into the config cells. Bit 2 becomes `CABINET_MODE_FLAG` (upright vs cocktail). Bit 3 becomes
`BONUS_AWARD_DSW` (0x8800) [code], which later selects the extra-life award schedule. Bits 4-6 become
`DIFFICULTY_DSW` (0x8820) [code], the three-bit difficulty level. Bit 7 becomes `DEMO_SOUNDS_DSW` (0x8821)
[code], the attract-sound enable. Bits 0-1 select the starting lives count, stored to `LIVES_DSW` (0x8807)
[code]: the two-bit field maps to 3, 4, or 5 lives, with the fourth setting stored as 0xff.

DIP bank 0 is read from `DSW0_PORT` (0xa0e0) [code] and holds the two coin slots' coinage as packed
nibbles. Each nibble is looked up in the ROM coinage table `COINAGE_TABLE` (0x0053) [code]: the low nibble
resolves to `COINAGE_CONFIG` (0x882c) [seen] for slot 1 and the high nibble to `COINAGE_CONFIG_SLOT2`
(0x882f) [code] for slot 2. Each resolved byte packs the coinage ratio — the number of coins required in
its high nibble and the number of credits awarded in its low nibble — and a value of 0x0f marks that slot
free-play. With the defaults, both slots resolve to one-coin/one-credit. Finally the boot re-enables the
vblank interrupt through `NMI_ENABLE_LATCH` (0xa180) [code], lays down the default ten-entry high-score
table, clears the panel digit-source table `PANEL_DIGIT_SOURCE_TABLE` (0x89c0) [code], and hands off to
the main loop. None of these config cells is written again during a session —
they are boot-only settings the rest of the machine merely reads.

### The vblank heartbeat and input sampling

The single per-frame heartbeat is the vblank service routine at 0x066d. It masks its own interrupt at
`NMI_ENABLE_LATCH`, kicks the watchdog, rebuilds the scrolling tile columns, and samples the three input
ports. Each port is read active-low and complemented, so a pressed button reads as a set bit: `IN0_PORT`
(0xa080) [code] — the coin, service, and start buttons — lands in `INPUT_PORT0` (0x8810) [seen], player
one's `IN1_PORT` in the next cell, and the cocktail `IN2_PORT` in the one after. Those three bytes are the
head of a short edge-detect ring: each frame the previous samples are shifted down through the following
cells before the fresh ones are written, giving the coin and start logic a few frames of history to detect
a clean press rather than a held button. In `INPUT_PORT0` the meaningful bits are coin slot 1 at bit 0,
coin slot 2 at bit 1, service at bit 2, one-player start at bit 3, and two-player start at bit 4.

Having sampled input, the service routine ticks its free-running counters, runs the coin/credit chain
(below), and then dispatches on the top-level state `MAIN_GAME_STATE` (0x8805) [seen] — the selector that
routes each frame into the attract, intro, or play handler. When the dispatched handler returns, the
epilogue copies `FLIP_SCREEN_FLAG` to the hardware flip latch, restores the registers, re-arms the vblank
interrupt, and returns to the interrupted code.

### Coinage: accepting coins and awarding credits

The credit total lives in `CREDIT_COUNT` (0x8802) [seen], a BCD counter that a coin raises and a game
start consumes. The whole coin-handling chain runs once per frame from inside the service routine, entered
through `loc_59e8` [code]. Its first act is a free-play check: if either coinage slot reads the free-play
sentinel 0x0f it returns immediately, because a free-play machine neither counts coins nor tracks credits.
Otherwise it runs the three coin-slot handlers, drives the two physical coin-counter strobes, and folds in
a periodic integrity check.

Each coin slot is debounced through its own small cadence ring rather than a raw level read, which rejects
a stuck or bouncing coin line. `loc_5a56` [code] handles slot 1: every frame it rotates bit 0 of
`INPUT_PORT0` into the ring at `DRIP_RING_C` (0x882a) [code], and only when the ring's low three bits
settle on the value 1 — the fingerprint of a clean coin edge — does it register a coin. On that edge it
plays the coin sound, bumps the queued strobe count `COIN1_PULSE_COUNT` (0x8824) [code], and advances a
coin accumulator kept at `TAMPER_ROM_CHECK_FLAG` (0x882b) [code] (a cell multiplexed to this coin-count
role) by 0x10 per coin. It compares that accumulator against `COINAGE_CONFIG`: while the configured
coins-required threshold in the high nibble has not been passed nothing more happens, but once it is
passed the accumulator wraps back down and the low nibble's worth of credits is awarded. Slot 2 is the
mirror image in `loc_5a1f` [code]: it rings bit 1 of `INPUT_PORT0` into `DRIP_RING_B` (0x882d) [code],
bumps `COIN2_PULSE_COUNT` (0x8826) [code], accumulates through `DRIP_COORD_B` (0x882e) [code], and divides
against `COINAGE_CONFIG_SLOT2`. The service button is handled by `loc_5a06` [code], which rings bit 2 of
`INPUT_PORT0` into `DRIP_RING_A` (0x8829) [code] and, on its edge, awards exactly one credit with no
coinage division — a free service credit.

All three award paths converge on the same accumulate tail (`loc_5a8c` / `loc_5a8a` [code]): it adds the
credits to `CREDIT_COUNT`, clamps the total at 0x63 (99, the two-digit maximum), and then queues the HUD
refresh command (`loc_5a97`) so the on-screen credit count redraws. The credit field itself is drawn by
`loc_05ee` [code], which reads `CREDIT_COUNT`, clamps it to 99, splits it into packed BCD, and writes the
tens digit (skipped when zero) and units digit into their two HUD tile cells.

Separately from the software credit total, the machine drives the two mechanical coin counters in the coin
door. A registered coin only queues a pulse; the actual strobe is generated by `loc_5a9c` [code] for
counter 1 and `loc_5ac0` [code] for counter 2, structural twins that turn a queued pulse into a timed
high-then-low signal on the addressed output latch — `COIN1_COUNTER_LATCH` (0xa183) [code] and
`COIN2_COUNTER_LATCH` (0xa184) [code]. Each seeds a phase timer at 0x30 and raises its latch on a fresh
pulse, drops the latch at phase 0x18, and retires one queued pulse when the phase reaches zero, so each
accepted coin produces exactly one clean electromechanical count.

### Starting a game: spending credits, one player or two

With credits banked, a start press begins a game. During attract the epilogue `loc_0bb5` [code] holds the
coin/credit gate: on a paid machine a waiting credit simply advances the top-level state toward the game;
on a free-play machine, where there are no credits, it instead reads the start bits of `INPUT_PORT0`
directly and routes a one-player press into the single-player start and a two-player press into the
two-player start. The start dispatch itself flows through `loc_0d78` [code], which reads the sampled
start bits: bit 3 takes the one-player branch `loc_0de4` [code], while bit 4 takes the two-player branch.

The one-player branch spends a single credit — it decrements `CREDIT_COUNT` and then runs the
start-of-life setup with a player word of zero. The two-player branch first requires at least two credits
(returning if fewer are banked), spends two, runs an anti-tamper checksum over a small block of program
ROM — the 0x14-byte table at 0x776b — bumping a tamper counter on a mismatch, and then runs the same
start-of-life setup with a player word whose high byte is set. That start-of-life setup is `loc_0dab` [code], the single point where a new game's player
identity is recorded: it stores the word's low byte to `ACTIVE_PLAYER` (0x880d) [seen] and its high byte
to `TWO_PLAYER_FLAG` (0x880e) [seen], so a one-player start leaves the two-player flag clear and a
two-player start sets it. It then queues the pre-play credit display (`queueCreditDisplayCommands` [code],
which also emits an extra command on a free-play machine), raises the in-play gate `GAME_ACTIVE_FLAG`
(0x8806) [seen], sets the top-level state to the play value and the play sub-index `PLAY_STATE_INDEX`
(0x880a) [seen] to zero, resets orientation to normal, and resets the actor tables for a fresh board. On a
two-player game it additionally queues the second-player start jingle and clears a small panel block.

### Per-player banks: lives, scores, and alternation

Two players share one live playfield by taking turns, so each player owns a private saved copy of the
game's live state that is swapped in when it becomes their turn and saved back out when they die. Those
copies are `PLAYER0_STATE_BANK` (0x8940) [seen] and `PLAYER1_STATE_BANK` (0x8980) [seen], each a 0x3f-byte
block that mirrors the single live state page at 0x8900. Within each block the remaining lives sit at a
fixed offset: `PLAYER0_LIVES` (0x8948) [seen] and `PLAYER1_LIVES` (0x8988) [seen]. Both are seeded from
`LIVES_DSW` when a board is reset (`resetActorStateForBoard` [seen], which also seeds each bank's opening
sprite position and its colour byte from `DIFFICULTY_DSW`), and each drains one life per death down to
zero, at which point that player is out.

Scores are banked the same way. Each player has a three-byte BCD score buffer — `P1_SCORE_BCD` (0x88a2)
[seen] and `P2_SCORE_BCD` (0x88a5) [seen] — and the active buffer is chosen by the low bit of
`ACTIVE_PLAYER`: even selects player one, odd selects player two. `selectActivePlayerScoreBuffer` [code]
is the small helper that returns the right pointer, so points always accrue to whoever is currently
playing while the idle player's total sits frozen.

Turn-taking is driven off `ACTIVE_PLAYER` together with `TWO_PLAYER_FLAG`. When the current player runs
out of lives, the live page is first snapshotted back into a saved bank. Two routines do this and they are
not interchangeable: `saveLiveStateToPlayerBank` [code] copies the 0x3f-byte page into the bank picked by
`ACTIVE_PLAYER` (player one's when the flag is clear, player two's when it is set), while
`saveLivePageToPlayer0Bank` [seen] always copies into player zero's bank `PLAYER0_STATE_BANK` and, in a
two-player game whose second player still has lives, additionally latches `ACTIVE_PLAYER` to 1. Then the
swap master `loc_1c66` [code] decides what happens next. With the two-player flag clear it goes straight to
the game-over tail. In a two-player game it splits on which player just died: on player one's death
(`ACTIVE_PLAYER` reads zero) it hands off to `loc_1cf6` [code] to bring in the other player, and on player
two's death (`ACTIVE_PLAYER` nonzero) it does the same work inline. Either way the mechanism matches — if
the other player still has lives it toggles `ACTIVE_PLAYER`, zero-fills the departing player's bank, and
continues; if the other player is also out it falls to the game-over tail. This is the
mechanism by which `ACTIVE_PLAYER` flips between the two players exactly on each hand-off, and by which the
correct saved bank is restored — `loc_1601` copies the active player's bank back into the live page at the
top of each new round.

Game over itself is `loc_1d15` [code]: it clears the live page, and then, if a credit is still banked, it
lowers the in-play gate, arms normal orientation, and drops the machine into the continue state so a fresh
game can begin; with no credit banked it proceeds to a full cold teardown back toward attract. The play
dispatcher's end-of-life continuation `resetToBoardBuildToContinuePlay` [seen] mirrors this from the
per-frame side: it does nothing while a game is live, tails into the shared attract epilogue on a
free-play machine, returns when no credit is banked, and otherwise drops the machine to the board-build
state to continue play.

### The extra-life award schedule (unverified reading)

Which DIP setting the player earns bonus lives on is `BONUS_AWARD_DSW`, and the routine usually read as the
award machinery is `loc_18da` [code]. It works against a pending-threshold cell `AWARD_QUEUE` (0x8909)
[code]: when the queue reads empty it reloads the threshold from the schedule `BONUS_AWARD_DSW` selects — 5
or 3 — and returns. Otherwise it compares the active player's score high byte (chosen off `ACTIVE_PLAYER`
from `P1_SCORE_BCD` or `P2_SCORE_BCD`) against the queued threshold; when the score reaches it, it
increments `GAUGE_PHASE_COUNTER` (0x8908) with a saturating step, BCD-steps the queue to its next threshold
by the schedule's step (8 or 7, again keyed on `BONUS_AWARD_DSW`), redraws the gauge, and appends a sound.

That extra-life reading is unverified [code]-level speculation, not settled fact. `loc_18da` is cert
[code], and `BONUS_AWARD_DSW` sits static-0 (its default) in both the attract and gameplay goldens, so
neither capture exercises the award path at all. It is also in tension with the one cell here that is
grounded: `GAUGE_PHASE_COUNTER` (0x8908) [seen] is the play-field phase gauge, which the gameplay golden
shows *draining* 3->2->1->0 (redrawn by `renderPhaseGauge`) before phase-exhaustion clears the rope — the
opposite direction from the increment `loc_18da` applies. Whether 0x8908 is genuinely dual-used (an award
gauge as well as the phase gauge) or the bonus reading is simply mistaken is unresolved and awaits
grounding; it should not be taken as an established extra-life schedule.

### Difficulty and the spawn scheduler

`DIFFICULTY_DSW` is the other boot-decoded knob that shapes play. It is the sole feed for the enemy spawn
schedules and the difficulty tier tables: the interval and shot spawn routines and the per-tier threshold
tables read it to scale how quickly and how densely enemies arrive, so a higher difficulty setting compresses
the spawn cadence throughout the game. The spawn scheduler's own working cells — the spawn-speed index and
value derived from the round counter, the reseed-timer table lookups, and the per-lane spawn countdowns —
are driven by round progression rather than by configuration, but they take `DIFFICULTY_DSW` as their base
scaling input, which is why the difficulty switch is felt across every wave. The last DIP bit,
`DEMO_SOUNDS_DSW`, is narrower: it enables or suppresses the attract-mode demo sounds.

### Config-gated integrity checks

Two anti-tamper checks are worth noting here because they are gated on configuration rather than on play.
The periodic ROM checksum `loc_7e6d` [code] runs only when the lives count reads four or more — that is,
only under the 4-life or 5-life DIP setting — summing a program block at each frame-counter zero crossing
and striking a tamper counter on a mismatch. And the credit-draw path carries its own hidden tripwire:
`loc_05ee` sums a fixed 31-byte program block, but only on the frames when the credit count's units digit
is exactly 2, bumping a strike counter if that sum misses its sentinel. Both ride on the same config band
this section describes — the lives switch and the credit total — which is why they belong with the
configuration machinery rather than with gameplay.

## In-play progression and timers

Once a coin has been consumed and the top-level game state selector `MAIN_GAME_STATE` [seen] reaches
its play value, every frame the machine runs `runPlayStateFrame` [seen]. This routine does two things
in sequence, and those two things are the whole of this subsystem: it advances the active player's
wall-clock play timer, and then it hands the frame to whichever in-play sub-state is currently
selected. Everything below hangs off that pair of steps — the sub-state machine that walks a round
from setup through play to teardown, the small block of counters at 0x8900 that records where the
player is in the game, the pair of saved banks that let two players share one live actor page, and the
BCD timers that clock each player's session.

### The play sub-state machine

The heart of in-play control is a single byte, `PLAY_STATE_INDEX` [seen], and a jump table of
handler entry points at 0x15a8. Each frame the dispatcher masks the index to its low five bits and
uses it to select one handler from that table; the selected handler runs the frame and, when it is
time to move the round forward, rewrites `PLAY_STATE_INDEX` so a different handler takes the next
frame. The masked index therefore behaves as a program counter for the round's life cycle, and the
handlers form a directed graph rather than a straight line — most step the index forward by one, but
several jump it to a specific slot to skip, loop, or branch. The meaningful slots run from 0 through
0x12; the handlers only ever write values in that range, so the upper reaches of the masked space are
never selected.

The opening slot is the round initializer, `loc_1601` [code]. It first blanks a tilemap row and
returns early, frame after frame, until the row-by-row screen fill has drained — the round cannot
begin while the playfield is still painting in. Once the fill is done it re-arms the fill machinery,
clears the actor arena and a cluster of round-init cells, and on the very first entry of a two-player
round it raises a once-per-round latch, enqueues a player-select banner, floods the colour map, and
chooses a long phase-timer seed (0x80) so the "PLAYER ONE" screen lingers; a single-player round takes
a short seed (0x02) instead. Whichever seed it picks it writes into `PHASE_TIMER` [seen], steps
`PLAY_STATE_INDEX` forward, and — crucially for the two-player game — copies the active player's saved
0x3f-byte state bank into the live actor page before optionally copying a round message string into
the message buffer.

That short countdown in `PHASE_TIMER` is the machine's fine-grained pacing clock, and the next slot,
`loc_16b7` [code], is the archetype of how it is used: it decrements `PHASE_TIMER` and returns
immediately while the timer is still running, so the round simply waits here for the initializer's seed
to expire. When it does, `loc_16b7` runs the per-phase setup, walks a decision tree keyed on the round
counter and several play flags to pick a matching pair of display-list pointers for the incoming board,
seeds an enemy-spawn timer, and steps `PLAY_STATE_INDEX` forward again. This decrement-and-wait idiom
recurs throughout the later slots — `loc_1c03` [code] and the round-clear master both gate their work
behind `PHASE_TIMER` reaching zero — which is how the machine spaces out the sound cues, banner draws,
and teardown steps that must not all happen on one frame.

From there the round threads through its live phases. The intro-delay slot,
`startRoundAfterIntroDelay` [seen], runs the display-list interpreter and holds until a mod-0x1c frame
tick wraps and a formation one-shot has been armed and cleared; only then does it run the level-start
setup (the round-number HUD, the phase gauge, the timer seeds, the enemy-spawn driver, the sprite
rebuild), raise `ROUND_IN_PROGRESS` [seen], seat `WAVE_ARRIVAL_COUNTER` [seen] to its opening value,
and drop the index onto the wave-setup slot. That slot, `spawnEnemyWave` [seen], picks a wave-seed
table and tile cursor from the round parity, seeds the actor records, and steps the animators. In
normal play — the play-mode latch clear and the game live — it steps `PLAY_STATE_INDEX` forward by
one, onto the active-gameplay coordinator `runActiveGameplayFrame`; it forces the index to the
eagle-bonus dispatcher (0x12) only on the game-inactive path (`GAME_ACTIVE_FLAG` clear with the
launch latch armed), and to the alternate slot (0x0f) when the play-mode latch is set. Active
gameplay itself sits in two per-frame coordinator slots — `runActiveGameplayFrame`
[code], which runs fourteen sub-handlers in fixed order (spawns, enemy and object state dispatch,
actor pipeline, HUD), and `stepGameplayFrame` [code], a shorter six-handler coordinator. Neither
coordinator body writes `PLAY_STATE_INDEX` directly, but each drives a sub-handler that does, and
that transitive write is how the round advances through the play slots while the player is playing:
`runActiveGameplayFrame` calls `loc_191c`, which steps the index forward by one once the stage
countdown and lead-actor state fall idle, and `stepGameplayFrame` calls
`advanceLeadActorSecondaryState`, which forces the index to 0x06 on an even round or 0x04 on a busy
formation. Were nothing to touch the index the round could never leave these slots.

The remaining slots handle transitions and teardown. `loc_1a01` [code] is the round-transition
handler: it reseeds the spawn counters, seeds `STAGE_COUNTDOWN` by round, and bumps
`ROUND_COUNTER` [seen]. `loc_1a64` [code] drains the bonus gauge (described below) and, unless the
gauge is exhausted, arms the index onto one of the two state-snapshot slots. `loc_1b43` [code] and its
sibling `loc_1b8c` [code] tick and drain the tilemap clear, flood the attribute columns, and both
latch the index to the teardown-continue slot (0x0c) — but they treat `PHASE_TIMER` differently:
`loc_1b8c` reloads it to 0x60, while `loc_1b43` zeroes it. The two snapshot slots,
`saveLivePageToPlayer0Bank` [seen] and `loc_1bcc` [code], copy the live page back into a player's bank
and reset the index to zero, sending the machine back to the round initializer. `loc_1c66` [code] is
the round-clear / game-over / player-swap master, and `loc_1c53` [code] is a frame-parity-split object
driver. The final active slot, the eagle-bonus dispatcher at 0x71b9, runs its own small phase machine
for the between-round bonus stage — a separate subsystem this section only reaches into.

A handful of slots near the top of the table (0x1d9c, 0x1d6e, 0x6bb2) are reached only when the
play-mode latch, `PLAY_MODE_LATCH` [code], is non-zero: `loc_16b7` forces the index to 0x10 only when
the latch's low bit is set (latch 1) — when the latch is 2 that bit is clear, so it instead takes the
round-parity display-list branch and bumps the index by one normally — and `spawnEnemyWave` arms 0x0f,
so this branch of the machine is entered only under the latch.
`PLAY_MODE_LATCH` is a multi-valued state latch (it holds 0, 1, or 2) that `loc_1a01` sets when a round
transition takes the alternate path; while it is set, several handlers select alternate update paths
and table entries rather than the normal-play ones.

### Round and stage progression — the 0x8900 counter block

The player's position within the game is recorded in a compact block of counters starting at 0x8900,
and the sub-state handlers above are the routines that advance them. The base cell, `SPEED_INDEX`
[seen], serves double duty: it is byte 0 of the live actor/state page (the page swapped in and out per
player, below) and it is read, clamped below 8, as the index into the enemy velocity tables, so it
also encodes how fast the current wave moves — a value that escalates as the game deepens.

`ROUND_COUNTER` [seen] is the top-level progress cell: `loc_1a01` increments it at each stage
transition, it is BCD-rendered as the round number in the HUD, and its low bits fan out across the
code as difficulty and variant selectors — bit 0 chooses the stage-type and facing variant (odd
versus even rounds pick different wave-seed tables in `spawnEnemyWave`), and the low bits index the
difficulty tables. Nested inside a round, `SPAWN_PHASE_COUNTER` [seen] is a per-round step counter
that cycles up to 7 and selects spawn and fire mode branches; when it reaches that cap,
`resetBoardRamAndReseedSpawnCounters` [seen] reseeds it (and the rope-draw count) back to 4 and
refills the formation slot table, which is how the wave escalation wraps rather than running off the
end. `loc_196e` [code] reads this same counter to select its siren-arm mode: below five it does
nothing special, exactly five arms the warning-siren pair, and above five it latches the higher mode.
`WAVE_ARRIVAL_COUNTER` [seen] counts enemy arrivals within a stage, capping out and bounding the
rope-segment count — `loc_1601` derives the rope-segment count from it (arrival count minus two), and
its parity picks a spawn variant.

`STAGE_COUNTDOWN` [seen] is the per-stage timer: `loc_1a01` seeds it (0x30 once the round counter has
reached 2, otherwise 0x28, and just 1 on the play-mode-latch path), it drains across the stage, near
zero it gates the actor AI, and its initial value selects which stage label is drawn.
`ROUND_IN_PROGRESS` [seen] is the plain in-progress flag, raised to 1 by `startRoundAfterIntroDelay`
at level start and read by the state and render decision trees to tell a fresh round from one already
under way. The remaining cells in the block are round-init scratch — `loc_1601` clears loc_8905 and
loc_890a near the end of the routine, only when loc_8906 is zero, the same gate that governs the
round-message copy.

### Per-player lives and the state-bank swap

Two players share one set of live gameplay RAM by swapping banks. The live actor/state page begins at
`SPEED_INDEX` (0x8900) and is 0x3f bytes long; player one's saved copy lives at `PLAYER0_STATE_BANK`
[seen] (0x8940) and player two's at `PLAYER1_STATE_BANK` [seen] (0x8980). Byte 0 of each bank is the
sprite colour and byte 1 the opening X position. Which player is live is held in `ACTIVE_PLAYER`
[seen], and whether a second player exists at all in `TWO_PLAYER_FLAG` [seen].

The swap is symmetric. At round init, `loc_1601` reads `ACTIVE_PLAYER` and copies the corresponding
saved bank into the live page, so the incoming player resumes exactly where they left off. When a turn
ends, the snapshot handlers run the reverse copy: `saveLivePageToPlayer0Bank` writes the live page back
to player one's bank (first latching `ACTIVE_PLAYER` if player two is still alive), and the shared
`saveLiveStateToPlayerBank` [code] writes it to whichever bank `ACTIVE_PLAYER` names; both then reset
`PLAY_STATE_INDEX` to zero so the machine loops back to round init for the next turn.

Lives are held per player in `PLAYER0_LIVES` [seen] (0x8948) and `PLAYER1_LIVES` [seen] (0x8988), each
seeded from the cabinet lives switch `LIVES_DSW` [code] by `resetActorStateForBoard` [seen] — the same
routine that clears the live page, zeroes the play-timer gates, and seeds each bank's opening X and
colour from the difficulty switch. A life is decremented on death, and the counters drive the
end-of-turn branching in the round-clear master, `loc_1c66`. That master ticks `PHASE_TIMER`, and once
its reset latch is armed and the timer expires it runs an integrity checksum before committing, then
branches on the player flags: a single-player game (`TWO_PLAYER_FLAG` clear) falls to the full-clear
tail `loc_1d15` [code]; a two-player game with player one currently live hands to `loc_1cf6` [code] to
reseed the other player; if player one is out of lives it too takes the full clear; otherwise it swaps
`ACTIVE_PLAYER` back to zero, zeroes player two's bank, and continues. `loc_1cf6` mirrors this — if
player two is out of lives it falls to the full clear, else it zeroes player zero's bank and makes
player two active. The full-clear tail `loc_1d15` zeroes the live page, and then reads
`CREDIT_COUNT` [seen]: with credit left it drops back into a continue state (clearing the in-play gate
and re-pointing `MAIN_GAME_STATE` at its continue value), and with no credit it hands to the cold
teardown `loc_1d3c` [code] that ends the game.

### The BCD play timers and their gates

Each player's session is clocked by a small BCD timer that `runPlayStateFrame` ticks once per frame
through `loc_7912` [code], before it dispatches the sub-state. The tick first checks the in-play gate
`GAME_ACTIVE_FLAG` [seen] and does nothing when the game is not live. It then selects the timer bank
belonging to the current player — player one uses gate `PLAY_TIMER_GATE_P1` [code] with timer bank
`PLAY_TIMER_BCD_P1` [code], player two uses `PLAY_TIMER_GATE_P2` [code] with `PLAY_TIMER_BCD_P2`
[code], chosen off `ACTIVE_PLAYER`. The gate byte is the suppress control: when it is non-zero the tick
is skipped entirely, which is how the timer is frozen during banners and transitions;
`resetActorStateForBoard` clears both gates when a board resets.

The timer bank is three bytes: a frame sub-counter followed by a BCD seconds digit and a BCD minutes
digit. The sub-counter rolls at 0x3b or 0x3c frames — the machine picks the extra frame from bit 0 of
the seconds byte, so that across two seconds it accumulates the right number of NTSC frames per second.
On each roll it clears the sub-counter and carries into the seconds digit, and on a seconds overflow
into the minutes digit; each digit rolls its low nibble at 0x0a, and the seconds digit additionally
rolls its high nibble at 0x60 (the carry into minutes), while the minutes digit only BCD-increments
its high nibble with no 0x60 cap. This elapsed-play time is not merely cosmetic: on a high-score
insertion the two timer bytes are shifted into an opened slot of the play-time side table
`HIGH_SCORE_TIME_TABLE` [code], which rides alongside the high-score table, so each recorded score
carries the time it took to earn.

### The bonus gauge and the award queue

The vertical HUD gauge is driven by `GAUGE_PHASE_COUNTER` [seen] and fed from the scoring side by
`loc_18da` [code] through a pending-award queue, `AWARD_QUEUE` [code]. The queue holds a BCD score
threshold. When it is empty `loc_18da` reloads it from the award schedule — 5 or 3 depending on the
bonus-award switch `BONUS_AWARD_DSW` [code] — and waits. Otherwise it compares the active player's
score high byte (from `P1_SCORE_BCD` or `P2_SCORE_BCD` per `ACTIVE_PLAYER`) against the queued
threshold, and when the score reaches it, it bumps `GAUGE_PHASE_COUNTER` (saturating at 0xff),
BCD-adds the schedule step (8 or 7, again off the switch) to set the next threshold, redraws the gauge,
and appends the tally sound. So the gauge fills as the player's score climbs through the scheduled
milestones.

The gauge is drained from the sub-state side. `loc_1a64` decrements `GAUGE_PHASE_COUNTER` one step per
phase, and when it reaches zero — or is already zero — it hands to the phase-exhausted handler
`loc_1a96` [code] rather than continuing; when the gauge still has cells it renders the gauge and arms
`PLAY_STATE_INDEX` onto a snapshot slot (one slot higher for player two than player one).
`loc_1a96` queues the phase-exhausted tile run, steps the sub-state index forward (an extra step when
player two is active, matching the higher snapshot slot `loc_1a64` chose), clears the high-score
insert rank and the rope-segment and marker cells, and hands to the
high-score insert-sort. In this way the gauge couples scoring, the phase pacing, and the round's exit
into the high-score path.

## The actor arena

Everything that moves on screen — the player, the enemy birds, the arrows and stones they hurl,
the objects that drift and fall, the wave formations — lives as a fixed-layout record in a band of
work RAM, and every frame the machine walks those records through a handful of dispatch loops that
step each one's animation, advance its position, spawn new ones on a schedule, test it against its
targets, and eventually clear it away. This section describes that machinery: the record arrays, the
per-frame dispatch loops that visit them, the animation primitives they call, the several spawn
drivers that populate them, the phase state-machine that governs an actor's life, the collision scan
that resolves hits, and the teardown that resets the arena between boards.

### The record arrays and their shared shape

All of the moving-object pools are arrays of 24-byte (`0x18`) records, and the game keeps several of
them side by side. `ACTOR_TABLE` [seen] at `0x8a80` is the main arena; its slot 0 is the player/lead
actor, and the whole 0x200-byte block is zero-filled at board start. `ENEMY_ACTOR_TABLE` [seen] sits
just above it at `0x8ae0` (it is the same arena viewed from the enemy sub-array), and it is the pool
most of the enemy-spawn and animation-tick loops sweep. `OBJECT_STATE_RECORD_BASE` [seen] at `0x8ba0`
holds a six-slot per-frame object-state array that runs straight up into the three-slot
`PROJECTILE_TABLE` [seen] at `0x8be8`; `SPRITE_OBJECT_TABLE` [seen] at `0x8b70` is a secondary
five-slot object pool used as the target of dropped-object spawns; and there are further stride-0x18
pools for formations and spawned collectibles. Because the pools abut, one loop's stride-0x18 walk
frequently continues into the next pool by design.

Certain byte offsets mean the same thing in every record, and the routines that touch them establish
that shared shape. Bytes `+0x00` and `+0x01` are the activity marker: a record is live when bit 0 of
`(rec+0) | (rec+1)` is set, and a fresh spawn sets one of them to 1. Byte `+0x02` is the state byte
that the per-frame dispatchers read to pick a handler. The animation fields are fixed too: `+0x0c`
and `+0x0d` hold a little-endian pointer into an animation script, `+0x0e` is the frame-hold
countdown, `+0x0f` is the sprite attribute byte, and `+0x10` is the current tile code. Byte `+0x14`
is the record's tag, the key the collision scan matches on. The middle bytes (`+0x03` through
`+0x0b`) are interpreted by whichever handler owns the record — for a descending object they are a
16-bit sub-position and a step; for an enemy actor they carry a phase byte, a facing/velocity pair,
and per-actor latch bits — so their meaning is read from the handler, not assumed to be uniform
across pools.

### The per-frame dispatch loops

Two record-walks form the spine of the arena each frame. The first, `loc_76f4`, sweeps the six
records of `OBJECT_STATE_RECORD_BASE` in order (stride 0x18) and hands each to
`dispatchActiveObjectState` [seen]. That dispatcher first checks the activity marker and skips the
record entirely if it is idle; for a live record it takes the low two bits of the state byte and
routes to one of four per-state handlers, each of which runs to completion and returns to the sweep.
Nothing is read back into a register — every effect the handler has lands in the record's own bytes
or in shared counters — so the sweep simply moves its pointer on to the next record. The formation
pool is walked the same way by `dispatchFormationObjectStates` [code] over its four records.

The second walk is the enemy-actor driver `loc_6a7f` [code]. While the blink-phase byte `BLINK_PHASE`
[code] is set it visits eighteen records of `ENEMY_ACTOR_TABLE` (stride 0x18), running the per-object
dispatcher `loc_6a98` [code] on each. That dispatcher skips an inactive record and, for a live one,
uses `(state − 1) & 3` to choose between two handlers: index 0 is the descending-object step
`loc_6aa8` [code], and index 1 is the screen re-initialisation path `loc_67df` [code]. The descending
step first advances the record's animation, then subtracts the record's step (byte `+0x09`) from its
16-bit sub-position (`+0x06`:`+0x05`), letting a borrow out of the low byte roll the high byte down;
while the high byte is still non-zero the object is still falling and the handler just returns, and
only when it reaches zero — the object has hit bottom — does the handler re-arm the one-shot tilemap
latch `TILE_SUM_ONCE_LATCH` [code] and bump the record's state byte to its next phase. When
`BLINK_PHASE` is instead clear and the wave index `WAVE_NUMBER` [code] is exactly 2, `loc_6a7f` runs
a once-per-pass integrity check in place of the sweep: gated by `TILE_SUM_ONCE_LATCH`, it sums the
playfield tilemap out of video RAM column by column and row by row (skipping one column) into a
16-bit accumulator and throws if the total is not the fixed expected value — a mismatch is only
reachable once work RAM has been corrupted, so it is a tamper trap rather than a normal outcome.
Alongside these, the low-state enemy records are also walked by `dispatchAllEnemyActorStates` [seen],
which runs the per-record state dispatcher `dispatchActiveEnemyActorState` [seen] over the enemy
array in order.

### Stepping an actor's animation

Two leaf primitives drive all sprite animation. `setActorAnimation` [seen] arms a record onto a new
sequence: it writes the little-endian script pointer into `+0x0c`:`+0x0d` and resets the frame-hold
counter at `+0x0e` to zero so the new sequence takes effect immediately. `advanceObjectAnimationFrame`
[seen] (the routine at `0x4006`) steps whatever sequence a record is pointed at. It treats `+0x0e` as
a frame-hold countdown: while it is non-zero the current frame simply holds and the count decrements.
On expiry it reads the script byte under the `+0x0c`:`+0x0d` pointer; a `0xff` opcode is a jump that
reloads the pointer from the next two stream bytes and re-reads (this is how a looping animation
wraps back to its start), while any other byte begins a three-byte frame record — tile into `+0x10`,
attribute into `+0x0f`, new hold into `+0x0e` — after which the advanced pointer is stored back. So a
sequence is a stream of `[tile, attribute, hold]` triples terminated by a `0xff` reload, and each
call either holds or lays down exactly one frame.

Enemy animation is additionally driven by a shared tick-walk. `loc_7625` [code] is the common entry
that seeds a record count of eight and calls the walk `loc_7627` [code], which visits that many
`ENEMY_ACTOR_TABLE` records (stride 0x18) and runs the per-entry tick `loc_7638` on each. The tick
selects a handler by the low two bits of the record's state byte (states 0, 1, or 2). A tick can
signal that the walk should stop early — its state-0 handler, for instance, steps the record's
animation and sub-position and, once the record's frame counter falls below its floor, reloads the
shared phase countdown `SHARED_PHASE_COUNTDOWN` [code], forces a run of records' state bytes back to
active, and ends the walk so the remaining records are left for the reseeded phase — so the walk both
animates and watches for the frame that triggers a phase transition.

Separately from the sprite records, the machine animates a strip of background tiles directly in
video RAM through a cursor pair driven by frame parity. Whichever half runs for the player's current
movement state bumps the shared parity counter `TILE_ANIM_PARITY` [seen]: the descending player runs
`advanceTileAnimForwardOnOdd` [seen] and the rising player `retreatTileAnimScript` [seen], the two
mutually exclusive per the player's movement direction. `advanceTileAnimForwardOnOdd` acts only when
parity turns odd and `retreatTileAnimScript` only when it is even, so the strip crawls forward on one
frame and back on the next. The forward half reads the tile code under the cursor `TILE_ANIM_CURSOR` [seen]
(a 16-bit pointer into the `0x84xx` tilemap): if the code has reached the wrap value `0x37` it steps
the cursor one cell forward and seeds the new cell with `0x34`, otherwise it just increments the code
in place, animating that cell up by one. The retreat half is the mirror: a `0x34` marker reloads the
cell to the base code `0x10` and backs the cursor up one cell, and any other value is decremented in
place. The advanced cursor is stored back each time.

### Deriving the player's stacked sprites

The player is drawn as three sprites stacked vertically, and `deriveStackedSpriteYs` [seen] fans the
single player Y out to all three each frame. It reads `PLAYER_Y` [seen] (the player-actor's vertical
position) and writes it into the Y field of stacked slots 3, 2, and 1 within `ACTOR_TABLE`: the
bottom slot gets the base Y, the top slot sits `0x10` above it, and the middle slot sits `0x0a` below
the top slot, giving the tightly overlapped three-tile figure.

### Spawning new actors

Several independent drivers populate the pools, and they all share the same shape: gate on a
countdown, and once it clears, sweep a record array and seed the first free slot, stopping the sweep
the instant one spawn lands so that at most one actor appears per driver per frame.

The primary enemy cadence is `loc_1171` [code]. While the spawn-cadence countdown `ENEMY_SPAWN_TIMER`
[seen] is non-zero it merely ticks it down; at zero it gates the sweep on population — it spawns
nothing unless the stage countdown `STAGE_COUNTDOWN` [seen] is still ahead of the active-enemy count
`ACTIVE_ENEMY_COUNT` [seen] and fewer than six enemies are live — and then walks the six enemy
records seeding the first free one. The per-record initialiser marks the slot active, stamps its
opening state, and derives the new enemy's facing byte (and its negation, the mirrored velocity) and
the spawn-timer reload from a pair of ROM byte tables — `SPAWN_FACING_TABLE_1209` [code] and
`SPAWN_TIMER_TABLE_11F9` [code] — indexed by a value folded down from the round counter
(`(ROUND_COUNTER & 0x3f) >> 2`). It arms the standard walk animation `ANIM_TABLE_3829` [code],
reloads `ENEMY_SPAWN_TIMER`, and bumps `ACTIVE_ENEMY_COUNT`.

A second enemy cadence, `loc_56e8` [code], shares the same `ENEMY_SPAWN_TIMER` gate but branches on
round parity. On an even round it hands the whole decision to the spawn gate `loc_5871` [code]; on an
odd round it gates on the stage countdown versus the active count and on a difficulty threshold
derived from the speed index `SPEED_INDEX` [seen] (below 3 the threshold is `SPEED_INDEX + 4`, else
6), then sweeps the six actor slots through `loc_572b`. `loc_572b` is the richer initialiser: for a
free slot it seeds the record, then builds the spawn column by clamping the difficulty switch
`DIFFICULTY_DSW` to 3, adding a late-gauge bias `SPAWN_COLUMN_BIAS` [code] when the gauge phase
counter `GAUGE_PHASE_COUNTER` [seen] is high, applying an early-stage shift on even rounds, and adding
the round counter before clamping below the arena width `0x1f`. That column indexes two byte tables —
`SPAWN_FIELD_TABLE` [code] (or its odd-round sibling) for the velocity and `SPAWN_TIMER_TABLE_ODD`
/ `SPAWN_TIMER_TABLE_EVEN` [code] for the reload timer — arms `ANIM_TABLE_3829`, bumps the active
count, and starts the actor's scan-state. The spawn gate `loc_5871` latches the entry value into
`SPEED_INDEX`, spawns only when the active count is strictly below the stage threshold and below the
cap of six, raises the spawn-active flag `SPAWN_ACTIVE_FLAG` [code], and runs the initialiser
`loc_588e` over six records — that loop calls the same `loc_572b` per slot and stops on the first
seed.

A family of block scanners seeds actors whose kind is chosen from a rotating schedule. `loc_54f9`
[code], `loc_5544` [code], and `loc_5594` [code] each walk a block table looking for the first free
slot; on finding one they pick the actor's kind byte from a ROM kind table — `ACTOR_SPAWN_TYPE_TABLE`
[code] at `0x5637`, `SPAWN_KIND_TABLE_5647` [code], or `SPAWN_KIND_TABLE_5627` [code] respectively —
indexed by the low nibble of a rotating cursor (`SPAWN_TYPE_CURSOR` [code], `SPAWN_SEQUENCE_INDEX_8D13`
[code], or `SPAWN_SEQUENCE_INDEX_8D14` [code]), store it into the record's kind field at `+0x17`, and
hand the record to the shared init helper `loc_5489`. That helper stamps the opening fields, looks up
the record's animation from the pointer table `ACTOR_ANIM_TABLE_5657` by kind and installs it with
`setActorAnimation`, seats a dwell countdown, and derives a signed speed for `+0x0a` by using the
kind to pick a row of the speed table `ACTOR_SPEED_TABLE_55D7` and `3 × (round & 7)` to pick the byte
within that row, negated. `loc_5594` additionally runs an anti-tamper self-check before seeding —
summing an eight-byte guard region `INTEGRITY_GUARD_REGION_0BAD` [code] against its two's-complement
signature `INTEGRITY_GUARD_SIGNATURE_55B5` [code] and bumping the tamper freeze flag
`TAMPER_FREEZE_FLAG` on any mismatch — folding an integrity trap into the spawn path.

Wave enemies come in through the delay-gated pair `loc_6905` [code] / `loc_6931`. While the shared
frame-delay timer `SHARED_FRAME_DELAY_TIMER` [code] runs it just ticks down; once clear it spawns
nothing if the wave has fully arrived (`WAVE_NUMBER` has caught up to the arrival counter
`WAVE_ARRIVAL_COUNTER` [seen]) or the wave limit of eight is reached, and otherwise sweeps eight
enemy/state record pairs and spawns into the first empty pair. The per-pair spawn activates both
records, seeds their fields, arms the descent animation `ANIM_TABLE_3838` [code], and re-arms the
respawn delay; on the very first spawn of a wave (`WAVE_NUMBER` still zero) it also queues two wave
display commands, paints the arrival count to the HUD as two packed-BCD digits, and queues a sound,
before bumping `WAVE_NUMBER`. (`WAVE_NUMBER` reads as this wave index in the spawn drivers, though
another arena driver treats the same cell as a per-frame countdown reloaded to `0x10` — a genuine
current-state ambiguity in how the byte is reused, noted at the cell.) The blink-driven sweep `loc_6a0f` [code] / `loc_6a35` is the
counterpart used during the blink phase: it stays idle while `BLINK_PHASE` is clear, while the phase
toggle `ANIM_PHASE_TOGGLE_892C` [code] has reached its gate value of 6, or while the countdown
`BLINK_COUNTDOWN` [code] is still running, and once the countdown expires it sweeps eighteen records
and seeds the first empty one. The per-record spawn seeds the record, arms the spawn-delay countdown,
then reads and bumps the phase toggle and picks the spawn animation by the pre-bump phase — the early
pointer `ANIM_PARAM_76D4` [code] for phases 0 and 1 (phase 1 also re-arming the countdown), the mid
pointer `ANIM_PARAM_68EF` [code] for phase 2, and the late pointer `ANIM_PARAM_6B0A` [code] beyond —
before pointing the record at it.

### The per-record phase state machine

An enemy actor advances through its life under the phase dispatcher `loc_362d` [code], which reads the
record's phase byte at `+0x06` and routes on its range. A low phase (below 7) goes to the
end-of-move guard `loc_361d` [code], which checks bit 0 of the record's flag byte `+0x08` and, when
set, hands off to the end-of-move dispatch `finishActorOrArmTurnaround` to complete a leg of travel
or arm a turnaround. A high phase (0x14 or above) goes to the target guard `loc_3625` [code], which
checks the commit bit in `+0x08` and, unless the actor is already committed, delegates to the
target-column resolver `resolveTargetColumnAndArmApproach` that aims the actor at a target and arms
its approach. The middle band is where the drop cadence lives: a global progress gate
(`WAVE_PROGRESS_COUNTER` [seen] at or above 0x0e) short-circuits every middle-band phase except
0x13 — so when progress is high only phase 0x13 reaches the drop cadence — then a per-actor delay
counter `ACTOR_DELAY_COUNTER` [code] counts down and returns while it runs; when it elapses and the
actor's X is in the near half of the field, the delay is reloaded from the round-indexed table
`DELAY_RELOAD_TABLE_368E` [code] (index `ROUND_COUNTER & 7`) and control falls into the pre-spawn
gate `loc_365d` [code]. That gate, when the record's arm bit `+0x0b` bit0 is set, first requires
exactly one enemy record to be sitting in the spawn state (state byte `+0x02` equal to 3), bailing if
the count is anything else; then it seats the five-slot `SPRITE_OBJECT_TABLE` scan window and falls
into `spawnObjectIntoFreeSlot` [seen], which finds a free slot, bumps the spawn counters, steps the
frame counter into the new record, seats its animation vector (`ANIM_SEQ_3988` [seen] or
`ANIM_SEQ_3994` [code] by a template flag) and fixed fields, builds the attribute byte, and
initialises the slot — this is how an enemy drops an object into the arena. A sibling guard `loc_3617`
[code] gates the same pre-spawn path on the actor X being below 0x20.

### The object-proximity collision scan

Hits between the player's shots and the objects in the arena are resolved by a proximity scan rooted
at `loc_602f` [code]. It runs the scan once for each of two target slots taken from
`SPRITE_ACTOR_RECORD_SLOTS` [seen] (stride 4), tagging each pass with an interrupt-parity selector,
and a hit found inside the first pass aborts before the second is scanned. Each pass enters `loc_6048`,
which reads the slot's presence block — `ENEMY_TARGET_REC0` [seen] or `ENEMY_TARGET_REC1` [seen] by
the parity selector — and does nothing for an empty (0) or already-engaged (3) block; a live block
latches its kind into `ACTIVE_OBJECT_TYPE` [seen] and enters the record scan over `SPRITE_OBJECT_TABLE`
against the moving-actor coordinate slots `SPRITE_SCAN_ACTOR_SLOTS` [code], five records deep.

The scan head `loc_6069` classifies each record: a record with a zero lead byte, or whose `+0x02`
state byte is not the fixed value `0x05`, is skipped straight to the epilogue; otherwise an odd round routes to the
collision handler `loc_61b4` and an even round to the proximity gate `loc_6080`. The gate measures the
X and Y gaps between the actor (its X biased by the flip-screen flag) and the target and skips the
record when either gap is too wide — the hit box is 9 pixels in X and 8 in Y — and within the box it
advances to the record's tag and enters the hit handler `loc_60bc` with that tag as the key. The hit
handler scans `ENEMY_ACTOR_TABLE` for a record whose `+0x14` tag matches; on a match that is in the
engageable state (its `+0x16` state bit set) while the active object type is not 3, it flags the
interrupt-parity target pair active — writing `1` into the `+0x01` and `+0x07` bytes of the selected
`ENEMY_TARGET_REC0` / `ENEMY_TARGET_REC1` block — enqueues the fixed collision sound, and aborts the
scan; every other outcome sets the corresponding hit flag `OBJ_HIT_FLAG_I0` [seen] /
`OBJ_HIT_FLAG_I1` [seen], seeds a fresh actor record at the object's slot, and enters the record
finder `loc_611f` [code], which re-scans the enemy table by tag and either aborts the frame on a
match or enqueues a sound and continues. The odd-round handler `loc_61b4` is the award path: it finds the matching, non-busy target
slot, dispatches on the high nibble of that slot's state byte, and in the award case latches the actor
onto the record, adds a round-indexed positional delta to both the record and the re-found slot, arms
the slot, wipes the parity target buffer, plays the sound, and unwinds. When neither handler fires,
the epilogue `loc_60f2` steps the actor pointer on by one slot and the record pointer on by one
record, decrements the remaining count, and re-enters the scan head — so the whole cluster
(`loc_6069`, `loc_6080`, `loc_60bc`, `loc_611f`, `loc_61b4`, and `loc_60f2`) forms one mutually
recursive walk that ends when the count drains or a hit aborts it.

### Teardown

Between lives and boards the arena is wiped. `clearActorArena` zero-fills the whole 0x200-byte actor
record block from `ACTOR_TABLE`, so a fresh board starts with no stale actor state.
`clearActorArenaAndCounters` is the teardown reached as a play sub-state: it zeroes the actor arena,
clears the spawn/wave/rope counters — the spawn-phase counter `SPAWN_PHASE_COUNTER` [seen], the
`WAVE_ARRIVAL_COUNTER`, and the rope-segment count — and forces the in-play sub-state to 6 to hand
off to the next phase. `resetActorStateForBoard` does the broader board reset: it clears the whole
live-state page and a handful of loose flags, seeds each player's saved bank from the cabinet
switches (lives, a fixed opening X, and the sprite colour from the difficulty switch), and arms the
row-by-row tile fill; if the game is idle it stops there, and otherwise it also clears the launch
flags. Individual records are blanked in place by `clearTargetActorRecord`, which zero-fills a single
0x18-byte record — the routine the collision and despawn paths use to retire one object without
touching the rest of the pool.

## Waves, rope and launch

Three interlocking machines drive the attack half of a round: an enemy-wave engine that seeds
records, flies them onto the screen and retires them; a rope/lift-column engine that grows and draws
the vertical rope the enemies ride; and a scripted launcher that feeds individual objects into the
play field a few at a time. All three are pumped from the same per-frame gameplay chain — the
object-update body `loc_20d4` [code] runs the rope column driver, while the wave engine and the
launcher hang off the phase bodies (`loc_72a0` [code] for the bonus phase, `runLevelIntroPhase1Frame`
for the level-intro phase) that surround it.

### The enemy attack wave

The wave engine is entered once per frame through `loc_72a7` [code], the wave-launch driver (the
bonus-phase body `loc_72a0` [code] reaches it after first running the shared per-frame update). The
driver is a three-way switch on the wave's own bookkeeping. If the wave-launch flag `WAVE_LAUNCH_FLAG`
[code] is clear, no wave is live, so it seeds the next one and returns. If a wave is live but its
record count `WAVE_RECORD_COUNT` [code] has drained to zero, every enemy has retired and it hands the
frame to the inter-wave idle handler. Otherwise a wave is in progress, and it walks that wave's live
records — two per wave index, stepping through the enemy-actor table `ENEMY_ACTOR_TABLE` [seen] at a
stride of 0x18 — handing each record in turn to the per-record state dispatcher.

Seeding a wave is the job of `loc_72e1` [code]. It refuses to seed while the target slot
`ENEMY_TARGET_REC0` [seen] is still occupied, so a new wave never overwrites an object still being
resolved. Once clear, it raises `WAVE_LAUNCH_FLAG` and advances the wave index `WAVE_INDEX` [seen].
The index runs 1..4; on the fourth wave the routine only re-arms — it bumps the outer-phase counter
`WAVE_OUTER_PHASE` [seen] and reloads the inter-wave hold timer `WAVE_HOLD_TIMER` [seen] to 0x20 —
rather than seeding fresh records. For the earlier waves it writes a record count of twice the index
into `WAVE_RECORD_COUNT` and then fills that many enemy-actor records from the four-byte-per-record
parameter table `EAGLE_WAVE_PARAM_TABLE` [code]. Each seeded record is marked active and takes four
copied fields (its target column at +6, target row at +4, plus the +0x10 and +0x0f fields); records
whose own low address has bit 3 set additionally get a fixed 0x80 flag at +3, and every record gets
that flag at +5. Finally it zeroes the outer-phase counter and the arrived count
`WAVE_RECORDS_ARRIVED` [seen], readying the wave's arrival tally.

Each live record is routed by `loc_72cf` [code], the per-record state dispatcher. A record whose
active bit (bit 0 of its first two bytes) is clear is skipped; otherwise the record's state byte at
+2 — bounded to 0, 1 or 2 — selects one of three behaviours, and the chosen handler carries the frame
to completion for that record.

**State 0, approach** (`loc_733c` [code]). The enemy flies toward the grid slot the record was seeded
with, and this handler waits for it to arrive. It compares the enemy's live position — its column,
taken as `EAGLE_X_COORD` [code] shifted right by three, and its row, taken as `EAGLE_Y_COORD` [code]
shifted right by three plus four — against the record's target column (+6) and target row (+4). The
column must match the target or the one just before it, and the row must fall inside a five-row window
at or below the target row; until both hold, the handler returns and the enemy keeps flying. On
arrival it advances the record's state byte and arms an animation: odd records (bit 3 of the record's
low address set) get the odd-record animation `EAGLE_ODD_RECORD_ANIM` [code] and a 0x38 field at +9,
while even records get `EAGLE_EVEN_RECORD_ANIM` [code], a 0x40 field, and bump `WAVE_RECORDS_ARRIVED`.
When that arrived count has caught up to the wave index — the whole wave has landed — the handler
queues the wave-arrival display command, taking `WAVE_ARRIVAL_CMD_BASE` [code] offset by the arrived
count so the sound scales with how many arrived.

**State 1, dive/climb** (`loc_7395` [code]). Now planted on the grid, the record integrates its
vertical position each frame. It first steps the record's animation, then adds or subtracts the
per-record speed at +9 into the 16-bit vertical position held across +3 (the fractional low byte) and
+4 (the row). Even-indexed records (bit 3 of the low address clear) descend — the speed is added, a
carry pushes the row down, and reaching the bottom row (0x1d) advances the state byte. Odd-indexed
records climb — the speed is subtracted, a borrow lifts the row, and rising above the top row (0x04)
advances the state byte. Either way, hitting the limit is what promotes the record to its final state.

**State 2, retire** (`loc_73ce` [code]). The record has finished its dive or climb, so it is torn
down: the whole 0x18-byte record is zero-filled and the live-record count `WAVE_RECORD_COUNT` is
decremented. When that decrement empties the wave, the handler seeds the inter-wave hold timer
`WAVE_HOLD_TIMER` to 0x30, opening the pause before the next wave can begin.

That pause is run by the idle handler `loc_73e3` [code], which `loc_72a7` reaches once the record
count is zero but the launch flag is still set. While `WAVE_HOLD_TIMER` is non-zero it simply ticks it
down. When the timer expires, and if a wave index is still set, it enqueues a wave sound command
(0x06b0+index); it then reseeds the hold to 0x18 and clears `WAVE_LAUNCH_FLAG`. Clearing that
flag is what lets the next frame's `loc_72a7` fall back into the seeding branch, so the whole loop —
seed, fly, retire, hold, re-seed — cycles on its own. The three distinct reseed values across these
routines (0x20 on the fourth-wave re-arm, 0x30 when a wave empties, 0x18 after the idle pause) set the
different gaps between phases.

### The rope

The rope column and the lift column above it are drawn by a single per-frame driver, `loc_25a6`
[code], reached from the object-update chain. It splits its work by the parity of the round counter
`ROUND_COUNTER` [seen]: on even frames it defers entirely to the rope-extend/render driver
`driveRopeExtendAndRenderCells` [code], and on odd frames it draws the marker/lift column itself. The
two halves therefore alternate frame by frame, one growing and animating the rope while the other
paints the column glyphs.

**The rope-extend state machine.** On its even frames the render driver first bails if a grab is in
progress (`GRAB_ACTIVE_FLAG` [seen]) or while the wave-arrival counter `WAVE_ARRIVAL_COUNTER` [seen]
still sits at its hold value of 2; otherwise it runs two sub-drivers in order. The first is the
rope-extend dispatcher `dispatchRopeExtendState` [seen], a small two-state machine selected by
`ROPE_EXTEND_STATE` [seen]. In sub-state 0, `addRopeSegmentAndAdvanceExtendState` [seen] tries to add
one rope segment: it stops once the rope has already grown to two below the stage's arrival count
(comparing `WAVE_ARRIVAL_COUNTER` minus two against the segment count `ROPE_SEGMENT_COUNT` [seen]),
otherwise it bumps `ROPE_SEGMENT_COUNT`, advances the segment index `ROPE_EXTEND_INDEX` [seen] (freely
below four; at or beyond four only when a tamper strike is pending), looks this segment's video-column
low byte up from the rope-cell column table `ROPE_CELL_COLUMN_TABLE` [code] and forms the segment's
column base into `ROPE_COLUMN_VRAM_PTR` [seen] on the fixed 0x84 tile page, reloads that segment's
frame timer in the per-cell timer array `ROPE_CELL_TIMERS` [seen], and finally advances the
rope-extend state and arms its sub-timer `ROPE_EXTEND_TIMER` [seen]. In sub-state 1,
`advanceRopeExtendAnimation` [seen] plays out the growth: it counts `ROPE_EXTEND_TIMER` down and,
between beats, looks up this frame's tile block from `ROPE_TILE_BLOCK_TABLE` [code] and blits it at the
rope column; the blit frame index `ROPE_EXTEND_FRAME_INDEX` [seen] walks 0..8, and on reaching 8 it
resets the frame index and state and arms the next rope cell, returning the machine to sub-state 0 to
add the following segment.

**The per-cell rope driver.** The render driver's second sub-driver, `driveActiveRopeCells` [code],
animates the segments already placed. It walks `ROPE_EXTEND_INDEX` active cells starting from the
rope-cell state base `ROPE_CELL_STATE_BASE` [seen], handing each cell record to the per-cell
dispatcher `dispatchRopeCellState` [seen]. A cell in state 0 is inactive and skipped; otherwise the
cell state selects one of four per-cell handlers. The state-4 handler, `retractRopeSegment`
[code], fires only when the cell's frame timer expires (ticked by
`tickRopeCellFrameTimer` [seen], which decrements the timer selected by the low two bits of the cell
index) and segments still remain. It then chooses a retract-animation pointer from `RETRACT_ANIM_TABLE`
[code] (keyed on the round counter shifted right by two, clamped, plus a difficulty term), reads this
segment's attribute byte and merges it into the timer cell (carrying the paired cell's bits unless the
cell is the terminal 0x28 column), clears the count-selected formation record, resets the cell
state to 1, and blits the 2x2 segment tile `ROPE_RETRACT_TILE_SRC` [code] to the column computed by
`computeRopeCellVramColumn` [code] — which, like the extend path, pairs a column low byte from
`ROPE_CELL_COLUMN_TABLE` with the fixed 0x84 page.

**The marker/lift column.** On its odd frames `loc_25a6` draws the vertical column of glyphs itself,
paced by its own step timer `ROPE_DRAW_STEP_TIMER` [code]. When that timer expires it reloads and
picks one of three modes according to the draw state. If a formation slot is occupied
(`FORMATION_SLOT_TABLE` [seen] non-zero) it retracts — blanking a band of cells above the layout
pointer `MARKER_LAYOUT_PTR` [code] and choosing a retract glyph source (`MARKER_RETRACT_GLYPH_SRC` /
`MARKER_RETRACT_GLYPH_SRC_ODD` [code], the variant chosen by the animation-phase parity
`ROPE_DRAW_ANIM_PHASE` [code]). Otherwise it advances the forward sweep: when the current draw count
`ROPE_DRAW_COUNT` [seen] differs from the phase counter `SPAWN_PHASE_COUNTER` [seen] it begins a new
extend sweep — bumping the draw count, raising the extend flag `ROPE_DRAW_EXTEND_FLAG` [code], and resetting
the layout pointer to the sprite band base `SPRITE_BAND_86E3` [code] — and when an in-progress sweep
reaches its limit it clears the extend flag and the anim-armed latch `ANIM_ARMED_LATCH` [code]. While
the extend flag is set it grows the column one row upward, pulses the newly exposed cell pair, and
queues the extend display commands; when the sweep reaches its cap column it latches the completion
flag `ROPE_DRAW_COMPLETE_FLAG` [code]. Whichever mode was chosen, it then stamps the selected glyph
(`MARKER_COLUMN_GLYPH_SRC` / `MARKER_COLUMN_GLYPH_SRC_ODD` [code] on the forward path) down the chosen
number of rows from the layout pointer, and on a forward frame appends the 3x3 cap glyph
(`MARKER_GLYPH_SRC` / `MARKER_GLYPH_SRC_ODD` [code]) below the last drawn record. Every pass ends by
flipping the animation-phase parity so the next draw uses the alternate glyph variant.

### The launch sequence

Independently of the wave engine, individual objects are fed onto the field by a scripted launcher.
Its gate is `loc_6e75` [code]: with a valid ROM (neither the signature-mismatch flag
`SIGNATURE_MISMATCH_FLAG` [code] nor the tamper-freeze flag `TAMPER_FREEZE_FLAG` [code] set) it runs
the single-object launcher and then the per-record driver in sequence; a corrupted ROM would divert
into a dead trap, so that arm never runs in normal play.

The launcher proper is `loc_6e86` [code], and it is paced by the launch sequence counter
`LAUNCH_SEQ_COUNTER` [code] together with a per-call delay. Each frame it ticks the delay
(`INTRO_DELAY_CKSUM_WORD` [seen]) down and returns until it elapses; on expiry it reloads the delay,
picking 0x2c or 0x20 by bit 1 of `LAUNCH_SEQ_COUNTER` so the cadence alternates as objects go out. It
then pulls the next byte from the launch script `LAUNCH_SCRIPT_PTR` [seen] — a 0xff byte terminates
the script for the frame — and treats that byte as a one-based index into the enemy-actor record
array, walking to the selected record. A launch happens only if one of the three projectile slots is
free (its state byte in `PROJECTILE_SLOT_STATE` [seen] being zero); if all three are busy the launcher
backs the script pointer up by one so the same entry is retried next frame. When a slot is free it
arms the chosen record (writing state 6), points it at its spawn animation `SPAWN_ANIM_TABLE_396A`
[code], launches it through the shared spawner `launchProjectileIntoFreeSlot` [seen], and bumps
`LAUNCH_SEQ_COUNTER` — which is what advances the delay cadence and, ultimately, the whole sequence.

After the launcher, `loc_6edb` [code] sweeps the per-record driver over all fourteen enemy-actor
records and then decides whether this launch phase is finished. Completion requires two conditions
together: the launch script has reached its 0xff terminator, and all three projectile slots are idle.
Until both hold it returns. On completion it advances the intro phase and queues the phase-complete
display command, compares three times the target-group count against the running hit tally — forcing a
special phase and swapping in the match command when they agree — then reprimes the intro delay to
0x40, queues the resulting command, and clears the 0x30-byte target block, closing the phase out.

## Rendering, HUD and display lists

Everything the player sees is built out of two tile planes in the 0x8000 video region and a
sprite list that the video hardware overlays on top. The tile-code plane lives at `VIDEO_RAM_BASE`
[code] (0x8400-0x87ff): every cell holds a tile number, laid out 32 cells to a row so the row-to-row
stride is 0x20. Behind it, sharing the same geometry, sits the colour/attribute plane rooted at
`COLOR_RAM_BASE` [code] (0x8000-0x83ff), whose per-cell bytes pick the palette and flip bits for the
matching tile; `ATTRIB_MAP_BASE` [seen] (0x8040) is the first attribute cell the flood routines
actually write. The cabinet runs a rotated monitor, so a "column" on screen is a run of cells one
0x20 stride apart in memory, and almost every painter walks a column *upward* — toward lower
addresses, in `-0x20` steps. Two tile values recur throughout: 0x10 is the blank/erase tile (also the
glyph used to suppress a leading zero), and each drawing primitive knows its own filler.

### Clearing and filling the tile plane

A full-screen tile wipe is spread across many frames rather than done in one burst. `seedTileFillCursor`
[seen] arms it: it drops the caller's start pointer into the 16-bit write cursor `TILE_FILL_PTR` [seen]
and seeds `FILL_ROW_COUNTER` [seen] to 0x20 (32 rows to go). Each subsequent frame the fill body
`loc_02ce` [code] blanks one row's worth of tiles at the cursor to 0x10, then advances the cursor by a
full 0x20 (it fills `B` tiles and then adds `0x20 - B`, landing on the next row's start) and decrements
the row counter; the counter reaching zero is what tells the caller the wipe is finished. Because it
consumes one row per frame, a screen clear visibly sweeps down the playfield while the rest of the game
keeps running.

The same period paints and erases individual scroll columns through a family of three-cell column
primitives. `paintColumnBodyTiles` [seen] stamps the middle body tile (0x25) and the base tile (0x20)
of a vertical run; `loc_02a8` [code] prepends the cap tile (0x01) to make a complete three-tile column;
`paintColumnBodyTilesUp` [seen] is the upward-walking twin; and `blankTileColumn` [seen] erases a
three-cell column back to 0x10, returning the advanced pointer so the caller can chain straight into the
next column. These are the tools the per-frame scroll worker `loc_0254` [code] uses: in a one-player
game it blanks four columns off the right edge (from `COLUMN_CAP_VRAM` and around `P2_SCORE_VRAM`),
while in a two-player game it lays down a capped body column instead; it then stamps the shared scroll
column at `WORKER_COLUMN_VRAM` [seen] via `loc_02a8`, and — when the worker control byte
`WORKER_CONTROL_BYTE` [code] has bit 4 set and a game is live — blanks one trailing column. (When the
control byte's low nibble is nonzero, `loc_0254` skips all of this and only runs the ROM-signature
guard.) The worker is significant because it is the machine's synthetic frame boundary: it runs once
per pass through the ring-idle path, described below.

### Painting the colour/attribute plane

Colour is repainted whole-field rather than per tile. `fillAttributeColumns` [seen] walks 31 columns
outward from `ATTRIB_MAP_BASE`, taking one source byte per column and flooding it down all 30 rows at
the 0x20 stride before stepping the source pointer one byte to the next column. The source is a ROM
table chosen by the caller — `ATTRACT_FIELD_ATTRIB_SRC` [code] and `STATE0_CKSUM_BASE` [code] are two
of the column tables handed in during attract and play setup — so a single call recolours the entire
background to whatever palette layout that table encodes.

Where a rectangular patch needs both planes rewritten together, `loc_0cf8` [code] stamps a two-plane
column strip. It reads 0x0c-byte columns from a source table and writes each one bottom-up (stride
`-0x20`) into the tile plane starting at `COLUMN_BLIT_TILE_DEST` [code], drawing its bytes from
`COLUMN_BLIT_TILE_SRC` [code]. After each column it inspects a steering byte: 0xff switches it over to
the attribute plane — source `COLUMN_BLIT_ATTR_SRC` [code], destination `COLUMN_BLIT_ATTR_DEST` [code]
(which sits in the 0x8000 colour page, the tile destination sits in the 0x8400 tile page) — 0xee ends
the stamp, and anything else is the first byte of the next column, one cell to the right. So one call
paints a block of tiles and then repaints the matching block of colour, driven entirely by the
in-band markers in the source data.

### The sprite display list

Moving objects are drawn from a display list rooted at `SPRITE_DISPLAY_LIST` [seen] (0x8840): 24
four-byte entries, each holding a sprite's Y, attribute (palette + the two flip bits), X, and tile
code. The list is rebuilt from the live actor records every frame by `loc_02ef` [code], which sweeps
four groups of records into it. Stationary/simple groups go through `copyObjectRecordsToDisplayList`
[seen], a raw copy that pulls four fixed fields (record offsets +0x06, +0x10, +0x04, +0x0f) into four
consecutive list slots per record and steps the record pointer by its stride; the eighteen
moving-object records instead go through `loc_0343` [code], which derives on-screen coordinates from
each record's sub-pixel position pair before writing the slot. The player is special: it is drawn as
three sprites stacked vertically, and `deriveStackedSpriteYs` [seen] fans the player actor's base Y
(`PLAYER_Y` [seen], the +0x04 field of actor slot 0 in `ACTOR_TABLE` [seen]) out into the Y fields of
three stacked slots — the base at the bottom, one 0x10 above it, and one 0x0a above that — so the tall
figure moves as a unit.

`loc_02ef` finishes by ticking two frame counters and, on the pass where the orientation gate reaches
zero, running the flip pass. Cocktail/inverted play is handled after the fact by
`mirrorSpriteListVertically` [seen]: it walks the 24 entries in place, negating and offsetting each
coordinate (`-coord - 0x10`) and toggling the two flip bits in the attribute byte while preserving its
palette nibble. The gate is `loc_0320` [code], which decrements a caller-set frame counter and then
runs the mirror pass only while the orientation flag `FLIP_SCREEN_FLAG` [seen] reads zero (the flipped
orientation); an upright cabinet leaves the list untouched. A separate low-level sprite-attribute copy
loop, `loc_0714` [code], shuffles four bytes per pass between record and list slots with its source
low byte wrapping inside its 256-byte page.

### The display-command ring and its interpreter

Rendering work is decoupled from the code that requests it through a command ring. The ring buffer is
`DISPLAY_CMD_RING_BUFFER` [code] (0x88c0-0x88ff, 32 two-byte slots on page 0x88), with an independent
write cursor `DISPLAY_CMD_RING_WRITE_PTR` [code] and read cursor `DISPLAY_CMD_RING_READ_PTR` [code].
Any subsystem posts work by handing a two-byte command to `loc_0038` [code]: if the slot under the
write cursor is free (its byte has bit 7 set) it stores the command's high byte there and the low byte
in the next slot, then advances the write cursor by two, wrapping back to the ring start (low byte
0xc0) when it runs past the end; a slot that is already occupied simply drops the command. Boot fills
the ring with 0xff so every slot starts free.

The interpreter is the machine's spine, `mainLoop` [code] (the state driver at 0x020f). Each iteration
reads the slot under the read cursor. If that slot is free — bit 7 set, meaning the ring has drained —
it runs the per-frame worker `loc_0254` and that iteration *is* the frame boundary (the machine
free-runs with no vblank wait, so the ring-idle worker pass is the synthetic per-frame tick). If the
slot holds a command, the interpreter takes the command's high byte as a handler selector: it doubles
it and masks to an even offset into the handler table at 0x0242, marks both of the command's slots free
again, advances the read cursor (wrapping at 0xc0), and jumps to the selected handler with the
command's low byte in hand as a sub-parameter. Crucially the ring is drained *within* a single frame —
the interpreter keeps dispatching commands back-to-back until it hits a free slot, only then yielding
at the worker boundary — so a backlog built up on, say, the credit screen is fully serviced in one
frame rather than trickling out one command per interrupt.

The command words themselves are a large, structured family. The high byte names the handler class and
the low byte selects the variant; the 0x06xx block is the display/board group — `DISPLAY_CMD_0600`
[code], `DISPLAY_CMD_0602` [code] and `DISPLAY_CMD_0603` [code] posted by the in-play state handlers,
`OBJECT_SPAWN_DISPLAY_CMD` [code] (0x0611) and the `ATTRACT_SETUP_*` [code], `WAVE_SPAWN_*` [code],
`PROMOTE_*` [code] and board-intro (`DISPLAY_CMD_0616`/`0617`/`0628`/`0629`/`062A` [code]) variants
that request specific screen setups at the corresponding game events. Other high bytes route the same
mechanism to non-display work (the 0x03xx/0x04xx families carry sound cues such as `DISPLAY_CMD_0300`
[code] and `START_OF_LIFE_DISPLAY_CMD` [code]), so the ring is a general per-frame command queue of
which the tile/HUD painters are the largest consumers.

### HUD number primitives

Numbers on the HUD are packed BCD (two decimal digits per byte) rendered as individual digit tiles.
Two converters feed the display. `binToPackedBcd` [code] turns a binary count into its low two decimal
digits plus a separate hundreds tally by counting up in BCD (a zero input means a full 256 passes,
yielding 0x56 with a hundreds of 2); `byteToPackedBcd` [code] converts a plain byte to its value-mod-100
packed form the way the Z80 does it, weighting the high nibble by decimal 16 through repeated
BCD-corrected adds. Once a value is packed, `drawStackedBcdDigits` [code] paints it as two vertically
stacked tiles — tens at the cursor, units one row up — blanking a leading-zero tens digit to 0x10.
`splitBcdByte` [seen] is the finer-grained twin used where digits are drawn one at a time: it writes the
low nibble as a tile, advances the cursor, and hands back the high nibble (with a zero flag that callers
read as the leading-zero signal). `renderDigitWithBlanking` [seen] threads leading-zero suppression
across a whole multi-digit field: it carries a blank budget, painting 0x10 for each zero while the
budget lasts and forcing the budget to zero the moment a real digit appears, so only the *leading*
zeros of a field blank out.

### Score, high-score and credit fields

The live scores are three-byte packed-BCD counters. `loc_0496` [code] accrues the active player's score
each frame while the game is live: it picks the increment (the per-frame value `PER_FRAME_SCORE_INCREMENT`
[code] when the award index is zero, otherwise a three-byte entry from `SCORE_AWARD_TABLE` [code]),
BCD-adds it into the active counter — `selectActivePlayerScoreBuffer` [code] chooses `P1_SCORE_BCD`
[seen] or `P2_SCORE_BCD` [seen] off the active-player bit — then repaints that player's on-screen
column and compares the counter most-significant-byte-first against the running high score
`HIGH_SCORE_BCD` [code], copying it over and repainting the high-score row when it wins. The column
painter is `loc_056b` [code]: a selector of 0/1/2 chooses source counter and destination column
(`P1_SCORE_VRAM` [seen], `P2_SCORE_VRAM` [code], or `HIGH_SCORE_VRAM` [code], the latter reading the
high-score MSB `HIGH_SCORE_BCD_HI` [seen]), and it splits each of the three source bytes into high then
low digit up the column through `renderDigitWithBlanking`, sharing one blank budget so the score reads
without leading zeros. `loc_0552` [code] is the reset counterpart: it zeroes one of the three counters
and repaints it.

The credit counter is drawn by `loc_05ee` [code]: it reads `CREDIT_COUNT` clamped to 99, converts it
with `byteToPackedBcd`, writes the units nibble to `CREDIT_HUD_UNITS_VRAM` [code] and the tens nibble
(when nonzero) to `CREDIT_HUD_TENS_VRAM` [code]. (Only when the units digit happens to be 2 does it also
run a hidden ROM-checksum tripwire, an anti-tamper aside rather than a rendering step.) The attract
screen's whole score panel is assembled by `loc_03e9` [code]: it draws eleven selector-indexed
character fields, then renders the ten-entry high-score table `HIGH_SCORE_TABLE` [code] into
`HIGH_SCORE_TABLE_VRAM` [code] as stacked BCD digit pairs (each byte split low-then-high a row apart,
the column re-based two cells right per row, the top digit's leading zero suppressed), and finally
repaints the digit and status panels. The table it draws is kept sorted by `loc_1ab2` [code], which
insert-sorts a finished player's score into the ten entries (shifting the parallel play-time and
display-tile side tables in step). The status panel itself is painted by `renderPanelFromTable` [seen],
which walks ten rows of three cells from the work-RAM tile source `PANEL_TILE_SOURCE` [code] into
`PANEL_VRAM_DEST` [seen], substituting a blank tile (0x40) for any empty source cell and re-basing the
cursor forward a column after each row's first two cells.

### Stage label, round number and status readouts

The round/stage banner is rebuilt from the round and stage state. `paintRoundNumberHud` [seen] does the
once-per-round setup — it copies an attribute field bottom-up from `ROUND_HUD_FIELD_SRC` [code] into the
`RESET_ATTR_COLUMN` [seen] through its 0x10 terminator, then BCD-converts `ROUND_COUNTER` [seen] + 1 and
paints its two digits into `HUD_ROUND_DIGIT_HI` [seen] / `HUD_ROUND_DIGIT_LO` [seen] (blanking a leading
zero), stamps the round glyph block into `ROUND_TILE_DST` [seen] and `HUD_ROUND_TILE` [seen], and draws
the selector glyph — and then, on every frame, falls into the update chain of `refreshRoundStageHud`
[code] followed by the stage-countdown digits. `refreshRoundStageHud` derives the stage countdown's tens
digit, and only on the first stage (tens zero) redraws the BCD round number from `ROUND_COUNTER` — picking
one of two glyph banks `ROUND_DIGIT_GLYPHS` [code] / `ROUND_DIGIT_GLYPHS_ALT` [code] by a tens bit — before
drawing the fixed stage label indexed out of `STAGE_LABEL_PTR_TABLE` [code] into `HUD_STAGE_LABEL_TILE`
[seen]; it holds off entirely while any of seven integrity flags is armed. `drawStageLabelOncePerLevel`
[code] is the one-shot variant, gated by the `LEVEL_TAG_DONE_LATCH` [code] and keyed off the
`STAGE_TAG_COLUMN_TABLE` [code] to choose the label column, and `loc_1f40` [code] is the table-scanning
sibling that finds a stage value in a table and then draws the same header. The glyph blocks themselves
come from three stampers: `blitTile3x3Block` [seen] copies a 3x3 block (advancing both destination and
source so a caller can chain the next block), `blitGlyphBlock4x3` [seen] copies a 4-row block with its
row writes wrapping inside the tilemap page, and `loc_1ffb` [code] picks between two fixed 3x3 glyph
sources `GLYPH_TILES_A` [code] / `GLYPH_TILES_B` [code] on bit 5 of its selector and stamps into
`GLYPH_BLOCK_DEST` [seen].

The stage countdown is drawn by `renderStageCountdownDigits` [seen]: it reads `STAGE_COUNTDOWN` [seen]
and writes its units nibble to `HUD_STAGE_DIGIT_LO` [seen] plus its tens nibble one row over, drawing a
value below ten as a single digit and packing anything larger to BCD first (that two-digit path is
suppressed while the play-mode latch `PLAY_MODE_LATCH` [code] is held). The phase counter shows as a
vertical bar: `renderPhaseGauge` [seen] / `paintPhaseGauge` [seen] read `GAUGE_PHASE_COUNTER` [seen],
leave the gauge untouched on a zero count, and otherwise draw `count - 1` filled tiles (0xb0) up from
`PHASE_GAUGE_BASE_TILE` [seen] — clamped to the gauge's five cells — with blanks (0x10) above them, so
the bar shrinks as the phase drains. The play timer is rendered inside the shared integrity handler
`loc_7960` [code], which splits the active player's minutes and seconds BCD bytes (`PLAY_TIMER_BCD_P1`
[code] / `PLAY_TIMER_BCD_P2` [code]) into hi/lo nibble tiles up the column at `PLAY_TIMER_DIGIT_VRAM`
[code], parting the minute and second groups with a spacer tile (0x51) and then clearing the rendered
timer bytes.

A small always-running pump keeps the animated status cells alive. `tickStatusRenderRingAndRedrawOnWrap`
[seen] decrements the mod-8 ring `STATUS_RENDER_RING` [seen] every call and holds the display steady
while it stays nonzero; on wrap it borrows one from the mod-4 phase `STATUS_RENDER_PHASE` [seen] and
falls into `wrapRenderPhaseAndPaintTileTriplet` [seen], which masks the phase to 0..3, looks up a
tile-block descriptor for it in `STATUS_RENDER_TILE_TABLE` [code], and stamps three 2x2 blocks two rows
apart into `STATUS_RENDER_VRAM_BASE` [seen] through `blit2x2TileBlock` [seen] — the third block
alternating between `STATUS_FIELD_TILE_A` [code] and `STATUS_FIELD_TILE_B` [code] on the phase's low
bit. This is what cycles the animated 2x2 tile squares seen at `ANIM_TILE_BLOCK_TOP` [seen] and
`ANIM_TILE_BLOCK_BOTTOM` [seen] through their frame codes. Where a 2x2 square is stamped from a source
row rather than blitted from the display path, `paintTileBlock2x2` [seen] copies the four bytes into a
2x2 tilemap cell (top-left, top-right, bottom-right, bottom-left order).

Two related tile-strip animators walk a marching decorative strip. `advanceTileAnimForwardOnOdd` [seen]
and `retreatTileAnimScript` [seen] share the parity tick `TILE_ANIM_PARITY` [seen] — the forward twin
acts on odd frames and the retreat twin on even — and both move the 16-bit cursor `TILE_ANIM_CURSOR`
[seen] along a video-RAM tile strip, the forward pass bumping each cell's tile code upward until it
hits the wrap value 0x37 (then stepping the cursor on and reseeding 0x34), the retreat pass counting
it back down until the 0x34 marker reloads the base code and backs the cursor up.

Finally, `loc_10c2` [code] repaints a compound three-field BCD readout used during the between-phase
sequence: it walks a counter toward a target, stores it, and draws three stacked-BCD fields
(`SUBSTATE_FIELD1_VRAM` [code], `SUBSTATE_FIELD2_VRAM` [code], `SUBSTATE_FIELD3_VRAM` [code], with the
hundreds digit spilling to `SUBSTATE_FIELD3_HUNDREDS_VRAM` [code] when present) through
`drawStackedBcdDigits`, before advancing the main-loop sub-state `MAINLOOP_SUBSTATE_SELECTOR` [code] and
queuing a sound cue.

## Sound

The main CPU never makes a sound itself. Its entire connection to the audio hardware is a
single byte: it writes one command code to the sound-command latch `SOUND_COMMAND_LATCH`
(0xa100) [seen] and pokes an interrupt line, and a second processor turns that byte into
noise. Every sound the game produces — the coin-accept drip, the warning siren, the round
fanfares, each shot and catch — is ultimately just some routine deciding which byte to drop
into that one latch. Understanding the sound subsystem therefore means understanding two
things: the narrow write path down to the latch, and the handful of event drivers upstream
that decide what to write and when.

### Handing a byte to the audio CPU

The choke point is `sendSoundCommand` [seen]. It stores the command byte at
`SOUND_COMMAND_LATCH` (0xa100), then strobes the audio-IRQ line `AUDIO_IRQ_LATCH` (0xa181)
[seen] — bit high, then immediately back low. That rising edge is what interrupts the sound
CPU into reading the freshly-latched byte; the pulse itself carries no data, it is purely the
"a command is waiting" signal. Nothing about the command survives in a register afterward, so
the latch and the strobe are the whole effect.

Beyond a single boot-time silence write, only two things call `sendSoundCommand` during play.
The boot entry `loc_0092` [code] latches command 0x00 once at power-on to quiet the audio CPU,
and never touches it again. Of the two runtime callers, the first is `emitPresetSound` [code],
an immediate one-shot that latches the fixed preset code 0x0b straight through with no
buffering — this is the drip tick, discussed below. The second is the ring drainer, which is
how nearly everything else reaches the latch: producers do not touch the latch directly, they
leave a byte in a buffer and let the drainer feed it out one slot at a time.

### The sound-command ring

Between the game's many sound triggers and the single latch sits a small circular buffer, the
sound-command ring. Its slots live at `SOUND_RING_BUFFER` (0x8a43..0x8a5e) [code], with a
write cursor `SOUND_RING_WRITE_PTR` (0x8a40) [code] and a read cursor `SOUND_RING_READ_PTR`
(0x8a41) [code], both stepping through that 0x43..0x5e range and wrapping the last slot back to
the first. Boot fills every slot with 0xff, which doubles as the empty marker, so a slot
holding 0xff means "nothing queued here."

Two helpers put bytes in. `enqueueSoundCommandRing` [seen] is the unconditional one: it drops
the byte into the slot the write cursor names and advances the cursor, no questions asked.
`appendSoundCommandGated` [code] is the guarded one: it first stashes the byte in a holding
cell `SOUND_RING_PENDING_BYTE` (0x8d20) [code], then writes it into the ring and advances the
cursor *only* while a game is in progress (`GAME_ACTIVE_FLAG` [seen]) or the play-mode latch
`PLAY_MODE_LATCH` (0x8f50) [code] is set; with both clear the byte is simply dropped and the
cursor left untouched. This is why idle-attract triggers that go through the gated path make no
sound, while a running game's do. The gated helper hands its advanced cursor back in the
accumulator for callers that chain further appends.

Draining is the job of `drainSoundCommandRing` [seen], which runs once per frame. It looks at
the slot under the read cursor; if it holds the 0xff empty marker there is nothing to do.
Otherwise it forwards the byte to the audio CPU through `sendSoundCommand` — but only when
sound is currently allowed: either demo/attract sounds are enabled (bit 0 of
`DEMO_SOUNDS_DSW`, 0x8821 [code]) or a game is active (`GAME_ACTIVE_FLAG`). The machine falls
silent only when both are false, meaning attract mode with demo sound switched off. After
forwarding, the drainer writes 0xff back to free the slot and advances the read cursor —
exactly one slot per call, with no inner loop. The drain is driven from the per-frame NMI
dispatch rooted at `loc_066d` [code], which also runs the coin/credit chain described below. A
single-byte trigger is therefore emptied in the frame that fills it, close to a one-frame
hand-off; but the multi-byte packets and four-byte "runs" described below queue several bytes
at once, and since each drain forwards only one, those genuinely buffer across successive frames
before they clear. The ring is a shallow cross-frame queue, not merely a one-frame latch.

### The command set the game emits

Sitting above the two producers is a large family of thin trigger routines, one per sound
event, each of which does nothing but name a fixed command byte and hand it to a producer.
Command 0x00 is silence, enqueued to stop the current sound; the low range 0x01 through 0x14
are individual effect codes, most of which are appended or enqueued by their own single-purpose
wrapper (`queueSoundCommand01` [code], `queueSoundCommand02` [code], and so on up the range).
Not every value in the range has a standalone wrapper, though — 0x03 and 0x10 have none and
ship only bundled inside multi-byte packets (`queueSoundCommands82And03` [code],
`queueSoundCommands95And03And11` [code], `queueSoundCommands95And10` [code]). A few are
conditional rather than unconditional: `queueSoundCommand04IfNotBusy` [code] drops its byte
entirely while the wave is tearing down (`WAVE_TEARDOWN_STATE` [seen]) or a rope-grab is in
progress (`GRAB_ACTIVE_FLAG` [seen]), so that effect never steps on those events.

Some triggers emit short packets of several bytes in order — for instance a pair like 0x19
then 0x15, or 0x82 then 0x03, or the four bytes 0x96, 0x97, 0x18, 0x15 that the siren-arm
fires. A recurring shape is the four-byte "run": a lead byte followed by the fixed trailer
0x15, 0x16, 0x17, assembled by `appendSoundCommandRun` [code]. Several triggers choose that
lead byte from game state rather than fixing it: `queueRoundSoundCommandRun` [code] selects one
of 0x1e..0x21 from two bits of the round counter `ROUND_COUNTER` (0x8907) [seen], and
`queueRoundVariantSoundRun` [code] selects one of 0x22..0x25 the same way, so the sound tracks
which round is being played. Standalone runs open with fixed leads too — 0x1d for the
phase-exhausted run (`queueSoundRun1D` [code]), 0x26 (`queueSoundRun26` [code]), 0x28
(`queueSoundRun28` [code]). The preset drip 0x0b stands apart from all of these: it is the one
code emitted immediately through `emitPresetSound`, bypassing the ring entirely.

The audio map that accompanies the game carries no per-command name table — it declares only
the clip model and the latch address (`model: "clips"`, `soundLatch: 0xa100`). The "command
set" is therefore exactly the set of byte values these trigger routines emit, and each distinct
value is one recorded clip rather than a named entry.

### The coin-and-credit drip drivers

The drip is a per-frame debounce-and-accumulate mechanism driven from the NMI through
`loc_59e8` [code], the credit/coinage chain. That chain first bows out if either coin slot is
configured for free play (a coinage nibble reading 0x0f in `COINAGE_CONFIG` (0x882c) [seen] or
`COINAGE_CONFIG_SLOT2` (0x882f) [code]); otherwise it runs three sibling drip steps every
frame, one per input line.

Each drip step keeps a small shift-register "ring" that samples one bit of the inverted input
port `INPUT_PORT0` (0x8810) [seen] per frame and rotates it in, and fires only when the ring's
low three bits settle on phase value 1 — a debounce that turns a held input into a steady,
spaced cadence of fire events rather than a continuous stream. Variant A, `loc_5a06` [code],
samples input bit 2 (the service line) into `DRIP_RING_A` (0x8829) [code]; variant B,
`loc_5a1f` [code], samples bit 1 (coin slot 2) into `DRIP_RING_B` (0x882d) [code] and bumps
`COIN2_PULSE_COUNT` (0x8826) [code]; variant C, `loc_5a56` [code], samples bit 0 (coin slot 1)
into `DRIP_RING_C` (0x882a) [code] and bumps `COIN1_PULSE_COUNT` (0x8824) [code]. On every fire,
whatever the variant, the audible signature is the same: it calls `emitPresetSound`, latching
the 0x0b drip straight to the audio CPU, before doing its accounting.

That accounting is what the drip is *for*. After sounding, each variant nudges a coordinate
pair and, when the pair rolls over, joins the shared accumulate tail `loc_5a8c` [code], which
adds the step amount into the credit counter `CREDIT_COUNT` (0x8802) [seen], clamps it to a
maximum of 0x63, and tails into `loc_5a97` [code] to queue a display refresh so the credit
digits redraw. So a coin (or service push) is accepted as a spaced series of debounced pulses,
each one crediting the counter a notch and sounding one 0x0b drip — the familiar per-credit
tick. Note that this refresh goes out through `loc_0038` [code] into the page-0x88
display-command ring, a separate buffer for on-screen tile work; only the 0x0b drip itself
travels the audio path.

### The warning siren

The siren has two independent halves that happen to share a name — an audio half and an
on-screen half — and it is important not to confuse them.

The audio half is `loc_196e` [code], the gated periodic siren-arm, run each gameplay frame. It
does nothing at all while its busy latch `PERIODIC_MODE_LATCH` (0x8d55) [code] is non-zero.
Otherwise it reads the per-round spawn-phase value `SPAWN_PHASE_COUNTER` (0x8902) [seen] and
branches on it. When the phase is exactly 5, it arms a two-cell pair — the siren-enable gate
`SIREN_ENABLE_GATE` (0x8d68) [code] when no rope-grab is active (`GRAB_ACTIVE_FLAG` [seen]),
otherwise the caller-supplied pair — and, if that pair's first cell is free, sets both cells
and fires the mode-five sound packet `queueSoundCommands96And97And18And15` [code]. When the
phase climbs above 5, it records that value in the busy latch and fires the higher-mode packet
`queueSoundCommands19And15` [code] as long as no grab is active. Below phase 5 it does neither
and falls through.

Either way it then runs a shared event countdown, `PERIODIC_EVENT_TIMER` (0x8d22) [code], but
skips it entirely while the wave-event latch `WAVE_EVENT_LATCH` (0x8d21) [seen] or the
formation-teardown state `WAVE_TEARDOWN_STATE` (0x8f24) [seen] is set. When the countdown
reaches zero it reloads to 0x20, raises `WAVE_EVENT_LATCH`, and fires the siren sound run
`queueSirenSoundRun` [code] — which, provided the siren-enable gate is clear, appends a lead
byte chosen 0x1a-or-0x1b by the round counter's low bit plus the completing run. This is what
gives the siren its periodic, escalating audible pulse as a wave progresses.

The on-screen half is `loc_19ca` [code], the siren display tick, which runs only while no game
is active and the siren-enable gate is set. A frame countdown `SIREN_FRAME_COUNTDOWN` (0x8d6a)
[code], reloading at 0x18, flips a phase byte `SIREN_PHASE_BYTE` (0x8d69) [code] on each expiry
and enqueues one of two display-command words — `SIREN_DISPLAY_CMD_A` (0x060f) or
`SIREN_DISPLAY_CMD_B` (0x068f) [code] — through `loc_0038` into the page-0x88 display-command
ring. These animate the siren's tiles on the attract screen; they are display commands, not
audio commands, and never reach the sound latch. The audio siren and the drawn siren are thus
driven by two different routines writing to two different rings.

### Record/replay audio model

Physically the cabinet holds two Z80 processors. The main CPU runs the game; the sound CPU is a
separate processor running the shared timeplt-audio program ("tpsound"), and it alone
synthesizes audio. The only wire between them is the one-byte latch at 0xa100 and the interrupt
strobe at 0xa181 that `sendSoundCommand` drives. Because the sound CPU has no other input, the
game's entire audio output is a pure function of the sequence of command bytes latched over
time.

That is what lets audio be modelled by recording rather than by simulating the second
processor. The audio map declares the clip model and the latch address and nothing more: each
distinct command byte corresponds to one captured waveform, and replaying the matching clip on
every write to 0xa100 reproduces what the real sound CPU would have played. The interrupt
strobe and the sound CPU's own instruction stream need no model at this level — the latch write
is the whole observable interface, and the command byte is the whole message.

## Anti-tamper

Pooyan does not verify its program image in one place. Instead a family of small
integrity guards is threaded through ordinary gameplay handlers, and each fires as a
side effect of work the machine was doing anyway — spawning an actor, catching a
falling enemy, ticking an actor's state timer, drawing the round number. Every guard
follows the same shape: fold a fixed span of ROM (sometimes program code read as data)
into a small running checksum, then compare the fold against a sentinel baked into the
image when it was built. On an intact ROM the fold always lands on its sentinel and the
guard does nothing. When the fold misses, the guard does not halt the machine; it
records the fact in a dedicated RAM tally and returns. A separate set of consumers reads
those tallies later and quietly degrades the machine — refusing to spawn, skipping the
actor update, or omitting HUD setup. Because an unmodified image balances every fold,
all of these tallies sit at zero during real play and the degrade paths never execute;
that is why the tally cells carry a `[code]` reading rather than a `[seen]` one — their
non-zero states are only reachable on an altered ROM.

### The shared freeze tally and its producers

The central tally is `TAMPER_FREEZE_FLAG` `[code]`, a one-byte counter that several guards
increment and several consumers read. Three guards feed it.

The frame-timer spawner tail `loc_5594` `[code]` is one. When it walks its actor-block
table and finds the first free slot to seed, it first runs a signature self-check:
it sums the eight bytes of `INTEGRITY_GUARD_REGION_0BAD` `[code]` byte-for-byte against
the eight bytes of the two's-complement reference `INTEGRITY_GUARD_SIGNATURE_55B5`
`[code]`, and if any of the eight pairwise sums is non-zero — meaning the region no
longer complements its stored signature — it bumps `TAMPER_FREEZE_FLAG` before going on
to seed the slot. Its sibling `loc_5544` `[code]` is the same first-free-slot spawn tail
for the other scheduler but carries no such check; the guard lives only in the
frame-timer variant.

A play-state handler, `loc_1b43` `[code]`, contributes the second. Among its per-frame
duties it folds a 34-byte program block starting at `TAMPER_CKSUM_BASE_5593` `[code]`
into a rolling checksum — each byte masked, rotated right through carry, and added back
with that carry — and an intact image folds to exactly `0x7c`. Any other result bumps
`TAMPER_FREEZE_FLAG`.

The third is `flagTamperOnRound5ChecksumMiss` `[code]`, which arms only when
`ROUND_COUNTER` reads 5. At that one round it sums six program bytes, counting each 8-bit
overflow separately, and checks whether the low sum plus the carry count plus a `0x7f`
bias wraps to zero. The intact image is tuned so it does; if it does not, the guard bumps
`TAMPER_FREEZE_FLAG`. At every other round the routine touches nothing.

### What a non-zero freeze tally does

Three consumers read `TAMPER_FREEZE_FLAG` and each degrades a different part of the
frame once it is non-zero.

The lead-actor driver `advanceLeadActorPrimaryState` `[seen]` **aborts actor updates**.
It runs its three per-frame sub-passes first, then checks the flag: if it is set the
driver returns immediately, before it would otherwise steer the lead actor record's
low-three-bit state through the actor-group state table at `ACTOR_TABLE` `[code]`. A set
flag therefore leaves the actor group's per-frame state advance un-run.

The phase-1 spawner gate `loc_6e75` `[code]` **freezes spawns**. It reads both
`TAMPER_FREEZE_FLAG` and `SIGNATURE_MISMATCH_FLAG` `[code]`; with neither set it runs the
single-object launcher and the per-record driver as normal. With either set the original
image takes a skip-spawn jump whose target is data, not code — a dead trap — so on a
valid ROM this arm is unreachable and never spawns; a raised flag is what would send it
there.

The round-HUD painter `paintRoundNumberHud` `[seen]` **skips HUD setup**. Its one-time
round-number build — copying the attribute field into the reset column, BCD-converting
the round, stamping the round glyph blocks, and rendering the selector glyph — runs only
when the freeze flag is clear. When it is set, the painter falls straight through to the
per-frame update chain (the round-progress updater and the stage-countdown digits) and
the round-number setup is omitted.

### Guards that raise their own flags

Not every guard funnels into the shared freeze tally; several checks that live inside
specific actor and render handlers keep their own dedicated flag.

The actor state-4 handler `loc_2a79` `[code]` performs a signature comparison rather than
a checksum. It walks 0x68 bytes of a fixed program window from
`STATE4_SIGCHECK_CODE_BASE_ADDR` `[code]` upward against a stored reference block from
`STATE5_SIGCHECK_REF_TOP` `[code]`, also read upward, and any single byte that differs
tail-jumps the handler into the state-1 handler (a tamper re-entry). Only when all 0x68
bytes match does it do its real state-4 work — reseat the record's frame-hold, clear the
flip bit, and advance the record's state. Both compared blocks are fixed program bytes
the running game cannot alter, so on an intact image every byte matches and the divert is
never taken.

The catch handler `advanceFallingEnemyAndTallyCatchOnLanding` `[code]` embeds a checksum
on one of its landing paths. After a caught enemy lands, scores, and drops the active
count, the normal path simply decrements and repaints the stage countdown; the special
path (record path-flag bit 0 set) instead zeroes the countdown, repaints it, and then
sums bytes descending from `CATCH_TAMPER_CKSUM_TOP` `[code]` down to a `0xc8` terminator,
counting carries as it goes. An intact block produces exactly eight carries — the guard
accepts the block only when `(0xc8 - carries)` equals `0xc0` — and any other carry count
raises `TAMPER_STRIKES_CATCH` `[code]`.

The timer-driven actor handler `advanceActorStateOnTimerWithTamperCheck` `[seen]` folds a
checksum deep inside its state advance. After running the animation player and counting
its per-record timer down to zero, it advances the record's sub-state and — only when the
record pointer has reached the object-table band at `SPRITE_OBJECT_TABLE` `[code]` and the
global `FRAME_COUNTER` gate is clear — folds a program block backward from
`ACTOR_TAMPER_CKSUM_TOP` `[code]` to a `0x1a` terminator, keeping an 8-bit wrapping sum and
a separate carry tally. If the combined result keeps any of the masked bits (a `0x9e`
mask over carries-plus-sum), it bumps `SIGNATURE_MISMATCH_FLAG` — the same flag the
spawner gate `loc_6e75` reads, so an object-frame signature miss ultimately also freezes
spawns.

Finally, the table-checksum tripwire `verifyTableChecksum` `[code]` is the guard reached
when the singleton-actor spawner `loc_5835` `[code]` first brings its actor to life:
having seeded the record and pointed it at its animation, `loc_5835` tail-runs the
tripwire over a fixed data region. `verifyTableChecksum` sums 0x52 bytes from
`CHECKSUM_ROM_BASE` `[code]` into a 16-bit accumulator, and the region is intact only when
that accumulator reads high byte `0x1d`, low byte `0xc1`; on that exact match it returns
quietly, and on any other total it raises `TAMPER_ROM_CHECK_FLAG` `[code]`.

## Open questions

These are the readings the code fixes but MAME has not yet confirmed, plus the paths no capture has exercised. Each is a work item for a following grounding pass.

- **Sound byte-to-effect map.** The page-0x8a sound-command FIFO is [seen] as a FIFO that reaches the audio CPU, but which specific sound each command byte (0x00..0x28, and the high-bit bytes 0x82/0x95/0x96/0x97) selects is [code]/[guess] — it needs an audio-side grounding pass that watches the audio CPU, not just the latch.
- **Foreground scroll worker 0x0254.** Whether it does load-bearing drawing during live play or is an attract/idle task is unsettled; its gating control byte 0x883f is [code]-only and its scroll-column duties overlap the vblank NMI's own column rebuild (0x0714).
- **Coin path beyond slot 1.** Slot 2 bumps a pulse counter at 0x8826 but only slot 1's counter (0x8824) has a wired coin-meter strobe, so whether 0x8826 drives a second physical meter is unconfirmed; and the third acceptor (input bit 2, flat +1 credit, no coinage or meter) is unlabelled as service-credit vs a third coin slot. The debounce-ring and coord cells this path uses (0x8829/0x882a/0x882d/0x882e) carry inherited `DRIP_` names from an earlier reading the current code refutes; they read as the coin-acceptance rings/coords here and want a coin rename once a coin-insert capture confirms the meter wiring.
- **Phase-gauge cell 0x8908 dual use.** It is [seen] draining 3→0 as a phase gauge, yet another routine bumps the same cell saturating on a bonus-award threshold no golden reached; the two uses need a scoring-active capture to reconcile.
- **The six-slot object-state array 0x8ba0.** Its arm/advance/draw/integrity four-way machine and the per-pool overloading of the shared 0x18-byte record fields are [code]-only — no golden exercised a full cycle.
- **Formation / band-build / intro-launch.** The formation-spawn timer (0x8d30) and the band-build arm latch (0x8f63) are static-0 in every golden, so those paths — including the rope-extend tamper-strike branch and the formation phase-handler table at 0x30eb — are [code]-only, unconfirmed by MAME.
- **Display-command ring drain.** The ring cells are [code], never watched transitioning in a golden, and the display-command handler table's per-type mapping is not enumerated, so which screen region each command word repaints is inferred from the enqueue sites rather than confirmed by watching the ring drain.
