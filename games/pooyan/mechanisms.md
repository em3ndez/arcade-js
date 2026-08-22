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
attack waves, and finally how all of it is turned into pixels.

## Legend

Every cell and routine role carries a confidence tag:

- **[seen]** — the reading ends in a MAME observation (a value watched change, a poke, a write tap).
- **[code]** — read from the code: consistent across the routines that touch it, MAME-grounding pending.
- **[guess]** — inferred; the least certain, flagged so it is not trusted as fact.

A cell with no tag is named but its role is not yet pinned. Where a reading is counterintuitive, a
callout warns about it in place.

## The work RAM and its state model

Everything the game "knows" at any instant lives in the 32 KB of read/write space the Z80
sees above its program ROM. The board splits that space into four distinct kinds of memory
— two video planes, a work-RAM scratch region, and two sprite banks — plus a bank of
memory-mapped hardware ports at the top. The game's behaviour is entirely a matter of a few
dozen state cells in the work RAM steering a small stack of per-frame dispatch loops; those
loops read the state cells, mutate the actor and object tables, and paint the results into
the two video planes and the sprite banks. This section describes that layout and the
dispatch model that drives it.

### The address space and the hardware window

The CPU's view of memory is a fixed decode (`boards/pooyan/memory.js`). The bottom 32 KB,
`0x0000`–`0x7FFF`, is program ROM. Above it sit the four RAM
regions the machine draws from: the colour/attribute plane at `0x8000`–`0x83FF`, the
tile-code plane at `0x8400`–`0x87FF`, a 2 KB work-RAM block at `0x8800`–`0x8FFF`, and two
256-byte sprite banks — bank 0 based at `0x9000`, bank 1 at `0x9400`, selected within
`0x9000`–`0x9FFF` by address bit `0x0400` under a don't-care mirror mask of `0x0B00`.

From `0xA000` up the decode is not memory at all but a set of devices, and read and write to
the same address are different devices. On the read side the four control/DIP inputs appear
as `DSW1_PORT` `0xA000` `[code]`, `IN0` at `0xA080`, `IN1_PORT` `0xA0A0` `[code]`, `IN2_PORT`
`0xA0C0` `[code]`, and `DSW0_PORT` `0xA0E0` `[code]`, each honouring a mirror mask rather than
occupying a single address. On the write side the same `0xA000` kicks the watchdog,
`SOUND_COMMAND_LATCH` `0xA100` `[seen]` hands a byte to the audio CPU, and the eight
addresses `0xA180`–`0xA187` are an LS259 addressable latch, one control bit per address: bit
0 (`NMI_ENABLE_LATCH` `0xA180` `[code]`) gates the vblank NMI, bit 1 (`AUDIO_IRQ_LATCH`
`0xA181` `[seen]`) strobes the sound IRQ, bits 3/4 drive the coin counters, and bit 7
(`FLIP_SCREEN_LATCH` `0xA187` `[code]`, inverted) sets screen orientation. There is no
video-enable bit; the display is always on. Any access that decodes to none of these regions
throws rather than floating, so a stray read or write surfaces as a fault instead of
corrupting silently.

For diffing and snapshotting, the machine's entire observable RAM state is the five writable
regions concatenated in a fixed order — colour, tile, work, sprite-bank-0, sprite-bank-1,
4608 bytes total. That concatenation is the state model's ground truth: everything below is a
description of what those bytes mean.

### The two video planes and the sprite banks

The picture is built from two parallel 32×32-cell planes that share the same cell geometry.
The tile-code plane (`VIDEO_RAM_BASE` `0x8400` `[code]`) holds one 8×8 tile index per cell;
the colour/attribute plane (`COLOR_RAM_BASE` `0x8000` `[code]`, with the playfield attribute
grid seated at `ATTRIB_MAP_BASE` `0x8040` `[seen]`) holds one attribute byte per cell in
lock-step. When the renderer paints a cell it takes the tile code from the tile plane and the
attribute from the matching colour-plane cell: the attribute's low four bits pick the 16-pen
colour block and bits 6 and 7 flip the tile in X and Y. Tiles are 4-bit-deep (16 pens each),
decoded from two ROM halves. The visible raster is 256×224, drawn from native rows 16..239 in
a portrait (ROT90) orientation, at ~60.606 Hz off a 3.072 MHz CPU (50688 cycles per frame,
per `boards/pooyan/hardware.json`).

Sprites are a second pass laid over the opaque tilemap — a single layer, no priority split.
The two sprite banks hold paired halves of each sprite record at the same offset: in bank 0,
byte `offs` is the screen X and `offs+1` the sprite code; in bank 1, byte `offs` is the
control byte (colour in bits 0–3, an active-low flip-X in bit 6, flip-Y in bit 7) and
`offs+1` is `240 − Y`. The renderer walks records from offset `0x10` up to `0x3E` in
ascending order, so where two sprites overlap the higher offset wins, and pen 0 is
transparent.

Crucially, the sprite banks are not written by gameplay directly. Gameplay maintains a sprite
display list in work RAM — `SPRITE_DISPLAY_LIST` `0x8840` `[seen]`, a 24-entry table of
four-byte records rebuilt every frame — and once per vblank the display list is fanned out
into the two sprite banks: each four-byte record is split, two bytes into bank 1 and two into
bank 0, starting at the `0x10` offset (`SPRITE0_CLEAR_BASE` `0x9010` `[code]` /
`SPRITE1_CLEAR_BASE` `0x9410` `[code]`, which boot clears). The record group copied depends on
`PLAY_STATE_INDEX` `0x880A` `[seen]`: when it equals 4 the DMA fans four separate display-list
groups (the base `SPRITE_DISPLAY_LIST`, the target slots at `SPRITE_TARGET_SLOTS` `0x887C`
`[seen]`, and two more groups at `0x8850` and `0x8888`); every other value — attract and the
other in-play sub-phases alike — copies a single 24-record group. Screen flip is driven from `FLIP_SCREEN_FLAG` `0x881F` `[seen]`,
which the vblank service copies to the inverted latch bit `0xA187` each frame; in the
renderer a flip is a whole-plane cell mirror composed with each tile's own flip flags.

### The work-RAM state cells

The 2 KB work-RAM block (`0x8800`–`0x8FFF`) carries the entire mutable game state. It is not
laid out as one flat struct but as several functional clusters, and the state model is best
understood cluster by cluster.

**Configuration, decoded once at boot.** The DIP switches are read at power-on, complemented,
and cracked into individual work-RAM cells that the rest of the game treats as constants:
`BONUS_AWARD_DSW` `0x8800` `[code]` (selects the extra-life award schedule),
`DIFFICULTY_DSW` `0x8820` `[code]` (a 3-bit value scaling enemy spawn schedules and threshold
tables), `DEMO_SOUNDS_DSW` `0x8821` `[code]`, `CABINET_MODE_FLAG` `0x880F` `[code]`
(upright vs cocktail), `LIVES_DSW` `0x8807` `[code]` (the starting life count), and the two
coinage nibbles `COINAGE_CONFIG` `0x882C` `[seen]` and `COINAGE_CONFIG_SLOT2` `0x882F`
`[code]`, each of which reads `0x0F` for free play. These cells never change during play; they
are the parameters the dispatch loops read.

**The top-level state selectors.** A handful of index bytes decide which handler runs each
frame, and they are the spine of the whole design. `MAIN_GAME_STATE` `0x8805` `[seen]` is the
outermost selector — attract, intro, and play are its distinct values — dispatched through a
jump table. Underneath it, when the game is in play, `PLAY_STATE_INDEX` `0x880A` `[seen]`
(masked to five bits) selects the in-play sub-phase through a second table, and
`ATTRACT_SUBSTATE` `0x8E51` `[seen]` does the same for the demo sequence.
`MAINLOOP_SUBSTATE_SELECTOR` `0x8F5C` `[code]`, `SELFTEST_DISPATCH_STATE` `0x8921` `[code]`,
and `INTRO_PHASE_INDEX` `0x8F51` `[code]` are further sub-state indices, each dispatched
through its own table and advanced by its own handlers. Alongside the selectors sit the coarse
gates: `GAME_ACTIVE_FLAG` `0x8806` `[seen]` (set at start-of-life, cleared at game-over; the
gameplay handlers return early when it is clear), `ROUND_IN_PROGRESS` `0x8904` `[seen]`, and
`BOARD_CLEAR_FLAG` `0x89E5` `[code]`, which when set freezes the per-frame object update and
diverts handlers onto the board-clear / level-intro path.

**Per-frame timers.** Timing is done with down-counters the handlers drain and reload.
`FRAME_COUNTER` `0x8A5F` `[seen]` free-runs, decremented once every vblank; its low bits phase
animation and its zero-crossings gate integrity checks. `PHASE_TIMER` `0x8808` `[seen]` is a
reloadable countdown state handlers use to time phase transitions, and `WORKER_CONTROL_BYTE`
`0x883F` `[code]` (one byte below the sprite display list) is likewise ticked each NMI and
gates the per-frame worker's signature check and scroll-column blanking.

**The input edge-detect ring.** The three input ports are sampled every vblank, complemented
(the ports are active-low), and written into a short ring beginning at `INPUT_PORT0` `0x8810`
`[seen]`. The ring keeps the current sample and the previous one so the game can detect edges
— a coin insert, a start press — rather than levels; coin is bit 0 of the IN0 sample, 1P-start
bit 3, 2P-start bit 4.

**The live gameplay page and the per-player banks.** A contiguous block from `SPEED_INDEX`
`0x8900` upward is the *live* game page — the state of the round currently being played:
`SPEED_INDEX` `0x8900` `[seen]` (enemy speed/difficulty index), `STAGE_COUNTDOWN` `0x8901`
`[seen]`, `SPAWN_PHASE_COUNTER` `0x8902` `[seen]`, `WAVE_ARRIVAL_COUNTER` `0x8903` `[seen]`,
`ROUND_IN_PROGRESS` `0x8904` `[seen]`, `ROUND_COUNTER` `0x8907` `[seen]`,
`GAUGE_PHASE_COUNTER` `0x8908` `[seen]`, and `AWARD_QUEUE` `0x8909` `[code]`. In a two-player
game this whole page is time-shared: `ACTIVE_PLAYER` `0x880D` `[seen]` selects whose turn it
is and `TWO_PLAYER_FLAG` `0x880E` `[seen]` marks the two-player mode, and on each turn switch
the live page is copied wholesale into that player's saved bank —
`PLAYER0_STATE_BANK` `0x8940` `[seen]` or `PLAYER1_STATE_BANK` `0x8980` `[seen]`, each a
0x3F-byte snapshot swapped against the live `0x8900` page (`saveLiveStateToPlayerBank`
`0x1A47` `[code]`) — so the incoming player's saved state can be restored. Lives and scores
are banked the same way: `PLAYER0_LIVES` `0x8948` `[seen]` / `PLAYER1_LIVES` `0x8988` `[seen]`
seed from the lives DIP and drain per death to gate the player-switch and game-over, while
`P1_SCORE_BCD` `0x88A2` `[seen]` and `P2_SCORE_BCD` `0x88A5` `[seen]` are the two players'
three-byte BCD score buffers, with the running high score at `HIGH_SCORE_BCD` `0x88A8`
`[code]` / `HIGH_SCORE_BCD_HI` `0x88AA` `[seen]` and the sorted ten-entry `HIGH_SCORE_TABLE`
`0x8A00` `[code]`.

**The actor and object record arenas.** The moving entities live in strided record tables.
The primary arena begins at `ACTOR_TABLE` `0x8A80` `[seen]`, a 0x18-byte-stride array zeroed
at board init whose slot 0 is the player/lead actor: `LEAD_ACTOR_STATE` `0x8A82` `[seen]` is
that actor's own state index (driving a six-way dispatch), `PLAYER_Y` `0x8A84` `[seen]` is the
player's vertical position (the sprite Ys are derived from it and enemy AI targets it), and
`PLAYER_AIM_FLAGS` `0x8A87` `[code]` carries the joystick input and the above/on-target/below
aim bits. Parallel strided pools hold the other entity classes:
`ENEMY_ACTOR_TABLE` `0x8AE0` `[seen]`, `SPRITE_OBJECT_TABLE` `0x8B70` `[seen]`,
`PROJECTILE_TABLE` `0x8BE8` `[seen]`, `FORMATION_TABLE` `0x8C30` `[seen]`,
`SPAWN_OBJECT_TABLE` `0x8C48` `[seen]`, the I-parity target pair
`ENEMY_TARGET_REC0` `0x8C90` `[seen]` / `ENEMY_TARGET_REC1` `0x8CA8` `[seen]`, and the hunter
table at `HUNTER_TABLE_BASE` `0x8C78` `[code]`. In each pool a record is "free" when its
active-flag byte is clear, spawns claim the first free slot, and per-frame sweeps walk the
pool running each record's per-state handler.

**The command rings.** Two producer/consumer ring buffers decouple the state handlers from
the render and audio work. The display-command ring — `DISPLAY_CMD_RING_BUFFER` `0x88C0`
`[code]`, 32 two-byte slots on page `0x88`, with write cursor `DISPLAY_CMD_RING_WRITE_PTR`
`0x88A0` `[code]` and read cursor `DISPLAY_CMD_RING_READ_PTR` `0x88A1` `[code]` — is where
handlers enqueue drawing requests that the main loop later dequeues and dispatches; empty
slots read `0xFF`. The sound-command ring — `SOUND_RING_BUFFER` `0x8A43` `[code]` with
`SOUND_RING_WRITE_PTR` `0x8A40` `[code]` / `SOUND_RING_READ_PTR` `0x8A41` `[code]` — buffers
audio commands the vblank service drains one per frame out to `SOUND_COMMAND_LATCH` `0xA100`
`[seen]`.

**The anti-tamper flags.** A scattering of cells exist only to catch a modified ROM. Strike
counters such as `TAMPER_FREEZE_FLAG` `0x881E` `[code]`, `TAMPER_STRIKES_ROM` `0x89EF`
`[code]`, and `TAMPER_STRIKES_SIG` `0x8A38` `[code]` are bumped by checksum guards scattered
through the handlers; a nonzero value freezes spawns, aborts actor updates, and diverts the
frame. On a clean board these are static zero, which is why they carry `[code]` rather than
`[seen]` — no honest play reaches the arm.

**The stack.** The very top of work RAM is the Z80 stack. The stack pointer initialises to
`0x9000` at boot and grows downward through the `STACK_SCRATCH` window (`0x8FC0`–`0x9000`); a
single unbalanced push at boot reserves the top word, so `ROM_SELFTEST_TALLY` `0x8FFF`
`[code]` sits just *above* the live stack and the vblank register-save cannot clobber it.
Because those bytes are transient stack traffic rather than game state, the scratch window is
excluded when the machine's state is compared.

### The per-frame dispatch model

Two engines touch state each frame, and the state cells above are exactly the interface
between them.

The reset vector `loc_0000` `[code]` disables the vblank NMI and tails into the boot entry
`loc_0092` `[code]`, which runs the program self-test and lays down the entire initial state —
clearing the RAM regions, filling both command rings with the `0xFF` empty marker, decoding
the DIP cells, and seeding the pointers — before handing control to the main loop.

The **main loop** (`mainLoop` / `loc_020f` `[code]`) then free-runs: there is no vblank
busy-wait — the loop never polls for the frame, it runs continuously and lets the vblank NMI
interrupt it asynchronously (see below). Each pass it reads the display-command read cursor
`0x88A1` and looks at the slot it points to. If the slot's high bit is set the ring is drained
(an empty slot reads `0xFF`), so the loop runs the per-frame worker `loc_0254` `[code]` — which
repaints the scroll tile columns, or runs the program-signature check when the worker control
byte demands it — and spins straight back to re-read the cursor, busy-running the worker on
every pass until the NMI refills or advances the ring. Otherwise the slot holds a pending
two-byte display command: the loop frees the slot (writing `0xFF` back), advances the read
cursor (wrapping past the end of the ring back to its base), and dispatches the command through
a handler table, looping to drain the next command. The loop drains every pending command in
one continuous run, so a backlog built up during, say, the credit screen is flushed at once
rather than one command at a time.

The **vblank NMI** (`loc_066d`) is the real per-frame heartbeat, and it is gated by the NMI
enable latch bit — the boot sets it, and the service itself masks the latch on entry and
re-arms it on exit. On each interrupt it saves the full register file, copies the sprite
display list out into the two sprite banks (the sprite DMA described above), kicks the
watchdog, samples the three input ports (complemented) into the `0x8810` edge-detect ring,
decrements `WORKER_CONTROL_BYTE` `0x883F` and `FRAME_COUNTER` `0x8A5F`, runs the coinage/credit
step and drains one entry from the sound ring, and then dispatches on `MAIN_GAME_STATE`
`0x8805` through its jump table into the attract handler `loc_072d` `[code]`, the intro and
play handlers, or the no-op `loc_0e53` `[code]`. When the chosen handler returns, the epilogue
copies `FLIP_SCREEN_FLAG` `0x881F` out to the flip-screen latch, restores the registers,
re-arms the NMI, and returns to the interrupted code.

The dispatch is nested, and each layer is keyed off one state cell reading one table of
handler addresses. `MAIN_GAME_STATE` selects the top layer; within play,
`PLAY_STATE_INDEX` `0x880A` selects the sub-phase handler (e.g. the round-init handler
`loc_1601` `[code]` or the field-setup handlers `loc_1b43` / `loc_1b8c` `[code]`); the demo
sequence runs off `ATTRACT_SUBSTATE` `0x8E51`; the level intro runs off `INTRO_PHASE_INDEX`
`0x8F51`; and at the finest grain each record in an actor or object arena carries its own
state byte (`LEAD_ACTOR_STATE` `0x8A82` for the player, the `+2` field of every other record)
that its sweep uses to pick a per-record handler. A frame's work is therefore fully
determined by the current values of these selector cells, and a handler advances the game by
mutating the record tables, enqueuing display and sound commands, and stepping its own
selector to the next state.

## The frame loop and the vblank heartbeat

Pooyan's machine runs two tasks that never see each other's code directly. In the foreground the CPU
spins forever in a main loop, draining a queue of display work and repainting the scrolling backdrop.
Underneath it, about sixty times a second, the video hardware raises an interrupt that suspends the loop,
does the frame's real work — reading the controls, ticking the clocks, advancing the top-level game
state — and then returns the CPU to exactly where the loop was interrupted. The interrupt *is* the
frame boundary; the loop is only what fills the gaps between beats.

### Reset and boot: arming the heartbeat

At power-on the CPU enters loc_0000 [code], the reset vector. Its first and only act before booting is
to hold the vblank interrupt off: it clears NMI_ENABLE_LATCH [code] (the LS259 latch bit that gates the
interrupt) so nothing can fire while the machine has no state to service, then hands straight into the
boot entry loc_0092 [code].

The boot routine is where the whole initial machine comes into being. It sums each of the eight 4K
program banks and compares them against the on-ROM checksum table, banking one pass per intact bank so
that a wholly-clean image lands the tally at twice the bank count — a value the later play-state gate
insists on. It then zeroes work RAM, marks both command queues empty and parks their read and write
cursors at their origins, floods the colour map, arms the row-by-row tile fill, decodes the two
DIP-switch ports (DSW0_PORT [code], DSW1_PORT [code]) into their config cells, clears the sprite banks,
and silences the audio CPU. Right after that it re-enables the interrupt — writing 1 back into
NMI_ENABLE_LATCH [code] — and only then lays down the default high-score table, clears the panel
digit-source cells, and falls into the main loop. That write is the moment the heartbeat starts: from
here on every vblank will be serviced, including one that fires while the last of the boot's own setup
is still running. The reset-time disable therefore leaves no lasting trace; it exists only to keep the
machine quiet through the one stretch when an interrupt would find nothing valid to touch.

### The foreground loop: draining the display-command ring

The main loop is loc_020f (`mainLoop`) [code]. It is not the game's state machine — it is a servicer
for the display-command ring, a 64-slot queue living in page 0x88 (offsets 0xc0..0xff). Each pass reads
the ring's read cursor DISPLAY_CMD_RING_READ_PTR [code] and fetches the slot it points at. An empty
slot is marked 0xff, whose high bit is set; the loop treats a high-bit-set slot as "nothing queued
here" and, in that case, runs the scroll worker loc_0254 — which, when the low nibble of
WORKER_CONTROL_BYTE [code] is nonzero, runs *only* the program-signature check and returns, and
otherwise (low nibble zero, and a game currently active) repaints the scrolling tile columns. The two
are mutually exclusive on any one pass: it either checks the signature or repaints, never both — and
the repaint happens only while a game is live. If instead the slot holds a real command (high bit
clear), the loop reads it as an even index into the handler table at 0x0242, frees the slot back to
0xff, advances the cursor (wrapping back to 0xc0 past the end of the ring), and calls the selected
display-command handler, which returns to the top of the loop when it finishes.

The net behaviour is a producer/consumer drain. The frame's interrupt-side handlers *enqueue* display
commands at the write cursor DISPLAY_CMD_RING_WRITE_PTR [code]; the loop *consumes* them from the read
cursor, one per pass, until it catches up. Once the ring is drained the loop has nothing left to
dispatch, so it busy-spins — re-running the scroll worker on every pass, over and over — until the next
vblank NMI cuts in. It never waits on the beam: there is no vblank poll anywhere in the loop; the
interrupt simply seizes whatever pass happens to be in flight. The whole ring is meant to drain within a
single frame, exactly as the real hardware clears its queued display work each vblank, rather than
dribbling out one command per beat.

### The vblank interrupt: the once-per-frame heartbeat

About 60.6 times a second (the 60.606061 Hz vblank) the video beam reaching the vblank interval pulls
the CPU's non-maskable interrupt line. The CPU suspends the main loop wherever it stands and vectors to
loc_0066, a bare hop into the true service routine loc_066d. This routine is the beat of the whole
machine, and it runs top to bottom every frame.

It opens by saving the entire register file — main set, shadow set, and both index registers — because
it has interrupted arbitrary foreground code and must leave no footprint. It then masks further
interrupts for the duration by clearing NMI_ENABLE_LATCH [code], so the service routine can never
re-enter itself mid-frame. With the machine frozen to it alone, the routine does the frame's fixed
work:

- **Rebuild the scrolling columns.** It repaints the moving tile columns through loc_0714. How
  much it rebuilds depends on the play sub-state PLAY_STATE_INDEX [seen]: when that index is 4 it
  refreshes four separate column groups, and in every other state it refreshes a single tall group.
- **Kick the watchdog.** A write to 0xa000 pats the hardware watchdog, the once-per-frame proof-of-life
  that keeps the board from resetting itself.
- **Sample the controls.** It reads the three input ports — IN0 (coin and start), player-1 controls
  IN1_PORT [code], and player-2 controls IN2_PORT [code] — complements each (the switches are
  active-low) and stores the fresh samples into INPUT_PORT0 [seen] and its two neighbours, the head of
  a small edge-detect ring. Before overwriting them it shifts the previous frame's samples up into the
  ring's shadow cells, so later logic can tell a button just-pressed from one still-held — that is how
  a coin insertion or a start press is caught as a one-frame edge.
- **Tick the clocks.** It decrements two per-frame counters. WORKER_CONTROL_BYTE [code] is the one the
  foreground worker reads to time its periodic signature check; FRAME_COUNTER [seen] is the
  free-running down-counter whose low bits phase the animation and whose zero-crossings gate the
  integrity checks scattered through the game.
- **Service coins and sound.** It runs the coin/credit accounting, then drains one entry from the
  sound-command queue and hands it to the audio CPU.

### The main-state dispatch (selector 0x8805)

With the fixed per-frame chores done, loc_066d reaches its purpose: advancing the game's
top-level mode machine. It reads MAIN_GAME_STATE [seen] — the selector that names which broad phase the
machine is in — and jumps through the five-entry pointer table at 0x06f0 (via the rst-0x28 dispatch
trampoline loc_0028). Selector 0 runs the attract handler loc_072d [code]; the middle selectors step
through the intro and in-play handlers at loc_0899, loc_0c4e, and loc_159b as the machine works its way
from attract into a live round (MAIN_GAME_STATE [seen] cycles 0/1/3 in attract and climbs 0→1→2→3 in
gameplay); and selector 4 lands on loc_0e53 [code], which returns without drawing. The chosen handler
runs to completion and returns into the service routine's own epilogue.

Because this dispatch lives inside the interrupt, the game's mode logic — attract, intro, play —
advances exactly once per frame, driven by the beat rather than by the foreground loop. The main loop
never touches MAIN_GAME_STATE; its job is purely to service the display and scroll work that these
state handlers queue up.

The epilogue closes the beat. It copies the orientation flag FLIP_SCREEN_FLAG [seen] into the hardware
flip-screen latch FLIP_SCREEN_LATCH [code] (so a change of screen orientation takes effect at the frame
boundary), restores every saved register, writes 1 back into NMI_ENABLE_LATCH [code] to re-arm the
interrupt for the next vblank, and returns to the precise instruction in the main loop that the beat
interrupted. The loop resumes draining its ring, the game's mode machine having quietly stepped one
frame forward beneath it, and the machine waits for the next beat.

## Configuration, coinage and players

Pooyan is a coin-op: before it will play it reads the operator's DIP switches, tallies coins into
credits, and only spends a credit when a player presses Start. This section follows that path from
power-on through the two independent player games a single cabinet can host, and closes on how the
machine knows which way it is bolted to the floor.

### Cabinet orientation

The cabinet is **vertical, mounted ROT90** (the manifest fixes `screen.rot = 90`, orientation
`vertical`) — the monitor is turned a quarter-turn so the tall play well runs up the screen. That is a
fixed property of the hardware; what the software controls is the *flip*. Two cells carry orientation
state. `CABINET_MODE_FLAG` [code] is the static upright-vs-cocktail choice decoded once at boot from the
operator switches. `FLIP_SCREEN_FLAG` [seen] is the live per-frame orientation: the vblank service
copies it into the video hardware's flip latch every frame (its bit 7), and the mirror pass that
vertically flips the picture runs only when it is clear. Boot seeds it to 1 (normal/upright, observed
0→1 immediately after reset). In a two-player *cocktail* game — `CABINET_MODE_FLAG` clear — the
round-init handler `loc_1601` [code] writes `(ACTIVE_PLAYER − 1) & 0xff` into `FLIP_SCREEN_FLAG` on the
first entry of a two-player round (0xff when player 1 is up, 0 when player 2 is up), so the screen flips
to face whichever player is now up.

### Power-on configuration — reading the DIP switches

Everything configurable is latched once, at power-on, by the boot routine `loc_0092` [code]. There are
two switch banks on two hardware ports: `DSW1_PORT` [code] and `DSW0_PORT` [code]. The configuration
bank `DSW1_PORT` reads active-low (a closed switch reads 0), so the boot complements it before decoding
its fields; the coinage bank `DSW0_PORT` is read uncomplemented, each of its two nibbles indexed straight
into the ROM coinage table.

**Bank 1 (`DSW1_PORT`)** is unpacked field by field into work-RAM config cells. Reading the
complemented byte from the low bits up: switches 0–1 choose the starting life count, which the boot
folds into `LIVES_DSW` [code] — the three encodings map to 3, 4 and 5 lives, and the fourth encoding to
a sentinel large value (a free-lives setting). Bit 2 becomes `CABINET_MODE_FLAG` [code] (upright vs
cocktail). Bit 3 becomes `BONUS_AWARD_DSW` [code], which later picks the extra-life / bonus award
schedule (the reload count and BCD step of the award queue). Bits 4–6 become the 3-bit
`DIFFICULTY_DSW` [code], which scales enemy spawn schedules and threshold tables throughout play. Bit 7
becomes `DEMO_SOUNDS_DSW` [code], enabling sound during attract/demo. Because both grounding goldens ran
at the default switch settings, these fields sat at their static defaults and are understood from the
decode code rather than observed changing — hence [code].

**Bank 0 (`DSW0_PORT`)** holds coinage, in the standard Konami two-nibble form. The boot runs each
nibble through the ROM coinage lookup table `COINAGE_TABLE` [code]: the low nibble yields the
coin-slot-1 config `COINAGE_CONFIG` [seen] and the high nibble the coin-slot-2 config
`COINAGE_CONFIG_SLOT2` [code]. A resulting value of `0x0f` in either slot is the **free-play**
sentinel. (Boot was observed seeding `COINAGE_CONFIG` from the table, hence [seen].)

With the switches decoded, the boot finishes bringing the machine up — it self-tests the program ROM,
clears work RAM, empties the command rings, lays down the default high-score table, and enables the
vblank interrupt — then hands off to the running game.

### Accepting coins and awarding credits

Coins are read as ordinary inputs. Each frame the vblank service `loc_066d` samples the three hardware
input ports, complements them (so a pressed contact reads 1), and stores them into the input mirror; the
coin and start contacts live in the IN0 mirror `INPUT_PORT0` [seen], where **coin slot 1 is bit 0, coin
slot 2 is bit 1, the service switch is bit 2, 1-player Start is bit 3 and 2-player Start is bit 4**.

The credit accounting runs off that mirror once per frame, through `loc_59e8`. Its very first act is the
free-play gate: if either coinage config reads the `0x0f` free-play sentinel it returns immediately and
no coin/credit bookkeeping happens at all. Otherwise it runs one acceptance step per coin source. Each
step (`loc_5a56` for slot 1, `loc_5a1f` for slot 2, `loc_5a06` for the service switch) isolates its bit
from `INPUT_PORT0` and shifts it through a small per-source shift register, firing only on a clean
leading edge — this debounces the switch so one physical coin counts once, not once per frame it is
held. On that edge the coinage steps add the coin into a per-slot accumulator and, when the accumulator
crosses the threshold packed in the slot's coinage config, award the config's credit count into the
shared credit counter `CREDIT_COUNT` [seen]; the service switch takes the simpler path and adds one
credit directly [code]. Every award funnels through a common tail that adds to `CREDIT_COUNT` and
**clamps it at 0x63 (99)** [seen], then queues a credit-panel display-refresh command (0x0701) onto the
display-command ring. The coin-accept sound (command 0x0b) is emitted separately, by `loc_0f09` on each
accepted-coin edge ahead of the award, not from that shared tail. At the default one-coin-one-credit
coinage an accepted coin was observed taking `CREDIT_COUNT` from 0 to 1 [seen]; other coinage settings
scale the award through the accumulator-vs-threshold arithmetic [code].

### The coin counter

Accepting a slot-1 coin also queues a pulse on the mechanical coin counter. The acceptance step bumps
`COIN1_PULSE_COUNT` [code] once per accepted coin; a separate per-frame generator `loc_5a9c` [code]
turns each queued pulse into a timed strobe on the hardware counter output `COIN1_COUNTER_LATCH` [code].
With a pulse queued and its phase idle, the generator seeds the phase timer (0x30) and raises the latch;
it then counts the phase down, drops the latch at the mid-point (0x18) via `COIN1_PULSE_PHASE` [code],
and retires one queued pulse when the phase reaches zero — one clean high-then-low pulse of the physical
counter per coin.

### Showing the credit total

The credit total is drawn on the HUD by `loc_05ee` [code]. It reads `CREDIT_COUNT`, clamps the display
to 99, converts it to packed BCD, and writes two digit tiles: the units digit always goes to
`CREDIT_HUD_UNITS_VRAM` [code], and the tens digit to `CREDIT_HUD_TENS_VRAM` [code] only when it is
non-zero (so single-digit totals show without a leading zero). In free play there is nothing to count;
instead the display setup `loc_0e54` [code] queues the primary panel command and, when `COINAGE_CONFIG`
holds the free-play sentinel, an extra command that puts up the free-play indicator in place of the
credit count. (`loc_05ee` also hides an anti-tamper checksum tripwire behind the credit draw, summing a
fixed program block whenever the units digit is exactly 2 and bumping a strike counter on a mismatch —
incidental to the display but part of the same routine.)

### Starting a game

A game only starts from the credit screen — the top-level state the machine sits in with credits
available. There the per-frame handler `loc_0c4e` runs the start-button logic `loc_0d78`, which reads
the Start contacts straight out of `INPUT_PORT0`. **1-player Start (bit 3)** is handled first: if
`CREDIT_COUNT` is non-zero it decrements it by one credit and begins a one-player game; with no credit
it merely nudges the attract state instead of starting. **2-player Start (bit 4)** requires at least
two credits — it subtracts two credits and begins a two-player game (a too-small balance just returns).
Both consumption paths are grounded on `CREDIT_COUNT` [seen] (a 1-player start was observed taking the
counter back to 0).

Starting a game seeds the two banks that distinguish the modes. `ACTIVE_PLAYER` [seen] is loaded to 0
(player 1 up) and `TWO_PLAYER_FLAG` [seen] to 0 for a one-player game or 1 for a two-player game — the
1P path seats these to (0, 0) and the 2P path to (0, 1). The start-of-life setup `loc_0dab` then raises
the in-play gate `GAME_ACTIVE_FLAG` [seen] (set at start, cleared at game-over, and consulted by the
gameplay handlers so nothing runs while idle), enqueues the start-of-life display commands (0x0604 and
0x0400) onto the display-command ring, and calls the new-board reset `loc_0e00` [code]. That reset
clears the live actor page and then **seeds both players' banks from the
switches**: each player's life count is loaded from `LIVES_DSW`, each is given the fixed opening
position, and each gets the sprite colour drawn from `DIFFICULTY_DSW`. So a fresh two-player game arms
two independent player states from the same operator configuration.

### Per-player banks, scores and alternation

Two players share one CPU by time-slicing the same live state. Only one player is "up" at a time; that
player's actors, timers and lives live in a single live state page (base `SPEED_INDEX`). Each player
also owns a saved bank the size of that page — `PLAYER0_STATE_BANK` [seen] and `PLAYER1_STATE_BANK`
[seen] — with the remaining-lives count sitting at a fixed offset inside it: `PLAYER0_LIVES` [seen] and
`PLAYER1_LIVES` [seen], both seeded from the `LIVES_DSW` count at game start. Player 1's counter was
observed draining cleanly 3→2→1→0 per death; player 2's is grounded [seen] as a lives counter seeded from
the same DSW and cycling on the parallel reset pattern, without a clean per-death drain captured. Scores
are banked the same way: `P1_SCORE_BCD` [seen] and `P2_SCORE_BCD` [seen] are
the two 3-byte BCD score buffers, and the active one is chosen by `selectActivePlayerScoreBuffer` [code]
off bit 0 of `ACTIVE_PLAYER`; the score accumulator `loc_0496` [code] adds into the selected buffer and
keeps the top score (`HIGH_SCORE_BCD_HI` [seen]) in step.

`ACTIVE_PLAYER` [seen] is the selector that ties it all together — even means player 1's banks, odd
means player 2's. When a turn ends the live page is copied out into the up-player's saved bank
(`saveLiveStateToPlayerBank` [code], or `saveLivePageToPlayer0Bank` [code] which also latches the
active-player flag when a two-player game's player 1 is still alive), and when the next turn begins the
round-init handler `loc_1601` [code] copies the incoming player's saved bank back into the live page. In
a two-player game the selector was observed toggling between the players exactly on the swaps — flipping
to player 2 when player 1 dies and back when player 2 dies — so play strictly alternates between the two
banked games until both are exhausted. In the one-player golden the flag held constant (a positive
control). A game-over with credits still in the box is not necessarily final: the continue handler
`loc_7fd6` re-enters the same start path (consuming a credit and re-seeding a life) when a Start button
is pressed while a credit remains, letting a player buy back in.

At the end of the line, when both players' lives reach zero, the finishing score is folded into the
sorted high-score table (`loc_1a96` / `loc_1ab2` [code]) and the machine returns to attract — ready to
count the next coin.

## In-play progression and timers

Once a coin has bought a game, the top-level NMI selector `MAIN_GAME_STATE` [seen] settles on its
play value and every subsequent frame routes through the play super-state. That super-state does two
things in order, and the ordering matters: it first ages the active player's wall-clock play timer,
and only then hands off to the in-play sub-state machine that actually advances the round. Everything
below hangs off those two steps.

### The play super-state and the sub-state table

The play super-state begins by ticking the active player's BCD play timer (`loc_7912`, [code]), then
loads the return address its selected sub-handler will hand control back to and falls into the
sub-state dispatcher `loc_15a1`. The dispatcher reads `PLAY_STATE_INDEX` [seen], masks it to five bits,
and jumps through a word table of handler addresses. When a handler returns, control comes back to the
super-state's own continuation past the table — the dispatch is a detour, not a dead end — and that
continuation returns up to the NMI epilogue. So one frame in the play super-state is: age the timer,
run exactly one sub-state handler, resume.

`PLAY_STATE_INDEX` [seen] is the whole engine of in-play progression. It is a small integer the
handlers rewrite to steer themselves through round setup, live play, life loss, player alternation,
and the bonus stage; the sub-state does not free-run but is explicitly stepped by each handler to name
its successor. Masked to `& 0x1f`, it selects one of nineteen handlers:

- **0 — round init** (`loc_1601`, [code]). Blanks a tilemap row and returns until the fill drains;
  once drained it re-arms the fill, clears the actor arena and a block of round-init cells, and — on
  the first entry of a two-player round — raises a once-per-round latch, enqueues a player-select
  display command, and floods the colour/attribute map. Its shared tail seeds `PHASE_TIMER` [seen]
  (0x02 for a one-player round, 0x80 on a round's first entry), advances `PLAY_STATE_INDEX` to the
  next handler, and *restores the active player's saved state bank into the live page* (see banks
  below). It then derives `ROPE_SEGMENT_COUNT` [seen] from `WAVE_ARRIVAL_COUNTER` [seen] (arrival
  count minus two) and copies the round message table into the display buffer.
- **1 — phase-timer wait + field layout select** (`loc_16b7`). Decrements `PHASE_TIMER` [seen] every
  frame and returns while it is still running; when it expires it re-arms the per-phase setup and
  walks a decision tree keyed on `PLAY_MODE_LATCH` [code], `ROUND_IN_PROGRESS` [seen],
  `GAME_ACTIVE_FLAG` [seen] and `ROUND_COUNTER` [seen] to pick a (graphic, layout) pointer pair for
  the field. It publishes the chosen pointers, then either forces the sub-state to the attract-side
  handler (index 16) when the play-mode latch is odd, or advances `PLAY_STATE_INDEX` one step to
  index 2 for normal play.
- **2 — cadence one-shot + level-start batch** (`loc_175d`). Advances a mod-0x1c frame counter and,
  on its wrap, toggles a one-shot; past those guards it branches on the same
  `PLAY_MODE_LATCH`/`ROUND_IN_PROGRESS`/`GAME_ACTIVE_FLAG`/`ROUND_COUNTER` cluster. It either arms
  sub-state 0x0d, or — the live-play case — sets `ROUND_IN_PROGRESS` [seen] to 1 and
  `WAVE_ARRIVAL_COUNTER` [seen] to 2, runs the level-start batch, and forces the sub-state back to 3.
- **3 — enemy-wave setup and spawn** (`loc_17c1`). Seeds a run of actor records from a ROM table
  selected by `PLAY_MODE_LATCH`/`ROUND_COUNTER`, seats the shared animation-script cursor, and steps
  the animators. It then splits on `PLAY_MODE_LATCH`: the zero branch either arms sub-state 0x12 (the
  bonus stage) or advances one step and copies a terminated ROM string into the message buffer, while
  the nonzero branch fans out a sprite group whose size comes from `ROUND_COUNTER` (bit 1 gates the
  fan-out) and finally lands the sub-state on 0x0f.
- **4 and 5 — the per-frame gameplay coordinators** (`loc_18af`, `loc_19ee`). These are the "live
  play" ticks. `loc_18af` runs a fixed sequence of fourteen sub-drivers each frame — among them player
  and enemy movement, collision, a sprite-list rebuild, the round-progression driver `loc_191c` [code]
  (choose the enemy speed/column for a new target group and commit it to `SPEED_INDEX` [seen]), and the
  periodic siren/event-countdown driver `loc_196e` [code] — then returns without touching
  `PLAY_STATE_INDEX`, so the machine simply re-enters the same handler next frame.
  `loc_19ee` is the shorter six-call coordinator used for the alternate live-play mode.
- **6 — phase-counter bump / latch arm** (`loc_1a01`). Runs the board/HUD reset (`loc_2527` [code]),
  reseeds `SPAWN_PHASE_COUNTER` [seen] and the rope-draw snapshot, seats a sprite attribute chosen by
  `ROUND_COUNTER`, and bumps `ROUND_COUNTER` [seen]. On the even-frame path, with the game still
  active, it either arms `PLAY_MODE_LATCH` (to 1, alongside seeding the launch-script pointer) or
  clears a pointer block; every in-play exit falls through into the bank-save helper (a closed credit
  gate instead tails to `loc_1d3c`).
- **7 — the lives/phase-gauge countdown** (`loc_1a64`; its tail is the named `loc_1a85` [code] and its
  overflow the named `loc_1a96` [code]). This is the life-loss junction and is described in its own
  subsection below.
- **8 and 9 — game-over / round-close handlers** (`loc_1b43` [code], `loc_1b8c` [code]). Each ticks a
  tilemap-clear pass and returns while it drains; once drained they flood the attribute columns,
  enqueue two display commands, run the shared integrity/timer handler, and latch the sub-state to
  0x0c with a fresh `PHASE_TIMER` reload of 0x60. `loc_1b43` additionally folds a program-memory block
  into a rolling checksum and copies a biased ROM string into the message buffer.
- **10 and 11 — player alternation / bank save** (`saveLivePageToPlayer0Bank` [code] at index 10,
  `loc_1bcc` [code] at index 11). These snapshot the live page into a player's bank and switch the
  active player; detailed under *Per-player state banks*.
- **13 — the parity-split object driver** (`loc_1c53`). Selects one of two object drivers by
  `ROUND_COUNTER` bit 0 — so it alternates per stage, not per frame — then rebuilds the sprite list.
- **18 — the bonus/eagle-stage dispatcher** (`loc_71b9`). A nested phase machine of its own: it reads
  its phase selector and dispatches through a three-entry table, with the shared render epilogue as
  the handler's return.

Indices 12, 14, 15, 16 and 17 (handlers at 0x1c03, 0x1c66, 0x1d9c, 0x1d6e and 0x6bb2) are reached by
the transitions above but are not yet decompiled; index 16 (0x1d6e) is known to be the writer that
sets `PLAY_MODE_LATCH` [code] to 2.

### Phase timing

Two independent countdowns pace the machine. `PHASE_TIMER` [seen] is a per-frame down-counter that the
setup handlers reload (0x02, 0x60, or 0x80 depending on entry) and index 1 drains one tick per frame,
holding the machine in field-setup until it reaches zero — this is what spaces the visible round-start
sequence out over real frames rather than snapping through it in one. The BCD play timers (next
subsection) are the other clock, measuring elapsed play time for the high-score side-tables rather
than gating state transitions.

### Lives, the phase gauge, and player alternation

Sub-state 7 (`loc_1a64`) is where a life is spent. Each pass it decrements the offset-+8 slot of the
live state page — `GAUGE_PHASE_COUNTER` [seen] — and branches on the result. While that slot stays
positive it repaints the vertical HUD gauge (`renderPhaseGauge` [code]) and seeds `PLAY_STATE_INDEX`
to 0x0a for player one or 0x0b for player two, routing into the bank-save / alternation handlers. When
the slot reaches zero it hands off to the phase-exhausted routine `loc_1a96` [code], which queues the
exhausted-phase tile run, steps `PLAY_STATE_INDEX` onward (to index 8 for player one, 9 for player
two), clears `HIGH_SCORE_INSERT_RANK` [code], `ROPE_SEGMENT_COUNT` [seen] and `MARKER_LAYOUT_PTR`
[code], and tail-hands into the high-score insert-sort `loc_1ab2` [code].

That same offset-+8 slot is what the per-player banks preserve as each player's remaining lives:
because the bank copy moves the whole 0x3f-byte live page, the live gauge cell at `GAUGE_PHASE_COUNTER`
maps directly onto the banked `PLAYER0_LIVES` [seen] and `PLAYER1_LIVES` [seen] — the same slot seen
live versus saved. It is seeded from the lives DSW at round start and drives the switch between the
game-over path and the continue path.

### Per-player state banks

All live actor and progression state sits in one 0x3f-byte page based at `SPEED_INDEX` [seen] (0x8900
is both the enemy-speed index and byte 0 of the live page). A two-player game keeps each contestant's
copy of that page in a saved bank — `PLAYER0_STATE_BANK` [seen] and `PLAYER1_STATE_BANK` [seen] — and
`ACTIVE_PLAYER` [seen] selects which is live. Three routines move the page:

- On a life loss with lives remaining, sub-state 7 routes to `saveLivePageToPlayer0Bank` [code] (index
  10) or `loc_1bcc` [code] (index 11). Index 10 copies the live page into player 0's bank and, in a
  two-player game whose player two is still alive (`PLAYER1_LIVES` nonzero), latches `ACTIVE_PLAYER`
  [seen] to 1; index 11 copies the live page into player 1's bank and switches to the other player
  (`ACTIVE_PLAYER` = 0) when that player is still alive.
  Both clear `PLAY_STATE_INDEX` back to 0, restarting the round-init sequence for the newly active
  player, and index 11 additionally folds a fixed program block into a signature checksum, bumping a
  tamper counter on a sentinel miss.
- The shared helper `saveLiveStateToPlayerBank` [code] performs the same 0x3f-byte copy into whichever
  bank `ACTIVE_PLAYER` names, used where a handler needs to checkpoint mid-flow.
- Round init (`loc_1601`) restores the *incoming* player's bank back into the live page, so switching
  players is symmetric: save the departing player's page out, restore the arriving player's page in.

`TWO_PLAYER_FLAG` [seen] gates this whole alternation — in a one-player game the banks are never made
live and `ACTIVE_PLAYER` stays fixed.

### The BCD play timers

Each player accumulates elapsed play time in a three-byte BCD bank — `PLAY_TIMER_BCD_P1` [code] and
`PLAY_TIMER_BCD_P2` [code] — that the play super-state ages once per frame through `loc_7912` [code].
The tick first bails when `GAME_ACTIVE_FLAG` [seen] is clear (no timer runs outside live play), then
selects the active player's timer and its gate — `PLAY_TIMER_GATE_P1` [code] / `PLAY_TIMER_GATE_P2`
[code] — off `ACTIVE_PLAYER` [seen] and bails again when that gate is set, so a paused or
between-lives player's clock is frozen. The bank's base byte is a frame sub-counter that rolls at 0x3b
or 0x3c frames (the extra frame chosen by bit 0 of the seconds digit, giving a ~60-frame second); on
each roll it BCD-carries the seconds digit, and a full 60 seconds carries into the minutes digit — the
seconds digit rolls its low nibble at 0x0a and its high nibble at 0x60, while the minutes digit carries
only its low nibble at 0x0a (no high-nibble rollover). These timers feed the play-time side-table
maintained alongside the high-score insert-sort, not the state machine.

### Round and stage progression cells

The 0x8900 page carries the counters that escalate difficulty and shape each wave, all block-swapped
with the banks above:

- `SPEED_INDEX` [seen] — the enemy speed/difficulty index, clamped and used to look up velocity
  magnitudes; escalates with the round and is committed by `loc_191c` [code] for each new target
  group.
- `STAGE_COUNTDOWN` [seen] — a per-stage down-counter from 0x20 whose initial value selects the stage
  label and which, near zero, gates the actor AI.
- `SPAWN_PHASE_COUNTER` [seen] — a per-round step counter cycling to 7, selecting spawn/fire mode
  branches and snapshotted into the rope-draw count.
- `WAVE_ARRIVAL_COUNTER` [seen] — bumped on each enemy arrival (capped), it bounds the rope-segment
  count (`ROPE_SEGMENT_COUNT` [seen] is held at arrival-minus-two) and its parity picks a spawn
  variant.
- `ROUND_IN_PROGRESS` [seen] — the 0/1 flag raised at level start and cleared at stage/life
  transitions, keying the render and state decision trees.
- `ROUND_COUNTER` [seen] — the round number, BCD-rendered as the HUD round display; its bit 0 selects
  the stage-type/facing variant, bit 1 gates the target-group fan-out, and its low bits index the
  per-round difficulty tables. It advances on each stage transition.

Together these cells are the "where am I in the game" record: `ROUND_COUNTER` counts completed rounds,
`STAGE_COUNTDOWN` and `WAVE_ARRIVAL_COUNTER` pace the current stage, `SPEED_INDEX` turns that progress
into escalating enemy speed, and `GAUGE_PHASE_COUNTER` (banked as the per-player lives) counts how many
attempts remain — with `PLAY_STATE_INDEX` sequencing the machine through setup, play, loss and
alternation across it all.

## The actor arena

Everything that moves on screen during play — the lead player actor, the diving enemies, the
projectiles they and the player throw, and the objects that descend the playfield — lives in a single
block of fixed-size records that the game sweeps once per frame. The arena begins at ACTOR_TABLE [seen]
(slot 0 is the player/lead actor) and is a densely-packed array of 0x18-byte records: the enemy
sub-array starts a short way in at ENEMY_ACTOR_TABLE [seen] (0x60 bytes past the base), a parallel run
of object-state records begins at OBJECT_STATE_RECORD_BASE [code] and spills into the projectile
records at PROJECTILE_TABLE [seen], and a second lead slot sits at ACTOR_TABLE_SLOT1 [code]. Because
the stride is uniform, every driver walks its slice of the arena the same way — start at a base, run a
fixed count, add 0x18 each time — and every routine that touches a record reads and writes the same
handful of byte offsets.

### The record shape

A record is a small state machine packed into 0x18 bytes. The first two bytes carry the
active/presence markers: a record is live when bit 0 of (rec+0x00) OR (rec+0x01) is set, and the
dispatchers skip any record where both are clear. rec+0x02 is the state byte that selects which
per-frame handler runs. The motion fields are a 16-bit vertical position at rec+0x05:rec+0x06 (high
byte in +0x06), an optional link pointer at rec+0x07:rec+0x08 to a paired record whose position is
moved in lockstep, a per-frame step/speed at rec+0x09, and a signed facing delta at rec+0x0a. The
animation fields are a 16-bit sequence pointer at rec+0x0c:rec+0x0d, a frame-hold countdown at
rec+0x0e, the current attribute byte at rec+0x0f, and the current tile at rec+0x10. A few records also
use rec+0x0b (a per-record animate-enable bit), rec+0x12 (an animation-hold timer, or the 0xff marker
a freshly-initialised record carries), rec+0x13 (a 2-bit phase count), and rec+0x16 (an armed flag and,
for object records, a state byte). Different actor families reuse the tail bytes for their own
purposes, but the active-flag/state/position/animation core is common to all of them, which is why one
set of stepping and animation routines serves the whole arena.

### The per-frame sweep and state dispatch

Two independent dispatchers walk the arena each frame, one over the object-state records and one over
the enemy records, and both share the same pattern: for each active record, the low bits of its state
byte pick one of a small fixed set of handlers, and the chosen handler runs to completion before the
sweep steps to the next record.

The object-state sweep, loc_76f4, runs over six records at OBJECT_STATE_RECORD_BASE [code], stride 0x18.
For each record it calls dispatchActiveObjectState [code], which first tests the active markers — if bit
0 of (rec+0x00) OR (rec+0x01) is clear the record is dormant and nothing runs — and otherwise takes the
low two bits of the state byte (rec+0x02) to select one of four per-state handlers. The selection is a
straight four-way branch on the state value, so an object walks through its lifecycle simply by having
its state byte incremented; the next frame's sweep routes it to the next handler.

The enemy records are driven by loc_6a7f [code], which walks eighteen records from
ENEMY_ACTOR_TABLE [seen] whenever the blink-phase byte BLINK_PHASE [code] is set. For each it calls
loc_6a98 [code], the enemy state dispatcher: an inactive record (its +0x01 byte zero) is skipped, and
otherwise (state - 1) & 3 selects between two handlers — index 0 steps a descending object via
loc_6aa8 [code], index 1 runs the screen re-init / integrity path loc_67df [code]. When the blink phase
is clear and the wave index WAVE_NUMBER [code] is exactly 2, loc_6a7f [code] instead performs a
one-shot integrity checksum of the playfield tilemap: guarded by the TILE_SUM_ONCE_LATCH [code]
run-once latch, it sums bytes across the playfield tilemap starting 0x50 past VIDEO_RAM_BASE [code]
(at 0x8450, skipping one column per row) into a 16-bit accumulator and compares the result against a
fixed expected value; a mismatch is only reachable once work RAM has been corrupted, so the check
throws rather than continuing.

A companion sweep, loc_69ad [code], walks the enemy table and the object-state base in lockstep,
stepping each pointer one 0x18 stride per record, and drives each (enemy, object) pair through
loc_69c6 [code] — the paired motion step that lowers both linked 16-bit positions together and retires
the pair when the enemy's position high byte crosses zero. These sweeps are sequenced together each
frame by loc_68f8 [code], which runs four sub-passes in a fixed order: the delay-gated spawn sweep loc_6905 [code], the paired descending-object
stepper loc_69ad [code], the enemy-spawn sweep driver loc_6a0f [code], and the enemy record driver
loc_6a7f [code] with its integrity check.

### Actor animation stepping

An actor's on-screen appearance is driven by a compact bytecode animation stream, and two mechanisms
sit behind it: arming a record with a sequence, and advancing that sequence frame by frame.

Arming is done by setActorAnimation [code] (and its sibling storeActorAnimationPointer [code]): both
write a 16-bit sequence pointer little-endian into rec+0x0c:rec+0x0d and reset the frame-index /
hold byte at rec+0x0e to zero, so the actor restarts its new sequence from step 0. Spawns and
state transitions call these to point a record at a ROM animation block.

Advancing is done by loc_4006 [code] and the identical advanceActorAnimFrame [code] (the former reads
the record from IX, the latter from IY, otherwise byte-for-byte the same stepping logic). rec+0x0e is a
frame-hold countdown: while it is non-zero the routine just decrements it and returns, so the current
frame is held for that many ticks. When the hold expires it walks the sequence stream addressed by
rec+0x0c:rec+0x0d — a 0xff opcode reloads the stream pointer from the next two stream bytes and
re-reads (letting a sequence jump or loop), and any other byte begins a three-byte frame record: the
first byte becomes the new tile at rec+0x10, the second the attribute at rec+0x0f, and the third the
new hold value at rec+0x0e; the advanced pointer is then written back to rec+0x0c:rec+0x0d for next
time. This is what makes the animation "play": each hold-expiry consumes one frame record and reloads
the hold.

A separate, coarser animation clock is tickActorAnimHold [code], which counts a record's hold timer
(rec+0x12) down. It only proceeds when the per-record animate bit (rec+0x0b bit 0) is set, or otherwise
only on even rounds (ROUND_COUNTER [seen] bit 0 clear), and only for an active, armed record
(rec+0x00 bit 0 set and rec+0x16 bit 1 set). On underflow it steps the 2-bit phase at rec+0x13 down and
re-arms rec+0x16 for the next step, disarming (rec+0x16 := 0) once the phase is exhausted.

A per-frame walk drives this tick across the enemy-actor records. Each frame `loc_7627` [code] steps a
count of records from `ENEMY_ACTOR_TABLE` [seen] (stride 0x18) and ticks each entry by the low two bits
of its state byte: one state advances the animation a frame, one holds the entry while
`OBJECT_DRAWN_FLAG` (0x8d58) [code] is set — the flag an object raises once it has been drawn — and one
performs a phase-transition reseed that clears `SPAWN_RING_COUNTER` (0x8d57) [code], the per-object arm
counter the object cluster increments as it seats each spawn. A reseed aborts the rest of the walk for
that frame, so at most one entry reseeds per pass. The twin entry `loc_7625` [code] runs the same walk
over the eight-record count.

### Spawning into the arena

New enemies enter the arena through two delay-gated sweep drivers, and both share a distinctive shape:
a countdown must expire before anything can spawn, then the driver walks its record slice and spawns
into the first empty slot it finds, spawning at most one actor per call by aborting the sweep the moment
it fills a slot.

loc_6905 [code] is the delay-gated spawn sweep for paired enemy/state records. While the shared frame
timer SHARED_FRAME_DELAY_TIMER [code] is running it just decrements it and returns. Once the timer is
clear it declines to spawn if the wave has already fully arrived (WAVE_NUMBER [code] has caught up to
the per-stage arrival count WAVE_ARRIVAL_COUNTER [seen]) or the wave index has reached its limit of 8;
otherwise it walks eight enemy/state record pairs from ENEMY_ACTOR_TABLE [seen] and
OBJECT_STATE_RECORD_BASE [code] in lockstep. Each pair is handed to loc_6931: an already-active
pair (bit 0 of the first two enemy bytes set) is left untouched and the sweep moves on to the next
pair, while the first empty pair is spawned — both records activated (byte0 := 1), their position,
speed, and facing fields seeded to fixed opening constants, the actor pointed at the animation block ANIM_TABLE_3838
[code] via setActorAnimation [code], and the shared delay timer reseeded to 0x10 as the respawn
spacing. On the very first spawn of a wave (WAVE_NUMBER [code] still zero) loc_6931 also queues
two wave-entry display commands WAVE_SPAWN_DISPLAY_CMD_A [code] and WAVE_SPAWN_DISPLAY_CMD_B [code] and
paints the arrival count to the HUD as two BCD digits at WAVE_COUNT_HUD_HI [code] (high digit) and the
column below it (low digit), converting the binary arrival count to packed BCD by counting
decimal-adjusted increments. It then bumps WAVE_NUMBER [code], and after this spawn the sweep aborts
so only one pair enters per call.

loc_6a0f [code] is the second spawn driver, over eighteen single enemy records. It stays idle while the
blink phase BLINK_PHASE [code] is clear, while the animation phase toggle ANIM_PHASE_TOGGLE_892C [code]
has reached its gate value of 6, or while the spawn-delay countdown BLINK_COUNTDOWN [code] is still
running (each such tick just decrements the countdown). Once the countdown reaches zero it sweeps from
ENEMY_ACTOR_TABLE [seen] and hands each record to loc_6a35, which — like loc_6931 —
leaves an already-active record alone and spawns into the first empty one, aborting the sweep on that
spawn. loc_6a35 activates and seeds the record, arms BLINK_COUNTDOWN [code] to 0x10, then reads
and bumps the phase toggle ANIM_PHASE_TOGGLE_892C [code] and picks a spawn animation by the pre-bump
phase: phase 0 or 1 take the early pointer ANIM_PARAM_76D4 [code] (phase 1 also re-arming the countdown
to 0x1c), phase 2 takes the mid pointer ANIM_PARAM_68EF [code], and any higher phase takes the late
pointer ANIM_PARAM_6B0A [code]. The chosen pointer is installed with setActorAnimation [code], so the
phase toggle cycles a spawning enemy through its variant entrance animations.

Several leaf routines do the low-level record seeding these spawns and other setup paths rely on.
initActorRecord [code] stamps the fixed opening state into a fresh record — the active/state constants
at rec+0x00..+0x02, the 0xff marker at rec+0x12, and a 16-bit datum at rec+0x16:+0x17 — and hands back
the advanced pointer so a scan loop can chain the next record. seedObjectRecord [code] fills a record
from two source streams: a two-byte descriptor (into rec+0x06 and rec+0x04) and a two-byte little-endian
coordinate (into rec+0x0c:+0x0d), then clears the timer at rec+0x0e, advancing both source pointers by
two for the caller's build loop. stampObjectAndDecCounter [code] reads a control byte, decrements a
shared one-byte counter in place (its zero result is the caller's loop terminator), and stamps two fixed
state bytes (0x01 at rec+0x13, 0xc1 at rec+0x16) into an object record.

### Motion, collision, and rendering

Once spawned, objects fall and enemies move through the per-frame handlers the state dispatch selects.
loc_67a0 [code] is the gated per-object frame update: while the shared delay timer
SHARED_FRAME_DELAY_TIMER [code] runs it decrements and returns, and on expiry it steps the animation
via loc_4006 [code], then lowers the object's 16-bit position (and, when rec+0x07:+0x08 links a partner,
that partner's position too) by the per-object speed at rec+0x09; when the position high byte reaches
zero it advances the state byte at rec+0x02, moving the object to its next lifecycle stage. loc_6aa8
[code] is the state-1 step of a descending object with the same shape: step the animation, subtract the
speed from the 16-bit position, and on reaching the bottom re-arm the tilemap-sum latch
TILE_SUM_ONCE_LATCH [code] and advance the state byte.

Collision is a two-pass scan. loc_6404 [code] does nothing when PLAY_MODE_LATCH [code] is clear and
ROUND_COUNTER [seen] bit 0 is set; otherwise it scans the actor record twice — first with selector 0,
then with selector 4 one stride on — over the sprite actor slots at SPRITE_ACTOR_RECORD_SLOTS [seen],
and a hit on either pass aborts the whole driver for the frame. Each pass runs the per-pass scanner
loc_6435, which selects its target/object set from PLAY_MODE_LATCH [code] and tests the source actor
against up to three of those records: a record hits when both its biased X and its biased Y sit within a
near limit of seven pixels of the actor. loc_6435 inlines its own bias arithmetic — offsetting the
object X by the flip-screen orientation FLIP_SCREEN_FLAG [seen] and adding a fixed vertical margin
before comparing — and on a hit it resets the struck record, restarts its animation, queues the hit
effect, and bumps the running hit tally. Two similar-looking leaf helpers sit on other paths rather than
this scan: precheckCollisionBounds [code] supplies the biased-X and bottom-limit bounds arithmetic for
the loc_5f11 [code] proximity check, and foldTargetPresenceBits [code] rotate-folds the presence bits of
the two I-parity target records at ENEMY_TARGET_REC0 [seen] into an accumulator for the loc_22e6 [code]
animation-script stepper.

Records reach the screen through two copy routines. deriveStackedSpriteYs [code] fans the player's base
Y position PLAYER_Y [seen] out to the three vertically-stacked sprite slots that draw the player (the
base slot at Y, the middle at Y-0x10, the top just below it), so the multi-sprite player follows one
coordinate. copyObjectRecordsToDisplayList [code] copies four bytes of each object record — the tile,
attribute, and two position bytes at rec+0x06/+0x10/+0x04/+0x0f — into successive display-list slots,
stepping the record pointer by a caller-supplied stride and advancing the list pointer's low byte alone
so the writes wrap within a 256-byte page.

### Teardown

The arena is torn down and rebuilt at board boundaries. clearActorArena [code] zero-fills the whole
0x200-byte record block from ACTOR_TABLE [seen] at board init, so a fresh board starts with no stale
actor state. clearActorArenaAndCounters [code] is the fuller teardown reached as a play sub-state: it
zeroes the arena from ACTOR_TABLE [seen], clears the spawn-phase counter SPAWN_PHASE_COUNTER [seen], the
per-stage arrival counter WAVE_ARRIVAL_COUNTER [seen], and the rope-segment count ROPE_SEGMENT_COUNT
[seen], then forces the in-play sub-state PLAY_STATE_INDEX [seen] to 6 to hand off to the next phase.
The screen re-init handler loc_67df [code] — the target of the enemy dispatcher's index-1 branch — sits
behind the same colour-map integrity checksum: it re-arms the round flags, clears the per-frame timer
block and the actor arena, and repaints the playfield, so a mid-play screen rebuild also empties the
arena before actors re-enter it.

## Waves, rope and launch

Three small state machines, each stepped once per frame, drive the enemies at a player: the
attack **wave** that sweeps a flock of enemies across a target grid and then sends them diving
or climbing; the **rope** that grows down the screen segment by segment, carrying a formation of
enemies and spawning bonus objects along its length; and the **arrow/launch** sequence that
raises a launch object and, on its descent, seeds fresh hunters into the fight. All three read
and write a shared block of wave/rope/launch state in RAM rather than passing values between
themselves, so the connective tissue below is mostly which cell one machine sets and another
later reads.

### The attack wave

The whole wave is driven by `loc_72a7`, which each frame chooses one of three jobs from two
flags. If the launch flag `WAVE_LAUNCH_FLAG` [code] is clear, no wave is running, so it calls
`loc_72e1` to seed the next one and returns. If a wave is running but its live-record count
`WAVE_RECORD_COUNT` [code] has fallen to zero, it hands off to the inter-wave idle handler
`loc_73e3`. Otherwise a wave is live: it walks that wave's records — two per wave, so
`WAVE_INDEX` [seen] × 2 of them — through the `ENEMY_ACTOR_TABLE` [seen] at a stride of `0x18`,
running the per-record state handler `loc_72cf` on each in turn. (A record count that computes to
zero is treated as a full 256-record pass, matching the underlying 8-bit down-counter.)

**Seeding a wave** (`loc_72e1`) only proceeds while the first target slot `ENEMY_TARGET_REC0`
[seen] is clear. It raises `WAVE_LAUNCH_FLAG` [code] and advances `WAVE_INDEX` [seen]. On the
fourth wave it does not lay down records at all — it just bumps the outer-phase counter
`WAVE_OUTER_PHASE` [code] and reloads the inter-wave hold timer `WAVE_HOLD_TIMER` [seen], re-arming
rather than repopulating. On any earlier wave it sets `WAVE_RECORD_COUNT` [code] to twice the wave
index and initialises that many records from the four-byte-per-record parameter table
`EAGLE_WAVE_PARAM_TABLE` [code]: each record is marked active and given its target column (+6),
row (+4) and two more fields (+0x10, +0x0f) copied from the table, with a fixed flag byte written
into +5 (and into +3 for records whose own low address has bit 3 set — this bit-3 parity recurs
throughout as the odd/even record split). Finally it clears `WAVE_OUTER_PHASE` [code] and the
arrival tally `WAVE_RECORDS_ARRIVED` [seen] so the fresh wave starts counting arrivals from zero.

**Between waves** (`loc_73e3`) the hold timer `WAVE_HOLD_TIMER` [seen] simply drains one step per
frame while it is non-zero. When it reaches zero, if a wave index is still set the handler enqueues
a display command carrying that index, then reseeds the hold timer and clears
`WAVE_LAUNCH_FLAG` [code] so the next frame's driver falls back into the seed path and starts the
following wave.

### Per-record state: approach, dive/climb, retire

`loc_72cf` is the per-record dispatcher. It first skips any inactive record (the active bit is
bit 0 of the two leading record bytes ORed together), then routes on the record's state byte
(+2), which is bounded to 0, 1 or 2, into the three handlers below. Each handler acts on the one
record it is handed and advances that record's own state byte when its stage is done.

**Approach** (`loc_733c`, state 0). Every record in a wave watches the same shared live enemy
position — `EAGLE_X_COORD` [code] and `EAGLE_Y_COORD` [code] — against its own target grid slot.
A record "arrives" only when the enemy's column (X ≫ 3) equals the record's target column (+6),
or the column just before it, and the enemy's row (Y ≫ 3, biased by 4) lands inside a five-row
window at or below the record's target row (+4). On arrival it advances the record to state 1 and
arms an animation: odd records (address bit 3 set) get `EAGLE_ODD_RECORD_ANIM` [code] and a seeded
dive/climb speed of `0x38` in +9; even records get `EAGLE_EVEN_RECORD_ANIM` [code], a speed of `0x40`,
and bump the arrival tally `WAVE_RECORDS_ARRIVED` [seen]. When that tally reaches `WAVE_INDEX` [seen] —
every arrival-counting (even) record of the wave has now arrived — it queues the wave-arrival command
`WAVE_ARRIVAL_CMD_BASE` [code] offset by the arrived count, which is how the "wave has formed"
display cue fires exactly once per wave.

**Dive / climb** (`loc_7395`, state 1). First the record's animation is stepped by the shared
sequence mover `loc_4006` (a frame-hold counter in +0x0e gates a little tile/attribute/hold script
addressed by +0x0c/+0x0d). Then the record's vertical position is integrated by its per-record
speed in +9 against a 16-bit position held as a fractional byte (+3) and a row byte (+4). The
odd/even split decides direction: even records **descend** — speed adds into +3, a carry steps the
row down, and once the row reaches the bottom limit `0x1d` the record advances to state 2; odd
records **climb** — speed subtracts, a borrow lifts the row, and once the row rises past the top
limit `0x04` it advances to state 2. [code]

**Retire** (`loc_73ce`, state 2). The record is zero-filled across its full `0x18` bytes and the
live-record count `WAVE_RECORD_COUNT` [code] is decremented. When that count hits zero — the last
record of the wave has retired — it seeds the inter-wave hold `WAVE_HOLD_TIMER` [seen] to `0x30`,
which is what the next frame's `loc_72a7` (seeing a zero count) and `loc_73e3` will drain before
the following wave.

### The rope

The rope is two nested machines: an **extend** machine that lengthens the rope one segment at a
time, and a **per-cell** machine that animates each drawn segment and works the enemies riding it.

**Extending** is driven off `ROPE_EXTEND_STATE` [code], which selects one of two sub-states. Its
add-a-segment sub-state (`loc_2d80`) stops immediately once the rope has grown to two below the
per-stage arrival counter — that is, once `ROPE_SEGMENT_COUNT` [seen] equals `WAVE_ARRIVAL_COUNTER`
[seen] − 2, which is how the stage's progress bounds how long the rope may get. Otherwise it bumps
`ROPE_SEGMENT_COUNT` [seen] and, while the segment index `ROPE_EXTEND_INDEX` [code] is still below
four (or a tamper strike is pending), advances that index, looks this segment's video-RAM column
low byte up from `ROPE_CELL_COLUMN_TABLE` [code] and stores the full column pointer in
`ROPE_COLUMN_VRAM_PTR` [code], reloads that segment's own cell timer in the `ROPE_CELL_TIMERS`
[code] block (one timer per cell, stride 2), advances the extend sub-state, and arms the
extend sub-timer `ROPE_EXTEND_TIMER` [code] to `0x10`. The second extend sub-state (`loc_2dbc`)
runs that sub-timer down and then paints the new segment down its column one tile-block per pass;
after eight passes it resets the extend sub-state back to the add path and arms the next cell, so
the two sub-states alternate: add a segment, draw it, add the next. `ROPE_EXTEND_INDEX` [code]
therefore doubles as the count of currently active rope cells.

**Per-cell** work walks that many active rope cells (`loc_2e22`, IX stepping across the rope-cell
state bytes) and dispatches each cell on its own state byte via `loc_2e36`: state 0 is inactive
and skipped, and states 1–4 select the four handlers below. Every handler shares two helpers — the
cell frame-timer tick `loc_2e45` (selects a timer from `ROPE_CELL_TIMERS` [code] by the low two
bits of the cell index and decrements it, reporting reached-zero) and the column-base computer
`loc_2e52` (rebuilds this cell's video-RAM column pointer from `ROPE_CELL_COLUMN_TABLE` [code]) —
and each blits its segment's 2×2 tile square through that column.

- **State 1 — spawn** (`loc_2e5e`): acts only every fourth frame (gated on `FRAME_COUNTER`
  [seen] low bits) and only once the cell timer elapses. It scans the three-slot
  `SPAWN_OBJECT_TABLE` [seen] for a free slot; finding one it re-arms the cell timer with a
  round-scaled reload (from `ROUND_COUNTER` [seen], clamped) plus the slot index, seeds the slot
  (state `0x07`, tile/coord fields, its +4 taken from `ROPE_SPAWN_IY4_TABLE` [code] keyed by the
  cell index), advances the cell state, draws the segment with `ROPE_SEGMENT_TILE_SRC` [code], and
  enqueues the segment display command. This is where the bonus objects that ride the rope are
  created. [code]

- **State 2 — animate/lower** (`loc_2ecb`): on each cell-timer expiry it writes a round-derived
  tile index (from `ROUND_COUNTER` [seen], doubled and biased) back into the timer cell, indexes
  into the `FORMATION_TABLE` [seen] by the byte following the timer and steps that formation
  record — bumping its tile field (+0x0f), clearing its position byte (+5) and dropping another
  field (+6) — then bumps the cell's own count and blits the segment with the alternate tile
  `ROPE_SEGMENT_TILE_SRC_ALT` [code]. [code]

- **State 3 — grabbable hold** (`loc_2f01`): this stage is catchable. It first runs the rope-grab
  trigger test `loc_305f`, which compares the tracked player coordinate `PLAYER_Y` [seen] against a
  per-cell catch window; a successful grab raises `GRAB_ACTIVE_FLAG` [seen], enqueues the grab
  command, and abandons the cell update for this frame. With no grab it behaves like state 2 —
  on cell-timer expiry it re-arms the timer to a fixed reload, steps the indexed `FORMATION_TABLE`
  [seen] record (dropping its tile field, forcing its position byte to `0xc0`, bumping +6),
  advances the cell state, and blits `ROPE_SEGMENT_TILE_SRC` [code]. [code]

- **State 4 — retract** (`loc_2f2f`): while rope segments remain (`ROPE_SEGMENT_COUNT` [seen]
  non-zero) it selects a retract animation pointer keyed by `ROUND_COUNTER` [seen] and the cabinet
  bit, merges a per-segment attribute into the paired cell, clears the corresponding
  `FORMATION_TABLE` [seen] record, advances the cell state, and blits the segment tile — walking
  the rope back up cell by cell. (loc_2f2f is not yet decompiled — no `ROUTINES` cert; its role
  here is read from the frozen body.)

### The arrow/launch sequence

A single five-state machine, selected by `LAUNCH_STATE` [seen] (masked to its low three bits,
handlers 0–4), raises the launch object and turns it into new hunters.

**State 0 — arm and wait** (`loc_278f`). It arms the launch once its preconditions hold: if the
lane-spawn countdown `LANE_SPAWN_COUNTDOWN` [seen] is up and the arm latch `LAUNCH_ARM_LATCH`
[seen] is still clear it bumps that latch and arms; otherwise it requires the stage countdown
`STAGE_COUNTDOWN` [seen] to be non-zero and a multiple of eight. Either way `LAUNCH_ARMED_FLAG`
[seen] is set. It then holds until the launch object has risen far enough — its Y `ARROW_Y` [code]
at least `0x3c` — and neither hunter-target record `ENEMY_TARGET_REC0`/`ENEMY_TARGET_REC1` [seen]
is flagged hit (bit 1), which keeps a fresh launch from firing while the previous hunters are still
in play. Clearing those gates, it advances the state, reseeds the tile-flip countdown
`LAUNCH_FLIP_COUNTDOWN` [code], lights the launch HUD cell `LAUNCH_HUD_TILE` [code] when the game
is idle, refreshes `LAUNCH_ARM_LATCH` [seen] from its seed `LAUNCH_ARM_LATCH_SEED` [code], and
blits the launch tile `LAUNCH_TILE_SRC` [code] at `LAUNCH_TILE_VRAM` [code].

**State 1 — animate, then seed** (`loc_27f3`). While the object is still high (`ARROW_Y` [code] at
or above `0x34`) it runs the flip countdown; each time that elapses it reseeds it, steps the shared
phase byte `SHARED_PHASE_COUNTDOWN` [code], and redraws the launch tile alternating between
`LAUNCH_TILE_SRC` [code] and `LAUNCH_TILE_SRC_ALT` [code] by that byte's parity, giving the object
its animation. Once the object drops below that height it scans the two target records
`ENEMY_TARGET_REC0`/`ENEMY_TARGET_REC1` [seen] for a free one; finding it, it marks that record
active, advances the launch state, enqueues a display command, blits the alternate tile, lights the
HUD cell, and seeds three fields of a nearby actor record (one a biased copy of a source
coordinate). [code]

**State 2 — seed a hunter** (`loc_2856`). Unless the play-mode latch `PLAY_MODE_LATCH` [code] is
set it scans the six-slot hunter table `HUNTER_TABLE_BASE` [code] downward for the first free slot,
stamps it with the fixed opening state, coordinates and tile ids, and records its address in
`HUNTER_RECORD_PTR` [code]. It then advances the launch state and branches on the flip flag
`HUNTER_SPAWN_FLIP_FLAG` [code]: clear, it seeds the spawn countdown `HUNTER_SPAWN_COUNTDOWN`
[code] to `0x20` and enqueues `HUNTER_SPAWN_DISPLAY_CMD` [code]; set, it instead bumps the
sub-counter `HUNTER_SPAWN_SUBCOUNTER` [code]. [code]

**State 3 — settle** (`loc_28ad`). It drains the spawn countdown `HUNTER_SPAWN_COUNTDOWN` [code]
one step per frame; on expiry it advances the launch state and, unless `PLAY_MODE_LATCH` [code] is
set, clears the `0x18`-byte record pointed to by `HUNTER_RECORD_PTR` [code]. [code]

**State 4 — idle** (`loc_28c5`) is a bare no-op: the machine rests here until `LAUNCH_STATE`
[seen] is reset elsewhere and the sequence begins again. [code]

## Rendering, HUD and display lists

The screen is built from three structures the game maintains: a tile plane (the character map
that carries the playfield, text and every HUD digit), a colour/attribute plane that colours it
column by column, and a stride-4 sprite display list that feeds the moving objects. The first two
ARE the display hardware's own dedicated memory-mapped regions, scanned directly to build the
raster — the tile codes live in video RAM (0x8400-0x87ff) and the attributes in colour RAM
(0x8000-0x83ff), not in any work-RAM shadow. The sprite display list is the odd one out: it lives
in the 0x8800-0x8fff work RAM, based at `SPRITE_DISPLAY_LIST` [seen], and each frame it is copied
into the separate hardware sprite banks at 0x9000/0x9400 that the video hardware actually scans.
Almost all of this is rebuilt from scratch every frame — the game does not scribble incremental
changes, it repaints whole regions from their source records and tables. Around that sit a handful
of small BCD and digit primitives that turn counters into number tiles, and two command rings that
let gameplay code defer drawing work to the frame's render pass rather than doing it inline.

### Clearing and filling the tile plane

The lowest-level fill primitive is `loc_0010` [code]: it writes a constant byte across a run of
cells and hands back the advanced pointer, with a zero length meaning a full 256-byte pass (the
hardware's `djnz` wraps). At boot `loc_01ea` [code] uses it to wipe the top 0x30 bytes of both
sprite banks (`SPRITE1_CLEAR_BASE` [code], `SPRITE0_CLEAR_BASE` [code]) and then floods the
whole lower video region from `VIDEO_RAM_BLANK_START` [code] with the erase tile 0x1e, so the
machine powers up to a clean screen.

Boards clear their playfield with a row-by-row fill rather than one big memset, because the
tilemap row (0x20 cells) is wider than its visible span. `seedTileFillCursor` [code] arms the
fill: it stores the caller's tilemap pointer as the 16-bit write cursor `TILE_FILL_PTR` [seen]
and seeds the row counter `FILL_ROW_COUNTER` [seen] to 0x20. Each pass of `loc_02c9` [code]
first zeroes the sprite/actor RAM, then blanks the 0x1d visible cells of one row to the blank
tile 0x10, steps the cursor a full 0x20-cell row forward (the visible run plus the short
remainder), and decrements the row counter — returning the Z flag so its caller keeps looping
until all 0x20 rows drain. The playfield's tile base lives at `PLAYFIELD_TILE_BASE` [code].

Narrower repaints work a column at a time. `blankTileColumn` [code] erases a three-cell vertical
column to blank tile 0x10 at a signed row stride and returns the advanced pointer so columns
chain; it is what scrolls a column off screen. `paintColumnBodyTiles` [code] and its fixed-up
twin `paintColumnBodyTilesUp` [code] stamp a column's two body tiles (mid tile 0x25, base tile
0x20), and `loc_02a8` [code] wraps the body helper with a leading cap tile 0x01 to draw a
complete three-tile column. Rectangular art is stamped by a family of block copiers: the 2x2
copiers `paintTileBlock2x2` [code] and `paintTileBlock2x2Above` [code] (the latter anchored on
its bottom-left so its top row sits one tilemap row above the anchor) each lay four source bytes
into a 2x2 cell at the 0x20 row stride, `blit2x2TileBlock` [code] does the same into video RAM
returning its dest advanced to the bottom-left cell so the two-tile animators can step up a row,
`blitTile3x3Block` [code] stamps a nine-cell 3x3 block (three cells then +0x1d to the next
screen row) advancing both its dest and its source, and `blitGlyphBlock4x3` [code] stamps a
four-row, three-column glyph block, advancing only the destination's low byte within its row so
each glyph stays inside its tilemap page. Text is laid down by `copyBiasedTileString` [code],
which copies a ROM byte string into a tile buffer adding a fixed 0x08 tile bias to reindex
character codes into display-tile codes, stopping (without copying) at the 0xa0 terminator.

### Painting the colour/attribute plane

Colour is a separate plane addressed in the same geometry as the tiles. `fillAttributeColumns`
[code] floods it: from `ATTRIB_MAP_BASE` [seen] it walks 31 columns, and for each column reads
one source byte and stamps it down all 30 rows at the 0x20 row stride, advancing the source one
byte per column. One byte therefore colours an entire vertical strip, which is how the playfield
gets its per-column palette bands in a single cheap pass.

### The sprite display list

The moving objects are drawn from a 24-entry, stride-4 display list based at
`SPRITE_DISPLAY_LIST` [seen], whose first byte is the first sprite's Y and which is rebuilt
every frame. `loc_02ef` [code] does the rebuild by concatenating four record groups into the
list through `copyObjectRecordsToDisplayList` [code] — a helper that, for each object record,
emits record bytes +0x06, +0x10, +0x04 and +0x0f into four successive list slots (the list's low
byte advancing alone, so writes wrap within its 256-byte page) and returns the advanced pointer
so the next group chains on. The groups are, in order, the two lead actors from `ACTOR_TABLE`
[seen], the two enemy-target records, the eighteen moving objects from `ENEMY_ACTOR_TABLE`
[seen] (copied with coordinate math via `loc_0343`), and the two arrow/launch records at arena
slot 2. It then nudges the arrow group's two sprite-Y bytes down one pixel each and tail-calls
`loc_0320` [code], which decrements a caller-set frame counter and then, when the orientation
flag `FLIP_SCREEN_FLAG` [seen] is zero (screen flipped), runs the vertical mirror pass. Within
the list, `SPRITE_ACTOR_RECORD_SLOTS` [seen] and the target slots `SPRITE_TARGET_SLOTS` [seen],
`SPRITE_SCAN_YSLOTS` [code] and `SPRITE_TARGET_SLOTS_P1` [code] are the stride-4 sub-ranges the
collision code and the per-frame sprite-bank copy sweep.

Two helpers shape special cases. `deriveStackedSpriteYs` [code] draws the player as three
stacked sprites: it fans the player-actor base Y at `PLAYER_Y` [seen] into the Y field of
stacked slots 3/2/1 — slot 3 gets the base Y, slot 2 base Y minus 0x10, slot 1 ten pixels below
slot 2's top. `mirrorSpriteListVertically` [code] flips the whole list for a flipped screen: it
walks all 24 stride-4 entries negating and offsetting each coordinate byte (`-x - 0x10`) and
toggling the attribute byte's two flip bits while preserving its low nibble, leaving byte +0x03
alone.

### The scroll-column worker

The scrolling tile columns are repainted by `loc_0254` [code], the worker the foreground loop
re-runs on every pass while the display-command ring is empty. If the control byte
`WORKER_CONTROL_BYTE` [code] has its low nibble set it only runs the program-signature check and
returns; otherwise, while `GAME_ACTIVE_FLAG` [seen] is set, it repaints the scroll columns. It
always repaints the shared worker column at `WORKER_COLUMN_VRAM` [code] (through `loc_02a8`), in
both modes; on top of that, one-player mode adds four blanked columns chained from
`COLUMN_CAP_VRAM` [code] through `P2_SCORE_VRAM` [code], while two-player mode caps and paints a
body column at `COLUMN_CAP_VRAM`. Every column steps one tilemap row up per cell, and it
optionally blanks one further column when the control byte's bit 4 and the game-active low bit are
both set.

### The display-command ring and the display-list interpreter

Gameplay code rarely draws directly; it posts a two-byte command into a ring on page 0x88 and
lets the render pass act on it. `loc_0038` [code] is the enqueue: at the slot named by the write
pointer `DISPLAY_CMD_RING_WRITE_PTR` [code] it checks bit 7 (a set bit 7 marks the slot free),
and if free stores the command word's high byte there and its low byte in the next slot, then
advances the pointer by two, wrapping back to the ring start 0xc0 (`DISPLAY_CMD_RING_BUFFER`
[code] at 0x88c0); an occupied slot drops the command. The command words themselves are fixed
16-bit constants — `DISPLAY_CMD_0600` [code], the wave-spawn pair `WAVE_SPAWN_DISPLAY_CMD_A`
[code]/`WAVE_SPAWN_DISPLAY_CMD_B` [code], the siren, target-match, flip-animation and promotion
commands, and the rest of the `*_DISPLAY_CMD*` family, all [code] — in which the high byte
selects a handler and the low byte parameterises it.

The foreground loop drains that ring continuously. It reads the slot at the read pointer
`DISPLAY_CMD_RING_READ_PTR` [code]: if bit 7 is set the ring is empty, so it runs the scroll-column
worker `loc_0254` and loops back to check again; if bit 7 is clear a command is pending, so it
takes the high byte (doubled, masked to 0x1f) as an even offset into the handler-address table at
0x0242, frees both slots (writes 0xff), advances the read pointer by two (wrapping up to 0xc0),
passes the low byte to the selected handler, and loops. There is no wait for vblank: the loop
free-runs, re-running the worker on every pass while the ring stays empty and dispatching each
command the instant one is posted, while the vblank interrupt does its own per-frame work
asynchronously alongside it.

The bulk drawing that some of those commands trigger is done by the display-list interpreter
`loc_4381` [code]. It chooses a destination/source pointer pair — the primary pair
`DISPLAY_LIST_DST_PTR` [seen]/`DISPLAY_LIST_SRC_PTR` [seen], or the alternate
`DISPLAY_LIST_DST_PTR_ALT` [code]/`DISPLAY_LIST_SRC_PTR_ALT` [code] when the formation selector
`FORMATION_SLOT_TABLE` [seen] is nonzero — then walks up to 0x1d source bytes. A plain byte is
copied straight to the destination; a skip opcode (0x10) advances the destination by the
following byte and shrinks the remaining count; a reload opcode (0xff) loads a fresh destination
pointer from the stream and folds the next byte into the sub-phase tick `SUBPHASE_TICK` [seen].
On exit it writes the advanced pointers back to whichever pair it chose. `loc_744e` [code] seeds
these pointer pairs (and clears the sub-phase tick) for the attract screen before its
program-signature check runs.

A second byte-run ring lives on page 0x8a and carries the round-flavoured tile/command runs.
`loc_0ea2` [code] is its appender: it stashes the incoming byte at `TEXT_RING_PENDING_BYTE`
[code], and only while a game is active (`GAME_ACTIVE_FLAG` [seen]) or the play-mode latch
`PLAY_MODE_LATCH` [code] is held does it write the byte into the page-0x8a ring at the cursor
`SOUND_RING_WRITE_PTR` [code], step the cursor, and wrap the last slot 0x5e back to the first
0x43 (the ring buffer `SOUND_RING_BUFFER` [code] spans slots 0x8a43-0x8a5e; the cursor is a low
byte indexed off the 0x8a00 page base). `loc_0fc3` [code] appends a
four-byte run — the caller's byte followed by the fixed codes 0x15, 0x16, 0x17 — and `loc_0f97`
[code] feeds it a round-derived leading byte, picking one of four command bytes from
`ROUND_COUNTER` [seen] (bits 1..2 plus a base of 0x1e). A cluster of sibling trampolines feed
the same ring with their own fixed runs: `loc_0ed2` (byte 0x01), `loc_0f11` (0x0c), `loc_0f88`
(opening tile 0x82 then run 0x1c), `loc_0fad` (run opening 0x26), `loc_0fbc` (0x28,0x15,0x16,0x17),
and the round-selected pair `loc_0f76` (a siren tile chosen by `ROUND_COUNTER`'s low bit, gated
on the siren-enable flag) and `loc_0fa2` (one of tile codes 0x22..0x25 chosen by
`ROUND_COUNTER` bits 1..2) — all [code]. WARNING: this page-0x8a ring is named through the
`SOUND_RING_*` cells and shares its write cursor and buffer region with the sound-command
enqueue helper `loc_0eb3` [code], so the cell names do not by themselves distinguish the two
producers; what the code shows is one shared ring on page 0x8a fed by both paths.

### HUD number primitives

Numbers reach the screen through a small kit of BCD converters and digit painters. `binToPackedBcd`
[code] counts a binary value up in BCD, leaving the low two decimal digits packed in one byte and
a hundreds tally alongside (a zero count means a full 256-step wrap, giving 0x56 with hundreds 2).
`byteToPackedBcd` [code] does a value-mod-100 conversion the Z80 way — BCD-correcting the low
nibble, adding decimal 16 once per high-nibble unit, and folding the low digit back in, each step
through a faithful `daa`. Two painters turn a packed byte into tiles. `splitBcdByte` [code] writes
the low (units) nibble as a tile at the cursor, advances it, and hands back the high (tens) nibble
with a zero-sense flag for leading-zero suppression. `drawStackedBcdDigits` [code] stacks a packed
byte vertically — tens at the cursor, units one tilemap row up (toward lower addresses) — blanking
a zero tens digit to the blank tile 0x10. For multi-byte fields, `renderDigitWithBlanking` [code]
threads a shared "blank budget" across digits: a non-zero digit stores as-is and ends the leading
run, a zero digit stores the blank tile while the budget lasts and a real 0 once it is spent, and
it steps the cursor by the row stride each call.

### Score, high-score and panel fields

The three-byte BCD counters are painted down vertical HUD columns. `loc_0552` [code] both zeroes
and repaints a counter selected by a small index — player 1 (`P1_SCORE_BCD` [seen] to
`P1_SCORE_VRAM` [code]), player 2 (`P2_SCORE_BCD` [seen] to `P2_SCORE_VRAM` [code]) or the high
score (`HIGH_SCORE_BCD` [code] to `HIGH_SCORE_VRAM` [code]) — rendering its three bytes
most-significant first, each split into a high then a low digit through `renderDigitWithBlanking`
with a blank budget of 4 and one row up per digit, so a freshly-zeroed counter shows four blanks
then two zeros. `loc_056b` [code] is the repaint-only twin, walking the same three-selector layout
(reading the high-score field from `HIGH_SCORE_BCD_HI` [seen]) to redraw a live score without
clearing it.

The status panel is painted from a tile-code table. `renderPanelFromTable` [code] walks ten rows
of three cells from `PANEL_TILE_SOURCE` [code] into video RAM at `PANEL_VRAM_DEST` [seen],
drawing each source byte when non-zero and the blank tile 0x40 otherwise; within a row the first
two cells climb one row (stride -0x20) and the third re-bases forward to the next column (+0x42).
A separate panel-digit path drives `PANEL_DIGIT_VRAM_DEST` [code] from the digit source table
`PANEL_DIGIT_SOURCE_TABLE` [code].

### Stage, timer, gauge and wave readouts

`renderStageCountdownDigits` [code] paints the stage countdown `STAGE_COUNTDOWN` [seen] as a two-
cell number at `HUD_STAGE_DIGIT_LO` [seen]: a value under ten renders as a single as-is digit,
while ten or more converts to packed BCD first — and that two-digit path draws nothing while the
play-mode latch `PLAY_MODE_LATCH` [code] is held — with the tens tile one tilemap row over and a
leading zero suppressed.

The phase gauge is a five-cell vertical bar. `renderPhaseGauge` [code] and its identical twin
`paintPhaseGauge` [code] read `GAUGE_PHASE_COUNTER` [seen]: a zero count leaves the gauge
untouched, otherwise (count − 1) cells clamped to five are drawn with the filled tile 0xb0 from
`PHASE_GAUGE_BASE_TILE` [seen] upward (one row per cell) and the remaining cells above are drawn
with the blank tile 0x10.

The play timer is rendered by `loc_7960` [code], the shared integrity-and-timer handler: after
its entry checksum passes it splits the active player's timer minutes and seconds BCD bytes
(`PLAY_TIMER_BCD_P1` [code] or `PLAY_TIMER_BCD_P2` [code], chosen by the active player) into
hi/lo nibble tiles up a video column at `PLAY_TIMER_DIGIT_VRAM` [code], parting the minute and
second groups with the spacer tile 0x51, then clears the timer bytes it just drew.

The wave-arrival count is painted once per wave by `loc_6931` as it spawns the first enemy
pair of a wave (while `WAVE_NUMBER` [code] is still zero): it counts `WAVE_ARRIVAL_COUNTER` [seen]
up in packed BCD and writes the high digit to `WAVE_COUNT_HUD_HI` [code] and the low digit one
column below it, alongside queuing the wave display commands `WAVE_SPAWN_DISPLAY_CMD_A`/`_B`
through `loc_0038` and the round-derived run through `loc_0f97`. During the level intro,
`loc_6f42` [code] draws the target-hit tally `HIT_TALLY` [code] at `HUD_INTRO_DIGITS_BASE` [code]
as two stacked digit pairs — the packed tally and its BCD double two rows up.

### The round marker

`loc_4a0b` [code] draws the round marker, and only when the round counter's low bit is set
(`ROUND_COUNTER` [seen]); with it clear the routine returns. It first snapshots the spawn-phase
count `SPAWN_PHASE_COUNTER` [seen] into two mirror cells (`SPAWN_PHASE_SNAPSHOT` [code] and
`ROPE_DRAW_COUNT` [seen]). For a non-zero count it paints that many stacked pairs of a two-wide
marker (tiles 0xda/0xdb on top, 0xd8/0xd9 below) climbing a tilemap column from `MARKER_VRAM_BASE`
[code] two rows per pair, saves the column layout pointer, and stamps the marker glyph block
below the stack via `blitTile3x3Block`; for a zero count it saves the alternate layout pointer and
stamps the glyph block at the fixed anchor.

## Sound

All audio on Pooyan lives on a second processor that the main CPU never shares memory with; the
main CPU's entire job is to hand that processor one command byte at a time and pulse it awake. The
byte travels through a hardware latch, and to smooth out bursts gameplay mostly appends commands to
a small ring in work RAM and lets the vblank service drain them at a steady one-per-frame cadence
rather than writing that latch directly — though a few presets do bypass the ring and hand a byte
straight to the latch (`loc_0f09`, below). What the audio processor then plays is recorded and
replayed rather than simulated, so everything below stops at the moment the byte crosses to it.

### The command latch and the wake strobe

The board decodes a write to `0xA100` as the sound-command port: the write lands in the I/O layer's
sound_data register and, when a recording sink is attached, is announced to it (the recorded audio
player keys entirely off that `0xA100` write). Reads of `0xA100` are unmapped — it is a one-way door
to the audio side. The byte parked there is `SOUND_COMMAND_LATCH` [seen].

Latching a byte does not by itself make the audio processor act on it; the main CPU must also
interrupt it. That is `sendSoundCommand` [code]: it stores the command byte to `SOUND_COMMAND_LATCH`
[seen], then drives the audio-interrupt line — one bit of the board's control latch, `AUDIO_IRQ_LATCH`
[seen] — high and immediately back low. The high-then-low pair is a strobe: a short run of do-nothing
instructions sits between the two edges, holding the line high just long enough for the audio
processor to notice the pulse. Roused by the strobe, the audio processor reads whatever byte is
sitting in the latch. The same control latch physically carries an audio-mute line as well, but no
routine drives it, so audio is left unmuted. At power-on the boot path `loc_0092` [code] fires one
direct `sendSoundCommand` with a command of zero to silence the audio processor before anything else
plays.

### The sound-command ring and its once-per-frame drain

Rather than call `sendSoundCommand` inline whenever something wants a sound, gameplay code appends
commands to a small circular buffer, `SOUND_RING_BUFFER` [code], occupying the twenty-eight bytes
`0x8A43`–`0x8A5E`. Two cursors track it: a tail pointer `SOUND_RING_WRITE_PTR` [code] naming the next
free slot and a head index `SOUND_RING_READ_PTR` [code] naming the next slot to consume. Both indices
run over the range `0x43`–`0x5E` and wrap the last slot back to the first; an unused slot holds the
sentinel `0xFF`. Boot sets the whole buffer to that sentinel and parks both cursors at the origin
`0x43`, leaving the ring empty.

The drain is the audio heartbeat, and it runs once per displayed frame. The vblank NMI service
routine at `loc_066d` — which fires asynchronously once per frame, resamples the three input ports,
ticks its frame counters, and dispatches on `MAIN_GAME_STATE` [seen] — makes a single call to the
ring drain `loc_0e64` [code] on each firing. That drain reads the slot named by `SOUND_RING_READ_PTR`
[code] and returns at once if it holds the empty sentinel. Otherwise it decides whether the game
should currently be audible: it stays silent only when demo sounds are disabled (bit 0 of
`DEMO_SOUNDS_DSW` [code] clear) *and* no game is in progress (`GAME_ACTIVE_FLAG` [seen] zero) — that
is, attract mode with demo sound switched off. In every other case it passes the byte to
`sendSoundCommand` [code], which latches it and strobes the audio processor as above. It then frees
the consumed slot back to `0xFF` and advances the head, wrapping at the end.

Because the drain lifts at most one entry per frame, at most one command reaches `0xA100` per frame,
and the latched byte therefore sits unchanged for a full frame or more before the next drain can
overwrite it — comfortably long enough for the strobed audio processor to sample it. The queue is
what lets a single game event request several sounds at once without any of them being clobbered:
they simply drain out over successive frames.

### Requesting a sound

Game events do not choose command bytes at their call sites; they call one of a family of tiny
selector routines, each of which names a fixed command byte and appends it. What differs between them
is which enqueue helper they append through, and the block splits across two — one ungated, one gated.

The plainest selectors append through the ungated helper `loc_0eb3` [code], which stores the byte
into the slot at the tail cursor `SOUND_RING_WRITE_PTR` [code] and advances that cursor
unconditionally, wrapping the last slot back to the first. `loc_0ecf` [code] enqueues zero (silence)
this way; `loc_0ed6` [code] enqueues `0x02`; `loc_0ef1` [code] and `loc_0f01` [code] cover more of the
palette; and several — `loc_0eda` [code], `loc_0f4e` [code], `loc_0f6c` [code], `loc_0fb2` [code], for
effects built from more than one command — append two bytes in a row.

The rest of the block appends through a second helper, `loc_0ea2` [code], which shares the very same
buffer and the very same tail cursor `SOUND_RING_WRITE_PTR` [code] — so its bytes interleave into the
one ring the drain services — but adds a gate: it first stashes the pending byte in
`TEXT_RING_PENDING_BYTE` [code], then appends only while a game is active (`GAME_ACTIVE_FLAG` [seen])
or the play-mode latch `PLAY_MODE_LATCH` [code] is set, and it leaves the advanced cursor in the
accumulator for its callers. A wrapper such as `loc_0f0d` [code], which appends the fixed byte `0x0B`,
takes this gated path. Multi-byte runs are built on `loc_0fc3` [code], which chains four appends
through `loc_0ea2` [code] — the caller's byte followed by the fixed codes `0x15`, `0x16`, `0x17`.

One selector is data-driven rather than fixed: `loc_0f97` [code] derives a byte from two bits of
`ROUND_COUNTER` [seen] — bits 1..2, i.e. `(v >> 1) & 3` — added to a base of `0x1E`, so the run
tracks the current round, then delegates to `loc_0fc3` [code]: it appends that round-derived byte
followed by the same fixed `0x15`/`0x16`/`0x17` run, all through the gated helper.

Not every request goes through the ring at all: `loc_0f09` [code] is a preset that hands the fixed
command `0x0B` straight to `sendSoundCommand` [code] — latching and strobing it immediately, without
waiting for the frame drain — and it is called directly from gameplay routines.

### Where the model stops

Everything above concerns only the production, queuing, and delivery of command bytes by the main
CPU. The audio processor that receives them — its own program, its tone generators, the waveforms it
produces — is not modelled here; its output is captured and replayed, so the sound subsystem's
responsibility ends at the `0xA100` write and its accompanying wake strobe.

## Anti-tamper

Pooyan does not trust its own image. Scattered through the boot path, the attract
loop, the per-frame worker, and a dozen ordinary gameplay handlers is a lattice of
self-integrity checks, each of which folds a fixed span of program ROM or video RAM
into a small running sum and compares it against a sentinel baked into the code. On
an authentic board every one of these sums lands on its sentinel and the check is
invisible; the interesting behaviour is entirely in what happens when a sum *misses*.
The machine answers a miss in one of two deliberately oblique ways. Some checks
execute an out-of-range branch straight into ROM data — a hard trap that on a valid
image is simply unreachable. The rest never crash outright: they record a strike in a
work-RAM tamper cell, and unrelated handlers read that cell on odd little side-arms so
that a tampered ROM decays into subtle corruption — frozen spawns, garbage written
through a flag reused as a pointer, a rope column indexed by a strike count — rather
than a clean halt that a bootlegger could spot and patch out.

### The boot self-test

The power-on entry `loc_0092` [code] runs the widest check of all before it builds any
machine state. It walks the eight 4K program banks end to end, keeping a 24-bit rolling
sum per bank as three bytes (low, mid, high with the carries rippling upward), and
compares each bank's triple against the 24-byte reference at
`ROM_SELFTEST_CHECKSUM_TABLE` [code] (0x0079), three bytes per bank. The verdict is
kept as a tally in `ROM_SELFTEST_TALLY` [code] (0x8fff): it is seeded with the bank
count of eight and bumped once per matching bank, so a wholly intact image finishes at
exactly 0x10. That tally cell is physically parked one word above the boot stack — the
boot leaves the stack pointer a word low on purpose — precisely so the per-frame vblank
register-save cannot clobber the one byte the integrity verdict lives in. Nothing in
`loc_0092` reacts to a bad bank directly; it writes only the tally and carries on with
normal setup. The reaction is deferred to the attract-to-play handoff in `loc_072d`
[code], which blanks the tilemap row by row and, once the fill drains, refuses to finish
board setup unless the tally reads exactly 0x10 — on any other value it abandons the
handoff and drops back into the main loop, so a failed self-test simply strands the
machine in attract, never reaching play.

A companion check covers the high-score table. `flagHighScoreTableCorruptOnChecksumMiss`
[code] reads the four-byte checksum block based at `HISCORE_CHECKSUM_BASE` [seen]
(0x778a): the header byte must be the 0xc8 marker, and the four bytes summed (counting
each 8-bit carry separately) minus that carry count must equal 0x59. A wrong header or a
wrong total sets `HISCORE_TABLE_CORRUPT_FLAG` [code] (0x8df8), the signal the table was
altered.

### Periodic ROM and code checksums during play

The most frequent guard is the program-signature check `verifyRomSignature` [code],
which the per-frame worker `loc_0254` [code] runs whenever its control byte's low nibble
is set. It samples every eighth byte of the code region from `SIGNATURE_SAMPLE_BASE`
[seen] (0x066d) — stepping the sample pointer by eight while the reference advances by
one — against the sixteen-byte `SIGNATURE_REFERENCE_TABLE` [seen] (0x20aa), and on the
first byte that differs it raises `SIGNATURE_MISMATCH_FLAG` [code] (0x8ef0) and stops.
That flag is consumed quietly by `loc_6523` [code], which seats fresh object records:
while the flag is held it refuses to seat anything, so a tampered image slowly starves
of new objects. A second guard feeds this same flag from its own fold: `loc_3865`
[code], only on the frame-counter zero crossing and only once its record pointer has
reached the object-table band, folds the block backward from `ACTOR_TAMPER_CKSUM_TOP`
[code] (0x4282) down to a 0x1a terminator and bumps `SIGNATURE_MISMATCH_FLAG` if the
carry-plus-sum keeps any bit of 0x9e. A sibling handler `loc_4103` [code] runs a similar
fold but banks its strike in a different cell — likewise on the zero crossing it folds the
low nibbles of the 56-byte block at `TAMPER_NIBBLE_SUM_BLOCK` [code] (0x557f) and, unless
the running total is 0x67 with exactly one carry, bumps the signature-strike counter
`TAMPER_STRIKES_SIG` [code] (0x8a38) — the same counter the player-bank snapshot `loc_1bcc`
feeds, not the mismatch flag `loc_6523` reads.

`loc_7e6d` [code] is the periodic ROM-checksum guard, gated so it only runs when `PLAYER1_LIVES`
[seen] is at least four and `FRAME_COUNTER` [seen] is at its zero crossing. It sums the
program image downward from `TAMPER_CKSUM_TOP_ADDR` [code] (0x64be) to a 0x34 sentinel
byte, tracking both the byte sum and a count of its carries, and if carries-plus-sum has
any bit of 0xb0 set it bumps `TAMPER_STRIKES_ROM` [code] (0x89ef).

The state-10 guard `verifyRomChecksum` [code] sums sixteen read-only bytes descending
from `ROM_CHECKSUM_TOP` [code] (0x7780) into a single byte and reads its shape: a healthy
image has bit0 clear, bit5 set and bit7 set, and any other shape bumps
`TAMPER_STRIKES_STATE10` [code] (0x8a39). The eagle-spawn tripwire `verifyTableChecksum`
[code] sums a caller-supplied run of bytes into a 16-bit accumulator and demands the total
be exactly 0x1dc1; on any other total it raises `TAMPER_ROM_CHECK_FLAG` [code] (0x882b).

Several checks target the freeze tally `TAMPER_FREEZE_FLAG` [code] (0x881e).
`flagTamperOnRound5ChecksumMiss` [code] arms only when `ROUND_COUNTER` reads 5: it sums
six program bytes from 0x1553, and unless low-sum plus carry-count plus a 0x7f bias wraps
to zero it bumps the freeze tally. The play-state handler `loc_1b43` [code], after
re-arming the tilemap fill and enqueuing its display work, folds a 34-byte block from
`TAMPER_CKSUM_BASE_5593` [code] (0x5593) — masking each byte to 0x37, rotating right and
adding with carry — and bumps the freeze tally on any result other than 0x7c. The
actor-seeding routine `loc_5594`, at the first free block it finds, sums an
eight-byte guard at 0x0bad against a local signature table at 0x55b5 and bumps the same
freeze tally if any pair comes out nonzero.

The player-bank snapshot `loc_1bcc` [code] carries a signature tripwire of its own: after
copying the live page into player 1's saved bank it folds the low five bits of the
fourteen-byte block at `TAMPER_CHECKSUM_CODE_BASE` [code] (0x5328) — seeding the fold, as
a quirk, from the advanced copy pointer rather than from zero — and bumps
`TAMPER_STRIKES_SIG` [code] (0x8a38) unless the result lands on 0x8a60.

### Routines that checksum other routines

A distinct family verifies the integrity-checking code itself, reading ROM routines as
data. `loc_79e9` [code] sums the bytes of the tile-region checksum routine at
`SELFCHECK_ROUTINE_BASE_ADDR` [code] (0x68ac) forward until its terminating return
opcode, building a 16-bit sum it matches against the guard word at `TAIL_CHECKSUM_GUARD`
[code] (0x7a0b): a low-byte miss is a hard trap unreachable while those bytes are intact,
and a high-byte miss instead diverts to a phase-gauge repaint. `loc_30f1` [code], the
hunter-formation launch, keeps a second copy of that same routine at `TAMPER_COPY_3278`
[code] (0x3278) — a two-byte pointer header followed by 0x40 body bytes — and after its
formation setup it compares the copy byte-for-byte against the original at 0x68ac; a
mismatch triggers the harshest response in the game, propagating zero across work RAM
upward from the DIP-switch base and wiping the machine's live state.

The attract sub-state `loc_08e9` [code] straddles its attribute-map flood with two guards:
it sums a 0x20-byte attribute table and requires 0x63, then floods the columns, then sums
the nine-byte code block at `ATTRACT_INTEGRITY_CKSUM_BASE` [code] (0x0831) and requires
0xaa — either miss is a hard trap. `loc_3266` [code], hunter-formation state 2, sums the
0x20-byte block from `FORMATION_GUARD_BASE` [code] (0x0799) and traps unless it reaches
the 0xdc sentinel.

The shared integrity-and-timer handler `loc_7960` [code] carries two checks around its
play-timer render. On entry it folds the 0x5b-byte code block at
`INTEGRITY_CHECKSUM_CODE_BLOCK` [code] (0x2901) into a four-byte checksum — a 16-bit sum
plus a second sum of the running low byte taken only at even offsets — and traps unless all
four bytes match the guards trailing the block. After rendering it scans the seven-byte
flag block at `INTEGRITY_FLAG_SCAN_BASE` [code] (0x89e7), and if any strike flag there is
set it diverts to a tail sum from that flag to a 0xc9 sentinel, checked against
`TAIL_CHECKSUM_GUARD`: a low-byte miss traps, a high-byte miss repaints the phase gauge.
This is where the accumulated strike counters loop back and change behaviour.

Three more checks record their strikes without an immediate reaction. `loc_52f6` [code],
a gated slot sweep, folds the 23-byte block descending from `SLOT_SWEEP_CKSUM_BASE` [code]
(0x0bf3) and bumps `TAMPER_STRIKES_SLOTSWEEP` [code] (0x89e8) unless the 16-bit sum is
0x0915. The object state-0 handler `loc_3be3` [code], on the frame where it runs the gated
lane reset (screen upright, stage countdown still low), sums the 0x12-byte window
descending from `STATE0_CKSUM_BASE` [code] (0x01d5) and bumps `TAMPER_STRIKES_STATE0`
[code] (0x89ed) unless the running sum is 0x55. The credit-HUD draw `loc_05ee` [code]
hides its tripwire behind the credit count: only when the units digit happens to be 2
does it sum the 31-byte block descending from `HUD_GUARD_CKSUM_TOP` [code] (0x64c8) and
bump `TAMPER_STRIKES_HUD_GUARD` [code] (0x8a3c) on any total but 0x8c.

Two more routines complete the code-checking set. `loc_64be` walks a source
pointer descending from `TERMINATOR_SCAN_SRC` [code] (0x0bc2) against the ascending
`TERMINATOR_MATCH_TABLE` [code] (0x64d0) until a byte differs or a fetched table byte
decrements to zero; a mismatch bumps `TAMPER_STRIKES_TERMINATOR` [code] (0x8df9), and both
exits drop the caller's own return so control skips back to the caller's caller.
`loc_08b3`, attract sub-state 0, runs a backward ROM checksum from 0x64d5 to a 0x96
sentinel, summing bytes into one register and counting carries into another, and unless
0x96 minus the carry count equals 0x8f it raises `TAMPER_OBJECT_FREEZE_FLAG` [code]
(0x89fb).

### Video-RAM integrity

Two guards checksum the screen itself. `loc_7517` [code], display dispatch state 1,
column-sums two fourteen-tile video-RAM strips based at `HUD_INTEGRITY_STRIP_A` [code]
(0x82bc) and `HUD_INTEGRITY_STRIP_B` [code] (0x86bc), walking each strip upward one
tilemap row (a -0x20 stride) at a time; the combined total must be exactly 0x014f, any
other value traps, and a clean sum advances the dispatch to state 2. `loc_6a7f` [code], the
per-frame object driver, arms a one-shot tilemap checksum when the blink phase is clear
and the wave index is exactly 2: latched so it runs once per pass, it sums the playfield
tilemap from a short way into video RAM, stepping column by column while skipping column
0x1b, and requires the accumulator to reach 0x29b8 — any other result traps, since it is
only reachable once work RAM has already been corrupted.

The playfield tile region has its own once-only guard, present as a routine and its ROM
duplicate. `loc_68ac` [code] (the original) and `loc_3278` [code] (the copy `loc_30f1`
verifies) both sum the tilemap across its 29-cell-wide columns, skipping a three-cell gap
to each next row and advancing pages until the high byte reaches 0x88, then match the
low-byte sum and the wrap count against the paired entries in `TILE_CHECKSUM_TABLE` [code]
(0x68eb); a miss on either is a data-integrity trap. A latch, `TILE_CHECKSUM_LATCH` [code]
(0x8f55), guarantees the sum runs at most once per arm.

The periodic guard `loc_7881` combines a ROM check and a video check. It is
frame-countdown gated, and first sums nine 32-byte blocks from 0x0779 into a 16-bit
accumulator, comparing each block's cumulative sum against the nine-word table at 0x7900;
any mismatch aborts back to its caller through a shared return. If that passes it sets a
state selector and runs a serpentine 16-bit sum over video RAM from 0x8548 across paired
twelve-cell columns; if the sum's low byte plus high byte plus 0xa6 is nonzero it jumps
into the corruption path described below, and only a clean sum lets it clear its spans and
re-initialise the actor slot.

### How a miss propagates

The hard traps — `loc_08e9`, `loc_3266`, `loc_7960`, `loc_7517`, `loc_6a7f`, the
`loc_68ac`/`loc_3278` pair, and the low-byte arm of `loc_79e9` — all take an out-of-range
branch into a region of ROM that holds data, not code; on an intact image that branch is
never taken.

The strike-and-flag arms are where the design shows its hand: the failure is banked into a
work-RAM cell, and unrelated handlers then read that cell on side-arms that aim garbage at
data rather than halting. A failed boot bank freezes the machine in attract, as above. The
freeze tally `TAMPER_FREEZE_FLAG` (0x881e) is read by the actor driver
`loc_241e`, which aborts its whole 0x8a80-actor dispatch while the tally stands, and by the
spawner gate `loc_6e75`, whose skip-spawn branch on freeze (0x881e) or signature-mismatch
(0x8ef0) targets 0x4c92 — an
address that holds data, so taking that arm would execute data (a dead trap). The object
freeze flag `TAMPER_OBJECT_FREEZE_FLAG` (0x89fb) is OR-ed with the board-clear flag inside
`loc_1e55` [code], which then zeroes the player's aim/input every frame, and is consumed
as a fill value by the board/HUD reset `loc_2527` [code]. The signature-mismatch flag
starves object seating as already noted.

The strike *counters* drive the subtlest arms. `loc_2d80` [code], the rope-extend driver,
once the rope index reaches four (>= 4), uses the value of `TAMPER_STRIKES_ROM` as an index into
the rope-column table — so a strike steers the rope to a garbage column. `loc_2473` [code],
an actor state step, on its expiry writes the value of `TAMPER_STRIKES_STATE10` straight
into the address held in BC instead of advancing the actor state — an overlap arm that
scribbles the strike count into data. `loc_24fb` [code] treats `TAMPER_ROM_CHECK_FLAG`
(0x882b) as both a flag and a pointer: when the flag is nonzero it stamps 0x07 *through*
it, and when the HUD-guard strike stands it then loads a shape from that same pointer.
`loc_2442` [code] simply idles the lead actor while either the slot-sweep or ROM strike is
nonzero, and `loc_2514` [code] ORs `TAMPER_STRIKES_TERMINATOR` with the board-clear flag to
force a board-and-HUD reset. Finally the seven-flag block scanned by `loc_7960` turns any
standing strike into the tail-checksum diversion.

The corruption path proper is `loc_0320` [code]. In normal use it is an innocuous
per-frame helper — it decrements the counter byte the caller points HL at and, when the
screen is flipped, mirrors the sprite list vertically. `loc_7881` weaponises it: on its
video-serpentine failure it jumps into `loc_0320` with HL still holding wherever the
serpentine sum came to rest, so `loc_0320` decrements an essentially arbitrary byte of
memory. The tamper response is thus not a reset but a single oblique write into live state
through an otherwise ordinary routine.

### A multiplexed cell

`TAMPER_ROM_CHECK_FLAG` (0x882b) is genuinely triple-purposed, and the overlap is the
reason `loc_24fb`'s flag-versus-pointer branch reads so strangely. `verifyTableChecksum`
writes it as the eagle-spawn tamper flag; `loc_24fb` reads it as a flag and stamps 0x07
through it as a shape pointer (or, when it is clear, into the play-state index
instead); and the coin-acceptance step `loc_5a56` writes 0x882b as coinage scratch within
its slot-1 debounce cluster (its counter, 0x8824, is a separate cell). The tamper flag therefore shares
physical RAM with live coinage state — a deliberate reuse that keeps the anti-tamper
check from standing out as a dedicated, easily-neutralised cell.

## Open questions

These are the roles the current code cannot settle on its own; each needs MAME grounding or a routine
that is not yet decompiled.

- **The rst-0x28 dispatcher spine is the bulk of the remaining unlifted code.** The object/state
  dispatchers (0x40d0, 0x6822, 0x76f4-via-0x7707, 0x71b9) and the boot/attract dispatchers (0x0899,
  0x0fd5, 0x15a1, 0x7442, 0x7e94), plus several mid-routine dispatch sites, route through inline word
  tables; their handler sub-trees are reached through those tables rather than direct calls, so they
  are grounded and lifted last.
- **Several play-state handlers behind the 0x15a8 table are not yet decompiled** — indices reaching
  `loc_1d9c`, `loc_1d6e`, `loc_1c03`, `loc_1c66`, and `loc_6bb2` have only frozen bodies and no settled
  role, so the eagle-stage / launch-countdown / game-over branches they drive are described only as far
  as their callers pin them.
- **`WAVE_NUMBER` (0x892d) carries two roles in different code.** The enemy-spawn sweep reads it as a
  wave/stage index, while another path reloads it as a per-frame countdown; whether this is a deliberate
  mode-dependent reuse of one byte or two overlapping uses needs MAME grounding.
- **Most page-0x8d and page-0x8f cluster cells are [code], not [seen].** The actor/aim/wave working
  cells are read consistently from the routines that touch them but have not been watched under MAME.
- **The page-0x8a ring is shared between display and sound.** The display-list appender and the
  sound-command enqueue write the same buffer through the same wrapping cursor, and its base is named as
  the high-score table; which owner the buffer and cursor belong to, and the right name for them, is not
  settled from the CPU code alone.
- **The phase-gauge renderer appears at two ROM entries** (0x03c2 and 0x2065) with byte-identical
  bodies; whether both are genuinely distinct entry points or one is an alias is not decidable from the
  code alone.
- **Enemy identity is provisional.** Some actor cells and routines still carry `EAGLE_*`/`HUNTER_*`
  names; which on-screen enemy each denotes is a naming reconciliation still open.
- **Sprite double-bank.** The vblank service writes the same column-group data to both sprite banks
  (0x9000 and 0x9400); which bank the hardware displays, and whether it ping-pongs, is a display-select
  concern not decidable from the CPU code alone.
- **The audio CPU's consumption is out of scope.** The command latch write and the audio IRQ path are
  confirmed, but the second CPU's playback is recorded, not modelled.
- **A few config cross-references are unpinned** — e.g. IN0 at 0xA080 (derived from the memory-map
  decode and the NMI read, not a named const) and the exact body of the coinage service at 0x59e8.
