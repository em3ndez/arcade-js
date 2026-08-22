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

## Legend

Every cell and routine role carries a confidence tag:

- **[seen]** — the reading ends in a MAME observation (a value watched change, a poke, a write tap).
- **[code]** — read from the code: consistent across the routines that touch it, MAME-grounding pending.
- **[guess]** — inferred; the least certain, flagged so it is not trusted as fact.

A cell with no tag is named but its role is not yet pinned. Where a reading is counterintuitive, a
callout warns about it in place.

## The work RAM and its state model

Pooyan's Z80 sees a flat 64K space, but only a handful of windows in it are real. The
bottom half, `0x0000`-`0x7fff`, is the four program ROMs — code and every fixed table.
Everything above that is either a RAM plane or a hardware register, and the decode is
strict: an access that falls outside a mapped window is not floated or ignored, it throws.
The layout is worth stating up front because the rest of the game's behaviour is just this
map being read and written in a particular order each frame:

- `0x8000`-`0x83ff` — the colour/attribute map (`COLOR_RAM_BASE`, **[code]**), one attribute
  byte per screen cell.
- `0x8400`-`0x87ff` — the tile-code video RAM (`VIDEO_RAM_BASE`, **[code]**), one tile index
  per cell.
- `0x8800`-`0x8fff` — 2K of work RAM: all of the game's mutable state.
- `0x9000`-`0x90ff` and `0x9400`-`0x94ff` — the two sprite banks.
- `0xa000` and up — the hardware I/O window: DIP switches, input ports, the watchdog, the
  sound port, and the LS259 control latch.

A single rule threads through the whole map and is easy to trip over: **a read and a write
at the same address are two different devices.** The clearest case is `0xa000`, which reads
DIP-switch bank 1 but writes the watchdog. Nothing about the address tells you which; only
the direction of the access does.

### The two video planes

The screen is described by two parallel planes, addressed cell-for-cell. The tile plane at
`0x8400` holds which glyph sits in each cell; the colour plane at `0x8000` holds that cell's
attribute/palette byte. Painting code almost always walks a column at a time, stepping by
`0x20` (one screen row) between cells, because the hardware maps memory columns to screen
columns. The playfield tile region proper begins a little inside the tile plane at
`PLAYFIELD_TILE_BASE` **[code]** (`0x8402`), and the boot's screen-clear blanks the tile
plane to an erase tile before anything is drawn.

Both HUD and gameplay share these planes — there is no separate text layer. The status
panel is painted into the tile plane at `PANEL_VRAM_DEST` **[seen]** (`0x8567`) from a
work-RAM source table, the score digits, credit counter, high-score table, phase gauge,
round marker and stage number all live at fixed cells inside `0x8400`-`0x87ff`, and the
colour plane's attribute columns are flooded from `ATTRIB_MAP_BASE` **[seen]** (`0x8040`)
whenever the field is (re)laid. So a full frame's visible state is not one buffer but the
two planes plus the sprite banks, all rewritten from work RAM.

### The sprite banks

Sprites live in two 256-byte banks, `0x9000` (bank 0) and `0x9400` (bank 1). They are the
same device seen through a bank-select address bit (`0x0400`); the hardware picks which bank
is displayed, so the program keeps both banks filled with identical data. The boot clears
the tops of both (`SPRITE0_CLEAR_BASE` **[code]** `0x9010`, `SPRITE1_CLEAR_BASE` **[code]**
`0x9410`). Thereafter the vblank service routine rebuilds the sprite banks every frame from
the **sprite display list** in work RAM (see below), writing the same column groups into
both `0x9010` and `0x9410`. Nothing in normal play addresses a sprite bank directly for
game logic — the banks are pure output, regenerated from work-RAM records each vblank.

### The hardware I/O window

Everything at `0xa000` and above is a register, and the decode uses don't-care bit masks
(hardware address mirrors), so a device answers at many aliases of its base. On the **read**
side the program samples five ports:

- `0xa000` — DIP-switch bank 1 (`DSW1_PORT` **[code]**), read once at boot and decoded into
  config cells.
- `0xa080` — IN0, the coin/start port.
- `0xa0a0` — IN1 (`IN1_PORT` **[code]**), player-1 controls, used in the upright cabinet.
- `0xa0c0` — IN2 (`IN2_PORT` **[code]**), player-2 controls, used when the screen is flipped
  for a cocktail cabinet.
- `0xa0e0` — DIP-switch bank 0 (`DSW0_PORT` **[code]**), the coinage settings, read once at
  boot.

All three input ports are **active-low** — an idle port reads `0xff` and a pressed bit reads
`0`. That is why the vblank routine complements each port as it samples it, so the work-RAM
copy reads the intuitive way (a set bit means "pressed").

On the **write** side the same upper window drives:

- `0xa000` — the watchdog. The vblank routine kicks it once per frame; a stalled program
  stops kicking and the watchdog resets the machine.
- `0xa100` — the sound-command port (`SOUND_COMMAND_LATCH` **[seen]**), the byte handed to
  the audio CPU.
- `0xa180`-`0xa187` — an LS259 addressed latch, **one address per output bit** (the bit
  index is the low three bits of the address). Bit 0 is the vblank-NMI enable
  (`NMI_ENABLE_LATCH` **[code]**, `0xa180`); bit 1 is the audio-IRQ strobe
  (`AUDIO_IRQ_LATCH` **[seen]**, `0xa181`); bit 2 is the audio mute; bits 3 and 4 are the two
  coin counters (`COIN1_COUNTER_LATCH` **[code]** at `0xa183`); bit 5 is a payout output; and
  bit 7 is the flip-screen control (`FLIP_SCREEN_LATCH` **[code]**, `0xa187`). Only the low
  bit of the written value lands in each latch cell.

> **Watch the flip-screen bit.** The flip-screen latch is wired inverted — a latched `0`
> means the screen is *flipped*. The boot writes `1` to select the normal upright
> orientation, which is the counter-intuitive value.

Two routines account for almost all traffic here. The **vblank NMI service routine**
(`0x066d`) disables the NMI latch on entry (`0xa180` ← 0) and re-arms it on exit
(`0xa180` ← 1) so the handler cannot re-enter itself; between those it kicks the watchdog,
samples the three input ports, and copies the work-RAM orientation flag out to the
flip-screen latch. The **power-on reset vector** (`0x0000`) holds the NMI off, then the
boot decodes the two DIP ports and, once state is laid down, enables the NMI and silences
the audio CPU. Sound commands reach the audio CPU by latching the byte at `0xa100` and then
pulsing the audio-IRQ bit high and low, which interrupts the sound CPU into reading it.

### The work-RAM state model

The 2K at `0x8800`-`0x8fff` is the whole of the game's mutable state, and it is diffed
byte-for-byte against the real hardware — so the program's exact placement of each cell is
load-bearing, not incidental. It divides into recognisable regions:

**Boot-decoded configuration (`0x8800`-`0x882f`).** The top of work RAM holds the settings
the boot reads out of the DIP switches once and never rewrites: the bonus/extra-life
schedule selector (`BONUS_AWARD_DSW` **[code]**, `0x8800`), the cabinet/cocktail flag
(`CABINET_MODE_FLAG` **[code]**, `0x880f`), the 3-bit difficulty (`DIFFICULTY_DSW`
**[code]**, `0x8820`), the demo-sounds flag (`DEMO_SOUNDS_DSW` **[code]**, `0x8821`), the
two coin-slot coinage nibbles (`COINAGE_CONFIG` **[seen]** `0x882c` and its slot-2 sibling
`COINAGE_CONFIG_SLOT2` **[code]** `0x882f`), and the cabinet lives count (`LIVES_DSW`
**[code]**, `0x8807`). Mixed in with them are the live top-level control cells: the
BCD credit counter (`CREDIT_COUNT` **[seen]**, `0x8802`), the NMI dispatch selector
(`MAIN_GAME_STATE` **[seen]**, `0x8805`), the in-play gate (`GAME_ACTIVE_FLAG` **[seen]**,
`0x8806`), a per-frame phase countdown (`PHASE_TIMER` **[seen]**, `0x8808`), the in-play
sub-state index (`PLAY_STATE_INDEX` **[seen]**, `0x880a`), the active-player select
(`ACTIVE_PLAYER` **[seen]**, `0x880d`) and two-player flag (`TWO_PLAYER_FLAG` **[seen]**,
`0x880e`), the orientation flag copied out to the flip latch each frame (`FLIP_SCREEN_FLAG`
**[seen]**, `0x881f`), and the anti-tamper freeze flag (`TAMPER_FREEZE_FLAG` **[code]**,
`0x881e`) that, when nonzero, deadens spawns and actor updates. The row-by-row tile-fill
cursor (`TILE_FILL_PTR` **[seen]** `0x880b`) and its row counter (`FILL_ROW_COUNTER`
**[seen]** `0x8809`) also sit here, driving the screen (re)paint one row per frame.

**The input edge-detect ring (`0x8810`-`0x8816`).** Each vblank the service routine writes
the three complemented input samples into `0x8810`-`0x8812`, with `INPUT_PORT0` **[seen]**
(`0x8810`) holding the inverted IN0 (coin in bit 0, 1P-start in bit 3, 2P-start in bit 4).
Before overwriting them it shifts the previous samples up into `0x8813`-`0x8816`, so this
little block is a two-frame history the coin/credit logic reads to detect the rising edge
of a button press rather than its level.

**The sprite display list (`0x883f`-`0x889f`).** A worker control byte (`WORKER_CONTROL_BYTE`
**[code]**, `0x883f`) sits just below the list base. The list itself begins at
`SPRITE_DISPLAY_LIST` **[seen]** (`0x8840`): a 24-entry array of four-byte sprite records
(Y, attribute, tile, X) rebuilt each frame from the moving-object records and then copied
out to both sprite banks. Interleaved through the same stride-4 region are the actor-record
slots (`SPRITE_ACTOR_RECORD_SLOTS` **[seen]** `0x8848`) and the proximity/target slots
(`SPRITE_TARGET_SLOTS` **[seen]** `0x887c`) that the collision scans walk.

**Scores, and the display-command ring (`0x88a0`-`0x88ff`).** The two players' live 3-byte
BCD scores are `P1_SCORE_BCD` **[seen]** (`0x88a2`) and `P2_SCORE_BCD` **[seen]** (`0x88a5`),
with the running high score at `0x88a8` (`HIGH_SCORE_BCD` **[code]**, MSB at
`HIGH_SCORE_BCD_HI` **[seen]** `0x88aa`). The rest of the page is the **display-command
ring**: a write pointer (`DISPLAY_CMD_RING_WRITE_PTR` **[code]**, `0x88a0`) and a read
pointer (`DISPLAY_CMD_RING_READ_PTR` **[code]**, `0x88a1`) address a 32-slot, two-byte-per-
slot buffer at `DISPLAY_CMD_RING_BUFFER` **[code]** (`0x88c0`-`0x88ff`). Producers enqueue a
two-byte command; the main loop drains the ring, dispatching each command's handler, and an
empty slot is marked `0xff`. The cursors walk `0xc0`-`0xff` and wrap back to `0xc0`, which
is why the ring physically occupies the tail of page `0x88`.

**The live game-state page and the two player banks (`0x8900`-`0x89bf`).** This is the core
of the two-player model. The *live* page is `0x8900`-`0x893f`: the enemy speed index
(`SPEED_INDEX` **[seen]** `0x8900`), stage countdown (`STAGE_COUNTDOWN` **[seen]** `0x8901`),
spawn-phase counter (`SPAWN_PHASE_COUNTER` **[seen]** `0x8902`), wave-arrival counter
(`WAVE_ARRIVAL_COUNTER` **[seen]** `0x8903`), round-in-progress flag (`ROUND_IN_PROGRESS`
**[seen]** `0x8904`), round counter (`ROUND_COUNTER` **[seen]** `0x8907`), phase gauge
(`GAUGE_PHASE_COUNTER` **[seen]** `0x8908`), the shared per-frame timer block around
`0x8928`-`0x8930`, and the rope segment counters (`ROPE_SEGMENT_COUNT` **[seen]** `0x8931`,
`ROPE_DRAW_COUNT` **[seen]** `0x8934`). Each player owns a saved copy of this page:
`PLAYER0_STATE_BANK` **[seen]** (`0x8940`) and `PLAYER1_STATE_BANK` **[seen]** (`0x8980`),
each a `0x3f`-byte block with the player's lives at `+8` (`PLAYER0_LIVES` **[seen]** `0x8948`,
`PLAYER1_LIVES` **[seen]** `0x8988`). On a player switch the live page is copied out to the
outgoing player's bank and the incoming player's bank is copied back in, so `0x8900` is
always "the current player" and the two banks freeze the other player's board between turns.
Which bank is live is selected by `ACTIVE_PLAYER`, and the whole scheme only engages when
`TWO_PLAYER_FLAG` is set.

**High score, integrity flags, timers (`0x89c0`-`0x8a3f`).** The panel digit source table
(`PANEL_DIGIT_SOURCE_TABLE` **[code]** `0x89c0`) and a set of play-timer gate/side tables
(`0x89e0`-`0x89e2`) lead into a block of anti-tamper strike counters and flags scanned as a
group (`INTEGRITY_FLAG_SCAN_BASE` **[code]** `0x89e7`; the board-clear flag
`BOARD_CLEAR_FLAG` **[code]** sits just below at `0x89e5`), the tile message buffer
(`DISPLAY_MSG_BUF` **[seen]** `0x89f0`), and the sorted 10-entry high-score table
(`HIGH_SCORE_TABLE` **[code]** `0x8a00`). The per-player BCD play-timers follow at
`PLAY_TIMER_BCD_P1` **[code]** (`0x8a30`) and `PLAY_TIMER_BCD_P2` **[code]** (`0x8a33`).

**The sound-command ring and the frame counter (`0x8a40`-`0x8a5f`).** Mirroring the display
ring, a write pointer (`SOUND_RING_WRITE_PTR` **[code]** `0x8a40`) and read pointer
(`SOUND_RING_READ_PTR` **[code]** `0x8a41`) address a 28-slot buffer (`SOUND_RING_BUFFER`
**[code]** `0x8a43`-`0x8a5e`) of pending sound commands, drained one at a time toward the
audio CPU. Immediately above it is `FRAME_COUNTER` **[seen]** (`0x8a5f`), a free-running
byte the vblank routine decrements every frame; its low bits phase animations and its
zero-crossing gates the periodic integrity checks.

**The actor and object record arrays (`0x8a80`-`0x8cff`).** The bulk of gameplay state is
banks of fixed-stride records, almost all `0x18` bytes apart. The primary array is
`ACTOR_TABLE` **[seen]** (`0x8a80`), whose slot 0 is the player/lead actor: its state index
(`LEAD_ACTOR_STATE` **[seen]** `0x8a82`) drives a jump-table dispatch, and its vertical
position (`PLAYER_Y` **[seen]** `0x8a84`) is what the sprite Y coordinates are derived from
and what enemy AI aims at. Further pools follow: the enemy-actor sub-array
(`ENEMY_ACTOR_TABLE` **[seen]** `0x8ae0`), the object-state records (`OBJECT_STATE_RECORD_BASE`
**[code]** `0x8ba0`) that run into the projectile table (`PROJECTILE_TABLE` **[seen]**
`0x8be8`), the sprite-object pool (`SPRITE_OBJECT_TABLE` **[seen]** `0x8b70`), the formation
table (`FORMATION_TABLE` **[seen]** `0x8c30`) and formation-spawn table (`FORMATION_SPAWN_TABLE`
**[code]** `0x8c60`), the spawned-object table (`SPAWN_OBJECT_TABLE` **[seen]** `0x8c48`), the
hunter record table (`HUNTER_TABLE_BASE` **[code]** `0x8c78`), and the two-entry I-parity
enemy/target pair (`ENEMY_TARGET_REC0` **[seen]** `0x8c90` / `ENEMY_TARGET_REC1` **[seen]**
`0x8ca8`) with the eagle's live coordinates (`EAGLE_Y_COORD` **[code]** `0x8c94`,
`EAGLE_X_COORD` **[code]** `0x8c96`) inside it.

**The timer / flag / counter cluster (`0x8d00`-`0x8d7f`).** A dense band of scalar state:
the enemy spawn-cadence countdown (`ENEMY_SPAWN_TIMER` **[seen]** `0x8d07`), collision flash
and hit flags (`OBJ_HIT_FLAG_I0` **[seen]** `0x8d1b`, `OBJ_HIT_FLAG_I1` **[seen]** `0x8d1c`),
the wave-event and rope-grab latches (`WAVE_EVENT_LATCH` **[seen]** `0x8d21`,
`GRAB_ACTIVE_FLAG` **[seen]** `0x8d32`), the active-enemy count and global animation frame
counter (`ACTIVE_ENEMY_COUNT` **[seen]** `0x8d40`, `ANIM_FRAME_COUNTER` **[seen]** `0x8d41`),
the active object type (`ACTIVE_OBJECT_TYPE` **[seen]** `0x8d44`), the warning-siren driver
cells (`0x8d68`-`0x8d6a`), lane and wave-progress counters (`0x8d75`-`0x8d7d`), and the
deferred-object promotion machinery (`0x8d5e`-`0x8d5f`, `PROMOTED_OBJECT_LIST` **[code]**
`0x8d80`).

**Panel source and the attract/script cursors (`0x8e00`-`0x8ef0`).** The status-panel tile
source table (`PANEL_TILE_SOURCE` **[code]** `0x8e00`) precedes the attract/intro text-draw
machine: a per-frame script countdown (`SCRIPT_FRAME_TIMER` **[seen]** `0x8e50`), the
attract sub-state selector (`ATTRACT_SUBSTATE` **[seen]** `0x8e51`), and the script's VRAM
write pointer (`SCRIPT_WRITE_PTR` **[seen]** `0x8e56`).

**The state-machine selector and pointer cluster (`0x8f00`-`0x8f63`).** Page `0x8f` holds
the per-subsystem state machines: the shared animation-script cursor (`ANIM_SCRIPT_CURSOR`
**[seen]** `0x8f00`), the enemy-formation state (`FORMATION_STATE` **[seen]** `0x8f08`) and
teardown state (`WAVE_TEARDOWN_STATE` **[seen]** `0x8f24`), the rope-extend sub-state
(`0x8f14`-`0x8f19`), the arrow/rope launch state machine (`LAUNCH_STATE` **[seen]** `0x8f30`,
its arm latches at `0x8f20`/`0x8f3f`), the eagle-wave counters (`WAVE_INDEX` **[seen]**
`0x8f3d`, `WAVE_HOLD_TIMER` **[seen]** `0x8f36`, and neighbours), the display-list
interpreter's pointer pair (`DISPLAY_LIST_DST_PTR` **[seen]** `0x8f43` /
`DISPLAY_LIST_SRC_PTR` **[seen]** `0x8f45`), the level-intro phase index (`INTRO_PHASE_INDEX`
**[code]** `0x8f51`) and hit tally (`HIT_TALLY` **[code]** `0x8f52`), the main-loop sub-state
selector (`MAINLOOP_SUBSTATE_SELECTOR` **[code]** `0x8f5c`), and a play-mode latch
(`PLAY_MODE_LATCH` **[code]** `0x8f50`).

**The stack and the self-test tally (`0x8fc0`-`0x8fff`).** The Z80 stack lives at the very
top of work RAM. The boot points the stack pointer at `0x9000` (the sprite-bank base, one
past the end of work RAM) and immediately makes a single unbalanced push, so it settles at
`BOOT_STACK_TOP` **[code]** (`0x8ffe`) and grows downward from there (measured no deeper
than the low `0x8fc0`s). That deliberate off-by-one reserves the top byte, `0x8fff`, for the
ROM self-test tally (`ROM_SELFTEST_TALLY` **[code]**): a pass count the boot leaves *above*
the stack top so the vblank NMI's register save can never clobber it, because the play-state
gate later refuses to run unless that tally shows a full pass.

### The dispatch model that ties it together

The reason so much of work RAM is single scalar bytes is that Pooyan is a lattice of small
state machines, each a **selector byte that indexes a jump table**. The vblank routine reads
`MAIN_GAME_STATE` (`0x8805`) and dispatches attract / intro / play. Within play,
`PLAY_STATE_INDEX` (`0x880a`) selects a sub-handler; the attract sequence steps through
`ATTRACT_SUBSTATE` (`0x8e51`); the main loop cycles `MAINLOOP_SUBSTATE_SELECTOR` (`0x8f5c`);
the self-test/display path runs off `SELFTEST_DISPATCH_STATE` **[code]** (`0x8921`); and the
formation, launch, rope and eagle-wave subsystems each own their own selector on page `0x8f`.
A handler advances the machine simply by writing the next value into its selector cell. That
is the state model in one sentence: the machine's behaviour on any frame is the set of
selector bytes read this vblank, and progress is those bytes being rewritten in place.

## The frame loop and the vblank heartbeat

Two pieces of machinery share the CPU: a free-running main loop that *consumes*
work, and a vblank interrupt that *produces* it. The main loop never waits for the
beam. The vblank NMI is the only thing tied to the display's cadence, and it is
what turns the loop's continuous spinning into a steady per-frame rhythm.

**The main loop — loc_020f [code].** Each pass begins by reading the
display-command ring read cursor, `DISPLAY_CMD_RING_READ_PTR` (0x88a1) [code] — a
single low byte that walks the 0xc0..0xff window of page 0x88. The loop forms the
address 0x88:cursor and reads the slot there. A slot is marked free by having bit 7
set (0xff is an empty slot), so the loop doubles that byte and looks at the carry
that falls out of bit 7. Carry set means the pointed slot is free: the ring is
idle, no command is pending, so the loop runs the per-frame worker (loc_0254
[code]) and comes straight back to the top. Carry clear means a command is waiting,
and the loop dequeues exactly one before looping again. It is an infinite loop; it
is only ever left by the NMI or by a dispatched handler that returns into it.

**Draining one command.** The occupied slot holds the command's high byte, and the
slot immediately after it holds the low byte. The loop reads both, writes 0xff back
into each to free them, and advances the read cursor by two — wrapping back to 0xc0
whenever it steps past 0xff. The buffer it circles is `DISPLAY_CMD_RING_BUFFER`
(0x88c0-0x88ff) [code], thirty-two two-byte slots. With the command in hand the
loop routes it: the high byte, doubled and masked to a five-bit even offset,
indexes the pointer table at 0x0242 to pick a handler, while the low byte rides in
the accumulator as that handler's argument. Before jumping to the handler the loop
pushes its own top address (0x020f), so the handler returns directly into the loop,
which immediately tests the next slot. Command after command is drained this way
until the ring falls idle again and the worker gets its turn.

**Who fills the ring.** Commands are posted at the other end by loc_0038 [code],
which reads `DISPLAY_CMD_RING_WRITE_PTR` (0x88a0) [code]. It stores a two-byte
command — high byte then low byte — into the slot pair the write pointer names, but
only if that first slot is free (bit 7 set); if the slot is already occupied the
queue is full and the command is silently dropped. It then advances the write
pointer by two with the same 0xc0 wrap. So producers append two-byte display
commands at the write end and the main loop consumes them at the read end, a plain
circular producer/consumer queue whose "empty" marker is bit 7.

**The per-frame worker — loc_0254 [code].** This is what the loop spins on whenever
the ring is idle. It is gated by the worker control byte, `WORKER_CONTROL_BYTE`
(0x883f) [code]: when the low nibble of that byte is nonzero the worker does nothing
but run the program-signature integrity check and return; only when the low nibble
is zero, and a game is in progress (`GAME_ACTIVE_FLAG` (0x8806) [seen] set), does it
repaint the scrolling tile columns — blanking several columns and stamping the
capped scroll column, each cell stepping one tilemap row upward. One-player and
two-player layouts differ (`TWO_PLAYER_FLAG` (0x880e) [seen] selects a capped body
column, and `ACTIVE_PLAYER` (0x880d) [seen] picks which player's column advances),
and bit 4 of the control byte gates one extra blank column. The point for the frame
loop is that this is idle-time work: it fills whatever CPU the ring drain leaves
over.

**The vblank NMI — the heartbeat.** Once per frame the CPU takes a non-maskable
interrupt to the Z80 NMI vector at 0x0066, which is a bare jump into the service
routine at loc_066d. Nothing else in the machine is tied to the frame clock; this
is the sole per-frame event. The service routine first saves the entire register
file — main set, shadow set, and IX/IY — then masks further NMIs by clearing bit 0
of the LS259 control latch at 0xa180, so the frame's work cannot be re-entered.
It rebuilds the scrolling tile columns through the copy loop at 0x0714 (four column
groups while the play sub-state is 4, otherwise one taller group), kicks the
watchdog by writing 0xa000, and samples the three cabinet input ports — IN0/IN1/IN2
at 0xa080/0xa0a0/0xa0c0 — complementing each to active-high and shuffling them down
the edge-detect ring headed at `INPUT_PORT0` (0x8810) [seen], so the state code can
diff this frame's reads against last frame's to find button *presses* rather than
holds.

It then ticks the two per-frame counters. It decrements the worker control byte
(0x883f), which nothing else resets — so its low nibble reaches zero once every
sixteen frames, and that is exactly what lets the worker's scroll repaint fire on
one frame in sixteen while the signature check runs on the other fifteen. And it
decrements the free-running `FRAME_COUNTER` (0x8a5f) [seen], whose low bits phase
animation and whose zero-crossings gate the periodic integrity checks. Two further
per-frame services follow: the coin/coinage service at 0x59e8 and a drain of one
entry from the sound-command ring out to the audio CPU (loc_0e64 [code]).

Finally the NMI dispatches on the top-level game state, `MAIN_GAME_STATE` (0x8805)
[seen], through the table at 0x06f0 — attract (0x072d), intro/setup, and play among
its handlers. This dispatched handler is where the frame's real work happens:
advancing actors, running the round logic, and posting the very display commands
the main loop will drain. The handler returns into the epilogue at 0x06fa, which
copies the orientation flag `FLIP_SCREEN_FLAG` (0x881f) [seen] into the flipscreen
latch (0xa187 bit 7, inverted), pops every saved register back, re-arms the NMI by
setting bit 0 of 0xa180 back to 1, and returns to the exact main-loop instruction
it interrupted.

Put the two halves together and the division of labor is clean. The NMI is both
clock and producer: once per frame it reads the world, ticks the counters,
advances the game state, and queues the display commands and sound the frame needs.
The main loop is pure consumer: for the rest of the frame it drains that queue one
command at a time into the handler table, and whenever the queue empties it spins
the per-frame worker to keep the scroll columns creeping. A warning worth stating
plainly, because the polarity is easy to read backwards: in the ring a slot with
bit 7 *set* is *empty*, and the main loop treats a "free slot at the cursor" as the
signal to stop draining and run the worker — the presence of a command is the
bit-7-*clear* case.

## Configuration, coinage and players

### Reading the operator switches at power-on

Every operator-selectable setting is latched exactly once, during the power-on boot (`loc_0092`,
0x0092), and thereafter the game consults the decoded work-RAM copies rather than the hardware
switches. Two DIP banks feed this decode: `DSW1_PORT` **[code]** (0xa000) and `DSW0_PORT` **[code]**
(0xa0e0). Both banks read active-low, so the boot complements each port before pulling fields out of
it.

`DSW1_PORT` carries the play-configuration fields. The boot complements the byte and then rotates it
through, peeling off one field at a time: bit 2 becomes `CABINET_MODE_FLAG` **[code]** (0x880f), the
upright/cocktail selector; bit 3 becomes `BONUS_AWARD_DSW` **[code]** (0x8800), which later selects
the extra-life award schedule; bits 4-6 become the 3-bit `DIFFICULTY_DSW` **[code]** (0x8820), which
scales the enemy spawn schedules and threshold tables; and bit 7 becomes `DEMO_SOUNDS_DSW` **[code]**
(0x8821), the attract-mode sound-enable. The two lowest bits of the complemented byte select the
starting life count and are written to `LIVES_DSW` **[code]** (0x8807): field values 0/1/2 map to 3,
4, and 5 lives (the field value plus three), while a field value of 3 maps to the special 0xff
"many lives" setting.

`DSW0_PORT` carries the two coinage nibbles. Each nibble is passed through the coinage lookup table
`COINAGE_TABLE` **[code]** (a ROM byte table based at 0x0053) to translate a raw switch nibble into a
coinage-config value. The high nibble produces `COINAGE_CONFIG_SLOT2` **[code]** (0x882f) for the
second coin slot and the low nibble produces `COINAGE_CONFIG` **[seen]** (0x882c) for
the first — a coinage byte whose high nibble encodes how many coins make a group and whose low nibble
encodes how many credits that group buys. The sentinel value 0x0f in either config cell means free
play, and code throughout the machine tests for exactly that value before charging a credit.

The same boot pass also lays down the default ten-entry high-score table and clears the whole work-RAM
config region, so the decoded switch cells above are the only non-zero configuration state the game
starts with.

### Accepting coins and awarding credits

Coin acceptance runs once per frame, but only for a paid machine. The credit/coinage update chain
`loc_59e8` (0x59e8) reads both coinage-config cells first: if `COINAGE_CONFIG` (0x882c) or
`COINAGE_CONFIG_SLOT2` (0x882f) holds the free-play sentinel 0x0f, it returns immediately and no coin
processing happens at all. Otherwise it fans out to the per-slot coin handlers and the coin-counter
strobe.

The first-slot handler (`loc_5a56`, 0x5a56) samples the raw input port. Each NMI, `loc_066d` writes
the complemented first input port into `INPUT_PORT0` **[seen]** (0x8810, whose bit 0 is the coin
switch, bit 3 the one-player-start button, and bit 4 the two-player-start button); the coin handler
rotates that coin bit into a small edge-history ring at 0x882a and acts only on a clean press edge, so
a held coin switch cannot register more than one coin. On a fresh coin it does three things: it bumps
`COIN1_PULSE_COUNT` **[code]** (0x8824) to queue a physical coin-counter tick; it advances a
coins-inserted accumulator toward the group threshold; and when the accumulator crosses the threshold
encoded in `COINAGE_CONFIG`, it awards that config's low-nibble worth of credits and subtracts the
group back out of the accumulator. Credit awarding funnels through a shared tail (0x5a8c) that adds the
awarded amount to `CREDIT_COUNT` **[seen]** (0x8802) and clamps the total to 0x63 — the credit counter
saturates at 99 — then queues a "credit added" display command. A coinage byte whose low nibble is
0x0f awards the maximum in one go.

> Warning: the coins-inserted accumulator this handler maintains lives at 0x882b, the same byte that
> names.js labels `TAMPER_ROM_CHECK_FLAG` **[code]** for its unrelated use as the eagle-spawn
> ROM-checksum mismatch flag. The two roles never overlap in time, but the single address is
> multiplexed, so do not read a coinage accumulator value as a tamper verdict or vice-versa.

### The physical coin counter

Queuing a coin tick is separate from driving the mechanical coin meter. `COIN1_PULSE_COUNT` (0x8824)
is a queue depth; the coin-counter pulse generator (`loc_5a9c`, 0x5a9c) drains it into a properly
timed strobe. With nothing queued it does nothing. When it sees a queued pulse and its phase timer
`COIN1_PULSE_PHASE` **[code]** (0x8825) idle, it seeds the phase to 0x30 and raises the coin-counter
output `COIN1_COUNTER_LATCH` **[code]** (0xa183, an LS259 latch bit where only bit 0 of the written
value lands). Each subsequent frame it counts the phase down, drops the latch low again at phase
0x18, and when the phase reaches zero retires one queued pulse. The result is a fixed-width high/low
pulse on the meter for every coin, regardless of how fast coins arrive.

### Showing the credit total

The credit total is painted by `loc_05ee` (0x05ee). It reads `CREDIT_COUNT` (0x8802), clamps it to 99
for safety, and converts it to packed BCD. The high nibble is written as the tens tile
`CREDIT_HUD_TENS_VRAM` **[code]** (0x86bf) but only when it is non-zero (so single-digit credit counts
show no leading zero), and the low nibble is always written as the units tile `CREDIT_HUD_UNITS_VRAM`
**[code]** (0x869f). This same routine hides a ROM-checksum tripwire that only arms when the units
digit happens to be 2, but that is an anti-tamper concern rather than a coinage one.

### Starting a game: consuming credits and choosing players

There are two ways a game begins, chosen by whether the machine is free play.

On a paid machine the attract/credit epilogue (`loc_0bb5`, 0x0bb5) is the gate. Because
`COINAGE_CONFIG` is not 0x0f, a present credit simply advances the top-level state selector
`MAIN_GAME_STATE` **[seen]** (0x8805) and clears the in-play sub-state index `PLAY_STATE_INDEX`
**[seen]** (0x880a) — this walks the attract loop toward the start screens once money is in the box.
The actual credit charge happens in the start handler family (`loc_0d78`, 0x0d78, and its neighbours):
pressing one-player-start (input bit 3) routes to `loc_0de4`, which, if `CREDIT_COUNT` is non-zero,
decrements it by one and begins a one-player game; pressing two-player-start (input bit 4) subtracts
two credits from `CREDIT_COUNT` before beginning a two-player game. So a coin adds one credit, a
one-player start consumes one, and a two-player start consumes two.

On a free-play machine there is nothing to charge, so the epilogue instead polls the input port
directly: input bit 3 (one-player start) or bit 4 (two-player start) is enough to launch, and the
free-play extra display command is emitted so the screen shows "FREE PLAY" (that extra command comes
from `loc_0e54`, 0x0e54, which appends it whenever `COINAGE_CONFIG` reads 0x0f).

Both paths converge on the start-of-game setup (`loc_0dab`, 0x0dab). It writes a 16-bit value into the
adjacent pair `ACTIVE_PLAYER` **[seen]** (0x880d) and `TWO_PLAYER_FLAG` **[seen]** (0x880e) in one
store: a one-player start seats 0x0000 there (active player 0, two-player flag clear) and a two-player
start seats 0x0100 (active player 0, two-player flag set). `TWO_PLAYER_FLAG` is therefore simply "this
is a two-player game", and `ACTIVE_PLAYER` bit 0 selects whose turn is live. The setup also drives
`MAIN_GAME_STATE` to its play value, raises the in-play gate `GAME_ACTIVE_FLAG` **[seen]** (0x8806),
and, only for a two-player game, fires an extra start event and clears a second-player scratch block.

The gameplay continuation `loc_15d1` (0x15d1) shows the same fork from the other side: after a game
ends it either hands off to the shared attract epilogue when `COINAGE_CONFIG` is free play, or returns
without advancing when `CREDIT_COUNT` is zero, or otherwise pushes the state machine back toward a new
game — i.e. it keeps re-attracting when there is money or free play, and idles when there is neither.

### Per-player banks: scores, lives and alternation

A two-player game keeps two independent copies of everything and swaps between them at each death.

Score lives in two three-byte BCD buffers, `P1_SCORE_BCD` **[seen]** (0x88a2) for player one and
`P2_SCORE_BCD` **[seen]** (0x88a5) for player two. `selectActivePlayerScoreBuffer` (0x04f2) is the
tiny selector everything routes through: bit 0 of `ACTIVE_PLAYER` picks player one's buffer when clear
and player two's when set. The score-accrual routine (`loc_0496`, 0x0496) and the extra-life
bonus-award step (`loc_18da`, 0x18da, which compares the active player's score high byte against the
schedule chosen by `BONUS_AWARD_DSW`) both accumulate into whichever buffer that selector returns, so
each player's score grows only during their own turn.

Lives are held per player in `PLAYER0_LIVES` **[seen]** (0x8948) and `PLAYER1_LIVES` **[seen]**
(0x8988). At each board reset (`loc_0e00`, 0x0e00) both are seeded from `LIVES_DSW` (0x8807), so the
DIP-selected life count applies equally to both players; the same reset also seeds each player's
opening sprite X into their saved state bank and copies `DIFFICULTY_DSW` into the bank's colour byte.

Each player's full actor/state page is preserved in a saved bank — `PLAYER0_STATE_BANK` **[seen]**
(0x8940) and `PLAYER1_STATE_BANK` **[seen]** (0x8980) — while only one page is live at a time. The
save side (`saveLiveStateToPlayerBank`, and `saveLivePageToPlayer0Bank` which additionally latches
`ACTIVE_PLAYER` to 1 when a two-player game's player one is still alive) copies the 0x3f-byte live
page down into whichever bank `ACTIVE_PLAYER` names. The restore side, at round init (`loc_1601`,
0x1601), copies the active player's saved bank back up into the live page, so a returning player
resumes exactly where they left off. The play-sub-state index is nudged per player as turns change:
several handlers (`loc_1a85`, `loc_1a96`) add one extra step when the active-player selector is set, so
the two players land on their own state-machine slots.

### Cabinet orientation

`CABINET_MODE_FLAG` (0x880f) is the upright-vs-cocktail selector, read as a boolean at round init
(`loc_1601`). In a cocktail cabinet the round-init handler flips the screen for the second player by
writing the derived player index into the orientation flag `FLIP_SCREEN_FLAG` **[seen]** (0x881f) and
enqueuing the matching player-select display command; in an upright cabinet the orientation is left
alone. The orientation flag itself is copied out to the hardware flip-screen latch every frame.

## In-play progression and timers

Everything in a Pooyan round hangs off a single per-frame heartbeat. The vblank NMI service
routine samples the three input ports, ticks two free counters — the per-frame worker control
byte and the free-running `FRAME_COUNTER` (0x8a5f) **[seen]**, both simply decremented once each
frame — and then dispatches on `MAIN_GAME_STATE` (0x8805) **[seen]** through a five-entry jump
table. That selector is the coarsest state axis the machine has: value 0 runs the attract wipe,
1 runs the attract/self-test sub-machine, 2 runs the game-start setup, 3 is the live game, and 4
is a do-nothing return. The NMI prologue even keys its own scroll-column rebuild off the play
sub-state, redrawing four column groups only while that sub-state equals 4 and a single tall
column otherwise, so the amount of tilemap it repaints tracks where the round is in its cycle.

Underneath the play state sits a second, finer gate: `GAME_ACTIVE_FLAG` (0x8806) **[seen]**. It
is raised at the start of a life and cleared the instant the game is over, and nearly every
in-play worker reads it and returns immediately when it is clear — the play timer, the sound and
text ring appenders, and the joystick sampler all bail on a clear flag. The main-state-3 handler
runs its full body every frame regardless, but the flag is what decides whether that body does
any live-game work or merely idles. When the game does end, control lands in the game-over
routine, which zeroes `GAME_ACTIVE_FLAG`, the play sub-state, `ACTIVE_PLAYER` (0x880d) **[seen]**
and `TWO_PLAYER_FLAG` (0x880e) **[seen]**, and drops `MAIN_GAME_STATE` back to 1 (attract). A
continue-with-credit instead routes through the between-lives path, which clears the whole live
0x8900 page (0xbf bytes), zeroes the flag and sub-state, and sets `MAIN_GAME_STATE` to 2 to
rebuild the board.

### The play sub-state machine

While `MAIN_GAME_STATE` is 3, the play handler does two things in order. First it ticks the
active player's BCD play-timer (below). Then it reads `PLAY_STATE_INDEX` (0x880a) **[seen]**,
masks it to five bits, and jumps through a nineteen-entry table — this is the sub-state axis that
carries a round from its opening wipe to its resolution. The observed sub-state values step
through a fixed vocabulary (1, 2, 3, 4, 7, 10, 13, 18), each handler advancing the index to the
next station when its work is done, so the index behaves as a small program counter for the
round rather than a dense enumeration.

The opening station is the round-init handler. It blanks the tilemap one row at a time and
returns early every frame until the fill drains — the fill is paced by `FILL_ROW_COUNTER`
(0x8809) **[seen]**, seeded to 0x20, and the paired write cursor `TILE_FILL_PTR` (0x880b)
**[seen]**, which walks up one tilemap row (+0x20) per drained row. Only once the wipe completes
does it re-arm the fill, clear the actor arena and several round cells, restore the active
player's saved page into the live page, derive the initial rope-segment count, copy the round's
message string into the display buffer, seed `PHASE_TIMER` (0x8808) **[seen]**, and bump the
sub-state. `PHASE_TIMER` is the intra-phase stopwatch: a downstream station decrements it every
frame and returns while it is non-zero, so it holds a phase on screen for a fixed number of
frames before the machine is allowed to move on.

A later station marks the wave live: it sets `ROUND_IN_PROGRESS` (0x8904) **[seen]** to 1 and
steps `WAVE_ARRIVAL_COUNTER` (0x8903) **[seen]**, then runs the level-start batch and forces the
sub-state to the bird-setup station, which seeds four actor records and, on the appropriate
branch, fans out a group of enemies sized from the round counter. Enemy pace is chosen by the
speed-selection handler, which runs only while the stage countdown and lead actor are both idle
and no enemy record is already busy; it then advances the sub-state and computes a speed value
from the difficulty switch plus the round input — halved and added to the arrival count when the
round's low bit is clear — clamps it below 0x20, and commits it to `SPEED_INDEX` (0x8900)
**[seen]** while clearing the player's aim flags. The round-advance station bumps `ROUND_COUNTER`
(0x8907) **[seen]** and snapshots the board reset's return value into `SPAWN_PHASE_COUNTER`
(0x8902) **[seen]** and its mirror `ROPE_DRAW_COUNT` (0x8934) **[seen]**.

The round resolves at the phase-gauge station. It counts `GAUGE_PHASE_COUNTER` (0x8908)
**[seen]** down by one; while the count is still positive it repaints the vertical gauge HUD and
re-seeds the sub-state to the player's bank station (0x0a, or 0x0b for player two). When the
count reaches zero it tails into the phase-exhausted handler, which queues the phase-exhausted
tile run, clears the rope-segment count and a marker pointer, advances the sub-state, and hands
off to the high-score insert-sort. The gauge itself is not a fixed reload — it is accrued: the
bonus-award tally step bumps `GAUGE_PHASE_COUNTER` one notch (saturating at 0xff) each time the
active player's score high byte reaches the next queued award value, so the gauge fills as the
player scores and drains one step per phase.

### The 0x8900 progression cells

The band from 0x8900 up is the live per-round state page, and its cells interlock. `SPEED_INDEX`
(0x8900) is the base of that page and the enemy speed/difficulty index; it escalates with the
round and is read clamped below 8 to index the velocity tables. `STAGE_COUNTDOWN` (0x8901)
**[seen]** is the per-stage countdown: it is drained one step by the shared enemy-despawn tail
each time an enemy leaves the field, and while it is non-zero the speed-selection handler refuses
to arm a new target group — so the stage cannot re-populate until its quota of departures is met.
That same despawn tail also drops the active-enemy count and, only while the play sub-state is
the fourth phase, bumps `SPAWN_PHASE_COUNTER`, then repaints the countdown as two HUD digits.

`SPAWN_PHASE_COUNTER` (0x8902) is the per-round phase/step counter that cycles up to 7; the
board-reset routine watches for it reaching that cap and reseeds both it and `ROPE_DRAW_COUNT` to
4, filling the formation slot table at the same time. `WAVE_ARRIVAL_COUNTER` (0x8903) counts
enemy arrivals up per stage (capped at 8) and bounds the rope: round-init sets `ROPE_SEGMENT_COUNT`
(0x8931) **[seen]** to the arrival count minus two. `ROUND_COUNTER` (0x8907) is the HUD round
number, BCD-rendered; its low bit selects the stage-type/facing variant (and steers the speed
formula), while bit 1 gates the target-group fan-out and later spawn branches. `ROUND_IN_PROGRESS`
(0x8904) is the plain in-progress flag keyed by the render and state decision trees, set at level
start and reset at stage/life transitions.

A board is (re)built by the new-board reset routine. It fills the whole live-state page from
`SPEED_INDEX` with zero, clears the play sub-state and both play-timer gates, then seeds each
player's saved bank from the cabinet switches: lives come from `LIVES_DSW` (0x8807) **[code]**, a
fixed opening X is written into each bank, and the sprite colour is taken from the difficulty
switch. It arms the row-by-row tile fill, and — only when the game is actually active — also
clears the launch flags. The board-reset helper enqueues a reset display command, conditionally
reseeds the phase and rope-draw counters as noted, and mirrors its fill value into the lead-actor
state and a few HUD cells. A separate `BOARD_CLEAR_FLAG` (0x89e5) **[code]** is the board-complete
diverter: when set it freezes the per-frame object update and reroutes handlers onto the
board-clear / level-intro path; it is static zero in the captured play, so its role is read from
the code (armed on an enemy-scan/table mismatch, tail-jumped to the board-clear routine) rather
than observed changing.

### Per-player lives and state banks

Each player owns a saved state block and a lives byte outside the live page. `PLAYER0_LIVES`
(0x8948) **[seen]** and `PLAYER1_LIVES` (0x8988) **[seen]** are both seeded from `LIVES_DSW` at
board reset and drain one per death; when the active player's count reaches zero the game-over
path is taken. Around them sit `PLAYER0_STATE_BANK` (0x8940) **[seen]** and `PLAYER1_STATE_BANK`
(0x8980) **[seen]**, each a 0x3f-byte snapshot of the live 0x8900 page. The live page is copied
out to the finishing player's bank and the incoming player's bank is copied back into the live
page across a player switch, which is how a two-player game preserves each player's round state
while they alternate. Round-init performs exactly that restore — it copies 0x3f bytes from the
active player's bank into the live page immediately after wiping the round cells.

### The BCD play timers and their gates

Each player also has a wall-clock play timer, ticked every frame the game is active. The tick
handler bails on a clear `GAME_ACTIVE_FLAG`, then selects the active player's pair: the gate
`PLAY_TIMER_GATE_P1` (0x89e1) **[code]** or `PLAY_TIMER_GATE_P2` (0x89e2) **[code]** and the
three-byte bank `PLAY_TIMER_BCD_P1` (0x8a30) **[code]** or `PLAY_TIMER_BCD_P2` (0x8a33)
**[code]**. A non-zero gate suppresses the tick entirely — that is how a finished player's clock
is frozen while the other still plays. When the gate is clear, the bank's base byte is a frame
sub-counter that rolls at 0x3b, or 0x3c on the extra frame chosen by bit 0 of the seconds digit
(so the timer averages the NTSC-ish 60-ish frames per second across two seconds). On the roll it
clears the sub-counter and BCD-carries the seconds digit, and when seconds reach 0x60 it clears
them and carries into the minutes digit — each digit rolling its low nibble at 0x0a and its high
nibble at 0x60, i.e. proper minutes:seconds BCD.

The timer is drawn by the shared integrity-and-render handler that the mid-round stations invoke.
It splits the active player's minutes and seconds BCD bytes into hi/lo nibble tiles and stamps
them up a video column from `PLAY_TIMER_DIGIT_VRAM` (0x862d) **[code]**, walking one tilemap row
up (−0x20) per tile and parting the minute and second pairs with a spacer tile, then clears the
three timer bytes it just rendered so the next second's worth accumulates fresh.

The gate and the accumulated time both feed the high-score record. When a finished player's score
is inserted into the sorted ten-entry table, the insert-sort also rides two parallel side tables:
it raises that player's play-timer gate to 1 (freezing the clock at its final value), shifts the
per-entry play-time side table `HIGH_SCORE_TIME_TABLE` (0x89e0) **[code]** down alongside the
score table, and stores the finishing bank's two BCD timer bytes into the opened slot, recording
how long that high score took. It also records the winning rank in `HIGH_SCORE_INSERT_RANK`
(0x89fc) **[code]**. The gates are only ever cleared again at the next board reset, which arms a
fresh clock for the new game.

## The actor arena

Everything that moves on the playfield — the player at the top of the tree, the wolves
climbing and falling, the arrows and bombs in flight, the rope segments and the fountain
sprites — lives in a bank of fixed-size records that all share one shape. Each record is
`0x18` bytes, and the routines in this section only ever step between records by adding or
subtracting that stride. Several arrays of these records sit back-to-back in the `0x8a`–`0x8c`
pages, and the code treats them as separate pools even though the layout is uniform:

- `ACTOR_TABLE` **[seen]** at `0x8a80` is the main arena. Slot 0 is the player/lead actor, and
  its fields are named individually because so much code reaches them directly: `LEAD_ACTOR_STATE`
  **[seen]** (`0x8a82`, the slot's `+2` dispatch index), `PLAYER_Y` **[seen]** (`0x8a84`, the
  slot's `+4` vertical position) and `PLAYER_AIM_FLAGS` **[code]** (`0x8a87`, the slot's `+7`
  input/aim byte). A whole 0x18-byte snapshot of the lead record is kept one slot along at
  `ACTOR_TABLE_SLOT1` **[code]** (`0x8a98`). The wolf sub-array `ENEMY_ACTOR_TABLE` **[seen]**
  begins `0x60` bytes into the same arena at `0x8ae0`.
- `SPRITE_OBJECT_TABLE` **[seen]** (`0x8b70`, five slots), `OBJECT_STATE_RECORD_BASE` **[code]**
  (`0x8ba0`, six slots that run straight into the projectiles), `PROJECTILE_TABLE` **[seen]**
  (`0x8be8`, three slots), `FORMATION_TABLE` **[seen]** (`0x8c30`, four slots) and
  `SPAWN_OBJECT_TABLE` **[seen]** (`0x8c48`, three slots) are the secondary pools. The two
  `ENEMY_TARGET_REC0` **[seen]** / `ENEMY_TARGET_REC1` **[seen]** records (`0x8c90`, `0x8ca8`,
  one stride apart) form an interrupt-parity pair used as collision targets.

Within a record the byte roles are consistent across every pool. `+0` and `+1` are the
record-active flags — a record is live only when bit 0 of `(+0)|(+1)` is set, and every dispatch
and scan loop opens by testing exactly that. `+2` is the state/phase index that selects the
per-frame handler. `+3`/`+4` are the vertical position as 16-bit fixed point (fraction, then
integer row); `+5`/`+6` are the horizontal sub-position and column. `+7` holds input or per-actor
state bits, `+8` an attribute byte, `+9`/`+0a` a signed velocity and its negation. `+0b` is a
per-record animate/sub-frame bit. `+0c`/`+0d` point little-endian at the animation script and
`+0e` is that script's frame-hold countdown; `+0f` is the colour attribute and `+10` the tile
code the display list will read. `+11` is a general frame-delay timer, `+12`/`+13` a hold timer
and phase (they double as a seeded handler pointer on a struck record), `+14` a match/tag key,
and `+16`/`+17` a 16-bit datum whose low bits also carry arm flags.

### Per-frame dispatch

Each pool is walked once a frame by a small driver that hands each live record to a state
handler keyed off its `+2` byte. The main arena's lead actor is driven from `loc_241e`, which —
after the busy/tamper freeze at `TAMPER_FREEZE_FLAG` **[code]** (`0x881e`) is checked — reads `(ACTOR_TABLE+2)
& 7` and dispatches through a six-entry table into the state handlers `loc_2442`, `loc_2473`,
`loc_2497`, `loc_24b9`, `advanceActorDropStateOnDelay` and `loc_24fb`. `LEAD_ACTOR_STATE` steps
`0 -> 1 -> ... -> 5 -> 0`, so this is the animation-and-motion state machine for the player's
tree-drop/rise cycle, and the `>=3` reading of the same byte separately gates spawn/formation work
elsewhere.

The object-state pool is driven from `loc_76f4`, which points at `OBJECT_STATE_RECORD_BASE` and
runs `dispatchActiveObjectState` over six records a stride apart. That dispatcher first rejects any
record whose `+0|+1` bit 0 is clear, then selects one of four handlers from `(rec+2) & 3` — a
tail hand-off, so the handler returns straight past the dispatcher. The wolf sub-array at `0x8ae0`
is swept by several drivers depending on the current game phase: `loc_6a7f` runs its per-object
dispatcher `loc_6a98` over eighteen records when the blink phase is set; `loc_6edb` runs `loc_6f2d`
over fourteen; `loc_66c5` runs `loc_66f1` over three; and `loc_6666` walks three records backward
advancing idle actors. `loc_66f1` is the sub-array's own four-way state dispatcher, routing `(rec+2)`
into the record's per-frame handler. A separate gate byte, `ENEMY_REC_DISPATCH_GATE` **[code]**
(`0x8afa`), lets that enemy-record dispatch be skipped entirely when zero.

Two more sweeps round out the frame. `loc_22b1` steps the animation script of four records starting
at `ACTOR_TABLE`, but only while the rope-grab latch `GRAB_ACTIVE_FLAG` **[seen]** (`0x8d32`) is
clear — a grab freezes the whole pass. `loc_09f8` steps four `SPRITE_OBJECT_TABLE` records through
their animations and then rebuilds the sprite display list so the fresh tile/colour bytes reach the
screen the same frame.

### Actor animation stepping

An actor's on-screen appearance is driven by a byte stream, and `advanceActorAnimFrame` is the core
stepper. It treats `+0e` as a frame-hold: while non-zero it simply decrements and returns, so each
frame of an animation lingers for its programmed number of ticks. When the hold reaches zero it walks
the stream addressed by `+0c`/`+0d`; a `0xff` opcode is a jump that reloads the pointer from the next
two stream bytes and re-reads, and any other byte begins a three-byte frame record — tile to `+10`,
colour to `+0f`, new hold to `+0e` — after which the advanced pointer is written back. `loc_4006` is
the same mechanism for the object pool.

A parallel path animates several actors from one *shared* cursor rather than a per-record pointer.
`loc_22e6` (invoked by the `loc_22b1` sweep) ticks a record's `+0e` hold and, on expiry, pulls the
next `{tile, colour, delay}` triple from `ANIM_SCRIPT_CURSOR` **[seen]** (`0x8f00`) and advances that
16-bit cursor past it, so a run of records marches through one script in lockstep. A `0xff` lead byte
there is a control marker: normally it rewrites the cursor from the two bytes that follow (an inline
script jump). There is a rival branch that would instead snap the cursor back to the base script, but
it only fires when the two-record target-presence fold (`foldTargetPresenceBits`, rotating the
presence bit of `ENEMY_TARGET_REC0`/`ENEMY_TARGET_REC1`) reaches 3 — and since that fold seeds 0 and
is only ever rotated, it never does, so the marker always resolves as the inline jump. **Reading
warning:** the `0xff` marker is *not* a stream terminator here; it is a jump, and the base-script
reset is effectively dead code.

To arm or restart an animation, `setActorAnimation` and `storeActorAnimationPointer` both write the
little-endian script pointer into `+0c`/`+0d` and clear the step byte at `+0e`, so the actor begins
its new sequence at frame 0. `tickActorAnimHold` (and its six-record wrapper `loc_5d0b` over the
enemy table) provides a coarser hold: it counts `+12` down, and on underflow steps the two-bit phase
at `+13`, re-arming `+16` while phase remains and disarming when it is exhausted — gated so it only
runs on the per-record animate bit or, failing that, on even `ROUND_COUNTER` **[seen]** (`0x8907`)
frames.

Position, as opposed to appearance, is stepped by a family of small motion handlers that each own
one dispatch state. `advanceFallStep` adds the fall velocity `+9` into the fixed-point fraction `+3`
and carries a whole row into `+4` on overflow, reporting (via carry) whether the actor is still above
the landing row `0x1e`. `advanceRisingActorStep` drives `+6` upward toward `0xc0`, flipping the tile
between `0x15` and `0x1e` every fourth frame, then on arrival nudges `+4`, advances the state and
seeds a long inter-state delay. `advanceActorDropStateOnDelay` waits out the `+11` delay before
nudging the actor down a step and advancing its state. The lead-actor handlers do the same in the
player's own cycle: `loc_2442` seeds the frame delay, advances the state, snapshots the whole lead
record into `ACTOR_TABLE_SLOT1`, drops `+4` a row and loads a shape table; `loc_2497` counts `+11`
down then advances the state and nudges the primary record's `+4`/`+6`; `loc_24b9` drives `+4` down
toward the floor `0xdc` on a sub-counter cadence before transitioning.

### Spawning into the arena

A fresh board begins by wiping the arena. `clearActorArena` zeroes the whole `0x200`-byte block at
`ACTOR_TABLE`, so no stale record survives; `clearActorArenaAndCounters` does the same over a slightly
larger span and additionally resets `SPAWN_PHASE_COUNTER` **[seen]** (`0x8902`) and the wave/rope
counters and forces the in-play sub-state to 6 — the teardown path.

New wolves are metered by `loc_1171`. It counts `ENEMY_SPAWN_TIMER` **[seen]** (`0x8d07`) down each
tick and, only at zero, gates the spawn on two conditions: the `STAGE_COUNTDOWN` **[seen]** (`0x8901`)
must still be ahead of the live count, and fewer than six wolves may already be active. When both
hold it walks the six enemy records and initialises the first free one via `loc_119a`, which stamps
the opening state fields, derives a facing byte and its negation and a spawn-timer reload from a
`ROUND_COUNTER`-indexed table, arms the record's animation, reloads `ENEMY_SPAWN_TIMER`, and bumps
both `ACTIVE_ENEMY_COUNT` **[seen]** (`0x8d40`) and the spawn tally `loc_8f5f` **[guess]** (`0x8f5f`).
The scan reads its own return as a skip signal — "already active, keep looking" versus "seeded a free
one, stop".

Child actors (the birds/objects a parent launches) are spawned by `loc_13bc`, which scans the five
`SPRITE_OBJECT_TABLE` slots for a free record, bumps the wrapping `ANIM_FRAME_COUNTER` **[seen]**
(`0x8d41`, which skips zero on wrap) as a fresh sprite id, stamps it into the parent's `+14`, points
the parent at a fixed animation vector and hands off to `loc_142c`. That initialiser seeds the child's
fixed slots, copies the parent's four position bytes with fixed biases, looks the enemy speed out of a
table by the round-clamped speed index, negates it on odd `ROUND_COUNTER` so alternate rounds spawn
facing the other way, mirrors that velocity into both records, arms the anim and timer, and enqueues
the spawn sound. `seedObjectRecord` is the low-level primitive used elsewhere to lay a record's `+4`/`+6`
and its `+0c`/`+0d` animation pointer from two source streams, and `initActorRecord` stamps the fixed
opening constants (`+0=0`, `+1=1`, `+2=8`, `+12=0xff`, plus a 16-bit datum at `+16`) into a brand-new
record. The rope path spawns through `loc_2e5e`, which — every fourth `FRAME_COUNTER` **[seen]**
(`0x8a5f`) and once its cell timer elapses — finds a free `SPAWN_OBJECT_TABLE` slot, seeds it with
state `0x07` and fixed coordinates, and draws the rope-segment tile. `adjustSpawnColumn` and
`stampObjectAndDecCounter` are the small helpers that bias a spawn column by wave progress and stamp
two fixed state bytes while decrementing a shared counter.

### Collision and teardown

Collisions are all proximity tests: an object's screen box is compared against a set of coordinate
slots, and a close-enough pair is a hit. `loc_5d4d` runs the canonical scan, pairing three
`SPRITE_TARGET_SLOTS` **[seen]** (`0x887c`, stride 4) with three `PROJECTILE_TABLE` records
(stride 0x18) against the fixed `PROXIMITY_SOURCE_OBJECT` **[code]** (`0x889c`). Its per-pair test
`loc_5d68` skips records in states 0 or 5, offsets the source box by the `FLIP_SCREEN_FLAG` **[seen]**
(`0x881f`), and calls it a hit when the target lies within `|dx| < 4` and `|dy|` in `[9, 0x0f)`; a hit
re-seeds the struck record (including a post-hit handler pointer into `+12`/`+13`) and aborts the scan.

The wolf-versus-shot collision is `loc_6435`. It picks its object set by `PLAY_MODE_LATCH` **[code]**
(`0x8f50`), tests up to three records with both axes required within `0x07`, and on a hit clears the
struck record's active bytes, sets its teardown timer, raises the interrupt-parity hit flag —
`OBJ_HIT_FLAG_I0` **[seen]** (`0x8d1b`) or `OBJ_HIT_FLAG_I1` **[seen]** (`0x8d1c`) chosen by the I
register, *not* by which player is up — restarts its animation, queues the hit effect and (in
one-player play) a hunter-spawn command, bumps the target tally `HIT_TALLY` **[code]** (`0x8f52`),
and runs a terminator guard whose abort propagates back as the scan's stop signal. `loc_638a` (seeded
by `loc_6381`) is the sibling scan that not only marks a struck record but claims and spawns into it.
`loc_5f11` is the same box test packaged as a B-count sweep that, on a hit, marks the slot and sets
the collision-flash cell `FLASH_CELL_BASE` **[code]** (`0x8d19`, whose `+0`/`+1` pair is picked by
interrupt parity) before firing the hit sound. `precheckCollisionBounds` is the shared prologue for
these: it biases an actor's X by the flip flag and forms `Y+8`, returning both plus an on-screen flag
so a slot below the bottom limit `0xe0` is skipped before any distance maths.

`loc_6c18` is the acquisition counterpart rather than a damage test: it scans the three projectile
records for a target in band and, when *none* is found, clears the above/below bits of
`PLAYER_AIM_FLAGS` and zeroes `PROXIMITY_HIT_FLAG` **[code]** (`0x8d54`) — the flag the aim-indicator
updater bails on when it is set. Tag-directed collisions use the `+14` match key: `loc_611f` scans six
enemy records for one whose `+14` equals a computed key and routes a match to `loc_613d`, and
`loc_60d9` raises a parity hit flag, seeds a fresh record via `initActorRecord`, and runs that scan.

Teardown of a spent object is `loc_21cf`: depending on the record's flag bits it either advances a
sub-phase (stepping `+4` toward `0xe8`) or consumes a per-object timer cell — the same `0x8d1b`/`0x8d1c`
hit flags — and, when a cell expires, blanks the record's whole `0x18`-byte tile band and clears it.
The shared movement/despawn tail `loc_34b0` blanks an actor's sprite band, drops `ACTIVE_ENEMY_COUNT`,
drains `STAGE_COUNTDOWN` while it is still positive, bumps `SPAWN_PHASE_COUNTER` when the play
sub-state is the fourth phase, and repaints the stage countdown as its two HUD digits — the point where
a killed or arrived wolf is subtracted from the arena's population.

## Waves, rope and launch

Three per-frame state machines share this corner of the game: the eagle attack-wave
driver that flies enemy records across a grid, the rope machinery that grows and animates
a hanging column of segments, and the arrow/launch sequence that arms the player's shot and
seeds hunters. Each is a small selector byte dispatched into a handful of handlers, and each
advances that selector as its work completes, so a reader can follow any one of them as a
straight walk from state 0 to teardown.

### The eagle attack wave

The wave driver `loc_72a7` **[code]** runs once per frame and branches on the eagle-wave
launch flag `WAVE_LAUNCH_FLAG` **[code]** (0x8f3a). While that flag is clear it calls the
seeder `loc_72e1` **[code]** and returns; once a wave is up it either hands off to the idle
handler `loc_73e3` **[code]** when the live record count `WAVE_RECORD_COUNT` **[code]**
(0x8f3c) has drained to zero, or otherwise walks `2 × WAVE_INDEX` **[seen]** (0x8f3d) records
of the enemy-actor table `ENEMY_ACTOR_TABLE` **[seen]** (0x8ae0, stride 0x18), running the
per-record state machine on each.

Seeding only happens while the first target slot `ENEMY_TARGET_REC0` **[seen]** (0x8c90) is
clear. `loc_72e1` raises the launch flag and advances `WAVE_INDEX`; on the fourth wave it does
nothing but re-arm the outer-phase counter `WAVE_OUTER_PHASE` **[code]** (0x8f38) and reload the
inter-wave hold `WAVE_HOLD_TIMER` **[seen]** (0x8f36) to 0x20. On every other wave it initialises
two records per wave index in the enemy-actor table, copying four fields apiece out of the ROM
parameter table `EAGLE_WAVE_PARAM_TABLE` **[code]** (0x7409) into each record's +6/+0x10/+4/+0x0f
fields, marking the record active, and stamping a fixed flag byte into field +5 (and into +3 for
records whose own low address has bit 3 set). It then records the count into `WAVE_RECORD_COUNT`
and zeroes both `WAVE_OUTER_PHASE` and the arrived count `WAVE_RECORDS_ARRIVED` **[seen]** (0x8f39).

Each active record is driven through a three-state machine selected by its own +2 field: state 0
approach, state 1 dive/climb, state 2 retire. **Approach** (`loc_733c` **[code]**) watches the
live eagle position — its column comes from `EAGLE_X_COORD` **[code]** (0x8c96) shifted down by
three, its row from `EAGLE_Y_COORD` **[code]** (0x8c94) shifted down and biased by four — and
returns until the eagle sits on this record's target grid slot: the column must match the record's
target column (+6) or the one just before it, and the row must fall inside a five-row window ending
at the record's target row (+4). On arrival it advances the record state and arms an animation —
odd records (bit 3 of the record's low address) take the sequence at `EAGLE_ODD_RECORD_ANIM`
**[code]** (0x7403) and a 0x38 speed byte in +9, even records take `EAGLE_EVEN_RECORD_ANIM`
**[code]** (0x4086), a 0x40 speed byte, and additionally bump `WAVE_RECORDS_ARRIVED`; when the
arrived count reaches `WAVE_INDEX` — the whole wave has landed — it queues a display command from
the base `WAVE_ARRIVAL_CMD_BASE` **[code]** (0x0630) offset by the arrived count. **Dive/climb**
(`loc_7395` **[code]**) integrates the record's 16-bit vertical position (+3 low, +4 row) by that
per-record speed each frame: even records descend, carrying a wrap up into the row and advancing
the record state once they pass the bottom row (0x1d); odd records climb, borrowing down through
the row and advancing once they rise past the top row (0x04). **Retire** (`loc_73ce` **[code]**)
zero-fills the whole 0x18-byte record and decrements `WAVE_RECORD_COUNT`; when the last record of
the wave retires it seeds `WAVE_HOLD_TIMER` to 0x30, throwing the driver back onto its idle branch.

The idle handler `loc_73e3` drains `WAVE_HOLD_TIMER` a step per frame; on expiry it enqueues a
wave sound/display command (opcode 0x06 carrying 0xb0 + `WAVE_INDEX`) while a wave index is still
set, reseeds the hold to 0x18, and clears `WAVE_LAUNCH_FLAG` so the driver seeds a fresh wave next
frame.

Running alongside the record driver is the approach/grid machine `loc_71ce` **[code]**, which
paints the eagle's progress across a marker grid and drives the player's aim indicator. It too is
gated by `WAVE_HOLD_TIMER`: while that is nonzero it just ticks it down. Once the hold clears it
updates the aim-indicator bits in `PLAYER_AIM_FLAGS` **[code]** (0x8a87) from an approach
coordinate against two thresholds — 0x59 (near) and 0x60 (far) — latching that coordinate into
`LATCHED_ENEMY_X` **[seen]** (0x8f5b) once it crosses the far threshold, and after the latch
showing "on target" rather than "below". When the coordinate sits exactly on the near threshold
it steps a three-way sub-phase through `WAVE_RECORDS_ARRIVED`: 0 → 1 clears the aim bits, anything
but 2 → 2 arms them, and 2 runs the grid-marker step. On that final sub-phase, once per eighth
frame (gated by `EAGLE_GRID_STEP_TICK` **[code]** (0x8f3b) low three bits), it stamps a marker
tile 0x2c into the grid region based at `EAGLE_GRID_VRAM_BASE` **[code]** (0x87e0) — its row from
the eagle grid column, its second axis and colour attribute derived from the record's +4/+6 fields
— and delegates the edge check to `loc_7287` **[code]**. That guard hands back the eagle's
advancing grid coordinate while it is short of the grid edge (0xd0); once it reaches the edge it
arms the done latch `EAGLE_FINISH_FLAG` **[code]** (0x8f3e) and runs the phase-reset epilogue
`advanceEaglePhaseAndClearAim` **[code]**, which drops `PLAYER_AIM_FLAGS` and `LATCHED_ENEMY_X`,
bumps `WAVE_OUTER_PHASE`, and clears `WAVE_RECORDS_ARRIVED` so the next phase starts fresh.

> WARNING: despite the "eagle X" / "enemy X" framing carried on the latched-X cell, the approach
> coordinate `loc_71ce` actually reads and compares against the two thresholds is the player-actor
> cell `PLAYER_Y` **[seen]** (0x8a84) — the mother's elevator height, which sweeps 0..225. The grid
> marker's own geometry is separately derived from `ENEMY_TARGET_REC0`'s +4/+6 fields. So the
> approach sub-phase advances on the *player's* vertical position reaching 0x59, not on an enemy
> coordinate; read the code, not the cell name here.

### The rope

The rope is grown by one machine and animated cell-by-cell by another. Both key off the same
running index and the same column table, so a rope of N segments is N cells that were each armed as
the rope extended down.

The extend driver dispatches on `ROPE_EXTEND_STATE` **[code]** (0x8f14) into two handlers. State 0
(`loc_2d80` **[code]**) adds one segment: it returns immediately once the segment count
`ROPE_SEGMENT_COUNT` **[seen]** (0x8931) has grown to two below the stage's arrival count
`WAVE_ARRIVAL_COUNTER` **[seen]** (0x8903), which is what bounds the rope's length per stage.
Otherwise it bumps `ROPE_SEGMENT_COUNT`, and — while the segment index `ROPE_EXTEND_INDEX`
**[code]** (0x8f18) is below four, or (at or past four) only if a tamper strike is pending in
`TAMPER_STRIKES_ROM` **[code]** (0x89ef) — advances that index, looks the segment's video-RAM
column low byte up from `ROPE_CELL_COLUMN_TABLE` **[code]** (0x2db8) and pairs it with the fixed
0x84 page into `ROPE_COLUMN_VRAM_PTR` **[code]** (0x8f19), reloads this segment's entry in the
per-cell timer block `ROPE_CELL_TIMERS` **[code]** (0x8f28, stride 2) to 0x10, advances the
sub-state to 1, and arms the sub-timer `ROPE_EXTEND_TIMER` **[code]** (0x8f16). State 1
(`loc_2dbc` **[code]**) is the rope-blit: it drains `ROPE_EXTEND_TIMER`, and on each expiry blits
one tile block at `ROPE_COLUMN_VRAM_PTR`, stepping a small run index from 0 up to 8; when that run
completes it clears the run index, drops `ROPE_EXTEND_STATE` back to 0 so the next segment can be
added, and marks the freshly-grown cell record active so the per-cell machine picks it up.

That per-cell machine (`loc_2e22`/`loc_2e36`, driving one one-byte cell record per active
segment) dispatches each cell's state, minus one, into four handlers, all of which share two
helpers: `loc_2e45` **[code]** ticks the cell's frame timer (selected by the low two bits of the
cell index, stride 2 from `ROPE_CELL_TIMERS`) and reports reached-zero, and `loc_2e52` **[code]**
rebuilds the video-RAM column base from `ROPE_CELL_COLUMN_TABLE` for the blit. **State 1**
(`loc_2e5e` **[code]**) fires only every fourth frame (`FRAME_COUNTER` **[seen]** (0x8a5f) low two
bits) and only on the frame its cell timer elapses: it finds a free slot in the spawn-object table
`SPAWN_OBJECT_TABLE` **[seen]** (0x8c48), reloads the cell timer with a round-scaled value derived
from `ROUND_COUNTER` **[seen]** (0x8907) and stashes the slot index in the timer's high byte, seeds
the object (state/anim/coords, its +4 field pulled from `ROPE_SPAWN_IY4_TABLE` **[code]** (0x2ec7)
keyed by the cell index), advances the cell state, and blits the segment tile from
`ROPE_SEGMENT_TILE_SRC` **[code]** (0x2dfe). **State 2** (`loc_2ecb` **[code]**) waits out the cell
timer, then writes a round-derived tile value back into the timer cell, indexes the formation table
`FORMATION_TABLE` **[seen]** (0x8c30) by the stored slot index to bump that record's tile field,
clear its position byte, and drop another field, advances the cell, and blits the alternate segment
tile `ROPE_SEGMENT_TILE_SRC_ALT` **[code]** (0x2e1e). **State 3** (`loc_2f01` **[code]**) is the
same shape but grab-gated: it first runs the rope-grab trigger test and abandons the whole cell
update if a grab fires; otherwise, on timer zero, it reloads the timer to 0x0c and adjusts the same
formation record in the opposite sense (drop the tile, force the position to 0xc0, bump the other
field) before advancing the cell and re-blitting the primary segment tile. **State 4**
(`loc_2f2f` **[code]**) is the retract: on the cell timer, and while segments remain, it picks a
retract animation from the table at 0x2f93 (keyed by `ROUND_COUNTER >> 2` clamped to 3, plus the
cabinet bit), reads a per-segment attribute byte, merges it into the paired cell, clears the
matching `FORMATION_TABLE` record, advances the cell, and blits the segment. Separately from the
segment count, `ROPE_DRAW_COUNT` **[seen]** (0x8934) tracks how many rope rows the sprite side
should draw, snapshotting the spawn phase.

### The arrow / launch sequence

The launch driver `loc_2778` **[code]** dispatches the low three bits of `LAUNCH_STATE` **[seen]**
(0x8f30) into five handlers, states 0 through 4, and each handler advances the state as it finishes.

State 0 (`loc_278f` **[code]**) arms and gates the shot. It sets the one-shot arm flag
`LAUNCH_ARMED_FLAG` **[seen]** (0x8f3f) once its preconditions hold — either the lane-spawn
countdown `LANE_SPAWN_COUNTDOWN` **[seen]** (0x8d75) is still running and the arm latch
`LAUNCH_ARM_LATCH` **[seen]** (0x8f20) is clear (in which case it bumps the latch), or the stage
countdown `STAGE_COUNTDOWN` **[seen]** (0x8901) is nonzero and a multiple of eight. It then returns
unless the arrow object has risen far enough — its Y `ARROW_Y` **[code]** (0x8ab4) at or above 0x3c
— and neither of the two enemy-target records (`ENEMY_TARGET_REC0`, `ENEMY_TARGET_REC1` **[seen]**
(0x8ca8)) has its hit bit set. Clearing those gates it advances the state, reseeds the flip
countdown `LAUNCH_FLIP_COUNTDOWN` **[code]** (0x892f) to 8, lights the HUD cell `LAUNCH_HUD_TILE`
**[code]** (0x8508) when the game is idle (`GAME_ACTIVE_FLAG` **[seen]** (0x8806) clear and either
`PLAY_MODE_LATCH` **[code]** (0x8f50) or the arm flag set), refreshes `LAUNCH_ARM_LATCH` from its
seed `LAUNCH_ARM_LATCH_SEED` **[code]** (0x8d7a), and blits the launch tile from `LAUNCH_TILE_SRC`
**[code]** (0x2d51) to `LAUNCH_TILE_VRAM` **[code]** (0x84a7).

State 1 (`loc_27f3` **[code]**) either animates the arrow or seeds a hunter. While `ARROW_Y` is at
or above 0x34 it drains `LAUNCH_FLIP_COUNTDOWN`, and each time that hits zero it reseeds it to 0x10,
steps the shared phase byte `SHARED_PHASE_COUNTDOWN` **[code]** (0x892e), and blits the arrow tile
from `LAUNCH_TILE_SRC` or its alternate `LAUNCH_TILE_SRC_ALT` **[code]** (0x2d55) chosen by that
byte's parity. Once the arrow has dropped below 0x34 it instead scans the two enemy-target records
for a free one; finding one it advances the launch state to 2, marks the record, queues a display
command, blits the alternate tile, may light the HUD cell, and seeds three of the record's fields.

State 2 (`loc_2856` **[code]**) seeds a new hunter. Unless `PLAY_MODE_LATCH` is set, it scans the
six-slot hunter table `HUNTER_TABLE_BASE` **[code]** (0x8c78) downward one stride (0x18) apart for
the first free slot (both leading bytes zero), bailing if none is free; a free slot is stamped with
its opening state, coordinates and tile ids, and its address is saved in `HUNTER_RECORD_PTR`
**[code]** (0x8f32). It then advances the launch state, and — when the flip flag
`HUNTER_SPAWN_FLIP_FLAG` **[code]** (0x8f61) is clear — seeds the spawn countdown
`HUNTER_SPAWN_COUNTDOWN` **[code]** (0x8f34) to 0x20 and enqueues the spawn display command
`HUNTER_SPAWN_DISPLAY_CMD` **[code]** (0x0315); when the flip flag is set it instead advances the
sub-counter `HUNTER_SPAWN_SUBCOUNTER` **[code]** (0x8f5d).

State 3 (`loc_28ad` **[code]**) is a hold: while `HUNTER_SPAWN_COUNTDOWN` is nonzero it just
decrements and returns; on expiry it advances the launch state and, unless `PLAY_MODE_LATCH` is
set, zero-fills the 0x18-byte record pointed to by `HUNTER_RECORD_PTR`. State 4 (`loc_28c5`
**[code]**) is a bare return — the idle terminal of the launch machine, holding until the state is
reset back to 0 elsewhere.

## Rendering, HUD and display lists

Everything the machine draws lands in one of two parallel planes of video RAM. The
tile-code plane starts at `PLAYFIELD_TILE_BASE` **[code]** (0x8402, the visible region running
through 0x87ff) and holds one tile index per screen cell, laid out 0x20 cells to a row so that
adding 0x20 to a cell pointer steps straight down and subtracting it steps up. Running underneath
it is the colour/attribute plane based at `ATTRIB_MAP_BASE` **[seen]** (0x8040 on the 0x8000 page),
one attribute byte per cell at the same 0x20 stride. Almost every routine in this section is a
short walk over one of those two planes at that stride; the interesting variety is in *what* the
walk paints and *how the source is chosen*. Moving objects are drawn through a third structure, the
sprite display list, and screen-wide layout changes are driven by two queued mechanisms — the
display-command ring and the display-list interpreter — described near the end.

### Clearing and filling the tile plane

A fresh board is painted blank one row at a time. `seedTileFillCursor` arms the job: it stores a
16-bit write cursor into `TILE_FILL_PTR` **[seen]** (0x880b) and seeds `FILL_ROW_COUNTER` **[seen]**
(0x8809) to 0x20 — thirty-two rows to go. `loc_02e3` is the fixed-origin entry that arms this from
`PLAYFIELD_TILE_BASE`. The fill then advances by exactly one row per pass: `loc_02ce` blanks `count`
cells at the cursor with blank tile 0x10, then walks the cursor a whole row forward (the `count`
cells it just wrote plus the 0x20-`count` remainder of the row), stores it back, and decrements the
row counter — returning drained/not-drained so a driver can keep calling it across frames until the
counter hits zero. `loc_02c9` is the board-init variant: it first zeroes the sprite/actor RAM
regions, then blanks the 0x1d *visible* cells of one row (the rest of the row is skipped as
remainder) and steps the counter the same way. This row-at-a-time discipline is why a screen wipe is
spread over many frames rather than blocking a single one.

The individual tile primitives are all leaf writers. `paintTileBlock2x2` stamps four source bytes
into a 2x2 cell (top-left, top-right, then one row down for bottom-right and bottom-left);
`paintTileBlock2x2Above` does the same square but anchored at its bottom-left with the top row one
tilemap row *above*. `blit2x2TileBlock` is the copy-order-`TL,TR,BR,BL` square used for rope and
launch graphics; it leaves its destination pointer advanced one row down so the two-tile animators
can step up a row before the next blit. `blitTile3x3Block` copies a 3x3 block, three source bytes
per row then +0x1d to reach the next screen row, advancing *both* its destination and its source so a
caller can chain the next glyph straight on. `blitGlyphBlock4x3` is the 4-row variant that bumps only
the destination's low byte within a row (the block never straddles a page) before the +0x1d row step.
`loc_0a52` is a convenience that stamps the same four-byte source pattern (`TILE_BLOCK_2X2_SRC`
**[code]**) into two anchors, `VRAM_TILE_BLOCK_DEST_A` **[code]** and `VRAM_TILE_BLOCK_DEST_B`
**[code]**.

Vertical columns get their own painters. `loc_02a8` stamps a three-tile column downward — cap tile
0x01, then `paintColumnBodyTiles` writes the mid body tile 0x25 and base tile 0x20 one stride apart.
`loc_1ce7` and its helper `paintColumnBodyTilesUp` do the mirror-image column going *up* from
`COLUMN_CAP_VRAM` **[code]** (cap 0x02, then mid/base one row up each). `blankTileColumn` erases a
three-cell column to blank tile 0x10 and hands back the advanced pointer so successive blank columns
chain. `loc_039b` paints the count column at `COUNT_COLUMN_VRAM` **[code]**: gated on
`GAME_ACTIVE_FLAG` **[seen]**, it fills (actor-table count + 1) cells clamped to the eight-cell
column with fill tile 0x0c and blanks the rest — a small vertical bar whose height tracks
`ACTOR_TABLE` **[seen]**. (Its fill loop is an exit-tested down-counter, so a zero height runs a full
256-cell pass, faithfully reproducing the hardware wrap.)

### Painting the colour/attribute plane

`fillAttributeColumns` floods the attribute plane column by column: for each of 31 columns it takes
one source byte and stamps it down all 30 rows at the 0x20 stride, the source pointer advancing one
byte per column. `loc_1dd3` is the playfield's colour driver and chooses which source table to flood
by the field variant. The default job floods from a round-parity source (`FIELD_ATTRIB_SRC_A`
**[code]** when `ROUND_COUNTER` **[seen]** is odd, `FIELD_ATTRIB_SRC_B` **[code]** when even) then
stamps a short two-column marker (columns 5-6, four rows, colour code 0x0f). The alternate job — taken
only when the round is idle-but-active on an even/first round and outside play-mode — floods
`FIELD_ATTRIB_SRC_C` **[code]** and stamps a taller single-column strip (sixteen rows, colour code
0x09). This is the only place the colour of the playfield changes between rounds.

### The sprite display list

Moving actors are drawn from a 24-entry, stride-4 list based at `SPRITE_DISPLAY_LIST` **[seen]**
(0x8840), rebuilt every frame from the object-record banks. `loc_02ef` is the rebuild driver. It
copies four record groups into the list in turn through two helpers. `copyObjectRecordsToDisplayList`
emits four *raw* record bytes per entry — record +0x06, +0x10, +0x04, +0x0f — advancing the list's
low byte alone so writes wrap inside its 256-byte page; it is used for the two lead actors (from
`ACTOR_TABLE`), the two enemy-target records (from `ENEMY_TARGET_REC0` **[seen]**), and the two
arrow/launch records. `loc_0343` handles the eighteen moving objects (from `ENEMY_ACTOR_TABLE`
**[seen]**) and does coordinate math: two of the four emitted bytes are screen coordinates derived
from a record's 16-bit sub-pixel position pairs — `(rec+6:rec+5)` and `(rec+4:rec+3)` — each reduced
`(pair >> 5) - 8` to a pixel coordinate, the other two copied raw. After the four groups are laid
down, `loc_02ef` nudges the arrow group's two sprite-Y bytes down one pixel each and hands the second
to `loc_0320`, which ticks that byte and, when the screen-orientation flag is zero, mirrors the whole
list. That mirror is `mirrorSpriteListVertically`: it walks the stride-4 list negating-and-offsetting
each entry's two coordinate bytes (`-x - 0x10`) and toggling the two flip bits of the attribute byte
while preserving its low nibble. `loc_09f8` is the companion that steps four object records'
animations before triggering a rebuild.

The player is special-cased: it is drawn as three vertically stacked sprites, and
`deriveStackedSpriteYs` fans its base Y (`PLAYER_Y` **[seen]**) out to the three stacked slots — the
bottom slot gets the base Y, the middle Y-0x10, the top Y-0x10+0x0a — so the three-sprite stack moves
as one.

### The display-command ring and the display-list interpreter

Screen changes that must happen *later* (or from a context that should not draw inline) are queued as
two-byte commands. `loc_0038` enqueues one into a ring on page 0x88 addressed by
`DISPLAY_CMD_RING_WRITE_PTR` **[code]** (0x88a0): if the pointed slot is free (bit 7 set) it stores
the command's high byte there and its low byte in the next slot, advances the write pointer by two,
and wraps back to ring start 0xc0 once it drops below it; an occupied slot silently drops the command.
The main loop drains this ring and dispatches each queued command to a handler — many of the
rendering routines in this section are those handlers, and `loc_0e53` is the deliberate no-op handler
(a bare return) that a command can target to draw nothing.

The heavier layout work goes through `loc_4381`, the display-list interpreter. It picks a
destination/source pointer pair — the primary pair `DISPLAY_LIST_DST_PTR` **[seen]** /
`DISPLAY_LIST_SRC_PTR` **[seen]**, or the alternate pair `DISPLAY_LIST_DST_PTR_ALT` **[code]** /
`DISPLAY_LIST_SRC_PTR_ALT` **[code]** when `FORMATION_SLOT_TABLE` **[seen]** is nonzero — then walks
up to 0x1d source bytes interpreting a tiny opcode stream. A plain byte is copied to the destination
and both pointers step one; a 0x10 skip opcode advances the destination by the following byte and
shrinks the remaining budget; a 0xff reload opcode loads a fresh destination pointer from the stream
and folds the next byte into `SUBPHASE_TICK` **[seen]**. On exit the advanced pointer pair is written
back to whichever pair was chosen, so a long layout streams across successive calls. This is how
banner and layout strips get blitted incrementally without re-specifying their whole run each frame.

### HUD number primitives

The score/panel HUD is packed BCD throughout, so a small stack of digit primitives underlies every
numeric field. `byteToPackedBcd` converts a binary byte to packed BCD (value mod 100) the way the Z80
does — repeated decimal-adjusted adds — and `binToPackedBcd` converts a binary *count* to the low two
BCD digits plus a hundreds tally (a zero count meaning a full 256-pass wrap, giving 0x56 with hundreds
2). On the paint side, `splitBcdByte` writes a byte's low nibble as a digit tile at the cursor,
advances, and hands back the high nibble (with a zero-high test for leading-zero suppression);
`renderDigitWithBlanking` paints one digit while threading a "blank budget" that turns leading zeros
into blank tile 0x10 until the first real digit is seen; and `drawStackedBcdDigits` paints a packed
byte as two stacked tiles — tens at the cursor, units one row up — again blanking a zero tens digit.
`selectActivePlayerScoreBuffer` picks which 3-byte score buffer the digit code reads,
`P1_SCORE_BCD` **[seen]** or `P2_SCORE_BCD` **[seen]**, off bit 0 of `ACTIVE_PLAYER` **[seen]**.

### The score, high-score and panel fields

`loc_056b` draws one of three packed-BCD counters down a screen column: the selector picks player 1,
player 2, or the high score (`P1_SCORE_BCD` / `P2_SCORE_BCD` / `HIGH_SCORE_BCD_HI` **[seen]**) and its
column (`P1_SCORE_VRAM` **[code]** / `P2_SCORE_VRAM` **[code]** / `HIGH_SCORE_VRAM` **[code]**), then
paints each of the three source bytes as a high-then-low digit one cell apart up the column with a
shared blank budget of 4. `loc_0552` is the reset-and-repaint sibling: it zeroes the selected 3-byte
counter (`HIGH_SCORE_BCD` **[code]** for the high-score case) and repaints it, so the freshly-cleared
counter shows four blanks and two zeros.

The attract screen's whole HUD is assembled by `loc_03e9`. It first draws eleven consecutive
character fields through `loc_05b2`, then renders the ten-entry high-score table: reading three-byte
rows from `HIGH_SCORE_TABLE` **[code]** it splits each byte into low-then-high digit tiles a row apart
into `HIGH_SCORE_TABLE_VRAM` **[code]**, suppressing the top digit's leading zero and re-basing the
column two cells right per row. Finally it repaints the digit panel (`loc_0439`) and the status panel
(`renderPanelFromTable`). `loc_05b2` itself is the general field painter: the selector's low seven
bits (doubled) index the pointer table `FIELD_RECORD_PTR_TABLE` **[code]**, whose entry heads a list
of records — each a two-byte destination followed by an inline string — drawn bottom-up one row per
character; bit 7 of the selector chooses digit mode (character - '0') versus blank-fill, a '.' ends a
record, and a '?' ends the whole run. `loc_0439` renders ten rows of the packed-BCD digit panel from
`PANEL_DIGIT_SOURCE_TABLE` **[code]** into `PANEL_DIGIT_VRAM_DEST` **[code]** (two digit pairs per row
around a fixed separator tile 0x51, second pair leading-zero suppressed). `renderPanelFromTable`
paints the status panel: ten rows of three cells from `PANEL_TILE_SOURCE` **[code]** into
`PANEL_VRAM_DEST` **[seen]**, a zero source cell drawing blank tile 0x40, the first two cells of each
row climbing a row and the third re-basing forward to the next column.

`loc_05ee` draws the credit count: it paints the credit field, then reads `CREDIT_COUNT` **[seen]**
clamped to 99, converts to packed BCD, and writes the tens tile to `CREDIT_HUD_TENS_VRAM` **[code]**
(skipped when zero) and the units tile to `CREDIT_HUD_UNITS_VRAM` **[code]**. Only when the units
digit happens to be exactly 2 does it sum a fixed 31-byte program block and bump an anti-tamper strike
counter on a mismatch — a tripwire hidden inside an innocuous HUD paint. (Warning: the credit paint is
the *only* observable effect on the common path; the checksum arm is a rare side branch, not the
routine's purpose.)

### Stage, timer and gauge readouts

`renderStageCountdownDigits` draws the stage-countdown number as a two-cell HUD field from
`STAGE_COUNTDOWN` **[seen]**: a value under ten is one digit as-is, ten or more converts to packed BCD
first (that two-digit path draws nothing while `PLAY_MODE_LATCH` **[code]** is held), writing the units
nibble to `HUD_STAGE_DIGIT_LO` **[seen]** and, unless zero, the tens one row over.

The play timer is nibble-rendered inside `loc_7960`, the shared integrity-plus-timer handler. Around a
pair of ROM checksum guards it splits the active player's timer minutes and seconds BCD bytes (from
`PLAY_TIMER_BCD_P1` **[code]** or `PLAY_TIMER_BCD_P2` **[code]**) into hi/lo nibble tiles up the column
at `PLAY_TIMER_DIGIT_VRAM` **[code]**, wedging a spacer tile 0x51 between minutes and seconds, then
clears the three timer bytes it just drew. A flag scan afterward can divert to a tail checksum whose
high-byte miss repaints the phase gauge via `loc_1a85` instead of tripping.

The phase gauge is a five-cell vertical bar. `renderPhaseGauge` (and its identical twin
`paintPhaseGauge`) reads `GAUGE_PHASE_COUNTER` **[seen]**: a zero count leaves the gauge as-is,
otherwise (count - 1) cells clamped to five are drawn with filled tile 0xb0 from
`PHASE_GAUGE_BASE_TILE` **[seen]** upward and the rest with blank tile 0x10 — so the bar shrinks as
the phase drains. `loc_1a85` wraps that redraw with a play-sub-state store, and `loc_18da` drives the
bonus-award tally that *fills* the same gauge counter: an empty `AWARD_QUEUE` **[code]** reloads its
threshold, otherwise when the active player's score MSB reaches the queued value it bumps the
saturating gauge counter, BCD-steps the queue to its next threshold, and redraws the gauge.

`loc_10c2` is a compound HUD updater: it walks a counter toward a new value one step at a time, stores
it in `SUBSTATE_FIELD1_COUNTER` **[code]**, and repaints three stacked-BCD fields — field 1 (double
the counter) at `SUBSTATE_FIELD1_VRAM` **[code]**, field 2 from `SUBSTATE_FIELD2_VALUE` **[code]**
(drawn raw when a single digit, else re-encoded), and field 3 from `SUBSTATE_FIELD3_VALUE` **[code]**
when nonzero (drawn doubled, its source also folded into the counter) — then advances
`MAINLOOP_SUBSTATE_SELECTOR` **[code]** and queues a sound cue.

### The round marker

`loc_4a0b` draws the round marker, gated on bit 0 of `ROUND_COUNTER`. It snapshots
`SPAWN_PHASE_COUNTER` **[seen]** into two mirror cells (`ROPE_DRAW_COUNT` **[seen]** among them), then
for a nonzero count paints that many stacked pairs of a two-wide marker (tiles 0xda/0xdb over
0xd8/0xd9) up a column from `MARKER_VRAM_BASE` **[code]**, saves the column layout pointer, and stamps
the 3x3 marker glyph block below it; a zero count saves the alternate layout pointer and stamps the
glyph at the fixed anchor. This is the on-screen count of rope/lift segments for the round.

### Glyph blocks

`loc_1ffb` renders one of two fixed 3x3 glyph sources into the tilemap — bit 5 of its selector picks
`GLYPH_TILES_A` **[code]** or `GLYPH_TILES_B` **[code]** — stamping into `GLYPH_BLOCK_DEST` **[code]**
through `blitTile3x3Block`. These are the small pictorial glyphs (as opposed to the digit/character
fields), and the round marker above reuses the same 3x3 block primitive for its glyph.

### Playfield tile-strip animation and the scroll worker

A short strip of the tile plane animates continuously by cycling tile codes, split across even and
odd frames so the two halves never fight. Both halves bump `TILE_ANIM_PARITY` **[seen]** every call
and act only on their frame. `advanceTileAnimForwardOnOdd` runs on odd frames: at the wrap tile code
0x37 it steps the cursor at `TILE_ANIM_CURSOR` **[seen]** forward one cell and reseeds it to 0x34,
otherwise it bumps the current cell's tile code up by one. `retreatTileAnimScript` runs on even
frames: at marker 0x34 it reloads the cell to base 0x10 and steps the cursor back one, otherwise it
decrements the tile code in place. The net effect is a tile strip that marches a value up on one
parity and unwinds it on the other.

Finally, `loc_0254` is the per-frame worker the main state driver runs. When the control byte
`WORKER_CONTROL_BYTE` **[code]** has its low nibble set it only runs a program-signature check;
otherwise, while a game is active, it repaints two three-tile scroll columns — four blank columns
then the shared worker column in one-player mode, or a capped body column in two-player mode
(`TWO_PLAYER_FLAG` **[seen]** selects), stamping the second column at `WORKER_COLUMN_VRAM` **[code]**
via `loc_02a8` — and, when the control byte's bit 4 and the game-active bit are both set, blanks one
more column (the worker column for player 1, the cap column otherwise). Every column here steps one
tilemap row up per cell.

## Sound

All audio leaves the main CPU through a single hardware handshake, and almost all of it is
buffered on the way there. The handshake lives in `sendSoundCommand`: it writes the command
byte into `SOUND_COMMAND_LATCH` **[seen]** (0xa100), the port the audio CPU samples, then pulses
`AUDIO_IRQ_LATCH` **[seen]** (0xa181) high and immediately back low. That rising edge is what
interrupts the sound processor into reading the latch; the width of the pulse is pure hardware
settling time and carries no state of its own, so the emitter is just three memory writes — set
the byte, raise the strobe, drop it. Nothing is returned; the effect is entirely in the two ports.
Boot uses this path bare, handing command 0 straight to `sendSoundCommand` to silence the audio
CPU before the game comes up.

Between the game logic and that emitter sits one command ring, carved out of the top of the
0x8a00 page — the same page whose base holds the high-score table `HIGH_SCORE_TABLE` **[code]**
(0x8a00). The ring proper is `SOUND_RING_BUFFER` **[code]**, the 28 slots 0x8a43-0x8a5e, with a
write cursor `SOUND_RING_WRITE_PTR` **[code]** (0x8a40) and a read cursor `SOUND_RING_READ_PTR`
**[code]** (0x8a41) that both hold a low-byte slot index in the range 0x43..0x5e. Boot lays the
ring out empty: it fills all 28 slots with the 0xff sentinel, seats both cursors at the first slot
0x43, and separately seeds the standalone cell at 0x8a42 to 8 (its exact role is not evident from
the code). Emptiness is tracked per slot by that 0xff marker rather than by comparing the two
cursors, which matters for how draining works below.

Producers push into the ring through two enqueue helpers that share the one write cursor, so
whatever they emit interleaves into a single stream. `loc_0eb3` **[code]** is the plain path: it
stores the command byte into the slot the write cursor names (0x8a00 + cursor), then advances the
cursor, wrapping 0x5e back to 0x43. It is ungated — the byte always lands. `loc_0ea2` **[code]** is
the guarded path used for text- and tile-run bytes as well as some conditional effects: it first
stashes the incoming byte in `TEXT_RING_PENDING_BYTE` **[code]** (0x8d20), then appends only while a
game is in progress (`GAME_ACTIVE_FLAG` **[seen]**, 0x8806) or the `PLAY_MODE_LATCH` **[code]**
(0x8f50) is set; when both are clear it drops the byte and returns 0. On the append path it writes
into the same slot, advances and wraps the same cursor, and hands the advanced cursor value back to
its caller — the one helper whose result is read downstream.

Above those two helpers is a broad family of fixed-command wrappers, one per audio event. Each
names a constant byte and pushes it through one of the enqueue helpers — for example the selectors
that queue command 0x00 (silence), 0x01, 0x02, and so on up through the tile-run codes. Some emit
more than one byte in a single call (two commands, or a mix such as a text tile plus a run of tile
codes), and a few gate themselves before appending — the 0x04 wrapper `loc_0ee3` **[code]** drops
its command while a wave is tearing down (`WAVE_TEARDOWN_STATE` **[seen]**, 0x8f24) or a grab is in
progress (`GRAB_ACTIVE_FLAG` **[seen]**, 0x8d32). One wrapper, `loc_0f09` **[code]**, is the odd
one out: it bypasses the ring entirely and hands its preset command 0x0b straight to
`sendSoundCommand`, the same direct-to-latch route boot uses.

The ring is emptied by `loc_0e64` **[code]**, which consumes one entry per call. It reads the slot
at the read cursor; if that slot still holds the 0xff sentinel the ring is empty and it returns
having done nothing. Otherwise it decides whether the byte is actually audible: it stays silent only
when the game is idle in a machine with demo sounds switched off — that is, when both bit 0 of
`DEMO_SOUNDS_DSW` **[code]** (0x8821) is clear and `GAME_ACTIVE_FLAG` is 0. When either condition
holds it forwards the byte to `sendSoundCommand`, latching it and strobing the audio IRQ. Either
way — sent or silently dropped — it then frees the slot by writing 0xff back over it and advances
the read cursor, wrapping 0x5e to 0x43. So a queued command is always consumed on the next drain
pass; the demo/idle gate only decides whether it is heard, never whether the slot is released.

One consequence of the sentinel scheme is worth flagging as it stands: the enqueue side does not
check that the slot it is about to write is still free before storing into it. Emptiness is read
only on the drain side. A producer that laps the drain — filling faster than one entry is consumed
per pass — would overwrite a queued-but-unplayed command, and because the write and read cursors are
never compared, nothing in this code detects that overrun.

## Anti-tamper

Pooyan carries an unusually dense mesh of self-checks. Scattered through the boot path, the
attract loop, the per-frame drivers and even the credit-drawing HUD, more than two dozen routines
re-read the game's own ROM (and, in a few cases, its live video RAM) and re-derive a checksum that
an intact image is tuned to produce. None of them ever touches memory when the check passes: every
guard is written so that a clean image falls straight through, and the raising of a flag, the bump
of a counter, the throw or the RAM wipe happens **only on a mismatch**. That invariant is what
makes the whole family legible — a durable write from any of these routines is, by construction,
evidence that the program image was altered.

The responses fall into three grades of severity. The mildest raise a **strike counter** or a
**flag** and return; downstream code samples those later and quietly degrades the game (freezing
spawns, blanking input, diverting into a reset). The middle grade **traps** — the frozen code
answered a mismatch by branching into unreachable data, which is modelled here as a thrown
integrity error, a path a valid ROM never reaches. The harshest **wipe work RAM forward from its
base**, bricking the run outright. The same checksum arithmetic recurs across all three, so the
family is best understood by first cataloguing the flags, then the arithmetic idioms, then the
detonation.

### The flags and strike counters

There is no single tamper flag; the guards deliberately raise a spread of them, so that no one
patch to a single cell can silence the whole mesh.

The **program-signature** lane centres on `SIGNATURE_MISMATCH_FLAG` **[code]**. The dedicated
sampler `verifyRomSignature` sets it to 1, and the actor-embedded check in `loc_3865` bumps it; its
principal consumer is `loc_6523`, which seats a fresh object record only while the flag is clear —
hold it, and new objects silently stop spawning. A parallel strike counter, `TAMPER_STRIKES_SIG`
**[code]**, is bumped independently by `loc_1bcc` and by `loc_4103`.

The **strike-counter bank** is a contiguous seven-byte integrity table based at
`INTEGRITY_FLAG_SCAN_BASE` **[code]** (0x89e7). Its slots are the tamper tallies raised by the
running self-checks: `TAMPER_STRIKES_SLOTSWEEP` **[code]** (0x89e8, one slot in) and
`TAMPER_STRIKES_STATE0` **[code]** (0x89ed, the last slot) live inside it, with
`TAMPER_STRIKES_ROM` **[code]** (0x89ef) sitting just past its end. Three more counters —
`TAMPER_STRIKES_SIG` (0x8a38), `TAMPER_STRIKES_STATE10` **[code]** (0x8a39) and
`TAMPER_STRIKES_HUD_GUARD` **[code]** (0x8a3c) — form a second cluster. What makes the seven-byte
table load-bearing is that `loc_7960` scans it every play frame: after rendering the timer it walks
all seven bytes and, on the first nonzero one, diverts into a tail-integrity checksum (below)
instead of returning cleanly. A single accumulated strike is therefore enough to change the play
handler's control flow.

The **freeze flags** are the counters that gate whole subsystems. `TAMPER_FREEZE_FLAG` **[code]**
(0x881e) is bumped by `loc_1b43` and by `flagTamperOnRound5ChecksumMiss`; while nonzero it freezes
spawns, aborts actor updates and skips HUD setup. `TAMPER_OBJECT_FREEZE_FLAG` **[code]** (0x89fb)
is read by the per-frame input sampler `loc_1e55`, which — the instant that flag (or the ordinary
board-clear flag) is set — zeroes the player's aim byte, killing control; it is cleared back down
by the board/HUD reset in `loc_2527`. `TAMPER_STRIKES_TERMINATOR` **[code]** (0x8df9) is bumped by
the terminator match-scan `loc_64be`; the tile-copy routine `loc_2514` ORs it with the board-clear
flag and, if either is set, tails into the board/HUD reset rather than continuing play.

Two more flags stand apart. `HISCORE_TABLE_CORRUPT_FLAG` **[code]** (0x8df8) guards the saved
high-score table, and `TAMPER_ROM_CHECK_FLAG` **[code]** (0x882b) is the eagle-spawn ROM-check
result. **Warning:** 0x882b is multiplexed — one path writes a 0x07 there as a state index and
another reads it as a coordinate low byte — so its value is meaningful as a tamper flag *only* in
the window between `verifyTableChecksum` raising it and its check being read; do not read a stray
nonzero at 0x882b as proof of tampering out of context.

### The checksum idioms

Four distinct arithmetic shapes recur, each tuned so the intact image lands on a sentinel.

**Byte-sum with a bit-pattern sentinel.** `verifyRomChecksum` (the state-10 guard) sums sixteen
read-only bytes descending from `ROM_CHECKSUM_TOP` **[code]** into a single byte and inspects its
*shape* rather than a fixed value: a healthy image has bit 0 clear, bit 5 set and bit 7 set, and
any other shape bumps `TAMPER_STRIKES_STATE10`. `loc_7e6d` does the same trick over a variable-length
span — summing downward from `TAMPER_CKSUM_TOP_ADDR` **[code]** to a 0x34 terminator byte while
tallying carries — and treats any bit of the mask 0xb0 set in (carries + sum) as tampering, bumping
`TAMPER_STRIKES_ROM`; it is armed only when player 1 has four or more lives and the frame counter is
at its zero crossing. `loc_3865` folds backward from `ACTOR_TAMPER_CKSUM_TOP` **[code]** to a 0x1a
terminator and masks (carries + sum) with 0x9e before bumping the signature flag, again only on the
frame-counter zero crossing. `loc_3266` (hunter-formation state 2) is the plainest: sum 0x20 bytes
up from `FORMATION_GUARD_BASE` **[code]** and demand the sentinel 0xdc, trapping otherwise.

**Sixteen-bit low/carry sum against a stored word.** Here the running total is split into a low byte
and a count of eight-bit carries, and both halves must match. `verifyTableChecksum` sums a
caller-sized block and requires high 0x1d, low 0xc1, raising `TAMPER_ROM_CHECK_FLAG` on any other
total. `loc_79e9` sums a fixed routine forward from `SELFCHECK_ROUTINE_BASE_ADDR` **[code]** until
its terminating 0xc9 return opcode and compares both bytes against `TAIL_CHECKSUM_GUARD` **[code]**;
a low-byte miss is an outright trap (unreachable with intact bytes) while a high-byte miss diverts
to the phase-gauge path. `loc_7960` runs the richest version: it folds `INTEGRITY_CHECKSUM_CODE_BLOCK`
**[code]** (0x5b bytes) into a 16-bit sum *plus* a second sum taken only at even offsets, and matches
all four resulting bytes against the four guard bytes that trail the block; a mismatch traps. Its
divert branch then sums from the first set integrity flag to a 0xc9 sentinel and checks the result
against `TAIL_CHECKSUM_GUARD` — low-byte miss traps, high-byte miss repaints the gauge. The gated
slot sweep `loc_52f6` folds a 23-byte code window down from `SLOT_SWEEP_CKSUM_BASE` **[code]** and
demands low 0x15 / high 0x09, bumping `TAMPER_STRIKES_SLOTSWEEP` otherwise; it runs at most once per
arming (latched by `SLOT_SWEEP_LATCH` **[code]**) and only after it has counted at least four free
enemy slots.

**Masked / nibble folds.** Several guards mask each byte before accumulating, which makes the
sentinel harder to reverse-engineer from a listing. `loc_1b43` masks each of 34 bytes from
`TAMPER_CKSUM_BASE_5593` **[code]** with 0x37, rotates right through carry, and adds-with-carry into
the accumulator; anything but 0x7c bumps `TAMPER_FREEZE_FLAG`. `loc_1bcc` folds the low five bits of
fourteen bytes from `TAMPER_CHECKSUM_CODE_BASE` **[code]** — and, counterintuitively, seeds the sum
not from zero but from the advanced pointer left behind by its bank copy — demanding the word 0x8a60
before it declines to bump `TAMPER_STRIKES_SIG`. `loc_4103` sums the low nibbles of 56 bytes from
`TAMPER_NIBBLE_SUM_BLOCK` **[code]** and requires low total 0x67 with exactly one carry, bumping the
signature strike otherwise, again only on the frame-counter zero crossing. `flagTamperOnRound5ChecksumMiss`
sums six program bytes and demands that (low sum + carry count + a 0x7f bias) wrap to zero, bumping
`TAMPER_FREEZE_FLAG` on a miss; it is armed **only** when `ROUND_COUNTER` **[seen]** reads exactly 5.
`flagHighScoreTableCorruptOnChecksumMiss` first requires a 0xc8 header byte at `HISCORE_CHECKSUM_BASE`
**[seen]**, then sums the four-byte block and requires (sum minus carry count) to equal 0x59, raising
`HISCORE_TABLE_CORRUPT_FLAG` on a bad header or a wrong total. `loc_05ee` hides its tripwire behind
the credit HUD: it draws the credit digits and only when the units digit is exactly 2 sums 31 bytes
down from `HUD_GUARD_CKSUM_TOP` **[code]**, demanding sentinel 0x8c before it declines to bump
`TAMPER_STRIKES_HUD_GUARD`.

**Plain 8-bit sum against a value.** The simplest guards just want a fixed total. `loc_3be3`, on the
gated lane reset, sums 0x12 bytes descending from `STATE0_CKSUM_BASE` **[code]** and requires 0x55,
bumping `TAMPER_STRIKES_STATE0` otherwise — but only while the screen is upright and the stage
countdown is still low. `loc_08e9` (attract sub-state 1) straddles its colour-map flood with two
such guards: 0x20 bytes from `FIELD_ATTRIB_SRC_C` **[code]** must sum to 0x63, and nine bytes from
`ATTRACT_INTEGRITY_CKSUM_BASE` **[code]** must sum to 0xaa, each trapping on a miss. `loc_2a01`
(actor state 2) sums 0x20 bytes from `FIELD_ATTRIB_SRC_A` **[code]** and requires a total of 1; a
miss tail-jumps the hunter guard instead of running the state's normal epilogue.

### The copy-compares and the region checksums

A second style of guard skips arithmetic and instead compares a live block **byte for byte against
a verbatim reference copy** stashed elsewhere in ROM. `loc_6f9d` (level-intro phase 4) compares 0x44
bytes of `PHASE4_TAMPER_ORIG` **[code]** against its data copy `PHASE4_TAMPER_COPY` **[code]**; a
full match queues a sound and a display command (the phase-4 match command), while any mismatch wipes
work RAM forward. `loc_30f1` (hunter-formation launch) compares its self-check routine at
`SELFCHECK_ROUTINE_BASE_ADDR` against the copy at `TAMPER_COPY_3278` **[code]** — first validating a
two-byte pointer header, then the body — and wipes work RAM on any divergence. `loc_744e`
(attract/self-test state 0) runs a two-stage program-signature compare: eight boot bytes from
`BOOT_CODE_BASE` **[code]** against `SELFTEST_REF_COPY_BOOT` **[code]**, then a 0x74-byte program
window from `SELFTEST_LOOP2_SCAN_BASE` **[code]** — the reference pointer carrying straight on from
the first loop into the second — with a loop-2 divergence aborting into the screen re-init handler.
The terminator match-scan `loc_64be` walks a descending memory span against an ascending table until
a byte differs or a table byte decrements to zero, bumping `TAMPER_STRIKES_TERMINATOR` on the
mismatch exit.

Two guards check the picture itself rather than the code. `loc_68ac` runs once (guarded by
`TILE_CHECKSUM_LATCH` **[code]**): it sums the playfield tilemap region from `PLAYFIELD_TILE_BASE`
**[code]**, walking a 29-cell column, skipping a three-cell gap between rows and stepping pages until
the high byte reaches 0x88, keeping the total as a low byte and a wrap count. The low byte is looked
up in `TILE_CHECKSUM_TABLE` **[code]**; a miss is a tamper trap, and on a hit the wrap count must
match the table's paired entry or it is another trap. `loc_6a7f` performs a similar tilemap sum but
only on wave index 2 and only once per pass (latched by `TILE_SUM_ONCE_LATCH` **[code]**), demanding
the fixed total 0x29b8 and throwing on any other — a mismatch here is only reachable once work RAM
has already been corrupted. `loc_67df` sums ten colour-map cells one row apart from
`HUD_INTEGRITY_STRIP_A` **[code]**; only on the clean sentinel 0x5a does it proceed to arm a fresh
screen (clearing the arena and painting the playfield), and on any other sum it silently hands off
to the per-object frame updater instead.

### Where the checks live and how they detonate

The guards are deliberately staggered across the machine's phases so a tampered image survives no
single code path for long. Some are inline in the attract loop (`loc_08e9`, `loc_744e`), some in the
per-frame scroll worker (`loc_0254` runs `verifyRomSignature` whenever its control byte's low nibble
is set), some ride inside actor state handlers (`loc_3865`, `loc_3be3`, `loc_4103`, `loc_2a01`), and
several are armed only under narrow conditions — round 5, four-plus lives at the frame zero crossing,
a credit units digit of 2, wave 2 — so that a casual patch may pass the first hundred checks and
still be caught minutes later. (One cell, `INTRO_DELAY_CKSUM_WORD` **[seen]** at 0x8f48, even
double-books its bytes: it is the intro-phase delay timer at some moments and an anti-tamper
column-checksum pointer at others.)

The detonation is correspondingly graded. The silent counters (`TAMPER_STRIKES_*`) and flags
accumulate and are read later — `loc_7960`'s seven-flag scan diverts the play handler,
`SIGNATURE_MISMATCH_FLAG` starves the object spawner via `loc_6523`, `TAMPER_FREEZE_FLAG` freezes
spawns and skips HUD setup, `TAMPER_OBJECT_FREEZE_FLAG` blanks input through `loc_1e55`, and
`TAMPER_STRIKES_TERMINATOR` diverts `loc_2514` into a board reset — so the game degrades rather than
halts, which is harder for a tamperer to localise. The traps (`loc_3266`, `loc_08e9`, `loc_6a7f`,
`loc_68ac`, `loc_7960`, `loc_79e9`) mark control paths that a valid ROM cannot reach. And the two
copy-compare guards that wipe work RAM (`loc_6f9d`, `loc_30f1`) are the scorched-earth end of the
spectrum, zeroing memory forward until the run cannot continue. In every case the intact image is
left untouched.

## Open questions

These are the roles the current code cannot settle on its own; each needs MAME grounding or a routine
that is not yet decompiled.

- **The rst-0x28 dispatcher spine is the bulk of the remaining unlifted code.** The object/state
  dispatchers (0x40d0, 0x6822, 0x76f4-via-0x7707, 0x71b9) and the boot/attract dispatchers (0x0899,
  0x0fd5, 0x15a1, 0x7442, 0x7e94), plus several mid-routine dispatch sites, route through inline word
  tables; their handler sub-trees are reached through those tables rather than direct calls, so they
  are grounded and lifted last.
- **Most page-0x8d and page-0x8f cluster cells are [code], not [seen].** The actor/aim/wave working
  cells are read consistently from the routines that touch them but have not been watched under MAME.
- **Sprite double-bank.** The vblank service writes the same column-group data to both sprite banks
  (0x9000 and 0x9400); which bank the hardware displays, and whether it ping-pongs, is a display-select
  concern not decidable from the CPU code alone.
- **The audio CPU's consumption is out of scope.** The command latch write and the audio IRQ path are
  confirmed, but the second CPU's playback is recorded, not modelled.
- **A few config cross-references are unpinned** — e.g. IN0 at 0xA080 (derived from the memory-map
  decode and the NMI read, not a named const) and the exact body of the coinage service at 0x59e8.
