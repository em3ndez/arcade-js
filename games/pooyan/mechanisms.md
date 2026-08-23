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

The Z80 sees a flat 64KB. The bottom half, `0x0000`-`0x7fff`, is the four program ROMs and never
changes. Everything the running game reads and writes lives in the top half, and it falls into three
very different kinds of address: two planes of tilemap memory that the video hardware scans, a small
2KB block of ordinary read/write RAM that holds the entire game state, and a narrow window of
memory-mapped hardware registers. The board is deliberately unforgiving about the gaps between these:
any read or write that lands on an address the map does not define is not silently absorbed, it
throws. A stubbed-out zero would let a decode bug hide by making a mistaken access look like a quiet
CPU read; failing loud instead means the very first stray access is the one that surfaces.

### The address space and its regions

Immediately above ROM sit the two video planes. Colour RAM occupies `0x8000`-`0x83ff` and holds one
attribute byte per tile cell; video RAM occupies `0x8400`-`0x87ff` and holds one tile-code byte per
cell. Both are 1KB, which is exactly enough for the 32x32 grid of cells the renderer walks, with the
32-column pitch (a step of `0x20`) showing up everywhere a routine marches down a screen column.

Work RAM is the next 2KB, `0x8800`-`0x8fff`. This is the whole of the game's mutable state — every
counter, flag, pointer, actor record, score, and ring buffer the program keeps between frames. It is
also where the emulated stack lives, growing down from an initial pointer of `0x9000`; the top slice
of the block, the `STACK_SCRATCH` window `0x8fc0`-`0x9000`, is stack churn rather than game state, so
state comparisons deliberately ignore it. One word right at the top, `ROM_SELFTEST_TALLY` (`0x8fff`,
[code]), is kept just above where the stack ever reaches — the boot reserves it with a single
unbalanced push (`BOOT_STACK_TOP` = `0x8ffe`, [code]) precisely so the register-saving that happens
on every vblank interrupt cannot trample it.

Sprite memory sits in its own region from `0x9000`. There are two banks of 256 bytes, and they are
selected not by an address range but by a single decode bit: `0x9000` reaches bank 0 and `0x9400`
bank 1, with the surrounding bits treated as don't-care so the banks mirror across the whole
`0x9000`-`0x9fff` window. Finally, from `0xa000` up, the map is not memory at all but a set of
hardware devices, and read and write to the same address reach different devices entirely.

### The two video planes and the sprite banks

The two tilemap planes work as a pair, one cell of each backing every position on the 32x32 grid.
The code plane (video RAM) supplies the whole tile-code byte — which of the 256 decoded 8x8
characters to draw — while the attribute plane (colour RAM) supplies that same cell's colour palette
(its low nibble) and its two flip bits (horizontal in bit 6, vertical in bit 7). The renderer paints
the tilemap opaquely first — pen 0 included, so it is a solid background layer — and only then lays
sprites over it. The screen is single-layer: there is no priority split, so a sprite pixel simply
wins wherever it is non-transparent. The board carries a global flip-screen state, and when it is set
the whole tilemap is drawn mirrored, the cell address reflected in both axes and each cell's own flip
bits inverted to match.

Sprites are described across the two banks at matching offsets. For a given sprite slot, bank 0 holds
its screen X and its tile code, and bank 1 holds its attribute byte (palette in the low nibble, an
active-low horizontal-flip bit, a vertical-flip bit) and a Y expressed as `240 - y`. The renderer
sweeps the slots in ascending order so that when two sprites overlap the one at the higher slot
number is drawn last and therefore wins.

Both planes are also where several state cells reach out to touch the screen directly. The
colour/attribute map is flooded from `ATTRIB_MAP_BASE` (`0x8040`, [seen]) when a field is set up.
Small HUD fields have their own named tile cells on the video page: the status panel is painted to
`PANEL_VRAM_DEST` (`0x8567`, [seen]), the credit counter's two digits land at `CREDIT_HUD_UNITS_VRAM`
/ `CREDIT_HUD_TENS_VRAM` (`0x869f` / `0x86bf`, both [code]), the vertical phase gauge is drawn up the
column from `PHASE_GAUGE_BASE_TILE` (`0x863f`, [seen]), and the stage number's units digit sits at
`HUD_STAGE_DIGIT_LO` (`0x8743`, [seen]) with its tens one cell-row (`0x20`) above. A moving tile strip
is animated by walking `TILE_ANIM_CURSOR` (`0x88be`, [seen], whose high byte is fixed at the video
page `0x84` while its low byte marches back and forth) and rewriting the tile codes under it.

### The hardware I/O window

From `0xa000` the address space is memory-mapped devices, and the split between reading and writing
the same address is the first thing to keep straight. Reading `0xa000` returns DIP-switch bank 1
(`DSW1_PORT`, [code]); writing it kicks the watchdog. The two DIP banks and the three input ports are
read through mirror-masked decodes: `0xa080` is IN0 (coin and start lines), `0xa0a0` is IN1 (player 1
— a two-way up/down stick and one fire button), `0xa0c0` is IN2 (player 2, used when the cabinet is
flipped into cocktail orientation), and `0xa0e0` is DSW0 (`DSW0_PORT`, [code]), the coinage bank. All
of the input lines are active-low: an idle port reads all-ones and a pressed control pulls its bit to
zero, which is why the interrupt handler complements every sample the moment it reads it.

Writing into the window drives three kinds of device. `0xa100` latches a one-byte command to the
audio subsystem (`SOUND_COMMAND_LATCH`, [seen]); the audio side is pulsed by a strobe on the control
latch (`AUDIO_IRQ_LATCH` = mainlatch bit 1, [seen]). The remaining outputs are the eight bits of an
addressed latch, `0xa180`-`0xa187`, where the address itself carries the bit index (address AND 7)
and only the low bit of the written value lands. Bit 0 is the vblank-interrupt enable
(`NMI_ENABLE_LATCH`, `0xa180`, [code]); bit 7 is the flip-screen line (`FLIP_SCREEN_LATCH`, `0xa187`,
[code]) and is inverted, so a stored zero means the normal upright orientation. The middle bits carry
the audio interrupt trigger, an audio-mute line, the two physical coin counters (bit 3 is
`COIN1_COUNTER_LATCH`, `0xa183`, [code]), and an unused payout line. There is no video-enable bit on
this board — the display is always on. The interrupt-enable bit is not a soft flag the program reads
back; it *is* the hardware gate. The interrupt line is only asserted while that bit is set, and the
service routine clears it early — right after saving its registers, before doing any of its work —
which is what stops the interrupt re-entering itself.

### How the game's state is organised in work RAM

The 2KB of work RAM is not a flat scatter of variables; it is laid out as a handful of recognisable
structures, and understanding the machine means understanding those shapes rather than the individual
bytes.

**Top-level state selectors.** A tiny cluster near the base of work RAM steers everything. The master
selector is `MAIN_GAME_STATE` (`0x8805`, [seen]): every vblank the interrupt handler reads it and
dispatches through a five-entry jump table, choosing between the attract, intro, and play top-level
behaviours. Below it, `GAME_ACTIVE_FLAG` (`0x8806`, [seen]) is the in-play gate — set to 1 at the
start of a life and cleared to 0 at game-over — and most of the gameplay handlers return immediately
when it is clear. Within play, `PLAY_STATE_INDEX` (`0x880a`, [seen]) is a second-level selector,
masked to five bits and dispatched through its own table to step the round and intro phases; the
main-loop's own progression uses yet another selector, `MAINLOOP_SUBSTATE_SELECTOR` (`0x8f5c`,
[code], masked to three bits), and the attract sequence sequences through `ATTRACT_SUBSTATE`
(`0x8e51`, [seen]). This is a layered state machine: a coarse selector picks a regime, and finer
selectors within it pick the phase.

**The frame heartbeat and countdowns.** `FRAME_COUNTER` (`0x8a5f`, [seen]) is decremented once every
vblank and free-runs through all 256 values; its low bits phase animation and its zero-crossings gate
periodic checks. Layered on top of it is a large family of purpose-specific down-counters that time
transitions: `PHASE_TIMER` (`0x8808`, [seen]) reloads and drains to time phase changes,
`STAGE_COUNTDOWN` (`0x8901`, [seen]) runs down across a stage, `ENEMY_SPAWN_TIMER` (`0x8d07`, [seen])
gates the spawn sweep and reseeds, `WAVE_HOLD_TIMER` (`0x8f36`, [seen]) holds between attack waves,
and `SCRIPT_FRAME_TIMER` (`0x8e50`, [seen]) paces the attract text script. The recurring idiom is a
cell that decrements while non-zero, returns early until it reaches zero, then fires an action and
reloads.

**The input sample ring.** The three hardware ports are sampled once per vblank, complemented so that
a pressed control reads as a set bit, and stored at `INPUT_PORT0` and the two cells above it
(`0x8810`-`0x8812`, [seen]) — IN0's coin/start bits at `0x8810`, IN1 and IN2 following. Behind those
three current-sample cells the handler keeps the previous frame's copies (at `0x8813` upward), shifted
along each vblank, so the game can detect the *edge* of a press — the frame a button first goes down —
rather than just its level.

**The screen-fill cursor.** Clearing and repainting the tilemap is done row by row across several
frames, driven by a pair of cells: `TILE_FILL_PTR` (`0x880b`, [seen]) is a 16-bit video-RAM write
cursor advanced one tile-row (`0x20`) each pass, and `FILL_ROW_COUNTER` (`0x8809`, [seen]) is the
row count seeded to `0x20` and drained to zero, at which point the fill is complete and the state
advances. This is why a screen transition takes a visible moment: it is metered a row per frame.

**Credit, players, scores, and the banking model.** `CREDIT_COUNT` (`0x8802`, [seen]) is a BCD credit
tally: a coin adds one, a one-player start consumes one, a two-player start consumes two. Which
player is currently live is `ACTIVE_PLAYER` (`0x880d`, [seen]), and whether the game is a two-player
game at all is `TWO_PLAYER_FLAG` (`0x880e`, [seen]). Each player's live score accumulates in its own
three-byte BCD buffer — `P1_SCORE_BCD` (`0x88a2`, [seen]) and `P2_SCORE_BCD` (`0x88a5`, [seen]) — and
the active buffer is chosen off `ACTIVE_PLAYER` before every score update. The high score is a
three-byte BCD value with its most-significant byte at `HIGH_SCORE_BCD_HI` (`0x88aa`, [seen]); a new
score is compared against it most-significant-byte first and copied down if it wins. The full
ten-entry high-score table lives at `HIGH_SCORE_TABLE` (`0x8a00`, [code]), three bytes per entry,
insert-sorted on game-over.

The most important structural idea in the whole state model is the *player banking*. There is one
*live* working page of per-player state at `0x8900`, and two saved banks — `PLAYER0_STATE_BANK`
(`0x8940`, [seen]) and `PLAYER1_STATE_BANK` (`0x8980`, [seen]), each a `0x3f`-byte block. On a player
change the live page is block-copied out to the departing player's bank and the arriving player's
bank block-copied in, so a single set of gameplay routines can operate on `0x8900` without ever
knowing which player they serve. The two players' remaining-life counts sit inside those banks at
`PLAYER0_LIVES` (`0x8948`, [seen]) and `PLAYER1_LIVES` (`0x8988`, [seen]), each seeded from the lives
DIP value and decremented on death; when a player's count reaches zero it gates the player switch and
eventually game-over. Many of the per-round cells in the `0x8900` page — `SPEED_INDEX` (`0x8900`,
[seen]), `SPAWN_PHASE_COUNTER` (`0x8902`, [seen]), `WAVE_ARRIVAL_COUNTER` (`0x8903`, [seen]),
`ROUND_IN_PROGRESS` (`0x8904`, [seen]), `ROUND_COUNTER` (`0x8907`, [seen]), `GAUGE_PHASE_COUNTER`
(`0x8908`, [seen]) — are exactly the state that travels with a player across the swap.

**Configuration decoded once at boot.** Several cells are not live state at all but DIP-switch fields
decoded a single time during boot and read thereafter. The lives count is `LIVES_DSW` (`0x8807`,
[code]); the bonus/extra-life award schedule is selected by `BONUS_AWARD_DSW` (`0x8800`, [code]); the
difficulty tier is `DIFFICULTY_DSW` (`0x8820`, [code], a three-bit value that scales spawn schedules);
the cabinet/cocktail choice is `CABINET_MODE_FLAG` (`0x880f`, [code]); demo sound enable is
`DEMO_SOUNDS_DSW` (`0x8821`, [code]); and the two coin slots' coinage nibbles are decoded via a ROM
table into `COINAGE_CONFIG` (`0x882c`, [seen]) and `COINAGE_CONFIG_SLOT2` (`0x882f`, [code]), where a
value of `0x0f` means free play. Sitting alongside these is `FLIP_SCREEN_FLAG` (`0x881f`, [seen]),
the orientation state the interrupt handler copies out to the hardware flip-screen line at the end of
every frame.

**The actor arena and object tables.** Live moving things are held in fixed-stride record arrays. The
main one is `ACTOR_TABLE` (`0x8a80`, [seen]), a run of `0x18`-byte records zero-filled at board init,
whose slot 0 is the player/lead actor: the player's vertical position is `PLAYER_Y` (`0x8a84`, [seen])
inside that slot, the joystick-derived aim state is `PLAYER_AIM_FLAGS` (`0x8a87`, [code]), and the
lead actor's own phase — driving a six-way dispatch — is `LEAD_ACTOR_STATE` (`0x8a82`, [seen]).
Parallel `0x18`-stride pools hold the other kinds of object: enemies at `ENEMY_ACTOR_TABLE`
(`0x8ae0`, [seen]), a secondary object pool at `SPRITE_OBJECT_TABLE` (`0x8b70`, [seen]), projectiles
at `PROJECTILE_TABLE` (`0x8be8`, [seen]), formation objects at `FORMATION_TABLE` (`0x8c30`, [seen]),
and spawned objects at `SPAWN_OBJECT_TABLE` (`0x8c48`, [seen]). Each pool is scanned for a free slot
(marked by a byte-0 active flag) when something needs to be spawned. `ACTIVE_ENEMY_COUNT` (`0x8d40`,
[seen]) tracks how many enemies are live.

**The sprite display list.** The abstract actor records are turned into concrete hardware sprites
through `SPRITE_DISPLAY_LIST` (`0x8840`, [seen]), a 24-entry list of four-byte entries that is rebuilt
every frame from the object records and, on a flipped screen, mirrored. Its sub-regions are named for
the way the drivers sweep them — `SPRITE_ACTOR_RECORD_SLOTS` (`0x8848`, [seen]) and
`SPRITE_TARGET_SLOTS` (`0x887c`, [seen]) — and the whole thing is the bridge between game state and
the two sprite banks the video hardware reads.

**The display-command ring.** The game does not write the tilemap from its per-frame logic directly.
Instead it enqueues two-byte display commands into a ring buffer, `DISPLAY_CMD_RING_BUFFER`
(`0x88c0`-`0x88ff`, [code]), a set of 32 two-byte slots that boot fills with `0xff` to mark them
empty. A write pointer, `DISPLAY_CMD_RING_WRITE_PTR` (`0x88a0`, [code]), advances by two per enqueue,
and a read cursor, `DISPLAY_CMD_RING_READ_PTR` (`0x88a1`, [code]), is where the foreground loop pulls
commands back out to actually paint the screen. This producer/consumer split is central to how the
frame is structured (below). A companion pair of pointers, `DISPLAY_LIST_SRC_PTR` / `DISPLAY_LIST_DST_PTR`,
drives a separate layout-copy interpreter.

**The sound-command ring.** Audio is queued the same way. `SOUND_RING_BUFFER` (`0x8a43`, [code]) is a
ring of command slots with its own write and read pointers, `SOUND_RING_WRITE_PTR` (`0x8a40`, [code])
and `SOUND_RING_READ_PTR` (`0x8a41`, [code]); a consumer drains a slot, frees it, and hands the byte
out to the audio hardware latch at `0xa100`.

**Anti-tamper cells.** A scattering of otherwise-inert cells — `TAMPER_FREEZE_FLAG` (`0x881e`,
[code]), `BOARD_CLEAR_FLAG`'s neighbours the `TAMPER_STRIKES_*` counters, `TAMPER_OBJECT_FREEZE_FLAG`
(`0x89fb`, [code]) — are bumped only by ROM checksum and signature guards. In normal play they stay
zero; when set they freeze spawns, abort actor updates, and divert handlers to a reset path.

### The per-frame dispatch model

All of this state is animated by two cooperating flows of control, and the split between them is what
ties the state cells to the passage of frames.

Boot (`loc_0092`, [code]) runs once at power-on: it self-tests the program ROM, sets the stack pointer
to `0x9000`, clears and initialises all the RAM structures — the actor arena, the display and sound
rings (filled with `0xff`), the DIP-decoded configuration cells — and then hands control to the main
loop, from which the machine never returns.

The vblank interrupt is the game's heartbeat. It is the only thing tied to real time on this board:
the main loop free-runs with no cycle-counting wait, so the frame boundary is defined by the interrupt
firing rather than by any busy-loop. The service routine saves the entire register file, clears its
own enable bit at the latch so it cannot re-enter, copies the sprite display list into the two
hardware sprite banks (the per-frame sprite DMA), samples and complements the three input ports into
the edge-detect ring, decrements the free-running frame counter at `0x8a5f` (and a per-frame worker
control byte at `0x883f`), and then does the frame's real work by
dispatching on `MAIN_GAME_STATE` (`0x8805`) through a five-entry jump table — attract, intro, or one
of the play states. The dispatched handler is where the per-frame game logic lives: it steps the
actors, runs the state machines, updates scores and timers, and *enqueues* the display and sound
commands its work implies. When it returns, the epilogue copies `FLIP_SCREEN_FLAG` out to the hardware
flip line, restores every register, re-arms the interrupt enable bit, and returns to whatever the main
loop was doing.

The foreground main loop (`mainLoop`, [code]) is the consumer. Each pass it either services one
command from the display ring — reading it at the read cursor and painting the corresponding tiles
into video memory — or, once the ring is empty, runs the per-frame scroll worker and
idles. The interrupt does write video memory directly once a frame — the sprite DMA at the top of the
service routine copies the display list straight into the two hardware sprite banks — but its
*tilemap* drawing it drops into the ring rather than painting itself. Because of that, and because the
foreground drains that ring to completion within the frame, the two never fight over video memory:
they touch different regions (the interrupt's direct writes land in sprite RAM, the ring-driven writes
in the tilemap planes), the interrupt produces a batch of drawing commands, the main loop applies
them, and the point where the ring goes empty and the worker idles *is* the frame boundary.

The overall shape, then, is three tiers of dispatch driven off state cells. The vblank interrupt
selects a top-level regime on `MAIN_GAME_STATE`; within play, that handler selects a phase on
`PLAY_STATE_INDEX` (and the main loop its own step on `MAINLOOP_SUBSTATE_SELECTOR`); and within a
phase, per-record sweeps walk the actor and object tables running each record through its own
per-actor state byte. State lives in named work-RAM cells, the interrupt reads those cells to decide
what to do and writes back both new state and a queue of drawing commands, and the foreground loop
turns that queue into pixels — one full turn of the cycle per vblank.

## The frame loop and the vblank heartbeat

Everything the machine does is organised around a single fact of the hardware: the video
circuit raises a vblank interrupt once per displayed frame, and that interrupt is the only
clock the game keeps. All of the per-frame bookkeeping — reading the controls, ageing the
counters, advancing whichever part of the game is currently live — happens inside the vblank
service routine, and it happens exactly once per frame because the interrupt arrives exactly
once per frame. Between two interrupts the processor has nothing to advance; it just keeps the
picture fed. Understanding the machine means seeing those two halves — the idle loop that feeds
the screen, and the heartbeat interrupt that moves the game forward — and how the boot path
brings them both to life.

### Reset and boot

At power-on the processor jumps to the reset vector `loc_0000` [code]. Its very first act is
defensive: it clears the vblank-enable latch (`NMI_ENABLE_LATCH`, the LS259 bit-0 line at
0xa180 [code]) so that no interrupt can fire while memory is still uninitialised. With the
heartbeat safely masked it hands straight to the boot entry `loc_0092` [code], which runs the
program-memory self-test and then lays down the entire initial machine state — clearing work
RAM and video RAM, reading the DIP-switch banks, seeding the coinage tables, priming the
display- and sound-command rings, and parking the flip-screen latch (`FLIP_SCREEN_LATCH`, LS259
bit 7 at 0xa187 [code]) to the upright orientation. After the bulk of that state is laid down the
boot re-arms the heartbeat, writing 1 back to `NMI_ENABLE_LATCH`, so the reset-time mask leaves
no lasting mark; a small tail of state-seeding still runs with the interrupt already live. Boot
then falls into the main loop and never returns; from that point on the machine only ever leaves
the loop by way of the interrupt.

### The main loop: draining the display ring

The main loop, `mainLoop` [code], is a tight, stateless spine whose whole job is to empty the
display-command ring into the picture. The ring lives in page 0x88; producers elsewhere in the
game append two-byte commands to it through the write pointer `DISPLAY_CMD_RING_WRITE_PTR`
(0x88a0 [code]), and the loop consumes them through the read cursor
`DISPLAY_CMD_RING_READ_PTR` (0x88a1 [code]), which walks the slot range 0xc0..0xff and wraps
back to 0xc0 at the top.

Each pass, the loop reads the slot the cursor points at and inspects its high bit. A slot with
the high bit clear is a real queued command: the loop frees the slot (and the argument byte that
follows it) by marking them empty, advances the cursor past them, uses the command code to pick
an entry from the dispatch table at 0x0242, and jumps to that handler, which paints its piece of
the display and returns to the top of the loop for the next slot. A slot with the high bit set is
not a command at all — an emptied slot reads back as 0xff, whose top bit is set, so the moment the
cursor reaches an unused slot the loop instead runs the per-frame scroll worker `loc_0254`
[code], which repaints the scrolling tile columns (and, when the worker-control byte
`WORKER_CONTROL_BYTE` at 0x883f [code] calls for it, folds in the program-signature check). That
"ring is empty, run the worker" pass is the loop's resting state: once the frame's commands are
drained, the loop simply keeps re-running the worker, doing no game logic at all, until the
interrupt preempts it. This is the sense in which the processor idles until vblank.

### The vblank NMI: the once-per-frame heartbeat

When the beam reaches vblank the interrupt fires and the processor vectors to `loc_0066`, which
is nothing but a jump onto the real service routine `loc_066d` — the heartbeat proper. That
routine begins by saving the complete register file, the main set, the shadow set, and both
index registers, so the interrupted main loop can be resumed byte-for-byte afterwards. It then
masks its own line (`NMI_ENABLE_LATCH` <- 0) so a second interrupt cannot re-enter it mid-frame.

With the machine frozen around it, the heartbeat does the fixed per-frame work in order. It
copies the sprite display list into the sprite hardware banks — a per-frame sprite refresh,
running four record groups when the in-play sub-state `PLAY_STATE_INDEX` (0x880a [seen]) equals 4
and a single group otherwise — and kicks the hardware watchdog (the write side of 0xa000) so the
board does not reset out from under it. It then refreshes the controls: it ages last frame's samples
down the input ring that begins at `INPUT_PORT0` (0x8810 [seen]) and writes this frame's fresh
readings into the head, taking each of the three hardware ports — IN0 at 0xa080, IN1
(`IN1_PORT`, 0xa0a0 [code]) and IN2 (`IN2_PORT`, 0xa0c0 [code]) — and complementing it, because
the ports are active-low. Keeping this frame's and last frame's samples side by side is what lets
the rest of the game detect the *edge* of a coin insert or a start press rather than a level.

Next the heartbeat ticks its counters. It decrements the worker-control byte
`WORKER_CONTROL_BYTE` (0x883f [code]), whose bits gate the scroll worker's optional passes, and
it decrements the free-running `FRAME_COUNTER` (0x8a5f [seen]) — the machine's master phase
clock, whose low bits pace animation and whose zero-crossings trigger the periodic integrity
checks. It then runs the coin and credit accounting pass (`loc_59e8`) and drains one entry from
the sound-command ring out to the audio processor (`loc_0e64` [code]).

### State dispatch inside the heartbeat

Only after all of that fixed work does the heartbeat decide what the game itself should do this
frame. It reads the top-level game-state selector `MAIN_GAME_STATE` (0x8805 [seen]) and uses it
to index a five-entry jump table, transferring control to the one handler that matches the
current state — the attract screens, the round intro, or live play. That single selector is the
hinge the whole game turns on: advancing the machine from attract to play to game-over is, at
this level, just a matter of a handler writing a new value into `MAIN_GAME_STATE`, and the next
heartbeat routing to a different arm. The chosen handler does its frame of work and returns into
the routine's tail.

The tail is the symmetric close of the prologue. It copies the orientation flag
`FLIP_SCREEN_FLAG` (0x881f [seen]) into the flip-screen latch `FLIP_SCREEN_LATCH` (0xa187 bit 7
[code]), so a change of orientation takes effect at a clean frame boundary; it restores every
saved register; it re-arms the interrupt (`NMI_ENABLE_LATCH` <- 1); and it returns to the exact
point in the main loop it interrupted. The loop resumes draining the ring, none the wiser, until
the next vblank — and that steady alternation, an idle display-feeding loop punctuated once per
frame by a state-advancing interrupt, is the entire timing skeleton of the machine.

## Configuration, coinage and players

Everything the operator sets with the two DIP-switch banks, everything the player does with
coins and start buttons, and the machinery that keeps two players' games apart all flow from a
small cluster of work-RAM cells seeded once at power-on and then serviced every vblank. This
section follows that chain: how the switches are read and cached, how the cabinet decides which
way is up, how coins turn into credits and credits into a running game, and how the two players'
scores and lives are banked and swapped.

### Reading the DIP switches at power-on

The boot routine `loc_0092` reads the two hardware DIP ports exactly once and decodes them into
plain work-RAM cells that the rest of the game consults thereafter; the ports themselves are never
polled again for configuration. Both banks read active-low, so the boot complements bank 1
(`DSW1_PORT`, [code]) before pulling fields out of it a bit at a time.

Bank 1 carries five settings. Rotating the complemented byte and masking one bit at a time, the
boot lands the cabinet-type bit in `CABINET_MODE_FLAG` ([code], DSW1 bit 2), the bonus-award
selector in `BONUS_AWARD_DSW` ([code], bit 3), the three-bit difficulty field in `DIFFICULTY_DSW`
([code], bits 4-6), and the demo-sound enable in `DEMO_SOUNDS_DSW` ([code], bit 7). The two low
bits choose the starting life count: the boot reads them directly and stores the result in
`LIVES_DSW` ([code]) as an actual life total — three, four, or five for the ordinary settings, and
the sentinel 0xff for the fourth (free-life) position rather than a raw switch value.

Bank 0 (`DSW0_PORT`, [code]) is split into two coinage nibbles. Each nibble indexes the ROM
coinage table `COINAGE_TABLE` ([code], base 0x0053), and the looked-up byte is cached: the high
nibble's result in `COINAGE_CONFIG_SLOT2` ([code], the second coin slot) and the low nibble's in
`COINAGE_CONFIG` ([seen], the first coin slot). A cached value of 0x0f means that slot is set to
free play, a distinction the credit logic keys on constantly.

The same boot pass also arms the interrupt and screen hardware that everything else depends on: it
writes `NMI_ENABLE_LATCH` ([code], LS259 bit 0) to enable the per-frame vblank interrupt and seeds
both the flip-screen flag and its latch to the upright value (below), then lays down the default
high-score table and hands off to the running main loop.

### Cabinet orientation

Pooyan is a vertical game mounted at MAME ROT90. Its runtime flip control is a single work-RAM
byte, `FLIP_SCREEN_FLAG` ([seen]), whose value the vblank service `loc_066d` copies into the
LS259 flip latch `FLIP_SCREEN_LATCH` ([code], bit 7) on every frame, so the hardware orientation
always tracks that one cell. The boot seeds both the cell and the latch to 1, meaning upright; a
non-zero flag is the normal, un-mirrored screen.

The flag does double duty as a software mirror gate. `loc_0320`, run as part of the per-frame
sprite work, decrements a caller's frame counter and then — only when `FLIP_SCREEN_FLAG` has
reached zero — mirrors the whole sprite display list vertically through `mirrorSpriteListVertically`.
So a zero flag flips both the hardware latch and the sprite geometry together, keeping the picture
consistent when the screen is turned over.

What turns the flag over is the cocktail cabinet. `CABINET_MODE_FLAG` distinguishes an upright
cabinet from a cocktail one, and the round-init handler `loc_1601` is the only place that acts on
it. On the first entry of a two-player round it enqueues the player-select banner matching the
active player — one banner code for player one's turn, the next for player two's — and it does this
on every two-player first entry, regardless of cabinet type. The flip is what the cocktail bit
gates: only when the cabinet is cocktail does the same block also set `FLIP_SCREEN_FLAG` from the
active player, leaving it non-zero (upright) for player one's turn and driving it to zero (flipped)
for player two's turn. An upright cabinet never touches the flag after boot, so it stays upright for
both players.

### Coinage: turning coins into credits

Coin acceptance runs inside the vblank service, which each frame samples the three hardware input
ports, complements them, and stores them at the head of a short edge-detect history — the coin and
start bits live in `INPUT_PORT0` ([seen], the inverted IN0 sample: coin slot 1 in bit 0, coin slot
2 in bit 1, service in bit 2, one-player start in bit 3, two-player start in bit 4). The player
control ports `IN1_PORT` ([code]) and `IN2_PORT` ([code]) are sampled alongside it, the latter
standing in for player two on a flipped cocktail screen.

The credit accounting itself is `loc_59e8`, called once per frame. It first checks both coinage
caches: if either `COINAGE_CONFIG` or `COINAGE_CONFIG_SLOT2` reads 0x0f (free play) it returns
immediately and does no coin counting at all. Otherwise it runs three near-identical edge
detectors, one per coin input, that share a common credit-award tail:

- The service input (`loc_5a06`, INPUT_PORT0 bit 2) debounces through the ring byte `DRIP_RING_A`
  ([code]); on a clean rising edge it simply awards one credit.
- Coin slot 1 (`loc_5a56`, bit 0) debounces through its own ring, bumps the physical coin-counter
  queue, and drives a coinage accumulator that lives in the cell `TAMPER_ROM_CHECK_FLAG` ([code],
  0x882b — a byte this coin path reuses as its slot-1 accumulator) against the threshold encoded in
  `COINAGE_CONFIG`.
- Coin slot 2 (`loc_5a1f`, bit 1) is the same shape with its own ring, its own counter queue, and
  its accumulator measured against `COINAGE_CONFIG_SLOT2`.

Each detector shifts the freshly complemented input bit into an eight-bit ring and fires only when
the ring's low three bits settle to a single set bit, which is how a genuine press is distinguished
from noise or a held coin. On a real coin, the slot advances its accumulator by a fixed step and
compares it to the cached coinage byte; once the accumulator satisfies the configured coins-per-group,
the shared tail adds the configured number of credits to `CREDIT_COUNT` ([seen]) — the BCD credit
total, clamped at 99 — and queues a coin-insert sound and a display refresh. The service button
skips the accumulator entirely and credits directly. `CREDIT_COUNT` is drawn on the HUD as two
digit tiles.

### The physical coin counters

Awarding a credit is separate from ticking the electromechanical coin meter. When a coin slot
accepts, it increments a queued-pulse count (`COIN1_PULSE_COUNT`, [code], for slot 1, with a
sibling cell for slot 2). Once per frame `loc_5a9c` (and its twin `loc_5ac0` for the second meter)
turns that queue into a clean output pulse on the coin-counter latch line `COIN1_COUNTER_LATCH`
([code], LS259 bit 3; the second meter drives bit 4). The generator is a small phase machine: with
a pulse queued and no phase running it seeds the phase timer `COIN1_PULSE_PHASE` ([code]) to 0x30
and raises the latch; while the phase counts down it drops the latch at the mid-point 0x18; and when
the phase reaches zero it consumes one entry from the queue. The result is a fixed-width strobe per
accepted coin regardless of how the credit math resolved.

### Starting a game

How a start button is honoured depends on the coinage mode. In a pay cabinet the attract-state
logic gates on `CREDIT_COUNT`: with no credit banked, pressing start does nothing; with a credit
present it advances the top-level game state so the coin-mode handler can process the press. That
handler reads the start bits out of `INPUT_PORT0` and consumes credits accordingly — one-player
start (`loc_0de4`) requires at least one credit, decrements `CREDIT_COUNT` by one, and begins the
game with the active-player word cleared; two-player start (`loc_0d78`) requires at least two
credits, subtracts two, and begins with the two-player word set. In a free-play cabinet the credit
gate is bypassed and the start bits build the game screen directly.

Both paths converge on the start-of-game setup `loc_0dab`, which is where a coin session becomes a
running game. It writes the sixteen-bit player word so that the low byte seeds `ACTIVE_PLAYER`
([seen], 0 = player one's banks) and the high byte seeds `TWO_PLAYER_FLAG` ([seen], non-zero for a
two-player game). It then clears the play sub-state `PLAY_STATE_INDEX` ([seen]), sets the top-level
state `MAIN_GAME_STATE` ([seen]) to its play value and the in-play gate `GAME_ACTIVE_FLAG` ([seen])
to 1, restores the upright flip flag, fires the start jingles, and calls the new-board reset
`loc_0e00` to seed the player banks. For a two-player start it additionally fires the second-player
cue and clears an extra state block.

### Per-player score and lives banks

Two players share one live playfield, so each player keeps a saved copy of everything and the two
copies are swapped in and out around a turn. The new-board reset `loc_0e00` seeds both saved banks
identically at game start: it copies `LIVES_DSW` into both `PLAYER0_LIVES` ([seen]) and
`PLAYER1_LIVES` ([seen]), writes a fixed opening X and the difficulty-derived sprite colour into the
tops of both `PLAYER0_STATE_BANK` ([seen]) and `PLAYER1_STATE_BANK` ([seen]), and arms the tile
fill. So both players start with the same life count, the same entry position, and the same look.

During play the two banks track two things per player: the live actor/state page and the running
score. `ACTIVE_PLAYER` is the selector that binds every per-player access to the right copy. Its bit
0 chooses which score buffer is live — `P1_SCORE_BCD` ([seen], the three-byte packed-BCD score at
0x88a2) or `P2_SCORE_BCD` ([seen], at 0x88a5) — the choice made by `selectActivePlayerScoreBuffer`,
which hands back the active buffer's address in DE while preserving the caller's A and flags. The same selector picks
between the two life counters and between the two saved state banks.

The bank swap is carried by three routines. `saveLiveStateToPlayerBank` copies the 0x3f-byte live
state page (based at `SPEED_INDEX`, [seen]) into whichever saved bank `ACTIVE_PLAYER` names, then
clears the play sub-state. Coming the other way, the round-init handler `loc_1601` restores the
active player's saved bank back into the live page at the start of each round. And on the specific
event of player one dying with player two still in the game, `saveLivePageToPlayer0Bank` first
latches `ACTIVE_PLAYER` to player two (when `TWO_PLAYER_FLAG` is set and `PLAYER1_LIVES` is still
non-zero) and then snapshots the live page into player zero's bank — the moment that hands the turn
over. Player alternation is therefore not a scheduler but a consequence of these save/restore points
keyed on `ACTIVE_PLAYER`, `TWO_PLAYER_FLAG`, and each player's life counter.

Lives themselves are the gate on continuing: each player's counter drains one per death and, when it
hits zero, drives the player-switch or game-over decision. `PLAYER1_LIVES` additionally feeds an
integrity check that only makes sense at counts of four or more, i.e. under the higher life
settings. Several per-frame routines that render or scroll the two score columns also fork on
`TWO_PLAYER_FLAG` and `ACTIVE_PLAYER` — for example the scroll-column worker `loc_0254` paints a
different column layout in a two-player game, and the reset scan `loc_2b59` routes its
end-of-checksum hand-off by the two-player and active-player flags — so the two-player state is
visible throughout the display path, not just at the start and swap.

### Bonus-life award schedule

The bonus/extra-award schedule is configured by `BONUS_AWARD_DSW` and metered by `loc_18da`, which
runs against a single queued threshold in `AWARD_QUEUE` ([code]). When the queue reads zero it is
reloaded from the DSW-selected base — one value when `BONUS_AWARD_DSW` is clear and a smaller one
when it is set — and the routine returns. When the queue holds a threshold, it is compared against
the most-significant BCD byte of the active player's score buffer (selected by `ACTIVE_PLAYER` bit 0,
exactly as elsewhere); once the score reaches it, the routine bumps a saturating award tally, adds
the DSW-selected BCD step (again one of two values chosen by `BONUS_AWARD_DSW`) onto the threshold so
the next award is scheduled higher, and runs its award sub-handlers. The award cadence is thus fully
determined by the one configuration bit, applied per active player against that player's own score.

### Difficulty and demo sounds

Two more boot-decoded cells shape play rather than money. `DIFFICULTY_DSW` is a three-bit level that
scales the enemy spawn and threshold tables — it is the config input to the spawn scheduler,
consulted (often as an index, sometimes combined with the round number) by the routines that decide
how aggressively enemies appear — and it is also the source of the sprite colour seeded into both
player banks at reset. `DEMO_SOUNDS_DSW` enables attract-mode sound; its low bit gates whether queued
sound commands are actually dispatched while the game sits idle. Both are read-only after boot: like
the coinage and life settings, they are latched once from the DIP ports and then simply consulted.

## In-play progression and timers

Once a game is running, the top-level frame selector reads `MAIN_GAME_STATE` [seen] and hands the
frame to the play state, `loc_159b`. That routine does two things before anything else happens on
screen: it ticks the active player's on-screen clock through `loc_7912`, then drops into `loc_15a1`,
the dispatcher for a second, finer state machine that carries a round from its opening setup, through
live play, and out again into the teardown that either starts the next round or ends the turn. The
whole of in-play progression is organised around that inner machine and the two families of counters
it drives — the `0x8900` round-progression bank and the per-player lives/state banks — while a small
set of frame-counted timers pace both.

### The play sub-state machine

The inner machine's program counter is a single byte, `PLAY_STATE_INDEX` [seen]. `loc_15a1` masks it
to its low five bits and uses the result to index the nineteen-entry jump table that begins at
`0x15a8`, transferring to the handler stored there. Each handler is a slice of round work; when its
slice is finished it writes the *next* index back into `PLAY_STATE_INDEX`, so the following frame
lands on the following handler. Control is never lost: the selected handler returns into `loc_159b`'s
own post-table continuation, which returns on out to the frame epilogue, so exactly one handler runs
per frame and the machine always comes back for the next.

The index behaves as a cursor threaded through the life of a round rather than a flat menu. It opens
at the round-init handler `loc_1601` [code] (index 0), which will not proceed until the row-by-row
tilemap fill has drained; once it has, `loc_1601` clears the round's scratch cells, restores the
active player's saved page into the live state page, seeds the phase timer, and bumps the index to 1.
Index 1 is the phase-timer waiter `loc_16b7`: it decrements the phase timer and returns while it is
still running, performing its per-phase setup and advancing the index only on the frame the timer
expires. The setup handlers that follow — `loc_175d` (index 2), `loc_17c1` (index 3), `loc_18af`
(index 4) among them — each choose a *specific* successor index from the current field and round
state (arming, for instance, `0x0d`, `0x12`, or `0x0f`, or forcing the index back to 3), so the path
through the machine forks on what kind of round is being built. The live-play frame driver sits at
index 13, `loc_1c53` [code], which splits its per-frame work on the low bit of the round counter and
then rebuilds the sprite list. Two closely related handlers, `loc_1b43` [code] (index 8) and
`loc_1b8c` [code] (index 9), each latch the index to `0x0c` and re-arm the phase timer (to zero and to
`0x60` respectively) after ticking the tilemap clear and running the shared integrity/timer handler.

Round advance is handled at index 6 by `loc_1a01`, which bumps the round counter and resets the
spawn-phase and rope-draw counters (via `loc_2527`), then — on the committing branch — falls straight into the live-page save that
zeroes `PLAY_STATE_INDEX`. A zeroed index sends the next frame back to `loc_1601`, closing the loop:
save the finished round's live page, reset the cursor, and re-open at round-init for the next round.
The turn-ending handlers at indices 10 and 11, `saveLivePageToPlayer0Bank` [code] and `loc_1bcc`
[code], do the same reset to zero after snapshotting the live page into a player's bank, so a death or
turn hand-off also rewinds the cursor to round-init.

### Pacing the machine: the phase timer

`PHASE_TIMER` [seen] is the machine's stopwatch. It is a plain per-frame countdown, and only the
index-1 waiter `loc_16b7` draws it down — decrement, and return immediately while it is non-zero, so
the handler's real work fires on a single frame once the count reaches zero. Every other handler that
needs the machine to dwell simply reloads the timer and lets index 1 spend it: `loc_1601` seeds it to
`0x02` for a single-player round or to `0x80` on the first entry of a two-player round, `loc_1b8c` reloads it to
`0x60`, `loc_1b43` clears it, and the screen re-init `loc_67df` [code] seeds it to 1. Because the
reload value sets how many frames index 1 idles before advancing, the phase timer is how the machine
turns "wait here for a beat" into a concrete frame budget between transitions.

### The round-progression bank at 0x8900

A contiguous run of cells starting at `0x8900` tracks how far a game has progressed and how hard it
has become. `SPEED_INDEX` [seen] holds the enemy speed/difficulty value; `loc_191c` [code] computes
it for each fresh target group from the difficulty switch plus the round counter — halved and added to
the wave-arrival count on even rounds, taken whole on odd rounds — and clamps it below `0x20`, so it
escalates as rounds accumulate. `ROUND_COUNTER` [seen] is the coarse progression clock: `loc_1a01`
bumps it at round advance, and its low bit is read all over in-play code as a phase selector — the
frame-parity split in `loc_1c53`, the field-colour source choice in `loc_1dd3`, and the gate on the
deferred-object promoter `loc_6b3b` [code] all key off it. `SPAWN_PHASE_COUNTER` [seen] cycles up to
seven picking spawn/fire variants and is reseeded to four at the cap by `loc_2527` [code], while
`WAVE_ARRIVAL_COUNTER` [seen] counts arrivals within a stage and feeds both the speed value above and
the rope-segment count. `STAGE_COUNTDOWN` [seen] acts as a busy gate — `loc_191c` refuses to pick a
new group while it is non-zero — and `ROUND_IN_PROGRESS` [seen] is raised to 1 by the screen re-init
`loc_67df` and read as a field-variant selector by `loc_1dd3`. The teardown helper
`clearActorArenaAndCounters` [code] zeroes the spawn, wave, and rope counters together and forces the
sub-state index to 6, resetting those three counters between phases.

Note that `0x8900` does double duty: it is the base byte of the live actor/state page as well as the
speed-index cell. The board reset `loc_0e00` [code] clears `0xbf` bytes from `0x8900`, and every
bank copy uses `0x8900` as the `0x3f`-byte page base — so `SPEED_INDEX` is literally byte 0 of the
live page, written with the escalating speed value by `loc_191c` during play and carried in and out
of the saved banks with the rest of the page.

### Per-player lives and state banks

Each player owns a saved `0x3f`-byte block: player 0's at `PLAYER0_STATE_BANK` [seen] and player 1's
at `PLAYER1_STATE_BANK` [seen], with that player's remaining lives held at offset +8 —
`PLAYER0_LIVES` [seen] and `PLAYER1_LIVES` [seen]. Only one player is live at a time; the working copy
is the page at `0x8900`, and `ACTIVE_PLAYER` [seen] selects whose bank it mirrors. `loc_0e00` seeds a
new game by clearing the live page and writing both banks from the cabinet switches — the lives from
the lives switch into each +8 slot, a fixed opening X into +1, and byte 0 from the difficulty switch.
From there the banks and the live page trade places around the sub-state machine: at round-init
`loc_1601` copies the active player's bank *into* the live page, and at a death or turn hand-off the
snapshot handlers copy the live page back *out*. `saveLivePageToPlayer0Bank` writes the live page into
player 0's bank (and, in a two-player game whose second player is still alive, latches
`ACTIVE_PLAYER` to 1 first); `loc_1bcc` writes it into player 1's bank (switching back to player 0 when
that player still has lives); and `saveLiveStateToPlayerBank` [code] writes it into whichever bank
`ACTIVE_PLAYER` names. All three clear `PLAY_STATE_INDEX` to zero as their last act, which is what
routes the machine back to round-init for the incoming player or round. The lives counts are the
decisive hand-off signal: whether the *other* player still has lives is what a turn-end handler tests
to decide between switching players and ending the game, and `TWO_PLAYER_FLAG` [seen] gates whether a
second bank is in play at all. `loc_7e6d` [code] additionally reads `PLAYER1_LIVES`, running its guard
work only when that count is four or more.

### The BCD play-timers and their gates

The on-screen clock that `loc_159b` ticks first each frame is a pair of per-player BCD counters,
`PLAY_TIMER_BCD_P1` [code] and `PLAY_TIMER_BCD_P2` [code], each a three-byte structure: a frame
sub-counter in byte 0, the seconds digit in byte 1, and the minutes digit in byte 2. `loc_7912` [code]
advances only the active player's counter, and only while play is genuinely live. It first bails when
`GAME_ACTIVE_FLAG` [seen] is clear, then selects the active player's counter and its gate byte —
`PLAY_TIMER_GATE_P1` [code] for player 0, `PLAY_TIMER_GATE_P2` [code] for player 1 — and bails again if
that gate byte is set, so the gate is how the game freezes one player's clock (both are zeroed at
`loc_0e00`). When it does run, the frame sub-counter rolls at either 59 or 60 frames — the extra frame
chosen by the low bit of the seconds byte, which keeps the tick close to one real second — and on each
roll it BCD-carries the seconds digit and, at sixty seconds, the minutes digit, each digit rolling its
low nibble at `0x0a` and its high nibble at `0x60`.

The clock is drawn by `loc_7960` [code], the shared handler the index-8 and index-9 sub-states invoke.
It renders the active player's minutes and seconds by splitting each BCD byte into its high and low
nibble and stamping them as tiles up a video column at `PLAY_TIMER_DIGIT_VRAM` [code], parted by a
spacer tile, then clears the timer bytes it just drew. Both `loc_7960` and its sibling handlers carry
anti-tamper checksums folded over fixed program blocks — a mismatch would bump a tamper tally or trip a
guard — but with intact program data those paths are never reached, and they sit alongside the timer
and progression work rather than driving it.

## The actor arena

Everything that moves on the Pooyan playfield — the player's lift, the diving eagles, the
projectiles they and the player throw, the hunter formation, the rope segments — lives as a record
in one contiguous region of work RAM and is driven, frame by frame, by a small family of sweep
loops. The records are uniform: `ACTOR_TABLE` [seen] at the base is a `0x18`-byte-stride array whose
slot 0 is the player/lead actor, and the same stride and field layout repeat through the
`ENEMY_ACTOR_TABLE` [seen] sub-array, the `OBJECT_STATE_RECORD_BASE` [code] six-record band (which
runs straight on into `PROJECTILE_TABLE` [seen]), the `SPRITE_OBJECT_TABLE` [seen] pool, the
`SPAWN_OBJECT_TABLE` [seen], the `FORMATION_TABLE` [seen], and the paired enemy/target records
`ENEMY_TARGET_REC0`/`ENEMY_TARGET_REC1` [seen]. Because every record shares a shape, the same
handlers work anywhere in the arena; a driver just supplies a base pointer, a stride, and a count.

The field layout that recurs across all of them: bytes `+0`/`+1` are the presence/id pair (a record
is live when bit 0 of either is set); `+2` is the state byte that selects the record's per-frame
handler; `+3`/`+5` are sub-pixel position fractions paired with the whole coordinates at `+4` (the
vertical axis, e.g. `PLAYER_Y` [seen] for slot 0) and `+6` (the tile column/row); `+7` is a
behaviour-flag byte and `+8` an attribute/commit byte; `+9`/`+0a` hold a signed velocity or facing
and its two's-complement mirror; `+0b` is an arm bit; `+0c`/`+0d` point little-endian at the current
animation sequence with the frame index at `+0e`, the live colour at `+0f` and tile code at `+10`;
`+11` is a frame-delay/dwell timer, `+12` an animation-hold countdown, `+13` a two-bit phase, `+14` a
match tag, and `+16` a script pointer with an armed bit. Every routine in this subsystem is read at
`[code]` confidence — its behaviour is recovered from the frozen bytes, MAME grounding still pending
— so the tags below attach mainly to the RAM cells the routines pivot on.

### The per-frame sweep loops

There is no single "update all actors" routine; instead several drivers each own a table and walk it
once per frame, calling a per-record dispatcher that branches on the record's `+2` state byte. The
dispatchers all share one idea: an inactive record is skipped, and an active record's low state bits
index a fixed handler table, with each handler tail-handing back so control returns straight to the
sweep.

The object band at `OBJECT_STATE_RECORD_BASE` is walked by `loc_76f4`, which steps six records at
stride `0x18` and runs `dispatchActiveObjectState` on each. That dispatcher skips a record with both
presence bits clear, then routes `(state & 3)` to one of four handlers — a spawn-ring step, an
animation tick, a draw step that raises `OBJECT_DRAWN_FLAG` [code], or a fourth phase. A parallel
driver, `loc_6a7f`, handles the same class of descending objects but over eighteen
`ENEMY_ACTOR_TABLE` records: while the `BLINK_PHASE` [code] byte is set it runs `loc_6a98` on each
record (routing `(state-1) & 3` to the descend step `loc_6aa8` or the screen-reinit path
`loc_67df`), and when blink phase is clear at wave index 2 it instead performs a one-shot tilemap
integrity checksum. The enemy actor records also get a low-state sweep from `loc_3377`, which walks
fourteen of them through `loc_338a` — active records whose masked state is below `0x11` are routed
through a shared jump table into the state handler for that index.

The lead actor group is driven by `loc_241e`, which first runs three per-frame sub-passes (the
launch-sequence driver, the marker column, the formation manager), bails if the `TAMPER_FREEZE_FLAG`
[code] is set, and otherwise dispatches slot 0's low three state bits — the value tracked in
`LEAD_ACTOR_STATE` [seen] — through the group handler table. `LEAD_ACTOR_STATE` cycles 0→5 and back,
one entry per handler, as the player's lift works through its phases. The frame-parity driver
`loc_1c53` alternates the whole group update against the spawn-subtree driver on odd versus even
frames, then rebuilds the sprite display list, so half the actor bookkeeping happens on each cadence.

### Animation stepping

An actor's animation is a byte stream: a run of three-byte `{tile, colour, hold}` frame records
terminated and looped by a `0xff` control opcode. Two leaves install a stream into a record —
`setActorAnimation` and `storeActorAnimationPointer` both write the little-endian sequence pointer
into `+0c`/`+0d` and zero the frame index at `+0e`, so the actor restarts its new sequence at frame
0. The workhorse that walks a stream is `loc_4006` (and its IY-based twin `advanceActorAnimFrame`):
`+0e` is a frame-hold counter that simply counts down while the current frame lingers; on expiry the
routine reads the opcode under the `+0c`/`+0d` pointer, and a `0xff` reloads that pointer from the
next two stream bytes (the loop-back) while any other byte is taken as a frame — its tile to `+10`,
colour to `+0f`, new hold to `+0e` — after which the advanced pointer is stored back. This one stepper
is reused throughout the arena; the enemy-record dispatcher `loc_6f2d`, for instance, sends states
below `0x0b` — except state 2, which is special-cased first and tail-jumps to `loc_3536` — straight
into it as the generic "keep animating and moving" mover.

Alongside the per-record streams there is a *shared* animation script, whose read cursor lives in
`ANIM_SCRIPT_CURSOR` [seen]. `loc_22e6` steps one actor against it: while the record's `+0e`
countdown runs it just ticks, and at zero it pulls the next `{tile, colour, delay}` triple from the
shared cursor and advances it, treating a `0xff` lead byte as an inline jump that reloads the cursor
from the two following bytes. (A rival full reset back to `ANIM_SCRIPT_RESET_PTR` [code] is guarded
by a target-presence fold that never reaches its trigger value, so in practice the marker always
resolves as the inline jump.) Records that animate on a slower cadence use `tickActorAnimHold`, which
gates on a per-record animate bit or an even `ROUND_COUNTER` [seen], counts the `+12` hold down, and
on underflow steps the two-bit `+13` phase — re-arming `+16` while phase remains and disarming at
phase end.

A whole band of records is animation-ticked together by the shared walk `loc_7627`: it ticks a count
of `ENEMY_ACTOR_TABLE` records through the per-entry dispatcher `loc_7638`, which selects a tick-state
handler by `(state & 3)` and, crucially, lets states 0 and 1 *abort the whole walk* (state 2 always
continues) — so a record that reports a phase transition stops the sweep, leaving the rest untouched.
Two twin entries seed the count: `loc_7625` runs the walk over eight records and `loc_7621` over
fourteen. The umbrella driver `loc_76ea` ties the frame together — it advances the
`OBJECT_STATE_RECORD_BASE` band via `loc_76f4`, runs the eight-record animation tick via `loc_7625`,
then rebuilds the sprite display list.

Separate from the record streams is the on-screen *tile* animation of the player's lift graphic,
carried in the tilemap cell region rather than a sprite. Its cursor is `TILE_ANIM_CURSOR` [seen] and
its cadence gate is `TILE_ANIM_PARITY` [seen], a counter bumped every call whose bit 0 decides which
of a complementary pair runs this frame. `advanceTileAnimForwardOnOdd` runs on odd parity: it either
animates the current cell's tile code upward, or — once the code reaches the wrap value `0x37` — steps
the cursor forward a cell and reseeds it to `0x34`. `retreatTileAnimScript` is the even-frame half: it
walks the cursor's target byte back down, and when it meets the `0x34` marker it reloads the base tile
`0x10` and backs the cursor up a cell. The two are driven from the lead-actor movement handlers
(`loc_2901`, `loc_2329`, `loc_236a`): as the lift descends, `loc_2901` refreshes the derived sprite
Ys, and unless the cursor is at its hold value, advances the tile-anim script before tailing into the
phase render.

### Spawning

New enemies enter the arena on a timed cadence gated against how crowded the field already is.
`ENEMY_SPAWN_TIMER` [seen] is the master cadence counter: `loc_1171` decrements it every frame while
nonzero, and at zero opens a spawn window only if `STAGE_COUNTDOWN` [seen] exceeds
`ACTIVE_ENEMY_COUNT` [seen] and fewer than six enemies are live. When the window opens it sweeps the
six `ENEMY_ACTOR_TABLE` records and seeds the first free one via `loc_119a`, which stamps the opening
state fields, derives a facing byte (and its negation) and a fresh spawn-timer reload from two
round-indexed byte tables — `SPAWN_FACING_TABLE_1209` [code] and `SPAWN_TIMER_TABLE_11F9` [code] —
arms the record's animation (`ANIM_TABLE_3829` [code]), and bumps `ACTIVE_ENEMY_COUNT`. The
initialiser returns a scan signal: it reports "already active, keep scanning" for a live record and
"seeded, stop" the instant it fills a free one, so exactly one enemy spawns per tick.

`loc_56e8` is the richer variant of the same cadence. Past the timer it splits on round parity: an
even round hands the whole decision to the spawn gate `loc_5871` (seeding the speed index from the
round), and an odd round applies the crowding test — bailing when `STAGE_COUNTDOWN` and
`ACTIVE_ENEMY_COUNT` are equal, when the countdown is below the count, or when the count has reached a
difficulty threshold derived from `SPEED_INDEX` [seen] — before sweeping the six slots and calling the
spawn body `loc_572b` on each. `loc_572b` is the substantial spawn worker: for a free slot it seeds
the record, then *builds a spawn column* — clamping `DIFFICULTY_DSW` [code] to 3, adding a
`SPAWN_COLUMN_BIAS` [code] term that is gated on `GAUGE_PHASE_COUNTER` [seen] reaching `0x04` (a value
above the `3`→`0` range the gauge is ever observed to hold, so — like the `ANIM_SCRIPT_RESET_PTR` fold
above — the bias never actually fires in normal play), applying an early-stage wave shift on even
rounds via `adjustSpawnColumn`, then adding the round number and clamping below the arena width. That
column indexes two byte tables for the new actor's velocity and its `ENEMY_SPAWN_TIMER` reload
(`SPAWN_FIELD_TABLE`/`SPAWN_FIELD_TABLE_ODD` [code] and `SPAWN_TIMER_TABLE_EVEN`/`SPAWN_TIMER_TABLE_ODD`
[code], selected by round parity), arms the animation, bumps the active count, and runs the scan-state
head `loc_57c3` for the newborn.

The spawn gate `loc_5871` latches the incoming value into `SPEED_INDEX`, then launches only when the
active count is strictly below both the stage threshold and the cap of six; on a launch it raises the
active flag at `0x8d4a` (`SPAWN_ACTIVE_FLAG` [code]) and runs the record-init loop `loc_588e`, which
walks six records and initialises each through `loc_572b` until one seeds. `loc_5835` handles a
singleton special actor keyed on that *same* `0x8d4a` cell (`SPECIAL_ACTOR_ACTIVE_FLAG` [code] is just
an alias of it): if the flag is already set the actor exists and `loc_5835` simply steps it, otherwise
it marks the flag, seeds the record's fields, points it at `ANIM_TABLE_3847` [code], and runs an
image-integrity checksum — so it is `loc_5871`'s launch that raises the very flag `loc_5835` later
reads to choose spawn-versus-step. The scan-state head `loc_57c3` and the eagle sub-state stepper `loc_57c6`
form the ongoing per-actor motion machine behind the spawn: `loc_57c3` decrements a phase counter and
either enters the spawn-or-step entry (`loc_5835`) at zero or the stepper otherwise, while `loc_57c6`
walks a three-timer stage sequence (`EAGLE_STAGE_TIMERS` [code], `EAGLE_STEP_COUNTER` [code]),
latching a move direction and speed into the record, and on exhaustion re-arms from one of two
round-selected record tables (`EAGLE_REARM_TABLE_5922`/`EAGLE_REARM_TABLE_5985` [code]).

A second family of spawners seeds actor-block tables from schedule cursors. `loc_54f9` scans a table
for the first free block, reads a kind byte from `ACTOR_SPAWN_TYPE_TABLE` [code] indexed by the low
nibble of `SPAWN_TYPE_CURSOR` [code], stores it into the block's `+17` kind field, and seeds the block
via `loc_5489`. `loc_5544` and `loc_5594` are the tails of two distinct spawn schedulers: `loc_5544`
draws its kind byte from `SPAWN_KIND_TABLE_5647` [code] indexed by `SPAWN_SEQUENCE_INDEX_8D13` [code],
`loc_5594` from `SPAWN_KIND_TABLE_5627` [code] indexed by `SPAWN_SEQUENCE_INDEX_8D14` [code] (and
folds a small anti-tamper self-check into the free-slot path before seeding) — both then hand the
record to `loc_5489` to finish, one block per call. `loc_588e` is the plain run-initialiser used by
the spawn gate, seeding each block through `loc_572b` and stopping at the first fresh one.

Two further sweeps spawn descending waves under a shared frame-delay budget rather than the master
cadence. `loc_6905` decrements `SHARED_FRAME_DELAY_TIMER` [code] each frame, and once it clears —
provided the wave has not fully arrived (`WAVE_NUMBER` [code] versus `WAVE_ARRIVAL_COUNTER` [seen])
and the wave limit is not reached — it walks eight enemy/state record *pairs* and spawns the first
empty pair via `loc_6931`. That per-pair spawn activates both records, seeds their fields, arms the
animation, and on the very first spawn of a wave also queues the wave display commands, paints the
arrival count to the HUD as two BCD digits, and bumps `WAVE_NUMBER`. `loc_6a0f` is the blink-phase
spawner: it idles while `BLINK_PHASE` is clear, while `ANIM_PHASE_TOGGLE_892C` [code] has reached its
gate, or while `BLINK_COUNTDOWN` [code] is still running, then sweeps eighteen `ENEMY_ACTOR_TABLE`
records and spawns the first empty one through `loc_6a35` — which activates the record, arms the
`BLINK_COUNTDOWN`, and picks one of three spawn animation pointers (`ANIM_PARAM_76D4`/`ANIM_PARAM_68EF`/
`ANIM_PARAM_6B0A` [code]) by the pre-bump phase toggle. In every one of these sweeps the per-record
worker returns a boolean — active means keep scanning, spawned means abort — so at most one actor
enters the arena per driver per frame.

### Phase dispatch and the pre-spawn gate

Individual enemy records advance through their behaviour phases under `loc_362d`, gated by a per-actor
delay. The record's `+6` phase byte partitions the work: values below `0x07` route to the end-of-move
guard `loc_361d`, values at or above `0x14` to the target guard `loc_3625`, and the middle band is
delayed. In that band a global progress gate decides who continues: when `WAVE_PROGRESS_COUNTER`
[seen] is at or above `0x0e`, every middle-band phase below `0x13` returns early and only phase `0x13`
proceeds (when the counter is below `0x0e`, every middle-band phase proceeds). A phase that survives
the gate then counts the shared `ACTOR_DELAY_COUNTER` [code] down and the routine returns while it
runs. When the delay elapses and the actor's X is in the near half of the screen, the
delay is reloaded from `DELAY_RELOAD_TABLE_368E` [code] indexed by the low three bits of
`ROUND_COUNTER`, and control falls into the pre-spawn gate `loc_365d`.

`loc_365d` decides whether this actor may seed a child. When the record's `+0b` arm bit is set it
counts how many of the six enemy records sit in the spawn state and bails unless exactly one does;
otherwise it seats the sprite-object scan window and falls into the slot finder `loc_3680`. The two
small guards `loc_3617` and `loc_3625` front the same gate from other reach paths — `loc_3617` tails
into `loc_365d` only while its counter is below `0x20`, and `loc_3625` blocks when the record's `+8`
commit bit is already set, otherwise delegating to the target-tile resolver. `loc_3680` is where a
child is actually born: it scans the target table for the first slot with its presence bit clear, then
bumps the spawn counters — `SLOT_SPAWN_INDEX` [seen], `ACTIVE_LANE_COUNT` [seen], and
`LANE_SPAWN_COUNTDOWN` [seen] are all touched only when the template's `+7` bit 2 is armed (the lane
pair additionally requires lanes remaining) — always steps `ANIM_FRAME_COUNTER` [seen] (skipping zero
on wrap) into the template's `+14`, seats the animation vector chosen by the template's `+7` bit 1,
builds the attribute byte, and tail-hands to the slot initialiser `loc_379d`.

### Sprite-Y stacking

The player is drawn not as one sprite but as three stacked vertically, and `deriveStackedSpriteYs`
fans the single authoritative `PLAYER_Y` [seen] out to those three slots. It writes the base Y into
actor slot 3's Y field (`ACTOR_TABLE + 0x4c`), the base minus `0x10` into slot 2 (`+0x34`), and slot
2's top plus `0x0a` into slot 1 (`+0x1c`) — so the three pieces track the lift's vertical position as
one body while keeping their fixed vertical spacing. It is called from every lead-actor movement
handler right after the base Y is advanced, so the visible stack never lags the actual position.

### Proximity collision scans

Hits between projectiles, enemies, and targets are resolved by box-overlap scans that walk a record
table testing each entry against a moving actor, aborting the whole scan the moment one connects.
There are two closely related scans. `loc_602f` runs the object-proximity scan once for each of two
target slots taken from `SPRITE_ACTOR_RECORD_SLOTS` [seen]: it tags each pass with a slot selector and
runs `loc_6048`, which reads the slot's presence block (`ENEMY_TARGET_REC0`/`ENEMY_TARGET_REC1`),
leaves an empty or already-engaged block inert, and for a live block latches its kind into
`ACTIVE_OBJECT_TYPE` [seen] before entering the record scan `loc_6069`. That scan classifies each
record — skipping empties and wrong-kind entries to the epilogue — and on a live match routes an odd
round to the collision handler and an even round to the proximity gate `loc_6080`, which measures the
X and Y gaps (biasing X by `FLIP_SCREEN_FLAG` [seen]) and, when both fall inside their windows,
enters the hit handler keyed on the record's tag.

The second scan is a tightly-coupled pair of routines that call each other — the six-slot overlap scan
`loc_5fa2` and its advance-and-loop latch `loc_6018`. `loc_5fa2` examines one record: an empty slot or
a non-type-5 record advances (by tailing into `loc_6018`, which steps both the record and geometry
pointers, counts the slot down, and either re-enters `loc_5fa2` for the next slot or reports the
exhausted no-hit sweep). For a candidate record it measures the axis distances between the record's
box and the target — biasing X by the screen-flip sign and both boxes by a fixed Y margin — and
applies the wide window pair when the active hit type is 3, the tight window otherwise. A type-3
overlap retargets and retires the record; any other overlap flags the two struck-record cells,
enqueues the hit sound, and skip-returns to abort the caller's loop. This SCC is seeded per
interrupt-parity slot by `loc_5f83` (which latches the block's kind into `ACTIVE_OBJECT_TYPE` and runs
the six-record scan tagged with that kind), and the two parity slots are walked by `loc_5f6a`, the
ungated companion driver that hands each of the two `SPRITE_ACTOR_RECORD_SLOTS` cursors to `loc_5f83`
and stops the instant one pass claims a hit. A separate leaf, `precheckCollisionBounds`, supports
these scans by biasing an actor's X and testing whether its Y plus margin still clears the bottom
limit `0xe0`, returning the off-screen decision as a flag. The interrupt-parity flags
`OBJ_HIT_FLAG_I0`/`OBJ_HIT_FLAG_I1` [seen] are set by the *first* scan only — the
`loc_602f`→`loc_6048`→`loc_6080`→`loc_60bc` family — each a one-frame pulse raised on a collision and
cleared when the struck object is torn down. The `loc_5fa2` scan does not touch those flags; its own
"two struck-record cells" are the `+1` and `+7` bytes of the struck `ENEMY_TARGET_REC0`/
`ENEMY_TARGET_REC1` record (`0x8c91`/`0x8ca9` and `0x8c97`/`0x8caf`).

### Teardown

Boards and lives end by wiping the arena back to a clean slate. `clearActorArena` zero-fills the whole
`0x200`-byte record region from `ACTOR_TABLE`, so a fresh board carries no stale actor state.
`clearActorArenaAndCounters` is the fuller teardown reached as a dispatch state: it zeroes an even
larger span from `ACTOR_TABLE`, clears the `SPAWN_PHASE_COUNTER` [seen], `WAVE_ARRIVAL_COUNTER`, and
`ROPE_SEGMENT_COUNT` [seen], and forces `PLAY_STATE_INDEX` [seen] to phase 6. Individual records are
retired with finer tools: `loc_221e` blanks a single `0x18`-byte record to zero, and `loc_3553` clears
an actor's `0x17`-byte sprite band. The shared enemy-despawn tail `loc_34b0` combines the band-blank
with bookkeeping — it drops `ACTIVE_ENEMY_COUNT`, drops `STAGE_COUNTDOWN` while it is still positive,
bumps `SPAWN_PHASE_COUNTER` when the play sub-state is the fourth phase, and repaints the stage
countdown to its two HUD digits — so a despawning enemy both leaves the screen and updates the crowding
counters the spawn cadence reads. Finally, `loc_0e00` resets the arena for a new board at a higher
level: it clears the live-state page and a handful of loose flags, reseeds each player's saved bank
from the cabinet switches (lives from `LIVES_DSW` [code] into `PLAYER0_LIVES`/`PLAYER1_LIVES` [seen], a
fixed opening X, and the sprite colour from `DIFFICULTY_DSW`), re-arms the row-by-row tile fill, and —
only while the game is actually in play — clears the launch flags.

## Waves, rope and launch

Three cooperating machines share the enemy-actor record table `ENEMY_ACTOR_TABLE` [seen] — a
14-slot array with a `0x18`-byte stride — and are wired into their stage's per-frame body around
the shared object update `loc_20d4` [code]. Only the rope column runs inside that shared update;
the wave driver and the launcher are separate sibling calls placed alongside it.
The **attack wave** flies eagle records into formation, dives them at the player, and retires
them; the **rope column** grows and animates the vertical rope/lift the play field is built
around; and the **scripted launcher** feeds objects out of a per-level script into free
projectile slots during the level intro. They are separate concerns, but they meet on that one
record table and on the counters that pace a stage.

### The attack wave

The wave is driven once per frame by `loc_72a7` [code], which reads two flags and picks one of
three behaviours. Until the wave is armed — `WAVE_LAUNCH_FLAG` [code] still clear — it does
nothing but seed the next wave through `loc_72e1`. Once armed, if no live records remain
(`WAVE_RECORD_COUNT` [code] is zero) it hands off to the inter-wave idle handler `loc_73e3`.
Otherwise it walks the wave's live records — two per wave index, `2 * WAVE_INDEX` [seen] of them
— stepping each one through the per-record dispatcher, advancing the record cursor by the
`0x18` stride between passes.

Seeding, in `loc_72e1` [code], only fires while the target slot `ENEMY_TARGET_REC0` [seen] is
clear, so a wave cannot be armed on top of an unfinished one. It raises `WAVE_LAUNCH_FLAG` and
increments `WAVE_INDEX` — the only write to that counter anywhere, so it never wraps here; the
4->0 reset seen in play comes from a stage-reset RAM clear elsewhere, not from this routine. The
fourth wave (index 4) is special: rather than laying down new records it merely re-arms the outer
phase counter `WAVE_OUTER_PHASE` [code] and reloads the inter-wave hold `WAVE_HOLD_TIMER` [seen]
to `0x20`, leaving the index sitting at 4. Every other wave writes `2 * WAVE_INDEX`
records into `ENEMY_ACTOR_TABLE`, each drawn field-by-field from the four-byte-per-record
parameter table `EAGLE_WAVE_PARAM_TABLE` [code]: the record is marked active, its target
column/row and two other fields are copied in, a fixed flag byte `0x80` is written to every
record's `+5` field and additionally to the `+3` field of records whose own low address has bit 3
set (odd table position), and finally the outer-phase and arrived counters (`WAVE_OUTER_PHASE`,
`WAVE_RECORDS_ARRIVED` [seen]) are cleared so arrival tracking starts from a clean slate.

`loc_72cf` [code] is the per-record state dispatcher. A record whose active bit (bit 0 of its
first two bytes) is clear is skipped; otherwise its state byte selects one of exactly three
handlers — approach (0), dive/climb (1), or retire (2) — with no other state reachable.

- **Approach**, `loc_733c` [code], waits for the eagle to reach the record's grid slot. The
  eagle's live column, `EAGLE_X_COORD >> 3` [code], must match the record's target column (or the
  one just before it), and its live row, `(EAGLE_Y_COORD >> 3) + 4` [code], must fall inside a
  five-row window above the record's target row. On arrival it advances the record's state and
  arms an animation: odd records take `EAGLE_ODD_RECORD_ANIM` [code] and get their per-record
  dive/climb speed (`+9`) set to `0x38`, while even records take `EAGLE_EVEN_RECORD_ANIM` [code],
  set the same `+9` speed to `0x40`, and bump `WAVE_RECORDS_ARRIVED`. When the arrived
  count reaches `WAVE_INDEX` — the whole wave is in formation — it queues the wave-arrival
  command `WAVE_ARRIVAL_CMD_BASE` [code] offset by the arrived count, which is what drives the
  arrival sound and display.

- **Dive/climb**, `loc_7395` [code], first steps the record's animation, then integrates its
  16-bit vertical position by the per-record speed. An even record descends: speed is added, a
  carry drops it one grid row, and once it reaches the bottom row (`0x1d`) its state advances. An
  odd record climbs the mirror path: speed is subtracted, a borrow lifts it a row, and once it
  passes the top row (`0x04`) its state advances.

- **Retire**, `loc_73ce` [code], zero-fills the whole `0x18`-byte record and decrements
  `WAVE_RECORD_COUNT`. When that count hits zero — the last record of the wave has left — it
  seeds `WAVE_HOLD_TIMER` to `0x30`, opening the inter-wave gap.

That gap is managed by the idle handler `loc_73e3` [code], reached whenever the wave is armed but
holds no records. It drains `WAVE_HOLD_TIMER` one tick per frame; on expiry, if a wave index is
still set it enqueues that wave's sound command, then reseeds the hold to `0x18` and clears
`WAVE_LAUNCH_FLAG` so the next frame's driver seeds a fresh wave.

The whole wave driver is wired into the bonus/eagle stage through `loc_72a0` [code], the body of
that stage's phase 1: it runs the shared per-frame update and then `loc_72a7`. Which phase body
runs is chosen by `WAVE_OUTER_PHASE`, so the outer-phase counter that `loc_72e1` clears and
re-arms is the same selector that decides whether the wave driver runs at all.

### The rope column

The rope is drawn in two alternating halves, split on the parity of `ROUND_COUNTER` [seen] and
both entered from the shared per-frame update through `loc_25a6` [code].

On **odd** frames `loc_25a6` itself draws the marker/lift column at the saved layout pointer
`MARKER_LAYOUT_PTR` [code]. It paces itself on `ROPE_DRAW_STEP_TIMER` [code], doing work only
when that timer expires (then reloading it). `SPAWN_PHASE_COUNTER` [seen] says how much column
there should be — a phase of zero means nothing to draw — and `FORMATION_SLOT_TABLE` [seen]
selects the mode. When a retract is pending it blanks a screen-band above the layout and redraws
the retract glyph; otherwise it runs the forward sweep. The forward sweep compares the spawn
phase against the running draw count `ROPE_DRAW_COUNT` [seen]: when they differ and no extend is
in progress it begins a new extend sweep — bumping `ROPE_DRAW_COUNT`, raising
`ROPE_DRAW_EXTEND_FLAG` [code], and resetting the layout pointer to the interior sprite-band base
`SPRITE_BAND_86E3` [code] — and when an in-progress sweep reaches its limit it drops the extend
flag and clears the anim-armed latch `ANIM_ARMED_LATCH` [code]. While extending it grows the
column one row upward, pulses the new cell pair, and once the layout pointer reaches its cap
position latches `ROPE_DRAW_COMPLETE_FLAG` [code]. Which glyph is stamped is chosen by the parity
of `ROPE_DRAW_ANIM_PHASE` [code], picking between the even/odd variants of the column, retract,
and cap glyph sources (`MARKER_COLUMN_GLYPH_SRC` [code] and siblings); the chosen source is
stamped down the required number of column records, and on a forward frame a `3x3` cap glyph
(`MARKER_GLYPH_SRC` [code]) is appended below the last record before the animation parity ticks.

On **even** frames `loc_25a6` defers to `loc_2d66` [code], which bails while a grab is in
progress (`GRAB_ACTIVE_FLAG` [seen]) or while `WAVE_ARRIVAL_COUNTER` [seen] still sits at its
hold value of 2, and otherwise runs the two rope sub-drivers in order — the extend state machine
then the per-cell writer.

The extend state machine, `loc_2d78` [code], reads `ROPE_EXTEND_STATE` [code] and picks a handler
from a two-entry table `ROPE_EXTEND_DISPATCH_TABLE` [code]: sub-state 0 adds a segment, and after
it runs the state advances into the second sub-state. The add-segment handler, `loc_2d80` [code],
first checks whether the rope has already reached its per-stage length — it stops once
`ROPE_SEGMENT_COUNT` [seen] equals `WAVE_ARRIVAL_COUNTER - 2`, tying rope length to how far the
stage's arrival counter has progressed. Otherwise it bumps the segment count and, while the
segment index `ROPE_EXTEND_INDEX` [code] is below four (or an anti-tamper strike
`TAMPER_STRIKES_ROM` [code] is pending, which substitutes the strike count as the table index),
it advances the index, looks that segment's video-column low byte up from
`ROPE_CELL_COLUMN_TABLE` [code] and combines it with the fixed video page `0x84` to form the
column base `ROPE_COLUMN_VRAM_PTR` [code], reloads that segment's frame timer in the per-cell
timer array `ROPE_CELL_TIMERS` [code], advances `ROPE_EXTEND_STATE`, and arms the sub-timer
`ROPE_EXTEND_TIMER` [code] to `0x10`.

The per-cell writer, `loc_2e22` [code], then walks exactly `ROPE_EXTEND_INDEX` active cells from
the state base `ROPE_CELL_STATE_BASE` [code], handing each cell record to a small per-cell state
machine. That machine skips an inactive cell and otherwise routes the cell's state byte to one of
four handlers — seeding a spawn-object slot and blitting a segment tile, ticking a per-cell frame
timer and stamping a round-derived tile, and a retract handler — so each counted rope segment is
animated independently as it grows and later retracts.

### The scripted launcher

During the level intro, objects are fed onto the field by a small script rather than by the wave
seeder. The gate is `loc_6e75` [code]: with the ROM-integrity guards clear it runs the
single-object launcher and then the per-record driver in sequence (a set guard flag would jump
into data and so is never reached on a valid ROM).

The launcher, `loc_6e86` [code], is paced by a per-call delay held in `INTRO_DELAY_CKSUM_WORD`
[seen]: while that delay is non-zero it only ticks it down and returns. On expiry it reloads the
delay — `0x2c` when bit 1 of the sequence counter `LAUNCH_SEQ_COUNTER` [code] is set, otherwise
`0x20` — and reads the next script byte through `LAUNCH_SCRIPT_PTR` [seen]. A byte of `0xff`
terminates the script for that frame; any other byte is treated as a one-based index into
`ENEMY_ACTOR_TABLE`, selecting the record to launch. The launch is admitted only if one of the
three projectile slots is free, tested through `PROJECTILE_SLOT_STATE` [code]: if none is free the
script pointer is backed up one byte to retry next frame, and if one is free the selected record
is armed (its state byte set to `0x06`), pointed at the spawn animation `SPAWN_ANIM_TABLE_396A`
[code], launched into the first free projectile slot, and `LAUNCH_SEQ_COUNTER` is bumped by one.
Because the delay is chosen from bit 1 of that counter, the delay changes every two launches — the
pattern `0x20, 0x20, 0x2c, 0x2c, ...`

The companion driver `loc_6edb` [code] sweeps all 14 enemy-actor records through their per-record
state handler and then decides whether the intro's phase 1 is finished. Completion needs two
things at once: the launch script must have reached its `0xff` terminator, and all three
projectile slots (`PROJECTILE_SLOT_STATE`) must be idle — until both hold it simply returns. When
they do, it advances the intro-phase selector `INTRO_PHASE_INDEX` [code] and queues the
phase-1-complete command `PHASE1_COMPLETE_DISPLAY_CMD` [code]. It then compares three times the
current target-group count `TARGET_GROUP_COUNT` [seen] against the running hit tally `HIT_TALLY`
[code]: on a match every target in the group was hit, so it forces `INTRO_PHASE_INDEX` to phase 4
and queues the match command `TARGET_MATCH_DISPLAY_CMD` [code]; otherwise it queues the mismatch
command `TARGET_MISMATCH_DISPLAY_CMD` [code]. Finally it reprimes the intro delay to `0x40` and
clears the `0x30`-byte target block at `ENEMY_TARGET_REC0`, tearing down the intro's target state
so the round proper can begin.

## Rendering, HUD and display lists

Everything the player sees is composed into two parallel planes of the 0x8000 video page and a
sprite display list that the hardware overlays on top of them. The tile-code plane starts at
`VIDEO_RAM_BASE` [code] (0x8400-0x87ff) and holds one byte per cell naming which character glyph to
draw; a second plane at `ATTRIB_MAP_BASE` [seen] (0x8040) holds the colour/attribute byte for each
cell. The two planes share the 0x20-cell row stride, so "one tilemap row down" is always +0x20 and
"one row up" is -0x20 — a stride that recurs in nearly every routine here. Because the tile plane is
what most of the game paints into, the routines below spend most of their effort writing tile codes,
and touch the attribute plane only when a whole screen is (re)coloured.

### Clearing and filling the two planes

The colour plane is painted in one sweep by `fillAttributeColumns` [code]. Handed a source pointer,
it walks 31 columns out of `ATTRIB_MAP_BASE`; each column takes a single source byte and floods it
straight down all 30 rows at the 0x20 stride before the source pointer steps one byte to the next
column. This is the routine that gives a board its colour scheme in a single pass. It is called
wherever a screen is (re)built — attract setup, round init in `loc_1601`, and the message/label
builders `loc_1b43`/`loc_1b8c`/`loc_1dd3`.

The tile plane is filled a different way: row by row through a small state machine rather than a
single loop. `seedTileFillCursor` [code] arms it by stashing a 16-bit write cursor into `TILE_FILL_PTR`
and seeding `FILL_ROW_COUNTER` with 0x20 (32 rows); a later per-frame pass walks both down one row at
a time. `loc_02e3` [code] is the fixed-origin entry into that arming, always starting the fill from
`PLAYFIELD_TILE_BASE`. On top of the whole-screen fill, `loc_0254` [code] — the per-frame worker the
main/attract driver runs when the machine is idle enough to repaint — keeps the scrolling scenery
columns fresh: in one-player mode it blanks four three-cell columns (via `blankTileColumn`), and in
two-player mode it caps and paints a body column (`paintColumnBodyTiles`), each column stepping one
tilemap row up per cell. A control byte (`WORKER_CONTROL_BYTE`) gates the whole thing and can add one
more blanked column at the tail. The lowest-level fill primitive underneath all of this is `loc_0010`
[code], a plain "store a constant across N cells and advance the pointer" memset (a zero count means a
full 256, matching the hardware's count-down loop), used both to blank tilemap runs and to clear RAM.

Board scenery that is not a uniform flood comes from `loc_0cf8` [code], which stamps a two-plane
column strip into video RAM from a packed source table. It walks 0x0c-byte columns and writes each
one bottom-up at the 0x20 stride into the tile plane, starting from `COLUMN_BLIT_TILE_DEST` [code]
reading `COLUMN_BLIT_TILE_SRC` [code]. A steering byte follows every column: 0xff switches the copy
over to the attribute plane (`COLUMN_BLIT_ATTR_SRC` [code] into `COLUMN_BLIT_ATTR_DEST` [code]), 0xee
ends the whole stamp, and anything else is simply the first byte of the next column one cell to the
right. It is the one routine here that paints tile codes and their colours together in a single walk.

### Tile-block and glyph stamping primitives

A family of small leaf routines stamps fixed-size rectangles into either plane, and the higher-level
readouts are all built out of them. `blit2x2TileBlock` [code] copies four source bytes into a 2x2
square (top-left, top-right, bottom-right, bottom-left order) and returns the anchor advanced to the
bottom-left cell, so an animator can march it one row up between frames. `paintTileBlock2x2` [code]
and `paintTileBlock2x2Above` [code] are the same 2x2 idea with different anchoring — the first grows
downward from a top-left anchor, the second upward from a bottom-left anchor. `blitTile3x3Block`
[code] stamps a 3-wide by 3-tall block, copying three cells per row and then stepping the destination
down a full screen row (three written plus 0x1d); it hands back both the advanced destination and the
advanced source, because callers chain one block straight after another. `blitGlyphBlock4x3` [code]
is the taller 4-row-by-3-column cousin used for the big header glyphs; it advances only the
destination's low byte within a row so a row stays inside its tilemap page, stepping +0x1d between
rows for a net +0x20. `paintColumnBodyTiles` [code] and `paintColumnBodyTilesUp` [code] paint the two
lower body tiles (mid 0x25, base 0x20) of a three-cell scenery column, the second variant fixed to
step upward. `blankTileColumn` [code] erases a three-cell column to the blank tile 0x10. Text is laid
in by `copyBiasedTileString` [code], which copies a source string into a tile buffer adding a fixed
+0x08 bias to every byte (reindexing character codes into display-tile codes) until it hits the 0xa0
terminator. `loc_1ffb` [code] shows the pattern at work: it picks one of two fixed 3x3 glyph sources —
`GLYPH_TILES_A` [code] or `GLYPH_TILES_B` [code] by bit 5 of a selector — and stamps it at
`GLYPH_BLOCK_DEST` [code] through `blitTile3x3Block`.

### The sprite display list

Moving objects are drawn from a 24-entry, 4-bytes-per-entry sprite display list based at
`SPRITE_DISPLAY_LIST` [seen] (0x8840); each entry carries a Y byte, an attribute byte, an X byte and
a code byte, and the whole list is rebuilt from the object-record banks every frame. The rebuild is
driven by `loc_09f8` [code], which first steps four
object records through their animation, then hands off to `loc_02ef` [code] for the actual assembly.

`loc_02ef` copies four record groups into the list in turn. The two lead actors and the two
enemy-target records go through `copyObjectRecordsToDisplayList` [code], which lifts four raw bytes
(record offsets +0x06, +0x10, +0x04, +0x0f) out of each record into four successive list slots and
returns the advanced list pointer so the next group chains on without reloading. The eighteen moving
objects go through `loc_0343` [code], which does the same shape of copy but with coordinate math: two
of the four bytes are screen coordinates derived from a record's 16-bit sub-pixel pair, reduced to a
pixel position by `(pair >> 5) - 8`. The two arrow/launch records finish the list, after which
`loc_02ef` nudges the arrow group's two sprite-Y bytes down a pixel and falls into `loc_0320` [code],
which ticks a per-frame counter and, when the screen-flip flag says the cabinet is inverted, mirrors
the whole list.

The player is special: it is drawn as three sprites stacked vertically, and `deriveStackedSpriteYs`
[code] fans the single player Y out to them. It reads `PLAYER_Y` [seen] (0x8a84, the lead actor's
vertical position in `ACTOR_TABLE` [seen]) and writes the three stacked slots — the bottom slot gets
the base Y, the top slot Y-0x10, and the middle slot Y-0x10+0x0a (sitting 0x0a below the top slot) — so
the three sprites travel as one tall figure. When the cabinet is flipped, `mirrorSpriteListVertically` [code] rewrites all 24 entries
in place: each coordinate byte is negated and offset (-value - 0x10) and the attribute byte's two
flip bits are toggled while its colour nibble is preserved, turning the whole scene upside down.

### The display-command ring and its interpreter

Rather than paint every screen change inline, much of the game queues *display commands* and lets the
main loop drain them into the picture: the main loop is itself the display-command ring interpreter,
not a separate routine it calls. The queue is a 32-slot ring of two-byte
commands on page 0x88, based at `DISPLAY_CMD_RING_BUFFER` [code] (0x88c0-0x88ff) with a write pointer
in `DISPLAY_CMD_RING_WRITE_PTR` [code] and a read/dispatch cursor in `DISPLAY_CMD_RING_READ_PTR`
[code]. A producer enqueues through `loc_0038` [code]: if the slot the write pointer names is free
(its high bit set), the command's high byte lands there and its low byte in the next slot, the pointer
advances by two and wraps back to the ring start; an occupied slot simply drops the command. Boot
fills the ring with 0xff so every slot begins free.

`mainLoop` reads the slot under the dispatch cursor and doubles its high byte to test
the free bit: a free slot means "run the per-frame worker (`loc_0254`) and loop", while an occupied
slot is a real command. For a command it frees both bytes back to 0xff, advances the cursor (wrapping
0xff back to the ring start 0xc0), then treats the high byte as a selector — masked and doubled into a
word offset in the handler table at 0x0242 — and jumps to that handler with the command's low byte in
hand as its argument. The DISPLAY_CMD_* constants are exactly these two-byte (selector:argument)
words. Their high byte 0x06 is the common "display" selector: `OBJECT_SPAWN_DISPLAY_CMD` [code]
(0x0611) and its zero-round variant `OBJECT_SPAWN_DISPLAY_CMD_ALT` [code] (0x0607) fire on object
spawn, `WAVE_SPAWN_DISPLAY_CMD_A` [code] (0x0625) on the first spawn of a wave, the five
`PROMOTE_DISPLAY_CMD_*` [code] words (0x062b-0x062f) on deferred-object fire, `TARGET_MATCH_DISPLAY_CMD`
[code] (0x0610) when the hit tally completes a target group, `SIREN_DISPLAY_CMD_A` [code] (0x060f) for
the warning siren, the `FLIP_ANIM_DISPLAY_CMD` [code]/`FLIP_ANIM_DISPLAY_CMD_ALT` [code] pair for the
flip cadence, and `ATTRACT_SETUP_DISPLAY_CMD_A` [code] (0x0604) at attract-state completion — its two
siblings `ATTRACT_SETUP_DISPLAY_CMD_B` [code] (0x0500) and `ATTRACT_SETUP_DISPLAY_CMD_C` [code] (0x0502)
carry a different high byte (selector 0x05) instead.
`loc_0e54` [code] shows a typical enqueue site: it queues a primary command (selector 0x07) and, only
under the free-play coinage sentinel, a second free-play command.

A separate command run is appended by `loc_0f97` [code] and `loc_0fc3` [code] into the byte-wide ring
on page 0x8a00. `loc_0f97` derives a command byte from `ROUND_COUNTER` (bits 1..2 of the round plus a
0x1e base) and tail-calls `loc_0fc3`, which appends that byte followed by the fixed run 0x15/0x16/0x17
one byte at a time through the shared appender `loc_0ea2` [code]. `loc_0ea2` stashes each pending byte
in `TEXT_RING_PENDING_BYTE` [code] (0x8d20), and only actually appends while a game is active or the
play-mode latch is held, writing into the page-0x8a ring at the cursor in `SOUND_RING_WRITE_PTR`
[code] and wrapping the last slot back to the first. This page-0x8a append path shares its write pointer
(`SOUND_RING_WRITE_PTR`) and buffer page with the sound-command enqueue path, so the two producers feed
one shared physical ring even though they arrive from different callers.

### HUD number primitives

Every on-screen number is packed BCD painted one tile per digit, and a handful of leaf routines do the
conversion and the painting. `binToPackedBcd` [code] turns a binary count into its low two decimal
digits (count mod 100) plus a hundreds tally, counting up in BCD; a zero count means a full 256
passes. `byteToPackedBcd` [code] is the same binary-to-BCD reduction done the Z80 way, weighting the
high nibble by decimal 16 and folding in the corrected low nibble. `splitBcdByte` [code] takes one
already-packed byte, writes its units nibble as a tile at the cursor, advances, and hands back the
tens nibble with a zero flag for leading-zero suppression. `drawStackedBcdDigits` [code] paints a
packed byte as two stacked tiles — tens at the cursor, units one tilemap row above — blanking a
leading-zero tens. `renderDigitWithBlanking` [code] paints a single digit while threading a "blank
budget" across a field: a non-zero digit prints and ends the leading-blank run, a zero digit prints
the blank tile while budget remains or a genuine 0 once it is spent.

The three score columns are painted from these. `loc_056b` [code] draws one of three packed-BCD
counters — player 1 from `P1_SCORE_BCD` [seen], player 2 from `P2_SCORE_BCD` [seen], or the high
score from `HIGH_SCORE_BCD_HI` [seen] — up its screen column (`P1_SCORE_VRAM` [code], `P2_SCORE_VRAM`
[code], `HIGH_SCORE_VRAM` [code]), splitting each of the three source bytes into high then low digit,
one cell up per digit, with a shared blank budget of 4 suppressing leading zeros. `loc_0552` [code] is
the reset-and-repaint twin: it zeroes the selected counter first, then paints it the same way (so the
column shows four blanks and two zeros). `loc_05ee` [code] draws the credit count: it clamps
`CREDIT_COUNT` [seen] to 99, converts to packed BCD, and paints the tens (only when non-zero) and
units into `CREDIT_HUD_TENS_VRAM` [code] / `CREDIT_HUD_UNITS_VRAM` [code] — and hides an anti-tamper
tripwire that sums a program block whenever the units digit is exactly 2.

The high-score table and the two digit panels are painted by `loc_03e9` [code], the attract-screen
HUD handler. It first lays eleven character fields through `loc_05b2` [code] — a general field painter
that follows a selector into `FIELD_RECORD_PTR_TABLE` [code], walks record lists of inline strings,
and writes each character bottom-up as a digit tile (or as blanks when the selector's top bit is set),
ending records on '.' and the whole run on '?'. It then renders the ten high-score entries as stacked
BCD digit pairs into `HIGH_SCORE_TABLE_VRAM` [code] (each source byte split low-then-high a row apart,
the top pair's leading zero suppressed, the column re-based two cells right per row), and finishes with
`loc_0439` [code] for the ten-row packed-BCD digit panel (source `PANEL_DIGIT_SOURCE_TABLE` [code]
into `PANEL_DIGIT_VRAM_DEST` [code], with a fixed separator tile between digit pairs) and
`renderPanelFromTable` [code] for the status panel. `renderPanelFromTable` walks ten rows of three
cells out of `PANEL_TILE_SOURCE` [code] into `PANEL_VRAM_DEST` [seen], painting the blank tile 0x40
for any empty source cell.

Two composite readouts round out the number machinery. `loc_10c2` [code] adjusts a counter toward a
target one step at a time and repaints a three-field BCD display in one pass, drawing field 1 as the
counter doubled, field 2 either raw (single digit) or re-encoded, and field 3 (when present) folded
into the counter and drawn doubled with a hundreds digit mirrored out — all through
`drawStackedBcdDigits` into `SUBSTATE_FIELD1_VRAM` [code], `SUBSTATE_FIELD2_VRAM` [code] and
`SUBSTATE_FIELD3_VRAM` [code] — then advances the main-loop sub-state. `loc_6f42` [code] is the
level-intro tally: it advances the intro phase and draws the target-hit tally `HIT_TALLY` [code] as
two stacked digit pairs at `HUD_INTRO_DIGITS_BASE` [code], the packed tally at the base and its BCD
double two rows up.

### Stage, round and status readouts

The header that names the current stage and round is drawn by `loc_1f40` [code]. It scans a table for
a value; a match at slot 0 renders the round number by counting round+1 in BCD, picking one of two
glyph blocks — `ROUND_DIGIT_GLYPHS` [code] or `ROUND_DIGIT_GLYPHS_ALT` [code] by the tens bit —
stamping it at `HUD_ROUND_TILE` [code] through `blitGlyphBlock4x3`, clearing the trailing cells, and
mirroring `STAGE_COUNTDOWN` [seen] into its HUD digit. Any match then draws the fixed stage label:
the matched slot indexes `STAGE_LABEL_PTR_TABLE` [code] and the resulting glyph block is stamped at
`HUD_STAGE_LABEL_TILE` [code]. The stage countdown itself is painted as a two-cell number by
`renderStageCountdownDigits` [code]: it reads `STAGE_COUNTDOWN` [seen], writes the units nibble to
`HUD_STAGE_DIGIT_LO` [seen] and the tens nibble one row
over with a leading zero suppressed, converting values of ten or more to packed BCD first (only that
two-digit path holds off while the play-mode latch is set; single-digit countdowns render regardless).

A small ring-driven animation keeps the status field on screen refreshing without doing it every
frame. `loc_23a1` [code] decrements a mod-8 ring counter (`STATUS_RENDER_RING` [code]); while it stays
non-zero the display simply holds, and only on wrap does it borrow one from the mod-4 render phase
(`STATUS_RENDER_PHASE` [code]) and fall into `loc_23ad` [code]. `loc_23ad` masks the phase to 0..3,
looks up a tile-block descriptor for that phase in `STATUS_RENDER_TILE_TABLE` [code], and stamps three
2x2 blocks two rows apart from `STATUS_RENDER_VRAM_BASE` [code] through `blit2x2TileBlock`; the third
block alternates between `STATUS_FIELD_TILE_A` [code] and `STATUS_FIELD_TILE_B` [code] on the phase's
low bit, so the field visibly cycles.

Finally, a numeric resource is shown as a bar rather than digits. `renderPhaseGauge` [code] (and its
identical twin `paintPhaseGauge` [code]) reads `GAUGE_PHASE_COUNTER` [seen] and draws a five-cell
vertical gauge from `PHASE_GAUGE_BASE_TILE` [seen] upward: a zero count leaves the gauge untouched,
otherwise (count - 1) cells clamped to five are drawn with the filled tile 0xb0 and the remainder with
the blank tile 0x10.

## Sound

Pooyan is a two-processor board: the main CPU plays the game, and a second Z80 does nothing but
make noise. The two never share memory. The only wire between them is a single one-byte mailbox —
the soundlatch at `SOUND_COMMAND_LATCH` (`0xa100`) — plus an interrupt line the main CPU can pull to
tell the sound CPU "a fresh byte is waiting." Every sound the game makes is therefore reducible to a
stream of individual command bytes deposited in that mailbox. Understanding the audio subsystem means
tracing how a byte gets chosen, how it reaches the latch, and what the machine does when it arrives.

### The soundlatch write path

The lowest layer is `sendSoundCommand` — the one routine that actually touches the mailbox. It writes
the command byte into `SOUND_COMMAND_LATCH` (`0xa100`, `[seen]`), then pulses the audio-interrupt bit:
it drives `AUDIO_IRQ_LATCH` (`0xa181`, `[seen]`) high and immediately back low. That rising edge is
what interrupts the sound CPU into reading the byte it just found in the latch. The width of the pulse
is nothing but a hardware settling delay carrying no state, so it collapses to two back-to-back writes
here. Nothing downstream reads a register back from this routine — its entire effect is those two
memory-mapped writes.

Only two places in the whole machine call this path directly, bypassing every buffer. At power-on,
the boot routine `loc_0092` writes command `0x00` straight to the latch to silence the audio CPU
before it enables interrupts and lets the game start. And the score-drip driver (below) fires its
tick sound straight to the latch. Everything else the game wants to hear takes the longer, buffered
route.

### The command queue

Most sound requests are not sent the instant they are decided — they are dropped into a ring buffer
and dispatched one per frame. The ring lives on page `0x8a`: its slots run from `SOUND_RING_BUFFER`
(`0x8a43`, `[code]`) up to `0x8a5e`, an empty slot is marked with `0xff` (the value boot fills the
whole ring with), and two cursors track it — `SOUND_RING_WRITE_PTR` (`0x8a40`, `[code]`) names the
next slot to fill and `SOUND_RING_READ_PTR` (`0x8a41`, `[code]`) names the next to consume. Both
cursors hold a low byte in the `0x43`..`0x5e` range and wrap from the last slot back to the first, so
the buffer is genuinely circular.

Two helpers put bytes in. `loc_0eb3` is the unconditional enqueue: it stores the command in the slot
the write cursor points at and advances the cursor with wrap. `loc_0ea2` is the gated enqueue —
before writing, it stashes the byte in `TEXT_RING_PENDING_BYTE` (`0x8d20`, `[code]`) and then only
commits it to the ring if a game is running (`GAME_ACTIVE_FLAG`, `0x8806`, `[seen]`) or the play-mode
latch is set (`PLAY_MODE_LATCH`); with both clear it drops the byte on the floor. This is why some
sounds are audible only during actual play while others queue in attract too — the distinction is
which enqueue helper the emitter uses.

Draining is the job of `loc_0e64`. Its main caller is the vblank interrupt service `loc_066d`, which
runs it once per frame; a second caller, `loc_6e59` (the per-frame body of level-intro phase 1), also
drains the ring, so during that intro phase the vblank drain and the phase-1 drain both fire in the
same frame and the ring advances twice. It reads the slot under the read cursor; if that slot holds the
`0xff` empty marker there is nothing to do and it returns. Otherwise it hands the queued byte to `sendSoundCommand` — but only
when demo sounds are enabled or a game is active. That mute test reads `DEMO_SOUNDS_DSW` (`0x8821`,
`[code]`): its bit 0 permits queued sound while the machine is idle, so with that DIP off and no game
running the byte is silently discarded instead of latched. After dispatch (or the silent skip) it
frees the slot back to `0xff` and advances the read cursor with wrap. Because the drain moves exactly
one slot per frame — outside the level-intro phase noted above, where it fires twice — the ring also
serves as a rate limiter: a burst of enqueues in one frame plays out across the following frames rather
than clobbering the single-byte latch instantly.

### The command set

The bytes that flow through this system are chosen by a family of tiny emitter routines, each of which
knows one fixed command code (or a short fixed sequence) and pushes it into the appropriate path.
There is deliberately no lookup table naming these codes anywhere in the game: the audio model is a
pure clip model that records one waveform per distinct command byte, so the byte value *is* the
identifier and no per-command name table exists.

The silence code `0x00` is emitted both by `loc_0ecf` (queued) and by the boot direct-latch site
`loc_0092`; the other direct-latch site, `loc_0f09`, emits the `0x0b` score-drip tick, not `0x00`. The
single-byte queued emitters cover `0x01` (`loc_0ed2`, gated), `0x02` (`loc_0ed6`), `0x05`
(`loc_0ef1`, the collision/hit sound, also reachable through the trampoline `loc_5f02`), `0x06`
(`loc_0ef5`, gated), `0x07` (`loc_0ef9`, gated), `0x08` (`loc_0efd`, gated), `0x09` (`loc_0f01`), `0x0a`
(`loc_0f05`, gated), `0x0b` (`loc_0f0d`, gated), `0x0c` (`loc_0f11`, gated), `0x11` (`loc_0f2b`, gated)
and `0x12` (`loc_0f3f`, gated) — so `0x0b` has a *queued* emitter (`loc_0f0d`) as well as the
direct-latch `loc_0f09`.
Some emitters queue a short run: `loc_0eda` pushes `0x82` then `0x03`, `loc_0f4e` pushes `0x82` then
`0x95`, and `loc_0fb2` pushes `0x27` then `0x15`. One emitter is conditional — `loc_0ee3` appends
`0x04` only while neither a wave teardown (`WAVE_TEARDOWN_STATE`, `0x8f24`, `[seen]`) nor a rope grab
(`GRAB_ACTIVE_FLAG`) is in progress, otherwise it does nothing. The only *gameplay-time* code sent
unqueued is `0x0b`, the score-drip tick, emitted by `loc_0f09` straight through `sendSoundCommand`; the
boot mute `0x00` (via `loc_0092`) is the only other unqueued write, and it fires just once at power-on.

The remaining emitters exist to serve the siren machinery and are described with it below.

### Event drivers

**Drip.** The running-score tick is driven each frame by `loc_5a06`. It folds one phase bit sampled
from the input-port image `INPUT_PORT0` (`0x8810`, `[seen]`) into a small cadence ring
`DRIP_RING_A` (`0x8829`, `[code]`) — shifting the sampled bit in and keeping the low three bits.
Whenever those low bits settle on the fire phase (value `1`) it does two things: it plays the drip
sound by calling `loc_0f09` (the `0x0b` command, sent immediately to the latch), and it adds one to
the running total through the shared score tail. On the off phases it simply leaves the advanced ring
behind and makes no sound. So the drip is a metered "tick… tick… tick" that accompanies points
counting up, its rhythm set by how the input-derived phase bit cycles the three-bit ring.

**Hit.** A struck target produces its sound inside the proximity-collision scan `loc_5f11`. As it
sweeps its record slots and finds one whose object is within the strike box, it marks that slot as
struck, lights the interrupt-parity flash cell at `FLASH_CELL_BASE` (`0x8d19`, `[code]`), and tail-
calls `loc_5f02`, which queues the `0x05` hit command. The flash and the sound are thus emitted
together at the moment of the hit.

**Siren.** The warning siren has an audible half and a visible half, both gated so they run only
between rounds. The audible arming lives in `loc_196e`, one step of the per-frame gameplay
coordinator `loc_18af`. It is inert while its busy latch `PERIODIC_MODE_LATCH` (`0x8d55`, `[code]`)
is nonzero. Otherwise it reads the per-round phase value `SPAWN_PHASE_COUNTER` (`0x8902`, `[seen]`)
and branches on it: below five it falls straight through to the shared tail; at exactly five it arms
a two-cell pair — the siren-enable gate `SIREN_ENABLE_GATE` (`0x8d68`, `[code]`) when no rope grab is
active, otherwise a caller-supplied pair — and, if that pair's first cell is free, fires the mode-five
sound run `loc_0f58` (which queues `0x96`, `0x97`, `0x18`, `0x15`); above five it records the value in
the busy latch and, again only when no grab is active, fires the higher-mode run `loc_0f6c` (which
queues `0x19` then `0x15`). Its shared tail then runs an event countdown: it does nothing while the
wave-event latch `WAVE_EVENT_LATCH` (`0x8d21`, `[seen]`) or a teardown is set, but otherwise ticks
`PERIODIC_EVENT_TIMER` (`0x8d22`, `[code]`) down, and on expiry reloads it, sets the wave-event latch,
and fires the siren sound run `loc_0f76`. That run, when the siren-enable gate is clear, appends a
round-selected lead byte (`0x1a` or `0x1b`, chosen by the low bit of `ROUND_COUNTER`, `0x8907`,
`[seen]`) through its own `loc_0ea2` enqueue, then tail-jumps into `loc_0fc3` — a four-append helper
that enqueues the byte still left in `A` from that lead append (`loc_0ea2` returns the advanced ring
cursor in `A`) followed by `0x15`, `0x16`, `0x17`. `loc_0f76` therefore issues five enqueues in all,
not four.

The visible half is `loc_19ca`, another step of the same per-frame coordinator. It runs only while no
game is active and the siren-enable gate is set. A frame countdown `SIREN_FRAME_COUNTDOWN` (`0x8d6a`,
`[code]`) ticks down; on expiry it reloads, flips the phase byte `SIREN_PHASE_BYTE` (`0x8d69`,
`[code]`), and enqueues one of two display commands — `SIREN_DISPLAY_CMD_A`/`_B` (`0x060f`/`0x068f`,
`[code]`) — into the separate on-screen display-command ring, not the sound path. This is the
alternating warning graphic that visually pairs with the audible siren.

**Silence.** Beyond the boot mute, the game explicitly quiets the audio CPU at the end of the level
intro: `loc_705f`, on the final intro-delay expiry, calls `loc_0ecf` to queue the `0x00` silence
command before it clears the hit tally and marks the round ready to play.

### Record/replay model

At the machine level the second Z80 is not simulated. The audio model is `clips`: because the entire
input to the real sound CPU is the one command byte in the soundlatch, each distinct byte value maps
to a single waveform captured from the real hardware, and playback is triggered by watching the write
to `SOUND_COMMAND_LATCH` (`0xa100`). The interrupt strobe on `AUDIO_IRQ_LATCH` — essential on the
real board to make the sound CPU read the byte — is not part of the replay trigger; the latch write
alone selects and starts the clip. This keeps the audio faithful (the command set the game emits is
exactly the set of clips) without having to model the sound processor's internal program.

## Anti-tamper

The machine polices its own program image continuously. Scattered through routines that otherwise do
ordinary work -- spawners, actor state handlers, the credit readout, the round HUD -- are integrity
guards that fold a fixed region of ROM into a running sum and compare the result against a constant
baked into the code. On an unmodified image every one of those sums lands on its expected sentinel, so
every guard passes silently and every tamper tally stays at zero; a single altered byte anywhere a
guard reaches throws the sum off its sentinel, the guard bumps its tally, and downstream code that
reads the tally begins refusing to run. Because the guards live inside gameplay routines rather than in
one boot-time sweep, the checks keep firing for as long as the game runs, and no single patch silences
all of them.

### The tamper tallies

Every guard reports into a small work-RAM byte, and those bytes share one behaviour: normal play never
raises them, so on an intact image they sit at zero. What a tripped guard does to its byte varies --
some set it to 1 (`verifyRomSignature`, `verifyTableChecksum`, `loc_3f7c`), others increment it
(`loc_1b43`, `loc_5594`, `loc_3865`); `SIGNATURE_MISMATCH_FLAG` sees both, set to 1 by
`verifyRomSignature` and incremented by `loc_3865`. Most of these bytes stay a static zero in normal
play; `TAMPER_ROM_CHECK_FLAG` is the exception -- not a static-zero tally but a multiplexed byte,
written elsewhere as a state index and read elsewhere as a coordinate low byte.

The master tally is `TAMPER_FREEZE_FLAG` `[code]`. It is the one several unrelated guards all bump, and
the one the most disruptive consumers read, so a nonzero value here is the game's general "the image
has been altered" latch. Alongside it sits a family of narrower strike counters, each owned by one
specific guard: `TAMPER_STRIKES_CATCH` `[code]` for the catch-handler checksum, `TAMPER_STRIKES_HUD_GUARD`
`[code]` for the credit-readout tripwire, `TAMPER_STRIKES_STATE10` `[code]` for the state-10 ROM-block
guard, and the further `TAMPER_STRIKES_ROM` `[code]`, `TAMPER_STRIKES_SIG` `[code]`, `TAMPER_STRIKES_STATE0`
`[code]`, `TAMPER_STRIKES_SLOTSWEEP` `[code]`, and `TAMPER_STRIKES_TERMINATOR` `[code]` counters that
their respective guards feed. Two more flags round out the set: `SIGNATURE_MISMATCH_FLAG` `[code]`, a
program-signature failure latch, and `TAMPER_ROM_CHECK_FLAG` `[code]`, raised by the table-checksum
tripwire.

### Program-signature verification

The most direct guard walks the program image against a stored fingerprint. `verifyRomSignature`
compares a sixteen-byte reference table against every eighth byte of a sampled code region: it steps the
sample pointer forward by eight and the reference pointer by one, and on the first byte that disagrees
it sets `SIGNATURE_MISMATCH_FLAG` and stops; a clean sweep leaves the flag untouched. Its two
endpoints are the sampled region base `SIGNATURE_SAMPLE_BASE` `[seen]` and the expected-signature
table `SIGNATURE_REFERENCE_TABLE` `[seen]`.

A second signature guard is hidden inside an actor state handler, `loc_2a79`. Rather than sample a
sparse set of bytes it demands a byte-for-byte match: it reads a 0x68-byte program window from
`STATE4_SIGCHECK_CODE_BASE_ADDR` `[code]` upward and a stored reference block from `STATE5_SIGCHECK_REF_TOP`
`[code]` upward in lockstep. If every byte matches -- the only outcome on an intact image, since both
compared blocks are fixed program bytes that ordinary play cannot alter -- the handler does its normal
work: it reseats the record's frame-hold, clears the flip bit, and advances the record's state. A single
mismatched byte instead diverts control straight into the state-1 handler `loc_29a0`, so a tampered
image never reaches this record's real state-4 behaviour.

### The freeze-flag guards

Three guards feed the master `TAMPER_FREEZE_FLAG`, each folding a different region and each buried in a
routine whose day job is unrelated.

The first rides on a spawner. Two sibling routines scan an actor-block table for the first free slot and
seed it; `loc_5544` does this plainly, but its counterpart `loc_5594` inserts an integrity self-check at
the moment it finds a free block. Before seeding, it walks eight byte-pairs, summing each byte of
`INTEGRITY_GUARD_REGION_0BAD` `[code]` against the matching byte of its two's-complement signature
`INTEGRITY_GUARD_SIGNATURE_55B5` `[code]`; on an intact image every pair sums to zero, and any nonzero
pair bumps `TAMPER_FREEZE_FLAG`. The check is woven into the spawn path so that it runs as a natural
by-product of actors being created.

The second lives in a play-state handler, `loc_1b43`, which otherwise clears and re-arms the tilemap,
floods the attribute columns, and queues display work. Once that is done it folds a 34-byte program
block based at `TAMPER_CKSUM_BASE_5593` `[code]` into a rolling checksum -- each byte masked, rotated
right circularly (rrca: bit 0 wraps to bit 7 and into carry), and added back with carry -- and compares the accumulator against the intact-image
value 0x7c; anything else bumps `TAMPER_FREEZE_FLAG`.

The third is armed only on a specific round. `flagTamperOnRound5ChecksumMiss` does nothing at all except
when the round counter reads five, at which point it sums six program bytes into a low byte and a
separate carry count and checks whether the low sum plus the carry count plus a 0x7f bias wraps to zero
-- the balance an intact image is tuned to produce. If it does not balance, `TAMPER_FREEZE_FLAG` is
bumped. Delaying a guard to a later round is a deliberate stalling tactic: a casual patch tested only on
the opening rounds passes, and the freeze only sets in deep into a session.

### ROM and table checksum tripwires

A further set of guards folds a block of program bytes downward from a fixed top address to a
terminator, then judges the accumulated sum -- and drives one of the narrow strike counters rather than
the master flag.

The singleton-actor spawner `loc_5835` finishes its setup by running a table checksum over a ROM region:
it hands `verifyTableChecksum` the base `CHECKSUM_ROM_BASE` `[code]` and a length of 0x52 bytes, and that
routine sums the block into a sixteen-bit accumulator, bumping the high byte on each eight-bit carry. The
table is deemed intact only when the accumulator reads high byte 0x1d and low byte 0xc1; any other total
raises `TAMPER_ROM_CHECK_FLAG`.

The catch handler `loc_3f7c`, whose real job is to land a caught object, score it, and drop the active
enemy count, carries a checksum on one of its exit paths. When it takes the special path it zeroes and
repaints the stage countdown and then sums bytes descending from `CATCH_TAMPER_CKSUM_TOP` `[code]` until
it meets a 0xc8 terminator, keeping a separate tally of eight-bit carries; the block is intact only when
exactly eight carries occurred, and any other count sets `TAMPER_STRIKES_CATCH`.

The credit readout `loc_05ee` hides a tripwire behind an innocuous trigger. It draws the credit count as
two HUD digit tiles, and only when the units digit happens to be exactly 2 does it sum a 31-byte program
block descending from `HUD_GUARD_CKSUM_TOP` `[code]`; if that sum misses its 0x8c sentinel it bumps
`TAMPER_STRIKES_HUD_GUARD`. Gating the check on a particular displayed digit is another concealment
device -- the guard fires only intermittently, so it is easy to miss when probing the routine.

Two more guards follow, but they feed different bytes: one drives `SIGNATURE_MISMATCH_FLAG`, the other a strike counter of its own. The actor state handler `loc_3865`, once its per-record
timer expires and the record pointer has reached the object-table band with the global frame gate clear,
folds a program block backward from `ACTOR_TAMPER_CKSUM_TOP` `[code]` to a 0x1a terminator as an
eight-bit wrapping sum with a separate carry tally; if the combined result keeps any of a masked set of
bits it bumps `SIGNATURE_MISMATCH_FLAG`. Separately, the state-10 guard `verifyRomChecksum` sums sixteen
read-only bytes descending from `ROM_CHECKSUM_TOP` `[code]` and inspects the shape of the resulting byte
-- a healthy image has bit 0 clear and bits 5 and 7 set -- bumping `TAMPER_STRIKES_STATE10` on any other
shape.

### What a nonzero tally does

The tallies matter because ordinary gameplay routines consult them and change behaviour once they are
set. A raised `TAMPER_FREEZE_FLAG` progressively strips the game of its ability to run.

It aborts actor updates. The per-frame driver for the lead actor group, `loc_241e`, runs its three
housekeeping sub-passes and then, if `TAMPER_FREEZE_FLAG` is nonzero, returns without ever dispatching
the lead actor record's state handler -- the group simply stops advancing.

It freezes spawns. The phase-1 spawner gate `loc_6e75` first tests `SIGNATURE_MISMATCH_FLAG` and
`TAMPER_FREEZE_FLAG` together; with both clear it launches the single object and runs the per-record
driver, but with either flag set its skip-spawn path leads into data rather than code, so a tampered
image traps the spawner instead of producing new actors.

It skips HUD setup. The bonus/round HUD routine `loc_1ead` reads `TAMPER_FREEZE_FLAG` at entry; if it is
already nonzero the routine jumps straight to its per-frame update chain, bypassing the field blit and
the round-counter digit rendering that a clean image would perform.

The narrower `TAMPER_STRIKES_HUD_GUARD` counter, raised by the credit-readout tripwire, likewise steers
later routines onto tamper paths. The target-slot spawner `loc_210b`, when it finds both of its slots
already busy, consults this counter and, if it is nonzero, hands off to a tamper re-scan instead of
returning cleanly. The actor state-5 handler `loc_24fb`, after stamping its shape flag, reloads a shape
from that pointer only when the same counter is set. In each case the effect is the same in spirit as
the freeze flag's: a tally the guards raise on an altered image quietly reroutes normal gameplay logic
into degraded or dead-end behaviour.

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
