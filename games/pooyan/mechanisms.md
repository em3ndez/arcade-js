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

Pooyan runs on a Konami GX320 board built around two Z80s; this section maps the main Z80,
which addresses 32 KB of program ROM at the bottom of memory and, above it, a compact bank
of RAM and memory-mapped hardware that together hold every scrap of the machine's live
state. (The second Z80 is a dedicated audio CPU with its own address space; the main CPU
drives it through a single command latch, and it does not appear in this map.) This section
walks the main CPU's address space — the two video planes, the sprite banks, and the
hardware I/O window — and then the state model the game builds on top of the 2 KB of work
RAM: a small forest of state selectors, timers, and record arenas that the per-frame
heartbeat reads and rewrites.

### The address space

Program ROM fills 0x0000-0x7FFF. Everything from 0x8000 up is state or hardware, and the
board decoder throws on any access outside a mapped region — there is no float-high
fallback, so a stray read or write is a fault to be surfaced, not a silently-absorbed zero.

Two adjacent 1 KB planes hold the tilemap. Colour RAM at 0x8000-0x83FF (COLOR_RAM_BASE
`[code]`) carries one attribute byte per cell; video RAM at 0x8400-0x87FF (VIDEO_RAM_BASE
`[code]`) carries one tile-code byte per cell. The playfield is a 32x32 grid of 8x8 tiles.
To paint an output row the renderer maps it to a native row (output row 0 is native row 16,
since the visible band runs native rows 16..239), takes the cell at `(nativeY>>3)*32 + column`,
reads its tile code from video RAM and its attribute from colour RAM, and draws the tile
row opaquely — pen 0 included — at 4 bits per pixel (sixteen pens per cell). The attribute
byte's low nibble is the colour/palette bank (pen base = nibble x 16), bit 6 is horizontal
flip and bit 7 vertical flip. The whole board is rotated to portrait, and there is no scroll
offset; a flipped screen is a plain cell-and-tile mirror.

Sprites draw on top of that opaque tilemap in a single pass, from two 256-byte banks:
bank 0 at 0x9000 (SPRITE0_BASE) and bank 1 at 0x9400 (SPRITE1_BASE), selected within the
0x9000-0x9FFF window by address bit 0x0400 (the surrounding bits form a don't-care mirror
mask). The two banks are parallel halves of one sprite record at the same offset: bank 0
holds screen-X at `offs` and tile code at `offs+1`; bank 1 holds a control byte at `offs`
(colour in bits 0-3, horizontal flip in bit 6 *active-low*, vertical flip in bit 7) and
`240 - screenY` at `offs+1`. The renderer walks even offsets 0x10..0x3E in ascending order,
so the highest-offset sprite wins an overlap, and clips at the screen edge rather than
wrapping. Sprite pens occupy palette entries 256..511, character pens 0..255.

The I/O window begins at 0xA000, where a read and a write at the same address are different
devices. Reads return DSW1 at 0xA000, the three input ports IN0/IN1/IN2 at
0xA080/0xA0A0/0xA0C0 (all active-low, idle 0xFF), and DSW0 at 0xA0E0. Writes reach a
watchdog kick at 0xA000, the sound-command byte for the audio CPU at 0xA100
(SOUND_COMMAND_LATCH `[seen]`), and an LS259 control latch spread across 0xA180-0xA187 —
one address per bit, the bit index being `addr & 7`. Its outputs are the vblank-NMI enable
(bit 0, NMI_ENABLE_LATCH `[code]`), the audio-IRQ strobe (bit 1, AUDIO_IRQ_LATCH `[seen]`),
audio mute (bit 2), the two coin counters (bits 3/4, COIN1_COUNTER_LATCH `[code]`), an
unused payout line (bit 5), and flip-screen (bit 7, FLIP_SCREEN_LATCH `[code]`), which is
inverted so a latched 0 means the screen is flipped. There is no video-enable bit — the
display is always on. Taken together, the machine's canonical live state is exactly the two
video planes, the 2 KB of work RAM, and the two sprite banks.

### The per-frame heartbeat

Pooyan's main loop free-runs — it never busy-waits for the beam — so the heartbeat is the
vblank NMI, which fires once per frame while the LS259 NMI-enable bit is set. Everything
time-critical happens inside that service routine. On entry it saves the whole register
file, clears the NMI-enable bit so it cannot re-enter itself, and rebuilds the scrolling
tile columns of the display. It then kicks the watchdog and samples the three input ports —
reading IN2, IN1, IN0 and complementing each so a pressed control reads as a set bit — into
the head of a short shift history at 0x8810-0x8816: the fresh samples land at INPUT_PORT0
(0x8810 `[seen]`) and its two neighbours, and each frame the prior samples are shifted up the
block so handlers can tell a new press from a held control. It then ticks two per-frame
counters: WORKER_CONTROL_BYTE (0x883f `[code]`), whose low nibble gates the scroll worker's
periodic signature check, and the free-running FRAME_COUNTER (0x8a5f `[seen]`), whose low
bits phase animations and whose zero-crossings arm integrity checks. It runs the
credit/coinage accounting chain (which returns immediately under a free-play coinage
setting) and drains one entry from the sound-command ring out to the audio CPU.

Its final act before restoring registers is the dispatch that drives the entire game: it
reads MAIN_GAME_STATE (0x8805 `[seen]`) and jumps through the five-entry table at 0x06f0 to
the handler for that state — attract, the attract sub-phase driver, an in-play path, or a
bare-return no-op. The selected handler does the frame's game work and returns into the
NMI's epilogue, which copies FLIP_SCREEN_FLAG (0x881f `[seen]`) out to the flip-screen
latch, re-arms the NMI enable, and returns to the interrupted main loop.

### The main loop and the display-command ring

Between NMIs the main loop (mainLoop, `[code]`) has one job: drain the display-command
ring. Producers throughout the game enqueue two-byte `{code, argument}` commands into a
32-slot ring at DISPLAY_CMD_RING_BUFFER (0x88c0-0x88ff `[code]`) through the write pointer
DISPLAY_CMD_RING_WRITE_PTR (0x88a0 `[code]`). On every pass the loop reads the read cursor
DISPLAY_CMD_RING_READ_PTR (0x88a1 `[code]`) and inspects the slot it points at. A non-empty
slot is a command: the loop frees the slot, advances the cursor (wrapping through the
0xc0..0xff window), and transfers to the command's drawing handler via the sixteen-entry
table at 0x0242, which paints the requested tiles or HUD field. An empty slot (high bit set —
boot fills the ring with 0xFF) means no command is pending, so the loop runs the per-frame
scroll worker and spins straight back to re-check the cursor. It never waits for the beam; it
just keeps consuming queued commands and, when none remain, re-running the worker on every
pass, until the vblank NMI preempts it. All the producers' queued commands are therefore
drained within the vblank interval, and the NMI still fires exactly once per frame however
many commands were queued.

### State selectors — the dispatch spine

The game is a nest of small state machines, each one a single work-RAM byte that indexes a
jump table. MAIN_GAME_STATE (0x8805 `[seen]`) is the top level. Under it sit the finer
selectors, each masked to the width of its table: ATTRACT_SUBSTATE (0x8e51 `[seen]`)
sequences the attract/demo through table 0x08a1; PLAY_STATE_INDEX (0x880a `[seen]`), masked
to five bits, steps the in-play round and intro phases through table 0x15a8;
INTRO_PHASE_INDEX (0x8f51 `[code]`) walks the level-intro phases 0..6 through table 0x6daa;
MAINLOOP_SUBSTATE_SELECTOR (0x8f5c `[code]`), masked to three bits, selects a HUD sub-phase
through the inline table at 0x0fe3; and SELFTEST_DISPATCH_STATE (0x8921 `[code]`), masked to
two bits, routes the boot self-test and display phases. Handlers advance these selectors
themselves — a phase completes by writing the next index — which is how the machine moves
through attract, intro, and play without any central sequencer.

Beside the selectors sit the gate flags a handler consults before doing anything.
GAME_ACTIVE_FLAG (0x8806 `[seen]`) is 1 only between start-of-life and game-over, and
gameplay handlers return early when it is 0; ROUND_IN_PROGRESS (0x8904 `[seen]`) marks a
live round; and BOARD_CLEAR_FLAG (0x89e5 `[code]`) together with the anti-tamper freeze
flags diverts or freezes the per-frame object updates when set.

### Configuration, decoded once at boot

A run of cells near the base of work RAM caches the DIP switches, each decoded — complemented
and masked — once during boot so the rest of the game reads a plain value. BONUS_AWARD_DSW
(0x8800 `[code]`) selects the extra-life award schedule; DIFFICULTY_DSW (0x8820 `[code]`) is
the three-bit difficulty that scales spawn schedules and thresholds; DEMO_SOUNDS_DSW
(0x8821 `[code]`) and CABINET_MODE_FLAG (0x880f `[code]`) hold the demo-sound and
cocktail settings; COINAGE_CONFIG (0x882c `[seen]`) and COINAGE_CONFIG_SLOT2 (0x882f
`[code]`) hold the two coin slots' coinage nibbles, where 0x0f means free play; and
LIVES_DSW (0x8807 `[code]`) is the starting life count seeded into both players.

### Credits, scores, lives, and the high-score table

CREDIT_COUNT (0x8802 `[seen]`) is a BCD credit counter: a coin adds one, a one-player start
consumes one and a two-player start consumes two. ACTIVE_PLAYER (0x880d `[seen]`) picks
which player's banks are live and TWO_PLAYER_FLAG (0x880e `[seen]`) marks a two-player game.
Each player keeps a three-byte BCD score buffer — P1_SCORE_BCD (0x88a2 `[seen]`) and
P2_SCORE_BCD (0x88a5 `[seen]`) — while the running high score sits at HIGH_SCORE_BCD (0x88a8
`[code]`) with its most-significant byte at HIGH_SCORE_BCD_HI (0x88aa `[seen]`); a fresh
score is compared most-significant-byte-first and copied up when it wins. The ten-entry
sorted high-score table lives at HIGH_SCORE_TABLE (0x8a00 `[code]`), three BCD bytes per
entry, with a parallel play-time side-table at HIGH_SCORE_TIME_TABLE (0x89e0 `[code]`)
shifted in lockstep on each insert. The two players' remaining lives are PLAYER0_LIVES
(0x8948 `[seen]`) and PLAYER1_LIVES (0x8988 `[seen]`), each seeded from LIVES_DSW and drained
on death.

### The live game-state page and its player banks

The heart of in-play state is a roughly 0x40-byte page beginning at 0x8900 that the two
players share by swapping. When play changes hands the live page is copied out to the
inactive player's saved bank — PLAYER0_STATE_BANK (0x8940 `[seen]`) or PLAYER1_STATE_BANK
(0x8980 `[seen]`) — and the other bank copied back in, the direction chosen by ACTIVE_PLAYER.
So the addresses at 0x8900 always mean "the current player's game", and each bank is a
frozen snapshot of the other player's game between turns.

Inside the live page the round machinery runs: SPEED_INDEX (0x8900 `[seen]`) is the enemy
speed/difficulty index that escalates with the round; STAGE_COUNTDOWN (0x8901 `[seen]`)
drains across a stage; SPAWN_PHASE_COUNTER (0x8902 `[seen]`) and WAVE_ARRIVAL_COUNTER
(0x8903 `[seen]`) step the spawn/arrival cycle; ROUND_COUNTER (0x8907 `[seen]`) is the HUD
round number whose low bits pick stage variants and index difficulty tables;
GAUGE_PHASE_COUNTER (0x8908 `[seen]`) drives the vertical HUD gauge and fires the
phase-exhausted path at zero; and AWARD_QUEUE (0x8909 `[code]`) meters the pending bonus
award. A block of per-frame timers and toggles follows from FRAME_TIMER_BLOCK_BASE
(0x8928 `[code]`): the SHARED_FRAME_DELAY_TIMER (0x8929 `[code]`), the blink pair
BLINK_COUNTDOWN/BLINK_PHASE (0x892a/0x892b `[code]`), the animation flip toggles
ANIM_PHASE_TOGGLE_892C (0x892c `[code]`) and LAUNCH_FLIP_COUNTDOWN (0x892f `[code]`),
WAVE_NUMBER (0x892d `[code]`), and the shared phase pair SHARED_PHASE_COUNTDOWN/GATE
(0x892e/0x8930 `[code]`) — with the rope state (ROPE_SEGMENT_COUNT 0x8931 `[seen]`,
ROPE_DRAW_COUNT 0x8934 `[seen]`) just above.

The wider round-and-wave machinery lives in the 0x8d00 and 0x8f00 pages. The enemy spawn
cadence is metered by ENEMY_SPAWN_TIMER (0x8d07 `[seen]`) and ACTIVE_ENEMY_COUNT (0x8d40
`[seen]`); the lane spawns by LANE_SPAWN_COUNTDOWN (0x8d75 `[seen]`), ACTIVE_LANE_COUNT
(0x8d79 `[seen]`) and WAVE_PROGRESS_COUNTER (0x8d7d `[seen]`); the arrow/rope launch by its
own state machine (LAUNCH_STATE 0x8f30 `[seen]`, LAUNCH_ARM_LATCH 0x8f20 `[seen]`,
LAUNCH_ARMED_FLAG 0x8f3f `[seen]`); and the eagle attack waves by WAVE_INDEX (0x8f3d
`[seen]`), WAVE_HOLD_TIMER (0x8f36 `[seen]`), WAVE_RECORDS_ARRIVED (0x8f39 `[seen]`),
FORMATION_STATE (0x8f08 `[seen]`) and WAVE_TEARDOWN_STATE (0x8f24 `[seen]`). Target-hit
accounting for the end-of-level bonus compares TARGET_GROUP_COUNT (0x8f47 `[seen]`) against
HIT_TALLY (0x8f52 `[code]`). The attract/intro text-draw script runs on its own cursor and
timer — SCRIPT_FRAME_TIMER (0x8e50 `[seen]`), SCRIPT_WRITE_PTR (0x8e56 `[seen]`) and
ANIM_SCRIPT_CURSOR (0x8f00 `[seen]`).

### Actor and object arenas

Moving things live in fixed-stride record arrays, each addressed by a base pointer and swept
once per frame. The main actor arena begins at ACTOR_TABLE (0x8a80 `[seen]`), 0x18 bytes per
record, zero-filled at board init; slot 0 is the player/lead actor, whose vertical position
is PLAYER_Y (0x8a84 `[seen]`), input/aim byte is PLAYER_AIM_FLAGS (0x8a87 `[code]`), and
state/phase index is LEAD_ACTOR_STATE (0x8a82 `[seen]`) — that state byte selecting the
lead actor's per-frame handler through a six-way dispatch. The enemy records continue at
ENEMY_ACTOR_TABLE (0x8ae0 `[seen]`). Separate pools hold the other object classes: a
secondary object pool at SPRITE_OBJECT_TABLE (0x8b70 `[seen]`), the projectile table at
PROJECTILE_TABLE (0x8be8 `[seen]`), formation records at FORMATION_TABLE (0x8c30 `[seen]`)
and FORMATION_SPAWN_TABLE (0x8c60 `[code]`), spawned objects at SPAWN_OBJECT_TABLE (0x8c48
`[seen]`), the hunter table at HUNTER_TABLE_BASE (0x8c78 `[code]`), and the two-entry
enemy/target pair ENEMY_TARGET_REC0/ENEMY_TARGET_REC1 (0x8c90/0x8ca8 `[seen]`). Each
per-frame handler reads a record's state byte at offset +2, dispatches to that state's step,
and writes the record's next state — the same selector-plus-table pattern as the top-level
machine, applied per record. What these arenas produce is rebuilt every frame into the
sprite display list at SPRITE_DISPLAY_LIST (0x8840 `[seen]`) and copied out to the two sprite
banks.

### The command rings and animation cursors

Two ring buffers decouple producers from the hardware. The display-command ring at 0x88c0,
described above, is drained by the main loop. The sound-command ring at SOUND_RING_BUFFER
(0x8a43 `[code]`), with its tail and head pointers SOUND_RING_WRITE_PTR/SOUND_RING_READ_PTR
(0x8a40/0x8a41 `[code]`), collects sound requests that the NMI hands one at a time to the
audio CPU. Separately, tile-animation cursors march animated tile strips across the
playfield: TILE_ANIM_CURSOR (0x88be `[seen]`) points into video RAM, and TILE_ANIM_PARITY
(0x8f37 `[seen]`) selects whether the current frame advances or retreats the strip.

### Anti-tamper flags and the stack

The ROM is threaded with self-checksums, and each has a work-RAM strike counter it bumps on
a mismatch — TAMPER_FREEZE_FLAG (0x881e `[code]`) and a cluster of siblings around
0x89e7-0x8a3c and 0x8df8-0x8df9, all `[code]`. A nonzero strike freezes spawns, aborts actor
updates, or diverts handlers onto a board-reset path; on an intact ROM they hold zero. The
Z80 stack initialises to 0x9000 and grows downward into the top of work RAM; the measured
scratch window 0x8fc0-0x9000 is excluded from state comparison, and the boot deliberately
reserves the very top word (0x8fff, ROM_SELFTEST_TALLY `[code]`) above the stack so the NMI's
register save cannot clobber it.

## The frame loop and the vblank heartbeat

Everything the machine does is organised around one rhythm: the vertical-blank interrupt, which fires
once per displayed frame. Between beats the CPU runs a small foreground loop whose only job is to
service the display; the interrupt itself carries the game. So the machine runs two streams of work at
once — a foreground loop that empties a queue of drawing commands into video RAM, and a background
interrupt that samples the controls, ticks the frame timers, feeds the sound chip, and runs the actual
game-state logic. The foreground loop free-runs with no wait for vblank; the interrupt cuts across it
asynchronously once per frame. Understanding the machine means understanding how those two halves hand
work back and forth, and how the boot code stitches them together at power-on.

### Reset and boot

At power-on the CPU begins at the reset vector `loc_0000` [code]. Its first act is defensive: it clears
`NMI_ENABLE_LATCH` [code] — bit 0 of the LS259 output latch that gates the vblank interrupt — so that
no interrupt can fire while the machine is still uninitialised. Only then does it fall through into the
boot entry `loc_0092` [code].

The boot entry does two large things in sequence. First it verifies itself: it walks the eight 4K
program-memory banks, folding each into a 24-bit rolling checksum and comparing that against a stored
reference, and records how many banks matched in `ROM_SELFTEST_TALLY` [code]. That tally is deliberately
parked at the very top of memory, one byte above the initial stack pointer, so that the per-frame
interrupt's register-saving can never overwrite it — a later attract-setup step refuses to proceed until
the tally shows a full pass. Second, it lays down the entire initial machine state: it zeroes work RAM,
marks both the display-command and sound-command rings empty and parks their read and write cursors at
their origins, floods the colour map, arms the tile-fill, decodes the two DIP-switch banks into their
configuration cells, blanks the sprite banks and lower tile map, and silences the audio CPU. It sets
`FLIP_SCREEN_FLAG` [seen] to the upright orientation.

Near the end the boot writes `NMI_ENABLE_LATCH` [code] back to 1, re-arming the vblank interrupt it had
suppressed at reset. The interrupt goes live before the last of the init runs: only after re-arming does
the boot lay down the default high-score table and clear the panel digit source. It then drops into the
foreground loop, which runs forever. From this point the machine is live: the heartbeat is beating, and
the boot code is never reached again.

### The foreground loop

The foreground loop, `mainLoop` / `loc_020f` [code], is a display-command interpreter. It reads its
position from `DISPLAY_CMD_RING_READ_PTR` [code], a cursor that walks the 32 two-byte slots of the
`DISPLAY_CMD_RING_BUFFER` [code] (the region 0x88c0..0x88ff on the work page), wrapping from the last
slot back to the first. Each pass inspects the slot the cursor points at. If the slot's high bit is set
— the marker the boot writes into every empty slot — there is no command waiting there, so the loop runs
its per-frame worker `loc_0254` [code] and starts over, without advancing the cursor. If the high bit is
clear, the slot holds a queued drawing command: the loop frees that slot (restoring the empty marker),
advances the cursor to the next slot, and dispatches a small drawing handler chosen by the command's low
bits through a table of handlers based at 0x0242. Each such handler paints its piece into video RAM and
returns to the top of the loop, so the loop keeps consuming commands back-to-back.

This is the key to the loop's timing. The game logic running inside the interrupt enqueues drawing
commands into the ring each frame; the foreground loop drains them as they appear, one command after
another, until it reaches a slot that is still empty. When it lands on an empty slot it does not stop and
it does not advance — it re-reads that same empty slot and runs the per-frame worker `loc_0254` [code]
again on every pass, busy-spinning over the drained ring. The worker repaints the scroll tile columns
(or, when signalled, runs a program-signature integrity check instead), and it runs many times over
while the ring stays empty, not once. The CPU never waits; it spins here until the heartbeat breaks in.
What breaks the spin is not another unit of foreground work but the vblank interrupt: once per frame,
when the beam reaches vertical blank, the interrupt fires asynchronously, preempts the loop wherever it
is, and does the frame's real work inside itself.

### The vblank heartbeat

The interrupt entry `loc_0066` is a bare jump straight into the service routine `loc_066d`, which is the
heartbeat proper. It begins by pushing the entire register file — the main set, the shadow set, and both
index registers — so that whatever the foreground loop was doing is preserved untouched, and it clears
`NMI_ENABLE_LATCH` [code] so the interrupt cannot re-enter itself while it runs. It then performs the
frame's background work in a fixed order:

It rebuilds the sprite attributes: a copy loop distributes the 24-entry sprite display list into the two
sprite RAM banks, run once over the full list in most states and as four separate record groups when
`PLAY_STATE_INDEX` [seen] has reached its fourth value.
It kicks the watchdog by writing to `DSW1_PORT` [code] — that address reads the DIP switches but its
write side is the hardware watchdog timer, so this single write per frame is what keeps the machine from
resetting itself; if the heartbeat ever stopped, the watchdog would fire. It then rotates a three-deep
input history ring and samples the three hardware controller ports — reading each active-low port,
complementing it, and storing the fresh reading at the head of the ring, `INPUT_PORT0` [seen], with the
prior frames' samples shifted down behind it so the game can detect the edges of coin, start, and
control presses rather than just their levels.

Next it ticks the two per-frame counters. `FRAME_COUNTER` [seen] is decremented every beat — a
free-running down-counter whose low bits phase the animations and whose zero-crossings gate the periodic
integrity checks. `WORKER_CONTROL_BYTE` [code] is likewise decremented every beat; it is the channel by
which the interrupt speaks to the foreground worker `loc_0254`, whose low nibble tells the worker whether
to run its signature check and whose bit 4 gates a scroll-column blank. The interrupt then runs the
credit-and-coinage servicing chain (which strobes the coin-counter outputs, skipping entirely when a
coinage cell reads free-play) and drains one entry from the sound-command ring toward the audio CPU via
`loc_0e64` [code].

### The main-state dispatch

Only after all that fixed per-frame work does the heartbeat run the game itself. It reads
`MAIN_GAME_STATE` [seen] — the top-level state selector — and dispatches through a five-entry table
based at 0x06f0 to the handler for the current mode: state 0 to the attract handler `loc_072d` [code],
states 1 and 2 to the intro handlers, state 3 to the play handler at 0x159b, and state 4 to the do-nothing
handler `loc_0e53` [code]. `MAIN_GAME_STATE` [seen] cycles among 0, 1, and 3 while the machine is
attracting and steps 0→1→2→3 into play, so this one selector is what makes the same heartbeat serve the
attract movie, the round intro, and live gameplay. The chosen handler runs the whole of its mode's
per-frame logic and returns into the interrupt's epilogue.

That epilogue closes the frame. It copies `FLIP_SCREEN_FLAG` [seen] into bit 7 of `FLIP_SCREEN_LATCH`
[code], re-asserting the screen orientation to the hardware each frame; it restores the full register
file it saved on entry; it writes `NMI_ENABLE_LATCH` [code] back to 1 to re-arm itself for the next
vblank; and it returns to the exact point in the foreground loop it had interrupted. The foreground loop
resumes draining whatever drawing commands this frame's game logic just enqueued, works its way back to
an empty ring, and once again busy-spins over the drained ring — until the next beat.

## Configuration, coinage and players

The cabinet is configured once at power-on from two DIP-switch banks, and thereafter the machine
lives in a small state machine that accepts coins, converts them to credits, spends those credits to
start a one- or two-player game, and — in a two-player game — alternates between two independent
player banks. This section follows that whole path, from the switches through the credit meter to the
per-player state and the screen orientation.

### Power-on configuration: decoding the DIP switches

Everything downstream reads work-RAM config cells, never the hardware ports directly; the boot entry
`loc_0092` [code] samples the two DIP-switch ports one time and expands them into those cells.

DSW bank 1 is read from `DSW1_PORT` [code] (0xa000 — the same address the watchdog is kicked through
on the write side). The port is active-low, so the boot complements it and then rotates it a field at
a time, masking each field into its own cell: bits 0-1 become the lives setting, bits 4-6 the
difficulty, and single bits become the cabinet, bonus-award, and demo-sound flags. Concretely:

- **Lives.** Bits 0-1 seed `LIVES_DSW` [code] (0x8807). The two-bit value maps to 3, 4, or 5 lives
  (value + 3); the fourth combination is stored as the sentinel 0xff (a "special" free-life setting).
  This cell is later copied into both players' life counters at board reset.
- **Cabinet.** Bit 2 seeds `CABINET_MODE_FLAG` [code] (0x880f), the upright/cocktail selector consumed
  by round init to decide whether the screen flips per player.
- **Bonus award.** Bit 3 seeds `BONUS_AWARD_DSW` [code] (0x8800), which selects the extra-life award
  schedule — a queue reload of 5 or 3 and a BCD step of 8 or 7, read by the bonus-award tally.
- **Difficulty.** Bits 4-6 seed `DIFFICULTY_DSW` [code] (0x8820), a 3-bit value that scales enemy
  spawn schedules and threshold tables during play (and doubles as the player sprite colour at board
  reset).
- **Demo sounds.** Bit 7 seeds `DEMO_SOUNDS_DSW` [code] (0x8821), enabling attract-mode sound.

DSW bank 0 is read from `DSW0_PORT` [code] (0xa0e0) and holds the coinage for the two coin slots as
two nibbles. Each nibble is passed through the ROM lookup `COINAGE_TABLE` [code] (0x0053): the low
nibble produces `COINAGE_CONFIG` [seen] (0x882c) for slot 1, and the high nibble produces
`COINAGE_CONFIG_SLOT2` [code] (0x882f) for slot 2. A decoded value of 0x0f is the free-play sentinel.
Because these cells are seeded only at boot, changing a switch takes effect at the next power cycle,
exactly as the hardware intends.

### Accepting coins and awarding credits

Input arrives through the per-frame vblank service `loc_066d`, which reads the three hardware input
ports — IN0 (0xa080), `IN1_PORT` [code] (0xa0a0), and `IN2_PORT` [code] (0xa0c0) — complements them
(the switches are active-low), and stores them into the head of a small edge-detect history ring whose
first entry is `INPUT_PORT0` [seen] (0x8810). Within IN0, bit 0 is coin slot 1, bit 1 is coin slot 2,
bit 2 is the service switch, and bits 3 and 4 are the one- and two-player start buttons.

The same service routine then runs the credit chain `loc_59e8`. Its first act is a free-play
short-circuit: if either coinage cell (`COINAGE_CONFIG` or `COINAGE_CONFIG_SLOT2`) reads the free-play
sentinel 0x0f, it returns immediately — no coins are counted and no credits are metered, because play
is free. Otherwise it runs three coin acceptors and two coin-counter strobe generators, with a
periodic ROM-checksum integrity guard (`loc_7e6d` [code], which bumps a tamper-strike counter on a
signature miss) firing between the two strobes.

Each acceptor debounces one input bit through its own shift-register byte and fires only on a clean
rising edge (the low three bits of the shift byte reaching the pattern `001`); on that fresh edge it
emits the coin-insert sound before doing its slot-specific accounting:

- **Coin slot 1** reads IN0 bit 0. On a fresh coin it bumps the queued coin-counter pulse count
  `COIN1_PULSE_COUNT` [code] (0x8824), and adds to a running coin tally held
  in the byte just below `COINAGE_CONFIG` (that byte is `TAMPER_ROM_CHECK_FLAG` [code] (0x882b), an
  address reused for this coin accumulator). Once the tally crosses the threshold encoded in
  `COINAGE_CONFIG`, the accumulator wraps and the configured number of credits is awarded.
- **Coin slot 2** reads IN0 bit 1 through its own shift byte, bumps the slot-2 coin-counter pulse count
  (0x8826 — unnamed), and meters against `COINAGE_CONFIG_SLOT2`.
- **Service** reads IN0 bit 2 through its own shift byte and awards exactly one credit directly,
  bypassing the coinage math — the operator's free-credit button.

All three acceptors converge on the same accumulate tail, which adds the awarded amount to the credit
counter `CREDIT_COUNT` [seen] (0x8802) and clamps it to a maximum of 0x63 (99 credits), then queues a
display command so the on-screen total refreshes. The counter increments the moment a coin is
registered and otherwise holds steady during attract.

### The hardware coin counter (electromechanical meter)

The credits a coin buys are separate from the physical coin-counter meter the operator reads. The
acceptors above only *queue* pulses; the meter itself is strobed by `loc_5a9c` [code] and its twin for
slot 2. Each drives one bit of an LS259 output latch — slot 1 through `COIN1_COUNTER_LATCH` [code]
(0xa183), slot 2 through 0xa184 (unnamed) — turning a queued pulse into a timed on/off strobe: on a
fresh pulse it seeds a phase timer (0x30) and raises the latch (`COIN1_PULSE_PHASE` [code] (0x8825) is
the slot-1 phase); while counting down it lowers the latch at phase 0x18; and when the phase reaches
zero it retires one queued pulse. This produces the mechanical click of the coin meter, one strobe per
coin, independent of how many credits that coin bought.

### Showing the credit total

`loc_05ee` [code] draws the credit total onto the HUD. It reads `CREDIT_COUNT`, clamps it to 99,
converts it to packed BCD, and writes the two nibbles as digit tiles: the units nibble always to
`CREDIT_HUD_UNITS_VRAM` [code] (0x869f), and the tens nibble to `CREDIT_HUD_TENS_VRAM` [code] (0x86bf)
only when it is non-zero (so a single-digit credit count shows no leading zero). The same routine
carries a hidden anti-tamper tripwire — when the units digit happens to be 2 it sums a fixed 31-byte
program block and bumps a strike counter on a checksum miss — but that guard rides on top of the
credit draw rather than being part of it.

### Starting a game: spending credits, one or two players

The idle credit/start screen is one state of the top-level game state `MAIN_GAME_STATE` [seen]
(0x8805) — the state whose handler runs the start-button logic. That handler reads the debounced IN0
sample in `INPUT_PORT0` and branches on the start bits:

- **One-player start** (IN0 bit 3): if `CREDIT_COUNT` is non-zero it decrements it by one and enters
  the start-of-life setup with the player selection set to player 1.
- **Two-player start** (IN0 bit 4): it requires at least two credits (`CREDIT_COUNT` >= 2), subtracts
  two, and enters the same setup with the two-player selection.

The gate `loc_7fd6` enforces the precondition around this: it does nothing unless a credit is present
*and* no game is already running (it checks the active player's life bank), and only then, on a start
button, does it hand off to the start handler — so start presses during a game or with no money are
ignored.

The start-of-life setup writes the player-selection pair in one stroke: `ACTIVE_PLAYER` [seen]
(0x880d) and, in the byte above it, `TWO_PLAYER_FLAG` [seen] (0x880e). A one-player start leaves both
zero; a two-player start leaves `ACTIVE_PLAYER` at 0 (player 1 goes first) and raises
`TWO_PLAYER_FLAG`. The setup then queues the intro display via `loc_0e54` [code] — which, when
`COINAGE_CONFIG` is the free-play sentinel, appends an extra "free play" credit line — raises the
in-play gate `GAME_ACTIVE_FLAG` [seen] (0x8806), and calls the board reset `loc_0e00` [code]. Board
reset is where the cabinet switches finally reach the players: it copies `LIVES_DSW` into *both*
players' life counters and copies `DIFFICULTY_DSW` into both players' sprite-colour bytes. When the
two-player flag is set, the setup additionally fires the second-player intro.

When a game ends, the machine does not go dark if money remains: the game-over path tests the credit
counter and returns to the credit/start state (forcing `MAIN_GAME_STATE` back to 2) whenever a credit
is left, so a waiting credit rolls straight into the next game; with the counter empty it drops back
to attract instead. (Under free play no coins are ever counted, so the credit counter stays zero and
this path always falls through to attract.)

### Per-player score/lives banks and alternation

A two-player game keeps two fully separate sets of state, and `ACTIVE_PLAYER` bit 0 is the switch that
selects between them everywhere:

- **Score.** `selectActivePlayerScoreBuffer` [code] returns `P1_SCORE_BCD` [seen] (0x88a2) when the
  bit is clear and `P2_SCORE_BCD` [seen] (0x88a5) when set. The score accrual `loc_0496` [code] adds
  to whichever buffer is active and keeps the shared high score in step, and the bonus-award tally
  `loc_18da` [code] reads the active player's score MSB to decide when to grant an extra life. Each
  score buffer accumulates only during its own player's turn and freezes after a swap.
- **Lives.** The bit selects `PLAYER0_LIVES` [seen] (0x8948) versus `PLAYER1_LIVES` [seen] (0x8988),
  each seeded from `LIVES_DSW` at board reset and drained one per death.
- **Saved state.** Each player owns a saved actor/state bank — `PLAYER0_STATE_BANK` [seen] (0x8940)
  and `PLAYER1_STATE_BANK` [seen] (0x8980) — that is swapped with the single live state page across a
  player change.

Alternation is driven by death. In a two-player game, when the active player dies the live page is
snapshotted back into that player's bank; if the other player still has lives, `ACTIVE_PLAYER` toggles
to them, and at the next round init `loc_1601` [code] restores their saved bank into the live page so
they resume exactly where they left off. `ACTIVE_PLAYER` flips 0->1 on player 1's death and 1->0 on
player 2's death. When both players are out of lives the game-over reset clears `ACTIVE_PLAYER` and
`TWO_PLAYER_FLAG` and drops the machine back to attract.

### Cabinet orientation

Pooyan is a vertical game: the manifest declares `orientation: "vertical"` with a 256x224 screen at
**ROT90**. Orientation is expressed at runtime through `FLIP_SCREEN_FLAG` [seen] (0x881f), which the
boot initialises to 1 (normal, upright) and which the per-frame service copies into the hardware
flip-screen latch `FLIP_SCREEN_LATCH` [code] (0xa187, bit 7) every frame. The flag also gates the
software mirror: `loc_0320` [code] runs the vertical sprite-list mirror pass only when the flag is
zero, leaving the display unmirrored in the normal orientation.

The flag is dynamic in a cocktail cabinet. `CABINET_MODE_FLAG` (from DSW1 bit 2) selects upright
versus cocktail; when it reads cocktail, round init sets `FLIP_SCREEN_FLAG` from the active player so
that player two's turns present a flipped screen facing the opposite seat, while player one's turns
stay upright. This is also why the machine reads two player-control ports: `IN1_PORT` serves the
upright/player-one controls and `IN2_PORT` the flipped/player-two (cocktail) controls.

## In-play progression and timers

Once the top-level game state reaches "play", almost everything that happens between the credit
screen and game-over is driven by a second, finer state machine layered underneath it. This section
describes that inner machine — how it is selected and stepped, the handlers that make up one life,
the block of RAM that carries the active player's progress, how two players share it, and the two
countdown timers the play loop feeds every frame.

### Entering the play machine each frame

The top-level selector `MAIN_GAME_STATE` (0x8805, [seen]) chooses one of five whole-game modes;
its "play" value routes each frame into `loc_159b`. That routine does two things in order: it ticks
the active player's BCD play-timer (`loc_7912`, [code], described below), then falls straight into
`loc_15a1`, the inner state stepper (not yet decompiled). `loc_15a1` reads the play
sub-state index `PLAY_STATE_INDEX` (0x880a, [seen]), masks it to five bits, and uses the result to
index an inline word table of handler addresses at 0x15a8, transferring control to the selected
handler. Control returns to a shared continuation at 0x15d1 afterward, so the machine is re-entered
cleanly on the next frame.

A parallel entry, `loc_1583` (not yet decompiled), can also tick the timer and run the same 0x15a8 selection on
a 16-frame cadence, but it is gated shut by the ROM-tamper strike counter `TAMPER_STRIKES_ROM`
(0x89ef, [code]): with an intact ROM that counter is zero and `loc_1583` returns before reaching the
timer or the selection, so `loc_159b` is the live path.

The 0x15a8 table holds nineteen live handler slots (index 0..18); the play handlers write specific
values back into `PLAY_STATE_INDEX` to jump the machine to a named phase rather than walking a plain
0,1,2… sequence, so the index takes discrete phase values (observed 1, 2, 3, 4, 7, 10, 13, 18 —
[seen]) rather than every integer.

### Sequencing one life: the phase handlers

The handlers form a spine that carries a life from board setup into steady play:

- **Index 0 — round init (`loc_1601`, [code]).** Blanks a tilemap row and bails until the row-fill
  drains, then clears the actor arena and a cluster of round-init cells, restores the active player's
  saved state page into the live page (see below), derives the first-entry vs. later-entry phase-timer
  seed, advances `PLAY_STATE_INDEX` to 1, sets the rope-segment count from the wave-arrival counter,
  and copies the round message string into the display buffer.
- **Index 1 — phase-timer hold + layout pick (`loc_16b7`, not yet decompiled).** Decrements `PHASE_TIMER`
  (0x8808, [seen]) and returns every frame until it expires, holding the machine here; on expiry it
  runs the per-phase setup and walks a decision tree keyed on the play-mode latch, `ROUND_IN_PROGRESS`
  (0x8904, [seen]), the in-play gate, and `ROUND_COUNTER` (0x8907, [seen]) to pick a
  graphic/layout pair, then bumps `PLAY_STATE_INDEX` to 2 (or forces it to 16 on the attract branch).
- **Index 2 — counter advance + level-start batch (`loc_175d`, not yet decompiled).** Advances a mod-0x1c tick
  and a one-shot; past those guards it either arms sub-state 13 or, on first entry of a level, marks
  `ROUND_IN_PROGRESS` = 1 and sets `WAVE_ARRIVAL_COUNTER` (0x8903, [seen]) to 2 (storing the literal,
  not incrementing the prior value), runs the level-start batch, and forces `PLAY_STATE_INDEX` to 3.
- **Index 3 — wave setup + spawn (`loc_17c1`, not yet decompiled).** Seeds four actor records with a table
  selected by the play-mode latch and `ROUND_COUNTER`, seats the shared script cursor, and steps the
  animators; in normal play it advances `PLAY_STATE_INDEX` to 4 (entering the main loop), while its
  other arms fan out a sprite group whose size is derived from `ROUND_COUNTER` into
  `TARGET_GROUP_COUNT` (0x8f47, [seen]) and leave the index at 15, or arm the bonus/eagle phase at 18.
- **Index 4 — the main per-frame play loop (`loc_18af`, not yet decompiled).** A fixed run of fourteen
  sub-handlers executed in order every frame (enemy AI, the arrow/rope logic, collision, scoring,
  the sprite-list rebuild). `loc_18af` does not itself touch `PLAY_STATE_INDEX`; the game stays in
  this state until one of its sub-handlers rewrites the index on a game event (a death or a stage
  boundary) to hand off to a transition phase. **Index 5 (`loc_19ee`, not yet decompiled)** is a
  sibling per-frame coordinator that runs six ordered sub-handler calls and never writes
  `PLAY_STATE_INDEX`; index 5 is not among the observed selector values and its role is unconfirmed.

### Lives, the phase gauge, and the transition/teardown phases

The remaining spine handlers implement losing a life, switching players, and tearing a life down.
Control reaches **index 7 (`loc_1a64`, not yet decompiled)** at a life/phase boundary. It runs a reset pair,
clears the once-per-round latch `loc_89e3` (0x89e3), and — if the in-play gate
`GAME_ACTIVE_FLAG` (0x8806, [seen]) is still open — decrements the active player's remaining-lives
count. That count lives at `GAUGE_PHASE_COUNTER` (0x8908, [seen]); when it is still positive after the
decrement, `renderPhaseGauge` (`loc_03c2`, [code]) repaints it as a five-cell vertical HUD stack
(count-1 filled cells from `PHASE_GAUGE_BASE_TILE` upward) and `PLAY_STATE_INDEX` is set to 10 for
player 0 or 11 for player 1. When the decrement reaches zero — the player's last life — `loc_1a96`
([code]) runs the exhaustion path: it bumps `PLAY_STATE_INDEX` once (to 8) for player 0 or twice (to 9)
for player 1, and clears the rope-segment count and related cells. If the in-play gate is already
closed, `loc_1a64` instead tails to `loc_1d3c` (presumed the game-over/return path); `loc_1d3c` is
not yet decompiled, so the cells it clears and whether it restarts the top-level state are not
verified here. When the
play-mode latch is set, `loc_1a64` diverts to `loc_1a01` (not yet decompiled), which bumps
`ROUND_COUNTER`, seats sprite attributes, arms or clears the launch latch, and ends by saving
the live page into the active player's bank (`saveLiveStateToPlayerBank` / `loc_1a47`, [code]).

- **Index 10 (`saveLivePageToPlayer0Bank` / `loc_1bab`, [code])** and **index 11 (`loc_1bcc`,
  [code])** are the death/switch handlers. Index 10 copies the live page into player 0's saved bank
  and — in a two-player game whose player 1 is still alive — latches `ACTIVE_PLAYER` (0x880d, [seen])
  to 1, then clears `PLAY_STATE_INDEX` to 0 so the next frame re-enters round-init and restores the
  now-current player. Index 11 mirrors this for player 1 (deselecting to player 0 when that player is
  still alive) and additionally folds a signature tripwire that bumps a tamper counter on a mismatch.
- **Index 8 (`loc_1b43`, [code])** and its sibling **index 9 (`loc_1b8c`, [code])** are the
  lives-exhausted teardown handlers reached from `loc_1a96`. Each ticks one row of the tilemap clear
  and bails while the fill is still draining; once drained, both flood the attribute columns, enqueue
  two display commands, run the shared integrity/timer handler `loc_7960` (below), and latch
  `PLAY_STATE_INDEX` to 12. There the two diverge: index 8 re-arms the tilemap fill, clears
  `PHASE_TIMER` to 0, and folds a rolling checksum over a fixed program block (bumping a tamper-freeze
  tally on a miss), while index 9 does not re-arm the fill and instead reseeds `PHASE_TIMER` to 0x60.
- **Index 13 (`loc_1c53`, not yet decompiled)** is a per-frame object driver split on frame parity
  (`ROUND_COUNTER` bit 0), running one of two object updaters and rebuilding the sprite list.
  **Index 18 (`loc_71b9`, not yet decompiled)** is the bonus/eagle-stage phase stepper, selecting one
  of three sub-phases from `WAVE_OUTER_PHASE` (0x8f38, [code]). Indices 15 and 16 select `loc_1d9c`
  and `loc_1d6e` in the 0x15a8 table, but both are not yet decompiled, so their roles are unknown; the
  one verifiable point is that index 16 is armed by `loc_16b7`'s attract branch, which writes 16 into
  `PLAY_STATE_INDEX`. Indices 12, 14, and 17 also remain outside the decompiled set.

### The live state page and per-player banks

Progression state is not scattered across RAM; it is packed into one 0x3f-byte "live page" starting
at `SPEED_INDEX` (0x8900, [seen]) — despite its name, 0x8900 is simply byte 0 of that page (the
active player's sprite colour / speed index). This whole page holds the active player's working
progress. Two saved copies exist, one per player: `PLAYER0_STATE_BANK` (0x8940, [seen]) and
`PLAYER1_STATE_BANK` (0x8980, [seen]).

The machine swaps this page in and out around player changes so each player keeps a private copy of
their progress: round-init (`loc_1601`) block-copies the active player's bank into the live page on
the way into a life, and the death/switch handlers (indices 10 and 11, and `saveLiveStateToPlayerBank`)
copy the live page back out into the departing player's bank before clearing the sub-state index. In a
two-player game whose partner is alive, that same handler flips `ACTIVE_PLAYER` (0x880d, [seen], gated
by `TWO_PLAYER_FLAG` at 0x880e, [seen]) so the next round-init restores the other player's saved page.

Because the bank is a byte-for-byte snapshot of the live page, each live-page cell has a saved twin at
the same offset. The most important such pair is offset +8: the active player's remaining-lives count
is `GAUGE_PHASE_COUNTER` (0x8908, [seen]) while live, and is saved as `PLAYER0_LIVES` (0x8948, [seen])
or `PLAYER1_LIVES` (0x8988, [seen]) in the banks — the same quantity, live vs. stored. Both are seeded
from the lives DIP setting `LIVES_DSW` (0x8807): `loc_0e00` ([code]), the new-board reset, writes the
lives value into both saved banks, seeds each bank's opening X and its sprite colour from
`DIFFICULTY_DSW` (0x8820), and clears the live page and the play-timer gates. From there the count
drains 3→0 per death and resets to 3 for the next game.

### The 0x8900 progression counters

The live page carries the per-round/per-stage counters that pace enemy behaviour and difficulty:

- `STAGE_COUNTDOWN` (0x8901, [seen]) counts down from 0x20 over a stage, gating actor AI near zero
  and selecting the stage label at its initial value.
- `SPAWN_PHASE_COUNTER` (0x8902, [seen]) cycles to 7, selecting spawn/fire-mode branches, and is
  snapshotted into the rope draw-count and a spawn cell.
- `WAVE_ARRIVAL_COUNTER` (0x8903, [seen]) is bumped per enemy arrival (capping 9→8); the extended
  rope-segment count `ROPE_SEGMENT_COUNT` (0x8931, [seen]) is bounded to this value minus two, and its
  parity picks a spawn variant.
- `ROUND_IN_PROGRESS` (0x8904, [seen]) is the 0/1 flag raised at level start that keys the render and
  state decision trees inside the phase handlers.
- `ROUND_COUNTER` (0x8907, [seen]) is the wave/round number, BCD-rendered as the HUD round figure; its
  bit 0 selects a stage-type/facing variant and the frame-parity used across handlers, and bit 1 gates
  the target-group fan-out; its low bits index the difficulty/speed tables (and `SPEED_INDEX` at 0x8900
  escalates with it).
- `AWARD_QUEUE` (0x8909, [code]) is a pending bonus-award BCD value, and `loc_890a` (0x890a) is a cell
  of not-yet-identified role (it carries no documented role in names.js — the grow/shrink animation
  toggle is a different cell, `ANIM_PHASE_TOGGLE_892C` at 0x892c); both are among the cells cleared at
  round-init.

### The BCD play timers and their gates

Each frame of play, `loc_159b` (and, when armed, `loc_1583`) ticks the active player's play-timer
through `loc_7912` ([code]). The routine first bails unless the in-play gate `GAME_ACTIVE_FLAG`
(0x8806, [seen]) is set, so the timer only advances during a live game. It then selects one of two
per-player timer banks by `ACTIVE_PLAYER`: player 0 uses gate `PLAY_TIMER_GATE_P1` (0x89e1, [code])
and counter bank `PLAY_TIMER_BCD_P1` (0x8a30, [code]); player 1 uses `PLAY_TIMER_GATE_P2` (0x89e2,
[code]) and `PLAY_TIMER_BCD_P2` (0x8a33, [code]). A nonzero gate byte suppresses the tick for that
player, so the two gates freeze each player's clock while the other is up (and both are cleared by the
new-board reset `loc_0e00`).

When the gate is open, `loc_7912` advances a per-frame sub-counter at the bank's base byte; a flag bit
at counter+1 picks the frame limit (0x3b or 0x3c). Below the limit it simply increments; at the limit
it rolls the sub-counter to zero and carries into the BCD digit bytes, where each digit rolls its low
nibble at 0x0a and its high nibble at 0x60 — i.e. proper BCD seconds/minutes.

The stored time is drawn and reset by the shared integrity/timer handler `loc_7960` ([code]), invoked
by the teardown handlers (indices 8 and 9). Alongside two program-block integrity checks that trip
only on a corrupted image, it splits the active player's minutes and seconds BCD bytes into hi/lo
nibble tiles up the video column at `PLAY_TIMER_DIGIT_VRAM` (0x862d), parts them with a spacer tile,
and then zeroes those timer digit bytes — so the accumulated play time is rendered and cleared at the
life/phase teardown while `loc_7912` accumulates it during play.

## The actor arena

Every moving thing on the playfield — the player's lead sprite, the descending enemies, the
projectiles and the objects they turn into — lives as a fixed-size record in one contiguous block of
work RAM. The block begins at `ACTOR_TABLE` [seen] and is carved into 0x18-byte records laid end to
end. Slot 0 is the player/lead actor; the enemy records begin 0x60 bytes in at `ENEMY_ACTOR_TABLE`
[seen] (four records past the base), and a second family of per-frame object-state records begins at
`OBJECT_STATE_RECORD_BASE` [code], running on into the three-slot `PROJECTILE_TABLE` [seen] beyond it.
A separate three-slot `SPAWN_OBJECT_TABLE` [seen] holds the objects an enemy drops when it reaches the
bottom. All of these share the same 0x18 stride, so a driver walks any family by adding 0x18 to a
record pointer each pass.

The records share a field vocabulary, though different actor families press the same offsets into
slightly different service. The two bytes at `+0x00`/`+0x01` are activity flags marking whether the
record is live, and `+0x02` is the state byte that selects which per-frame handler runs. Position is
carried as fixed-point: an object descending the screen keeps its 16-bit vertical position in
`+0x05`(low)/`+0x06`(high) and its per-frame step in `+0x09`, while a falling actor keeps its fraction
in `+0x03` and integer row in `+0x04` and its velocity in `+0x09`. The animation state occupies a
consistent group: `+0x0c`/`+0x0d` is a little-endian pointer into a ROM animation stream, `+0x0e` is a
frame-hold countdown, `+0x0f` is the current attribute byte and `+0x10` the current tile code. Higher
fields serve individual subsystems — `+0x11` is a frame timer, `+0x12` an animation-hold timer (a fresh
record seeds it to 0xff), `+0x13` a phase/spawn index, `+0x15`/`+0x16` a screen pointer or armed bit,
and `+0x17` a scan cursor.

### Per-frame dispatch

Two independent record families are stepped every frame, each by its own sweeper.

The object-state family is driven by `loc_76f4`, which points a record cursor at
`OBJECT_STATE_RECORD_BASE`, sets the 0x18 stride, and hands each of six successive records in turn to
`dispatchActiveObjectState` [code]. That handler ignores a record unless bit 0 of either of its first
two flag bytes is set; for a live record it takes the low two bits of the state byte at `+0x02` and
branches to one of four state handlers, each of which returns straight back into the sweep loop so the
next record can be serviced. State 0 (`loc_771d`) arms a fresh object: it holds off while the `+0x11` frame
countdown is still running, then pulls the next index from a spawn-ring counter, looks up a descriptor
word from a ROM table into `+0x15`/`+0x16`, seeds the object, advances its state byte, and falls
directly into state 1 so the new object also takes a move step the same frame. State 1 (`loc_7740`)
advances a live object: it steps the animation, moves the position by the signed speed in `+0x0a`, and
— once the object crosses into the next cell — bumps the state byte, reloads the `+0x11` timer, and
queues the object's sprite as a display command. State 2 (`loc_7790`) draws the
object twice, blitting a character pattern at its screen pointer and again one tilemap row above, sets
a drawn flag, then falls into the record-clear teardown. State 3 (`loc_7881`) is a periodic
self-integrity pass that checksums a span of ROM and a serpentine walk of video RAM and, on a clean
result, clears two spans and re-initialises the object slot; a ROM-block checksum mismatch aborts to a
bare `ret`, while only the video-RAM sum mismatch diverts, jumping into `loc_0320` [code] (the
flip-screen mirror routine). State 1 likewise closes with a checksum guard whose mismatch arm —
incrementing a counter — is reachable only on a corrupted image and never taken on an intact ROM;
state 2, by contrast, carries no such guard.

The enemy-record family is driven by `loc_6a7f` [code]. When the blink phase `BLINK_PHASE` [code] is
non-zero it walks eighteen records from `ENEMY_ACTOR_TABLE` at the 0x18 stride, handing each to
`loc_6a98` [code]; when the blink phase is clear and `WAVE_NUMBER` [code] equals 2 it instead runs a
one-shot tilemap-integrity checksum, latched so it fires only once per pass, whose two mismatch arms
are work-RAM tamper traps. `loc_6a98` skips a record whose `+0x01` byte is zero — the enemy driver
keys activity on that whole byte being nonzero, not on the bit-0-of-both-flag-bytes test the object
driver uses — then routes on `(state − 1) & 3`: index
0 runs the descent step `loc_6aa8` [code] and index 1 runs the screen re-init path `loc_67df` [code].
`loc_6aa8` steps the record's animation, subtracts the speed in `+0x09` from the 16-bit position in
`+0x06`/`+0x05` (a low-byte borrow decrementing the high byte), and — once the high byte reaches zero,
i.e. the object has reached the bottom row — re-arms the tilemap-sum latch `TILE_SUM_ONCE_LATCH` [code]
and advances the record's state byte. A fuller variant of the descent step, `loc_672a` [code], also
seats a matching free slot in `SPAWN_OBJECT_TABLE` when the landing row is reached: it bumps
`WAVE_ARRIVAL_COUNTER` [seen], marks the slot active, copies a biased X/Y into it, links the slot back
into the record's `+0x07`/`+0x08`, and re-arms the delay timer before advancing state and re-pointing
the animation at `ANIM_TABLE_3838` [code].

### Animation stepping

An actor's on-screen appearance is a small interpreter over a ROM animation stream. `setActorAnimation`
[code] (and its sibling `storeActorAnimationPointer` [code], which does the same for a record addressed
through the alternate index) arms an actor by storing a little-endian stream pointer into `+0x0c`/`+0x0d`
and resetting the frame index at `+0x0e` to zero, so the actor begins the new sequence at its first
frame.

`loc_4006` [code] steps that sequence once per call for a record (its sibling `advanceActorAnimFrame`
[code] is the identical walker for a record reached through the alternate index). It treats `+0x0e` as a
frame-hold: while it is non-zero the routine simply decrements it and returns, holding the current
frame. On expiry it walks the stream at `+0x0c`/`+0x0d` — a 0xff opcode reloads the stream pointer from
the next two bytes and re-reads (a jump/loop within the sequence), while any other byte begins a
three-byte frame record: the tile goes to `+0x10`, the attribute to `+0x0f`, and the third byte becomes
the new hold in `+0x0e`, after which the advanced pointer is written back to `+0x0c`/`+0x0d`. The ROM
sequences an actor is pointed at include `ANIM_TABLE_3829` [code] and `ANIM_TABLE_3838` [code], the
four-frame attribute/tile loops armed on descent.

A slower, coarser timer rides alongside the frame walker. `tickActorAnimHold` [code] gates on a
per-record animate-enable bit at `+0x0b` (falling back to acting only on even values of `ROUND_COUNTER`
[seen] when that bit is clear), and then only for an active, armed record. It counts the hold timer at
`+0x12` down; on underflow it steps the two-bit phase at `+0x13` down one and re-arms for the next step,
disarming the record once the phase reaches zero.

### Spawning into the arena

Two spawn sweepers feed the enemy family, each gated differently and each spawning at most one record
per frame.

`loc_6905` [code] is the delay-gated wave spawner. While the shared frame-delay timer
`SHARED_FRAME_DELAY_TIMER` [code] is running it just decrements it and returns, spacing spawns out over
time. Once the timer is clear it spawns nothing if the wave has already fully arrived (`WAVE_NUMBER`
caught up to `WAVE_ARRIVAL_COUNTER` [seen]) or the wave index has reached its limit of 8; otherwise it
walks eight enemy/state record pairs in lockstep — one cursor stepping through `ENEMY_ACTOR_TABLE`, the
other through `OBJECT_STATE_RECORD_BASE`, both by 0x18 — and spawns into the first pair whose enemy
record is empty, stopping the sweep the moment it does. (`WAVE_NUMBER` is read here as a wave/stage
index; note that elsewhere the same cell is reloaded as a per-frame countdown, a counterintuitive reuse
of one byte for two roles.) The per-pair spawn `loc_6931` leaves an already-active pair untouched
and keeps the sweep going; for an empty pair it activates both records, seeds their fields, arms the
actor's animation via `setActorAnimation` at `ANIM_TABLE_3838`, and reseeds the respawn delay. On the
very first spawn of a wave — recognised by `WAVE_NUMBER` still being zero — it also queues two wave
display commands (`WAVE_SPAWN_DISPLAY_CMD_A` [code] and `WAVE_SPAWN_DISPLAY_CMD_B` [code]) and paints
the arrival count to the HUD as two packed-BCD digits, the high digit at `WAVE_COUNT_HUD_HI` [code] and
the low digit one tilemap column below it. It then increments `WAVE_NUMBER`.

`loc_6a0f` [code] is the blink-phase spawner. It does nothing while `BLINK_PHASE` is clear, while an
animation phase toggle `ANIM_PHASE_TOGGLE_892C` [code] sits at its gate value, or while the spawn-delay
countdown `BLINK_COUNTDOWN` [code] is still running (each such frame merely ticks the countdown down).
Once the countdown reaches zero it sweeps eighteen records from `ENEMY_ACTOR_TABLE`, spawning into the
first empty one and aborting the sweep there. The per-record spawn `loc_6a35` activates and seeds
a fresh record, arms the spawn-delay countdown, then reads and bumps the phase toggle and chooses the
spawn animation by the pre-bump phase: phase 0 or 1 takes the early pointer `ANIM_PARAM_76D4` [code]
(phase 1 additionally re-arming the countdown to a longer value), phase 2 takes the mid pointer
`ANIM_PARAM_68EF` [code], and any higher phase takes the late pointer `ANIM_PARAM_6B0A` [code]. The
chosen pointer is installed through `setActorAnimation`.

Several leaf seeders stamp the fixed opening state into a fresh record. `initActorRecord` [code] writes
the spawn constants into `+0x00`/`+0x01`/`+0x02`, marks `+0x12` with 0xff, and stores a 16-bit datum at
`+0x16`/`+0x17`, handing the advanced record cursor back for the caller's build loop. `seedObjectRecord`
[code] fills a record from two source streams — a two-byte descriptor into `+0x06`/`+0x04` and a
two-byte coordinate into `+0x0c`/`+0x0d` — and clears the timer at `+0x0e`, advancing both stream
pointers. `stampObjectAndDecCounter` [code] reads a control byte, decrements a shared one-byte counter
in place, and stamps two fixed state bytes (`+0x13` and `+0x16`) into a record, reporting whether the
counter reached zero.

### Collision and teardown

`precheckCollisionBounds` [code] is the per-actor bounds test the collision scan runs before a fuller
check. It biases the actor's X by the screen orientation — reading `FLIP_SCREEN_FLAG` [seen] to add +6
upright or −2 flipped — forms the actor's Y plus an 8-pixel margin, and reports whether that biased Y
still clears the bottom limit of 0xe0, so an actor that has fallen off the bottom of the play area is
gated out of collision.

Records are torn down at several scopes. Within the object-state machine, a drawn object clears its own
record as the tail of its draw state. At board scope, `clearActorArena` [code] zero-fills the whole
0x200-byte arena from `ACTOR_TABLE` so a new board starts with no stale actor state.
`clearActorArenaAndCounters` [code] is the heavier teardown reached as a dispatch state: it zeroes a
0x241-byte span from `ACTOR_TABLE`, clears the round bookkeeping — `SPAWN_PHASE_COUNTER` [seen],
`WAVE_ARRIVAL_COUNTER` and `ROPE_SEGMENT_COUNT` [seen] — and forces the in-play sub-state
`PLAY_STATE_INDEX` [seen] to 6. The screen re-init path `loc_67df` combines a checksum with a rebuild:
it sums ten colour-map cells one tilemap row apart from `HUD_INTEGRITY_STRIP_A` [code] and, only on the
clean-image sentinel, raises `ROUND_IN_PROGRESS` [seen], seeds `PHASE_TIMER` [seen] and
`PLAY_STATE_INDEX`, clears the per-frame timer block at `FRAME_TIMER_BLOCK_BASE` [code], zeroes the
0x241-byte actor arena from `ACTOR_TABLE`, and repaints the playfield with a square of the blank tile
starting at `PLAYFIELD_PAINT_START` [code]; a failed checksum instead hands off to the per-object frame
updater without rebuilding.

## Waves, rope and launch

Three per-frame state machines deliver hazards onto the play grid, each keyed on a state byte
and paced by its own countdowns, each stepped once per frame from the main object loop. The
**eagle attack wave** marches a formation of enemies down onto their target cells; the
**arrow/launch sequence** arms and fires the player's shot and, on completion, drops a diving
hunter; and the **rope** grows a column of segments a cell at a time — the thing a descending
enemy can catch the player on — and later retracts it.

### The eagle attack wave

The wave's heartbeat is `loc_72a7` [code], run every frame, which reads three cells to choose one
of three behaviours. If `WAVE_LAUNCH_FLAG` (0x8f3a) [code] is clear no wave is in flight, so it
seeds the next one through `loc_72e1` and returns. If a wave is live but `WAVE_RECORD_COUNT`
(0x8f3c) [code] has fallen to zero, every enemy has retired, so it hands off to the inter-wave idle
handler `loc_73e3`. Otherwise it walks the wave's live records: it starts at `ENEMY_ACTOR_TABLE`
(0x8ae0) [seen] and steps 0x18 bytes per record for `WAVE_INDEX` (0x8f3d) [seen] × 2 records — two
enemies per wave index, with a count that computes to zero running a full 256-record pass, matching
the 8-bit down-counter — dispatching each record through the per-record handler `loc_72cf`.

Seeding a wave (`loc_72e1` [code]) happens only while the target slot `ENEMY_TARGET_REC0` (0x8c90)
[seen] is empty, so a new wave cannot launch until the previous wave's lead has cleared. It raises
`WAVE_LAUNCH_FLAG` and increments `WAVE_INDEX` (an unconditional +1); the observed 4→0 wrap of that
counter is enforced elsewhere, not in this seeding step. The fourth wave is
special: instead of populating records it merely bumps `WAVE_OUTER_PHASE` (0x8f38) [code] and reloads
the hold timer, deferring the real work a cycle. For every other wave it sets `WAVE_RECORD_COUNT` to
twice the index and initialises that many records from the four-byte-per-record
`EAGLE_WAVE_PARAM_TABLE` (0x7409) [code], copying a target column into record field +6, a tile into
+0x10, a target row into +4, and an attribute into +0xf, and marking field +0 active. Records whose
own low address carries bit 3 additionally take a flag byte at +3, and every record takes that flag
at +5. Finally it clears `WAVE_OUTER_PHASE` and the `WAVE_RECORDS_ARRIVED` (0x8f39) [seen] tally.

Between waves `loc_73e3` [code] idles on `WAVE_HOLD_TIMER` (0x8f36) [seen]: while the timer is
non-zero it ticks it down one per frame, returning the pre-decrement value that its caller reads
back. On expiry it queues a display command — opcode 6 carrying a parameter offset by the current
`WAVE_INDEX` — reseeds the hold to 0x18, and clears `WAVE_LAUNCH_FLAG` so the next call re-seeds.

`loc_72cf` [code] routes a single record. A record whose activity bit (bit 0 of fields +0 OR +1) is
clear is skipped. Otherwise the record's state byte at +2, bounded 0..2, selects one of three
handlers, each a clean hand-off that returns straight to the wave walk: state 0 is approach
(`loc_733c`), state 1 is dive/climb (`loc_7395`), and state 2 is retire (`loc_73ce`).

Approach (`loc_733c` [code]) waits for the flock's shared screen position to reach this record's grid
slot. The live coordinates are `EAGLE_X_COORD` (0x8c96) [code] and `EAGLE_Y_COORD` (0x8c94) [code]:
the column (X ≫ 3) must equal the record's target column at +6 or the one just before it, and the row
((Y ≫ 3) + 4) must fall inside a five-row window beginning at the target row at +4 — the target row
itself plus the four rows past it. On arrival it
advances the record state and arms an animation. An odd record (bit 3 of its low address set) gets
`EAGLE_ODD_RECORD_ANIM` (0x7403) [code] and writes 0x38 into field +9; an even record gets
`EAGLE_EVEN_RECORD_ANIM` (0x4086) [code], writes 0x40 into +9, and bumps `WAVE_RECORDS_ARRIVED`. When
the arrived count reaches `WAVE_INDEX` the whole wave has landed, so it queues the wave-arrival
display command `WAVE_ARRIVAL_CMD_BASE` (0x0630) [code] offset by the arrived count. The +9 field an
approaching record just set becomes the per-record descent speed the next state reads.

Dive/climb (`loc_7395` [code]) first advances the record's animation through the shared stepper
`loc_4006` [code], then integrates a one-byte fractional vertical position at +3 by the speed at +9.
An even-indexed record (low-address bit 3 clear) descends: it adds the speed, a carry out of +3 drops
the grid row at +4, and once the row reaches the bottom limit 0x1d it advances the record state. An
odd-indexed record climbs: it subtracts the speed, a borrow lifts the row, and once the row rises
above the top limit 0x04 it advances the state. Either way the advance moves the record into retire.

Retire (`loc_73ce` [code]) zero-fills the whole 0x18-byte record and decrements `WAVE_RECORD_COUNT`.
When that reaches zero the last enemy of the wave has gone, so it seeds `WAVE_HOLD_TIMER` to 0x30 —
the inter-wave pause `loc_73e3` will then drain before the driver seeds the following wave.

The animation each state leans on, `loc_4006` [code], is a small interpreter over a per-record
sequence stream: field +0x0e is a frame-hold that decrements each call, and on expiry it walks the
stream pointer at +0x0c:+0x0d — a 0xff opcode reloads the pointer from the next two stream bytes, any
other byte begins a three-byte frame (tile into +0x10, attribute into +0x0f, new hold into +0x0e) —
writing the advanced pointer back.

### The arrow/launch sequence

A second automaton, `LAUNCH_STATE` (0x8f30) [seen], is dispatched every frame with its low three
bits selecting one of five handlers, 0..4. It arms and fires the player's arrow and, at its tail,
seeds a diving hunter.

State 0 (`loc_278f` [code]) first arms the launch. If `LAUNCH_ARMED_FLAG` (0x8f3f) [seen] is still
clear it either bumps `LAUNCH_ARM_LATCH` (0x8f20) [seen] — when a lane spawn is running
(`LANE_SPAWN_COUNTDOWN` (0x8d75) [seen] non-zero) and that latch is clear — or else requires
`STAGE_COUNTDOWN` (0x8901) [seen] to be non-zero and a multiple of eight, then sets the armed flag.
With the launch armed it gates: it returns unless the launch object's height `ARROW_Y` (0x8ab4)
[code] has reached 0x3c and neither target record `ENEMY_TARGET_REC0` / `ENEMY_TARGET_REC1`
(0x8c90/0x8ca8) [seen] carries the hunter-hit bit (0x02). Clearing those gates, it advances
`LAUNCH_STATE`, reseeds the tile-flip countdown `LAUNCH_FLIP_COUNTDOWN` (0x892f) [code] to 8, and —
when the game is idle (`GAME_ACTIVE_FLAG` (0x8806) [seen] clear) with a play-mode or armed condition
set — lights the status cell `LAUNCH_HUD_TILE` (0x8508) [code]. It refreshes `LAUNCH_ARM_LATCH` from
`LAUNCH_ARM_LATCH_SEED` (0x8d7a) [code] when that seed is non-zero, and blits the arrow tile
`LAUNCH_TILE_SRC` (0x2d51) [code] at `LAUNCH_TILE_VRAM` (0x84a7) [code].

State 1 (`loc_27f3` [code]) animates the arrow while it is aloft and seeds a target once it has
descended. While `ARROW_Y` is at or above 0x34 it runs the flip countdown; each time that elapses it
reloads it to 0x10, steps `SHARED_PHASE_COUNTDOWN` (0x892e) [code], and blits one of two arrow tiles
chosen by that byte's parity (`LAUNCH_TILE_SRC` or `LAUNCH_TILE_SRC_ALT` (0x2d55) [code]). Once
`ARROW_Y` drops below 0x34 it looks for a free target record among `ENEMY_TARGET_REC0` /
`ENEMY_TARGET_REC1`; finding none it waits. A free record sends `LAUNCH_STATE` to 2, marks the record
active with the same value, queues a display command, blits the alternate tile, may light the HUD
cell, and seeds three of the record's fields (the middle one a copy of a source coordinate biased by
0x0c).

State 2 (`loc_2856` [code]) seeds the hunter itself. Unless `PLAY_MODE_LATCH` (0x8f50) [code] is set
it scans the six `HUNTER_TABLE_BASE` (0x8c78) [code] records downward, one 0x18 stride apart, for a
free slot (both leading bytes zero); with none free it bails untouched. A free slot is stamped with
its opening state, coordinates and tile ids, and its address is recorded in `HUNTER_RECORD_PTR`
(0x8f32) [code]. It then advances `LAUNCH_STATE` and, with `HUNTER_SPAWN_FLIP_FLAG` (0x8f61) [code]
clear, seeds `HUNTER_SPAWN_COUNTDOWN` (0x8f34) [code] to 0x20 and queues `HUNTER_SPAWN_DISPLAY_CMD`
(0x0315) [code]; with the flip flag set it instead advances `HUNTER_SPAWN_SUBCOUNTER` (0x8f5d)
[code].

State 3 (`loc_28ad` [code]) holds on `HUNTER_SPAWN_COUNTDOWN` — decrementing and returning while it
is non-zero — and on expiry advances `LAUNCH_STATE` and, unless `PLAY_MODE_LATCH` is set, clears the
0x18-byte record at `HUNTER_RECORD_PTR`. State 4 (`loc_28c5` [code]) is a bare no-op: the machine
rests there until `LAUNCH_STATE` is reseeded to begin the next arrow.

### The rope

The rope is a column of segments grown and later retracted a cell at a time. It is reached on the
branch taken while `ROUND_COUNTER` (0x8907) [seen] has its low bit clear, and that branch aborts
while a grab is in progress (`GRAB_ACTIVE_FLAG` (0x8d32) [seen] set) or while `WAVE_ARRIVAL_COUNTER`
(0x8903) [seen] equals 2. It splits into an extend driver that adds segments and a per-cell driver
that animates and eventually retracts each one.

The extend driver dispatches on `ROPE_EXTEND_STATE` (0x8f14) [code]. Its state-0 handler `loc_2d80`
[code] adds one segment. It stops once `ROPE_SEGMENT_COUNT` (0x8931) [seen] has grown to two below
`WAVE_ARRIVAL_COUNTER` — the rope's length is bounded by the stage's arrival count. Otherwise it
increments the segment count and, while `ROPE_EXTEND_INDEX` (0x8f18) [code] is below four (or, at four
and above, only if an anti-tamper strike is pending in `TAMPER_STRIKES_ROM` (0x89ef) [code], whose
value then serves as the table index), advances the index, looks this segment's video-RAM column base
up from `ROPE_CELL_COLUMN_TABLE` (0x2db8) [code] and stores it in `ROPE_COLUMN_VRAM_PTR` (0x8f19)
[code] under the fixed 0x84 tile page, reloads the new segment's cell timer in the stride-2
`ROPE_CELL_TIMERS` (0x8f28) [code] block, advances `ROPE_EXTEND_STATE`, and arms the sub-timer
`ROPE_EXTEND_TIMER` (0x8f16) [code] to 0x10. The state-1 handler `loc_2dbc` then runs that
sub-timer and, on expiry, blits the segment's tile at the stored column and either steps a per-cell
frame index or, once eight frames have elapsed, resets that index and re-arms the extend (back to
state 0) for the next cell.

The per-cell driver walks each active rope cell — there are `ROPE_EXTEND_INDEX` of them — through a
dispatcher that skips a cell whose state byte at +0 is zero and otherwise routes the state (minus one)
into the handler set below. Two shared helpers underlie every cell handler. `loc_2e45` [code] ticks
down the cell's own frame timer — the low two bits of the cell index pick one of four stride-2
entries in `ROPE_CELL_TIMERS` — reporting the timer's address and whether it hit zero. `loc_2e52`
[code] computes the cell's video-RAM column base from `ROPE_CELL_COLUMN_TABLE` under the 0x84 page.

The first cell handler, `loc_2e5e` [code], spawns a falling object and draws the segment. It acts
only on every fourth frame (`FRAME_COUNTER` (0x8a5f) [seen] low two bits clear) and only when the
cell timer elapses; it then scans the three `SPAWN_OBJECT_TABLE` (0x8c48) [seen] records for a free
slot. Finding none it leaves the timer re-armed to one and waits; finding one it rewrites the timer
with a reload scaled by `ROUND_COUNTER` (clamped to 0x10, biased by 0x28, complemented) plus the slot
index, seeds the slot's state, coordinates and tiles — its +4 field drawn from `ROPE_SPAWN_IY4_TABLE`
(0x2ec7) [code] keyed by the low two bits of the cell index — advances the cell state, blits the
segment tile `ROPE_SEGMENT_TILE_SRC` (0x2dfe) [code] at the column, and queues the segment's display
command.

The next handler, `loc_2ecb` [code], is a pure timer/animation step: on the frame its timer reaches
zero it writes a `ROUND_COUNTER`-derived tile index (the round clamped, doubled, biased by 0x18) into
the timer cell, indexes `FORMATION_TABLE` (0x8c30) [seen] by the byte following the timer plus one to
bump one record's tile field (+0xf), clear its position byte (+5) and drop another field (+6), bumps the
cell's own count, and blits the alternate segment tile `ROPE_SEGMENT_TILE_SRC_ALT` (0x2e1e) [code].

The following handler, `loc_2f01` [code], is the same step gated by the rope-grab test `loc_305f`.
That test looks this cell's catch-window half-width up from `GRAB_WINDOW_TABLE` (0x3087)
[code] and tests the tracked `PLAYER_Y` (0x8a84) [seen] against a fixed 0x0e-wide window around it:
outside the window, or while `FORMATION_STATE` (0x8f08) [seen] or `WAVE_TEARDOWN_STATE` (0x8f24)
[seen] is busy, no grab fires and the cell update proceeds; inside and idle it raises
`GRAB_ACTIVE_FLAG`, queues the grab command, and aborts the cell update — the moment a descending
enemy catches the player on the rope. When no grab fires, `loc_2f01` re-arms the timer to 0x0c,
applies its own `FORMATION_TABLE` edits (drop a tile field, force the position byte to 0xc0, bump
another), advances the cell state, and blits the primary segment tile.

The final cell state plays the per-cell retract animation (`loc_2f2f`): on the cell timer, and while
segments remain in `ROPE_SEGMENT_COUNT` — which it only reads — it selects a retract animation pointer
from a table keyed by `ROUND_COUNTER` (shifted right twice and clamped to 3) plus a cabinet-orientation
bit, reads a per-segment attribute byte, merges it into the paired cell, clears the matching
`FORMATION_TABLE` record, resets the cell state back to 1 — looping it back to the spawn handler rather
than advancing — and blits the segment. It does not itself decrement `ROPE_SEGMENT_COUNT`; that count
is reset elsewhere when the phase is exhausted.

## Rendering, HUD and display lists

The video hardware exposes two planes on the 0x8000 page. The lower half, from
`COLOR_RAM_BASE` (0x8000, [code]) up through 0x83ff, is the colour/attribute plane; its
gameplay-visible base is `ATTRIB_MAP_BASE` (0x8040, [seen]). The upper half, from
`VIDEO_RAM_BASE` (0x8400, [code]) through 0x87ff, is the tile-code plane, whose playfield tiles
start at `PLAYFIELD_TILE_BASE` (0x8402, [code]). Almost everything in this subsystem is a
memory write into one of those two planes; the machine has no framebuffer of its own, only these
tile and attribute maps that the display hardware scans out. Sprites are described separately, by
a display list the game rebuilds every frame. All of the routines described here are [code]-level
readings — their mechanism is confident from the code; the cells they touch carry their own tags.

### Clearing and filling the tile plane

At power-on the machine wipes both planes before it draws anything. It first floods the entire
colour/attribute map with the value 0x10, sweeping from `COLOR_RAM_BASE` up to and including
`VIDEO_RAM_BASE`, so the flood's last write spills one cell into the tile plane exactly as the
inclusive span dictates. It then arms a row-by-row fill of the tile plane and clears the sprite
banks and the lower tile region through the boot-clear routine `loc_01ea` ([code]), which fills
the top 0x30 bytes of each sprite bank (`SPRITE0_CLEAR_BASE` at 0x9010, [code], and its twin at
0x9410) with a caller-supplied byte and then blanks 0x3c0 tiles from `VIDEO_RAM_BLANK_START`
(0x8440, [code]) to the erase tile 0x1e.

The row-by-row tile fill is the machine's general "blank the playfield" mechanism, driven by a
cursor/counter pair. `seedTileFillCursor` ([code]) arms it: it stores a 16-bit write cursor into
`TILE_FILL_PTR` (0x880b, [seen]) and seeds the row counter `FILL_ROW_COUNTER` (0x8809, [seen])
to 0x20, i.e. 32 tilemap rows. `loc_02e3` ([code]) is the fixed-origin entry that arms the fill
from `PLAYFIELD_TILE_BASE`. A driver then repeatedly calls one of the per-row workers, which each
blank one row and step the cursor forward by exactly one full row: `loc_02ce` ([code]) blanks the
incoming count of cells (to blank tile 0x10) at the cursor, adds the row remainder (0x20 minus the
count) so the cursor lands at the next row, writes the cursor back, and decrements the row counter,
signalling drained when it hits zero. `loc_02c9` ([code]) is the board-init variant: it first zeroes
the board RAM through `loc_02b9` ([code]) — which clears the sprite display list region and the whole
actor/object arena from `ACTOR_TABLE` (0x8a80, [seen]) — then blanks the 0x1d visible cells of one
row and steps the cursor the same way. The row counter `FILL_ROW_COUNTER` (0x8809, [seen]) walks the
fill down over successive frames, one row each; its exhaustion ends the fill and advances the screen
state.

### Painting the colour/attribute plane

The colour plane is painted in column-major flood strokes. `fillAttributeColumns` ([code]) walks
31 columns from `ATTRIB_MAP_BASE`, reading one source byte per column and stamping it down all 30
rows at the 0x20 row stride, advancing the source pointer one byte per column — a single ROM (or
work-RAM) string thus colours the whole field, one colour per column.

The playfield's per-round colour scheme is chosen and stamped by `loc_1dd3` ([code]). It reads
`ROUND_COUNTER` (0x8907, [seen]) together with `ROUND_IN_PROGRESS` (0x8904, [seen]) and the
game-active flag to pick one of two jobs. The default job floods the columns from one of two
round-parity source tables — `FIELD_ATTRIB_SRC_A` (0x0839, [code]) when the round counter's low
bit is set, `FIELD_ATTRIB_SRC_B` (0x0879, [code]) when it is clear — then stamps a short marker of
colour code 0x0f four rows tall into columns 5 and 6 of `ATTRIB_MAP_BASE`. The alternate job, taken
only when the game is idle on an odd round (or round 0) and outside the play-mode hold, floods from
`FIELD_ATTRIB_SRC_C` (0x0859, [code]) and stamps a taller sixteen-row single-column strip of colour
0x09 at `FIELD_C_ATTRIB_DEST` (0x811c, [code]). The round counter therefore both selects the field
colours and marks the current field with a small overlay.

### The tile-block blitters

A family of small leaf routines stamps fixed-size tile blocks, all sharing the 0x20 row stride and
the wrap rules of the 256-byte tile page. `blit2x2TileBlock` ([code]) and `paintTileBlock2x2`
([code]) each copy four consecutive source bytes into a 2×2 square anchored at the top-left, while
`paintTileBlock2x2Above` ([code]) anchors at the bottom-left with the top row one row up — the three
differ only in corner write order and anchor. `blitTile3x3Block` ([code]) stamps a 3-wide, 3-tall
block, stepping down one screen row after each row of three, and `blitGlyphBlock4x3` ([code]) stamps
a four-row, three-column glyph, advancing the destination low byte alone within each row so it stays
inside its tilemap page. Vertical columns have their own painters: `blankTileColumn` ([code]) erases
a three-cell column to blank tile 0x10, and `paintColumnBodyTiles` / `paintColumnBodyTilesUp`
([code]) stamp a column's two body tiles — mid tile 0x25 then base tile 0x20 — one downward and one
upward respectively. Text is laid in by `copyBiasedTileString` ([code]), which copies a byte string
into a tile buffer adding a fixed +8 bias to every byte (reindexing character codes into display-tile
codes) until it hits the 0xa0 terminator.

### The sprite display list

Sprites are drawn from a 24-entry, four-bytes-per-entry display list based at `SPRITE_DISPLAY_LIST`
(0x8840, [seen]), which the game rebuilds from its actor and object records every frame. `loc_02ef`
([code]) is the rebuild driver. It copies four record groups into the list in turn: the two lead
actors from `ACTOR_TABLE`, the two enemy-target records from `ENEMY_TARGET_REC0` (0x8c90, [seen]),
the eighteen moving-object records from `ENEMY_ACTOR_TABLE` (0x8ae0, [seen]), and the two
arrow/launch records. The plain groups go through `copyObjectRecordsToDisplayList` ([code]), which
emits record bytes +0x06, +0x10, +0x04, +0x0f into four successive list slots per record — a
coordinate, an attribute/tile byte, a second coordinate, and a second tile byte — advancing the
list's low byte alone so writes wrap within the list page. The moving-object group instead uses
`loc_0343` ([code]), which does coordinate math: each on-screen coordinate is derived from a 16-bit
sub-pixel pair in the record, scaled down by five bits and biased by −8 to a pixel position, so the
objects track sub-pixel internal positions but render at whole-pixel screen positions. After the
copies, `loc_02ef`
nudges the arrow group's two sprite-Y bytes down one pixel each.

The player is drawn as three sprites stacked vertically. `deriveStackedSpriteYs` ([code]) fans the
player actor's base Y — `PLAYER_Y` (0x8a84, [seen]) — into the Y fields of three actor slots: the
bottom slot gets the base Y, the middle one Y−0x10, and the top one Y−0x10+0x0a, so the three
sprites abut into one tall figure that tracks the player's vertical motion.

When the cabinet runs in cocktail (flipped) orientation the whole list is mirrored.
`mirrorSpriteListVertically` ([code]) walks the stride-four list in place, negating and offsetting
each entry's two coordinate bytes (−x−0x10) and toggling the two flip bits in the attribute byte
while preserving its low nibble. The mirror is gated: `loc_0320` ([code]) ticks a caller-set
per-frame counter and then runs the mirror pass only when `FLIP_SCREEN_FLAG` (0x881f, [seen]) is
zero (screen flipped); while the flag is nonzero (normal upright) the list is left as built.

### The display-command ring and its interpreter

Rendering-and-state work that must happen "soon" but not inline is posted as two-byte commands into a
ring buffer at `DISPLAY_CMD_RING_BUFFER` (0x88c0, [code]), a 0x40-byte region of thirty-two two-byte
slots. A write cursor `DISPLAY_CMD_RING_WRITE_PTR` (0x88a0, [code]) and a read cursor
`DISPLAY_CMD_RING_READ_PTR` (0x88a1, [code]) index it by low byte, both wrapping back to the origin
0xc0; at boot the whole ring is filled with 0xff to mark every slot empty (bit 7 set means free).

Producers enqueue through `loc_0038` ([code]): if the slot the write cursor names is free (bit 7
set) it stores the command's high byte there and its low byte in the next slot, then advances the
write cursor by two, clamping it back up to 0xc0 on wrap; if the slot is occupied the command is
dropped. The command words are the `DISPLAY_CMD_*` and `WAVE_SPAWN_DISPLAY_CMD_*` constants — for
example `OBJECT_SPAWN_DISPLAY_CMD` (0x0611, [code]) and its zero-round variant
`OBJECT_SPAWN_DISPLAY_CMD_ALT` (0x0607, [code]), both posted by the object seeder `loc_6523`
([code]) as it seats a fresh object record; `WAVE_SPAWN_DISPLAY_CMD_A` (0x0625, [code]) posted on the
first spawn of a wave; `DISPLAY_CMD_0600` (0x0600, [code]) posted by state handlers; and
`COUNTDOWN_EXPIRE_DISPLAY_CMD` (0x0312, [code]) posted on a countdown-expiry, whose low byte is
offset by a per-record value before enqueue.

The ring is drained and interpreted by the main loop, which free-runs. Each pass it reads the slot at
the read cursor and tests bit 7. When the slot is occupied (bit 7 clear), the machine dispatches: the
command's high byte, doubled and masked to an even offset, indexes a handler table at the fixed
dispatch base (0x0242), and the command's low byte is handed to the selected handler as its argument.
Both slots of the consumed command are marked free (0xff) and the read cursor is advanced by two
(wrapping to 0xc0), and the loop keeps draining. When the slot is empty (bit 7 set), there is no
pending command: the machine runs the worker at loc_0254 — its render/update pass — then loops
straight back to re-read the cursor, busy-spinning here (re-running the worker on every pass) rather
than idling. It is the vblank NMI, firing asynchronously once per frame, that bounds this free run;
a single main-loop pass is not a frame. Because the loop clears every queued command between one
vblank and the next, the whole ring is processed within a frame rather than one command per frame.
This matters: a backlog built up during, say, the credit screen must clear in a single frame, or
stale tiles would linger on the playfield.

A separate, smaller command ring lives on the 0x8a page and carries fixed tile-run bytes rather than
two-byte words. `loc_0f97` ([code]) is its round-derived producer: it picks a command byte from
`ROUND_COUNTER` bits 1..2 plus a base of 0x1e, then appends a fixed four-tile run through `loc_0fc3`
([code]), which emits the caller's byte followed by the three tiles 0x15/0x16/0x17. `loc_6505`
([code]) — a dispatch handler that seats three object records and bumps their phase bytes, seeding
`SHARED_FRAME_DELAY_TIMER` (0x8929, [code]) and `BLINK_PHASE` (0x892b, [code]) first — emits a
similar run as its final act. The underlying append, `loc_0ea2` ([code]), stashes the byte, then
(only while the game is active or the play-mode latch is held) writes it into the ring page at the
current cursor and advances the cursor one slot, wrapping the last slot (0x5e) back to the first
(0x43); when both gates are closed it drops the byte. (This 0x8a-page ring is distinct from the
0x88-page display-command ring above, and its buffer is shared with sound-side enqueues — see the
notes.)

### The display-list interpreter

Static screen layouts — the attract-mode field, panels, and similar — are painted by a small
byte-stream interpreter, `loc_4381` ([code]), that copies a source stream into the colour/attribute
or tile plane under a few opcodes. It selects a destination/source pointer pair: the primary pair `DISPLAY_LIST_DST_PTR`
(0x8f43, [seen]) and `DISPLAY_LIST_SRC_PTR` (0x8f45, [seen]), or the alternate pair
`DISPLAY_LIST_DST_PTR_ALT` (0x88b8, [code]) / `DISPLAY_LIST_SRC_PTR_ALT` (0x88ba, [code]) when
`FORMATION_SLOT_TABLE` (0x8920, [seen]) is nonzero. It then walks up to 0x1d source bytes: a plain
byte is copied to the destination and both pointers advance; a skip opcode (0x10) advances the
destination by the following byte and shrinks the remaining count; a reload opcode (0xff) loads a
fresh destination pointer from the next two stream bytes and folds the byte after that into
`SUBPHASE_TICK` (0x88b7, [seen]). On exit it writes the advanced pointer pair back, so successive
calls resume mid-stream. The attract/self-test entry `loc_744e` ([code]) is what seeds these pointer
pairs (from the attract layout seeds — the primary destination 0x8042 sits in the colour/attribute
plane, the alternate 0x8442 in the tile plane) and clears the sub-phase tick before the first interpret pass,
alongside its program-signature check.

### HUD number primitives

HUD numbers are packed BCD painted as stacked digit tiles. Three conversions feed the painters.
`binToPackedBcd` ([code]) turns a binary count into its low two decimal digits (count mod 100),
packed into one byte, plus a hundreds tally; a count of zero means a full 256 passes, producing
digits 0x56 and hundreds 2. `byteToPackedBcd` ([code]) converts a binary byte to its packed-BCD form
(value mod 100) faithful to the Z80's decimal-adjust. `splitBcdByte` ([code]) is the render-time
splitter: it writes a packed byte's low nibble as a tile at the cursor, advances the cursor, and
hands back the high nibble, signalling zero for leading-zero suppression.

Two routines paint the digits themselves. `drawStackedBcdDigits` ([code]) paints a packed byte as
two stacked tiles — tens at the cursor, units one tilemap row up (toward lower addresses) — blanking
a zero tens digit to tile 0x10 for leading-zero suppression. `renderDigitWithBlanking` ([code])
paints one digit at a time under a shared blank budget: a nonzero digit stores as-is and ends the
leading-blank run; a zero digit stores the blank tile while budget remains (spending one), or a
genuine 0 once the budget is exhausted. Threading one budget across a field's digits gives
right-aligned numbers with suppressed leading zeros.

### Score, high-score and credit fields

Player scores are three-byte packed-BCD counters: `P1_SCORE_BCD` (0x88a2, [seen]) and
`P2_SCORE_BCD` (0x88a5, [seen]), with the high score in `HIGH_SCORE_BCD` (0x88a8, [code]) up to its
most-significant byte `HIGH_SCORE_BCD_HI` (0x88aa, [seen]). `selectActivePlayerScoreBuffer` ([code])
picks the live player's buffer by bit 0 of the active-player index. Score accrual runs in `loc_0496`
([code]), which BCD-adds a per-index award into the active counter, repaints that counter's column,
and — comparing most-significant byte first — copies the counter over the high score and repaints it
when it is strictly greater.

The score columns are painted down the screen, most-significant byte first, one digit per row up the
column. `loc_0552` ([code]) zeroes a selected counter (player 1, player 2, or high score) and
repaints it; `loc_056b` ([code]) repaints a selected counter without clearing it. Both split each of
the three bytes into its high then low digit through `renderDigitWithBlanking` with a blank budget of
4, so leading zeros are suppressed. The destination columns are `P1_SCORE_VRAM` (0x8781, [code]),
`P2_SCORE_VRAM` (0x8521, [code]) and `HIGH_SCORE_VRAM` (0x8641, [code]).

The credit count `CREDIT_COUNT` (0x8802, [seen]) is drawn by `loc_05ee` ([code]): it renders the
credit field, clamps the count to 99, converts it with `byteToPackedBcd`, and writes the tens tile
into `CREDIT_HUD_TENS_VRAM` (0x86bf, [code]) — only when the tens nibble is nonzero — and the units
tile into `CREDIT_HUD_UNITS_VRAM` (0x869f, [code]). Folded into the same routine is a hidden
anti-tamper tripwire: only when the units digit is exactly 2 does it sum a 31-byte program block,
bumping a tamper-strike counter if the sum misses its sentinel.

The attract screen's full HUD and score panels are assembled by `loc_03e9` ([code]). It draws eleven
selector-indexed character fields (each through `loc_05b2`), then renders the ten-entry high-score
table from `HIGH_SCORE_TABLE` (0x8a00, [code]) into the column at `HIGH_SCORE_TABLE_VRAM` (0x85c7,
[code]) as stacked BCD nibble pairs — each source byte split into low then high nibble a row apart,
the top digit's leading zero suppressed, the column re-based two cells right per row — and finally
repaints the digit panel and the status panel. The field renderer `loc_05b2` ([code]) draws a
table-selected field of stacked characters bottom-up: the selector indexes a pointer table
`FIELD_RECORD_PTR_TABLE` (0x7a0d, [code]) whose entry heads a list of records, each a two-byte
destination followed by an inline string; characters are written one tilemap row up per cell, a '.'
ends a record and a '?' ends the run, and bit 7 of the selector switches between digit-fill (char −
'0') and blank-fill.

### The panels

Two fixed panels are painted from work-RAM source tables. The status panel comes from
`renderPanelFromTable` ([code]): it walks ten rows of three cells from `PANEL_TILE_SOURCE` (0x8e00,
[code]) into `PANEL_VRAM_DEST` (0x8567, [seen]), painting each source byte when nonzero and blank
tile 0x40 otherwise; within a row the first two cells climb one row (stride −0x20) and the third
re-bases forward to the next column (+0x42). The digit panel comes from `loc_0439` ([code]): it
renders ten rows of packed-BCD digit pairs from `PANEL_DIGIT_SOURCE_TABLE` (0x89c0, [code]) into
`PANEL_DIGIT_VRAM_DEST` (0x8467, [code]), each row drawing two source bytes as digit pairs with a
fixed separator tile 0x51 wedged between them, the source skipping one byte per row and the
destination re-basing two cells right each row.

### Stage, timer and gauge readouts

The stage-countdown number is drawn by `renderStageCountdownDigits` ([code]) from `STAGE_COUNTDOWN`
(0x8901, [seen]) into `HUD_STAGE_DIGIT_LO` (0x8743, [seen]): a value below ten renders as a single
units digit; ten or more is converted to packed BCD (that path suppressed while the play-mode latch
is held) and drawn as units plus a tens tile one tilemap row over, the tens leading zero suppressed.

The phase counter is shown as a five-cell vertical gauge. `renderPhaseGauge` and its identical twin
`paintPhaseGauge` ([code]) read `GAUGE_PHASE_COUNTER` (0x8908, [seen]): a zero count leaves the gauge
untouched, otherwise (count − 1) cells — clamped to five — are painted with filled tile 0xb0 from
`PHASE_GAUGE_BASE_TILE` (0x863f, [seen]) upward, one tilemap row per cell, and the remaining cells
above are painted with blank tile 0x10. The gauge thus fills upward as the phase counter climbs and
drains as it falls.

The on-screen wave-arrival count is drawn as two digits, with its high digit at
`WAVE_COUNT_HUD_HI` (0x863b, [code]) and its low digit one row up at 0x861b; the count of targets in
the current group is held in `TARGET_GROUP_COUNT` (0x8f47, [seen]). At the level-intro, `loc_6f42`
([code]) draws the target-hit tally `HIT_TALLY` (0x8f52, [code]) as two stacked digit pairs at
`HUD_INTRO_DIGITS_BASE` (0x8634, [code]) — the packed-BCD tally at the base and its BCD-doubled value
two rows up — as it advances the intro phase in `INTRO_PHASE_INDEX` (0x8f51, [code]).

A broader three-field BCD readout is maintained by `loc_10c2` ([code]): it walks a counter toward a
new value one step at a time (direction set by the entry carry), stores it, and repaints three
stacked-BCD HUD fields — the counter drawn doubled as field 1, a second value drawn directly or
re-encoded to BCD as field 2, and, when its source is nonzero, a third value folded into the counter
and drawn doubled as field 3 with its hundreds digit mirrored out. It then advances the main-loop
sub-state and queues a sound cue.

### The round marker

`ROUND_COUNTER` (0x8907, [seen]) is the machine's stage index and drives several rendering decisions
already described: its low bit selects the field colour source tables and stamps the field colour
marker in `loc_1dd3`, its bits 1..2 select the round-derived tile run in `loc_0f97`, and its zero
value selects the alternate object-spawn display command in `loc_6523`. The counter is itself
rendered as the HUD round number, by display routines not yet decompiled, so their bodies are not
described here.

## Sound

Pooyan's main CPU never plays a note itself. All it does for audio is post small numeric
*command codes* to a separate sound processor across two hardware latches: a one-byte command
port and an interrupt-strobe line. Between the game logic that decides "make this noise" and the
hardware that hears it sits a short command ring, so that the many places in the game which want a
sound never touch the audio hardware directly and never stall on it — they drop a byte into the
ring and move on, and a single per-frame service drains the ring to the audio board. The audio
processor that turns a command code into actual sound is not part of this machine; its playback is
recorded and replayed rather than modelled, so everything below stops at the moment a command byte
reaches the audio board.

### Handing a command to the audio board

The one point where the machine actually touches the audio hardware is `sendSoundCommand` [code].
It writes the command byte to the sound-command port `SOUND_COMMAND_LATCH` [seen] at 0xA100, then
raises the audio-interrupt strobe `AUDIO_IRQ_LATCH` [seen] (bit 1 of the audio-control latch at
0xA181) high and immediately back low. That rising edge is what tells the sound processor a fresh
command is waiting; it reads the byte the main CPU just parked at 0xA100. The command port holds
whatever was last written to it, so the byte stays valid across the strobe and remains readable
until the next command overwrites it — the strobe is only a nudge, the latch is the mailbox. On the
real board the pulse has a definite width (a brief timing delay between the raise and the lower);
that delay carries no state and simply vanishes here, leaving the raise/lower pair. The 0xA100 and
0xA181 writes decode through the board's device map to the sound port and the audio-control latch
respectively; the same latch bank also carries an audio-mute line, which no gameplay routine drives
(the game silences itself with a command code, below, not by muting the board).

### The command ring and its two front doors

Commands accumulate in a small ring that lives in the 0x8A page, sharing that page with the
high-score table but occupying its own window: the slots `SOUND_RING_BUFFER` [code] run 0x8A43
through 0x8A5E, and are all initialised to the empty marker 0xFF at boot. Two cursors track the
ring, both single bytes holding an index in the 0x43..0x5E range that is combined with the 0x8A00
page base to address a slot: `SOUND_RING_WRITE_PTR` [code] at 0x8A40 is the tail (where the next
command lands) and `SOUND_RING_READ_PTR` [code] at 0x8A41 is the head (the next command to play).
Each cursor advances one slot after use and wraps from the last slot (0x5E) back to the first
(0x43), so the buffer is a true circular queue with the 0xFF marker distinguishing a free slot from
a queued one.

Producers reach the ring through one of two enqueue helpers, both of which append at the tail and
bump the write pointer. `loc_0eb3` [code] is the unconditional path: it drops the given byte into
the slot the write pointer names and advances the pointer, wrapping at the end — nothing gates it,
so the command is always queued. `loc_0ea2` [code] is the gated path onto the *same* ring, using
the same write cursor and the same 0x8A00 page: it first stashes the incoming byte at
`TEXT_RING_PENDING_BYTE` [code] (0x8D20), then appends it only while a game is in progress
(`GAME_ACTIVE_FLAG` [seen]) or the play-mode latch `PLAY_MODE_LATCH` [code] is non-zero; with both
gates closed it appends nothing and reports a cursor of zero. When it does append, it writes the
stashed byte at the cursor, advances and wraps, and leaves the new cursor position behind for its
caller. So a byte queued outside of active play through this door is silently dropped, while
gameplay bytes queue normally.

### Draining the ring each frame

The ring is emptied by `loc_0e64` [code], invoked once per vblank from the frame's interrupt
service (the NMI service routine at 0x066d calls it near the end of its per-frame work). Each call
handles exactly one command, so the queue releases at most one sound per frame — a command posted
this frame is guaranteed to sit in the latch for the audio processor to pick up before the next
frame's drain can replace it. The drain reads the head slot; if it holds the empty marker 0xFF the
ring is empty and it returns having done nothing. Otherwise it decides whether the command should be
heard: it is suppressed only when demo/attract sounds are disabled (bit 0 of `DEMO_SOUNDS_DSW`
[code], the complemented DSW1 demo-sound switch, is clear) *and* no game is active
(`GAME_ACTIVE_FLAG` [seen] is zero) — that is, silent only during a soundless attract mode. In any
other case, including all of gameplay, it passes the byte to `sendSoundCommand` to latch and strobe
it out. Whether or not the command was heard, the drain then frees the slot by writing 0xFF back and
advances the head pointer (wrapping 0x5E to 0x43), so a suppressed command is consumed and discarded
rather than left to replay when sound is later enabled.

### Preset-command helpers and where sounds originate

Most callers do not build a command byte; they invoke a tiny fixed-code helper whose only job is to
supply one preset value and hand it to an enqueue path. `loc_0f09` [code] is the simplest form: it
emits a single hard-wired code straight through `sendSoundCommand`. The bulk of the game's sounds go
through a family of one- or two-line wrappers occupying the 0x0Ecf..0x0Fbc region, each pinned to a
specific effect: `loc_0ecf` [code] queues the silence code 0x00 (this is how routines such as the
level-intro finaliser quiet the channel — a queued 0x00, not a hardware mute); `loc_0ed6` [code],
`loc_0ef1` [code] and `loc_0f01` [code] each append one fixed code via the unconditional `loc_0eb3`;
`loc_0eda` [code], `loc_0f4e` [code], `loc_0f6c` [code] and `loc_0fb2` [code] queue two codes in
sequence (an effect plus a follow-on); and the gated door `loc_0ea2` fronts its own wrappers such as
`loc_0ef5` [code], `loc_0f2b` [code] and `loc_0f3f` [code], which post their fixed codes only during
active play. `loc_0ee3` [code] shows the pattern extended with game-state guards of its own — it
refuses to queue its code while a wave is tearing down or a grab is in progress, and only then tail-
appends. Game events reach these helpers from all over the code: collision handling emits a hit
sound as it marks a struck slot (`loc_5f11` [code]), a fixed effect is queued when an enemy record
is created or reset (`loc_5f02` [code], `loc_6166` [code]), and wave arrival/idle logic queues the
wave sound as records land (`loc_733c` [code], `loc_73e3` [code]). Each such site simply names the
effect it wants; the ring and the once-per-frame drain do the rest.

## Anti-tamper

The program image is riddled with self-integrity machinery. There is no single guard: instead a
boot-time census of the whole ROM, a handful of periodic full-block checksums, a set of video-RAM
strip sums, and — most pervasively — dozens of small checksum tripwires soldered onto the tail of
ordinary gameplay handlers, all cross-checking the code and data against values baked into an
untampered image. Each guard sums or compares a fixed region and, on the one result an intact image
can never produce, takes an action ranging from silently bumping a strike counter, through freezing
actors, to wiping work RAM or throwing a hard integrity trap. The strike counters and flags themselves
(`TAMPER_STRIKES_*` [code], `TAMPER_FREEZE_FLAG` [code], `SIGNATURE_MISMATCH_FLAG` [code],
`TAMPER_ROM_CHECK_FLAG` [code], `TAMPER_OBJECT_FREEZE_FLAG` [code], `HISCORE_TABLE_CORRUPT_FLAG` [code])
sit in work RAM at their clean value of zero throughout honest play, so every failure arm is dead code
on a legitimate board — which is precisely why the machine is so hard to grade: the tamper paths are
only reachable once the image is already altered.

### The boot census and its gate

The whole scheme is anchored at power-on in `loc_0092` [code]. Before it builds any machine state it
walks the eight 4K program-memory banks in order, folding each bank into a 24-bit rolling sum kept as
three bytes (low, mid, and a high byte bumped whenever the mid byte wraps). Each bank's finished triple
is compared against its three-byte entry in `ROM_SELFTEST_CHECKSUM_TABLE` [code], the 24-byte table of
per-bank reference checksums that lives at the very bottom of the ROM. The result is not a boolean but
a tally: `loc_0092` seeds a counter with the bank count of eight and increments it once per matching
bank, so a wholly intact image finishes at sixteen. That count is stashed in `ROM_SELFTEST_TALLY`
[code], a cell deliberately parked in the top stack word — the boot leaves the stack pointer one word
low with an unbalanced push so the per-frame register-save cannot clobber it. Every other write in
`loc_0092` is plain initialization; the tally is the self-test's only durable output.

The tally's teeth are filed later, in the attract-to-play setup handler `loc_072d` [code]. After it
drains the row-by-row screen fill it reads `ROM_SELFTEST_TALLY` and refuses to finish the handoff
unless it reads exactly sixteen; on any lower count it abandons the setup and returns to the idle loop.
A single mismatched bank therefore leaves the tally short and strands the machine in attract forever,
never advancing into a playable game — a quiet refusal rather than a crash.

A companion boot-signature check runs from the attract/self-test state handler `loc_744e` [code]. It
performs two verbatim comparisons rather than a sum: the first eight bytes of the boot code at
`BOOT_CODE_BASE` [code] are matched byte-for-byte against their reference copy at
`SELFTEST_REF_COPY_BOOT` [code], and then a 0x74-byte program window walked from
`SELFTEST_LOOP2_SCAN_BASE` [code] is compared against the reference bytes that continue on from the
same copy. Because both reference blocks are literal duplicates of the checked code, an intact image
sails through untouched; the first divergence in the second loop aborts the handler into the screen
re-init path at `loc_67df`, tearing down the attract screen instead of proceeding. The handler advances
`SELFTEST_DISPATCH_STATE` [code] as it enters, so the check is one step of the attract state machine.

### Periodic full-block ROM checksums

Several guards re-verify large ROM regions repeatedly during a running machine, each gated so it fires
only intermittently. `loc_7e6d` [code] sums the program image downward from `TAMPER_CKSUM_TOP_ADDR`
[code] to a 0x34 sentinel byte, accumulating both the byte sum and a count of its carries, and runs
only when `PLAYER1_LIVES` [seen] is at least four and `FRAME_COUNTER` [seen] sits at its zero crossing
— so it samples the ROM roughly once per counter cycle, and only under the higher lives settings. If
`(carries + sum)` keeps any bit of the mask `0xb0`, the image is judged altered and
`TAMPER_STRIKES_ROM` [code] is bumped.

The undecompiled routine `loc_7881` performs the widest sweep. Gated behind a per-record frame
countdown so it too acts only every Nth frame, it first runs a nine-block ROM checksum: nine
consecutive 32-byte blocks starting at 0x0779 are summed into a running 16-bit total, and each block's
cumulative total is checked against the nine-word reference table at 0x7900. Any word mismatch aborts
the routine to a shared return, skipping the rest. If all nine blocks agree it advances a state
selector and then computes a serpentine video-RAM sum: a 16-bit total folded down two twelve-cell
columns from 0x8548. If the low and high bytes of that sum plus `0xa6` are not zero it diverts into the
corruption path described below; otherwise it clears two spans and re-inits an actor slot and returns
cleanly.

The program-signature check `verifyRomSignature` [code] samples the code region sparsely rather than
summing it: it compares the sixteen bytes of `SIGNATURE_REFERENCE_TABLE` [seen] against every eighth
byte of the sampled region from `SIGNATURE_SAMPLE_BASE` [seen], and on the first byte that differs
raises `SIGNATURE_MISMATCH_FLAG` [code] and stops. It is reached from the per-frame scroll worker
`loc_0254` [code], which runs the signature check in place of its normal repaint when a control byte's
low nibble is set.

Two of the boot-style block sums are packaged as reusable leaf routines. `verifyRomChecksum` [code] —
the state-10 guard — sums sixteen read-only bytes descending from `ROM_CHECKSUM_TOP` [code] into a
single byte and inspects its shape: a healthy image has bit 0 clear and bits 5 and 7 set, and any
other pattern bumps `TAMPER_STRIKES_STATE10` [code]. `verifyTableChecksum` [code] sums a
caller-specified span into a 16-bit accumulator (a low byte plus a high byte incremented on each
8-bit carry) and demands the exact total high 0x1d / low 0xc1; any other total raises
`TAMPER_ROM_CHECK_FLAG` [code].

### Video-RAM strip and serpentine checksums

A second family guards the displayed screen against tampering. `loc_7517` [code], display dispatch
state 1, column-sums two fixed fourteen-tile video-RAM strips — the colour-region strip from
`HUD_INTEGRITY_STRIP_A` [code] and the tile-region strip from `HUD_INTEGRITY_STRIP_B` [code] — each
walked upward a row (0x20) at a time, and requires the combined total to equal exactly high 0x01 / low
0x4f. Any other total is a hard integrity trap; a clean sum advances the dispatch selector and queues
two sound commands. The check is throttled behind a mod-0x1c tick and a one-shot sub-phase so it does
not fire every frame.

`loc_67df` [code] gates a whole screen re-init behind a smaller colour-map sum: it adds ten colour-map
cells one row apart, starting at `HUD_INTEGRITY_STRIP_A` [code], and only when the byte total equals
the sentinel 0x5a does it arm a fresh round — raising the round flag, seeding the phase timer and play
sub-state, clearing the frame-timer block, wiping the actor arena, and painting the playfield. A
mismatched sum instead hands off to the per-object frame updater, so a tampered screen quietly fails to
re-initialize rather than trapping.

The playfield tilemap is summed by a matched pair of once-per-arm routines, `loc_68ac` [code] and
`loc_3278` [code], both guarded by the shared latch `TILE_CHECKSUM_LATCH` [code] so each runs at most
once until re-armed. Each walks the tilemap in a serpentine pattern — reading a 29-cell-wide column
whose low byte steps by one, skipping a three-cell gap to the next row, and advancing a page each time
the column wraps, stopping once the high address byte reaches page 0x88 — accumulating a low-byte sum
and a wrap count. The finished sum is looked up in `TILE_CHECKSUM_TABLE` [code]: the low byte must
match one of four candidate entries and then the wrap count (`loc_68ac`) or high byte (`loc_3278`) must
match the paired entry beyond it. A miss on either half is unreachable from an intact tilemap and
raises a hard data-integrity trap.

`loc_6a7f` [code] carries its own one-shot tilemap sum, taken only when the blink phase is clear and
the wave index is exactly two, latched by `TILE_SUM_ONCE_LATCH` [code]. It sums video RAM from a short
offset into the tilemap in the same column-by-column, row-by-row serpentine — skipping one column
(0x1b) and stopping at page 0x88 — into a 16-bit accumulator, and throws unless the total is exactly
high 0x29 / low 0xb8, a value only a corrupted tilemap could miss. `loc_6566` [code], the fountain
animation step, likewise ends its grow half with a mirror-bank integrity sweep: it walks the two HUD
strips from `HUD_INTEGRITY_STRIP_A` [code], requires each slot to equal its shadow copy one row below,
and folds the slots into a 16-bit sum that must land at high 0x01 / low 0x2a — a slot mismatch or a bad
running total throws.

### Embedded checksum tripwires

Most of the anti-tamper mass is distributed as small self-checks bolted onto the tail of otherwise
ordinary handlers, each summing a fixed program or data block and comparing against a hand-tuned
sentinel. The play-state handler `loc_1b43` [code] folds a 34-byte block from `TAMPER_CKSUM_BASE_5593`
[code] with a per-byte mask, rotate, and add-with-carry, and bumps `TAMPER_FREEZE_FLAG` [code] unless
the fold lands on 0x7c. The player-bank snapshot handler `loc_1bcc` [code] folds the low five bits of a
fourteen-byte block at `TAMPER_CHECKSUM_CODE_BASE` [code] onto the pointer left behind by its
state-copy — a deliberately odd seed — and bumps `TAMPER_STRIKES_SIG` [code] unless the fold reaches
the sentinel word high 0x8a / low 0x60. The credit-draw routine `loc_05ee` [code] hides a tripwire
behind a value test: only when the credit units digit is exactly two does it sum a 31-byte block
descending from `HUD_GUARD_CKSUM_TOP` [code] and, on a miss of the sentinel 0x8c, bump
`TAMPER_STRIKES_HUD_GUARD` [code].

Two actor-frame handlers run their sums only on the frame-counter zero crossing. `loc_3865` [code],
once its per-record timer expires and the record pointer has reached the object-table band, folds the
program image backward from `ACTOR_TAMPER_CKSUM_TOP` [code] to a 0x1a terminator and bumps
`SIGNATURE_MISMATCH_FLAG` [code] if `(carries + sum)` keeps any bit of the mask `0x9e`. `loc_4103`
[code] folds the low nibbles of a 56-byte block at `TAMPER_NIBBLE_SUM_BLOCK` [code] and demands a
running low total of 0x67 with exactly one carry, bumping `TAMPER_STRIKES_SIG` [code] on any deviation.
`flagTamperOnRound5ChecksumMiss` [code] arms only at round five, summing six program bytes from 0x1553
and bumping `TAMPER_FREEZE_FLAG` [code] unless `(low sum + carry count + 0x7f)` wraps to zero.

The state-0 code-window guard lives inside the object handler `loc_3be3` [code]: on the gated lane
reset, while upright and with the stage countdown low, it sums a fixed window descending from
`STATE0_CKSUM_BASE` [code] and bumps `TAMPER_STRIKES_STATE0` [code] unless the running total is 0x55.
The slot-sweep routine `loc_52f6` [code], which only runs while its advance guard is set and
`SLOT_SWEEP_LATCH` [code] is still clear and at least four records are free, latches the free count and
then folds a 23-byte code block from `SLOT_SWEEP_CKSUM_BASE` [code], bumping `TAMPER_STRIKES_SLOTSWEEP`
[code] unless the sum is high 0x09 / low 0x15.

Two tail-integrity checks verify the code that immediately follows them. `loc_79e9` [code] sums a fixed
routine forward from `SELFCHECK_ROUTINE_BASE_ADDR` [code] until its terminating return opcode and
matches the 16-bit result against `TAIL_CHECKSUM_GUARD` [code]: a low-byte miss is a hard trap, a
high-byte miss diverts to the phase-gauge path. The shared integrity-and-timer handler `loc_7960`
[code] folds a 0x5b-byte block from `INTEGRITY_CHECKSUM_CODE_BLOCK` [code] — plus a second sum taken
only at even offsets — and traps unless all four result bytes match the guard words trailing the block;
after rendering the play timer it scans the seven-flag block at `INTEGRITY_FLAG_SCAN_BASE` [code], and
a set flag diverts into a further tail sum against `TAIL_CHECKSUM_GUARD` [code].

The terminator guard `loc_64be` walks a source pointer downward from `TERMINATOR_SCAN_SRC` [code] while
matching each byte against the ascending table at `TERMINATOR_MATCH_TABLE` [code], stopping cleanly
when the table reaches its 0x01 sentinel; a byte that differs bumps `TAMPER_STRIKES_TERMINATOR` [code].
The attract sub-state handler `loc_08e9` [code] straddles its colour-map flood with two table guards —
a 0x20-byte attribute-source sum that must equal 0x63 and a nine-byte code-block sum from
`ATTRACT_INTEGRITY_CKSUM_BASE` [code] that must equal 0xaa — and traps hard on either miss. The
field-attribute integrity check inside `loc_2a01` [code] sums a 0x20-byte attribute table and, on a
sum other than one, tail-jumps to the hunter guard. And the high-score guard
`flagHighScoreTableCorruptOnChecksumMiss` [code] verifies the four-byte block at
`HISCORE_CHECKSUM_BASE` [seen] — the header byte must be the 0xc8 marker and the summed bytes minus the
carry count must equal 0x59 — raising `HISCORE_TABLE_CORRUPT_FLAG` [code] on a bad header or total.

### How a failed check behaves

The failure responses fall into four classes, and much of the design's subtlety is that they are
staggered and indirect rather than immediate.

The gentlest is a **byte-compare self-check that wipes work RAM on divergence**. The hunter-formation
launcher `loc_30f1` [code] compares a copy at `TAMPER_COPY_3278` [code] (a two-byte pointer header plus
a 0x40-byte body) against the original routine at `SELFCHECK_ROUTINE_BASE_ADDR` [code]; on any mismatch
it propagates zero across work RAM from the bottom of the state page, bricking the run. The level-intro
phase-4 handler `loc_6f9d` [code] does the same, comparing a 0x44-byte block at `PHASE4_TAMPER_ORIG`
[code] against its copy at `PHASE4_TAMPER_COPY` [code]; a match queues its sound and display commands,
and a mismatch wipes the work-RAM page forward. In both, the wipe count is scavenged from the compare
loop's leftover counters, so the amount erased depends on where the tamper was found.

The sharpest is the **hard integrity trap** — the video-RAM strip and tilemap sums (`loc_7517`,
`loc_68ac`, `loc_3278`, `loc_6a7f`, `loc_6566`) and the code-block sums in `loc_79e9`, `loc_7960`, and
`loc_08e9`, whose mismatch branches lead into out-of-range data that a running machine cannot survive;
these are modelled as thrown integrity traps, unreachable while the checked bytes are intact.

Between the two extremes lies the **strike-counter arm, which is not dead so much as slow-acting and
data-directed**. The many guards that merely bump a `TAMPER_STRIKES_*` counter or set a flag do not act
at the moment of detection; the counters simply sit nonzero until a later handler notices. On an
honest board those counters never leave zero, so their readers always take the clean branch — but when
a strike is pending, the readers do not show a tamper screen; they quietly derange gameplay by feeding
the strike value into logic as if it were data. The lead-actor handler `loc_2442` [code] idles forever
while `TAMPER_STRIKES_SLOTSWEEP` [code] or `TAMPER_STRIKES_ROM` [code] is nonzero, freezing the actor.
The rope-extend driver `loc_2d80` [code] uses a nonzero `TAMPER_STRIKES_ROM` as a table index in place
of its normal segment index, so a strike garbles the rope column lookup. `loc_2473` [code] stores a
nonzero `TAMPER_STRIKES_STATE10` [code] into the byte at its BC pointer instead of advancing state, and
`loc_24fb` [code] stamps into the multiplexed flag cell and then reloads a shape from that address. The
freshly-seated object handler `loc_6523` [code] refuses to seat records while `SIGNATURE_MISMATCH_FLAG`
[code] is held, starving the game of objects; and `loc_2514` [code] diverts to the board/reset path
when `TAMPER_STRIKES_TERMINATOR` [code] is set. `TAMPER_FREEZE_FLAG` [code] and
`TAMPER_OBJECT_FREEZE_FLAG` [code] act similarly through the per-frame object updater `loc_1e55` [code],
which zeroes the object state and bails whenever a freeze flag is set (the object-freeze flag being
cleared only at board reset by `loc_2527` [code]). The `flagHighScoreTableCorruptOnChecksumMiss` arm is
the most nearly inert: its `HISCORE_TABLE_CORRUPT_FLAG` [code] only marks the saved table as untrusted.

The last class is the **divert into a corruption path**, reached by the serpentine check in `loc_7881`.
On its video-RAM sum mismatch it transfers control to `loc_0320` [code] with the register pair still
holding the bad 16-bit sum. `loc_0320` is ordinarily the flip-screen mirror worker — it decrements the
byte the caller points at and, when the screen is flipped, mirrors the sprite display list — so
entering it from the tamper branch decrements a byte at a garbage address derived from the failed
checksum, corrupting whatever cell the bad sum happens to name. The same address doubles as an ordinary
per-frame counter tick for its honest callers.

### Multiplexed cells

The tamper cells are packed tightly enough that some addresses carry more than one meaning depending on
which routine touches them. The clearest case is `TAMPER_ROM_CHECK_FLAG` [code] at 0x882b:
`verifyTableChecksum` [code] writes it as a one-bit tamper flag on a checksum miss, `loc_24fb` [code]
writes 0x07 into it as an actor shape-state index (and then reads it back as a shape pointer), and the
score-drip step `loc_5a56` reads 0x882b together with 0x882c as a coordinate pair. The same byte is
therefore a tamper flag, a state index, and a coordinate low byte in three different contexts, which is
part of what makes the anti-tamper wiring hard to see: a cell that reads as a checksum verdict in one
routine is live gameplay data in the next.

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
