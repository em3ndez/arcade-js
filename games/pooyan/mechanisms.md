# Pooyan — how the machine works

Pooyan is a Konami arcade game built on a Z80 main CPU driving a tilemap-and-sprite video
system, with a second processor dedicated to sound. This document describes how that
machine works as it stands: the memory map and work-RAM layout, the frame loop and its
interrupt heartbeat, configuration and coinage, the in-play progression machine and its
timers, the deep round-2 and bonus-stage paths, the actor arena, the wave/rope/launch
pipelines, the rendering and HUD primitives, the sound path, and the anti-tamper lattice
that guards the program image. It is a current-state description of the mechanisms, not a
history of how they were recovered.

The first two sections lay the groundwork: the work-RAM map names every live cell and the
band it belongs to, and the frame loop establishes the once-per-frame dispatch that every
other subsystem hangs off. The remaining sections each take one subsystem in turn.

## Legend

Named cells and routines carry a grounding tag that records how well the claim about them is
anchored:

- **[seen]** — the reasoning ends in a direct observation of the running machine: the cell or
  routine was watched doing what the text says.
- **[code]** — the claim is derived from the routine's own behaviour in the program image,
  without a corresponding run-time observation. This is often because the path is only reached
  under conditions that do not occur in normal play, such as a tampered ROM.
- **[guess]** — the role is uncertain and the reading is a best inference.

Where a tag sits on a subsection heading it applies to the mechanism that subsection
describes; where it sits on a specific cell or routine it applies to that identifier.

## The work RAM and its state model

Everything the machine does happens in one 16-bit address space wired up in `boards/pooyan/memory.js`. The lower half, `0x0000-0x7FFF`, is 32KB of program ROM; a write anywhere in it is a hard fault, not a silently-dropped store, so a runaway pointer surfaces at once instead of corrupting nothing visible. From `0x8000` up the space is a small set of devices, each decoded by an address range (and, above `0xA000`, by a don't-care bit mask), so a single physical device answers to a whole family of mirror addresses. Two rules run through the whole map: a read and a write at the same address are usually *different* devices (reading `0xA000` samples a DIP bank, writing it pets the watchdog), and every piece of live state lives at its own real address rather than being packed or aliased.

### The two tile planes

The picture the player sees is built from two parallel 1KB planes that share a single 32x32 cell grid. Colour RAM at `0x8000-0x83FF` holds one *attribute* byte per cell; video RAM at `0x8400-0x87FF` holds one *tile-code* byte per cell. The same cell index reaches into both planes at once: for a given cell the renderer (`boards/pooyan/video.js`, `paintTileRow`) reads the tile shape from `videoRam[cell]` and the drawing recipe from `colorRam[cell]`. That attribute byte's low nibble picks the 16-pen colour set, its bit 6 flips the tile horizontally and bit 7 flips it vertically. The background is a single opaque layer — the tilemap is painted first with pen 0 included, so there is no transparent-background trick and no priority split between foreground and background tiles. `ATTRIB_MAP_BASE` (`0x8040`) [seen] and `PLAYFIELD_TILE_BASE` (`0x8402`) [seen] anchor where the program's own fill and checksum sweeps enter these two planes.

### The sprite banks

Moving objects live in two 256-byte sprite banks, `0x9000-0x90FF` and `0x9400-0x94FF`. They are decoded by a mask, not a clean range: within `0x9000-0x9FFF` the `0x0400` bit selects the bank and `0x00FF` selects the byte, with the intervening `0x0B00` bits treated as don't-cares, so each bank also answers to a spread of mirror addresses. The two banks carry the two halves of each sprite record at the *same* offset (`boards/pooyan/video.js`): in bank 0, `[offs]` is the sprite's screen X and `[offs+1]` its tile code; in bank 1, `[offs]` is a control byte (low nibble = colour set, bit 6 = flip-X but active-*low*, bit 7 = flip-Y) and `[offs+1]` is `240 - y`, an inverted vertical position. The hardware walks records `0x10` through `0x3E` in *ascending* order, so when two sprites overlap the one at the higher offset is drawn last and wins. The program does not poke these banks directly during play; it stages a display list in work RAM and copies it in each frame (see the dispatch model below), and `SPRITE0_CLEAR_BASE` (`0x9010`) [seen] / `SPRITE1_CLEAR_BASE` (`0x9410`) [seen] mark where that per-frame fill begins in each bank.

### The hardware I/O window

Above `0x9FFF` the map is all devices, split cleanly by whether the access is a read or a write. Reads land on the input side: `0xA000` returns dip bank DSW1, `0xA080` / `0xA0A0` / `0xA0C0` return the three input ports IN0 / IN1 / IN2, and `0xA0E0` returns dip bank DSW0. The inputs are active-low — an idle port reads all-ones (`0xFF`) and a pressed control clears its bit — so the program complements them on the way in. Writes land on the output side: writing `0xA000` kicks the watchdog, `0xA100` hands a byte to the audio processor, and `0xA180-0xA187` addresses an eight-bit control latch (`boards/pooyan/io.js`) where *the address itself carries the bit index* (`addr & 7`) and the data is just its low bit. Those eight latch bits are the machine's discrete control lines: bit 0 the vblank-interrupt enable, bit 1 the audio interrupt trigger, bit 2 audio mute, bits 3 and 4 the two coin counters, bit 5 a payout line (unused here), and bit 7 the screen-flip — which is *inverted*, so a stored 0 means flipped. Notably there is no video-enable line: the display is always on, so every frame is drawn regardless of program state. Reaching any unmapped address, read or write, throws rather than floating a value.

### The shape of work RAM

The 2KB of general work RAM, `0x8800-0x8FFF`, is where the whole game lives, and it is laid out as a sequence of functional regions rather than a flat scratch pool. The named cells (`games/pooyan/idiomatic/names.js`) fall into these bands:

- **Global configuration and top-level state, `0x8800-0x883F`.** The DIP switches are decoded once at boot into stable config cells here — the bonus-award schedule select `BONUS_AWARD_DSW` (`0x8800`) [seen], the 3-bit difficulty `DIFFICULTY_DSW` (`0x8820`) [seen], demo-sounds `DEMO_SOUNDS_DSW` (`0x8821`) [seen], starting lives `LIVES_DSW` (`0x8807`) [seen], cabinet mode `CABINET_MODE_FLAG` (`0x880F`) [seen], and the coinage nibbles `COINAGE_CONFIG` (`0x882C`) [seen] / `COINAGE_CONFIG_SLOT2` (`0x882F`) [seen]. Alongside them sit the running top-level selectors: the credit counter `CREDIT_COUNT` (`0x8802`) [seen], the master state selector `MAIN_GAME_STATE` (`0x8805`) [seen], the in-play gate `GAME_ACTIVE_FLAG` (`0x8806`) [seen], the active-player and two-player flags `ACTIVE_PLAYER` (`0x880D`) [seen] / `TWO_PLAYER_FLAG` (`0x880E`) [seen], the flip-screen flag `FLIP_SCREEN_FLAG` (`0x881F`) [seen], and the three-cell input edge-detect ring headed at `INPUT_PORT0` (`0x8810`) [seen]. The tamper-freeze flag `TAMPER_FREEZE_FLAG` (`0x881E`) [code] and the coin-pulse debouncers (`0x8824-0x882D`) also live in this band. `WORKER_CONTROL_BYTE` (`0x883F`) [seen] closes it, one byte below the display list.

- **The sprite display list and actor records, `0x8840-0x889F`.** `SPRITE_DISPLAY_LIST` (`0x8840`) [seen] is a 24-entry, stride-4 staging area that mirrors the hardware sprite layout; `SPRITE_ACTOR_RECORD_SLOTS` (`0x8848`) [seen], `SPRITE_TARGET_SLOTS` (`0x887C`) [seen] and the proximity/scan slots around them are the coordinate records the collision and display drivers rewrite every frame before the list is copied to the banks.

- **Cursors, scores, and the display ring head, `0x88A0-0x88BF`.** The two command-ring cursors `DISPLAY_CMD_RING_WRITE_PTR` (`0x88A0`) [seen] / `DISPLAY_CMD_RING_READ_PTR` (`0x88A1`) [seen], the two-player BCD scores `P1_SCORE_BCD` (`0x88A2`) / `P2_SCORE_BCD` (`0x88A5`), the 3-byte high score `HIGH_SCORE_BCD` (`0x88A8`), and the status-render cursors sit here.

- **The display-command ring, `0x88C0-0x88FF`.** `DISPLAY_CMD_RING_BUFFER` (`0x88C0`) [seen] is a 64-byte circular buffer of two-byte commands, the queue the main loop drains (below).

- **The live round page, `0x8900-0x8934`.** This is the working copy of one player's in-play state: the enemy-speed index `SPEED_INDEX` (`0x8900`) [seen], the round/wave counters `SPAWN_PHASE_COUNTER` (`0x8902`) [seen], `WAVE_ARRIVAL_COUNTER` (`0x8903`) [seen], `ROUND_COUNTER` (`0x8907`) [seen], the phase gauge `GAUGE_PHASE_COUNTER` (`0x8908`) [seen], and the rope-segment counts `ROPE_SEGMENT_COUNT` (`0x8931`) [seen] / `ROPE_DRAW_COUNT` (`0x8934`) [seen].

- **The saved player banks, `0x8940-0x89BF`.** `PLAYER0_STATE_BANK` (`0x8940`) [seen] and `PLAYER1_STATE_BANK` (`0x8980`) [seen] are two `0x3F`-byte parking blocks that hold each player's frozen round page while the other plays (see the player-bank model below), with their life counts at `PLAYER0_LIVES` (`0x8948`) [seen] / `PLAYER1_LIVES` (`0x8988`) [seen].

- **Panel, timers, and tamper counters, `0x89C0-0x89FF`.** Panel digit sources, the per-player play-timer gates, `BOARD_CLEAR_FLAG` (`0x89E5`) [seen], and a run of anti-tamper strike counters (`0x89E8-0x89EF`, e.g. `TAMPER_STRIKES_ROM` (`0x89EF`) [code]) live here.

- **High-score table, play timers, sound ring, frame counter, `0x8A00-0x8A5F`.** `HIGH_SCORE_TABLE` (`0x8A00`) [seen] is the 10-entry board; the BCD play-timers, the 28-slot sound-command ring headed by `SOUND_RING_WRITE_PTR` (`0x8A40`) [seen] / `SOUND_RING_READ_PTR` (`0x8A41`) [seen] over `SOUND_RING_BUFFER` (`0x8A43`) [seen], and the free-running `FRAME_COUNTER` (`0x8A5F`) [seen] complete the band.

- **The actor and entity tables, `0x8A80-0x8FFF`.** The remainder is the object world: the player/lead-actor table at `ACTOR_TABLE` (`0x8A80`) [seen], enemy actors at `ENEMY_ACTOR_TABLE` (`0x8AE0`) [seen], sprite objects at `SPRITE_OBJECT_TABLE` (`0x8B70`) [seen], projectiles at `PROJECTILE_TABLE` (`0x8BE8`) [seen], and the formation / hunter / eagle / spawn / rope / script state that fills out to the end of the page, including the attract-mode substate at `ATTRACT_SUBSTATE` (`0x8E51`) [seen].

The very top of the page is reserved: `BOOT_STACK_TOP` (`0x8FFE`) is where the stack is planted, and the single-byte self-test tally at `ROM_SELFTEST_TALLY` (`0x8FFF`) [seen] is deliberately parked *above* the stack so the per-frame interrupt's register-save cannot clobber it.

### The player-bank state model

A game can run one or two players out of a single live round page. `ACTIVE_PLAYER` (`0x880D`) [seen] selects whose turn it is and `TWO_PLAYER_FLAG` (`0x880E`) [seen] records whether a second player exists. The live state at `0x8900` is only ever one player's; when a player's turn ends, that page is block-copied down into their saved bank (`PLAYER0_STATE_BANK` `0x8940` or `PLAYER1_STATE_BANK` `0x8980`) and the other player's saved bank is copied back up into `0x8900`. The scores, life counts and play timers are kept in per-player pairs rather than swapped, so those survive the page swap on their own. The effect is that all the round logic can address one fixed page and be oblivious to which player it is running.

### Boot: the shape of state at power-on

`runSelfTestAndInitMachineState` establishes the entire initial state before the game runs. It first walks the eight 4K program-memory banks with a 24-bit rolling checksum, comparing each against a reference table and bumping the tally cell once per intact bank — a wholly-good image lands at exactly twice the bank count, and a later play gate refuses to run unless the tally reaches that value. It then builds the blank machine: it zeroes work RAM (all but the tally word at the very top), marks both the display-command ring and the sound-command ring empty and parks their read and write cursors at their origins, floods the colour plane with a default attribute, arms the row-by-row tile fill, decodes the two DIP ports into the config cells described above, clears the two sprite banks, blanks the lower tilemap, silences the audio processor, enables the vblank interrupt, and lays down the default high-score table. With state established, it hands control to the main loop.

### The per-frame dispatch model

Two layers of dispatch drive the machine, and they meet once per frame.

The outer layer is the **main loop** (`mainLoop` / `mainLoopStep`). It free-runs — there is no explicit wait for vblank — and its job is to drain the display-command ring at `DISPLAY_CMD_RING_BUFFER` (`0x88C0`). Each iteration reads the slot under the read cursor `DISPLAY_CMD_RING_READ_PTR` (`0x88A1`). An ordinary slot is a two-byte command: its handler is chosen from a small dispatch table (nine entries: playfield redraws, the phase gauge, score and credit renders, and the high-score-corruption check), both bytes are freed, and the cursor advances by two and wraps back to the ring base. The loop keeps consuming commands *within the same frame* until it reaches a *worker* slot — one with bit 7 set — at which point it runs the per-frame worker (`repaintScrollColumnsElseVerifySignature`) and treats that as the true frame boundary. Draining the whole backlog per frame matters: if only one command ran per frame, a queue built up on the credit screen would leak stale attract tiles onto the playfield.

The inner layer is the **vblank interrupt**, `runVblankNmiService`, the machine's single per-frame heartbeat. It runs to a fixed script every frame:

1. It clears the NMI-enable latch bit so a second interrupt cannot re-enter it mid-update.
2. It copies the staged sprite display list into the two hardware sprite banks (via a stride-two attribute/position copy loop). In play-state 4 it stitches four source groups together, threading the destination cursors across the calls; otherwise it copies a single group.
3. It kicks the watchdog by writing the last-copied byte to the watchdog address (the write side of `0xA000`).
4. It shifts the three input ports through the edge-detect ring at `INPUT_PORT0` (`0x8810`): the previous frame's samples slide up the ring, then the three ports are re-sampled and complemented (recall inputs are active-low), so both the current level and the just-changed edges of every control are available to the game logic.
5. It decrements two independent per-frame counters, `WORKER_CONTROL_BYTE` (`0x883F`) and `FRAME_COUNTER` (`0x8A5F`).
6. It services coins and the coin counters, then drains one entry from the sound-command ring, forwarding the queued byte to the audio processor unless the machine is meant to be silent (demo sounds off *and* no game active).
7. It dispatches on the master selector `MAIN_GAME_STATE` (`0x8805`): state 0 is the attract/boot handler, state 1 the attract substate machine, state 2 the board-build sequence, state 3 the live play frame, and state 4 an idle no-op.
8. Finally it copies `FLIP_SCREEN_FLAG` (`0x881F`) out to the flip-screen latch bit and re-arms the NMI-enable bit for the next frame.

State 3, the play frame, opens a *third* dispatch level: after ticking the BCD play-timer it hands off on the in-play sub-state index `PLAY_STATE_INDEX` (`0x880A`), whose low five bits select one of nineteen handlers (the intro build-up, wave spawn, the active gameplay frame, the phase-gauge drain, the player-bank save, high-score entry, round-end teardown, and the deep round-2-and-beyond handlers). So the top of every frame flows: main loop drains the display ring → hits the worker slot → the vblank interrupt fires → it rebuilds the sprites and inputs and then dispatches `MAIN_GAME_STATE` → in play, that dispatches `PLAY_STATE_INDEX` → the selected handler updates the world → control unwinds back and the interrupt re-arms itself for the next frame.

## The frame loop and the vblank heartbeat

Pooyan runs on two interleaved threads of control that together define a frame: a foreground
loop that never terminates, and a vblank interrupt that preempts it roughly sixty times a
second. The foreground loop keeps the display-command queue drained and repaints the scrolling
tile columns; the interrupt does the heavy per-frame work — rebuilding sprite rows, sampling the
controls, ticking the timers, and running whichever game-state handler is currently in charge.
The two never step on each other because the interrupt masks itself for the duration of its own
work. Everything below describes how that machinery is wired and what one beat of it does.

### Reset and arming the heartbeat

At power-on the CPU begins at the reset vector `disableNmiAndEnterBoot` (ROM 0x0000). Its first act is to
disable the vblank interrupt: it clears the accumulator and writes 0 into the LS259 latch bit that
gates the NMI (`NMI_ENABLE_LATCH` 0xa180 [seen]), so no interrupt can fire while memory is still
uninitialized. It then jumps to the boot routine `runSelfTestAndInitMachineState`.

`runSelfTestAndInitMachineState` (ROM 0x0092) builds the whole initial machine state before any frame runs. It
checksums the eight 4K program-memory banks against a checksum table, bumping a pass tally that
the play path later requires to be intact; then it zeroes work RAM, marks the display-command and
sound-command ring buffers empty and parks their cursors at their origins, floods the colour map,
arms the row-by-row tile fill, decodes the two DIP-switch banks into their config cells, and
clears the sprite banks and blanks the lower tile map. The step that matters to the heartbeat
comes here: it writes 1 into `NMI_ENABLE_LATCH` (0xa180), arming the vblank interrupt. From that
instant the machine has a heartbeat — the video hardware will raise an NMI at every vertical
blank. Two state-init steps still follow the arming write — it lays down the default high-score
table and clears the panel-digit source — and then the boot routine's final act is to hand
control to the main loop, which it enters and never returns from.

Boot also seeds the two orientation cells that the interrupt later consumes: it sets the
flip-screen flag `FLIP_SCREEN_FLAG` (0x881f [seen]) to 1 (upright) and mirrors it into the
hardware flip-screen latch `FLIP_SCREEN_LATCH` (0xa187, LS259 bit 7 [code]). The interrupt
re-copies flag into latch every frame thereafter, so a mid-game orientation change takes effect on
the next beat.

### The free-running main loop

The foreground loop is the game's background thread: it spins continuously and is interrupted, not
driven, by the vblank. It is the display-command driver. Its cursor is the display-command ring
read pointer `DISPLAY_CMD_RING_READ_PTR` (0x88a1 [seen]), a low-byte index into a ring that lives
on page 0x88 (slots 0x88c0..0x88ff). Each pass reads the slot the cursor points at and branches on
its top bit:

- If bit 7 is set, the slot is the *worker marker*. The loop runs the per-frame scroll worker
  `repaintScrollColumnsElseVerifySignature` (ROM 0x0254 [seen]) and comes back around. This is the ring-idle point — reached once
  per pass through the queue — and is the natural once-per-frame boundary of the foreground thread.
- Otherwise the slot holds a two-byte display command. The loop reads the command byte and its
  parameter, frees both ring bytes (writing 0xff back), advances the cursor by two (wrapping its
  low byte back to the ring base 0xc0), and dispatches the command: `(command << 1) & 0x1f` selects
  an even offset into a small handler table (entries at ROM 0x0242) covering the panel/HUD and
  score-drawing routines and the high-score-table integrity check. Because a command dispatch does
  *not* run the worker, the loop keeps consuming commands back-to-back until it reaches the worker
  marker, so an entire queued backlog drains within a single frame rather than one command per
  frame.

The scroll worker `repaintScrollColumnsElseVerifySignature` is itself gated by the worker control byte `WORKER_CONTROL_BYTE`
(0x883f [seen]). If that byte's low nibble is non-zero the worker only runs the program-signature
integrity check and returns; when the low nibble is zero, and a game is active, it repaints two
three-tile scroll columns: the first column differs by mode — four blank columns in one-player
mode, or a capped body column in two-player mode — while the shared second column is repainted in
both cases; it then optionally blanks one further column when the control byte's bit 4 and the
game-active low bit are both set. Every column it touches steps one
tilemap row upward per cell, which is what makes the background scroll. Note that this "control
byte" is not static: the interrupt decrements 0x883f every frame (see below), so its low nibble
sweeps 0..15 and its bit 4 toggles on a 16-frame cadence — the worker is effectively reading a
free-running counter as though it were a set of control bits, so the full scroll repaint happens
one frame in sixteen.

### The vblank NMI: one beat of per-frame work

The interrupt is the real heartbeat. When the video hardware raises the NMI, the CPU vectors to
0x0066, which is nothing but a jump onward to the service routine `runVblankNmiService` (ROM 0x066d [seen]) —
the sole per-frame worker of the machine. One beat proceeds in order:

1. **Mask itself.** The routine writes 0 into `NMI_ENABLE_LATCH` (0xa180) so a second vblank cannot
   re-enter it mid-beat. (On the real machine it also stacks the entire register file here and
   unstacks it at the end so the interrupted foreground loop resumes undisturbed; that
   save/restore is bookkeeping, not machine state, and carries no game meaning.)

2. **Render — rebuild the sprite banks.** It copies the staged sprite display list into the two
   hardware sprite banks via the copy helper `copySpriteAttrAndPositionRun`. The shape depends on the in-play sub-state
   `PLAY_STATE_INDEX` (0x880a [seen]): in state 4 it copies four source groups, threading the
   destination cursors across the successive calls; in every other state it copies a single
   0x18-tall group. The last byte copied is then written to 0xa000, which doubles as the watchdog
   kick — the periodic write that keeps the hardware watchdog from resetting the board.

3. **Input — shift the edge-detect ring and sample the ports.** The three control ports are
   hardware-read active-low, so each is complemented on the way in. The current samples land at the
   head of the input ring: IN0 (0xa080 [code]) into `INPUT_PORT0` (0x8810 [seen]), IN1 (0xa0a0
   [code]) into 0x8811 [seen], IN2 (0xa0c0 [code]) into 0x8812 [seen]. Before overwriting them the
   routine shifts the previous samples up into the tail cells (0x8813..0x8816), so the ring holds
   this frame's reading alongside a short history of prior frames. Downstream input consumers
   compare head against history to detect a *rising edge* — a button that is newly pressed this
   frame rather than merely held — which is how coin, start, and one-shot control presses are
   recognized.

4. **Tick the two frame counters.** It decrements the worker control byte `WORKER_CONTROL_BYTE`
   (0x883f) and the free-running frame counter `FRAME_COUNTER` (0x8a5f [seen]). The former's low
   bits pace the foreground worker's repaint cadence (above); the latter is the master per-frame
   clock — its low bits phase animations throughout the game and its zero-crossings gate periodic
   integrity checks.

5. **Service coins and drain the sound ring.** It runs the coin/credit + hardware-counter service
   (unless free-play is configured), then drains the sound-command ring so any commands queued
   during the frame are handed to the audio side once per beat.

6. **Dispatch on the game state.** Finally the beat runs the handler for the current top-level game
   state (the once-per-frame state branch, below).

The beat then closes with its epilogue: it copies `FLIP_SCREEN_FLAG` (0x881f) into the hardware
flip-screen latch `FLIP_SCREEN_LATCH` (0xa187), re-arms the interrupt by writing 1 back into
`NMI_ENABLE_LATCH` (0xa180), and returns to the point in the foreground loop it interrupted. The
next vblank starts the next beat.

### The once-per-frame state branch

The heart of a beat is a single branch on the top-level game state `MAIN_GAME_STATE` (0x8805
[seen]) — the selector that decides what the machine *is doing* this frame. Exactly one handler
runs per beat:

- **0** → `blankFillRowThenFinishAttractSetup`: the idle/attract-cycle entry.
- **1** → `dispatchAttractSubstate`: the attract-mode sub-state machine.
- **2** → `dispatchBoardBuildSubstate`: the board-build / level-intro sub-state machine.
- **3** → `runPlayStateFrame`: one frame of live gameplay.
- **4** → `noopStateHandler`: a do-nothing beat (state present but with no per-frame work).

Each handler advances its own portion of the game and returns, and the beat resumes its epilogue.
This branch is the boundary between the heartbeat described here and every other subsystem: the frame
loop guarantees that whichever of these is selected runs once, in order, every vblank, wrapped in a
consistent render/input/tick/service envelope. `MAIN_GAME_STATE` is thus the top-level state; the
finer-grained `PLAY_STATE_INDEX` (0x880a) used within play (and read up front to shape the scroll
rebuild) is a sub-state under state 3.

## Configuration, Coinage and Players

Everything the machine needs to know about how it is wired lives in one place: the two
DIP-switch banks are read once at power-on, decoded into a cluster of single-byte config cells
near the bottom of work RAM (0x8800-0x882f), and thereafter every credit, coin, cabinet and
player decision reads those cells rather than the hardware. Coins and start buttons arrive on a
separate input port that is re-sampled every video frame. This section follows the config cells
from the switch pins that seed them, through coin acceptance and credit accrual, into the act of
starting a game, and out to the per-player banks that let two players share one board.

### Decoding the DIP switches at power-on

The boot routine at `runSelfTestAndInitMachineState` (ROM 0x0092) does the one-time configuration read after its
memory test. It reads the two switch banks from their hardware ports -- `DSW1_PORT` [code] at
0xa000 and `DSW0_PORT` [code] at 0xa0e0 -- and, because the switch banks are wired active-low, it
complements the DSW1 read before splitting it into fields with a chain of right-rotates; the DSW0
coinage read is masked and table-looked-up without complementing.

DSW1 supplies the cabinet-shaped options. After complementing, successive rotate-and-mask steps
peel off, from bit 2, the cabinet type into `CABINET_MODE_FLAG` [seen] (0x880f); from bit 3, the
extra-life award schedule selector into `BONUS_AWARD_DSW` [seen] (0x8800); from bits 4-6, the
three-bit difficulty into `DIFFICULTY_DSW` [seen] (0x8820); and from bit 7, the demo-sound enable
into `DEMO_SOUNDS_DSW` [seen] (0x8821). The starting-lives field comes from DSW1's low two bits
in a small computed map: the complemented pair, when it is `0b11`, yields the sentinel 0xff,
otherwise the pair plus three (giving 3, 4, or 5), stored in `LIVES_DSW` [seen] (0x8807).

DSW0 is the coinage bank. Its two nibbles are each looked up in the ROM byte table `COINAGE_TABLE`
[seen] at 0x0053, which maps a switch nibble to a packed coinage descriptor. The high nibble's
lookup lands in `COINAGE_CONFIG_SLOT2` [seen] (0x882f) for coin slot 2; the low nibble's lands in
`COINAGE_CONFIG` [seen] (0x882c) for coin slot 1. In each descriptor the high nibble encodes how
many coins make a group and the low nibble how many credits that group buys; the descriptor value
0x0f is the free-play sentinel, and much of the credit machinery keys off it directly. (An earlier
boot fragment reads DSW0's low nibble through a second table at 0x0069 and tests the result, but
the code jumps past the branch that would consume it, so that pre-check has no effect.)

All of these are boot-only writes: nothing in play re-reads the switch ports, so the config cells
are effectively constants for the life of a power cycle.

### Cabinet orientation and the flip-screen latch

Orientation is held in `FLIP_SCREEN_FLAG` [seen] (0x881f), seeded to 1 (upright) at boot alongside
a matching 1 written to the hardware flip latch `FLIP_SCREEN_LATCH` [code] (0xa187, LS259 bit 7).
Thereafter the per-frame heartbeat re-publishes it: at the tail of the NMI service routine
`runVblankNmiService` the current value of `FLIP_SCREEN_FLAG` is copied straight into `FLIP_SCREEN_LATCH`, so
a mid-game change to the flag reaches the video hardware on the next frame.

The flag is only rewritten for a cocktail cabinet. When `CABINET_MODE_FLAG` reads zero (cocktail),
the round-setup routine `initRoundArenaAndRestorePlayerBank` sets `FLIP_SCREEN_FLAG` from the active-player index minus one
-- 0xff for the first player, 0 for the second -- at the start of each player's turn, so the
second player sees the screen mirrored to face the other side of the table. The same cocktail condition reroutes controls: the high-score-name entry logic in
`seedWriteAnimWorkBlock` reads player two's joystick from the second input port only when the cabinet is a
cocktail and the active player is nonzero. In an upright cabinet (`CABINET_MODE_FLAG` nonzero) the
orientation flag is left at its upright seed and both players use the same controls.

### Sampling coins, service and start inputs

The coin, service and start buttons all arrive on one hardware port, `IN0_PORT` [code] (0xa080),
which the NMI routine `runVblankNmiService` samples every frame. It reads the three input ports, complements
each (active-low hardware), and shifts them through a short edge-detect history ring whose head is
`INPUT_PORT0` [seen] (0x8810): the current inverted IN0 sample lands at 0x8810, with prior frames'
samples pushed down the ring so consumers can detect a fresh press versus a held button. Within
the inverted IN0 byte the bit assignments are fixed: bit 0 = coin slot 1, bit 1 = coin slot 2,
bit 2 = service credit, bit 3 (0x08) = one-player start, bit 4 (0x10) = two-player start.

### Coin acceptance and credit accrual

Immediately after sampling, the NMI calls `serviceCoinCreditAndCountersUnlessFreePlay`, the coin
subsystem's per-frame entry point. It short-circuits entirely if either coinage descriptor reads
free play (0x0f) -- on a free-play machine coins are never counted. Otherwise it runs a fixed
chain of sub-steps: three credit accumulators, the coin-counter-1 strobe, a periodic anti-tamper
check, and a tail that strobes the second coin counter.

Three of those sub-steps are near-identical credit accumulators, one per input bit, differing only
in which bit they watch and how much they award:

- `accrueCreditFromDripRingA` watches the service bit (bit 2) through debounce ring `DRIP_RING_A` [seen] (0x8829)
  and, on a clean pulse, awards exactly one credit -- no coinage arithmetic, no physical counter.
- `accrueCreditFromCoin1Pulse` watches coin slot 1 (bit 0) through ring `DRIP_RING_C` [seen]
  (0x882a).
- `accrueCreditsFromCoinSlot2` watches coin slot 2 (bit 1) through ring `DRIP_RING_B` [seen]
  (0x882d).

Each step rotates one input bit into its ring every frame and acts only when the ring's low three
bits settle on the accept phase (value 1); this is the software debounce that turns a noisy,
multi-frame coin pulse into a single accept event. On acceptance the two coin steps emit the
coin-accept sound, bump their queued-pulse counters (`COIN1_PULSE_COUNT` [seen] 0x8824 /
`COIN2_PULSE_COUNT` [seen] 0x8826, which feed the physical counters below), and then run the
coinage arithmetic against their descriptor.

The coinage arithmetic is the classic accumulate-and-compare. Slot 1 uses the accumulator at
`SCORE_DRIP_ACCUM` [seen] (0x882b) paired with the `COINAGE_CONFIG` descriptor; slot 2 uses
`DRIP_COORD_B` [seen] (0x882e) paired with `COINAGE_CONFIG_SLOT2`. Each accepted coin adds 0x10 to
the accumulator. While the accumulator has not yet reached the descriptor value nothing is
credited -- this is how "N coins per credit" is realized, since the descriptor's high nibble sets
how many 0x10 steps are needed. Once the accumulator overtakes the descriptor, the code subtracts
the group back off and awards the descriptor's low nibble as credits; a low nibble of 0x0f is
treated as a full wrap that awards the cap amount instead.

All three accumulators converge on the shared tail `addCreditsAndQueueDisplay` (via
`addFullWrapCreditAmount` for the full-wrap case, which simply seeds the award amount to 0x63
first). The tail adds the award to the credit count `CREDIT_COUNT` [seen] (0x8802), clamps it to a
maximum of 0x63, and queues a credit-display refresh through `queueCreditDisplayRefresh`. Despite
the "score" wording in some of these routines, the cell they accumulate into is the credit count,
not a score. And despite being described elsewhere as a BCD counter, `CREDIT_COUNT` is maintained
here as a plain binary count capped at 0x63 (99 decimal); it is converted to packed BCD only at
render time (see the HUD below).

### The physical coin counters

Two of the chain's sub-steps drive the cabinet's mechanical coin meters, one per slot, as timed
strobes on two LS259 latch bits: `COIN1_COUNTER_LATCH` [seen] (0xa183, bit 3) and
`COIN2_COUNTER_LATCH` [seen] (0xa184, bit 4). `pulseCoinCounter1Latch` handles counter 1 and the tail
`pulseCoinCounter2Latch` handles counter 2; they are structural twins. (The remaining sub-step,
`bumpTamperStrikeOnRomChecksumMiss`, is a periodic anti-tamper check rather than a meter driver.) Each reads a queued-pulse
count (bumped by the corresponding accrual step above) and a phase timer (`COIN1_PULSE_PHASE`
0x8825 / `COIN2_PULSE_PHASE` 0x8827). With pulses queued and the phase idle, it seeds the phase
timer to 0x30 and raises the latch; on subsequent frames it counts the phase down, drops the latch
at phase 0x18, and retires one queued pulse when the phase reaches zero. The result is a clean,
fixed-width electrical pulse to the meter for every coin accepted, decoupled in time from the coin
pulse itself. The service-credit step has no such counter -- service credits are free and are not
metered.

### Starting a game and consuming credits

Two paths lead into a game, and both gate on a nonzero `CREDIT_COUNT` (unless free play makes the
gate irrelevant).

On the attract/idle path, the shared epilogue `advanceGameStateOnCreditOrStartPress` checks the
coinage descriptor: when not free play, a waiting credit simply advances the top-level state
`MAIN_GAME_STATE` [seen] (0x8805) and resets `PLAY_STATE_INDEX` [seen] (0x880a), moving the
machine off attract; when free play, it instead watches the IN0 start bits directly and routes a
one-player start (bit 3) or a two-player start (bit 4) into the game builders.

The button-driven path is `startGameOnStartButtonPress`, reached while a credit is present. It
refuses to start if a game is already active -- keyed off the two-player flag, it checks the
other player's life count and the phase-gauge counter and bails when either is nonzero --
then requires the start-gate bits (0x18) to be set before enqueuing the start sound and tailing
into `startSelectedPlayerGameConsumingCredits`. That handler reads the start bits and spends
credits accordingly: a one-player start (bit 3) hands off to `startOnePlayerGameOnCredit`, which
spends one credit and begins a fresh single-player game; a two-player start (bit 4) requires and
spends two credits, and -- as an anti-tamper check -- runs a checksum over a small ROM table
`CREDIT_CHECKSUM_TABLE` [code] (0x776b) and bumps `CREDIT_TAMPER_COUNTER` [code] (0x89ea) if the
fold is wrong, before entering the two-player start-of-life.

`startNewGamePlay` performs the actual start-of-life setup and is where the player configuration
is committed. It records the active-player selection -- the low byte becomes the active-player
index in `ACTIVE_PLAYER` [seen] (0x880d) and the high byte becomes the two-player flag in
`TWO_PLAYER_FLAG` [seen] (0x880e) -- runs the pre-play credit display setup, then seeds the
top-level machine state: sets the in-play flag `GAME_ACTIVE_FLAG` [seen] (0x8806), sets
`MAIN_GAME_STATE` to 3 (play), clears `PLAY_STATE_INDEX`, and forces `FLIP_SCREEN_FLAG` back to
upright. It resets the actor tables, primes the periodic-event scheduling pair (clearing
`WAVE_EVENT_LATCH` [seen] 0x8d21 and reloading `PERIODIC_EVENT_TIMER` [seen] 0x8d22 to 0x20), and
enqueues the start-of-life sound. For a two-player game it additionally enqueues the second-player
sound variant and clears a small panel block. `beginTwoPlayerStartOfLife` is the thin two-player
entry, seeding the start value 256 (high byte 1 -> two-player flag set) into this same setup.

### Two players sharing one board

Two players alternate on a single hardware board by swapping the live actor/state page in and out
of two saved banks. `ACTIVE_PLAYER` (0x880d) selects whose turn it is -- bit 0 clear selects
player 0's banks, set selects player 1's -- and `TWO_PLAYER_FLAG` (0x880e) records whether a
second player exists at all.

Each player has a saved 0x3f-byte state block: `PLAYER0_STATE_BANK` [seen] (0x8940) and
`PLAYER1_STATE_BANK` [seen] (0x8980). On a turn change the live page is block-copied into the
retiring player's bank -- `saveLivePageToPlayer0Bank` and the active-player-aware
`saveLiveStateToPlayerBank` do this and reset the play sub-state -- and the incoming player's bank
is copied back into the live page (as `initRoundArenaAndRestorePlayerBank` does at round setup, selecting the bank by
`ACTIVE_PLAYER`). `reseedOtherPlayerForTurn` is the turn-hand-off tail: if the other player
(player 1, checked via `PLAYER1_LIVES`) has no lives left it diverts to the full-clear/continue
path, otherwise it zero-fills player 0's bank, marks player 1 active, and reseeds the board
for that player's turn.

Lives are tracked per player in `PLAYER0_LIVES` [seen] (0x8948) and `PLAYER1_LIVES` [seen]
(0x8988), each seeded from `LIVES_DSW` at board reset and decremented on death; reaching zero
gates the player-switch-versus-game-over decision. Scores are likewise per player, in the 3-byte
BCD buffers `P1_SCORE_BCD` [seen] (0x88a2) and `P2_SCORE_BCD` [seen] (0x88a5);
`selectActivePlayerScoreBuffer` returns the pointer to whichever buffer bit 0 of `ACTIVE_PLAYER`
selects, so only the active player's score accumulates during his turn while the other stays
frozen.

The extra-life award schedule is config-driven off `BONUS_AWARD_DSW`. `advanceBonusAwardQueueAndBumpGauge` keeps a pending
threshold in the award queue: an empty queue reloads from the schedule (5 when the DSW bit is 0,
else 3), and when the active player's score MSB reaches the queued threshold it saturating-bumps
the phase-gauge counter, advances the queued threshold by the BCD schedule step (8 or 7, again per
the DSW bit), and plays the tally sound -- so the difficulty of earning the bonus is a boot-time
configuration choice.

### The credit HUD and its tamper tripwire

The credit count is drawn as two digit tiles by `drawCreditCountAndTamperCheck`. It reads `CREDIT_COUNT`, clamps it to
99, and converts the binary count to packed BCD: the tens nibble is written to
`CREDIT_HUD_TENS_VRAM` [seen] (0x86bf) only when nonzero (leading-zero suppression), and the units
nibble always to `CREDIT_HUD_UNITS_VRAM` [seen] (0x869f). `queueCreditDisplayCommands` handles the
surrounding display commands, enqueuing an extra command only when the machine is in free play so
the HUD shows the free-play legend rather than a credit count.

Folded into the credit HUD render is a hidden integrity check, characteristic of this ROM's
anti-tamper style: only when the units digit happens to be exactly 2 does `drawCreditCountAndTamperCheck` sum a fixed
31-byte program block downward and, if the sum misses its expected sentinel (0x8c), bump an
anti-tamper strike counter. It is a passive tripwire on the code image, not part of the credit
accounting itself.

## In-play progression and timers

Once a game is running, the top-level NMI state selector `MAIN_GAME_STATE` (0x8805) sits
at value 3, and every frame the machine hands the frame to the play handler
`runPlayStateFrame` (loc_159b). That handler is a thin shell around a second, finer
state machine: a *play sub-state index* held in `PLAY_STATE_INDEX` (0x880a) that walks a
round from its first setup frame, through active play, and out through teardown and the
player-switch decision. Everything in this section hangs off that index and the timers
and counters the sub-states drive. [seen]

### The play frame and its sub-state dispatcher

`runPlayStateFrame` does three things each frame, in order: it ticks the active
player's wall-clock play timer (tickActivePlayerPlayTimer, described below), runs the sub-state dispatcher
(dispatchInPlaySubState), and then runs the end-of-life housekeeping step
(`resetToBoardBuildToContinuePlay`, covered at the end of this section).

The dispatcher (dispatchInPlaySubState) reads `PLAY_STATE_INDEX`, masks it to five bits
(`(0x880a)&0x1f`), and uses that as an index into a word-address jump table at ROM
0x15a8. The selected handler advances its own part of the round and returns; the
housekeeping step then runs, so the end-of-life housekeeping happens after the sub-state
every frame. [seen]

The table at 0x15a8 holds nineteen live word entries (indices 0 through 0x12) followed by
a 0xffff sentinel. In current-state order the entries are:

| idx | handler | role in the round |
|-----|---------|-------------------|
| 0 | initRoundArenaAndRestorePlayerBank | round init |
| 1 | selectRoundDisplayListAndAdvancePhase (loc_16b7) | pick the playfield display list, phase-timer delay |
| 2 | startRoundAfterIntroDelay (loc_175d) | intro hold, then level-start batch |
| 3 | spawnEnemyWave (loc_17c1) | seed and spawn the enemy wave |
| 4 | runActiveGameplayFrame (loc_18af) | active play (14 sub-drivers) |
| 5 | stepGameplayFrame (loc_19ee) | active play (6 sub-drivers) |
| 6 | reseedSpawnCountersAndArmPlayMode (loc_1a01) | reseed spawn counters, arm the play-mode latch |
| 7 | advancePhaseGaugeCountdown (loc_1a64) | drain the phase gauge |
| 8 | rebuildFieldAndLatchPlayStateWithTamperCheck | screen-clear teardown (with a code checksum) |
| 9 | floodFieldAndLatchPlayStatePhaseTimer | screen-clear teardown (sibling) |
| 10 | saveLivePageToPlayer0Bank (loc_1bab) | snapshot the live page into player 0's bank |
| 11 | snapshotPlayer1BankWithSignatureCheck | snapshot into player 1's bank (with a signature tripwire) |
| 12 | advancePlayStateAndStageHighScoreEntryOnTimer (loc_1c03) | stage the high-score entry |
| 13 | driveObjectsByFrameParityThenBuildSprites | per-frame object driver |
| 14 | dispatchRoundEndElseWipeColumn (loc_1c66) | round-clear / game-over / player-swap master |
| 15 | dispatchLevelIntroElseMainLoop | round-parity gate into the level-intro or main-loop dispatch |
| 16 | announceBonusStageAndStartPlay | bonus-stage arming countdown |
| 17 | commitPromotedObjectsAndClearHelpScreenOnCountdown | promoted-object commit countdown |
| 18 | dispatchBonusStagePhase | bonus / eagle-stage phase dispatcher |

Handlers advance the round by writing the *next* index into `PLAY_STATE_INDEX` before
they return, so the sequence of indices below is the shape of a round.

A companion per-frame routine, `tickHudRefresh` (loc_1583, just ahead of the play handler
in ROM), keeps a 16-frame HUD-refresh cadence on its own counter at 0x8f4d and, on each
sixteenth frame, enqueues a display command. Notably, only when the ROM-checksum strike
counter `TAMPER_STRIKES_ROM` (0x89ef) is nonzero does it *also* re-run the whole 0x15a8
sub-state dispatch a second time -- a tamper-triggered corruption of the play machine's
timing, dormant on an intact ROM. [code]

### Building a round (setup phases, indices 0-3)

A round is assembled over its first several frames, one setup handler per index, each
gated so the screen paint and the actor seeding are spread across frames rather than done
in a single burst.

**Index 0 -- round init (initRoundArenaAndRestorePlayerBank).** This handler is gated on the row-by-row tile fill:
it blanks one tilemap row per frame and returns early until the fill has drained, so the
playfield paints in over successive frames. Once drained it clears the actor arena and a
block of round-init cells (the wave-event latch, the rope-extend timer). On the *first*
entry of a two-player round it raises a once-per-round latch at `loc_89e3` (0x89e3), sets
the flip-screen flag from the active-player index, enqueues a player-select display
command, floods the colour/attribute map, and picks a long phase-timer seed (0x80);
subsequent entries use the short seed (0x02, or 0x01-player games take a fixed 0x02).
The shared tail then seeds `PHASE_TIMER` (0x8808), advances `PLAY_STATE_INDEX` by one,
restores the *active player's saved state bank* into the live page (see "Per-player state
banks"), sets the rope-segment count from the wave-arrival counter, and unless suppressed
copies the round-message string into the display message buffer. [seen]

**Index 1 -- display-list select and phase delay (selectRoundDisplayListAndAdvancePhase,
loc_16b7).** This handler counts `PHASE_TIMER` down and returns until it reaches zero, so
it imposes a timed hold between setup steps. On expiry it runs the per-phase setup, then
walks a decision tree keyed on the `PLAY_MODE_LATCH` (0x8f50), the `ROUND_IN_PROGRESS`
flag (0x8904), the `GAME_ACTIVE_FLAG` (0x8806) and the parity of `ROUND_COUNTER` (0x8907)
to choose a (graphic, layout) pointer pair for the playfield display list, commits those
pointers, seeds the enemy-spawn timer to 0x20, advances the sub-state, and enqueues a
display command. If the play-mode latch's bit 0 is set it instead forces the sub-state to
0x10 (index 16, the bonus-stage arming countdown), diverting the round into the bonus
path. [seen]

**Index 2 -- intro hold, then level start (startRoundAfterIntroDelay, loc_175d).** After
running the display-list interpreter, this handler imposes two nested delays: `SUBPHASE_TICK`
(0x88b7) must wrap every 0x1c frames, and on that wrap a two-hit one-shot at the base of
`FORMATION_SLOT_TABLE` (0x8920) returns the first time and only proceeds the second. Past
both delays it branches on the same latch/round flags: it either arms sub-state 0x0d, or
runs the *level-start batch* -- HUD/round-number setup, the phase gauge, the odd-round
marker, the frame-delay/anim-hold/rope-timer seeds (all 0x10), the enemy-spawn driver, and
the sprite display-list rebuild -- and forces sub-state 3. Where it starts a fresh level it
also raises `ROUND_IN_PROGRESS` and seats `WAVE_ARRIVAL_COUNTER` (0x8903) to 2. [seen]

**Index 3 -- wave setup and spawn (spawnEnemyWave, loc_17c1).** This handler selects a
seed table and a tile-animation cursor from the play-mode latch and round parity, publishes
the cursor to `TILE_ANIM_CURSOR` (0x88be), seeds four actor records (a start flag plus two
table-driven bytes each), seats the shared animation-script cursor, and steps the actor
animators. It then splits on the play-mode latch: the zero (normal-play) branch either arms
sub-state 0x12 (the bonus dispatcher) or advances the sub-state by one (into active play at
index 4) and copies a biased intro string into the message buffer; the nonzero branch fans
out an enemy sprite group whose size and tile base scale with `ROUND_COUNTER` (only when
round bit 1 is set), records the group size in `TARGET_GROUP_COUNT` (0x8f47), and forces
sub-state 0x0f. [seen]

### Active gameplay (indices 4-6)

**Index 4 -- the active gameplay frame (runActiveGameplayFrame, loc_18af).** This is where
a round spends most of its time. It is a fixed-order coordinator that runs fourteen
per-frame sub-handlers -- enemy spawns, target lock and aim, the enemy and formation
actor-state sweeps, the sprite-list rebuild, the difficulty/speed drivers, the actor update
pipeline, the stage-label paint -- and returns. It does not itself rewrite
`PLAY_STATE_INDEX`; the round leaves active play only when a progression driver (phase-gauge
exhaustion, a death, or the board-clear diversion) moves the index elsewhere. [seen]

**Index 5 -- the alternate gameplay frame (stepGameplayFrame, loc_19ee).** A leaner
active-play coordinator running six per-frame sub-drivers (the formation manager, the
lift/marker column driver, the enemy and formation object sweeps, the lead-actor secondary
state machine, the sprite-list rebuild). [seen]

**Index 6 -- reseed and arm the play-mode latch (reseedSpawnCountersAndArmPlayMode,
loc_1a01).** This handler reseeds the spawn counters (its helper's return is written to
both `SPAWN_PHASE_COUNTER` (0x8902) and `ROPE_DRAW_COUNT` (0x8934)), seeds the stage
countdown `STAGE_COUNTDOWN` (0x8901), whose initial value selects the stage label (0x30
once `ROUND_COUNTER` reaches 2, else 0x28), and then uses
`ROUND_COUNTER`'s low bit as a two-frame ping-pong: it bumps the counter, and if the
result is odd it saves the live state this frame and returns; if even it either tears down
(credit gate closed), clears the display-list block (play-mode latch already set), or -- the
first-arm case -- *undoes* the bump, latches `PLAY_MODE_LATCH` to 1, sets a one-frame stage
countdown and the bonus launch-script seed. Every non-teardown exit tails into the
live-state save, so the round's live page is snapshotted as it arms. [seen]

### Progression drivers

Round-to-round difficulty is carried in a small block of counters in the live-state page,
all rebuilt or escalated as the round machine turns. `ROUND_COUNTER` (0x8907) is the
BCD-rendered HUD round number; its bit 0 selects the stage-type/facing variant and its low
bits index the difficulty tables, and its bit 1 gates the enemy target-group fan-out.
`SPEED_INDEX` (0x8900, doubling as the base byte of the live-state page) escalates with the
wave/round and is read clamped below 8 to pick a velocity table. `SPAWN_PHASE_COUNTER`
(0x8902) cycles to 7 selecting spawn/fire mode branches, `STAGE_COUNTDOWN` (0x8901) counts
a stage down, and `WAVE_ARRIVAL_COUNTER` (0x8903) is bumped per enemy arrival and bounds the
rope-segment count. [seen]

**The phase gauge (index 7, advancePhaseGaugeCountdown, loc_1a64).** The visible phase
gauge is driven by `GAUGE_PHASE_COUNTER` (0x8908). When the play-mode latch is set this
handler tails into the arming handler (index 6); otherwise it queues the stage sounds,
resets the board RAM and reseeds the spawn counters, clears the once-per-round latch, and --
if the credit gate is open -- decrements the gauge counter. On the counter reaching zero
(or already being zero) it tails into the phase-exhausted handler advancePlayStateThenInsertHighScore; otherwise it
repaints the gauge and seats the sub-state to 0x0a for player 0 or 0x0b for player 1.
A closed credit gate (game no longer active) drops to the attract teardown. [seen]

**Phase exhaustion (advancePlayStateThenInsertHighScore).** Reached when the gauge drains, this queues the
phase-exhausted tile run, advances the sub-state once (and an extra step for the second player),
clears the high-score insert rank, the rope-segment count and the marker-layout pointer,
and tails into the high-score insert-sort. This is the transition that ends the playable
part of a round and steps into the teardown indices. [seen]

**Bonus / eagle stages.** Two sub-states carry the bonus-stage path. Index 16 (announceBonusStageAndStartPlay)
runs a countdown on the launch-script pointer: at the boundary value 0x40 it enqueues the
bonus-stage banner and its sound, and at zero it clears the sub-state, latches
`PLAY_MODE_LATCH` to 2, reloads the enemy-spawn timer to 0x40, and (unless round bit 1 is
set) raises the hunter-spawn flip flag. Index 18 (dispatchBonusStagePhase) is the bonus/eagle-stage phase
dispatcher, selecting among an approach frame, a launch frame, and a hold-expiry cleanup by
the outer wave phase `WAVE_OUTER_PHASE` (0x8f38). Index 15 (dispatchLevelIntroElseMainLoop) gates on `ROUND_COUNTER`
bit 1 -- clear, it delegates to the main-loop sub-state dispatcher; set, it runs the
level-intro phase dispatcher (and then a code-window integrity probe, `[code]`). Index 17
(commitPromotedObjectsAndClearHelpScreenOnCountdown) runs a pending-object countdown and, on underflow, commits promoted-object values
and returns the machine to active play (sub-state 4). Index 13 (driveObjectsByFrameParityThenBuildSprites) is a per-frame
object driver split on frame parity. [seen]

### Leaving a round: teardown, player switch, continue (indices 8-14)

After phase exhaustion the machine walks a fixed teardown chain.

**Indices 8 and 9 -- screen clear (rebuildFieldAndLatchPlayStateWithTamperCheck, floodFieldAndLatchPlayStatePhaseTimer).** These sibling handlers tick the
tilemap clear one row per frame and bail while it drains; once drained they flood the
attribute columns, enqueue two display commands, run the shared integrity/timer handler, and
latch the sub-state to 0x0c (index 12). rebuildFieldAndLatchPlayStateWithTamperCheck additionally re-arms the fill from the fixed
start, clears the phase timer, folds a 34-byte program block into a rolling checksum and bumps
the tamper-freeze tally (`TAMPER_FREEZE_FLAG`, 0x881e) unless the sum equals 0x7c, and copies
a biased string into the message buffer; floodFieldAndLatchPlayStatePhaseTimer instead reloads the phase timer to 0x60. [seen] (tamper tally [code])

**Index 12 -- stage the high-score entry (advancePlayStateAndStageHighScoreEntryOnTimer,
loc_1c03).** Gated on the phase timer, on expiry this plays three sounds, paints a column
strip and its frame, enqueues a display command, and advances the sub-state to 0x0e (index
14). When `HIGH_SCORE_INSERT_RANK` (0x89fc) is nonzero it also builds a column pointer from
the rank, seeds the wipe tile, and copies the high-score-entry source table into the display
buffer. [seen]

**Index 14 -- the round-end / player-swap master (dispatchRoundEndElseWipeColumn, loc_1c66).**
This is the decision point for what happens after a round ends. It ticks the phase timer;
while a reset-scan latch is armed and the timer expires it stamps the reset column, runs an
integrity checksum (a 10-byte column must sum to 0xaa) gating the re-init, disarms the latch,
and branches on the player situation: in a one-player game (or when player 0 is out of lives)
it tails to the full-clear/continue path; when the active player is player 0 it tails to the
other-player reseed; otherwise it flips the active player back to 0, clears the sub-state,
zero-fills player 1's saved bank, and stamps the reset column. Absent the re-init condition
it runs the write-anim pre-pass and, every eighth tick, wipes a vertical tilemap column with a
stepping fill tile. [seen]

**Player switch and continue.** `reseedOtherPlayerForTurn` (loc_1cf6) handles handing the
turn to the other player: with player 1 out of lives it falls through to the full clear;
otherwise it clears the sub-state, zero-fills player 0's bank, marks player 1 active, and
reseeds. `clearActorsAndEnterContinueState` (loc_1d15) zero-fills the live actor page and
reseeds one player; with no credit left it delegates to the cold attract teardown, otherwise
it clears the active-game gate, clears the sub-state, arms flip-screen, and drops the top-level
state to 2 (board build) for a continue. [seen]

### Per-player state banks and the live page

The active player's actor/state lives in a single *live page* based at `SPEED_INDEX`
(0x8900); a 0xbf-byte region cleared wholesale on a board reset, of which the first 0x3f
bytes are the swappable per-player block. Each player has a saved bank a fixed distance
above it: `PLAYER0_STATE_BANK` at 0x8940 and `PLAYER1_STATE_BANK` at 0x8980, each 0x3f
bytes, with that player's remaining lives at bank+8 (0x8948 and 0x8988). Byte 0 of a bank
is the sprite colour and byte 1 the opening X, both seeded at board reset. [seen]

On a player switch the live page is snapshotted into the departing player's bank and the
incoming player's bank is restored into it, so each player resumes exactly where they
paused. `saveLivePageToPlayer0Bank` (index 10, loc_1bab) copies the live page into player
0's bank (latching player 1 active first if player 1 is still alive) and clears the
sub-state; snapshotPlayer1BankWithSignatureCheck (index 11) does the same into player 1's bank (selecting player 0 if
still alive) and then folds a fixed program block into a signature checksum, bumping a
signature tamper counter unless it lands on the sentinel 0x8a60 (`[code]`). The generic
`saveLiveStateToPlayerBank` (loc_1a47) picks the bank by `ACTIVE_PLAYER`; the round-init
handler (initRoundArenaAndRestorePlayerBank) performs the *restore* direction, copying the active player's bank into
the live page. [seen]

### Lives and player-alternation gates

Whether the game is one- or two-player is fixed at start in `TWO_PLAYER_FLAG` (0x880e), and
which player is live is `ACTIVE_PLAYER` (0x880d): bit 0 clear selects the player-0 banks and
score, set selects player 1's. `startNewGamePlay` (loc_0dab) seats these from the start
event, sets `MAIN_GAME_STATE`=3, raises `GAME_ACTIVE_FLAG`, clears the sub-state, and calls
`resetActorStateForBoard`, which seeds *both* players' lives from the lives switch
`LIVES_DSW` (0x8807) into 0x8948 and 0x8988. [seen]

`PLAYER0_LIVES` (0x8948) and `PLAYER1_LIVES` (0x8988) are the decisive lives countdowns:
each holds the default (3) at start and drains toward zero as that player dies. Within this
subsystem they act as gates rather than being decremented here (the decrement happens on the
death path). The round-end master reads `PLAYER0_LIVES` to decide full-clear versus swap, the
other-player reseed reads `PLAYER1_LIVES` to decide swap versus full-clear, and the bank-save
handlers read the *other* player's lives to decide whether to hand off the active-player flag.
Between them these reads implement two-player alternation: a death ends the current player's
turn, the machine swaps to the other player if they still have lives, and when both are
exhausted it falls to the continue/attract teardown. [seen]

### The BCD play timers

Each player has a wall-clock play timer maintained in BCD, ticked once per play frame by
tickActivePlayerPlayTimer (the first call in `runPlayStateFrame`). The timer bails immediately if
`GAME_ACTIVE_FLAG` is clear, then selects the active player's pair: gate byte
`PLAY_TIMER_GATE_P1` (0x89e1) / `PLAY_TIMER_GATE_P2` (0x89e2) and timer bank
`PLAY_TIMER_BCD_P1` (0x8a30) / `PLAY_TIMER_BCD_P2` (0x8a33). A nonzero gate byte suppresses
the tick for that player, freezing their clock while the other plays.

Each timer bank is three bytes: a frame sub-counter followed by BCD seconds and BCD minutes.
The sub-counter rolls at 0x3b or 0x3c frames -- the extra frame chosen by bit 0 of the
seconds byte, so the average roll approximates one second at the ~60 Hz frame rate. On the
roll it clears and BCD-carries the seconds digit (its low nibble rolling at 0x0a, its high
nibble at 0x60 = sixty seconds), and on a seconds overflow carries into the minutes digit the
same way. These accumulated play-times ride alongside the high-score table: the per-entry play
time is held above `HIGH_SCORE_TIME_TABLE` (0x89e0) and shifted into the opened slot when a
new high score is inserted. [seen]

### End-of-life housekeeping (the dispatch continuation)

After the sub-state handler runs, every play
frame finishes in `resetToBoardBuildToContinuePlay`. While `GAME_ACTIVE_FLAG` is still set it
does nothing and returns to the frame caller. Once the game has gone inactive it decides what
comes next: on free play (`COINAGE_CONFIG` == 0x0f) it tails to the shared attract epilogue;
with no credit it simply returns (leaving the machine parked); and with a credit banked it
drops `MAIN_GAME_STATE` back to 2 (board build) with the sub-state cleared, runs the board/HUD
reset and the arena clear, and blanks an eight-tile attribute column -- staging the next
game's board build. This is the hand-off between a finished game and the board-build subsystem.
[seen]

## Deep states: round 2 and the bonus stage

Once a round has been survived, the game does not simply restart the play loop. A single
bit in `ROUND_COUNTER` (0x8907) splits every frame into two worlds: the ordinary in-play
main loop, and a "deep" path that runs the level-intro/round-start choreography and the
bonus stage. Woven through both paths is a small scripted sub-state machine that counts
down timers, paints tallies, and finally commits the machine into the next board -- all of
it shadowed by two self-checking integrity traps that abort the frame if the ROM or the
playfield has been tampered with.

### The round-2 gate (dispatchLevelIntroElseMainLoop) [seen]

`dispatchLevelIntroElseMainLoop` (ROM 0x1d9c) is the per-frame fork. It reads `ROUND_COUNTER` (0x8907) and tests
bit 1. When the bit is **clear** -- the common case -- it simply hands the frame to the
main-loop sub-state dispatcher `dispatchMainLoopSubstate` and returns; nothing deep happens. When bit 1 is
**set**, the machine is in the round-2 / deep world: it first runs the level-intro phase
dispatcher `dispatchLevelIntroPhase` (0x6da6), and then performs a
code-window integrity probe before returning.

The probe is a bit-tally over a fixed ROM cell. It forms an address in the 0x5a28 window
(loading 0x584c, subtracting 0x24 from the low byte to reach 0x28, and bumping the high
byte twice to 0x5a) and then makes 0x20 passes -- note that the loop never advances the
pointer, so all 0x20 passes read the *same* cell. Each pass adds one for bit 0 set and one
for bit 3 clear. If the running total does not equal the pass count (0x20), the routine
latches the anti-tamper strike flag at `INTEGRITY_FLAG_SCAN_BASE` (0x89e7) to 1; a matching
tally leaves that flag untouched. So bit 1 of `ROUND_COUNTER` is the master switch for the
deep path, and entering that path is guarded by a code-integrity check that records a strike
on mismatch rather than crashing outright.

### The main-loop sub-state dispatcher (dispatchMainLoopSubstate) [seen]

The ordinary play loop is itself a six-way state machine. `dispatchMainLoopSubstate` (ROM 0x0fd5) reads
`MAINLOOP_SUBSTATE_SELECTOR` (0x8f5c), masks it to the low three bits, and selects one of
six handlers through the inline table at 0x0fe3:

- state 0 -> `rearmMainLoopFrame`
- state 1 -> `runActivePlayFrame`
- state 2 -> `queueBonusStageTallyDisplayOnDelay`
- state 3 -> `paintSubstateHudDigitsAndAdvancePhase`
- state 4 -> `driveHunterSpawnDisplayAndAdvancePhase`
- state 5 -> `advancePlayStateToPhase6OnDwellExpiry`

There is an asymmetry worth understanding: states 0 and 1 return straight to the caller,
but for states 2 through 5 the dispatcher first arranges for the selected handler to fall
into the post-handler tail `advanceObjectsAndRebuildSprites` when it finishes. In other words, the timer/HUD
sub-states (2-5) always run an extra four per-frame passes after their own work, while the
two "worker" sub-states (0-1) do not. This is what keeps the object sweep and display list
rebuilding even during the scripted countdown states, where the handler bodies themselves
are just timers.

### Sub-states 0 and 1: the per-frame worker chain (rearmMainLoopFrame, runActivePlayFrame) [seen]

Sub-state 1 (`runActivePlayFrame`, ROM 0x1016) is the heart of active play: a straight-line sequence
of ten subsystem updates run in a fixed order every frame --

1. HUD refresh (0x1583)
2. lead-actor input / sprite-0 control seed (0x1042)
3. sub-state advance + display-command enqueue, gated on `STAGE_COUNTDOWN` (0x107d)
4. object-update gate (0x20d4)
5. enemy spawns (0x511b)
6. the per-object state sweep (0x1219)
7. formation-state dispatch (0x40bd)
8. sprite display-list rebuild (0x02ef)
9. the actor pipeline (0x5ae4)
10. the sound-ring drain (0x0e64)

-- and then it returns. That fixed ordering *is* the frame: HUD first, input and game
logic in the middle, the display list rebuilt near the end, sound drained last.

Sub-state 0 (`rearmMainLoopFrame`, ROM 0x0fef) is the re-arm/setup state that shares this same worker
chain by **falling through into it**. It first writes 0x0f into `STAGE_COUNTDOWN` (0x8901),
and -- if bit 2 of `ROUND_COUNTER` is set -- runs the object-freeze integrity gate `guardObjectFreezeIntegrity`
(described below). It then re-arms three latches to 1 (`HUNTER_SPAWN_FLIP_FLAG` 0x8f61,
`LAUNCH_ARMED_FLAG` 0x8f3f, and `MAINLOOP_SUBSTATE_SELECTOR` 0x8f5c itself) and calls the
main-loop setup helper (0x0fbc). Finally it reads a pending sub-state byte at 0x8a38: if it
is zero the frame ends here; if it is non-zero, that value is stored into
`MAINLOOP_SUBSTATE_SELECTOR` and control falls straight into the ten-call worker chain. So
state 0 either idles after re-arming, or promotes a pending sub-state and immediately runs a
full worker frame under it.

### The post-handler tail (advanceObjectsAndRebuildSprites) [seen]

`advanceObjectsAndRebuildSprites` (ROM 0x1035) is the shared continuation the dispatcher seats for sub-states 2-5.
After the selected handler finishes, control lands here and runs four per-frame passes in
order -- the target-actor step (0x2157), the per-object state sweep (0x1219), formation-state
dispatch (0x40bd), and the sprite display-list rebuild (0x02ef) -- then returns. This is why
the scripted countdown states still animate objects and refresh the screen even though their
own handler bodies do almost nothing but tick a timer.

### The scripted sub-state sequence (queueBonusStageTallyDisplayOnDelay, paintSubstateHudDigitsAndAdvancePhase, driveHunterSpawnDisplayAndAdvancePhase, advancePlayStateToPhase6OnDwellExpiry) [seen]

Sub-states 2 through 5 form a one-way script. Each is a timer that, on expiry, advances
`MAINLOOP_SUBSTATE_SELECTOR` (0x8f5c) to the next state, so the machine marches
2 -> 3 -> 4 -> 5 as its timers drain. This is the choreography that stages the bonus/round
transition.

- **State 2 -- `queueBonusStageTallyDisplayOnDelay`** (ROM 0x1090) counts down `SUBSTATE_FIELD1_COUNTER` (0x8f62).
  While non-zero it just decrements and returns. On the tick it reaches zero, it bumps the
  selector to state 3 and enqueues `BONUS_STAGE_TALLY_DISPLAY_CMD` (0x0634) -- the display
  command that paints the bonus-stage points tally ("BONUS POINT" / "MEAT .. 00 PTS" /
  "WOLF .. 00 PTS").

- **State 3 -- `paintSubstateHudDigitsAndAdvancePhase`** (ROM 0x10a2) repaints three HUD BCD digit fields, then bumps the
  selector and queues a sound cue (0x0f44). For each field it runs the BCD helper (0x1131)
  when the raw value is >= 0x0a and then paints the two nibbles into a sprite/tile pair via
  the digit painter (0x1119). The first field, `HUNTER_SPAWN_SUBCOUNTER` (0x8f5d), is drawn
  at VRAM 0x8650; when its value lies in 1..0x0b it is additionally re-centred around 5 (the
  inc/dec loops offset it from 7), stashed into `SUBSTATE_FIELD1_COUNTER` (0x8f62), doubled,
  and painted a second time at 0x85d0. The second field, `SUBSTATE_FIELD2_VALUE` (0x8f5e),
  paints at 0x8652. The third, `SUBSTATE_FIELD3_VALUE` (0x8f60), when non-zero is folded into
  the 0x8f62 accumulator, doubled, run through BCD, and painted at 0x85d2 -- optionally
  latching its high-digit count to 0x85f2.

- **State 4 -- `driveHunterSpawnDisplayAndAdvancePhase`** (ROM 0x113c) ticks the same `SUBSTATE_FIELD1_COUNTER` (0x8f62).
  While it counts, each frame enqueues `HUNTER_SPAWN_DISPLAY_CMD` (0x0315). On expiry it
  reloads the counter to 0x80 and bumps the selector to state 5.

- **State 5 -- `advancePlayStateToPhase6OnDwellExpiry`** (ROM 0x114f) is the commit. It ticks `SUBSTATE_FIELD1_COUNTER`
  (0x8f62) and, while non-zero, simply returns. On expiry it clears a nine-byte block at
  `LATCHED_ENEMY_X` (0x8f5b), enqueues the silence sound command (0x0ecf), and sets
  `PLAY_STATE_INDEX` (0x880a) to 6. It then sums `SCORE_DRIP_ACCUM` (0x882b) with the tamper
  guard `TAMPER_STRIKES_HUD_GUARD` (0x8a3c): if that sum is zero it returns, otherwise it
  tail-runs the enemy-spawn slot sweep `spawnHunterIntoFreeSlot`. The guard sum is the gate that decides
  whether the transition spawns fresh objects.

### The enemy-spawn slot sweep (spawnHunterIntoFreeSlot) [seen]

`spawnHunterIntoFreeSlot` (ROM 0x118d) walks the object-record slots and seeds the free ones. It runs a
counted loop -- six records (B = 0x06) beginning at the first 0x18-byte record, advancing by
the 0x18 stride each pass -- handing each record to the per-slot initializer (0x119a) with an
activation seed of 0x1d. The initializer activates a slot only if it is currently free, so
the sweep fills empty spawn slots and leaves active ones alone. State 5 tails into this sweep
to populate the board as the machine commits to `PLAY_STATE_INDEX` 6.

### The bonus stage: intro banner and countdown (announceBonusStageAndStartPlay) [seen]

`announceBonusStageAndStartPlay` (ROM 0x1d6e) drives the bonus-stage intro as a single countdown on the cell at
0x8f4a (the launch-script cell, reused here as the intro timer). It reads the timer, ticks it
down, and branches on the pre-decrement value:

- At the boundary value **0x40** it verifies the ROM checksum (0x79e9), enqueues the
  "BONUS STAGE" banner display command (0x0626, painted at VRAM 0x86d1) `[seen]`, fires the
  banner's sound cue (0x0f44), and returns.
- While the timer is otherwise non-zero it just returns -- the banner stays up.
- At **zero** (expiry) it commits the bonus stage: it clears `PLAY_STATE_INDEX` (0x880a),
  writes 0x02 into `PLAY_MODE_LATCH` (0x8f50), reloads `ENEMY_SPAWN_TIMER` (0x8d07) to 0x40,
  and -- unless bit 1 of `ROUND_COUNTER` (0x8907) is set -- raises `HUNTER_SPAWN_FLIP_FLAG`
  (0x8f61) to 1. The `ROUND_COUNTER` bit-1 check is the same round-2 discriminator the gate
  uses, so the deep path suppresses the hunter-spawn flip that a first-round bonus stage
  would raise.

The bonus tally itself is not painted here; it is the `BONUS_STAGE_TALLY_DISPLAY_CMD`
(0x0634) that sub-state 2 enqueues on its countdown expiry, listing the meat and wolf point
awards.

### The help-clear commit (commitPromotedObjectsAndClearHelpScreenOnCountdown) [seen]

`commitPromotedObjectsAndClearHelpScreenOnCountdown` (ROM 0x6bb2) is a countdown-gated commit that both promotes objects onto the field
and tears down the how-to-play help screen. It decrements `PENDING_OBJECT_COUNTDOWN` (0x8d5e)
and returns early every frame until it underflows to zero. On that frame it walks the
eleven-entry `PROMOTED_OBJECT_LIST` (0x8d80), whose records are three bytes each
(pointer-low, active flag, value). For every active record it commits the record's value into
RAM six bytes past the record's little-endian pointer (the active byte supplies the pointer's
high byte, and the destination is advanced by 6). After the walk it sets `PLAY_STATE_INDEX`
(0x880a) to 4 and enqueues five help-clear display commands (0x06ab..0x06af) -- the first of
which blanks the "2ND PHASE GETS" help line at VRAM 0x86d0 -- tailing into a display-list
rebuild (0x02ef). So this routine is the moment the how-to-play/second-phase screen is wiped
and the promoted objects are written into the board, handing the machine to play-state 4.

### The per-object state sweep (stepEnemyActorStates, stepEnemyActorState) [seen]

Every worker frame -- both directly in the sub-state 0/1 chain and again in the post-handler
tail -- runs the per-object state sweep. `stepEnemyActorStates` (ROM 0x1219) walks the 14 enemy-actor
records of `ENEMY_ACTOR_TABLE` (0x8ae0) with the 0x18 stride, handing each record to the
per-object state dispatcher `stepEnemyActorState`. It brackets each dispatch by swapping the register
bank so the loop counter and pointers survive the dispatcher's clobbering, then advances to
the next record and repeats for all fourteen.

`stepEnemyActorState` (ROM 0x122c) is the per-record dispatcher, with two guards before it does any
work. First it rejects an inactive record: it ORs the two header bytes at record+0 and
record+1 and tests bit 0 -- if clear, the record is inactive and it returns. Second it reads
the state byte at record+2, masks it to the low five bits, and rejects any value >= 0x11 as
out of range. A surviving record is routed through the inline 17-way table at 0x123d to the
handler for its sub-state (index 0..0x10). The selected handler returns directly to the
sweep, so each record advances its own state machine by one frame.

### The integrity traps on the deep path (guardObjectFreezeIntegrity, guardTilemapIntegrity) [seen]

Two self-checking traps shadow the deep path. Sub-state 0 enters the first of them
(`guardObjectFreezeIntegrity`) whenever bit 2 of `ROUND_COUNTER` (0x8907) is set.

`guardObjectFreezeIntegrity` (ROM 0x50f1) is an object-freeze gate wrapped around a self-checksum. It reads
`TAMPER_OBJECT_FREEZE_FLAG` (0x89fb): if the flag is set, control transfers to the code at
0x5119. If the flag is clear, the routine walks the bytes of the second trap routine
(`guardTilemapIntegrity`) as data, summing them into a 16-bit accumulator until it meets the 0xc9
terminator, and compares the low byte of that sum against the constant stored at 0x5119 --
so the routine checksums the very code it is about to run, using a constant that lives at the
same address the freeze-flag branch jumps to. It then enters `guardTilemapIntegrity` as code. There is no
divergent exit for a checksum mismatch here; the compare merely sets flags, and the walk's
purpose is the self-check.

`guardTilemapIntegrity` (ROM 0x6ac5) is a one-shot playfield-tilemap checksum. It runs at most once, and
only in one specific state: it returns immediately unless `WAVE_NUMBER` (0x892d) equals 2 and
the once-latch `TILE_SUM_ONCE_LATCH` (0x8f56) is still clear. On its single qualifying pass
it sets the latch to 1 (so it never re-runs) and then 16-bit-sums a strided walk of the
tilemap from 0x8450: each byte accumulates into the running sum, the low pointer advances one
per step, and the low five bits of the pointer steer the stride -- column 0x1b skips one extra
byte (a padding column) and column 0x1f jumps the pointer forward by 0x12 to the next row
start, with the walk stopping once the high byte reaches 0x88. When the walk ends the sum
must be exactly 0x29b8 (low byte 0xb8, high byte 0x29); a matching sum returns cleanly, a
low-byte mismatch diverts into the tamper-trap landing at 0x0929, and a high-byte mismatch
diverts to 0x3829. A tampered playfield therefore never returns to normal play.

## The actor arena

Every moving thing on the playfield — the player, the enemies that ride the ropes, the
projectiles, the fountain and formation objects — lives as a record in one contiguous block of
work RAM, the actor arena. The arena is a flat array of fixed-size 0x18-byte records based at
`ACTOR_TABLE` (0x8a80) [seen]. Slot 0, the record at 0x8a80 itself, is the player/lead actor; the
enemy records begin 0x60 bytes in, at `ENEMY_ACTOR_TABLE` (0x8ae0) [seen], which is simply slot 4
of the same array. The whole arena is one 0x200-byte span — `clearActorArena` (0x19bc) [seen]
zero-fills exactly 0x200 bytes from 0x8a80 at board init, wiping the player record, the enemy
sub-array, and everything past it so a fresh board starts with no stale actor state;
`clearActorArenaAndCounters` (0x2ae8) [seen] does a longer 0x241-byte fill and additionally resets
the spawn and wave counters, clears the rope-segment count, and forces the play sub-state to 6 (the
after-teardown state).

Because the records are uniform, the game treats 0x8ae0 as the base of *any* pool it wants to
sweep and picks a length to suit the subsystem: the low-state and per-object dispatchers walk 14
records (0x0e) forward from 0x8ae0, the spawn and collision passes walk 6, and the object driver
walks 18. A length of 18 at stride 0x18 reaches from 0x8ae0 up to 0x8c90, so the longer sweeps
deliberately run across the adjacent projectile and formation pools — the state byte a projectile
slot exposes at 0x8bea is the same field an enemy record exposes at its own +2, and the code
relies on that overlap rather than treating the pools as separate arrays.

### The record layout

Each record packs its actor's entire per-frame state into 0x18 bytes, and the same offsets carry
the same meaning across every sweep that visits it:

- **+0x00 / +0x01 — presence.** The two-byte header doubles as a liveness flag. The per-record
  dispatcher `stepEnemyActorState` (0x122c) [seen] ORs the two bytes and tests bit 0: a record whose combined
  header has bit 0 clear is dormant and is skipped. The lighter sweeps test byte 0 alone (a zero
  byte 0 means empty), and a freshly spawned record is stamped with byte 0 = 1 to mark it live.
- **+0x02 — state index.** The dispatcher masks this to five bits and uses it as a jump-table
  selector; it is the actor's position in its own state machine.
- **+0x04 — Y coordinate.** The actor's vertical position, and for the player the value from which
  its three sprite rows are derived (below).
- **+0x07 — facing / animation-variant flag.** Bits 0 and 1 here choose which animation script or
  turn-around variant is armed into the record.
- **+0x09 / +0x0a — facing byte and its negation**, seeded at spawn from a lookup keyed on the
  round counter.
- **+0x0c / +0x0d — animation stream pointer** (little-endian), the per-record cursor into the
  actor's tile/attribute script.
- **+0x0e — frame-hold countdown**, how many frames the current animation frame stays on screen.
- **+0x0f — colour attribute** and **+0x10 — tile code**, the two bytes the display reads to draw
  the actor.
- **+0x11 — frame delay** used by the lead-actor handlers to pace their transitions.
- **+0x12 / +0x13 / +0x16 — a second animation timer, a two-bit phase, and an armed bit** used by
  the grow/shrink hold stepper.
- **+0x14 — collision key**, the byte a projectile hit is matched against.

### Sweeping the arena and dispatching per-record state

The per-frame state advance is a plain walk. `dispatchAllEnemyActorStates` (0x3377) and its twin
`stepEnemyActorStates` (0x1219) [seen] point at 0x8ae0, set a stride of 0x18 and a count of 14, and hand each
record in turn to the per-record dispatcher, advancing the pointer one record between visits until
the count runs out. `dispatchAllHunterRecordStates` [seen] does the same over a longer 17-record hunter span.

The dispatcher `stepEnemyActorState` (0x122c) [seen] is where a record's state actually runs. It first
applies two guards — a dormant record (header bit 0 clear) and an out-of-range state (state byte &
0x1f ≥ 0x11) both return immediately without doing anything — then reads the masked state byte and
routes the record to one of seventeen handlers through a jump table (states 0 through 0x10). Each
handler is a state of the actor's own machine; the selected handler returns straight back to the
sweep, which moves on to the next record. `dispatchActiveEnemyActorState` (0x338a) [seen] is the
low-state variant of that per-record dispatch used by the 0x3377 sweep.

### Stepping the animation

Animation advance is separate from state advance and comes in two flavours that share the same
record fields. Both hang on the frame-hold countdown at +0x0e: while it is non-zero the routine
simply decrements it and returns, so the current frame holds on screen; only when it reaches zero
is the next frame pulled.

The per-record flavour, `advanceActorAnimFrame` and the identical `advanceObjectAnimationFrame`
[seen], reads the record's own stream pointer at +0x0c/+0x0d. A stream byte of 0xff is a jump
opcode: the two following bytes replace the pointer and the walk re-reads from there. Any other
byte begins a three-byte frame — tile into +0x10, attribute into +0x0f, new hold into +0x0e — after
which the advanced pointer is written back to +0x0c/+0x0d.

The shared-cursor flavour, `advanceActorAnimationFrame` driven by
`advanceActorAnimationsUnlessGrabbing` [seen], works the same way but reads from one animation
cursor in RAM shared across the four records it steps (the player record and the three one stride
apart), rather than a per-record pointer. That pass is gated on the grab latch: while a rope-grab
is in progress the whole animation pass is skipped. A 0xff lead byte is again a control marker
whose two trailing bytes normally replace the cursor as an inline jump; a rival full reset to the
base script is wired but only fires when a target-presence fold reaches 3, a value that fold never
takes, so in practice the marker always resolves as the inline jump.

Two more sweeps tick animation across the enemy pool. `advanceEnemyActorStateWalk` (0x7627) [seen]
is a shared per-frame animation-tick walk that ticks a run of enemy records and bails early when a
tick signals a phase-transition reseed. `tickEnemyActorAnimHolds` (0x5d0b) [seen] walks the six enemy records and
runs the grow/shrink hold stepper `tickActorAnimHold` (0x5d1e) [seen] on each: it skips a record
unless the record's per-record animate bit (+0x0b bit 0) is set or the round is even, then
decrements the +0x12 hold timer and, on underflow, steps the two-bit phase at +0x13, re-arming the
+0x16 bit while the phase remains and clearing it at phase end — but only for records that are
active (+0x00 bit 0) and armed (+0x16 bit 1).

### Spawning new actors into free slots

New actors are allocated by scanning the pool for the first empty record and initialising it in
place — one spawn per pass. The cadence is throttled by a countdown: `tickSpawnTimerAndSeedFreeEnemy` (0x1171) [seen]
decrements the spawn-cadence timer at 0x8d07 each tick and does nothing until it hits zero, then
checks the wave budget (the active enemy count at 0x8d40 against the per-stage target at 0x8901,
capped at 6) before sweeping the six records at 0x8ae0 and handing each to the initialiser
`seedFreeEnemyRecordFromRoundTables` [seen]. `spawnHunterIntoFreeSlot` (0x118d) [seen] is the bare slot-scan loop that drives that
initialiser across the pool.

`seedFreeEnemyRecordFromRoundTables` [seen] is the initialiser. It returns at once if the record's header already reads
active, so the scan naturally lands on the first free slot; otherwise it stamps the record live
(byte 0 = 1), seeds the state byte to 3, writes the incoming Y, clears the coordinate and flag
bytes, sets the +0x07 variant flag, derives the +0x09/+0x0a facing pair from a round-counter
lookup, queues the record's animation script, reseeds the spawn-cadence countdown, and bumps two
running tallies — the active-enemy count at 0x8d40 and a never-reset cumulative spawn counter. Once
it has claimed one slot it stops the sweep, so exactly one actor appears per eligible frame.

Other drivers reuse the same free-slot pattern with different gates: `spawnEnemyOnBlinkCountdownSweep` (0x6a0f) [seen]
sweeps 18 records gated on the blink phase and spawns into the first empty one, `spawnPairedEnemyOnDelaySweep` (0x6905)
[seen] gates on a frame-delay timer and the wave budget and walks eight enemy/state record pairs,
and `spawnNextScriptedEnemy` (0x5334) [seen] reads a lane script byte and sweeps the six records at
0x8ae0, activating each through `activateLaneActorSlot`.

### Stacking the player sprite

The player is drawn as a vertical stack of sprite rows, and `deriveStackedSpriteYs` (0x23d7)
[seen] builds that stack from the single player-actor Y. It reads the base Y from the player record
(0x8a80 + 0x04, i.e. `PLAYER_Y` at 0x8a84 [seen]) and writes three derived Y coordinates into the
Y field of the three records one stride apart — record slot 3's Y (+0x4c) gets the base value,
slot 2's (+0x34) gets base − 0x10, and slot 1's (+0x1c) gets base − 0x10 + 0x0a — so the player's
sprite rows track its position as one rigid column and the enemy AI can aim dives at the single
0x8a84 value.

### The object-proximity collision scan

Collision is a bank of proximity sweeps run each frame by `runActorUpdatePipeline` (0x5ae4)
[seen], the master actor updater, which fires eleven per-record passes in a fixed order and reads
nothing back from any of them — every pass works purely through the records.

The grab sweep, `gateAndRunProjectileTargetSweep` (0x5df7) → `sweepTargetSlotsForGrab` [seen], is gated: it bails when a grab is already
latched or when the formation or wave-teardown state is set, otherwise it runs three slots,
comparing the sprite target coordinates against the projectile records and aborting the instant a
grab connects. `resolveObjectProximityHitsBothSlots` and `resolveProjectileCollisionsBothActorSlots`
[seen] each run their scan twice, once per target box, walking the two boxes four bytes apart and
tagging the second with a parity selector; a hit inside either pass aborts and leaves the remaining
box unscanned. `scanEnemyRecordsForCollision` (0x5b86) [seen] sweeps a per-record collision check across the six enemy
records, and `scanActorCollisionsBothSlots` [seen] runs the actor box through its scan twice unless
play is idle and the round counter's bit 0 is set.

Underneath these, the actual overlap test computes a per-axis distance and compares it to a
threshold window. The odd-round sweep `sweepActorRecordSlotsBothParitiesOnOddRound` → `dispatchTargetPairCollisionSweep` → `testAndCatchActorSlotOnOverlap` [seen] walks the enemy
records and, for each live record whose state is below 4, screens the actor on screen and then tests
|dx| < 0x0a and |dy| < 0x09 against the current target; a record inside that window is caught —
its header is cleared and its next two bytes set to 01 and 08 — and, unless the target's +0x07 bit
0 is set, the target record is wiped. The six-slot overlap pass `testRecordOverlapRetireOrFlagHit` [seen] applies the same
idea with per-axis thresholds (X 0x10/0x08, Y 0x12/0x08, the wider value chosen when the type
selector is 3 and the tighter otherwise) and, on a full hit, either marks the type-3 result cell or flags the two record
cells and unwinds the frame. When a projectile lands, `dispatchHitToEnemyRecordElseQueueSound`
(0x611f) [seen] resolves it: it reads a key and scans six records at 0x8ae0 for one whose collision
key at +0x14 matches; a match diverts to the hit handler (aborting the frame), and a clean miss
enqueues a sound unless the active object type is 3.

`flagTamperOnRound5ChecksumMiss` (0x5ae4's sixth pass) [seen] rides along in this pipeline: only at
round 5 it sums six program bytes and, if the checksum does not balance, bumps a freeze flag that
downstream spawn code reads to stall — an anti-tamper tripwire folded into the actor sweep rather
than a collision step.

### Teardown

The last pipeline pass, `fireArmedEnemyProjectilesAndDisarm` (the eleventh step of 0x5ae4) [seen],
is the end-of-wave cleanup. It stays inert while the launch-arm latch is clear or the active-lane
count is still non-zero. When the pending flag is zero it first scans six enemy records' +0x04
field for the wave-end key — 0x13 on an even round, 0x0b on an odd one — and returns on a clean
miss; on a hit, or when the pending flag is already set, it sweeps the six enemy records through a
per-record fire gate and then clears both the launch-arm latch and the launch latch, closing the
wave out. At bonus-stage boundaries `clearWaveStateAndArenaOnHoldExpiry` (0x7421) [seen] performs
the coarser teardown — clearing the wave and enemy state and handing control back to the attract
sub-state — while the board-init clears (`clearActorArena` / `clearActorArenaAndCounters`) zero the
whole arena for the next board.

## Waves, rope and launch

Pooyan runs two independent enemy pipelines that share the same actor tables and the same set of
per-frame drivers. The main-play *attack wave* launches a run of enemies into the play area, one at
a time on a delay cadence, and tallies them as they arrive; the *rope* grows a vertical column of
segments that carry grabbable hanging objects downward; the *launch state machine* drives the arrow
object and, off the back of it, seeds the "hunter" attackers; and a separate *eagle bonus wave*
seeds paired records that approach, dive/climb, and retire on their own timers. All four keep their
state in the 0x89xx/0x8dxx/0x8fxx work-RAM bands and draw through the same 2x2 tile blitter.

### The enemy attack wave

A wave begins in the play-state-index 3 handler, `spawnEnemyWave`. It first chooses a seed table
and a tile-animation cursor from two conditions — the play-mode latch, and (when that is clear) the
parity of the round counter ROUND_COUNTER (0x8907) [seen] — then seeds four actor records at
ACTOR_TABLE (0x8a80) [seen], each stamped active (byte0 = 1) with its +4/+6 coordinate fields
copied from the selected table; upright, record 0's +6 is nudged down by two. It seats the shared
animation-script cursor and steps the animators. What happens next forks on the play-mode latch:
the zero (main-play) branch either arms play-state 0x12 or copies a 'C'-terminated intro string
(each byte biased by -0x88) into the display message buffer DISPLAY_MSG_BUF (0x89f0) [seen]; the
nonzero branch, when round bit 1 is set, fans out a sprite group across ENEMY_ACTOR_TABLE
(0x8ae0) [seen] whose size (5..8) and tile base come from the round, packing per-slot coordinates
by rippling a low-nibble/high-nibble accumulator, and publishes the group size to
TARGET_GROUP_COUNT (0x8f47) [seen] before arming play-state 0x0f.

Once a wave is armed, `spawnNextEnemyOnDelay` releases its members one at a time. While the shared
frame-delay timer SHARED_FRAME_DELAY_TIMER (0x8929) [seen] is still running it just ticks down; on
expiry, and only until all eight waves have been released (WAVE_NUMBER (0x892d) [seen] reaching 8),
it walks the eight paired records — one cursor over ENEMY_ACTOR_TABLE, a paired cursor over
SPRITE_OBJECT_TABLE (0x8b70) [seen], both stride 0x18 — offering each to `launchWolfIntoSlot`. That
helper skips any slot already active (bit 0 of either leading byte) and keeps sweeping; the first
free slot is launched: the enemy-actor record is marked active with fixed coordinates, and from wave
two on the paired sprite-object record is also stamped, its animation variant drawn from a variant
table indexed by a rotating cursor. The
launch reseeds the shared frame-delay from a per-wave table (index clamped to two), advances
WAVE_NUMBER, arms the launched record's animation (a later wave uses an alternate sequence), and
sets the IY record's frame-hold field to four times the wave — then reports "launched", which aborts
the rest of the sweep so exactly one enemy is released per elapsed delay. (WAVE_NUMBER may carry a
second, mode-dependent life: it also appears to be consumed as a per-frame countdown reloaded to
0x10 by `updateEnemyActorsAndCycleLaunchFlipAnim` — a possible reuse of the same cell that is not
yet settled.)

Each released enemy walks itself to "arrival" in the object state-6 handler,
`advanceEnemyToArrivalAndTallyWave`. After ticking its animation, a record with mode-flag bit0 set
*homes*: its sub-position (rec+5) advances by the homing velocity (rec+0x0a), the row counter
(rec+6) is nudged down when the position falls below the negated velocity, and both new values are
mirrored into a linked record addressed by the record's pointer field — arriving when the row masks
to zero. With bit0 clear it *free-runs*: the position advances by a fixed step, carrying into the
row counter, and arrives once the row reaches 0x1f. Arrival bumps three tallies at once — the
per-stage arrival counter WAVE_ARRIVAL_COUNTER (0x8903) [seen], the active-enemy count
ACTIVE_ENEMY_COUNT (0x8d40) [seen] (decremented), and the wave-progress counter WAVE_PROGRESS_COUNTER
(0x8d7d) [seen] — then blanks the record's sprite band. When the record's band-kind nibble is set it
additionally runs a *gated lane reset*: guarded by the one-shot latch LANE_RESET_LATCH (0x8d7e) [seen]
and a small arrival count, it zeroes the lane-spawn countdown LANE_SPAWN_COUNTDOWN (0x8d75) [seen]
and its companion latches, re-seeds the spawn timer ENEMY_SPAWN_TIMER (0x8d07) [seen], and — only
while the screen is upright and the stage countdown is still low — runs an anti-tamper checksum over
a fixed code window, bumping a strike slot [code] when the running sum misses its 0x55 sentinel.

The lane-spawn countdown that this reset clears is the wave's spawn pacer: it counts down from a lane
count while a lane-spawn sequence runs and, being nonzero, suppresses enemy fire. A companion,
`tickActorHoldThenBlankAndClearWaveLatches`, is the actor frame-hold tick — it advances a record's
animation and counts its hold field down, and on the third hold-lapse of a flagged record it clears
both LANE_SPAWN_COUNTDOWN and the launch-arm latch LAUNCH_ARM_LATCH (0x8f20) [seen], every
non-holding exit blanking the actor's sprite band. `advanceEnemyActorStateWalk` is the shared
per-frame animation walk that ticks B enemy-actor records in order (stride 0x18), aborting the whole
walk early if any tick asks to.

Enemies throw projectiles through `launchProjectileIntoFreeSlot`. It bumps the spawn counter
SPAWN_COUNTER (0x8d42) [seen], scans the three-slot object table PROJECTILE_TABLE (0x8be8) [seen] for
a slot with its active bit clear, and seeds it from the launcher record: a heading index picks a
coordinate pair from a round-selected word table, an animation is armed on the launcher (chosen by
its facing/mode bits), a hit-flash sequence and a rotating display attribute are stored, and the
launcher's step field is nudged down. During the wave a periodic-event timer expiring also sets the
wave-event latch WAVE_EVENT_LATCH (0x8d21) [seen], which fires the siren run; a rope-grab in progress
raises GRAB_ACTIVE_FLAG (0x8d32) [seen], which gates and aborts the spawn/event routines while set.

### The rope: extending and rendering segments

The rope is driven on even frames by `driveRopeExtendAndRenderCells`, which bails while a grab is in
progress (GRAB_ACTIVE_FLAG nonzero) or while WAVE_ARRIVAL_COUNTER still sits at its hold value of 2,
then runs the two sub-drivers in order: first the extend state machine, then the per-cell writer.

`dispatchRopeExtendState` runs one of two handlers by ROPE_EXTEND_STATE (0x8f14) [seen]. State 0,
`addRopeSegmentAndAdvanceExtendState`, adds one segment: it returns at once once the rope has grown
to two below the stage's arrival count — the terminating test is `WAVE_ARRIVAL_COUNTER - 2 ==
ROPE_SEGMENT_COUNT (0x8931)` [seen] — so the arrival counter sets the rope's per-stage length.
Otherwise it bumps that segment count and, while the segment index ROPE_EXTEND_INDEX (0x8f18) [seen]
is below four (or a tamper strike [code] is pending, which substitutes the strike value as the table
index), advances the index, looks the new segment's video-RAM column low byte up from
ROPE_CELL_COLUMN_TABLE (0x2db8) [seen] and stores the page-0x84 column base at ROPE_COLUMN_VRAM_PTR
(0x8f19) [seen], reloads that segment's cell timer in the four-entry stride-2 bank ROPE_CELL_TIMERS
(0x8f28) [seen] to 0x10, advances the extend state to 1, and arms the sub-timer ROPE_EXTEND_TIMER
(0x8f16) [seen] to 0x10.

State 1, `advanceRopeExtendAnimation`, plays out the segment's grow blit. While the sub-timer runs it
just counts down. On expiry it reloads the sub-timer to 8 and, once the blit frame index
ROPE_EXTEND_FRAME_INDEX (0x8f1b) [seen] has reached 8, resets the index and the extend state back to
0 and arms the next rope cell's state byte (a computed 0x8f-page cell keyed on the segment index);
otherwise it fetches this frame's 2x2 tile block from a block table and blits it at the stored rope
column, then bumps the frame index. So a segment is added in state 0 and animated to completion over
several frames in state 1 before the machine returns to state 0 for the next one.

### Hanging objects on the rope, and the grab

`driveActiveRopeCells` walks the per-cell state array from ROPE_CELL_STATE_BASE (0x8f1c) [seen], one
record per active cell (the count is ROPE_EXTEND_INDEX), handing each to `dispatchRopeCellState`. An
inactive cell (state 0) is skipped; otherwise the cell's state minus one selects one of four
handlers, each acting on that cell record and sharing two helpers: `tickRopeCellFrameTimer`, which
decrements the cell's frame timer (low two bits of the record select the stride-2 timer) and reports
reached-zero, and `computeRopeCellVramColumn`, which turns those same low bits into the cell's
page-0x84 video column via ROPE_CELL_COLUMN_TABLE.

State 1, `spawnHangingRopeObject`, runs only every fourth frame and only when the cell timer
elapses. It scans the three-slot spawn-object table SPAWN_OBJECT_TABLE (0x8c48) [seen] for a free
slot (byte0|byte1 bit0 clear); with none, it leaves the timer re-armed to 1 and waits. With a free
slot it writes a round-scaled reload and the slot index back into the timer bank, seeds the slot
(state byte 0x07, a fixed anim/coordinate set, the +4 field pulled from a table keyed by the cell
index), advances the cell to its next state, blits the segment tile, and enqueues the segment sound.
States 2 and 3, `advanceHangingRopeObject` and `advanceHangingRopeObjectWithGrabCheck`, are the
per-cell timer handlers that carry the hung object down: each ticks the cell timer, and on the frame
it reaches zero it re-arms the timer, walks into the formation record table FORMATION_TABLE
(0x8c30) [seen] by the byte following the timer to adjust one record's tile/position/drop fields,
advances the cell state, and blits the segment's 2x2 tile at its column. The state-3 variant is
gated first by the grab test `testHangingRopeGrabConnect`: it looks a catch-window half-width up (keyed by the cell
index) and compares it against a window around the player coordinate at PLAYER_Y (0x8a84) — a cell
labelled a vertical position but read here as the player's horizontal position for the catch window;
with the player inside the window, and only when neither the wave-teardown state WAVE_TEARDOWN_STATE (0x8f24) [seen] nor
0x8f08 is busy, it fires the grab — setting GRAB_ACTIVE_FLAG (0x8d32) — and abandons the cell update
for that frame.

State 4, `retractRopeSegment`, retracts a segment: it fires only when the cell timer expires and
segments remain (ROPE_SEGMENT_COUNT nonzero). It selects a retract-animation pointer from a table
indexed by the round (>>2, clamped to 3) plus a difficulty-bit term, reads this segment's attribute
and merges it into the timer cell (carrying the paired cell's bits unless the cell is the terminal
0x28 column), clears the count-selected formation record, resets the cell's state byte to 1
(recycling it), and blits the 2x2 retract tile at the cell's column.

### The arrow and the launch state machine

`runLaunchAndTargetActorPipeline` sequences the three launch sub-passes each call: the launch state
driver, the one-shot target-slot spawn, and the active-target step. The state driver
`dispatchLaunchState` runs one of five handlers by the low three bits of LAUNCH_STATE
(0x8f30) [seen]. Threading them all is the arrow object's height byte ARROW_Y (0x8ab4) [seen] — the
Y field of the arrow/launch actor record — which the machine treats as a gate.

State 0, `armLaunchAndAdvanceToHunterSpawn`, arms the launch once. The launch-armed flag
LAUNCH_ARMED_FLAG (0x8f3f) [seen] is raised when its preconditions hold: either the lane-spawn
countdown is up while LAUNCH_ARM_LATCH (0x8f20) is still clear (in which case the latch is bumped),
or the stage countdown is nonzero and a multiple of eight. It then returns unless the arrow has
risen to its gate (ARROW_Y >= 0x3c) and neither of the two hunter-target records ENEMY_TARGET_REC0
(0x8c90) [seen] / ENEMY_TARGET_REC1 (0x8ca8) [seen] shows the hit bit. Clearing those, it steps the
launch state, reseeds the tile-flip countdown to 8, refreshes the arm latch from its seed
LAUNCH_ARM_LATCH_SEED (0x8d7a) [code], lights the launch HUD cell LAUNCH_HUD_TILE (0x8508) [seen]
while the game is idle, and blits the launch arrow tile to LAUNCH_TILE_VRAM (0x84a7) [seen].

State 1, `spawnEnemyTargetOrAnimateLaunchFlipTile`, either animates the arrow or seeds a target
record, forked on the same height byte: while ARROW_Y >= 0x34 it runs a flip countdown, and each time that
elapses it reseeds it to 0x10, steps a shared phase byte, and blits one of two arrow tiles chosen by
that byte's parity — the flapping arrow animation. Once ARROW_Y falls below 0x34 it scans the two
target records for a free one; finding one it advances the launch state to 2, marks the record,
queues a display command, blits the alternate tile, may light the HUD cell, and seeds three record
fields (one a biased copy of a source coordinate). State 2,
`spawnHunterIntoTableAndAdvanceLaunch`, seeds a hunter: unless the play-mode latch is set it scans
the six hunter records at HUNTER_TABLE_BASE (0x8c78) [seen] *downward* one stride apart for the first
free one, stamps it with the fixed opening state/coords/tile ids, and records its address at
HUNTER_RECORD_PTR (0x8f32) [seen]; either way it advances the launch state, and (flip flag clear)
seeds the spawn countdown HUNTER_SPAWN_COUNTDOWN (0x8f34) [seen] to 0x20 and enqueues a display
command, or (flip flag set) bumps a sub-counter instead. State 3,
`advanceLaunchOnDelayAndClearHunterRecord`, is the post-spawn hold: it drains HUNTER_SPAWN_COUNTDOWN,
and on expiry advances the state and (unless the play-mode latch is set) clears the 0x18-byte record
pointed to by HUNTER_RECORD_PTR. State 4 (`idleLaunchStateNoop`) is the idle terminal state — a bare return.

Alongside the state driver, `spawnTargetActorOnLaunchTrigger` is a one-shot target-slot spawn. It
samples and clears a trigger bit in the actor table; if it was set and a once-latch is still clear it
arms the latch and, when the launch has reached its threshold and the second target slot reads
ready-idle, marks the first slot special. It then claims the first free target slot, seeds its axes
from the actor source and its two timers (special slots also clear a companion buffer and set a
side flag), clears a pair of flash flags, and tails to the actor-animation stepper. The spawned
targets are then carried each frame by `advanceTargetActorState`: a record in its launch sub-phase
advances rec+4 by 4 until it reaches 0xe8 and then clears itself; other records prime a display
command once and either run a two-axis mover or drain a hit-timer / countdown, clearing (blanking
0x18 bytes) on expiry.

### The aim indicator and target lock

When the game is not in active play (attract/idle), `acquireTargetLockAndSetAimIndicator` maintains
the arrow's aim indicator. It bails unless both GAME_ACTIVE_FLAG and GRAB_ACTIVE_FLAG are zero, and
during a wave teardown (WAVE_TEARDOWN_STATE nonzero) simply clears the aim flags PLAYER_AIM_FLAGS
(0x8a87) [seen]. Otherwise it steps a hit-timer/rescan helper, bails on a proximity hit, and resolves
the indicator: launch state 1 forces the "above" bit; an existing lock is re-evaluated (dropped if
its enemy block reactivated or its target left the 0x40..0xc0 y-band, else its above/below delta
recomputed on an 8-frame cadence against a round-biased player reference); with no lock it scans six
enemy blocks at ENEMY_ACTOR_TABLE for the closest in-band target, records the five-byte lock at
TARGET_LOCK (0x8f40) [seen] (distance byte, the locked y-slot pointer, and the locked block pointer),
and sets the above/below bit from the target-versus-reference comparison. The aim bits (bit2 = on
target/above, bit3 = below) are what the arrow's on-screen indicator reads.

### The eagle bonus wave

The bonus stage runs its own wave pipeline. Two phase bodies feed it: `runEagleApproachPhaseFrame`
(phase 0) steps the approach machine then the shared per-frame object update, and
`runWaveLaunchPhaseFrame` (phase 1) runs the shared update then the wave-launch driver.

`driveEagleWavePerFrame` is that driver, a three-way fork on two flags. With the launch flag
WAVE_LAUNCH_FLAG (0x8f3a) [seen] clear it calls `seedNextEagleWave` and returns; with the live-record
count WAVE_RECORD_COUNT (0x8f3c) [seen] zero it hands off to the inter-wave idle handler; otherwise it
walks the wave's live records (two per wave index) through the per-record dispatcher one at a time.
`seedNextEagleWave` runs only while the target slot ENEMY_TARGET_REC0 is clear: it raises the launch
flag, advances the wave index WAVE_INDEX (0x8f3d) [seen], and on the fourth wave merely re-arms the
outer phase WAVE_OUTER_PHASE (0x8f38) [seen] and reloads the hold timer WAVE_HOLD_TIMER
(0x8f36) [seen] to 0x20; otherwise it initialises two records per wave in ENEMY_ACTOR_TABLE from the
four-byte-per-record parameter table EAGLE_WAVE_PARAM_TABLE (0x7409) [seen], marking each active,
copying four fields, and setting a flag byte (records whose own low address has bit 3 set also get a
+3 flag), then clears the outer phase and the records-arrived count WAVE_RECORDS_ARRIVED
(0x8f39) [seen].

Each active record is dispatched by `dispatchActiveEagleRecordState` on its state byte (rec+2, bounded
0..2). State 0, `advanceEagleToArrivalAndTallyWave`, checks whether the eagle has reached this
record's grid slot: its column (X >> 3, from EAGLE_X_COORD (0x8c96) [seen]) must equal the record's
target column or the one just before it, and its row (Y >> 3 + 4, from EAGLE_Y_COORD (0x8c94) [seen])
must fall within a five-row window above the target row. On arrival it advances the record state and
arms an animation — odd records (bit 3 of the low address) take one animation sequence and a flag
byte, even records take the other, bump the arrived count, and once every record of the wave has
arrived queue the wave-arrival command (WAVE_ARRIVAL_CMD_BASE (0x0630) [seen] offset by the count).
State 1, `advanceEagleDiveClimbToRetireAtLimit`, integrates the record's 16-bit vertical position by
its per-record speed: even records descend (add; a carry bumps the row; the bottom row 0x1d advances
the state) and odd records climb (subtract; a borrow drops the row; the top row 0x04 advances the
state). State 2, `despawnEagleAndSeedHoldOnWaveEmpty`, retires the record — zero-filling its 0x18
bytes and decrementing WAVE_RECORD_COUNT — and, when that reaches zero (the wave's last record has
retired), seeds the inter-wave hold to 0x30. The idle handler `tickEagleInterWaveHoldAndRearmLaunch`
drains WAVE_HOLD_TIMER; on expiry, if a wave index is still set it enqueues a command carrying that
index, then reseeds the hold to 0x18 and clears WAVE_LAUNCH_FLAG so the next wave can be seeded.

Overlaying the record walk during phase 0 is `advanceEagleApproachAndPaintGridMarker`, the approach
state machine that both drives the aim indicator and paints the eagle's advancing grid marker. A hold
counter (WAVE_HOLD_TIMER) gates entry. Once open, it drives PLAYER_AIM_FLAGS from the eagle's
approach coordinate — read here from 0x8a84 (labelled PLAYER_Y as the player's vertical position, but
serving in this phase as the eagle's approach X) — against two thresholds: it latches the enemy X
into LATCHED_ENEMY_X (0x8f5b) [seen] once the coordinate reaches the far threshold 0x60, and steps a
records-arrived sub-phase when it sits exactly at the near threshold 0x59. On the final sub-phase,
once armed, it advances a grid pointer every eighth frame (gated by EAGLE_GRID_STEP_TICK
(0x8f3b) [seen]), stamping a marker tile (0x2c) and a colour attribute into the grid region based at
EAGLE_GRID_VRAM_BASE (0x87e0) [seen], with the row/column taken from the target record's +4/+6
fields. `armEagleFinishAtGridEdge` is the grid-advance guard: while the eagle's grid coordinate is
short of the edge (0xd0) it hands the coordinate back so the machine keeps stepping; on reaching the
edge it arms the finish latch EAGLE_FINISH_FLAG (0x8f3e) [seen] and runs the reset epilogue.
`advanceEaglePhaseAndClearAim` is that epilogue — it drops the aim flags and the latched enemy X,
advances the eagle-wave outer phase (the cell one below the records-arrived count), and clears the
records-arrived sub-count so the next phase starts fresh.

## Rendering, HUD and display lists

Everything the machine puts on screen lands in one of two memory planes and is stamped
there by a small family of tile-copy primitives, then driven either directly by the
per-frame state handlers or indirectly through two producer/consumer pipelines: a
byte-stream *display-list interpreter* that paints whole playfield layouts, and a
32-slot *display-command ring* that lets any part of the game queue a deferred paint job
for the main loop to run. The HUD numbers on top of all of that — scores, credits, the
round and stage readouts, the phase gauge — are drawn by BCD digit primitives that share
the same tile-stamping leaves.

### The two video planes and tilemap geometry

The screen is a 32-cell-wide tilemap. Tile codes live in the video-RAM plane at
`VIDEO_RAM_BASE` (0x8400-0x87ff) [seen], and the per-cell colour/attribute bytes live in
a parallel plane based at `COLOR_RAM_BASE` (0x8000-0x83ff) [seen], with the attribute map
proper starting at `ATTRIB_MAP_BASE` (0x8040) [seen]. Both planes share the same
geometry: moving one cell down (or up) is a step of 0x20 in the address, so a "column" is
a run of cells 0x20 apart and a "row" is 32 consecutive addresses. Because a cell's tile
and its colour sit at the same offset in their respective planes (0x400 apart), the code
almost never touches the two together — the tile primitives write only 0x84xx cells and
the colour flood writes only 0x80xx cells — with the one exception of the two-plane
column blitter below. Nearly every paint routine walks *upward* (stride -0x20): the visual
layout is built from a base cell climbing toward lower addresses, which is why the HUD
gauges and score columns all read "bottom cell first."

### Clearing and filling the tile plane [seen]

A board is built by first wiping the playfield to blank tiles. `seedTileFillCursor`
(0x02e6) arms the fill by storing a 16-bit write cursor into `TILE_FILL_PTR` (0x880b) and
seeding the row counter `FILL_ROW_COUNTER` (0x8809) to 0x20 (32 rows); the board-build
entry `primeTileFillCursorAndAdvanceBoardBuild` (0x0c5c) does the same but seats the
cursor at `PLAYFIELD_PAINT_START` (0x8442), drops the in-play flag, kicks the watchdog,
and primes a shorter 0x0f-row run before handing off to the board-init RAM clear. The
actual erasing happens a little at a time, spread across frames, in
`fillIntroRowsThenBuildBoardIntro` (0x0c77): each call stamps two 0x1d-byte runs of the
blank tile 0x10 through the byte-fill leaf `fillByteRun` (0x0010), advancing the cursor past
each run plus a three-cell gap and writing it back, then decrements `FILL_ROW_COUNTER`
and returns while it still holds. `fillByteRun` itself is the generic "fill N bytes with a
constant" leaf, faithful to the hardware down-counter in that a zero count means a full
256 bytes. Only when the row counter finally drains does the intro build fire once: an
integrity checksum, the attribute flood, the credit-display commands, the two-plane
column stamp, and a burst of queued display and sound commands.

### The colour/attribute plane flood [seen]

`fillAttributeColumns` (0x075d) paints the colour plane a column at a time. From a ROM
source table it walks 31 columns starting at `ATTRIB_MAP_BASE`; each column consumes one
source byte and floods it down all 30 rows at the 0x20 stride, the source advancing one
byte per column. It is the colour-plane counterpart to the tile fill — one flat colour
per screen column — and it is fed from ROM tables such as `ATTRACT_FIELD_ATTRIB_SRC`
(0x0779) or the per-field sources at 0x0819/0x0839/0x0859/0x0879 depending on which state
handler invokes it. The routine's terminal register value (0x1f, the low bits of the
last column address) is left behind and stored verbatim by a caller into a scratch cell —
a leftover, not a colour.

### The two-plane column blitter [seen]

`stampTwoPlaneColumnStrip` stamps a compact, self-describing strip that spans *both* planes in one pass —
the only routine that does. It reads 0x0c-byte columns from a ROM table
(`COLUMN_BLIT_TILE_SRC` 0x0d2f), writing each column bottom-up (stride -0x20) into the
tile plane at `COLUMN_BLIT_TILE_DEST` (0x86a7). A steering byte follows each column: an
ordinary value means "advance one cell right and stamp the next column," 0xff switches
the source to the attribute table (`COLUMN_BLIT_ATTR_SRC` 0x0d48) and the destination to
the attribute plane (`COLUMN_BLIT_ATTR_DEST` 0x82a7) so the same walk now lays colour,
and 0xee ends the strip. This is how the fixed frame around the playfield gets both its
tiles and its colours in a single call during the board intro.

### The scrolling columns [seen]

The per-frame scroll worker `repaintScrollColumnsElseVerifySignature` (dispatched by the main loop as its vblank
boundary, below) keeps the two side columns of the playfield moving. When a game is
active and it is not being pre-empted by the ROM signature check, it repaints two
three-tile scroll columns: in one-player mode it blanks four columns (starting from
`COLUMN_CAP_VRAM` 0x84e0 and `P2_SCORE_VRAM` 0x8521, chaining the advanced pointer out of
each `blankTileColumn` into the next), while in two-player mode it stamps a capped body
column instead (cap tile 0x02 plus `paintColumnBodyTiles`). It then repaints the shared
scroll column at `WORKER_COLUMN_VRAM` (0x8740) and, gated on the control byte's bit 4 and the
game-active bit 0, blanks one further column. The column leaves are tiny: `blankTileColumn` (0x02b1) writes the blank
tile 0x10 into three cells a stride apart and returns the advanced pointer for chaining;
`paintColumnBodyTiles` (0x02aa) writes the mid tile 0x25 and base tile 0x20 into the lower
two cells of a three-tile column (the caller stamps the cap); `paintColumnBodyTilesUp`
(0x1cec) is the fixed-stride-up twin; and `stampSecondScrollColumn` (0x1d0d) seeds a whole
three-tile column at `WORKER_COLUMN_VRAM` top-down (0x01 cap, then 0x25 and 0x20 climbing).
Separately, `advanceTileAnimForwardOnOdd` (0x2405) animates a marching tile strip: it ticks
a parity counter (`TILE_ANIM_PARITY` 0x8f37) and acts only on odd frames, either bumping
the tile code under the `TILE_ANIM_CURSOR` (0x88be) up by one, or — once that code reaches
the wrap value 0x37 — stepping the cursor one cell forward and reseeding it to 0x34. An
even-frame twin walks it the other way, so the strip oscillates in place.

### Block-stamp primitives [seen]

A handful of leaves stamp fixed-size rectangles of tiles and are shared by the sprites,
the glyph HUD and the round labels. `blit2x2TileBlock` (0x3325) copies four source bytes
into a 2x2 square (top-left, top-right, bottom-right, bottom-left) and returns the
bottom-left cell so an animator can chain the next square. `paintTileBlock2x2` (0x0a40)
and `paintTileBlock2x2Above` (0x780f) are the same 2x2 shape anchored top-left and
bottom-left respectively (the "Above" variant places its top row one row above the
anchor). `blitTile3x3Block` (0x3307) stamps a 3-wide, 3-tall block, stepping +0x20 to the
next screen row after each three cells, and advances *both* its destination and source
pointers so a caller can immediately stamp the following block from the advanced source.
`blitGlyphBlock4x3` (0x1f8c) stamps a 4-row-by-3-column glyph, advancing only the low
byte within a row so the block stays on its tilemap page. Two hold-timer animators drive
the "READY" and similar two-tile animations: `blitTwoTileAnimFrameOnHoldTimer` (0x2563)
counts a hold timer (`TWOTILE_ANIM_HOLD`) down and, on expiry, reloads it, advances a
phase, and — keyed on the round parity and phase parity — picks one of four 4-byte source
blocks and one of two screen anchors, stamping it as two stacked 2x2 squares 0x60 apart;
`blitStackedTwoTileAnimFrameOnHoldTimer` (0x6b13) is the simpler two-source variant at a
fixed anchor. Glyph selection runs through `fetchWordFromTableIndex` (0x0c45), a little-endian word-table
lookup that doubles an index and reads the word there, and `stampSelectedGlyphBlock` (0x1ffb), which uses
bit 5 of a selector to choose between two 3x3 glyph tables before delegating to the 3x3
block stamp. A related per-frame render tail, `wrapRenderPhaseAndPaintTileTriplet`
(0x23ad), masks a phase counter to 0..3, looks up a tile-block descriptor for that phase,
and stamps three 2x2 blocks two rows apart at `STATUS_RENDER_VRAM_BASE` (0x8425), the
third alternating between two sources on the phase's low bit; it is reached by
`tickStatusRenderRingAndRedrawOnWrap` (0x23a1), which decrements a mod-8 ring counter
(`STATUS_RENDER_RING` 0x88bd) and only borrows into the mod-4 render phase
(`STATUS_RENDER_PHASE` 0x88bc) — and thus redraws — when the ring wraps.

### The sprite display list [seen]

The moving objects are described by a 24-entry, stride-4 sprite display list based at
`SPRITE_DISPLAY_LIST` (0x8840): each entry is a Y byte, an attribute byte (colour in the
low nibble, two flip bits in the top), an X byte, and a code byte. The list is rebuilt
each frame from the object records rather than written directly:
`copyObjectRecordsToDisplayList` (0x032a) walks a run of object records and copies four
chosen record bytes (offsets +0x06, +0x10, +0x04, +0x0f) into each successive list slot,
letting the low byte advance alone so the writes wrap within the list's 256-byte page.
`copyDisplayTilesIntoActorRecords` (0x2514) runs the other direction, copying a run of
tile bytes back into the tile field (+0x0f) of successive actor records, and then — if
either the terminator strike counter or the board-clear flag is set — diverts into the
board/HUD reset. When the screen is flipped, `mirrorSpriteListVertically` (0x0378) rewrites
the whole list in place: it negates and offsets each entry's two coordinate bytes
(-coord - 0x10) and toggles the attribute's two flip bits while preserving the colour
nibble, leaving the code byte alone. Whether that mirror pass runs is gated by the screen
orientation flag `FLIP_SCREEN_FLAG` (0x881f), which the machine also mirrors into the
hardware flip latch `FLIP_SCREEN_LATCH` (0xa187) each frame. Objects that draw as
stacked tile pairs rather than hardware sprites go through `drawObjectStackedTiles`
(0x7790): it advances the object's animation, runs its frame timer down, and on expiry
draws two stacked 2x2 blocks — a sprite index selects a char-table word blitted at the
record's own screen pointer, and the row 0x400 above from a second table — raising a
"drawn" flag once and falling through to the record clear.

### The display-command ring [seen]

Any part of the game can defer a paint job by posting a two-byte command into a 32-slot
ring buffer at `DISPLAY_CMD_RING_BUFFER` (0x88c0-0x88ff). The producer `enqueueDisplayCommand` (0x0038)
looks at the slot the write pointer (`DISPLAY_CMD_RING_WRITE_PTR` 0x88a0) names: if that
slot is free (bit 7 set, the empty marker) it stores the command's high byte there and its
low byte in the next slot, advances the pointer by two, and wraps it back to the ring base
(low byte 0xc0) when it runs off the end; if the slot is occupied the command is simply
dropped. The consumer is the main-loop step `mainLoopStep`, which reads the slot at the
read pointer (`DISPLAY_CMD_RING_READ_PTR` 0x88a1): a slot with bit 7 set is the idle
marker and means "run the per-frame scroll worker `repaintScrollColumnsElseVerifySignature` and treat this as the vblank
boundary"; any other slot is a live command, whose first byte (doubled and masked to 0x1f)
indexes a dispatch table and whose second byte is the command's parameter. The step frees
both consumed bytes, advances and wraps the read pointer, and calls the handler. The
dispatch table routes to the score/panel/high-score handlers described below (offsets 0x00
paint-count-column, 0x02 phase-gauge, 0x04 attract-panels, 0x06 score-accrue, 0x08
counter-reset, 0x0a counter-draw, 0x0c character-field, 0x0e credit-field, 0x10
high-score-checksum). The HUD tick `tickHudRefresh` (0x1583) is itself a producer: every
16th frame it enqueues a display-refresh command (parameter 0xb5 or 0x35 depending on a
counter bit) before, when the tamper-strike counter is nonzero, falling through into the
gameplay dispatch.

### The display-list interpreter [seen]

Full playfield layouts are painted by a byte-stream interpreter, `paintDisplayListRunToVram`
(0x4381). It works from a destination/source pointer pair — the primary pair
`DISPLAY_LIST_DST_PTR` (0x8f43) / `DISPLAY_LIST_SRC_PTR` (0x8f45), or an alternate pair
`DISPLAY_LIST_DST_PTR_ALT` (0x88b8) / `DISPLAY_LIST_SRC_PTR_ALT` (0x88ba) chosen when the
display sub-phase selector at 0x8920 is nonzero — and walks up to 0x1d source bytes per
call. A plain byte is copied straight to the destination and both pointers advance; the
skip opcode 0x10 reads the following byte, jumps the destination forward by that much and
shrinks the remaining count; the reload opcode 0xff loads a fresh 16-bit destination from
the stream and folds the next byte into the sub-phase tick. On exit the advanced pointers
are written back to whichever pair was in use, so successive calls chain through the layout.
The interpreter runs inside `runDisplayListAndAdvanceToGameplay` (0x7517), a self-test
dispatch state that paints one run, ticks the mod-0x1c counter `SUBPHASE_TICK` (0x88b7) and,
on its wrap, steps the one-shot at 0x8920; on the pass after that it column-sums two
fixed 14-tile video-RAM strips (`HUD_INTEGRITY_STRIP_A` 0x82bc, `HUD_INTEGRITY_STRIP_B`
0x86bc, walking upward), demands the combined total equal the intact-screen value 0x014f
exactly (any other total is a hard integrity trap), and advances the self-test selector
to its next state. The pointers are first armed by `seedDisplayListPointersAndVerifyRomSignature`
(0x744e), the state-0 handler, which seeds the attract source/destination seeds
(0x43e1/0x4af0 into the source pair, `PLAYFIELD_PAINT_START` and 0x8042 into the
destination pair), clears the sub-phase tick, and runs a two-stage program-signature
check before returning. During play, `selectRoundDisplayListAndAdvancePhase` (0x16b7) is
what re-aims the interpreter at the right layout: after its phase timer (`PHASE_TIMER`
0x8808) expires it selects a (graphics, layout) pointer pair from a decision tree keyed on
the play-mode latch, the round-in-progress flag, the game-active flag and the round
parity — choosing among the ROM display-list tables `DLIST_GFX_ROUND0`/`_ROUND_ODD`/
`_ALT_EVEN`/`_ALT_ODD` (and, on the play-mode-latch branch, `DLIST_GFX_LATCH_B1`/`DLIST_GFX_LATCH`)
and their layout twins — commits that pair to the pointers, reseeds
the fixed pointers, and steps the play sub-state.

### BCD and HUD number primitives [seen]

On-screen numbers are stored as packed BCD and painted digit by digit. Two converters turn
binary into BCD: `binToPackedBcd` (0x1131) counts a binary value up in BCD, leaving the low
two decimal digits packed in one byte and the hundreds count separate (a zero input means a
full 256 passes, matching the exit-tested hardware loop), and `byteToPackedBcd` (0x062a)
reduces a binary byte to its two-digit decimal form (value mod 100) through the same
decimal-adjust arithmetic the Z80 uses. Three painters put digits on screen. `splitBcdByte`
(0x0429) is the workhorse: it writes a byte's low nibble as the units tile at the cursor,
advances the cursor by a caller-supplied stride, and hands back the high nibble (with a
zero-sense so a caller can suppress a leading zero). `renderDigitWithBlanking` (0x059d)
paints a single digit while threading a shared "blank budget" across a field — a nonzero
digit prints as itself and ends the leading-blank run, a zero prints as the blank tile 0x10
while budget remains, and only once the budget is spent does a zero print as a real "0."
`drawStackedBcdDigits` (0x1119) paints a packed byte as two stacked tiles, tens at the
cursor and units one row up, blanking a zero tens digit. The blank tile throughout is 0x10.

### Scores, high-score table and panels [seen]

The two players' scores and the high score are three-byte packed-BCD counters
(`P1_SCORE_BCD` 0x88a2, `P2_SCORE_BCD` 0x88a5, `HIGH_SCORE_BCD` 0x88a8), and each has a
vertical on-screen column (`P1_SCORE_VRAM` 0x8781, `P2_SCORE_VRAM` 0x8521, `HIGH_SCORE_VRAM`
0x8641). `selectActivePlayerScoreBuffer` (0x04f2) picks the live counter from bit 0 of
`ACTIVE_PLAYER` (0x880d). Scoring runs through `accrueScoreAndUpdateHighScore`: while the game-active bit is set,
an award index picks a three-byte BCD increment (index 0 uses the per-frame increment cell
`PER_FRAME_SCORE_INCREMENT` 0x88ab, any other index reads the award table
`SCORE_AWARD_TABLE` 0x0501 at stride 3), BCD-adds it into the active counter carry-chained
from the least-significant byte, repaints that counter's column, and then compares the
counter most-significant-byte-first against the high score — a strictly greater counter is
copied over the high score and its column repainted with the high-score selector. The
column painter `drawBcdCounterColumn` draws one of the three counters down its column, splitting each
of the three source bytes into high-then-low digits painted one cell apart (stride -0x20)
through the blanking digit painter with a shared budget of 4; `resetBcdCounterAndRepaintColumn` is the same painter
after zeroing the counter, so it repaints a freshly cleared score (four blanks then two
zeros). The attract screen's whole HUD is composed by `paintAttractHudAndHighScores`: it draws eleven
selector-indexed character fields, renders the ten-entry sorted high-score table
(`HIGH_SCORE_TABLE` 0x8a00) into `HIGH_SCORE_TABLE_VRAM` (0x85c7) as stacked BCD digit
pairs (each byte split low-then-high a row apart, the top digit's leading zero suppressed,
the column re-based two cells right per row), then repaints the digit panel (`renderPanelBcdDigitRows`) and
the status panel (`renderPanelFromTable`). `renderPanelFromTable` (0x0460) walks ten rows of
three cells from the work-RAM source table `PANEL_TILE_SOURCE` (0x8e00) into
`PANEL_VRAM_DEST` (0x8567), painting the blank tile 0x40 for an empty source cell, climbing
within a row and re-basing to the next column on the third cell; `renderPanelBcdDigitRows` renders ten rows
of packed-BCD panel digits from `PANEL_DIGIT_SOURCE_TABLE` (0x89c0), wedging a fixed
separator tile 0x51 between the two digit pairs of each row. The character-field engine
`drawStackedCharField` underlies the selector fields and the credit/round labels: its low seven bits
index a pointer-table entry that heads a list of records (each a destination address plus
an inline string), and it writes characters bottom-up, either as digit tiles (char minus
'0') or, if the selector's top bit is set, as blank tiles, with '.' ending a record and '?'
ending the whole field. Credits are drawn by `drawCreditCountAndTamperCheck`: it draws the credit field, then
reads `CREDIT_COUNT` (0x8802) clamped to 99, converts it to packed BCD, and writes the tens
tile (skipped when zero) to `CREDIT_HUD_TENS_VRAM` (0x86bf) and the units to
`CREDIT_HUD_UNITS_VRAM` (0x869f) — with a hidden checksum tripwire that arms only when the
units digit is exactly 2.

### Round, stage-label, countdown and gauge readouts [seen]

The top-of-screen game readouts are refreshed by a small chain. `paintRoundNumberHud`
(0x1ead) is the round-number setup plus the per-frame update chain: while the tamper freeze flag
`TAMPER_FREEZE_FLAG` (0x881e) is clear — its normal state on an intact ROM — it copies an attribute
field bottom-up into the attribute column through a 0x10 sentinel, BCD-converts round+1 and
paints its two digits (a leading zero blanked), stamps the round's glyph blocks — the tens
bit picking the glyph word — stashes the low digit, and renders a selector glyph; both paths
(freeze clear or set) then run the timer/round-progress updater
`refreshRoundStageHud` and the countdown digits. `refreshRoundStageHud` (0x1f18) holds off
while any of seven integrity-flag slots is armed, then derives the stage countdown's tens
digit and, only on the first stage (tens zero), draws the BCD round number (one of two
glyph banks by a tens bit) into `HUD_ROUND_TILE` (0x8722), blanks three trailing tiles, and
mirrors the countdown into `HUD_STAGE_DIGIT_LO` (0x8743); both paths draw the fixed stage
label at `HUD_STAGE_LABEL_TILE` (0x8322) from the label pointer table 0x1fa3.
`drawStageLabelOncePerLevel` (0x1f2f) is the one-shot variant that draws the label just once
per level, gated by a done-latch, matching stages above ten against a five-entry column
table. `renderStageCountdownDigits` (0x34c9) paints the stage countdown `STAGE_COUNTDOWN`
(0x8901) as a two-cell number: a value below ten renders as a single digit, ten or more
converts to packed BCD first (that path suppressed while the play-mode latch is held), with
the tens tile one row over and a leading zero suppressed. The phase gauge is a five-cell
vertical bar drawn from `PHASE_GAUGE_BASE_TILE` (0x863f) upward: a count of zero leaves it
untouched, otherwise (count-1) cells clamped to five are filled with tile 0xb0 and the rest
blanked with 0x10. Two byte-identical copies of that painter exist in ROM — `renderPhaseGauge`
(0x03c2) and `paintPhaseGauge` (0x2065) — reading the same counter `GAUGE_PHASE_COUNTER`
(0x8908). `advancePhaseGaugeCountdown` (0x1a64) is the gameplay-state entry that actually
drains the gauge: outside the play-mode latch it runs the board reset, and (credit gate open)
counts `GAUGE_PHASE_COUNTER` down, tailing to the phase-exhausted handler on reaching zero
and otherwise re-rendering the gauge and seeding the next play sub-state. Finally,
`paintActorCountColumn` draws the "count column" — a vertical bar of up to eight cells at
`COUNT_COLUMN_VRAM` (0x8482) whose filled height is the actor-table count plus one (tile
0x0c filled, 0x10 blank), painted only while the game is active.

## Sound

The main CPU never synthesizes audio itself. It owns a single output port and a byte-wide
buffer of pending commands, and its whole job is to hand one command byte at a time to a
separate sound processor by way of a hardware latch and an interrupt strobe.

### Handing a command to the audio CPU (the latch + IRQ strobe)

The transfer to the sound processor is a two-write handshake at fixed I/O addresses. To send a
command byte, the code stores it at the sound-command latch `SOUND_COMMAND_LATCH` (0xa100), then
raises the audio-IRQ latch bit `AUDIO_IRQ_LATCH` (0xa181) to 1 and immediately drops it back to 0.
The 0xa181 line is one bit of an addressable output latch; toggling it high then low presents a
rising edge to the sound processor, which is what actually interrupts that processor into reading
the byte now sitting at 0xa100. The command byte must therefore be in place *before* the edge is
produced, and the code always does the data write first.

In the machine the low-to-high-to-low transition is separated by a short fixed spin (a run of
no-ops) so the pulse is wide enough for the sound side to notice; that delay carries no state and
so is purely a timing detail of the edge. The sender leaves nothing useful in a register — its
only effects are the two memory-mapped writes — and none of its callers read a result back.

This bare sender is invoked directly in a couple of places that want an unconditional, immediate
sound. At the end of power-on boot the code sends command 0x00 to force the sound processor
silent as part of bringing the machine up. A thin preset wrapper sends the single fixed code 0x0b
the same way. But the ordinary path to sound during play is not this direct call — it is the ring
described next, which is what the per-frame drain feeds into this same sender.

### The sound-command ring buffer

Rather than latch every sound the instant a game event asks for it, the code accumulates commands
in a small circular buffer and pays out one per frame. The buffer lives in page 0x8a: twenty-eight
one-byte slots occupying `SOUND_RING_BUFFER` 0x8a43 through 0x8a5e (0x1c bytes reserved at boot).
An empty slot is marked with 0xff, which doubles as the "nothing here" sentinel and the value
written back to free a slot after it is consumed.

Two one-byte cursors track the buffer, both holding only the low byte of a slot address (the high
byte 0x8a is implied by the page): the write/tail pointer `SOUND_RING_WRITE_PTR` (0x8a40) names the
next slot a producer will fill, and the read/head pointer `SOUND_RING_READ_PTR` (0x8a41) names the
next slot the drain will consume. Both range over 0x43..0x5e and wrap from the last slot (0x5e)
back to the first (0x43); there is no separate count, so the buffer is treated as effectively
never-full and the sentinel is what distinguishes an occupied slot from a free one.

At power-on the boot routine floods the whole 0x1c-byte span with 0xff to mark every slot empty
and parks both cursors at the origin slot 0x43, so the ring starts drained and aligned. (It seeds
one further loose cell at 0x8a42, immediately below the buffer, to a fixed 8 at the same time; that
byte is set up alongside the ring but is not touched by the enqueue or drain paths in the
main-CPU code.)

### Filling the ring (the producers)

Game logic never writes the buffer slots directly; it goes through one of two enqueue helpers,
both of which target the same buffer through the same write pointer at 0x8a40, so the ring carries a
single interleaved stream regardless of which helper appended a given byte.

The plain enqueue stores the supplied byte into the slot named by the write pointer and then
advances that pointer, wrapping 0x5e back to 0x43. It is unconditional — it always appends — and
it is used by the selectors that must queue a sound no matter what the game state is, for example
the silence selector that enqueues 0x00.

The gated append does the same store-and-advance but only after a state check, and it first stashes
the incoming byte at `SOUND_RING_PENDING_BYTE` (0x8d20) before deciding. The gate is the pair
`GAME_ACTIVE_FLAG` (0x8806) and `PLAY_MODE_LATCH` (0x8f50): if *both* are zero the append is
suppressed entirely and the byte is dropped, so this class of sound is queued only while a game is
running or the play-mode latch is set. When it does append, it leaves the advanced cursor behind as
its result, which the run-builders below chain on.

On top of these two primitives sits a large family of small selector routines, each naming one or a
few fixed command bytes and handing them to the appropriate helper in order — silence, single
effect codes across roughly 0x00..0x14, and multi-byte sequences. Some selectors are further
conditioned on game state before they queue anything: one drops command 0x04 whenever a wave is
tearing down or a rope-grab is in progress, and the warning-siren selector queues nothing while its
enable gate `SIREN_ENABLE_GATE` (0x8d68) is set, otherwise choosing one of two adjacent base tiles
by the low bit of the round counter.

Several of the queued items are not single sounds but short *runs*: a leading byte followed by the
fixed trailer 0x15, 0x16, 0x17, appended one after another through the gated helper. This trailer
acts as the framing/terminator that closes a multi-byte run in the stream the sound processor reads. Because the gated path can silently drop bytes when the game
is idle, a run is only fully queued while the game is active; the trailer is appended by the same
gate as the leading byte, so a run is never split across the gate.

### Draining the ring to the latch

Consumption is paced by the frame service. Once per frame the top-level service routine
(runVblankNmiService), after shifting the input edge-detect ring and servicing coins, drains exactly one entry
from the sound ring before dispatching on the main game state. The drain reads the slot named by the
head pointer; if it holds the 0xff sentinel the ring is empty and the drain returns having done
nothing. Otherwise the queued byte is sent to the audio CPU through the latch-and-strobe sender,
the slot is freed (written back to 0xff), and the head pointer is advanced, wrapping 0x5e to 0x43.
Because only one slot is consumed per call, a burst of queued commands is paid out to the sound
processor across successive frames rather than all at once.

The single dispatch during a drain is itself gated so the machine stays quiet when it should. The
byte is only handed to the sender when demo sounds are enabled or a game is active — specifically,
it is suppressed only when bit 0 of `DEMO_SOUNDS_DSW` (0x8821, the demo/attract-sound DIP field
decoded at boot) is clear *and* `GAME_ACTIVE_FLAG` (0x8806) is zero. Crucially the slot is still
freed and the head still advanced on the silent path, so a command queued while attract sound is
switched off is discarded rather than held back — the ring keeps moving even when nothing is
audible.

Some per-frame sub-state handlers drain a second time within the same frame: the active-play frame
body and the level-intro phase-1 frame body each end their fixed sequence of subsystem updates with
their own single drain, on top of the one the top-level service already performed. During those
states the ring can therefore give up more than one command per frame, letting queued play sounds
keep pace with dense gameplay while the outer drain still covers attract and the other states.

## Anti-Tamper

Pooyan's program image is defended by a lattice of integrity checks that fold blocks
of ROM, of work RAM, and of the on-screen tilemap into small checksums and compare each
against a value that only an unmodified board can produce. The defence is deliberately
indirect: a guard almost never halts outright. Instead a failed check does one of three
things — it silently raises a freeze flag that downstream handlers read as "stop doing
work," it diverts control into a real routine that carries its own trap, or it aims a
branch straight into a data table so the CPU runs animation bytes as garbage instructions
and wanders off. Because every accept value is tuned to the shipped ROM, none of the
failure arms can be reached while the board is intact; each one is a tripwire that only a
tampered image steps on.

Two independent freeze flags anchor the system. One (`TAMPER_FREEZE_FLAG`, 0x881e [code])
is a soft miss-tally that the ROM/signature checksum guards bump and that gameplay handlers
poll; the other (`TAMPER_OBJECT_FREEZE_FLAG`, 0x89fb [code]) is a hard latch set by the
attract-time program checksum that kills player input and springs an outright trap. Both
sit at [code] because on an intact ROM they never leave zero, so their live behaviour is
inferred from the code paths that would move them rather than from a run.

### The playfield-tilemap checksum (guardTilemapIntegrity, runObjectsElseVerifyTilemapChecksum, guardObjectFreezeIntegrity)

The largest guard sums the on-screen playfield tilemap itself and demands a fixed total of
0x29b8. It is a one-shot armed at a single moment in the game: it runs only when the wave
index `WAVE_NUMBER` (0x892d [seen]) is exactly 2, and only once per pass — a run-once latch
`TILE_SUM_ONCE_LATCH` (0x8f56 [seen]) is set to 1 on the first qualifying frame and blocks
every re-entry until the board logic clears it again. When both conditions hold the walk
begins 0x50 bytes into video RAM (`VIDEO_RAM_BASE` 0x8400, so 0x8450) and accumulates bytes
into a 16-bit sum. The stride is not linear: it steps one column at a time, but a position
whose low five bits equal 0x1b is a padding column and is skipped, and a position whose low
five bits equal 0x1f is the end of a row, so the low address byte is advanced by 0x12 to
land on the next row's start; when that advance carries past a page boundary the high byte
climbs, and the walk stops once the high byte reaches 0x88 (past the tilemap). An intact
tilemap folds to a low byte of 0xb8 and a high byte of 0x29 — the 0x29b8 total.

The routine `guardTilemapIntegrity` [seen] is the standalone form of this guard. Its two failure arms
diverge by which half of the sum is wrong. A low-byte miss (the accumulator's low byte is
not 0xb8) diverts into `loc_0929`, the screen-setup routine described below, which is a real
routine but one that itself hides a signature trap and is only ever entered here under
corruption. A high-byte miss (low byte right, high byte not 0x29) branches to 0x3829, which
is `ANIM_TABLE_3829` (0x3829 [seen]) — a four-frame animation data table — so the CPU
begins executing animation bytes as code. That second arm is the archetypal "dead arm aimed
into data": there is no routine at 0x3829, only graphics, and reaching it means the machine
has already been altered.

`runObjectsElseVerifyTilemapChecksum` [seen] is the same tilemap sum reached through the per-frame object driver.
Most frames it does the ordinary work of that driver — when the blink-phase byte
`BLINK_PHASE` (0x892b) is set it walks 18 enemy-actor records of stride 0x18 from
`ENEMY_ACTOR_TABLE` (0x8ae0), running the per-object handler on each and returning. Only
when the blink-phase byte is clear and the wave index is 2 does it fall into the identical
one-shot tilemap checksum, sharing the same latch, the same 0x8450 start, the same skip/row
rules, and the same 0x29b8 accept. Here the failure arms are treated as pure impossibilities:
this is a work-RAM checksum whose target is under the machine's own control, so any miss at
all signals corruption and is surfaced as a fault rather than followed, on either the low
or the high half.

`guardObjectFreezeIntegrity` [seen] is the gate that stands in front of this checksum. It first tests the
object-freeze latch `TAMPER_OBJECT_FREEZE_FLAG` (0x89fb): if that flag is set it springs
the object-freeze trap and goes no further; otherwise it hands control to the tilemap guard.
In the shipped ROM `guardObjectFreezeIntegrity` also folds a running sum of the checksum routine's own bytes
(a self-checksum reading `guardTilemapIntegrity`'s code as a data table, terminated by the routine's
0xc9 return byte, its low sum compared against the byte at 0x5119) — but that comparison's
result is never acted on, a decoy whose only purpose is to look like another live guard.

### The object-freeze latch (0x89fb) and the attract-time program checksum

The hard latch `TAMPER_OBJECT_FREEZE_FLAG` (0x89fb [code]) is raised by
`resetToAttractScreenStart` [seen], the attract sub-state-0 handler. Among its normal
duties (kicking the watchdog, arming the tile fill, advancing the attract sub-state) it runs
a backward checksum over a program window: starting at `CHECKSUM_SCAN_START` (0x64d5) it
sums bytes downward, counting carries, until it meets the sentinel byte 0x96. On an intact
image the identity `(0x96 - carries) == 0x8f` holds; any other result raises the freeze flag
to 1. The flag then never clears on its own — the sole write to 0x89fb anywhere is this
`= 1`, so once tripped it stays tripped for the rest of the session.

A raised freeze flag has two visible consequences. `guardObjectFreezeIntegrity`, as above, converts it into an
immediate trap ahead of the tilemap checksum. And `sampleJoystickIntoPlayerAimState` [seen], the per-frame joystick
sampler, treats it exactly as it treats the ordinary board-clear flag: at the top of the
routine it ORs `BOARD_CLEAR_FLAG` (0x89e5) with `TAMPER_OBJECT_FREEZE_FLAG`, and if either
is set it zeroes the player-aim byte and returns without reading the controls, so a tampered
board loses all player input. This is the "freeze the per-frame object update" behaviour: the
tamper flag rides the same gate the game uses to suspend play during a board clear.

### The protection trap loc_0929

`loc_0929` [code] doubles as a genuine screen/attribute-setup routine and as the landing
site for the tilemap checksum's low-byte failure arm. On a normal (carry-clear) entry it
fills one tile row and bails if that row's counter has not yet drained, then re-arms the
fill and bumps the attract sub-state cell `ATTRACT_SUBSTATE`; a carry-set entry is an
overlapping-decode arm — a byte in the middle of a `ld hl` instruction is re-decoded as an
`adc a,(hl)`, and that path merely increments the cell the incoming pointer names. Both arms
then converge to zero the board arena and spin-wait until the copy-protection cell
`COPY_PROTECT_STALL_BYTE` (0x07f5) reaches its ready value 0x11.

The trap proper is the signature loop that follows. It walks seven entries: a table lookup
against `SIGNATURE_WORD_TABLE` (0x0976) yields a pointer, and the byte it points at is
compared to the corresponding byte of the signature block descending from
`SIGNATURE_EXPECTED_TOP` (0x0838). A single mismatch branches to 0x0976 — into the middle of
that same word table — so, as with the 0x3829 arm above, the CPU executes table data as
instructions. All seven matching, the routine floods the attribute map and enqueues three
display commands (`DISPLAY_CMD_068B`, `DISPLAY_CMD_068E`, `DISPLAY_CMD_0200`) as its real
output. Because `loc_0929` is entered from the tilemap guard only when the tilemap sum has
already failed, in practice its signature check is a second gate layered behind the first.

### The miss-tally freeze flag (0x881e) and the code-window probes

Scattered through gameplay is a family of smaller checks that read *code* as data — folding
the bytes of one routine, seen through a data pointer, into a checksum and comparing it to a
constant baked for the shipped ROM. These are the code-window integrity probes, and rather
than trapping directly they all bump the soft miss-tally `TAMPER_FREEZE_FLAG` (0x881e).
`rebuildFieldAndLatchPlayStateWithTamperCheck` [seen], a play-state handler, folds a 34-byte program block (each byte masked to
0x37, rotated and accumulated) and demands 0x7c; anything else bumps the tally.
`seedFirstFreeSlotForTimedSpawnWithTamperCheck` [seen], the frame-timer spawner tail, sums an eight-byte guard region against its
own two's-complement signature and bumps the tally if any byte-pair fails to cancel.
`flagTamperOnRound5ChecksumMiss` [seen] arms only at round 5, summing six program bytes with
a carry count and requiring `(low sum + carries + 0x7f)` to wrap to zero, bumping the tally
otherwise.

The tally's teeth are in the handlers that read it. `advanceLeadActorPrimaryState` [seen]
runs its per-frame sub-passes but then, when 0x881e is nonzero, skips the lead-actor
state-machine dispatch, so the lead actor's state machine stops advancing — actor updates abort. `runPhase1LauncherThenDriver` [seen], the phase-1 spawner gate, checks the OR of the tally
with the signature-mismatch flag `SIGNATURE_MISMATCH_FLAG` (0x8ef0) and, if either is set,
takes a skip-spawn branch that, like the arms above, points into data — a dead trap, never
reached with a valid ROM. `paintRoundNumberHud` [seen] skips its entire round-HUD setup pass
when the tally is nonzero. The cumulative effect matches the flag's role: a nonzero tally
freezes spawns, aborts actor dispatch, and suppresses HUD construction, degrading the game
into a visibly broken state without a single explicit "you cheated" halt.

## Open questions

A few points remain open in this current-state description, each awaiting a targeted capture
of the machine in the right state:

- **WAVE_NUMBER (0x892d) mode-dependent reuse.** In the wave-release path WAVE_NUMBER is a 0..8
  per-wave release index, but it also appears to be consumed elsewhere as a per-frame countdown
  reloaded to 0x10 by `updateEnemyActorsAndCycleLaunchFlipAnim`. Whether this is a genuine
  second, mode-dependent role for the same cell is not yet settled.
- **The two anti-tamper freeze flags** (`TAMPER_FREEZE_FLAG` 0x881e and
  `TAMPER_OBJECT_FREEZE_FLAG` 0x89fb) are [code]: on an intact program image they never leave
  zero, so their live effect on the game is inferred from the code paths that would move them
  rather than from a run.
