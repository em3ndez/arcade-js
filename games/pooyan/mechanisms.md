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
(`dispatchAttractSubstate`), a minor state, the play handler (`runPlayStateFrame`), and a
no-op state (`noopStateHandler`). Whichever handler runs returns into the service routine's
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

Two things run at once on this machine: a foreground loop that free-runs from the moment boot
finishes, and a vblank interrupt that preempts it once per displayed frame. The interrupt is the
heartbeat — it is where the game actually advances — while the foreground loop does the steady,
lower-priority work of pushing queued drawing into video memory and keeping the scroll layer painted.
Nothing in the ROM waits on the beam; the loop simply keeps working until the vblank interrupt fires
and takes over.

### Coming up from reset

Power-on enters at the reset vector loc_0000. Its first act is defensive: it clears the vblank-NMI
enable latch NMI_ENABLE_LATCH [code] so that no interrupt can arrive while memory is still
uninitialised, then jumps straight into the boot entry loc_0092 [code].

Boot is a single long straight-line pass. It kicks the watchdog, sets the stack, and runs a
program-memory self-test that sums each 4 KB ROM bank and compares the checksum against a reference
table, tallying the passes. It then clears and seeds work RAM — the display and sound rings, the
HUD tiles, and the difficulty and coinage values decoded from the DIP switches — and once that
groundwork is laid it writes NMI_ENABLE_LATCH [code] back on, permitting the vblank interrupt. A
final tail of seeds still follows the re-arm — the high-score table at HIGH_SCORE_TABLE [code], the
default top-score value at HIGH_SCORE_BCD_HI [seen], and a cleared run at PANEL_DIGIT_SOURCE_TABLE
[code] — after which boot falls into the main loop and never returns.

### The free-running foreground loop

The main loop mainLoop [code] is a state driver built around the display-command ring. A read cursor
DISPLAY_CMD_RING_READ_PTR [code] walks the two-byte slots of the ring buffer DISPLAY_CMD_RING_BUFFER
[code], whose slots are filled in by the write pointer DISPLAY_CMD_RING_WRITE_PTR [code] as other code
enqueues drawing work. Each pass reads the command byte the cursor points at and tests its top bit. When the bit is clear the
slot holds a real display command: the loop marks both bytes of the slot free — writing 0xFF over the
command byte and its argument byte — takes the argument out for the handler, advances the read cursor by
two past both bytes, wrapping back to 0xC0 when it would run past the end of the 0xC0-0xFF window, and
dispatches the command's handler to paint into video memory. When the bit is set the slot
is empty — the ring has drained — and the loop instead runs the per-frame scroll worker loc_0254
[code], which repaints the scrolling tile columns (or, when the worker control byte
WORKER_CONTROL_BYTE [code] asks for it, runs a program-signature integrity check) and loops back.

The consequence is that the entire queue of drawing commands is emptied within a single sweep rather
than one command per frame, and once the ring is empty the loop marks time by re-running the scroll
worker over the idle ring — effectively idling on the display layer until the vblank interrupt arrives
to advance the game.

### The vblank interrupt: the heartbeat

Once per displayed frame, at the vblank point, the CPU takes the non-maskable interrupt — but only
while NMI_ENABLE_LATCH [code] is set, the hardware gate boot switched on. The interrupt lands at the
fixed vector loc_0066, which is nothing but a jump into the real service routine loc_066d.

That routine is the frame's real work. It first saves the entire register file — main set, shadow set,
and both index registers — then immediately clears NMI_ENABLE_LATCH [code] so the service cannot
re-enter itself mid-frame. It refreshes the sprite/display hardware regions by running the
sprite-attribute copy loop loc_0714 [code] over either one block or four, the choice made by the play
sub-state PLAY_STATE_INDEX [seen], and kicks the watchdog.

It then samples the controls. The three hardware input ports — the coin/start port, the player-1 port
IN1_PORT [code], and the player-2 port IN2_PORT [code] — are each read, complemented (the hardware is
active-low), and written into the head of a small edge-detect ring at INPUT_PORT0 [seen]. Before the
fresh reads land, the previous frame's coin/start and player-1 samples are shifted one slot back into
shadow copies at 0x8813 and 0x8814, so later code can distinguish a fresh press from a held button;
the coin/start byte alone keeps two further, older samples (shifted on through 0x8815 and 0x8816),
while the player-2 port keeps no history at all. Two free-running down-counters are then decremented every beat: the worker control byte
WORKER_CONTROL_BYTE [code] and the general FRAME_COUNTER [seen], whose low bits phase animations and
whose zero-crossings gate periodic integrity checks. A coinage-gated per-frame update chain (loc_59e8,
skipped entirely in free play) and a single dequeue from the sound-command ring — drainSoundCommandRing
[seen], which hands one command to the audio CPU — round out the fixed per-frame chores.

Only then does the heartbeat advance the game itself, by dispatching on the top-level game state
(below), after which control returns to a shared epilogue. The epilogue copies the orientation flag
FLIP_SCREEN_FLAG [seen] out to the flip-screen hardware latch FLIP_SCREEN_LATCH [code] — so a cocktail
cabinet's mirrored display tracks the software state — restores every saved register, re-arms
NMI_ENABLE_LATCH [code], and returns to whatever instruction of the foreground loop was interrupted.

### Where each frame's work is chosen

The dispatch in the middle of the service is what makes one frame differ from the next. The service
reads the top-level selector MAIN_GAME_STATE [seen] and routes through it to exactly one handler for
this frame. The selector's small set of discrete values covers the machine's top-level modes: the
attract sequence (its state-0 setup handler loc_072d [code] and the attract/demo driver
dispatchAttractSubstate [seen]), the level intro, active play (runPlayStateFrame [seen]), and an idle
no-op slot noopStateHandler [code] for states that need no per-frame body. Whichever handler is
selected runs the whole simulation for that frame — enemies, the player, scoring, timers — and then
returns into the service's epilogue, so the heartbeat both begins and ends every frame's work.

## Configuration, coinage and players

Everything the operator can decide about a cabinet — how many coins buy a credit, how many
lives a player starts with, how hard the game plays, whether the monitor is upright or laid flat
in a cocktail — is settled once at power-on by reading two DIP-switch banks, and then honoured for
the rest of the machine's life out of a small cluster of work-RAM cells. Coins and start buttons
arrive continuously through the input ports; the machine debounces them, converts coins to credits
at the configured rate, spends credits to begin a one- or two-player game, and keeps two independent
score-and-lives banks that it swaps in and out as the players alternate. This section follows that
whole path, from the switches through to the second player's saved bank.

### Reading the cabinet switches at power-on

The boot routine `loc_0092` [code] does the one-time configuration read. It reaches the two
switch banks at their hardware ports — DSW bank 1 at `DSW1_PORT` [code] (the same address whose
*write* side is the watchdog kick) and DSW bank 0 at `DSW0_PORT` [code] — and, because the
switches are wired active-low, it complements bank 1 before pulling the individual fields out of it.
It then rotates that complemented byte through its bit positions and drops each field into a named
work-RAM cell, so the rest of the game never has to touch the hardware port again:

- **Cabinet type.** Bit 2 becomes `CABINET_MODE_FLAG` [code], the upright-versus-cocktail
  selector consulted at round start.
- **Bonus schedule.** Bit 3 becomes `BONUS_AWARD_DSW` [code], which picks between two
  extra-life award schedules.
- **Difficulty.** Bits 4–6 become the three-bit `DIFFICULTY_DSW` [code], which scales the
  enemy spawn schedules and, incidentally, is also copied in as the players' initial sprite colour.
- **Demo sounds.** Bit 7 becomes `DEMO_SOUNDS_DSW` [code], enabling attract-mode audio.
- **Lives.** The low two bits are turned into a starting-lives count in `LIVES_DSW` [code]:
  the three settings give three, four, or five lives, and the fourth encodes as `0xff`.

Coinage is decoded from bank 0 through a small ROM lookup table, `COINAGE_TABLE` [code]. The
low nibble of the switch selects coin-slot 1's ratio, which lands in `COINAGE_CONFIG` [seen]; the
high nibble selects coin-slot 2's ratio, landing in `COINAGE_CONFIG_SLOT2` [code]. The table
entry is a packed byte — its high nibble is how many coins are required, its low nibble how many
credits they buy — and a value of `0x0f` in either cell is the free-play sentinel that the credit
logic recognises everywhere. Alongside the switch decode the boot also lays down the machine's
other opening state (empty command rings, a flooded colour map, a default high-score table),
arms the vblank interrupt through `NMI_ENABLE_LATCH` [code], and sets the screen to its upright
default (see *Cabinet orientation* below) before handing off to the main loop.

### Sampling the panel every frame

The coin slots and start buttons are read not by polling but by the per-frame vblank service
`loc_066d`. On every interrupt it reads the three input ports — IN0 (coins and start), `IN1_PORT`
[code] (player 1's stick and button), and `IN2_PORT` [code] (player 2, used when the screen is
flipped) — complements each so a pressed switch reads as a set bit, and stores the three bytes into
a short edge-detection ring beginning at `INPUT_PORT0` [seen]. The prior frame's samples are
shifted down within that ring first, so downstream code can tell a fresh press from a held one.
In this inverted IN0 sample, bit 0 is coin slot 1, bit 1 is coin slot 2, bit 2 is the service
switch, bit 3 is the one-player start, and bit 4 is the two-player start. The watchdog is kicked just
ahead of this sampling; then, with the inputs captured, the service routine calls into the coinage
chain before dispatching the current game state; on the way out it re-copies the orientation flag to
the flip latch and re-arms the interrupt.

### Accepting coins and awarding credits

Coin handling hangs off `loc_59e8`, called from the frame service. Its first act is to honour free
play: if either coinage cell (`COINAGE_CONFIG` or `COINAGE_CONFIG_SLOT2`) holds the `0x0f`
sentinel it returns immediately, so no coin is ever counted when the machine is set free. Otherwise
it runs three near-identical acceptance steps — one per coin input — followed by the two physical
coin-counter drivers.

Each acceptance step watches one bit of the `INPUT_PORT0` sample as it shifts through a small
per-slot cadence ring, so a coin only registers on a clean, debounced transition rather than while
the switch is held. The service-switch step, `loc_5a06` [code], watches bit 2 through
`DRIP_RING_A` [code]; on a clean pulse it plays the coin sound and adds a flat one credit. The
two real coin slots, handled by `loc_5a56` and `loc_5a1f`, are where coinage division happens:
on a debounced coin they bump that slot's physical-counter pulse queue, then advance a running
coin accumulator and compare it against the slot's coinage byte (`COINAGE_CONFIG` for slot 1,
`COINAGE_CONFIG_SLOT2` for slot 2). Until enough coins have accumulated the step simply returns;
once the accumulator reaches the required-coins threshold it wraps the accumulator back down and
awards the configured number of credits.

All three steps funnel into a shared accumulate-and-store tail: it adds the awarded amount to the
credit counter `CREDIT_COUNT` [seen], clamps the total to a maximum of `0x63` (99), and queues
the display command that refreshes the on-screen credit figure. Because the same cell serves every
slot, one credit ceiling covers the whole machine.

Awarding a credit is separate from ticking the mechanical coin meters. Each accepted coin from a
real slot increments a queued-pulse count — `COIN1_PULSE_COUNT` [code] for slot 1 — and the
pulse generator `loc_5a9c` [code] turns those queued pulses into a timed strobe on the physical
coin-counter output. It seeds a phase timer (`COIN1_PULSE_PHASE` [code]) to raise the counter
latch `COIN1_COUNTER_LATCH` [code], holds it, drops it partway through the phase, and decrements
the queued count when the pulse completes — so the meter clicks exactly once per accepted coin. A
structurally identical twin drives the second slot's meter.

### Showing the credit total

The credit figure on the panel is drawn by `loc_05ee` [code]. It reads `CREDIT_COUNT` [seen],
clamps it to 99, converts it to packed BCD, and writes the two digit tiles — the tens tile at
`CREDIT_HUD_TENS_VRAM` [code] (skipped entirely when the tens digit is zero) and the units tile
at `CREDIT_HUD_UNITS_VRAM` [code]. When a game begins, `queueCreditDisplayCommands` [code]
queues the primary credit-display command, and when the coinage cell reads the free-play sentinel
it adds a second command so the panel shows the free-play message instead of a credit count.

### Starting a game and spending credits

The start trigger is `startGameOnStartButtonPress` [seen]. It refuses to do anything while
`CREDIT_COUNT` [seen] is zero, refuses again if a game is already active (it folds the
two-player flag or the active player's life count into a status test), and finally checks that one
of the two start-button bits is set in the input sample before playing the start sound and handing
off to the start handler `loc_0d78`.

That handler decides one- versus two-player and spends the right number of credits. If the
one-player-start bit is set it drops into `loc_0de4`, which consumes a single credit and begins the
game with the two-player flag clear. If instead the two-player-start bit is set, it first insists on
at least two credits, subtracts two, and begins the game with the two-player flag set. Both paths
converge on the start-of-life setup `loc_0dab` (reached for two players via `loc_0da8`, which
seats the value that distinguishes the two cases). That setup writes both the active-player selector
`ACTIVE_PLAYER` [seen] and the `TWO_PLAYER_FLAG` [seen] in a single store, clears the play
sub-state, moves the machine into its play state (`MAIN_GAME_STATE` [seen]) with the in-play gate
`GAME_ACTIVE_FLAG` [seen] raised, resets the screen to upright, fires the round's opening sounds,
and calls `resetActorStateForBoard` [seen] to build the first board. For a two-player game it also
fires an extra sound and clears a second-player work block so player 2's turn starts clean.

When the machine is set to free play the flow is the same minus the accounting: the shared attract
epilogue `loc_0bb5` recognises the free-play sentinel in `COINAGE_CONFIG` [seen], reads the start
bits directly from `INPUT_PORT0` [seen], and jumps straight into the start-of-life setup without
touching the credit counter. And after any game ends, `resetToBoardBuildToContinuePlay` [seen] —
the play dispatcher's end-of-life continuation — checks whether another game can begin: under free
play it tails into that same attract epilogue, otherwise it returns unless a credit remains, and
when one does it drops the machine back to the board-build state ready for the next start press.

### The two player banks and alternation

The machine keeps a complete, independent state for each player and alternates between them. Two
pieces of per-player state matter for configuration and turn-taking: the score and the lives.

Each player has a three-byte BCD score buffer — `P1_SCORE_BCD` [seen] and `P2_SCORE_BCD`
[seen] — and only one is live at a time. `selectActivePlayerScoreBuffer` [code] hands back the
right buffer pointer purely from bit 0 of `ACTIVE_PLAYER` [seen]: even selects player 1, odd
selects player 2. That single selector is what makes the score accrue to whoever is currently
playing.

Lives live in `PLAYER0_LIVES` [seen] and `PLAYER1_LIVES` [seen]. Both are seeded from the
configured `LIVES_DSW` [code] value when a board is reset: `resetActorStateForBoard` [seen]
copies the lives switch into each player's life count and, in the same pass, seeds each player's
saved bank with a fixed opening X position and the difficulty-derived sprite colour. A life count
drains by one on each death and, on reaching zero for both players, ends the game.

Beyond score and lives, each player owns a saved actor/state bank — `PLAYER0_STATE_BANK` [seen]
and `PLAYER1_STATE_BANK` [seen], a fixed-size block each — that holds a frozen snapshot of that
player's board while the other is playing. Only one live state page is ever active; the banks are
swapped against it around each turn. When player 1 loses a life, `saveLivePageToPlayer0Bank`
[seen] copies the live page into player 0's bank and, if this is a two-player game and player 2
still has lives, latches `ACTIVE_PLAYER` [seen] to player 2. Symmetrically, when player 2 loses a
life, `loc_1bcc` [code] copies the live page into player 1's bank and hands control back to player
1 if player 1 is still alive; `saveLiveStateToPlayerBank` [code] is the general form that banks
the live page into whichever player is currently active. Only the player-2 path folds a
program-image checksum tripwire onto its copy — `loc_1bcc` compares a signature over a fixed block
of program bytes and bumps a tamper counter on a mismatch; the player-1 save and the general form
are plain copies. Either way the copy and the active-player latch are the substance of the
alternation. When the next round then initialises, `loc_1601` [code] reads `ACTIVE_PLAYER` and
loads *that* player's saved bank back into the live page — so play resumes exactly where the
incoming player left off, and the two players trade the machine back and forth until both run out of
lives.

### Cabinet orientation

The cabinet is a vertical (portrait) monitor rotated 90 degrees. Orientation is governed by two
cells. `FLIP_SCREEN_FLAG` [seen] is the software orientation flag — nonzero means the normal
upright orientation, zero means flipped — and boot initialises it, and the start-of-life setup
re-initialises it, to upright. Every frame the interrupt service copies this flag into the hardware
flip latch `FLIP_SCREEN_LATCH` [code] (its bit 7), which flips the video hardware. The same flag
also gates the software side of the flip: `loc_0320` [code] runs the vertical sprite-mirror pass
`mirrorSpriteListVertically` [code] only when the flag reads zero, so a flipped screen gets its
sprite list mirrored to match the flipped tiles.

Whether the flag is ever driven to the flipped state depends on the cabinet type. `loc_1601`
[code], at round init, consults `CABINET_MODE_FLAG` [code]: in a cocktail cabinet it sets the
orientation flag from the incoming player, so the display flips to face player 2 on their turn and
faces player 1 otherwise; in an upright cabinet it leaves the flag alone and the screen never flips
for turn-taking. This is also why the frame service samples both player-control ports — the upright
cabinet reads player 1's port, and the flipped cocktail view reads player 2's.

### The bonus-award (extra-life) schedule

The remaining configuration cell, `BONUS_AWARD_DSW` [code] (from DSW1 bit 3), selects the
extra-life award schedule, applied by `loc_18da` [code]. That routine works a pending-award queue
`AWARD_QUEUE` [code] against the active player's score. When the queue is empty it reloads it with
the first threshold from the selected schedule — five or three depending on the bonus switch. While
the queue holds a threshold it compares that threshold against the high byte of the active player's
score buffer (`P1_SCORE_BCD` / `P2_SCORE_BCD`, chosen off `ACTIVE_PLAYER`); once the score's
high byte reaches the queued value it bumps the saturating award gauge `GAUGE_PHASE_COUNTER`
[seen], BCD-steps the queue to the next threshold (a step of eight or seven, again per the bonus
switch), redraws the HUD gauge, and plays the tally sound. In this way the same switch chooses both
the first award point and the spacing between subsequent ones. (The plain per-frame score accrual
that this schedule watches is driven elsewhere from `PER_FRAME_SCORE_INCREMENT` [code] and the
`SCORE_AWARD_TABLE` [code] of BCD increments; the schedule here only decides when a milestone is
crossed.)

### Difficulty as spawn configuration

The one configuration cell that reaches beyond this subsystem is `DIFFICULTY_DSW` [code]. Besides
seeding the players' sprite colour at board reset, it is the scaling input the enemy spawn
schedulers read: the formation and shot-target spawners gate their spawns on the difficulty value
(early rounds require progressively higher difficulty settings before certain spawns fire), so the
operator's difficulty switch directly tightens or loosens the pressure the schedulers apply. The
spawn machinery itself is described with the enemy subsystem; here it is enough to note that
`DIFFICULTY_DSW` is the boot-decoded config cell that feeds it.

## In-play progression and timers

Once a game is running, the outer game-state selector `MAIN_GAME_STATE` [seen] (0x8805) hands
every frame to `runPlayStateFrame` [seen], the play handler that sits at state 3 of that outer
machine. Two things happen on each of those frames, in this order: the active player's on-screen
clock is advanced by one tick, and the in-play sub-state machine is stepped. When the game finally
ends, the same handler's tail drops `MAIN_GAME_STATE` back to the board-build state (2) so the
attract/build path can reclaim the machine — so this section describes the loop that runs from the
first frame of a round to the last frame of a game.

### The per-frame play dispatch

`runPlayStateFrame` does three things and nothing else. It first ticks the BCD play-timer
(`loc_7912` [code], described below). It then steps the in-play sub-state machine by handing off to
the sub-state dispatcher `loc_15a1`: that routine reads the sub-state selector `PLAY_STATE_INDEX`
[seen] (0x880a), masks it to five bits (`& 0x1f`), and uses the result as an index into the jump
table at 0x15a8, jumping to the handler seated there. Whichever handler runs, control comes back to
the post-dispatch continuation `resetToBoardBuildToContinuePlay` [seen], which is the end-of-game
housekeeping stage: while a game is still live it simply returns; on free play it hands off to the
shared attract epilogue; with credit remaining and the game over it forces the machine back to the
board-build state (`MAIN_GAME_STATE` = 2, `PLAY_STATE_INDEX` = 0), runs the board/HUD reset and the
arena clear, and blanks an eight-tile attribute column so the next board can be rebuilt.

The whole in-play flow is therefore a self-driving sequence of small handlers, each of which does
its work and then latches the *next* value of `PLAY_STATE_INDEX` itself; the dispatcher simply
executes whatever the previous handler left in that byte. Across a live game the selector is
observed stepping through a discrete set of values — 1, 2, 3, 4, 7, 10, 13, 18 — as the round
builds up, plays, and tears down.

### The sub-state handler sequence

The confidently-read handlers reachable through the 0x15a8 table, in index order, form the
round's life cycle:

- **Index 0 — round init (`loc_1601` [code]).** This is gated on the row-by-row tilemap clear:
  it blanks one tilemap row per frame through `loc_02c9` [code] and returns early until the fill
  counter drains, so the board wipes in visibly over several frames before anything else starts.
  Once drained it re-arms the fill, clears the actor arena and a block of round-init cells, and on
  the first entry of a two-player round raises a once-per-round latch (`loc_89e3`), picks the
  screen orientation, and floods the colour/attribute map. Its shared tail seeds the phase timer
  `PHASE_TIMER` [seen] (0x8808) — a short value (2) for a single-player round, 0x80 on the first
  entry of a two-player round, and the latched value (1) on later two-player entries — advances
  `PLAY_STATE_INDEX`, restores the *active player's* saved bank into
  the live state page (see below), derives the rope-segment count from `WAVE_ARRIVAL_COUNTER`
  [seen], and copies the round message table into the display buffer.

- **Index 1 — phase build (`loc_16b7`).** This handler holds the sub-state by counting down
  `PHASE_TIMER` (0x8808) each frame and returning while it is still nonzero; only when the phase
  timer expires does it run the per-phase colour/attribute paint and walk a decision tree — keyed
  on `PLAY_MODE_LATCH` [code] (0x8f50), `ROUND_IN_PROGRESS` [seen], `GAME_ACTIVE_FLAG` [seen] and
  `ROUND_COUNTER` [seen] — that selects the graphic and layout pointers for the field variant. It
  then reloads its fixed pointers and the enemy-spawn cadence, advances `PLAY_STATE_INDEX` (or, on
  the attract/other branch, forces it to 0x10), and enqueues its display command.

- **Index 2 — round-start delay (`startRoundAfterIntroDelay` [seen]).** Runs the display-list
  interpreter every frame and gates progress on two counters: `SUBPHASE_TICK` [seen] (0x88b7),
  which must wrap every 0x1c frames, and a one-shot at `FORMATION_SLOT_TABLE` [seen] (0x8920) that
  returns the first wrap and proceeds only on the second. Past both gates it chooses an action
  from `PLAY_MODE_LATCH`, `ROUND_IN_PROGRESS`, `GAME_ACTIVE_FLAG` and `ROUND_COUNTER`: it either
  runs the level-start batch (round-number HUD, the phase gauge, timer/anim reload seeds, the
  enemy-spawn driver, and the sprite rebuild), marks `ROUND_IN_PROGRESS` and seats
  `WAVE_ARRIVAL_COUNTER` = 2, and sets the selector to 3; or, on the odd-round / round-0 arms, it
  jumps the selector to 0x0d instead.

- **Index 3 — wave setup (`spawnEnemyWave` [seen]).** The enemy-wave setup and spawn step that
  precedes live play.

- **Index 4 — live gameplay (`runActiveGameplayFrame` [code]).** The steady-state per-frame
  coordinator: it runs fourteen sub-handlers in a fixed order every frame (player input and
  aiming, spawn service, enemy/formation/object state updates, the actor update pipeline, the
  round-label and gauge paints, and the sprite rebuild) and returns. This is where a round
  actually plays; the selector stays at 4 until a life or the round ends.

- **Index 5 — phase-gauge drain (`loc_1a64`).** When `PLAY_MODE_LATCH` is set it hands off to an
  alternate handler; otherwise it runs its reset pair, clears the once-per-round latch, and — with
  the in-play gate `GAME_ACTIVE_FLAG` open — counts `GAUGE_PHASE_COUNTER` [seen] (0x8908) down by
  one. While the gauge still has count it repaints it and re-seats the selector to 0x0a (0x0b for
  player 1). When the gauge reaches (or was already) zero, it hands off to the phase-exhausted
  handler.

- **Index 6 — sub-state finalize (`loc_1b43` [code]).** `loc_1b43` has a structurally-identical
  sibling, `loc_1b8c` [code], seated at a separate, higher selector index rather than this one; the
  two are gated on the same tilemap-clear drain, then flood the attribute columns, enqueue two display
  commands, run the shared integrity/timer handler `loc_7960` [code], and latch the selector to
  0x0c. `loc_1b43` clears `PHASE_TIMER`; its sibling `loc_1b8c` instead reloads it to 0x60.
  `loc_1b43` additionally folds a program-memory block into a rolling checksum and copies a
  message string into the display buffer.

- **Index 7 — turn hand-off (`saveLivePageToPlayer0Bank` [seen], with `loc_1bcc` [code]).** The
  player-switch step: it snapshots the live state page into a player's saved bank and clears
  `PLAY_STATE_INDEX` (both described under the banking section).

The phase-exhausted handler `loc_1a96` [code], reached when the gauge drains, queues the
phase-exhausted tile run, advances `PLAY_STATE_INDEX` (an extra step for player one), clears the
high-score insert rank and two round cells including `ROPE_SEGMENT_COUNT`, and hands off to the
high-score insert-sort — the machinery that runs at end of game. Selector values above the
confidently-read set (the handlers at 0x1c03, 0x1c66 and 0x71b9) are still role-open, so the
higher latched indices (0x0a–0x0d, 0x10, and the like) route into handlers whose full role is not
yet pinned down.

### The 0x8900 live-state page and its progression counters

The block at 0x8900 is a single "live state page" — the working copy of everything that describes
the current player's progress. Its base cell is `SPEED_INDEX` [seen] (0x8900), the enemy
speed/difficulty index that escalates with the wave and is read (clamped below 8) to pick a
velocity table. The counters that follow it in the page carry the round's progression:

- `STAGE_COUNTDOWN` [seen] (0x8901) counts down from 0x20 across a stage; near zero it gates actor
  AI, and its initial value selects which stage label is drawn.
- `SPAWN_PHASE_COUNTER` [seen] (0x8902) cycles up to 7 and selects the spawn/fire mode branches; it
  is reseeded to 4 at its cap by the board reset.
- `WAVE_ARRIVAL_COUNTER` [seen] (0x8903) is bumped on each enemy arrival, caps out, and bounds the
  rope-segment count (round init derives the rope count as this value minus two).
- `ROUND_IN_PROGRESS` [seen] (0x8904) is the in-progress flag for the active round, raised at level
  start and read all through the render/state decision trees.
- `ROUND_COUNTER` [seen] (0x8907) is the round number rendered as the HUD; its low bits select the
  stage-type/facing variant and index the difficulty tables.
- `GAUGE_PHASE_COUNTER` [seen] (0x8908) is the count drawn as the vertical five-cell HUD gauge,
  drained one per phase by the index-5 handler; reaching zero is what fires phase-exhaustion.

Separate from the page but central to the machine's timing is `PHASE_TIMER` [seen] (0x8808), the
per-frame phase countdown that the build handlers decrement and reload (2, 0x60, 0x80) to hold a
sub-state for a fixed number of frames before it advances. Together with the tilemap-clear drain
(`loc_02c9` counting `FILL_ROW_COUNTER` at 0x8809 to zero), it is the pacing mechanism: handlers
either wait for the fill to drain or for `PHASE_TIMER` to expire before they latch the next
selector value.

### Per-player state banks and lives

Because two players share one machine, the whole live state page is banked per player. Each
player owns a 0x3f-byte saved block — `PLAYER0_STATE_BANK` [seen] (0x8940) and
`PLAYER1_STATE_BANK` [seen] (0x8980) — and the machine swaps the live page (based at
`SPEED_INDEX`, 0x8900) in and out of the bank selected by `ACTIVE_PLAYER` [seen] (0x880d), with
`TWO_PLAYER_FLAG` [seen] (0x880e) marking a two-player game. At round init `loc_1601` copies the
active player's bank *into* the live page; on a turn hand-off the reverse happens —
`saveLivePageToPlayer0Bank` copies the live page *out* to player 0's bank (and, in a two-player
game with player 1 still alive, first latches the active player), while `loc_1bcc` does the
equivalent save into player 1's bank, and `saveLiveStateToPlayerBank` [code] writes the live page
into whichever bank `ACTIVE_PLAYER` names. All three clear `PLAY_STATE_INDEX` to 0 as the last
step, so the incoming player's turn always restarts the sub-state sequence from round init.

Each player's remaining lives live at offset 8 within that bank: `PLAYER0_LIVES` [seen] (0x8948)
and `PLAYER1_LIVES` [seen] (0x8988). That is the same page offset the live gauge counter
(`GAUGE_PHASE_COUNTER`, 0x8908) occupies, so a player's remaining count travels with the rest of
their progression whenever the page is banked in or out — the active player's copy sits in the
live page, the parked player's copy in their bank. Both counts are seeded together at board reset:
`resetActorStateForBoard` [seen] clears the live page, writes the cabinet lives value `LIVES_DSW`
[code] (0x8807) into both players' lives slots, seeds each bank's opening sprite X and colour, and
arms the tile fill. When a player dies their count drains and the turn hands off to the other
player through the save step, and when it reaches zero the game-over path clears `GAME_ACTIVE_FLAG`
— the in-play gate that the play-timer tick and several handlers test to decide whether they run
at all. The entry into this whole loop is `startGameOnStartButtonPress` [seen], which fires only
with credit present, the chosen player's life slot clear, and the start-button input bits set.

### The BCD play timers and their gates

Each player also has an on-screen clock kept as a small BCD bank: `PLAY_TIMER_BCD_P1` [code]
(0x8a30) and `PLAY_TIMER_BCD_P2` [code] (0x8a33). Each bank is three bytes — a frame sub-counter
in the base byte, then BCD seconds and BCD minutes digits. `loc_7912` [code] ticks the active
player's clock once per play frame: it does nothing while `GAME_ACTIVE_FLAG` is clear, selects the
active player's pair from `ACTIVE_PLAYER`, and does nothing while that player's gate byte
(`PLAY_TIMER_GATE_P1` [code] at 0x89e1, `PLAY_TIMER_GATE_P2` [code] at 0x89e2) is set — the gate
is the pause switch that suppresses the clock. Otherwise it advances the frame sub-counter, which
rolls at 0x3b or 0x3c (the extra frame chosen by bit 0 of the seconds byte, giving roughly one
second per roll); on the roll it BCD-carries the seconds digit — each digit's low nibble rolling
at 0x0a and its high nibble at 0x60 — and, when seconds reach 60, carries into the minutes digit.
The gate bytes are cleared at board reset by `resetActorStateForBoard`.

The clock is drawn by the shared handler `loc_7960` [code], invoked from the finalize handlers
(`loc_1b43` and its sibling): it splits the active player's minutes and seconds BCD bytes into hi/lo
nibble tiles up a video column (parted by a spacer tile), then clears three timer bytes (the two
just rendered plus the following byte). On game over the
elapsed time is preserved alongside the score — a player's two timer BCD bytes are written into the
high-score time side table when their entry is insert-sorted in.

### Integrity guards on the progression path

Several anti-tamper checks are folded into these same routines and run inline with normal
progression, though they are inert on an intact ROM. `loc_7960`, besides rendering the clock,
folds a checksum over a fixed code block and matches it against trailing guard bytes, and scans a
small flag block that can divert to a second summed check. `loc_1b43` folds its own 34-byte
program checksum and bumps the tamper-freeze tally `TAMPER_FREEZE_FLAG` [code] (0x881e) on a
mismatch; `loc_1bcc` folds a program signature and bumps `TAMPER_STRIKES_SIG` [code] (0x8a38) on a
miss; and `loc_7e6d` [code] runs a periodic ROM checksum — only when `PLAYER1_LIVES` is at least 4
and the free-running `FRAME_COUNTER` [seen] (0x8a5f) is at its zero crossing — bumping
`TAMPER_STRIKES_ROM` [code] (0x89ef) if the image looks altered. When tripped, these tallies
(together with `TAMPER_OBJECT_FREEZE_FLAG` [code] at 0x89fb and `BOARD_CLEAR_FLAG` [code] at
0x89e5) freeze spawns and per-frame object updates and skip HUD setup, but on the genuine ROM the
checks always pass and progression runs uninterrupted.

## The actor arena

Almost everything that moves in Pooyan — the player, the diving and rope-borne enemies, the
arrows and prizes they throw, the descending objects — lives in one contiguous stretch of work
RAM organised as fixed-width records. The base of that world is `ACTOR_TABLE` [seen], a
0x18-byte-stride array whose slot 0 is the player/lead actor. The enemy sub-array,
`ENEMY_ACTOR_TABLE` [seen], is the same array continued 0x60 bytes in; the descending
per-frame objects use a parallel array, `OBJECT_STATE_RECORD_BASE` [seen], again stride 0x18 and
running six slots deep into the projectile region. Every record shares the same interior layout:
its first two bytes are activity markers (a record is live when bit 0 of `(rec+0) | (rec+1)` is
set), `+0x02` is the state selector, `+0x03`/`+0x05` hold fractional sub-position, `+0x04` a
column or coarse position, `+0x06` a movement phase, `+0x08` a commitment latch, `+0x09`/`+0x0a`
a facing byte and its negation (a signed velocity), `+0x0b` an arm bit, `+0x0c`/`+0x0d` a
little-endian animation-sequence pointer with `+0x0e` its frame-hold countdown, `+0x0f`/`+0x10`
the attribute and tile the record currently draws, `+0x11` a spawn/life timer, `+0x14` a
tag/frame id, and `+0x17` a spawn-kind byte. Because the layout is uniform, one set of drivers
can walk any of the arrays with a counter and a stride, and one convention — a per-record helper
that reports whether it acted — lets a sweep stop after touching a single record.

### Sweeping the records each frame

The per-frame heartbeat runs three subsystems back to back: it advances the object-state table,
walks the enemy animation tick, then rebuilds the sprite list (`loc_76ea` [code] chains them).
The first of those is `loc_76f4`, which parks its loop counter and stride out of the way and
iterates six records from `OBJECT_STATE_RECORD_BASE`, handing each in turn to
`dispatchActiveObjectState` [seen]. That dispatcher is the gatekeeper for a record: if the record
is inactive (bit 0 of its first two bytes clear) it does nothing, otherwise it takes the low two
bits of the state byte at `+0x02` and jumps through a four-entry table to the handler for that
state. No continuation is stacked ahead of the handler, so whichever handler runs returns
straight back into the sweep's loop — the machine advances the array pointer by 0x18 and moves on.

A second driver, `loc_6a7f` [code], sweeps the enemy array a different way and for a different
purpose. While the blink-phase byte `BLINK_PHASE` [code] is set it walks eighteen
`ENEMY_ACTOR_TABLE` records through `loc_6a98` [code], the per-object state handler. That handler
skips an inactive record and otherwise routes `(state - 1) & 3` to one of two behaviours: index 0
steps a descending object along its fall, index 1 runs a screen re-initialisation path
(`loc_67df` [code]). When the blink phase is clear and the wave index is exactly two, `loc_6a7f`
instead performs a once-per-pass checksum of the playfield tilemap, summing video RAM column by
column into a 16-bit accumulator and comparing against a fixed correct total — a self-integrity
check whose mismatch arm is only reachable after the tilemap in video RAM has already been corrupted.

### Stepping one actor's state

The handlers those sweeps reach are where an actor actually thinks. The clearest example is the
phase dispatcher `loc_362d` [code], driven by the movement phase at `rec+0x06`. A low phase
(below 0x07) routes to the end-of-move guard; a high phase (0x14 and up) routes to the
target-tile resolver (`loc_3625` [code], which lets an already-committed actor — bit 0 of its
`+0x08` latch set — pass untouched and otherwise hands off to
`resolveTargetColumnAndArmApproach` [seen]). The middle band is a timed hold: a global
progress gate (`WAVE_PROGRESS_COUNTER` [seen] at or past 0x0e) can short-circuit one phase, and
otherwise a per-actor delay in `ACTOR_DELAY_COUNTER` [code] counts down a frame at a time. When
that delay elapses and the actor's X sits in the near half of the field, the delay is reloaded
from `DELAY_RELOAD_TABLE_368E` [code] — indexed by the low three bits of `ROUND_COUNTER` [seen],
so the cadence stiffens as rounds advance — and control falls into the pre-spawn gate. That gate,
`loc_365d` [code], arms an enemy to fling something: if the record's arm bit (`rec+0x0b` bit 0)
is set it first insists that exactly one of the six enemy records is holding the spawn state, and
only then seats a five-slot scan window over `SPRITE_OBJECT_TABLE` [seen] and drops into the slot
scanner; when the arm bit is clear it skips that count entirely and seats the scan window
unconditionally. (A sibling guard, `loc_3617` [code], reaches the same gate when a resolved target column
falls under 0x20.) The concrete work of X-movement lives in `loc_343e` [code], which advances
sub-position and column and, on reaching the turn-column limit, either arms a turnaround or builds
the interior sprite band; a descending object's fall step is `loc_672a` [code], which advances the
16-bit sub-position, seats a matching free spawn slot when the landing row is reached, then bumps
state and re-arms the animation.

When the pre-spawn gate fires, `spawnObjectIntoFreeSlot` [seen] does the placing. It scans a
table for the first slot whose activity pair has bit 0 clear (a full table simply spawns nothing),
then bumps the spawn bookkeeping — `SLOT_SPAWN_INDEX` [seen] and `ACTIVE_LANE_COUNT` [seen] (the
latter with its countdown) only while the template's `+0x07` bit 2 is armed, and the lane count
further gated on lanes remaining. The one counter stepped on every spawn is `ANIM_FRAME_COUNTER`
[seen]: it rolls a frame id (skipping zero on wrap) into the new record's `+0x14`. The routine
then seats the animation vector at `+0x0c`/`+0x0d` — `ANIM_SEQ_3994` [code] or
`ANIM_SEQ_3988` [seen], chosen by `+0x07` bit 1 — stamps the fixed `+0x0e`/`+0x11`/`+0x02`
fields, folds the attribute byte, and initialises the found slot from the template.

### Animation stepping

Two independent clocks animate the arena. The first is per-actor. `setActorAnimation` [seen] is
the primitive every spawn and turn calls: it writes a little-endian sequence pointer into a
record's `+0x0c`/`+0x0d` and zeroes the frame index at `+0x0e`, pointing the record at an
animation and restarting it. `advanceObjectAnimationFrame` [seen] then steps that sequence. The
`+0x0e` byte is a frame-hold: while it is non-zero the routine just decrements it and the current
frame lingers. On expiry it reads the stream addressed by `+0x0c`/`+0x0d` — a 0xff opcode reloads
the pointer from the following two bytes and re-reads (that is how a sequence loops), and any
other byte begins a three-byte frame record whose bytes become the tile (`+0x10`), attribute
(`+0x0f`), and the next hold (`+0x0e`) — before storing the advanced pointer back. The enemy
array's animation is ticked in bulk by the walk `loc_7625` [code] / `loc_7627` [code]: the twin
entry seeds a count of eight and the walk strides 0x18 records from `ENEMY_ACTOR_TABLE`, ticking
each through the per-entry dispatcher `loc_7638`, which selects a tick handler by the low
two bits of the record's state byte. A tick can signal that a phase transition needs the walk
reseeded, and the walk honours that by abandoning the remaining records for the frame.

The second clock animates the backdrop tile strip rather than any actor, and it advances on
alternate frames driven by a parity tick. `TILE_ANIM_PARITY` [seen] is bumped on every call, and
the two halves gate on its low bit. On odd frames `advanceTileAnimForwardOnOdd` [seen] runs: if
the tile code under `TILE_ANIM_CURSOR` [seen] has reached the wrap code 0x37 it steps the cursor
forward one video-RAM cell and reseeds that cell to 0x34, otherwise it animates the current cell's
code up by one, then stores the advanced cursor. On even frames `retreatTileAnimScript` [seen]
walks the same cursor the other way: a 0x34 marker reloads the base code 0x10 and backs the
pointer up one cell, any other value simply decrements in place. The pair keeps a short tilemap
strip cycling forward and back without either half fighting the other.

### Spawning enemies into the pool

Enemies enter the world through a family of sweep-and-seed drivers that all share one shape: gate
on a timer or phase, then walk the enemy records and let a per-record initialiser seed the first
free one. The initialisers report back whether they acted — an already-active record answers "keep
scanning", and the moment one seeds a fresh record it answers "stop", so the sweep abandons the
rest and at most one enemy spawns per pass.

Which driver runs depends on the game mode and the record layout being fed. The plain cadence tick
`loc_1171` [code] counts down `ENEMY_SPAWN_TIMER` [seen]; at zero it spawns only while
`STAGE_COUNTDOWN` [seen] runs ahead of `ACTIVE_ENEMY_COUNT` [seen] and fewer than six enemies are
live, then sweeps six records through `loc_119a`. That initialiser stamps the opening state,
derives a facing byte and its negation plus a spawn-timer reload from two round-indexed tables —
`SPAWN_FACING_TABLE_1209` [code] and `SPAWN_TIMER_TABLE_11F9` [code], both indexed by
`(ROUND_COUNTER & 0x3f) >> 2` — arms the walking animation `ANIM_TABLE_3829` [code], reloads the
spawn timer, and bumps the active count. A richer variant, `loc_56e8` [code], also gates on the
spawn timer but branches on round parity: an even round tail-hands to the spawn gate `loc_5871`
[code] (which launches only when the active count is under both the stage threshold and the cap of
six, then runs its own init loop), while an odd round gates on stage-countdown-versus-active and a
difficulty threshold derived from `SPEED_INDEX` [seen] before sweeping six slots through
`loc_572b`. That initialiser seeds the record, clamps and level-shifts a column index, picks a
signed velocity and a spawn-timer reload keyed on `ROUND_COUNTER` bit 0 — the odd/even split
between `SPAWN_TIMER_TABLE_ODD` [code] and `SPAWN_TIMER_TABLE_EVEN` [code], written into
`ENEMY_SPAWN_TIMER` — arms the animation, and bumps `ACTIVE_ENEMY_COUNT`.

Two more drivers exist for the modes that pack the enemy array differently.
`loc_6905` [code] is delay-gated on `SHARED_FRAME_DELAY_TIMER` [code]: once clear, and provided
the wave has not fully arrived (`WAVE_NUMBER` [code] still short of `WAVE_ARRIVAL_COUNTER` [seen])
nor hit its limit of eight, it sweeps eight enemy/state record pairs through `loc_6931`. That
initialiser activates both records of a pair, seeds their fields, arms `ANIM_TABLE_3838` [code],
reloads the shared delay, and — only on the wave's first spawn — queues two display commands and
paints the arrival count to the HUD as two BCD digits before bumping `WAVE_NUMBER`. The other,
`loc_6a0f` [code], gates on the blink phase, a phase-toggle ceiling in `ANIM_PHASE_TOGGLE_892C`
[code], and a `BLINK_COUNTDOWN` [code] timer; once those clear it sweeps eighteen records through
`loc_6a35`, which seeds a record, arms the spawn-delay countdown, then reads and bumps the phase
toggle to pick one of three spawn animations — `ANIM_PARAM_76D4` [code], `ANIM_PARAM_68EF`
[code], or `ANIM_PARAM_6B0A` [code] — by the pre-bump phase value.

Underneath several of these sit shared scan-and-seed tails and a common block initialiser. The
tails `loc_5544` [code], `loc_5594` [code], and `loc_54f9` [code] each walk a block table, skip
live blocks, and at the first free block pick a kind byte from a spawn-kind table indexed by the
low nibble of a rotating cursor, store it into the block's `+0x17` field, and hand off to the
block initialiser. Scheduler B draws its kind from `SPAWN_KIND_TABLE_5647` [code] via cursor
`SPAWN_SEQUENCE_INDEX_8D13` [code]; the frame-timer spawner draws from `SPAWN_KIND_TABLE_5627`
[code] via `SPAWN_SEQUENCE_INDEX_8D14` [code] and additionally runs an anti-tamper self-check
(summing an integrity region against its two's-complement signature and bumping the tamper freeze
on any mismatch); the third pulls from `ACTOR_SPAWN_TYPE_TABLE` [code] via `SPAWN_TYPE_CURSOR`
[code]. `loc_588e` [code] initialises a run of sprite blocks through `loc_572b`. The block
initialiser itself, `loc_5489`, seeds the standard opening fields, looks up and installs an
animation word, sets a life timer, and picks a signed speed for `+0x0a` by indexing a velocity
table with the round low bits — a private mirror of what `loc_572b` does inline. A separate,
script-driven path exists too: `spawnNextScriptedEnemy` [seen] reads a live script byte, ticks a
delay, advances a script pointer, and activates lane records one by one.

### Placing the player's sprites

The player is not one sprite but three stacked vertically, and `deriveStackedSpriteYs` [seen]
keeps them aligned each frame. It reads the player's base Y from `PLAYER_Y` [seen] and fans it
into the Y fields of stacked slots 3, 2, and 1: slot 3 takes the base Y, slot 2 sits 0x10 above
it, and slot 1 sits 0x0a below slot 2's top — so the three bodies read as one figure however the
player moves.

### The object-proximity collision scan

Hits are found by a proximity scan that runs twice a frame, once per target slot. `loc_602f`
[code] walks the two target-slot bases from `SPRITE_ACTOR_RECORD_SLOTS` [seen], tagging each pass
with a slot selector, and runs the scan for that slot; a hit inside a pass aborts the whole
routine so the second slot is left untouched, meaning only one collision resolves per frame.

The scan itself is a small mutually-recursive walk. `loc_6048` arms it: it reads the
slot's presence block (`ENEMY_TARGET_REC0` [seen] or `ENEMY_TARGET_REC1` [seen]), treats an empty
(0) or already-engaged (3) block as inert, and otherwise latches the block's kind into
`ACTIVE_OBJECT_TYPE` [seen] and enters the record walk over `SPRITE_OBJECT_TABLE` [seen]. The head
of the walk, `loc_6069`, classifies each record — a zero lead byte or the wrong kind sends
it to the epilogue `loc_60f2`, which steps the actor and record pointers on and re-enters
the head while records remain, closing the loop. A record of the live kind routes by round parity:
an even round enters the proximity gate `loc_6080`, which measures the X and Y gaps between
the flip-biased actor and the target and, if both fall inside the limits (9 across, 8 down),
advances to the record's tag and enters the hit handler. An odd round enters the collision handler
`loc_61b4`, which finds the matching non-busy target slot, dispatches on the high nibble of
its `+0x16` status/kind field, and on the award path latches the actor onto the record, adds a round-indexed
delta from `POSITION_DELTA_TABLE_6358` [code] to both the record and the slot, arms the slot,
wipes the parity target buffer, plays a sound, and unwinds — so, like the spawn sweeps, the walk
stops at the first record it resolves.

### Tearing the arena down

Between boards and lives the arena is wiped clean so no stale record survives. `clearActorArena`
[seen] zero-fills a 0x200-byte block from `ACTOR_TABLE` at board init — the lead record, the enemy
sub-array, and everything after. The state-driven teardown `clearActorArenaAndCounters` [code]
does more: it zeroes a 0x241-byte span from `ACTOR_TABLE`, clears the spawn/wave/rope counters
(`SPAWN_PHASE_COUNTER`, `WAVE_ARRIVAL_COUNTER`, `ROPE_SEGMENT_COUNT`), and forces the in-play
sub-state at `PLAY_STATE_INDEX` to 6, handing the machine on to its next phase. A finer instrument,
`clearTargetActorRecord` [code], blanks a single 0x18-byte record starting at a supplied base — the
per-record eraser used when one actor, rather than the whole arena, needs to vanish.

## Waves, rope and launch

Three interlocking machines put the enemy attack on screen. An **attack-wave driver** flies a
table of eagle records through a fly-in / dive / retire life cycle and paces the gaps between
waves. A **rope machine** grows the vertical rope columns the enemies hang from, animates each
segment, and retracts them again. And a **launch state machine** arms the arrow, seeds new hunters
into play, and — during the level intro — plays a scripted launch sequence out of a byte script.
They share the same enemy-record arena (`ENEMY_ACTOR_TABLE` (0x8ae0) [seen], a stride-0x18 table)
and the same round parity, so the sections below trace each machine and where they hand off to one
another.

### The attack wave

The wave is driven once per frame from the bonus-phase body `loc_72a0` (0x72a0) [code], which first
runs the shared per-frame update and then hands straight to the wave driver `loc_72a7` (0x72a7)
[code]. The driver is a three-way switch on two flags. When the launch flag `WAVE_LAUNCH_FLAG`
(0x8f3a) [code] is clear, no wave is live, so it seeds the next one and returns. When a wave is live
but its record count `WAVE_RECORD_COUNT` (0x8f3c) [code] has fallen to zero, it hands to the
inter-wave idle handler. Otherwise it walks the wave's live records — two per wave index, i.e.
`WAVE_INDEX` (0x8f3d) [seen] × 2 of them, stepping by the 0x18 record stride through
`ENEMY_ACTOR_TABLE` — passing each in turn to the per-record dispatcher.

**Seeding a wave.** `loc_72e1` (0x72e1) [code] only fires while the lead target slot
`ENEMY_TARGET_REC0` (0x8c90) [seen] is clear, so a new formation never overwrites one still on
screen. It raises `WAVE_LAUNCH_FLAG` and bumps `WAVE_INDEX`. The fourth wave is special: it seeds no
records at all, only advancing the outer-phase counter `WAVE_OUTER_PHASE` (0x8f38) [seen] and
reloading the inter-wave hold timer `WAVE_HOLD_TIMER` (0x8f36) [seen] to 0x20 — the pause that
punctuates the wave cycle before it wraps. For any earlier wave it writes `WAVE_RECORD_COUNT` and
initialises two records per wave index in `ENEMY_ACTOR_TABLE`, each filled from the four-byte-per-
record parameter table `EAGLE_WAVE_PARAM_TABLE` (0x7409) [code]: the record is marked active, and its
target row (+4), target column (+6), and two more fields (+0x0f, +0x10) are copied across; records
whose own low address has bit 3 set also take a fixed 0x80 flag byte. It finishes by clearing
`WAVE_OUTER_PHASE` and the arrival tally `WAVE_RECORDS_ARRIVED` (0x8f39) [seen] so the fresh wave
starts counting from zero.

**Dispatching one record.** `loc_72cf` (0x72cf) [code] takes a single record. An inactive record —
neither of its first two bytes carrying the active bit — is skipped. Otherwise the record's state
byte (+2) selects one of exactly three handlers: state 0 is the approach, state 1 the dive/climb,
state 2 the retire. Each handler runs the record's whole frame and returns; the record advances its
own state byte to move itself to the next stage of the life cycle.

### Approach, dive and retire

**Approach** (`loc_733c` (0x733c) [code]). A record in state 0 is still flying toward its assigned
grid slot, and this handler does nothing until it arrives. Arrival is a position match against the
eagle's live coordinates: its column, `EAGLE_X_COORD` (0x8c96) [code] shifted right by three, must
equal the record's target column or the one just before it, and its row — `EAGLE_Y_COORD` (0x8c94)
[code] shifted right by three, plus four — must fall inside a five-row window starting at the target
row (from the target row to four rows beyond it). On arrival the record advances to state 1 and arms
its flight animation, and here the two records of a pair diverge: an odd record (bit 3 of its low
address) takes `EAGLE_ODD_RECORD_ANIM` (0x7403) [code] and a shorter field value, while an even
record takes `EAGLE_EVEN_RECORD_ANIM` (0x4086) [code], bumps `WAVE_RECORDS_ARRIVED` (only the even
records do so), and — once that even-arrival tally has caught up to `WAVE_INDEX` (half the wave's
record count), meaning every even record of the wave is now in place — enqueues the wave-arrival
command at `WAVE_ARRIVAL_CMD_BASE` (0x0630) [code] offset by the arrived count, so a fully-assembled
wave announces itself. Feeding this stage from the side is the grid-advance guard `loc_7287` (0x7287)
[code], which reads the eagle's advancing grid coordinate (the +4 field of `ENEMY_TARGET_REC0`) and,
while it is short of the grid edge (0xd0), hands it back so the approach keeps stepping; once it
reaches the edge the guard sets the grid-advance done latch `EAGLE_FINISH_FLAG` (0x8f3e) [code] and
runs the phase-reset epilogue.

**Dive and climb** (`loc_7395` (0x7395) [code]). State 1 advances the record's animation and then
integrates its 16-bit vertical position by the record's own per-record speed. The direction is again
keyed on the record's parity: an even record descends — speed is added, a carry drops it one tile
row, and reaching the bottom row (0x1d) advances it to the retire state — while an odd record climbs
— speed is subtracted, a borrow lifts it a row, and rising past the top row (0x04) advances it. The
paired even/odd records therefore sweep down and up together.

**Retire** (`loc_73ce` (0x73ce) [code]). State 2 clears the record — zero-filling its whole 0x18
bytes — and decrements the live-record count `WAVE_RECORD_COUNT`. When that count reaches zero the
last record of the wave has gone, and the handler seeds `WAVE_HOLD_TIMER` to 0x30 to open the pause
before the next wave.

**Between waves** (`loc_73e3` (0x73e3) [code]). This is where the driver lands when a wave has fully
retired. While `WAVE_HOLD_TIMER` is still counting it just ticks it down. On expiry, if a wave index
is still set it enqueues a wave-cycle command carrying that index (opcode 0x06, parameter 0xb0 plus
the index), then reseeds `WAVE_HOLD_TIMER` to 0x18 and clears `WAVE_LAUNCH_FLAG` — which sends
`loc_72a7` back to its seed branch on the next frame, starting the cycle over. The whole bonus phase
is torn down by the sibling handler `loc_7421` (0x7421) [code]: once its own hold timer expires it
zero-fills the wave/phase block and the 0x48-byte enemy-record region, clears the play sub-state and
the latched enemy X, and sets the attract sub-state selector to 7 to hand control back out of the
bonus stage.

### The rope: growing, animating and retracting the columns

The rope drawing is split by round parity at the head of the per-frame driver `loc_25a6` (0x25a6)
[code]. When the round counter `ROUND_COUNTER` (0x8907) [seen] is even it delegates the whole frame
to the rope-extend-and-cells driver (below); when it is odd it runs its own marker-column stamp.

**The marker/lift column stamp** is `loc_25a6`'s own body. It paces itself on `ROPE_DRAW_STEP_TIMER`
(0x8f09) [code], acting only when that expires (then reloading it to 0x10), and does nothing while
the spawn-phase counter `SPAWN_PHASE_COUNTER` (0x8902) [seen] is zero. The animation parity
`ROPE_DRAW_ANIM_PHASE` (0x8f0a) [code] picks between an even and odd glyph source each pass. Which of
three modes it runs is chosen by `FORMATION_SLOT_TABLE` (0x8920) [seen]: when that is non-zero it
**retracts**, blanking a seven-row band one screen-height above the layout pointer and redrawing the
retract glyph (`MARKER_RETRACT_GLYPH_SRC` (and its odd variant) [code]); when it is zero it runs the
**forward** path, either beginning a new extend sweep (bumping the draw count `ROPE_DRAW_COUNT`
(0x8934) [seen], setting the extend flag `ROPE_DRAW_EXTEND_FLAG` (0x8f05) [code], and reseating the
layout pointer `MARKER_LAYOUT_PTR` (0x8932) [code] to the sprite-band base `SPRITE_BAND_86E3` [code])
or, when the sweep reaches its limit column, clearing the extend flag and the armed latch. While the
extend flag is set it grows the column one row upward, pulses the new cell pair, and — as the sweep
passes its cap column — latches the completion flag `ROPE_DRAW_COMPLETE_FLAG` (0x8f04) [code]. In all
modes it finally stamps the chosen glyph (`MARKER_COLUMN_GLYPH_SRC` [code] on the forward path) down
`rows` two-row column records from the layout pointer, and on a forward frame appends the three-tile
cap glyph (`MARKER_GLYPH_SRC` [code]) below the last record. Each pass advances the animation parity.

**The rope-extend state machine** runs on the even-round frames, entered through
`driveRopeExtendAndRenderCells` (0x2d66) [code], which bails while a rope-grab is in progress
(`GRAB_ACTIVE_FLAG` (0x8d32) [seen]) or while the wave-arrival counter `WAVE_ARRIVAL_COUNTER`
(0x8903) [seen] is holding at 2, and otherwise runs the tile driver then the cell writer. The tile
driver `dispatchRopeExtendState` (0x2d78) [seen] reads the two-value selector `ROPE_EXTEND_STATE`
(0x8f14) [seen] and picks a handler through the jump table `ROPE_EXTEND_DISPATCH_TABLE` (0x2d7c)
[code].

- **Sub-state 0 — add a segment** (`addRopeSegmentAndAdvanceExtendState` (0x2d80) [seen]). It stops
  once the rope has grown to two segments below the stage's arrival count (`ROPE_SEGMENT_COUNT`
  (0x8931) [seen] equal to `WAVE_ARRIVAL_COUNTER` − 2). Otherwise it bumps the segment count and,
  while the segment index `ROPE_EXTEND_INDEX` (0x8f18) [seen] is below four, advances that index,
  looks this segment's video-column low byte up from `ROPE_CELL_COLUMN_TABLE` (0x2db8) [code] and
  stores the full pointer (video page 0x84) in `ROPE_COLUMN_VRAM_PTR` (0x8f19) [seen], reloads the
  new segment's per-cell timer in `ROPE_CELL_TIMERS` (0x8f28) [seen], advances `ROPE_EXTEND_STATE`,
  and arms the blit sub-timer `ROPE_EXTEND_TIMER` (0x8f16) [seen] to 0x10.
- **Sub-state 1 — animate the segment blit** (`advanceRopeExtendAnimation` (0x2dbc) [seen]). It
  counts `ROPE_EXTEND_TIMER` down and, on expiry, reloads it to 8. When the frame index
  `ROPE_EXTEND_FRAME_INDEX` (0x8f1b) [seen] has reached 8 the growth animation is done: it resets the
  index and `ROPE_EXTEND_STATE` back to 0 and arms the next rope cell's state byte. Otherwise it
  looks this frame's tile block up from `ROPE_TILE_BLOCK_TABLE` (0x2dee) [code], blits it at the rope
  column, and advances the frame index — an eight-frame reveal that walks the segment tile in.

**The per-cell state machine** is the cell writer `driveActiveRopeCells` (0x2e22) [code]. It treats
`ROPE_EXTEND_INDEX` as the count of active cells and walks that many one-byte cell records from
`ROPE_CELL_STATE_BASE` (0x8f1c) [seen], handing each to `dispatchRopeCellState` (0x2e36) [seen]. A
cell whose state is 0 is idle and skipped; otherwise the state (minus one) indexes the jump table
`ROPE_CELL_DISPATCH` (0x2e3d) [code] into one of four handlers, each of which owns one of the four
rope-cell frame timers (`tickRopeCellFrameTimer` (0x2e45) [seen] selects it by the low two bits of
the record address, stride 2 into `ROPE_CELL_TIMERS`) and draws through the column base computed by
`computeRopeCellVramColumn` (0x2e52) [code]:

- **State 1 — spawn a hanging object** (`spawnHangingRopeObject` (0x2e5e) [seen]). Acting only every
  fourth frame and only when its cell timer elapses, it scans the three spawn-object records
  (`SPAWN_OBJECT_TABLE` (0x8c48) [seen]) for a free slot; finding one it re-arms the timer with a
  round-scaled reload and the slot index, seeds the object (state, coordinates, and a +4 field from
  `ROPE_SPAWN_IY4_TABLE` (0x2ec7) [code]), advances the cell state, blits the segment tile
  (`ROPE_SEGMENT_TILE_SRC` (0x2dfe) [code]), and enqueues its display command.
- **State 2 — advance a hanging object** (`advanceHangingRopeObject` (0x2ecb) [seen]). On the frame
  its cell timer reaches zero it writes a round-derived tile index into the timer cell, indexes the
  formation table `FORMATION_TABLE` (0x8c30) [seen] by the following byte to bump that record's tile
  field, clear its position byte and drop another, advances the cell state, and blits the alternate
  segment tile (`ROPE_SEGMENT_TILE_SRC_ALT` (0x2e1e) [code]).
- **State 3 — advance, with a grab check** (`advanceHangingRopeObjectWithGrabCheck` (0x2f01)
  [seen]). This is state 2's sibling with the rope-grab trigger tested first: if a grab fires it
  abandons the cell update entirely (the grab is handled elsewhere, gated by `GRAB_ACTIVE_FLAG`).
  Otherwise, on the timer's zero frame, it re-arms the timer, drops one formation record's tile
  field, forces its position byte to 0xc0, bumps another field, advances the cell state, and blits
  the segment tile.
- **State 4 — retract a segment** (`retractRopeSegment` (0x2f2f) [code]). When its cell timer expires
  and segments remain, it selects a retract animation (indexed by the round counter shifted right by
  two, clamped, plus a difficulty term), merges the segment's attribute with its paired cell's bits
  unless it is the terminal column, clears the count-selected formation record, resets the cell state
  to 1, and blits the retract tile (`ROPE_RETRACT_TILE_SRC` (0x2e1a) [code]).

### The arrow and the launch

Two launch pathways feed enemies into a board. One is a **per-frame launch state machine** that arms
the arrow and spawns hunters during play; the other is a **scripted launcher** that plays a fixed
opening sequence during the level intro.

**The per-frame launch pipeline** is `runLaunchAndTargetActorPipeline` (0x2101) [seen], run from the
shared per-frame gameplay update. It runs three passes in order: the launch-state driver, the
one-shot target-slot spawn, and the paired-slot scan. The driver `dispatchLaunchState` (0x2778)
[seen] reads the five-state selector `LAUNCH_STATE` (0x8f30) [seen] (masked to its low three bits)
and picks a handler through an inline jump table:

- **State 0 — arm and gate** (`armLaunchAndAdvanceToHunterSpawn` (0x278f) [seen]). It first arms the
  launch flag `LAUNCH_ARMED_FLAG` (0x8f3f) [seen] once its preconditions hold: either the lane-spawn
  countdown `LANE_SPAWN_COUNTDOWN` (0x8d75) [seen] is running while the arm latch `LAUNCH_ARM_LATCH`
  (0x8f20) [seen] is still clear (in which case it bumps the latch), or the stage countdown
  `STAGE_COUNTDOWN` (0x8901) [seen] is non-zero and a multiple of eight. It then returns unless the
  arrow has risen far enough — the arrow object's Y, `ARROW_Y` (0x8ab4) [seen], at least 0x3c — and
  neither hunter-target record (`ENEMY_TARGET_REC0`, `ENEMY_TARGET_REC1` (0x8ca8) [seen]) carries the
  hit bit. Clearing those gates, it advances the state, reseeds the tile-flip countdown
  `LAUNCH_FLIP_COUNTDOWN` (0x892f) [code] to 8, may light the launch HUD tile `LAUNCH_HUD_TILE`
  (0x8508) [seen] when the game is idle, refreshes the arm latch from its seed `LAUNCH_ARM_LATCH_SEED`
  (0x8d7a) [code], and blits the launch tile (`LAUNCH_TILE_SRC` (0x2d51) [code]) at its VRAM anchor
  `LAUNCH_TILE_VRAM` (0x84a7) [seen].
- **State 1 — animate the arrow, or seed a target** (`spawnEnemyTargetOrAnimateLaunchFlipTile`
  (0x27f3) [seen]). While the arrow is at or above its gate height (0x34) it runs the flip countdown,
  and each time that elapses it reseeds it, steps the shared phase byte `SHARED_PHASE_COUNTDOWN`
  (0x892e) [code], and blits one of two arrow tiles chosen by that byte's parity — the on-screen
  arrow flicker. Once the arrow drops below the gate it scans the two enemy-target records for a free
  one and, finding it, advances the launch state to 2, marks the record, plays a launch sound, blits
  the alternate arrow tile, and seeds the record's fields.
- **State 2 — seed a hunter** (`spawnHunterIntoTableAndAdvanceLaunch` (0x2856) [seen]). Unless the
  play-mode latch `PLAY_MODE_LATCH` (0x8f50) [code] is set, it scans the six hunter records downward
  from `HUNTER_TABLE_BASE` (0x8c78) [code] (one 0x18 stride apart) for the first free slot, stamps it
  with the fixed opening state, coordinates and tile ids, and records its address in
  `HUNTER_RECORD_PTR` (0x8f32) [seen]. It then advances the launch state and, on the non-flip path,
  seeds the spawn countdown `HUNTER_SPAWN_COUNTDOWN` (0x8f34) [seen] to 0x20 and enqueues the hunter
  spawn display command `HUNTER_SPAWN_DISPLAY_CMD` (0x0315) [code]; on the flip path
  (`HUNTER_SPAWN_FLIP_FLAG` (0x8f61) [code]) it instead bumps `HUNTER_SPAWN_SUBCOUNTER` (0x8f5d)
  [code].
- **State 3 — delay, then clear** (`advanceLaunchOnDelayAndClearHunterRecord` (0x28ad) [seen]). It
  holds on `HUNTER_SPAWN_COUNTDOWN`; on expiry it advances the launch state and, unless the play-mode
  latch is set, zero-fills the 0x18-byte record pointed to by `HUNTER_RECORD_PTR`.
- **State 4 — idle** (`loc_28c5` (0x28c5) [code]). A bare return; the machine parks here until reset.

The pipeline's second pass, `spawnTargetActorOnLaunchTrigger` (0x210b) [seen], is a one-shot spawn
gated by a trigger bit in the actor table and a once-latch `TARGET_SPAWN_ARM_LATCH` (0x8f02) [seen]:
sampling and clearing the trigger, it arms the latch, optionally marks the first target slot special
once launch has reached its threshold, and seeds the first free target slot's position and timers
before tailing into the actor animation stepper.

**The scripted launcher** runs during the level intro, entered from `runLevelIntroPhase1Frame`
through the spawner gate `loc_6e75` (0x6e75) [code] — which, with a valid ROM (neither the signature-
mismatch nor the tamper-freeze flag set), runs the launcher and then the per-record driver; a
corrupted ROM would jump into data, so that arm is a dead trap. The launcher `loc_6e86` (0x6e86)
[code] paces itself on a per-call delay (`INTRO_DELAY_CKSUM_WORD` (0x8f48) [seen]); until it elapses
it only decrements and returns. On expiry it reloads the delay — bit 1 of the sequence counter
`LAUNCH_SEQ_COUNTER` (0x8f49) [code] picks 0x2c or 0x20 — and pulls the next byte of the launch
script via the pointer `LAUNCH_SCRIPT_PTR` (0x8f4a) [seen]. A 0xff byte terminates the script for the
frame; any other byte is a one-based index selecting a record in `ENEMY_ACTOR_TABLE`. If any of the
three projectile slots (`PROJECTILE_SLOT_STATE` (0x8bea) [seen]) is free, it arms the selected record
(state 6, animation `SPAWN_ANIM_TABLE_396A` (0x396a) [code]), launches it through the shared spawner
`launchProjectileIntoFreeSlot` (0x3a6c) [seen], and bumps `LAUNCH_SEQ_COUNTER` so the next reload and
script step alternate; if every slot is busy it backs the script pointer up one to retry next frame.
The counter therefore both advances the script's timing and rations launches to available slots.

**Ending a wave's launches.** `fireArmedEnemyProjectilesAndDisarm` (0x5b2c) [seen] does the end-of-
wave cleanup, and stays dormant while the lane-spawn countdown is clear (`LANE_SPAWN_COUNTDOWN` at 0) or
while lane actors are still active (`ACTIVE_LANE_COUNT` (0x8d79) [seen] non-zero). When the pending
flag is clear it first scans six enemy records' +4 field for the wave-end key (0x13, or 0x0b on an
odd round) and returns on a clean miss; on a hit it sweeps all six records through the per-record
fire gate `loc_5b71` (0x5b71) [code], then clears both the lane-spawn countdown and `LAUNCH_ARM_LATCH`
— disarming the launch until the next wave arms it again.

## Rendering, HUD and display lists

Pooyan draws onto three surfaces that all live in the upper 32 KB of the address space. The
tile-code plane, based at `VIDEO_RAM_BASE` (0x8400) `[code]`, holds one byte per on-screen cell in a
32-wide grid, so one screen row is a stride of 0x20 and (because the cabinet is vertical) "one row
up" is the negative stride `-0x20`. A parallel colour/attribute plane, based at `ATTRIB_MAP_BASE`
(0x8040) `[seen]`, carries the palette/attribute byte for each of those cells. Sprites are described
separately by a `SPRITE_DISPLAY_LIST` (0x8840) `[seen]`. Everything in this section either stamps
tiles into those two planes, rebuilds the sprite list, or drives the two queues — a display-command
ring and a display-list stream — that schedule and script that work.

### Clearing and filling the tile plane

A full-screen wipe is armed and then drained in small steps. `seedTileFillCursor` `[seen]` points the
16-bit write cursor `TILE_FILL_PTR` (0x880b) `[seen]` at a caller-chosen address and seeds the row
budget `FILL_ROW_COUNTER` (0x8809) `[seen]` to 0x20 (32 rows); `loc_02e3` `[code]` is the fixed-start
variant, arming the fill from `PLAYFIELD_TILE_BASE` `[code]`. The actual work happens one row per call
in `loc_02ce` `[code]`: it blanks a run of cells from the cursor using the general run-fill primitive
`loc_0010` `[code]` (write a constant N times, advancing the pointer; N of zero means a full 256), then
nudges the cursor forward by the rest of the row so it lands exactly one 0x20 stride on, stores it
back, and decrements the row budget — returning drained/not-drained so the driver can loop until the
plane is clear.

Individual columns are painted and erased by a small family of leaves that all step by the row
stride. `paintColumnBodyTiles` `[seen]` writes a column's two lower body tiles (mid tile 0x25 then
base tile 0x20) below a cap the caller stamps; `paintColumnBodyTilesUp` `[seen]` is the fixed
one-row-up twin; and `blankTileColumn` `[seen]` clears a three-cell column to the blank tile 0x10 and
hands back the advanced pointer so successive columns chain. The count column, `loc_039b` `[code]`,
turns a live tally into a bar: while the in-play gate `GAME_ACTIVE_FLAG` is clear it paints nothing,
otherwise it lights the actor-table count plus one (clamped to the eight-cell column) with fill tile
0x0c down `COUNT_COLUMN_VRAM` (0x8482) `[code]` and blanks the remainder with 0x10. A separate cell,
`TILE_ANIM_CURSOR` (0x88be) `[seen]`, is a marching pointer into the tile plane that a per-frame
animator walks forward and back to cycle a short tile strip.

### Painting the colour/attribute plane

`fillAttributeColumns` `[seen]` floods the colour plane a column at a time: for each of 31 columns it
reads one source byte and stamps it down all 30 rows at the 0x20 stride, advancing the source pointer
one byte per column, starting at `ATTRIB_MAP_BASE`. Its source is one of several ROM attribute-column
tables (the `FIELD_ATTRIB_SRC_*` cells, all `[code]`), and the various screen-state handlers call it
to recolour the field whenever the layout changes.

The two-plane column blitter `loc_0cf8` `[code]` stamps a strip that spans both planes at once. It
walks 0x0c-byte columns bottom-up (each cell one row up) out of `COLUMN_BLIT_TILE_SRC` (0x0d2f)
`[code]` into the tile plane at `COLUMN_BLIT_TILE_DEST` (0x86a7) `[code]`; a steering byte after each
column decides what happens next — 0xff switches the source and destination to the attribute-plane
pair `COLUMN_BLIT_ATTR_SRC` (0x0d48) `[code]` and `COLUMN_BLIT_ATTR_DEST` (0x82a7) `[code]`, 0xee ends
the stamp, and any other value begins the next column one cell to the right.

### Tile-block blitters

Larger graphics are composed from fixed rectangular blocks, each a leaf that copies consecutive
source bytes into a rectangle of cells. `blit2x2TileBlock` `[seen]` copies four bytes into a 2x2
video-RAM square (top-left, top-right, bottom-right, bottom-left) and returns the bottom-left address
so an animator can step up a row for its next blit; `paintTileBlock2x2` `[seen]` and
`paintTileBlock2x2Above` `[seen]` are tilemap variants anchored at the top-left and one row above.
`blitTile3x3Block` `[seen]` stamps a 3x3 block, copying three bytes per row and stepping the
destination `+0x1d` (three writes plus 0x1d = one 0x20 screen row) so nine cells land square, and
returns both advanced pointers so a caller can chain a second glyph straight from the advanced source.
`blitGlyphBlock4x3` `[seen]` is the same idea for a 4-row-by-3-column glyph, incrementing only the
destination's low byte within each row so the block stays inside its page. On top of these,
`loc_1ffb` `[code]` picks one of two fixed 3x3 glyph sources, `GLYPH_TILES_A`/`GLYPH_TILES_B` (both
`[code]`), by bit 5 of a selector and stamps it into `GLYPH_BLOCK_DEST` (0x8062) `[seen]`.

### The sprite display list

The sprite list at `SPRITE_DISPLAY_LIST` is a run of four-byte entries — two coordinate bytes, an
attribute byte, and a tile-code byte — and it is rebuilt from the game's object-record banks every
frame by `loc_02ef` `[code]`. The building block is `copyObjectRecordsToDisplayList` `[seen]`, which
for each record emits bytes `+0x06`, `+0x10`, `+0x04`, `+0x0f` into four successive list slots and
steps to the next record; the list's low byte advances alone so the writes wrap within its page.
`loc_02ef` runs this over four groups in turn — the two lead-actor records, the two enemy-target
records, the eighteen moving-object records (via `loc_0343` `[code]`, which adds coordinate math as it
copies), and the two arrow/launch records — then drops the two arrow sprites one pixel each. The
player is drawn as three stacked sprites, and `deriveStackedSpriteYs` `[seen]` fans the player-actor's
base `PLAYER_Y` (0x8a84) `[seen]` out to those three slots (base Y, base Y minus 0x10, and 0x0a more
than that).

Flip-screen support hangs off the tail of the rebuild. `loc_0320` `[code]` first ticks a caller-owned
per-frame counter, then reads the orientation flag `FLIP_SCREEN_FLAG` (0x881f) `[seen]`: while it is
nonzero (normal upright) nothing more happens, but once it is zero the list is mirrored by
`mirrorSpriteListVertically` `[code]`, which walks the 24 entries in place, negating each coordinate
byte (`-x - 0x10`) and toggling the attribute byte's two flip bits while preserving its low nibble.

### The display-command ring and its interpreter

Rendering and spawn work that must happen "soon, at a frame boundary" is scheduled through a
two-byte-command ring on page 0x88. Producers call `loc_0038` `[code]`: it looks at the slot the write
pointer `DISPLAY_CMD_RING_WRITE_PTR` (0x88a0) `[code]` names inside `DISPLAY_CMD_RING_BUFFER` (0x88c0)
`[code]`, and if that slot is free (bit 7 set) it stores the command's high byte there and its low byte
in the next slot, advances the pointer by two, and wraps it back to the ring start (low byte 0xc0)
once it runs below it; an occupied slot simply drops the command. A command is a 16-bit word whose
high byte is a type and whose low byte is an argument, and the ROM keeps a catalogue of them as the
`DISPLAY_CMD_*` cells (all `[code]`) — for example `OBJECT_SPAWN_DISPLAY_CMD` (0x0611), the
`ATTRACT_SETUP_DISPLAY_CMD_*` words, and the `SIREN_DISPLAY_CMD_*` words.

The ring is drained by `mainLoop` `[code]`, which each pass reads the byte the read pointer
`DISPLAY_CMD_RING_READ_PTR` (0x88a1) `[code]` names. If its high bit is set the slot is free, so there
is no command to run and the per-frame worker `loc_0254` `[code]` executes instead; otherwise the
high byte (the command type, doubled and masked to an even offset) indexes a jump table in ROM at
0x0242, the low byte is handed to the selected handler as its argument, both consumed slots are marked
free again (0xff), and the read pointer advances and wraps at 0xc0. The per-frame worker `loc_0254`
does its own steady-state rendering: gated on `GAME_ACTIVE_FLAG` and steered by `WORKER_CONTROL_BYTE`
(0x883f) `[code]`, it repaints scrolling three-tile columns into `WORKER_COLUMN_VRAM` (0x8740) `[seen]`
and `COLUMN_CAP_VRAM` (0x84e0) `[code]` (four blanked columns then a shared column in one-player mode,
a capped body column in two-player mode) and optionally blanks one more; when the control byte's low
nibble is set it instead runs the program-signature check.

One producer worth naming here is `tickHudRefresh` `[code]`: it bumps the frame tick
`HUD_REFRESH_TICK` (0x8f4d) `[code]` and, once every sixteen frames, enqueues a type-0x06 refresh
command (argument 0xb5 or 0x35 depending on the tick's bit 4) — the periodic "redraw the HUD" pulse
that keeps the panels current.

### The display-list stream interpreter

A second, richer queue is the layout stream driven by `paintDisplayListRunToVram` `[seen]`. It works
through up to 0x1d source bytes per call, choosing a destination/source pointer pair up front — the
primary pair `DISPLAY_LIST_DST_PTR`/`DISPLAY_LIST_SRC_PTR` (both `[seen]`), or the alternate pair
`DISPLAY_LIST_DST_PTR_ALT`/`DISPLAY_LIST_SRC_PTR_ALT` (both `[seen]`) when a formation-slot selector is
nonzero. A plain byte is copied straight to the destination; a 0x10 skip opcode advances the
destination by the following byte and shrinks the remaining budget by it; and a 0xff reload opcode
loads a fresh destination pointer from the stream and folds the next byte into the sub-phase tick
`SUBPHASE_TICK` (0x88b7) `[seen]`. On exit the advanced pointers are written back to whichever pair was
chosen, so the stream resumes exactly where it left off on the next call.

### HUD number primitives

Numbers are drawn from packed BCD, and a few shared leaves do the arithmetic and the digit painting.
`binToPackedBcd` `[code]` counts a binary value up in BCD, leaving the low two decimal digits packed
in one byte (value mod 100) and a separate hundreds tally (value div 100); a zero count means a full
256 passes. `byteToPackedBcd` `[code]` is the plain byte-to-BCD conversion (value mod 100) done the
Z80 way, decimal-adjusting through the same steps the hardware would. On the drawing side,
`drawStackedBcdDigits` `[code]` paints a packed byte as two stacked tiles — tens at the cursor, units
one row up — with a leading-zero tens digit blanked to tile 0x10. `splitBcdByte` `[seen]` writes the
low (units) nibble as a tile at the cursor, advances, and hands the high (tens) nibble back together
with a zero test the caller uses for leading-zero suppression. `renderDigitWithBlanking` `[seen]`
paints a single digit while threading a leading-blank budget: a nonzero digit prints as itself and
ends the blank run, a zero prints as the blank tile while the budget lasts and as a real 0 once it is
spent.

### Scores, high score, credits and panels

Each score is a three-byte packed-BCD counter: `P1_SCORE_BCD` (0x88a2) `[seen]`, `P2_SCORE_BCD`
(0x88a5) `[seen]`, and the high score `HIGH_SCORE_BCD` (0x88a8) `[code]` (its most-significant byte
`HIGH_SCORE_BCD_HI` (0x88aa) `[seen]`). `selectActivePlayerScoreBuffer` `[code]` chooses the live bank
from bit 0 of `ACTIVE_PLAYER`. Scoring itself runs through `loc_0496` `[code]`: while the game is live
it turns an award index into a three-byte increment (index zero uses `PER_FRAME_SCORE_INCREMENT`
(0x88ab) `[seen]`, any other index reads the stride-3 `SCORE_AWARD_TABLE` (0x0501) `[code]`),
BCD-adds it into the active counter with carry chained from the least-significant byte, repaints that
counter's column, then compares the counter with the high score most-significant byte first and — if
it is strictly greater — copies it over the high score and repaints the high-score column too.

The score columns are painted by two closely related routines that walk a counter most-significant
byte first up a screen column (one row up per digit, a shared blank budget of four suppressing leading
zeros). `loc_056b` `[code]` draws the selected counter into `P1_SCORE_VRAM` (0x8781) `[seen]`,
`P2_SCORE_VRAM` (0x8521) `[code]`, or `HIGH_SCORE_VRAM` (0x8641) `[code]`; `loc_0552` `[code]` is the
reset variant, first zeroing the three counter bytes so the column repaints as blanks and trailing
zeros. Credits are handled by `loc_05ee` `[code]`, which draws the credit field, reads `CREDIT_COUNT`
(0x8802) `[seen]` clamped to 99, and paints its tens tile (skipped when zero) and units tile into
`CREDIT_HUD_TENS_VRAM` (0x86bf) `[code]` and `CREDIT_HUD_UNITS_VRAM` (0x869f) `[code]`; a hidden
checksum tripwire sums a fixed program block only when the units digit is exactly 2.

Two panel renderers stamp fixed layouts. `renderPanelFromTable` `[seen]` paints the status panel from
its thirty-byte source table `PANEL_TILE_SOURCE` (0x8e00) `[code]` into `PANEL_VRAM_DEST` (0x8567)
`[seen]`, walking ten rows of three cells (each nonzero byte painted as itself, zero painted as the
blank tile 0x40; the first two cells of a row climb one row and the third re-bases to the next
column). `loc_0439` `[code]` renders ten rows of packed-BCD panel digits from `PANEL_DIGIT_SOURCE_TABLE`
(0x89c0) `[code]` into `PANEL_DIGIT_VRAM_DEST` (0x8467) `[code]`, drawing two digit pairs per row with
a fixed separator tile between them and re-basing the cursor two cells right each row.

The attract screen assembles all of this in `loc_03e9` `[code]`: it draws eleven selector-indexed
character fields, renders the ten-entry high-score table (`HIGH_SCORE_TABLE` (0x8a00) `[code]` into
`HIGH_SCORE_TABLE_VRAM` (0x85c7) `[code]`) as stacked digit pairs, and then repaints the digit panel
and the status panel. The character fields come from `loc_05b2` `[code]`, which draws a table-selected
list of stacked characters bottom-up: the selector's low seven bits index `FIELD_RECORD_PTR_TABLE`
`[code]`, whose entry heads a list of records each made of a two-byte destination address followed by
an inline string; a '.' ends a record, a '?' ends the whole field, characters map to digit tiles by
subtracting '0', and bit 7 of the selector switches the whole field to blank fill. A related helper,
`copyBiasedTileString` `[seen]`, copies a byte string while adding a fixed tile bias of 0x08 to each
byte until a 0xa0 terminator, remapping source character codes into display-tile codes.

### Stage label, round number and status readouts

The round-number-and-stage-label header is drawn by three entry points that share one body. The
per-frame refresh `refreshRoundStageHud` `[code]` holds off while any of seven integrity-flag slots is
armed, then derives the stage countdown's tens digit and draws; the once-per-level one-shot
`drawStageLabelOncePerLevel` `[code]` returns immediately once its `LEVEL_TAG_DONE_LATCH` `[code]` is
set, and otherwise arms that latch (or scans a five-entry stage-tag column table for a match) before
drawing; and `loc_1f40` `[code]` is the general form that scans a caller-supplied table for a target
value and draws at the matched slot. On the first column all three convert round + 1 to BCD, pick one
of two glyph banks — `ROUND_DIGIT_GLYPHS` or `ROUND_DIGIT_GLYPHS_ALT` (both `[code]`) — by a tens bit,
blit it with `blitGlyphBlock4x3` into `HUD_ROUND_TILE` (0x8722) `[seen]`, blank three trailing tiles,
and mirror `STAGE_COUNTDOWN` (0x8901) `[seen]` into `HUD_STAGE_DIGIT_LO` (0x8743) `[seen]`; every
path then looks up the fixed stage label in `STAGE_LABEL_PTR_TABLE` (0x1fa3) `[code]` (through the
table-indexing helper `loc_0c45` `[code]`) and blits it into `HUD_STAGE_LABEL_TILE` (0x8322) `[seen]`.

The heavier round-HUD setup is `paintRoundNumberHud` `[seen]`. On the first pass of a round (gated on
`TAMPER_FREEZE_FLAG` (0x881e) `[code]`) it copies an attribute field from `ROUND_HUD_FIELD_SRC`
`[code]` bottom-up into `RESET_ATTR_COLUMN` (0x855f) `[seen]` up to a 0x10 sentinel, converts round + 1
to BCD and writes the two round digits into `HUD_ROUND_DIGIT_HI` (0x849f) and `HUD_ROUND_DIGIT_LO`
(0x847f) (both `[seen]`, a leading zero blanked), stamps the round glyph blocks (a tens bit selecting
the glyph word from `ROUND_GLYPH_WORD_TABLE` `[code]`, blitted through `blitTile3x3Block` into
`ROUND_TILE_DST` (0x8462) `[seen]` and `blitGlyphBlock4x3`), and renders the selector glyph via
`loc_1ffb`; both entries then run the per-frame chain of `refreshRoundStageHud` followed by
`renderStageCountdownDigits`. That last routine, `renderStageCountdownDigits` `[seen]`, draws the stage
countdown as a one- or two-cell number — values below ten print as a single digit, ten and up convert
to packed BCD (that path gated by `PLAY_MODE_LATCH` (0x8f50) `[code]`) — writing the units nibble to
`HUD_STAGE_DIGIT_LO` and the tens one row over, with a leading zero suppressed.

A separate status field on the panel is redrawn on a slow cadence. `tickStatusRenderRingAndRedrawOnWrap`
`[seen]` decrements the mod-8 ring counter `STATUS_RENDER_RING` (0x88bd) `[seen]`; while it stays
nonzero the display simply holds, and on wrap it borrows one from the mod-4 render phase
`STATUS_RENDER_PHASE` (0x88bc) `[seen]` and falls into the shared tail
`wrapRenderPhaseAndPaintTileTriplet` `[seen]`. That tail masks the phase to 0..3, looks up a
tile-block descriptor for it in `STATUS_RENDER_TILE_TABLE` (0x26f6) `[code]` (again through
`loc_0c45`), and stamps three 2x2 blocks two screen rows apart into `STATUS_RENDER_VRAM_BASE` (0x8425)
`[seen]` with `blit2x2TileBlock`, the third block alternating between `STATUS_FIELD_TILE_A` (0x270a)
and `STATUS_FIELD_TILE_B` (0x270e) (both `[code]`) on the phase's low bit.

Two more readouts round out the HUD. The vertical phase gauge is drawn identically by
`renderPhaseGauge` `[seen]` and `paintPhaseGauge` `[seen]` (two copies of the same code): reading
`GAUGE_PHASE_COUNTER` `[seen]`, a zero count leaves the gauge alone, otherwise count-minus-one cells
(clamped to five) are filled from `PHASE_GAUGE_BASE_TILE` `[seen]` upward with the filled tile 0xb0 and
the rest blanked with 0x10. And the three-field sub-state readout is repainted by `loc_10c2` `[code]`,
which walks a counter toward a new value, then draws it (doubled) as field 1 into `SUBSTATE_FIELD1_VRAM`
(0x85d0) `[code]`, a second value into `SUBSTATE_FIELD2_VRAM` (0x8652) `[code]`, and — when its source
is nonzero — a third into `SUBSTATE_FIELD3_VRAM` (0x85d2) `[code]` with a hundreds digit mirrored out
to `SUBSTATE_FIELD3_HUNDREDS_VRAM` (0x85f2) `[code]`, all through `drawStackedBcdDigits` and
`binToPackedBcd`; the related on-screen wave-arrival count is drawn into `WAVE_COUNT_HUD_HI` (0x863b)
`[code]`.

## Sound

All of Pooyan's audio is produced by a second processor the main CPU never shares memory with: it
speaks to that processor through a single one-byte port, and the port is the entire audio interface.
The main program's job is only to decide *which* command byte to hand over and *when*; everything
downstream of the port — turning a command into a waveform — happens on hardware the JS machine does
not simulate, and is reproduced instead by playing back recorded clips (see *Record/replay audio
model* below). The interesting mechanism, then, lives entirely on the sending side: a write path to
the port, a ring buffer that spools commands across frames, a fan of thin trigger routines that each
stand for one fixed command, and a handful of periodic drivers that fire commands on their own
cadence.

### The write path to the audio processor

Every command reaches the audio processor through `sendSoundCommand` [seen]. It writes the command
byte into `SOUND_COMMAND_LATCH` [seen] (the port at 0xa100) and then pulses `AUDIO_IRQ_LATCH` [seen]
(bit 1 of the board's LS259 latch at 0xa181) high and immediately back low. That pulse is what
interrupts the audio processor into reading the byte just latched; its width is a bare timing delay
with no state of its own, so it is simply a raise-then-lower with nothing between.

At the machine boundary the latch write is the load-bearing event: the 0xa100 store is forwarded to
whatever audio sink is attached, and the sink keys off that write alone. The bit-1 strobe is recorded
into latch state but is deliberately *not* forwarded — because the audio processor is reproduced by
clips rather than executed, a strobe with nothing listening would only risk silencing playback, so
the model listens for the command latch and ignores the interrupt line.

Two things use `sendSoundCommand` directly, bypassing the queue. `emitPresetSound` [code] is a
one-shot wrapper that hands over the single fixed command 0x0b — the drip effect — the instant it is
called. And at power-on the boot initializer sends command 0 (silence) straight through, quieting the
audio processor before the game begins.

### The sound-command ring

Most commands are not sent immediately but spooled into a ring buffer and drained one per frame, so
that a burst of events queued in a single frame plays out in order rather than trampling one another
at the port. The ring lives at `SOUND_RING_BUFFER` [code] — twenty-eight slots spanning 0x8a43
through 0x8a5e — with a producer index in `SOUND_RING_WRITE_PTR` [code] (0x8a40) and a consumer index
in `SOUND_RING_READ_PTR` [code] (0x8a41). Both indices run from 0x43 to 0x5e and wrap the last slot
back to the first, so the buffer is circular. At boot the initializer fills every slot with the
empty-slot marker 0xff and seats both the write and read indices at the origin slot 0x43, leaving a
clean, empty ring.

There are two ways a byte enters the ring, differing only in whether the enqueue itself is gated.
`enqueueSoundCommandRing` [seen] is ungated: it stores the byte into the slot the write index names
and advances that index, wrapping at the end. `appendSoundCommandGated` [code] first stashes the
incoming byte in `SOUND_RING_PENDING_BYTE` [code] (0x8d20), then appends it only while a game is
active (`GAME_ACTIVE_FLAG` [seen]) or the play-mode latch (`PLAY_MODE_LATCH` [code]) is set; with both
of those clear the byte is dropped and nothing is enqueued. When it does append, it writes into the
same ring page and steps the same write index with the same wrap, so the two producers feed one
shared ring — the choice between them is simply whether a command should be suppressed while the
machine is idle.

Draining is the mirror image and happens once per frame, invoked from the vertical-blank interrupt
handler that also samples the inputs. `drainSoundCommandRing` [seen] reads the slot the consumer index
names; if it holds the empty marker there is nothing queued and it returns. Otherwise it applies a
second, independent gate: the queued byte is handed to `sendSoundCommand` unless the machine is silent,
which it is only when demo sounds are disabled (bit 0 of `DEMO_SOUNDS_DSW` [code] is clear) *and* no
game is active — so attract-mode audio can be switched off from the dip switches without affecting
in-game sound. Whether or not the byte was dispatched, the slot is then freed back to 0xff and the
consumer index advances with the same wrap. Because only one slot is consumed per frame, a backlog
built up during, say, a credit screen drains steadily rather than all at once.

### The command set the game emits

Sitting on top of the ring is a broad fan of trigger routines, each of which exists only to name one
fixed command byte (or a short fixed run of them) and hand it to a producer. Most split by which
producer they use — the same split as which gate applies — though one multi-byte trigger mixes the two
(the quad below).

The ungated triggers, which enqueue unconditionally, cover command 0x00 (silence) and commands 0x02,
0x05, and 0x09, plus several fixed pairs emitted as a unit: 0x19 then 0x15, 0x27 then 0x15, 0x82 then
0x03, and 0x82 then 0x95. The gated triggers, which append only while play is live, cover command 0x01
and the individual commands 0x06, 0x07, 0x08, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x11, 0x12, 0x13,
and 0x14 — a block from 0x06 through 0x14 with two holes in it: 0x09 is ungated (above) and 0x10 has no
standalone trigger — together with the paired 0x95 then 0x10 and the triple 0x95 / 0x03 / 0x11. The
four-byte 0x96 / 0x97 / 0x18 / 0x15 group is the mixed case: its first two bytes (0x96, 0x97) go through
the gated producer and are dropped while the machine is idle, while its last two (0x18, 0x15) enqueue
unconditionally — so the quad does not enqueue unconditionally as a unit. Command 0x04 is a special case with
its own guard: `queueSoundCommand04IfNotBusy` [code] drops the byte while a wave is tearing down
(`WAVE_TEARDOWN_STATE` [seen]) or a grab is in progress (`GRAB_ACTIVE_FLAG` [seen]), and only appends
when both are clear.

A distinct family emits *runs* — a caller-chosen lead byte followed by the fixed trailer 0x15, 0x16,
0x17, assembled by `appendSoundCommandRun` [code]. Fixed-lead runs open with 0x1d, 0x26, or 0x28, and
one trampoline emits an opening 0x82 before a run led by 0x1c. Two runs derive their lead from the
current round: `queueRoundSoundCommandRun` [code] folds two bits of `ROUND_COUNTER` [seen] to select
one of 0x1e through 0x21, and `queueRoundVariantSoundRun` [code] uses the same two bits to select one
of 0x22 through 0x25 — so the sound varies with progression. The siren run is described with its
driver below.

There is no per-command *name* table anywhere in the software: the trigger routines are the command
set, each identifying its byte by value. (The audio manifest is likewise nameless — see below.)

### The event drivers

Beyond the one-shot triggers, a few routines run every frame and decide on their own when to emit,
turning game state into a rhythm of sound.

The drip driver, `loc_5a06` [code], maintains a small cadence ring in `DRIP_RING_A` [code] (0x8829).
Each step it samples one phase bit — bit 2 of `INPUT_PORT0` [seen] — and rotates it into the low end
of that ring. Whenever the ring's low three bits settle on the fire phase (value 1) it emits the drip
preset (command 0x0b, sent immediately through `emitPresetSound`) and then adds one to a running total
through a shared accumulate step; on every other phase it simply leaves the advanced ring behind. The
effect is a periodic drip whose spacing is set by how the phase bit cycles.

The in-game siren and a shared periodic event share one driver, `loc_196e` [code]. It does nothing
while its busy latch `PERIODIC_MODE_LATCH` [code] is set. Otherwise it reads the per-round phase value
in `SPAWN_PHASE_COUNTER` [seen] as a mode selector. In mode 5 it arms a pair of enable cells two apart
(it steps the low byte by two, so a phase byte sits between them) — the siren-enable pair headed by
`SIREN_ENABLE_GATE` [code] (0x8d68), whose second cell is 0x8d6a, when no grab is active, or a
caller-supplied pair otherwise — and, if that pair's first cell was free, sets both cells and fires the four-command
0x96 / 0x97 / 0x18 / 0x15 group. In a mode above 5 it latches the mode into the busy latch and, when no
grab is active, fires the 0x19 / 0x15 pair. After that mode work it runs a shared countdown: unless the
one-shot `WAVE_EVENT_LATCH` [seen] or `WAVE_TEARDOWN_STATE` [seen] is already set, it ticks
`PERIODIC_EVENT_TIMER` [code] down each frame, and on expiry it reloads the timer to 0x20, sets the
wave-event latch, and fires the siren run. That run, `queueSirenSoundRun` [code], draws nothing while
the siren-enable gate is non-zero; when the gate is clear it appends a lead tile chosen by the round
counter's low bit (0x1a or 0x1b) followed by the completing run trailer.

A separate driver, `loc_19ca` [code], animates the warning siren during attract mode and is audio only
by association — it runs only while no game is active and the siren is enabled, counting down
`SIREN_FRAME_COUNTDOWN` [code]; on expiry it reloads the countdown to 0x18, toggles `SIREN_PHASE_BYTE`
[code], and queues one of two *display*-command words, `SIREN_DISPLAY_CMD_A` [code] or
`SIREN_DISPLAY_CMD_B` [code], through the display path rather than the sound ring. It drives the
visible warning graphic; the audible siren proper comes from `loc_196e`'s run above.

### Record/replay audio model

The processor on the far side of the command port — the shared timeplt-family audio Z80 known as
"tpsound" — is not executed by the machine at all. Audio is reproduced with a clip model: under the
real audio ROM, a recorder captures one waveform per command byte written to the latch, and at play
time the sink simply watches for writes to the command port at 0xa100 and plays back the clip that
matches the byte. This is why the write path forwards the latch store but not the interrupt strobe, and
why the whole scheme hangs on that single port address. Consistent with that, the audio manifest is
data-only: it declares the clip model and the latch port (0xa100) and nothing else — no per-command
table, because the command *bytes* the game emits (the values named by the trigger routines above) are
the whole vocabulary, and each is realized by its recorded clip.

## Anti-tamper

Pooyan's program is riddled with self-checks that fold blocks of its own ROM into a running sum and compare the result against a hard-coded sentinel. Because those sentinels are tuned to the bytes of the genuine, unmodified image, an intact ROM balances every one of them and the checks are invisible; only a patched or corrupted image makes a sum land off its target. When that happens the guilty guard records the miss in shared work RAM, and other parts of the machine — the spawners, the actor dispatchers, the HUD painter — read that record and quietly refuse to do their jobs. The net effect on a tampered board is a game that stops spawning enemies, stops updating actors, and stops drawing, without ever announcing why.

### The shared tamper state

Two work-RAM flags carry the hard responses. `TAMPER_FREEZE_FLAG` [code] is the master brake: several checksum guards increment it on a miss, and three separate consumers test it every frame to decide whether to run. `SIGNATURE_MISMATCH_FLAG` [code] is the second brake, raised by the program-signature guards and read by the object-spawn path. Alongside them sits a family of *strike tallies* — `TAMPER_STRIKES_ROM` [code], `TAMPER_STRIKES_SIG` [code], and `TAMPER_STRIKES_CATCH` [code] among them — each a one-byte counter a particular guard bumps when its own block fails. On the authentic image all of these hold a static zero, because the branch that would increment any of them is only reached on a checksum miss that the real bytes never produce. That is the current-state shape worth keeping in mind: the *increment* arms are dead code on a clean ROM, and the flags exist to be read, not to be set.

### The signature guards

The most direct check is `verifyRomSignature` [code]. It walks a sixteen-entry reference table (`SIGNATURE_REFERENCE_TABLE` [seen]) against every eighth byte of a sampled code region beginning at `SIGNATURE_SAMPLE_BASE` [seen] — advancing the sample pointer by eight and the reference pointer by one each step — and the moment a sampled byte disagrees with its reference it raises `SIGNATURE_MISMATCH_FLAG` and stops. A clean sixteen-for-sixteen pass leaves the flag untouched.

The state-4 actor handler `loc_2a79` [code] performs a longer, byte-for-byte signature comparison inside the actor-dispatch machinery. It reads a fixed 0x68-byte program window upward from `STATE4_SIGCHECK_CODE_BASE_ADDR` [code] and, in lockstep, a stored reference block upward from `STATE5_SIGCHECK_REF_TOP` [code]; a single differing byte tail-dispatches the state-1 handler instead of completing state 4. On a match — the only outcome the genuine image can reach, since both operands are fixed program bytes the player cannot alter — it reseats the record's frame-hold field, clears the record's flip bit, and advances its state byte.

`loc_1bcc` [code] folds a signature after snapshotting the live state page into player 1's saved bank. Having copied the page and cleared the play sub-state index, it seeds a checksum from the pointer the copy left behind and adds the low five bits of each byte of a fixed program block based at `TAMPER_CHECKSUM_CODE_BASE` [code]. Unless the sixteen-bit result lands on its expected sentinel word it bumps `TAMPER_STRIKES_SIG`.

### The ROM-block checksum guards

Several guards sum a stretch of program bytes and check the total, differing only in which block they cover, which sentinel they expect, and which counter or flag they touch.

`loc_1b43` [code], one of the play-state handlers, folds a 34-byte program block based at `TAMPER_CKSUM_BASE_5593` [code] into a rolling checksum — masking each byte, rotating it, and accumulating with carry — and expects the result 0x7c. Any other value increments `TAMPER_FREEZE_FLAG`, arming the master brake from inside the ordinary play loop.

`flagTamperOnRound5ChecksumMiss` [code] is armed only when the round counter reads five. On that round it sums six program bytes, carrying each overflow into a separate tally, and requires that the low sum plus the carry count plus a fixed bias wrap back to zero. A ROM that fails this balance likewise bumps `TAMPER_FREEZE_FLAG`.

The frame-timer spawner tail `loc_5594` [code] carries an integrity check that fires the instant it finds a free actor slot to seed. It sums the eight bytes of `INTEGRITY_GUARD_REGION_0BAD` [code] each against the corresponding byte of its two's-complement signature `INTEGRITY_GUARD_SIGNATURE_55B5` [code]; on a clean image every pair sums to zero, and any nonzero pair bumps `TAMPER_FREEZE_FLAG` before the slot is seeded. Its sibling tail `loc_5544` [code] does the same free-slot scan and seeding but omits this self-check — the integrity guard lives only in the `loc_5594` copy.

Two of the guards ride inside per-object state handlers and use the same downward-sum-with-carry idiom. `advanceActorStateOnTimerWithTamperCheck` [seen], when a record's timer expires inside the object-table band and the global frame gate is clear, folds a program block downward from `ACTOR_TAMPER_CKSUM_TOP` [code] to a terminator byte, tracking both the wrapping sum and a carry count; if the combined result retains any of the masked bits it bumps `SIGNATURE_MISMATCH_FLAG`. `advanceFallingEnemyAndTallyCatchOnLanding` [code], the catch handler, runs its checksum only on its special landing path: it sums bytes downward from `CATCH_TAMPER_CKSUM_TOP` [code] to a terminator, counting carries, and unless the result implies exactly the expected number of carries it raises `TAMPER_STRIKES_CATCH`.

The periodic guard `loc_7e6d` [code] runs only late in a game — gated on the player having at least four lives — and only at the frame counter's zero crossing. It sums the image downward from `TAMPER_CKSUM_TOP_ADDR` [code] to a sentinel byte, and if the combined sum-and-carry result trips a bit mask it bumps `TAMPER_STRIKES_ROM`.

Finally, `loc_5835` [code] — which spawns or steps the singleton special actor — tail-runs the shared table-checksum helper `verifyTableChecksum` [code] over a fixed region based at `CHECKSUM_ROM_BASE` [code]. That helper sums a run of bytes into a sixteen-bit accumulator and treats the table as intact only when the high byte is 0x1d and the low byte 0xc1; on any other total it raises `TAMPER_ROM_CHECK_FLAG` [code].

### What a raised flag does

The responses are all suppressive — nothing crashes or resets; the affected work simply stops.

Enemy spawning is the first casualty. The phase-1 spawner gate `loc_6e75` [code] runs its object launcher and per-record driver only when both `SIGNATURE_MISMATCH_FLAG` and `TAMPER_FREEZE_FLAG` are clear; with either flag raised it would branch into a region of data as if it were code — a dead trap that never returns useful spawning, so on a tampered image spawns simply cease. The object-seating routine `loc_6523` [code] independently bails the moment `SIGNATURE_MISMATCH_FLAG` is held, so even records that reach it are never brought to life.

Actor updates are the second casualty. `advanceLeadActorPrimaryState` [seen] — the per-frame driver for the lead actor group — runs its three sub-passes and then, if `TAMPER_FREEZE_FLAG` is set, returns before dispatching the actor's state handler at all, freezing the whole group's per-frame logic.

HUD drawing is the third. `paintRoundNumberHud` [seen] builds the round-number display — the attribute column, the BCD round digits, the round glyphs — only on a pass where `TAMPER_FREEZE_FLAG` is clear; when the flag is set it skips straight past that setup to the per-frame update chain, so a tampered board never gets its round HUD painted.

The strike tallies are the softer, cumulative side of the same system. Unlike the freeze flag they do not gate a single hot path; instead a raised counter is read elsewhere as a persistent "this image is bad" signal — for example, a nonzero `TAMPER_STRIKES_ROM` is enough to divert the HUD-refresh tick and to hold back the lead-actor lift, and the object-signature strike counters are scanned as a block to arm downstream diversions. Because their increment arms are unreachable on the genuine ROM, in ordinary play every one of these counters stays zero and every consumer takes its normal branch; the tallies are the machine's memory of tampering, waiting to be consulted by code that, on an honest image, always finds them clear.

## Open questions

These are the readings the code fixes but MAME has not yet confirmed, plus the paths no capture has exercised. Each is a work item for a following grounding pass.

- **Sound byte-to-effect map.** The page-0x8a sound-command FIFO is [seen] as a FIFO that reaches the audio CPU, but which specific sound each command byte (0x00..0x28, and the high-bit bytes 0x82/0x95/0x96/0x97) selects is [code]/[guess] — it needs an audio-side grounding pass that watches the audio CPU, not just the latch.
- **Foreground scroll worker 0x0254.** Whether it does load-bearing drawing during live play or is an attract/idle task is unsettled; its gating control byte 0x883f is [code]-only and its scroll-column duties overlap the vblank NMI's own column rebuild (0x0714).
- **Coin path beyond slot 1.** Slot 2 bumps a pulse counter at 0x8826 but only slot 1's counter (0x8824) has a wired coin-meter strobe, so whether 0x8826 drives a second physical meter is unconfirmed; and the third acceptor (input bit 2, flat +1 credit, no coinage or meter) is unlabelled as service-credit vs a third coin slot.
- **Phase-gauge cell 0x8908 dual use.** It is [seen] draining 3→0 as a phase gauge, yet another routine bumps the same cell saturating on a bonus-award threshold no golden reached; the two uses need a scoring-active capture to reconcile.
- **The six-slot object-state array 0x8ba0.** Its arm/advance/draw/integrity four-way machine and the per-pool overloading of the shared 0x18-byte record fields are [code]-only — no golden exercised a full cycle.
- **Formation / band-build / intro-launch.** The formation-spawn timer (0x8d30) and the band-build arm latch (0x8f63) are static-0 in every golden, so those paths — including the rope-extend tamper-strike branch and the formation phase-handler table at 0x30eb — are [code]-only, unconfirmed by MAME.
- **Display-command ring drain.** The ring cells are [code], never watched transitioning in a golden, and the display-command handler table's per-type mapping is not enumerated, so which screen region each command word repaints is inferred from the enqueue sites rather than confirmed by watching the ring drain.
- **Actor-record species identity.** The launch/spawn cluster (`runLaunchAndTargetActorPipeline` and kin, 0x21xx) and the eagle attack path (0x65xx) share the same actor tables and record fields — `HUNTER_TABLE_BASE`, the 0x8c90 records, `EAGLE_X_COORD`/`EAGLE_Y_COORD`, `LAUNCH_FLIP_COUNTDOWN`. Only the launch-cluster writes were captured, so the coordinate/countdown/table roles are code-read while the species labels (eagle vs hunter vs generic enemy/target) stay [code] pending a cross-cluster capture that exercises the 0x65xx eagle path.
