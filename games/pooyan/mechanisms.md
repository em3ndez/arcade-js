# Pooyan — how the machine works

This document describes the running machine as it is now, and is regenerated whole each understanding
pass. Confidence tags mirror `idiomatic/names.js`: **[seen]** = the cell's role is confirmed by a MAME
golden observation; **[code]** = read from the translated behaviour with MAME-grounding still open (the
cell is static or unobservable in the current goldens). The map covers both the machine's **state
architecture** — the work-RAM layout and the variables the game runs on — and its **control flow**: the
main loop, the vblank interrupt that is the machine's only per-frame heartbeat, and the state machines
that drive configuration, play, the actor arena, the wave/rope/launch cycle, rendering and the self-checks.

## The work RAM and its state model

The Z80 sees one flat 64K address space, but only the bottom half is program: ROM fills
`0x0000-0x7FFF` (the 32K of code and data tables). Everything above that is decoded into a
handful of small planes, and the decode is done by significant-bit masks rather than clean ranges,
so mirrors of each plane repeat across its region. The single invariant that governs the whole
upper map is that **a read and a write to the same address are usually two different devices** — most
visibly at `0xa000`, where a read returns a DIP-switch bank and a write kicks the watchdog. Nothing
in the machine's behaviour makes sense until that split is taken for granted.

### The two video planes

The tilemap is stored as a matched pair of RAM planes. The colour/attribute plane lives at
`0x8000-0x83FF`: one byte per screen cell selecting that cell's colour and attribute bits. Its
working base is ATTRIB_MAP_BASE **[seen]** (`0x8040`), which the field painter floods 31 columns by
30 rows, walking a `0x20` row stride, so each field variant recolours the playfield in one pass. The
tile-code plane sits directly above it at `0x8400-0x87FF`: one byte per cell naming the character to
draw there, with PLAYFIELD_TILE_BASE **[code]** (`0x8402`) as the playfield's own origin. The two
planes are addressed in lockstep — a cell's colour byte and its tile byte differ only by the
`0x800` between the planes — and both are laid out with a `0x20` (32-byte) stride between vertically
adjacent cells, which is why every HUD element is drawn as a vertical stack that steps by `±0x20`.

Almost every fixed screen fixture is a labelled window into the tile-code plane. The three score
readouts each own a column that the digit painters walk upward one row at a time: P1_SCORE_VRAM
**[code]** (`0x8781`), P2_SCORE_VRAM **[code]** (`0x8521`), and HIGH_SCORE_VRAM **[code]**
(`0x8641`). The status panel is repainted at PANEL_VRAM_DEST **[seen]** (`0x8567`) from a work-RAM
source table. The vertical phase gauge fills upward from PHASE_GAUGE_BASE_TILE **[seen]** (`0x863f`),
and the stage-countdown number's units digit is stamped at HUD_STAGE_DIGIT_LO **[seen]** (`0x8743`)
with its tens two rows up. Reading these addresses tells you where a thing appears on screen;
reading the work-RAM cells behind them (below) tells you why.

### The two sprite banks

Moving objects live in two 256-byte hardware sprite banks: bank 0 at `0x9000` and bank 1 at
`0x9400`, selected by address bit `0x0400` and mirrored across `0x9000-0x9FFF`. They are not written
piecemeal by gameplay code; instead the frame is assembled first in work RAM as the sprite display
list at SPRITE_DISPLAY_LIST **[seen]** (`0x8840`) — a 24-entry, stride-4 array whose first byte is
the lead sprite's Y and which is rebuilt every frame from the live object records
(SPRITE_ACTOR_RECORD_SLOTS **[seen]** at `0x8848`, SPRITE_TARGET_SLOTS **[seen]** at `0x887c`). Once
per vblank the interrupt service routine unpacks that list into the two hardware banks, sending two
of each sprite's four attribute bytes to bank 0 and two to bank 1. So the sprite banks are pure
output: the game's actual actor state is the display list and the records feeding it, and the banks
are only the last copy of it that the raster hardware reads.

### Work RAM: the 2K game-state store at 0x8800-0x8FFF

The 2K at `0x8800-0x8FFF` holds essentially all mutable game state. At boot the whole span is
cleared to zero in one sweep, and the low addresses are then seeded with configuration decoded from
the DIP switches — read once, never re-read during play. From DSW1 the boot code lifts the bonus/
extra-life schedule into BONUS_AWARD_DSW **[code]** (`0x8800`), the 3-bit difficulty into
DIFFICULTY_DSW **[code]** (`0x8820`), and the demo-sounds enable into DEMO_SOUNDS_DSW **[code]**
(`0x8821`); the lives setting is folded into a seed cell (`0x8807`) that later stocks each player's
life counter. From DSW0 it decodes the two coinage nibbles through a ROM table into COINAGE_CONFIG
**[seen]** (`0x882c`) and its slot-B partner (`0x882f`), where the credit logic reads them (`0x0f` =
free play). Because these are complemented copies of switch banks that hold their default value,
most read as **[code]** — their role is clear from the boot decode even though the stored byte never
changes at runtime.

Credits and coins occupy the next neighbourhood. CREDIT_COUNT **[seen]** (`0x8802`) is a BCD credit
counter (max `0x63`) that a coin increments and a start button consumes — one credit for a
one-player start, two for a two-player start — and it is drawn as two HUD digits. The physical
coin-counter output is driven separately through a small pulse generator whose queued-pulse count
and phase timer live at COIN1_PULSE_COUNT **[code]** (`0x8824`) and COIN1_PULSE_PHASE **[code]**
(`0x8825`).

State selection is layered. At the top, MAIN_GAME_STATE **[seen]** (`0x8805`) is the mode selector —
attract, intro, play — dispatched each interrupt through a ROM jump table. Below it GAME_ACTIVE_FLAG
**[seen]** (`0x8806`) is the in-play gate: set to 1 at start-of-life, cleared at game-over, and
tested at the head of the gameplay handlers so they return early when the game is idle. Within play,
PLAY_STATE_INDEX **[seen]** (`0x880a`) is the round/intro sub-state, dispatched through its own
table. Player identity is carried by ACTIVE_PLAYER **[seen]** (`0x880d`), whose bit 0 selects which
player's banks are live, and TWO_PLAYER_FLAG **[seen]** (`0x880e`), nonzero for a two-player game.
The screen orientation flag FLIP_SCREEN_FLAG **[seen]** (`0x881f`) also lives here; it is seeded to 1
(normal, upright) at boot and copied out to the flipscreen latch every frame.

Fresh joystick and coin/start inputs are captured into an edge-detect ring beginning at INPUT_PORT0
**[seen]** (`0x8810`). Each interrupt the routine shifts the previous frame's samples down through
`0x8813-0x8816` and writes the three freshly-read, complemented input ports into `0x8810-0x8812`, so
the game can compare this frame against last frame to detect button *edges* rather than levels.

Per-player state is double-buffered. A single live page at `0x8900-0x893f` holds the active player's
actor and round state; on a player switch it is copied wholesale into that player's saved bank —
PLAYER0_STATE_BANK **[seen]** (`0x8940`) or PLAYER1_STATE_BANK **[seen]** (`0x8980`) — and the other
player's bank is copied back in. Each player's remaining lives sit just inside those banks at
PLAYER0_LIVES **[seen]** (`0x8948`) and PLAYER1_LIVES **[seen]** (`0x8988`), seeded from the boot
lives value and drained on death; reaching zero drives the player-switch/game-over decision. The
live BCD score buffers are P1_SCORE_BCD **[seen]** (`0x88a2`) and P2_SCORE_BCD **[seen]** (`0x88a5`),
three bytes each; on game over a score is compared against the high-score record whose most-
significant byte is HIGH_SCORE_BCD_HI **[seen]** (`0x88aa`, low bytes at `0x88a8`). The full sorted
top-ten lives in a separate table at HIGH_SCORE_TABLE **[code]** (`0x8a00`), ten three-byte BCD
entries insert-sorted on game over and rendered to the HUD.

Timing is anchored by FRAME_COUNTER **[seen]** (`0x8a5f`), a free-running byte decremented on every
vblank interrupt; its low bits phase animations and its zero-crossings gate the periodic integrity
checks. Above the counters sits the actor world: ACTOR_TABLE **[seen]** (`0x8a80`) is the base of a
stride-`0x18` record array, zero-filled at board init, whose slot 0 is the player/lead actor. That
slot's vertical position is PLAYER_Y **[seen]** (`0x8a84`) — the axis the sprite Ys are derived from
and the coordinate enemy AI aims at. Beyond the main arena are the specialised object pools —
enemy, projectile, formation, and spawned-object record tables, each a small stride-`0x18` array —
plus the wave, spawn-timer, launch-state, and rope-segment cells that sequence an attack wave. These
are the bulk of the region's traffic and are described in their own sections; what matters to the
map is that they are all plain work-RAM records, swept by index, with no hardware behind them.

Finally, the very top of the region is the CPU stack. The stack pointer is initialised to `0x9000`
at boot and grows downward into the work RAM just beneath it (its measured low-water mark over boot
is about `0x8fd0`), so the window STACK_SCRATCH (`0x8fc0-0x9000`) is transient scratch rather than
game state and is excluded from state-equivalence comparisons. One boot-only tally, the ROM
self-test pass count, is kept at `0x8fff` inside that same window.

### The hardware I/O page at 0xa000+

Everything at `0xa000` and above is device, not memory, and the read/write split is total. On the
**read** side the decode returns DIP and input banks: `0xa000` is DSW1, `0xa080` is IN0 (coin and
start lines), `0xa0a0` is IN1 (player-1 controls), `0xa0c0` is IN2 (player-2 controls), and `0xa0e0`
is DSW0 (coinage). All the input ports are active-low, idling at `0xff`, which is why the interrupt
routine complements every sample before storing it, and why the DIP decode complements the switch
banks before pulling fields out of them. The joystick sampler chooses its port by orientation:
IN1_PORT **[code]** (`0xa0a0`) in the normal upright cabinet, IN2_PORT **[code]** (`0xa0c0`) when the
screen is flipped for the second player of a cocktail.

On the **write** side the same addresses reach latches and strobes. A write to `0xa000` — the very
address that reads DSW1 — kicks the watchdog; the boot code and the interrupt routine pepper the
program with these kicks to keep the board from resetting. A write to `0xa100` latches a sound
command for the audio CPU: the command byte goes to SOUND_COMMAND_LATCH **[seen]** (`0xa100`), then
the audio-IRQ line AUDIO_IRQ_LATCH **[seen]** (`0xa181`) is strobed high and back low to interrupt
the sound CPU into reading it. The block at `0xa180-0xa187` is a single eight-bit control latch
whose address low three bits pick which bit is being written (only bit 0 of the value lands). Its
bits are the board's discrete control lines: bit 0 is the vblank-NMI enable (armed at boot, dropped
at the top of each interrupt and re-armed on exit so the service routine cannot re-enter itself),
bit 1 the audio IRQ, bit 2 audio mute, bits 3 and 4 the two physical coin counters — the pulse
generator strobes counter 1 through COIN1_COUNTER_LATCH **[code]** (`0xa183`) — bit 5 the payout
line, and bit 7 the flipscreen output, which is *inverted* in hardware (a latched 0 means flipped),
and which the interrupt epilogue refreshes every frame from FLIP_SCREEN_FLAG. Because these are
write-only strobes with no readback, they are observed as the writes themselves rather than as any
stored state.
## The frame loop and the vblank heartbeat

Pooyan runs on two cooperating strands of control. In the foreground a single, never-returning
loop at `loc_020f` **[code]** spins forever, consuming a queue of little drawing jobs and, whenever
that queue runs dry, doing one pass of background upkeep. In the background the video hardware
raises a non-maskable interrupt once per displayed frame; that interrupt runs the service routine
at `loc_066d`, which is where all the per-frame game logic actually lives. The foreground loop does
the *drawing*; the vblank interrupt does the *thinking* and hands the foreground loop more work to
do. Nothing in the foreground loop ever waits on the video beam — it free-runs as fast as the CPU
allows — so the interrupt is the machine's only clock. It is, quite literally, the heartbeat: if it
ever stops arriving the game stops advancing.

### The display-command ring and how the loop drains it

The two strands meet at a small ring buffer in page 0x88, occupying the 64 bytes from 0x88c0 to
0x88ff. Each entry is a two-byte *display command*: a handler selector followed by a one-byte
argument. Two cursors chase each other around this window. Producers append through
`DISPLAY_CMD_RING_WRITE_PTR` **[code]** at 0x88a0; the foreground loop consumes through a read
cursor at 0x88a1. Both cursors advance by two per command and both wrap the same way — once a cursor
would step below 0xc0 (which happens as soon as it rolls past 0xff) it is snapped back up to 0xc0,
keeping it inside the 0xc0..0xff window. A freed slot is marked with 0xff, and that sentinel is the
sole handshake between the two ends: the producer never inspects the read cursor and the consumer
never inspects the write pointer.

Each pass through `loc_020f` reads the byte the read cursor points at and doubles it. That single
`add a,a` does double duty. Its carry out is the original bit 7, and its result is the value times
two. If bit 7 was set — which is exactly the case for a free slot's 0xff sentinel — the loop takes
that as "the ring is empty here" and runs the per-frame worker (below), then loops. If bit 7 was
clear the slot holds a real command, so the doubled value, masked to 0x1f, becomes an even offset
into the handler-address table at ROM 0x0242. The loop then frees both bytes of the command (writing
0xff over each), advances the read cursor by two, loads the command's second byte into the accumulator
as the handler's argument, fetches the handler's address from table 0x0242, and jumps to it — having
first pushed 0x020f as the return address so the handler's `ret` drops straight back to the top of the
loop. One command is drained per pass, and the loop keeps draining until it hits a free slot. Only
then does the worker run. (Note the doubling: the byte stored in the ring is a raw handler index; the
loop, not the producer, multiplies it up to index the word-wide table. And note the empty-ring
mechanism is not a separate check — the 0xff sentinel's high bit *is* what steers the loop into the
worker.)

### Appending a command

Producers enqueue through the routine at `loc_0038` **[code]** (reached as the `rst 0x38`
restart). It reads the write pointer at 0x88a0, forms the target slot in page 0x88, and tests that
slot's bit 7. If the slot is *not* free — bit 7 clear — the command is simply dropped: a full ring
silently discards the newest work rather than overwriting a pending job. If the slot is free it stores
the command's high byte there and its low byte in the following cell, then advances the write pointer
by two with the same wrap-to-0xc0 clamp the drain side uses. The write pointer never looks at where
the reader has got to; the only thing that stops a producer from clobbering an undrained command is
that undrained slots do not carry the free marker. This is how the two strands stay decoupled: the
interrupt-side logic queues drawing commands whenever it decides something on screen must change, and
the foreground loop empties the queue in its own time — but always fully within one frame's worth of
spinning, so a backlog never trickles out one command per interrupt and leaves stale tiles on the
playfield.

### The per-frame worker

When the ring is idle the loop calls the worker at `loc_0254`, the foreground's background-maintenance
pass. It first reads the counter at 0x883f (which the vblank interrupt ticks down every frame). When
the low nibble of that counter is non-zero the worker spends the pass on `verifyRomSignature`
**[code]** at 0x208c — a self-check that samples the code region against a reference — and returns;
so the integrity check is folded into the idle time between screens rather than costing a dedicated
slot. On the passes where that nibble is zero the worker instead maintains the scrolling background
tile columns. Gated by the `GAME_ACTIVE_FLAG` **[seen]** at 0x8806 and steered by the
`TWO_PLAYER_FLAG` **[seen]** at 0x880e and the `ACTIVE_PLAYER` **[seen]** select at 0x880d — which
choose between the two column bases 0x8740 and 0x84e0 — it stamps or clears tilemap columns through
`paintColumnBodyTiles` **[code]** (0x02aa), its neighbour at 0x02a8, and `blankTileColumn` **[code]**
(0x02b1). Bit 4 of the 0x883f byte and the low bit of `GAME_ACTIVE_FLAG` decide how far the pass
carries: when the game is not actively playing the worker returns early and leaves the columns alone.
So the foreground loop's spare cycles go to two jobs — verifying the ROM and grooming the scrolling
backdrop — chosen by a counter that the heartbeat itself drives.

### The vblank NMI: the sole per-frame heartbeat

Because the main loop never waits for the display, the only thing tying the program to the 60 Hz video
frame is the non-maskable interrupt raised at the start of each vertical blank. It fires only while
the NMI-enable latch (LS259 bit 0, at 0xa180) is set, and it vectors to the service routine `loc_066d`.
That routine is the true per-frame tick, and it runs a fixed sequence every time.

It opens by pushing the entire register file — main set, shadow set, and both index registers — because
it is interrupting arbitrary foreground code, then immediately clears the NMI-enable latch so a second
interrupt cannot nest inside it. With the machine quiesced it does the frame's housekeeping. It copies
the prepared sprite-attribute list out of its RAM staging area at 0x8840 into the sprite hardware
registers (around 0x9010/0x9410) through the copy loop at `loc_0714`; how many groups it copies depends
on the in-play sub-state in `PLAY_STATE_INDEX` **[seen]** at 0x880a (sub-state 4 refreshes several
groups, other states a single tall group). It kicks the watchdog by writing to 0xa000 — the one write
per frame that keeps the hardware from resetting the board, another reason the interrupt cannot be
allowed to lapse. It then services the inputs: the three player/coin ports (IN0, IN1, IN2 at 0xa080,
0xa0a0, 0xa0c0) are read, complemented so the active-low switches become active-high bits, and stored
at the head of an edge-detect history that begins with `INPUT_PORT0` **[seen]** at 0x8810; the previous
frame's samples are shifted down into 0x8813..0x8816 first, so handlers can compare this frame against
last frame to find freshly pressed buttons rather than held ones.

Two frame counters are then decremented: the worker-gate byte at 0x883f (which chooses the foreground
worker's job, above) and the free-running `FRAME_COUNTER` **[seen]** at 0x8a5f, a wrap-around
down-counter whose low bits pace animations and whose zero-crossings schedule the periodic integrity
checks. The interrupt also runs the credit/coin update chain (`loc_59e8`) and drains one queued sound
command to the audio CPU (`loc_0e64`) each frame.

Only after all that does the interrupt do the frame's *game* work, and it does so by dispatching on the
top-level `MAIN_GAME_STATE` **[seen]** at 0x8805. That byte selects, through the table at ROM 0x06f0,
one of the mode handlers — attract, intro, or play — and it is those handlers, running inside the
interrupt, that decide what has changed this frame and enqueue the display commands the foreground loop
will draw. The dispatched handler returns into the interrupt's own epilogue at 0x06fa. There the
service routine copies the `FLIP_SCREEN_FLAG` **[seen]** at 0x881f into the flip-screen latch (0xa187
bit 7), so the cabinet's orientation is re-asserted every frame; restores all the saved registers in
reverse order; re-arms the NMI-enable latch (0xa180 bit 0 back to 1); and returns to whatever foreground
address it interrupted. The foreground loop, none the wiser, keeps draining the ring the handlers just
refilled — until the next vertical blank starts the whole cycle again.
## Configuration, coinage and players

### Reading the DIP switches at boot

The operator's settings arrive on two hardware read ports — DSW0 at 0xa0e0 and DSW1 at 0xa000 — and are unpacked exactly once, in the reset routine that owns the whole 0x8800-0x882f configuration region. The switches are wired active-low, so the boot code complements every port byte the instant it reads it; from then on a `1` in a config cell means the matching switch is on.

DSW1 is peeled apart by a single rotate-and-mask cascade. The complemented byte is rolled right and one field skimmed off at each stop: bit 2 lands at 0x880f, bit 3 becomes **BONUS_AWARD_DSW** [code] at 0x8800, bits 4-6 become the three-bit **DIFFICULTY_DSW** [code] at 0x8820, and bit 7 becomes **DEMO_SOUNDS_DSW** [code] at 0x8821. The number-of-lives setting is decoded separately from DSW1's low two bits: those two complemented bits select 3, 4, or 5 lives (value + 3), with the all-ones case producing 0xff, and the result is written to the lives-DSW cell 0x8807. At the start of each game that byte is copied verbatim into both players' lives banks (0x8948 and 0x8988), so it is the config-to-state bridge for the life count; DIFFICULTY_DSW and DEMO_SOUNDS_DSW are consumed by the spawn-scheduling and sound subsystems respectively and are only *decoded* here.

DSW0 carries the coinage for the two slots. Its high nibble and its low nibble each index a small ROM translation table at 0x0053; the two looked-up bytes are stored at 0x882f (the second slot) and **COINAGE_CONFIG** [seen] at 0x882c (the first slot). Each coinage byte packs a coins-per-credit count in its high nibble and a credits-per-coin count in its low nibble, and the sentinel value 0x0f flags that slot as *free play*.

### Sampling the controls each frame

The vblank handler reads the three control ports every frame — IN0 at 0xa080, IN1 at 0xa0a0, IN2 at 0xa0c0 — complements each, and stores them at the head of a short input ring: **INPUT_PORT0** [seen] at 0x8810 (from IN0), then 0x8811 (IN1) and 0x8812 (IN2). Before overwriting the head it slides the previous frame's samples down into 0x8813-0x8816, keeping a short history for edge detection. In INPUT_PORT0 the meaningful bits are coin-1 on bit 0, coin-2 on bit 1, service credit on bit 2, one-player start on bit 3, and two-player start on bit 4. Having sampled the inputs, the handler immediately runs the credit/coinage chain and then the sound-ring drain before dispatching on the main game state.

### Coinage bookkeeping and free play

The credit/coinage chain (loc_59e8) is the per-frame heart of coin handling. It first tests both coinage nibbles: if COINAGE_CONFIG (0x882c) *or* the second-slot byte at 0x882f reads 0x0f, the cabinet is on free play and the entire chain is skipped. Otherwise it runs three coin-input handlers, then the two coin-counter pulse generators.

Every coin input is debounced through its own three-stage shift register. The relevant INPUT_PORT0 bit is rotated into carry, `rl (hl)` shifts that carry into the register byte, and the handler acts only when the low three bits then read `0b001` — a clean rising edge, one fresh press with the two prior frames idle. The three handlers differ only in which bit, which register, and which coinage they consult:

- **Coin slot 1** (loc_5a56) debounces bit 0 through register 0x882a. On a fresh coin it plays the coin-insert sound, bumps **COIN1_PULSE_COUNT** [code] at 0x8824 to queue one physical counter pulse, and adds 0x10 to a coin accumulator at 0x882b. That accumulator's high nibble (coins banked toward a credit) is compared against COINAGE_CONFIG's high nibble; once it reaches the coins-per-credit threshold, the threshold is subtracted back out of the accumulator and COINAGE_CONFIG's low nibble (credits earned) is added to **CREDIT_COUNT** [seen] at 0x8802 — clamped to a maximum of 0x63 — after which a HUD refresh command is queued. A low nibble of 0x0f is a special case that grants the maximum instead of a fixed count. **Warning:** cell 0x882b doubles as **TAMPER_ROM_CHECK_FLAG** [code]; in the coinage path it is purely the slot-1 coin accumulator, and its anti-tamper meaning belongs to a different code path that reuses the same byte.
- **Coin slot 2** (loc_5a1f) is the same machine on bit 1, using register 0x882d, accumulator 0x882e, and the second coinage byte 0x882f, and queuing its pulse in 0x8826.
- **Service credit** (loc_5a06) debounces bit 2 through register 0x8829 and, with no coinage arithmetic at all, awards exactly one credit per press.

CREDIT_COUNT is therefore a BCD credit tally, incremented by coins (per the coinage tables) or by the service button and capped at 0x63.

### Driving the physical coin counters

The two pulse generators (loc_5a9c for counter 1, and its structural twin loc_5ac0 for counter 2) turn each queued pulse into a fixed-width strobe on the cabinet's coin-counter coil. Counter 1 reads COIN1_PULSE_COUNT (0x8824); with nothing queued it returns at once. On the first tick of a pulse it seeds the phase timer **COIN1_PULSE_PHASE** [code] at 0x8825 to 0x30 and raises **COIN1_COUNTER_LATCH** [code] at 0xa183 (only bit 0 of the written value reaches the physical latch). On the following ticks it counts the phase down: at 0x18 it drops the latch, and at 0 it decrements the queued pulse count — a coil-on/coil-off waveform of fixed duration, one per coin. Counter 2 behaves identically, driving its latch at 0xa184 from the 0x8826/0x8827 pair.

### Spending credits and starting a game

Whether the attract loop is willing to leave for the start screen is decided by the credit gate (loc_15d1). If a game is already in progress it does nothing; if slot-1 coinage reads free play (0x882c == 0x0f) it advances straight in; if CREDIT_COUNT is zero it stays in attract — the "insert coin" state; otherwise, with credits banked, it forces the main game state to the start/credit display and resets the play sub-state.

The start trigger (loc_7fd6) refuses to do anything unless CREDIT_COUNT is nonzero, and only proceeds when one of the two start bits (bits 3-4 of INPUT_PORT0) is pressed and the chosen player is not already active. It then hands off to the start path (loc_0d78), which reads those two bits directly: one-player start (bit 3) routes to a branch that spends a single credit and begins a solo game, while two-player start (bit 4) requires at least two credits (it bails if fewer are banked), subtracts two, and begins a two-player game. Both branches converge on the start-of-life setup (loc_0dab), which is entered with HL preloaded — 0x0000 for one player, 0x0100 for two — and stores it as a single 16-bit write into 0x880d. Because the low byte lands in **ACTIVE_PLAYER** [seen] at 0x880d and the high byte in **TWO_PLAYER_FLAG** [seen] at 0x880e, that one store both seats the active player at player 1 and latches the player count: 0 for a solo game, 1 for a two-player game.

### Active player and two-player state

ACTIVE_PLAYER (0x880d) is a bit-0 selector between the two player banks, consulted everywhere per-player state is touched. `selectActivePlayerScoreBuffer` rotates its bit 0 to choose the live score buffer — **P1_SCORE_BCD** [seen] at 0x88a2 for player 1, **P2_SCORE_BCD** [seen] at 0x88a5 for player 2 — while saving and restoring the caller's registers so the pick is invisible to it. The same bit picks the lives bank the start trigger inspects (0x8948 vs 0x8988), the score column the per-frame worker (loc_0254) keeps refreshed, and the score MSB the bonus schedule watches.

Two-player play alternates turns by swapping a live state page against each player's saved bank. `saveLiveStateToPlayerBank` copies the live page at 0x8900 into the active player's bank (0x8940, or 0x8980 when ACTIVE_PLAYER's bit is set). When a two-player game still has the second player in the game — TWO_PLAYER_FLAG set *and* player-2 lives nonzero — the bank swap-in (`saveLivePageToPlayer0Bank`) latches ACTIVE_PLAYER to 1 so the other player's bank becomes the live one for the next turn. TWO_PLAYER_FLAG additionally gates the two-player-only setup: the second score column, the second player's lives seed, and a two-player round-entry branch (loc_1601) that consults the boot-decoded DSW1 bit parked at 0x880f alongside ACTIVE_PLAYER.

### Bonus-award schedule

BONUS_AWARD_DSW (0x8800) selects the score-milestone schedule that grants the active player its bonus award (loc_18da). A queued-milestone slot at 0x8909 holds the next threshold; when it is empty the routine reloads it from the schedule — value 0x05 when BONUS_AWARD_DSW is clear, 0x03 when set — and returns. When a milestone is armed the routine reads the active player's score MSB (0x88a4 for player 1, 0x88a7 for player 2, chosen by ACTIVE_PLAYER's bit 0) and compares it to the queued value; on a match it bumps a saturating award counter (drawn as the phase gauge) and advances the queued milestone by a BCD step — 0x08 when BONUS_AWARD_DSW is clear, 0x07 when set — so the schedule's spacing and starting point are both keyed off that one DIP bit.
## In-play progression and timers

Everything the machine does in a frame hangs off a single top-level selector, `MAIN_GAME_STATE`
(0x8805) **[seen]**. The vblank NMI service routine (loc_066d) runs once per frame: it saves the whole
register file, masks its own NMI, rebuilds the scrolling tile columns, samples the three input ports
(inverted, active-low) into the 0x8810-0x8812 edge-detect ring, ticks a pair of per-frame counters, and
then reads 0x8805 and dispatches through the word table at 0x06f0. Five destinations live there —
0->0x072d, 1->0x0899, 2->0x0c4e, 3->0x159b, 4->0x0e53 — which the golden trajectory walks as the
attract/intro/credit/play progression (0x8805 cycles 0->1->2->3, four distinct states, and state 4 is a
bare `ret`). The chosen handler returns to the NMI epilogue at 0x06fa, which copies `FLIP_SCREEN_FLAG`
(0x881f) into the flipscreen latch, restores every register, re-arms the NMI, and returns to the
interrupted program. So each state handler is one frame's worth of that mode's work, and advancing the
game is just a matter of a handler writing a new value into 0x8805.

The transition into play is the `start-of-life` routine at loc_0dab: it seats the active-player word
(0x880d), seeds `MAIN_GAME_STATE`=3, raises the in-play gate `GAME_ACTIVE_FLAG` (0x8806) **[seen]** to 1,
sets the normal-orientation flag, fires the round's opening sound events, and calls the board reset
(loc_0e00) before returning. The reverse — game over — clears 0x8806 back to 0: the play handler's own
end-of-game exits (loc_1a01 and loc_1a64 both tail into loc_1d3c when the gate is already closed) and the
teardown paths loc_1d15 / loc_1d3c zero 0x8806 and 0x880a and step 0x8805 back down toward attract. The
attract and intro states clear 0x8806 as a matter of course (loc_0c5c in the state-2 chain, and the
intro setup at loc_08b3), and the anti-tamper guard at loc_08b3 also forces 0x8806=0 on a checksum miss.
`GAME_ACTIVE_FLAG` is therefore the master in-play interlock: it is 1 only while a life is being played,
and the gameplay handlers (the sound-ring drain, the text-ring append, the play-timer tick) all bail
immediately when it reads 0.

Inside the play state (0x8805==3) the frame is driven by a second, finer selector: the in-play sub-state
index `PLAY_STATE_INDEX` (0x880a) **[seen]**. The state-3 handler loc_159b first ticks the active
player's BCD play-timer, then loads the continuation address 0x15d1 into HL and falls into the dispatcher
loc_15a1, which masks the index with 0x1f and jumps through the word table at 0x15a8; the selected leaf
returns to 0x15d1 (loc_159b's own post-dispatch tail), which returns to the NMI epilogue. The index steps
through a set of discrete phase values (1, 2, 3, 4, 7, 10, 13, 18 have all been observed) as a round is
set up and run. Among the leaves: loc_16b7 is a wait state that decrements the phase timer `PHASE_TIMER`
(0x8808) **[seen]** and simply returns until it expires, then runs the per-phase field setup, picks a
(graphic, layout) pointer pair from a decision tree keyed on `PLAY_MODE_LATCH` / `ROUND_IN_PROGRESS` /
`GAME_ACTIVE_FLAG` / `ROUND_COUNTER`, bumps 0x880a to the next sub-state, and enqueues a display command;
loc_175d ticks the `SUBPHASE_TICK` (0x88b7) **[seen]** modulo-0x1c counter and, on its wrap, fires the
0x8920 display one-shot before either arming sub-state 0x0d or running the whole level-start batch and
forcing sub-state 3; loc_1a85 repaints the phase gauge and reseeds 0x880a to the active player's base
value (0x0a for player 1, 0x0b for player 2); and the actor-teardown leaf (clearActorArenaAndCounters,
loc_2ae8) wipes the arena, zeroes the spawn/wave/rope counters, and hands off to sub-state 6.
`PLAY_MODE_LATCH` (0x8f50) **[code]** is the multi-valued mode byte those trees turn on: it holds 0 in
attract/normal play, is armed to 1 on the even-frame round-advance path (loc_1a01) and set to 2 after the
launch-script countdown at loc_1d6e finishes, and each reading routine takes a different branch per value
(loc_1a64 tails straight into the round-advance handler loc_1a01 when it is nonzero; loc_16b7 forces
sub-state 0x10 unless its bit0 is set).

The 0x8900-region cells are the round/stage/wave bookkeeping the play handlers advance. `ROUND_COUNTER`
(0x8907) **[seen]** is the top-level round number: loc_1a01 bumps it on the even-frame advance path (and
undoes the bump when it is instead arming the mode latch), it is BCD-rendered as the HUD round number, its
bit0 selects the stage-type/facing variant, and its low bits index the difficulty tables. `STAGE_COUNTDOWN`
(0x8901) **[seen]** is the per-stage depth counter: its seed value (loc_1a01 writes 0x28, or 0x30 once the
round counter reaches 2) selects the stage, it is decremented as the stage runs (loc_34b0, which also
renders it into the two HUD tiles at `HUD_STAGE_DIGIT_LO` 0x8743 **[seen]** via renderStageCountdownDigits),
and it doubles as a gate — much of the spawn/target logic bails while it is below 3, and the target-column
setup loc_191c runs only when it has reached 0. `SPEED_INDEX` (0x8900) **[seen]** is the enemy
speed/difficulty index that loc_191c computes for a new target group: it blends the difficulty DSW with
the round counter (halved and summed with the wave-arrival count when the round's bit0 is clear), clamps
the result below 0x20, and stores it, after which the velocity lookup loc_142c reads it clamped to 7 and
negates the looked-up speed per `ROUND_COUNTER` bit0; the same routine clears `PLAYER_AIM_FLAGS` and the
two adjacent cells `loc_8905`/`loc_8906` (role otherwise undetermined) in the same stroke. `SPAWN_PHASE_COUNTER`
(0x8902) **[seen]** is a per-round step counter that cycles up to 7 and is reseeded to 4 by the board/HUD
reset loc_2527 (it is snapshotted into `ROPE_DRAW_COUNT` 0x8934 **[seen]** and 0x8d43 alongside);
`WAVE_ARRIVAL_COUNTER` (0x8903) **[seen]** is set to 2 at level start (loc_175d), bumped on each enemy
arrival with its cap folding 9 back to 8, and bounds the rope-segment count; and `ROUND_IN_PROGRESS`
(0x8904) **[seen]** is the simple 0/1 flag raised to 1 when a level actually starts (loc_175d, loc_67df)
and cleared at the stage/life transitions, keying the render and state decision trees. Draining alongside
these is `GAUGE_PHASE_COUNTER` (0x8908) **[seen]**, the phase gauge: loc_1a64 counts it down one per
phase, renders it as the five-cell vertical HUD gauge (loc_03c2, drawn upward from `PHASE_GAUGE_BASE_TILE`
0x863f **[seen]**), and on reaching 0 tails into the phase-exhausted handler loc_1a96, which bumps
`PLAY_STATE_INDEX` (once for player 1, twice for player 2), clears the rope-segment and marker cells, and
folds the finished game's score into the high-score table.

Two per-player wall-clock timers run underneath all of this. loc_7912 ticks the active player's BCD
play-timer once per frame: it bails when `GAME_ACTIVE_FLAG` is clear, selects the pair belonging to the
current player off `ACTIVE_PLAYER` (0x880d) **[seen]** — player 1 uses gate `PLAY_TIMER_GATE_P1` (0x89e1)
**[code]** and bank `PLAY_TIMER_BCD_P1` (0x8a30) **[code]**, player 2 uses `PLAY_TIMER_GATE_P2` (0x89e2)
**[code]** and `PLAY_TIMER_BCD_P2` (0x8a33) **[code]** — and bails again if that player's gate byte is
set. Each three-byte bank is a frame sub-counter followed by BCD seconds and minutes digits: the base
byte counts up to 0x3b (or 0x3c, the extra frame chosen by bit0 of the seconds digit) and rolls over,
carrying into the seconds digit, whose low nibble rolls at 0x0a and whose high nibble rolls at 0x60 (i.e.
60 seconds), which in turn carries into the minutes digit on the same nibble rules. The gates are the
pause control: the board reset loc_0e00 clears both at the start of a life, and the high-score insertion
loc_1ab2 sets the finishing player's gate to 1 — freezing that player's clock — while archiving its
minutes and seconds bytes into the parallel side-table that shifts in lockstep with the high-score entries
at 0x8a00. `ACTIVE_PLAYER` (which player's banks are live) and `TWO_PLAYER_FLAG` (0x880e) **[seen]** (a
game has a second player at all) together decide which of the two timer/score/lives banks the play code
touches on any given frame.

Finally, the free-running frame clock. The NMI (loc_066d) decrements two counters every frame: a small
one at 0x883f and the free-running `FRAME_COUNTER` (0x8a5f) **[seen]**. The latter wraps continuously
(0xff down to 0 and around), its low bits phase various animations, and its zero-crossing is what gates
the periodic integrity checks — the anti-tamper ROM guards and their kin run only on the frame it reads 0
— so the whole game's slow, once-in-a-while housekeeping is paced off this one descending byte rather
than off any of the state-machine counters above.
## The actor arena

Everything that moves on the playfield -- the player, the wolves, the arrows they ride, the
balloons, the fountain, the bonus eagle -- lives as a fixed-layout record in one contiguous block
of work RAM. The block begins at `ACTOR_TABLE` **[seen]** (0x8a80) and is carved into 0x18-byte
(24-byte) records on a fixed stride. Slot 0 is the player/lead actor; the rest of the block holds
the enemy and object pools. `clearActorArena` (0x19bc) zero-fills a 0x200-byte span from the base
at board init so a fresh board starts with no stale record state, and takes no arguments -- it is
the clean-slate that every other routine here builds on. The heavier teardown
`clearActorArenaAndCounters` (0x2ae8) wipes an even longer 0x241-byte span and then clears the
spawn/wave bookkeeping alongside it -- `SPAWN_PHASE_COUNTER` **[seen]** (0x8902),
`WAVE_ARRIVAL_COUNTER` **[seen]** (0x8903) and `ROPE_SEGMENT_COUNT` **[seen]** (0x8931) all go to
zero -- before handing the in-play machine back to sub-state 6 by writing `PLAY_STATE_INDEX`
**[seen]** (0x880a). That is the actor arena's reset used when a wave collapses, distinct from the
bare board-init wipe.

### The record layout

The routines agree on a common field convention, though a given offset can carry a different
datum depending on the kind of actor. The first two bytes, `+0x00` and `+0x01`, hold the presence
and low state bits: a record is "active" when bit 0 of `(+0x00 | +0x01)` is set, and the whole
per-frame scan skips any record failing that test. `+0x02` is the state/phase byte -- the value
that state dispatchers switch on. Position is stored as two 16-bit fixed-point coordinate pairs,
fraction then integer: `+0x03`:`+0x04` and `+0x05`:`+0x06`. The player's vertical position is the
`+0x04` integer of slot 0, exposed as `PLAYER_Y` **[seen]** (0x8a84); motion helpers accumulate a
per-frame velocity from `+0x09` into a fraction and carry it up into the integer row. `+0x09` also
doubles as the display tile id in several handlers. The animation stream pointer is
`+0x0c`:`+0x0d` little-endian, `+0x0e` is its frame-hold countdown, `+0x0f` is the colour/attribute
byte and `+0x10` is the tile code. `+0x11` is a per-frame delay counter, `+0x12` an animation timer
(or a 0xff seed marker), `+0x13` a phase byte, `+0x14`:`+0x15` a back-pointer or step index, and
`+0x16`:`+0x17` a secondary script pointer with arm bits in `+0x16`. Slot 0's `+0x02` and `+0x07`
are named directly: `LEAD_ACTOR_STATE` **[seen]** (0x8a82) drives the lead actor's six-way phase
dispatch and gates spawning once it is 3 or higher, and `PLAYER_AIM_FLAGS` **[code]** (0x8a87)
carries the joystick input in its low bits and the above/on-target/below aim indicator in bits 2
and 3.

The arena is not one uniform array but a set of overlapping pools at fixed bases, each swept by its
own driver on the same 0x18 stride. The enemy actor sub-array sits at `ENEMY_ACTOR_TABLE` **[seen]**
(0x8ae0, +0x60 into the arena); the arrow/launch object's Y lives at `ARROW_Y` **[code]** (0x8ab4).
A secondary five-slot pool for smaller objects/sprites is at `SPRITE_OBJECT_TABLE` **[seen]**
(0x8b70). The per-frame object-state pool is based at `OBJECT_STATE_RECORD_BASE` **[code]** (0x8ba0)
and spans six records forward, which means it overlaps the three-slot `PROJECTILE_TABLE` **[seen]**
(0x8be8) as its fourth slot -- projectiles are just object-state records at a known offset. Further
along are the four-slot `FORMATION_TABLE` **[seen]** (0x8c30) and the three-slot
`SPAWN_OBJECT_TABLE` **[seen]** (0x8c48). Finally a two-entry enemy/target pair sits at
`ENEMY_TARGET_REC0` **[seen]** (0x8c90) and `ENEMY_TARGET_REC1` **[seen]** (0x8ca8, exactly one
stride higher), selected by parity as described below.

### Seeding fresh records

New records are stamped from ROM descriptor streams. `initActorRecord` (0x619f) writes the fixed
opening state into a fresh record -- the spawn constants `+0x00`=0x00, `+0x01`=0x01, `+0x02`=0x08,
the 0xff marker at `+0x12`, and a 16-bit datum little-endian at `+0x16`:`+0x17` -- then hands back
the advanced pointer so the caller's scan loop chains on without reloading. `seedObjectRecord`
(0x0a0c) is the two-stream variant: it pulls a two-byte descriptor into `+0x06`/`+0x04` and a
two-byte coordinate into `+0x0c`/`+0x0d`, clears the `+0x0e` timer, and returns both source pointers
advanced by two so the build loop can read the descriptor sentinel and the next coordinate.
`stampObjectAndDecCounter` (0x57e5) reads a control byte, decrements a shared one-byte counter in
place (its zero-crossing becomes the caller's loop exit), and stamps the two fixed state bytes
`+0x13`=0x01 and `+0x16`=0xc1 into the record. `adjustSpawnColumn` (0x57b4) biases a spawn column
index by wave progress in the early stages only: it leaves the column alone once `STAGE_COUNTDOWN`
**[seen]** (0x8901) has advanced to 3 or more, or while `WAVE_PROGRESS_COUNTER` **[seen]** (0x8d7d)
is still below 0x0c, otherwise it adds `(progress - 0x0c)` -- an early-stage adjustment that folds
away later.

Spawning proper is a free-slot search over a pool. The pattern recurs verbatim: point a record
pointer at the pool base, load the 0x18 stride and the slot count, and step through testing bit 0 of
`(slot+0 | slot+1)` -- the first slot with that bit clear is free. The five-slot search over
`SPRITE_OBJECT_TABLE` (0x13bc) bumps the wrapping animation-frame counter `ANIM_FRAME_COUNTER`
**[seen]** (0x8d41, skipping zero), stamps it as a sprite id, arms an animation, and seeds the
record's delay and state before tail-calling on. The three-slot search over `PROJECTILE_TABLE`
(0x3a6c) is the projectile launcher: it bumps a spawn counter, and on a free slot copies a heading
index off the launcher record, queues an animation, marks the slot active (`+0x00`=0x01), and stores
a back-pointer to the launcher in `+0x14`:`+0x15`. The rope-cell handler's three-slot search over
`SPAWN_OBJECT_TABLE` (0x2e5e) seeds a free slot with state byte 0x07 and a coordinate derived from
`ROUND_COUNTER` **[seen]** (0x8907), clamped, before blitting the segment tile. All three abort
cleanly when no slot is free.

### The per-frame object-state dispatch

The heart of the arena is the per-frame sweep. Once per frame a driver iterates six object-state
records starting at `OBJECT_STATE_RECORD_BASE`, calling `dispatchActiveObjectState` (0x7707) with
each record in turn (the loop counter and stride are parked in the alternate register set so the
handlers may use the main registers freely). `dispatchActiveObjectState` returns immediately if the
record is inactive; otherwise it takes the low two bits of the state byte `+0x02` and hands off to
one of four state handlers. The hand-off is a tail dispatch -- no continuation is stacked -- so a
handler returns straight to the sweep loop, which advances to the next record. A parallel dispatch,
`loc_64fb` (0x64fb), runs the fountain record (the third slot of the `SPAWN_OBJECT_TABLE` region at
0x8c78): its full state byte `+0x02` (0, 1 or 2) selects one of three handlers, again as a tail
hand-off. A third, gated dispatch (0x6822) services the enemy record at 0x8b28: it returns without
doing anything while `ENEMY_REC_DISPATCH_GATE` **[code]** (0x8afa) is zero, and only when that gate
is nonzero does it dispatch the record's `+0x02` state through its own three-way table.

### State stepping and motion

The handlers reached by dispatch mostly step one actor's motion or advance it to its next state.
`advanceFallStep` (0x3fd5) is the gravity step: it adds the fall velocity `+0x09` into the vertical
fraction `+0x03`, carrying one whole row into `+0x04` on an 8-bit overflow, and reports carry-set
(still airborne) until the integer row reaches the landing row 0x1e. `loc_667c` (0x667c) is the
mirror for the other coordinate pair: while the record's `+0x01` state byte is idle it adds `+0x09`
into `+0x05`, carrying into `+0x06`, and retires the record (state `+0x01`=2, `+0x04`/`+0x06`
cleared) once `+0x06` reaches the retire row 0x1d. `advanceActorDropStateOnDelay` (0x24db) is a
timed drop/settle: it counts the `+0x11` delay down and, only at zero, nudges the actor
(`+0x04`+=4, `+0x06`-=8), restamps the display tile at `+0x0f`, reseeds the delay to 0x30 and bumps
the dispatch state `+0x02`. `advanceRisingActorStep` (0x2ab3) is the lift/rise step (state 6): it
reloads a short delay, toggles the display tile between 0x15 and 0x1e every fourth frame, and drives
`+0x06` upward; while below the top (0xc0) it returns, and on reaching the top it nudges the base Y
down 3, advances the state and seeds a long inter-state delay of 0x40.

Several handlers advance an actor from one phase to the next, arming a new animation as they go.
`loc_66fd` (0x66fd) runs a phase countdown shared across actors: it idles while `SHARED_PHASE_GATE`
**[code]** (0x8930) is clear, decrements `SHARED_PHASE_COUNTDOWN` **[code]** (0x892e) while it is
live, and on expiry reloads the countdown, bumps the actor's phase `+0x02`, reseeds its coordinate
and field bytes, points it at an animation sequence and stamps the phase tile id 0x2c into `+0x09`.
`loc_683a` (0x683a) is the plainer next-state advance: bump `+0x02`, zero the two sub-position
fractions, seat `+0x04`=0x08 and `+0x06`=0x1e, arm the animation from a ROM parameter block, then
seat `+0x09`=0x18. `loc_2c85` (0x2c85) is a guarded transition -- it acts only on a record sitting
in state 0x11, moving it to 0x12, arming an animation sequence, seeding the secondary script pointer
`+0x16`:`+0x17` and clearing the script step `+0x15`; records in any other state are untouched.
`loc_141c` (0x141c) gates a spawn/queue step on the phase field `+0x06`: at or above 2 it leaves the
record alone, otherwise it clears `+0x08` and restarts the actor's animation.

### Animation stepping

An actor is pointed at an animation by `setActorAnimation` (0x381e) or its sibling
`storeActorAnimationPointer` (0x5c75): both write a 16-bit sequence pointer little-endian into
`+0x0c`:`+0x0d` and reset the frame/step index `+0x0e` to zero, so the actor restarts its sequence
from the top. The armed sequences are ROM tables such as `ANIM_TABLE_3829` **[code]** (0x3829) and
the parameter block `ANIM_PARAM_68EF` **[code]** (0x68ef); a record's secondary script fields are
seeded from `RECORD_ANIM_SEQ_2CA7` **[code]** (0x2ca7) and `RECORD_SCRIPT_2D00` **[code]** (0x2d00).

Two routines then walk that per-record stream frame by frame. `advanceActorAnimFrame` (0x403c) and
its twin `loc_4006` (0x4006) treat `+0x0e` as a frame-hold: while non-zero it decrements and the
current frame simply holds. On expiry the routine reads the stream at `+0x0c`:`+0x0d`; a 0xff opcode
reloads that pointer from the next two stream bytes and re-reads (a jump), and any other byte begins
a three-byte frame record -- tile into `+0x10`, colour into `+0x0f`, new hold into `+0x0e` -- after
which the advanced pointer is written back to `+0x0c`:`+0x0d`.

A distinct animator, `loc_22e6` (0x22e6), steps an actor from a *shared* script cursor rather than a
per-record pointer. It too holds while `+0x0e` is non-zero; at zero it pulls the next entry from
`ANIM_SCRIPT_CURSOR` **[seen]** (0x8f00). A normal entry is a {tile, colour, delay} triple copied
into the record and the cursor is advanced past it; a 0xff lead byte is a control marker whose two
following bytes replace the cursor (an inline jump). There is a rival path that would fully reset the
cursor to the base script `ANIM_SCRIPT_RESET_PTR` **[code]** (0x26e7), but it fires only if
`foldTargetPresenceBits` returns 3, which it never does (that fold seeds zero and is only rotated),
so in practice the marker always resolves as the inline jump. **Note:** the full-reset branch is
present and faithful in the code, but under the current fold it is unreachable -- reading it as a
live reset would be a mistake.

Frame-hold and phase have a separate ticker. `tickActorAnimHold` (0x5d1e) advances one record's
animation-hold: it proceeds only for a per-record animate bit (or, failing that, only on even
rounds by `ROUND_COUNTER`), and only for an active, armed record; it counts the `+0x12` timer down
and, at zero, steps the two-bit phase `+0x13` down and re-arms, disarming `+0x16` at phase end.
`loc_5d0b` (0x5d0b) runs that ticker across the six records of `ENEMY_ACTOR_TABLE` on the 0x18
stride. `clearBit2AcrossSixSlots` (0x0e46) is a small companion that clears bit 2 of the first byte
in each of six stride-4 entries -- used to drop a per-slot flag across a rank of sprite records.

### Rendering the arena to sprites

The behavioral records are projected into the hardware sprite display list each frame.
`deriveStackedSpriteYs` (0x23d7) fans the player's base `PLAYER_Y` out to three stacked slots -- the
player is drawn as three vertically stacked sprites, so slot 3 gets the base Y, slot 2 gets Y-0x10
and slot 1 gets Y-0x10+0x0a. `copyObjectRecordsToDisplayList` (0x032a) copies four raw record bytes
per object -- `+0x06`, `+0x10`, `+0x04`, `+0x0f` (coordinate, tile, coordinate, colour) -- into four
successive display-list slots, stepping the record pointer by a caller-supplied stride and wrapping
within the list's 256-byte page. `loc_0343` (0x0343) is the moving-object variant: instead of raw
coordinate bytes it derives screen coordinates from the fixed-point pairs -- a 16-bit
fraction:integer pair reduced to a pixel by `(pair >> 5) - 8` -- from `+0x05`:`+0x06` and
`+0x03`:`+0x04`, interleaved with the raw tile `+0x10` and colour `+0x0f`. These lists feed the
sprite records at `SPRITE_DISPLAY_LIST` **[seen]** (0x8840), `SPRITE_ACTOR_RECORD_SLOTS` **[seen]**
(0x8848) and the target/collision slots at `SPRITE_TARGET_SLOTS` **[seen]** (0x887c).

### Collision

Collision works on the rendered sprite geometry, not the behavioral records directly.
`precheckCollisionBounds` (0x5f53) biases a sprite entry's X by the screen orientation -- +6 upright,
-2 flipped, keyed on `FLIP_SCREEN_FLAG` **[seen]** (0x881f) -- forms `+0x00 + bias` as the biased X
and `+0x02 + 8` as the biased Y, and reports carry-set when that Y still clears the bottom limit
0xe0; a caller reads the off-screen gate first, then the two coordinates. The full proximity scan
(0x6435) takes a reference actor and walks three objects in lockstep -- a stride-4 sprite entry for
geometry and the 0x18 object record for the active test -- selecting the player-1 or player-2 tables
by `PLAY_MODE_LATCH` **[code]** (0x8f50). An object hits when it is active and within +/-7 of the
reference in both X and Y (with an orientation bias of +5 upright / -2 flipped). On a hit the struck record is reset
(`+0x00`=0, `+0x01`=1, `+0x02`=2, `+0x11`=0x20), a per-parity hit flag is raised -- `OBJ_HIT_FLAG_I0`
**[seen]** (0x8d1b) or `OBJ_HIT_FLAG_I1` **[seen]** (0x8d1c), chosen by the I register -- effects and
a sound are enqueued, and the hit tally `HIT_TALLY` **[code]** (0x8f52) is bumped. The struck object
is later torn down by the object-state step at 0x21cf, which clears the raised hit flag and blanks
0x18 tiles at the record's screen address.

The two-entry target pair is addressed by parity. `loc_5f83` (0x5f83) picks `ENEMY_TARGET_REC0`
when the I register is zero and `ENEMY_TARGET_REC1` otherwise, reads that record's type byte, and --
type 0 aside -- latches it into `ACTIVE_OBJECT_TYPE` **[seen]** (0x8d44) before falling through into a
six-slot scan of `ENEMY_ACTOR_TABLE`. `foldTargetPresenceBits` (0x22d0) rotate-folds the presence
bit (byte-0 bit 0) of those two records into an accumulator: it rotates the accumulator left once per
present target. Seeded from zero it always resolves to zero -- which is exactly why the reset branch
in `loc_22e6` above stays dormant -- but the rotate is reproduced faithfully for any seed. The active
enemy population is tracked in `ACTIVE_ENEMY_COUNT` **[seen]** (0x8d40), incremented on spawn and
decremented on despawn, and spawn cadence is paced by `ENEMY_SPAWN_TIMER` **[seen]** (0x8d07).

### The bonus-eagle wave

The eagle wave reuses the same enemy-actor records. `loc_72e1` (0x72e1) seeds the next wave, but only
while the target slot `ENEMY_TARGET_REC0` is clear: it raises `WAVE_LAUNCH_FLAG` **[code]** (0x8f3a)
and advances `WAVE_INDEX` **[seen]** (0x8f3d); on the fourth wave it merely re-arms the outer phase
`WAVE_OUTER_PHASE` **[code]** (0x8f38) and reloads the hold timer `WAVE_HOLD_TIMER` **[seen]**
(0x8f36). Otherwise it initialises two records per wave index in `ENEMY_ACTOR_TABLE` from the
four-byte-per-record `EAGLE_WAVE_PARAM_TABLE` **[code]** (0x7409) -- each marked active with four
copied fields, plus a flag byte into `+0x03`/`+0x05` -- records the count in `WAVE_RECORD_COUNT`
**[code]** (0x8f3c), and clears the outer phase and `WAVE_RECORDS_ARRIVED` **[seen]** (0x8f39). The
eagle's advance across the grid is policed by `loc_7287` (0x7287): while its grid coordinate (record
`+0x04` of the slot-0 target) is short of the grid edge 0xd0 it just hands the coordinate back so the
approach machine keeps stepping; once it reaches the edge it arms `EAGLE_FINISH_FLAG` **[code]**
(0x8f3e) and runs the reset epilogue `advanceEaglePhaseAndClearAim` (0x7292), which drops
`PLAYER_AIM_FLAGS` and the latched enemy X `LATCHED_ENEMY_X` **[seen]** (0x8f5b), advances the
eagle-wave outer phase and clears the records-arrived count so the next phase starts fresh.
## Waves, rope and launch

Three cooperating state machines drive the attack: the bonus/eagle attack wave that seeds and
paces the enemy records, the rope band that the hunters ride up and down, and the arrow/rope-launch
sequence that fires and tracks the shot. They share a good deal of scratch state in the
0x8f00-0x8f4e block, which is why a single board reset (below) wipes all three at once.

### The bonus / eagle attack wave

The eagle attack is driven once per frame from the bonus-phase body `loc_72a0`, which first runs
the shared per-frame actor update and then calls the eagle-launch driver `loc_72a7`. The driver's
opening move is a one-shot: while the eagle-wave launch flag WAVE_LAUNCH_FLAG **[code]** (0x8f3a) is
still clear it calls `loc_72e1` to seed a fresh wave and returns; only once that flag is raised does
it fall through to actually running the wave already on screen.

Seeding (`loc_72e1`) is itself gated — it fires only while the lead enemy/target record
ENEMY_TARGET_REC0 **[seen]** (0x8c90) is empty, so a new wave cannot stomp one still in flight. It
raises WAVE_LAUNCH_FLAG and advances the wave index WAVE_INDEX **[seen]** (0x8f3d). The fourth wave
is special: on reaching index 4 the routine seeds no records at all — it merely bumps the eagle-wave
outer-phase counter WAVE_OUTER_PHASE **[code]** (0x8f38) and reloads the inter-wave hold
WAVE_HOLD_TIMER **[seen]** (0x8f36) to 0x20, deferring to the idle path. For waves 1-3 it computes a
record count of twice the wave index into WAVE_RECORD_COUNT **[code]** (0x8f3c) and initialises that
many records in the enemy-actor table ENEMY_ACTOR_TABLE **[seen]** (0x8ae0), stride 0x18. Each record
is marked active (state 1) and takes four bytes copied out of the four-byte-per-record parameter
table EAGLE_WAVE_PARAM_TABLE **[code]** (0x7409) into fields +6, +0x10, +4 and +0x0f; a record whose
own low address has bit 3 set additionally gets a flag byte (0x80) at +3, and every record gets that
flag at +5. It closes by zeroing WAVE_OUTER_PHASE and the records-arrived sub-count
WAVE_RECORDS_ARRIVED **[seen]** (0x8f39) so the wave starts fresh.

Once launched, `loc_72a7` reads WAVE_RECORD_COUNT: if it is zero the wave is empty and control
tail-jumps to the idle/between-waves handler `loc_73e3`; otherwise it walks 2x WAVE_INDEX records of
the enemy-actor table (IX stepping 0x18) and runs the per-record eagle state machine on each. The
idle handler `loc_73e3` ticks WAVE_HOLD_TIMER down one per frame; on expiry, if a wave index is still
set it queues the per-wave eagle sound (base 0x06b0 plus WAVE_INDEX), then reseeds the hold to 0x18
and clears WAVE_LAUNCH_FLAG — re-arming the one-shot so the next `loc_72e1` call can seed the
following wave. This is the loop that spaces successive eagle waves apart.

The eagle's march across the grid is policed by the grid-advance guard `loc_7287`. It reads the
eagle's advancing grid coordinate (field +4 of ENEMY_TARGET_REC0); while that value is short of the
grid edge (0xd0) it simply hands the coordinate back, and the approach machine derives its grid-loop
count from it and keeps stepping. The instant the coordinate reaches the edge, the guard latches the
grid-advance done flag EAGLE_FINISH_FLAG **[code]** (0x8f3e) and runs the phase-reset epilogue
`advanceEaglePhaseAndClearAim`, which drops the player's aim-indicator flags PLAYER_AIM_FLAGS
**[code]** (0x8a87) and the latched enemy X LATCHED_ENEMY_X **[seen]** (0x8f5b), advances
WAVE_OUTER_PHASE one step, and clears WAVE_RECORDS_ARRIVED — then hands back zero so the approach
loop unwinds into its reset.

### The rope band and its cells

The rope is the vertical band the hunters climb, and it is kept up by two cooperating pieces: an
extend driver that grows the band a segment at a time, and a per-cell state machine that animates
each active segment on its own clock.

Extension is `loc_2d80` (state 0 of the rope machine at 0x8f14). It steps the extended-segment count
ROPE_SEGMENT_COUNT **[seen]** (0x8931) upward, but only up to two below the per-stage arrival counter
WAVE_ARRIVAL_COUNTER **[seen]** (0x8903) — when the count has already reached that bound it returns
without growing, so the rope length tracks how far the stage has progressed. A second gate holds
extension unless fewer than four cells are active (or the ROM-tamper strike cell at 0x89ef is set).
On a successful step it advances the active-cell index (0x8f18), looks up an 0x84xx video-column base
from a ROM table (0x2db8) and stores it as that segment's draw pointer (0x8f19), seeds the new cell's
frame timer to 0x10 in the timer bank, and arms the machine's sub-timers (0x8f14/0x8f16).

The per-frame animation of the band hangs off `loc_25a6`, the pull-rope / lift sprite driver, which
works from a sprite draw pointer stored at 0x8932. When the round counter ROUND_COUNTER **[seen]**
(0x8907) has bit 0 set it drives the lift sprite directly — extending, retracting or holding the
column of segment sprites according to a direction flag at 0x8920 and the draw count ROPE_DRAW_COUNT
**[seen]** (0x8934), and appending a display command when the direction flag is zero. When bit 0 is
clear it instead hands off to the even-frame branch `loc_2d66`, which aborts if a grab is already
under way (GRAB_ACTIVE_FLAG **[seen]** 0x8d32) or the arrival counter equals 2, and otherwise runs
the rope-tile driver followed by the rope-cell writer `loc_2e22`.

`loc_2e22` walks one record per active cell (IX over the cell records based at 0x8f1c, count taken
from 0x8f18) and dispatches each through `loc_2e36`. That dispatcher skips a cell whose state byte
(IX+0) is zero, and otherwise vectors on (state - 1) into one of four rope-cell handlers. Every
handler shares one timer helper, `loc_2e45`, which decrements the cell's own frame timer — one of
four stride-2 counters in ROPE_CELL_TIMERS **[code]** (0x8f28), selected by the low two bits of the
cell's address — and reports reached-zero; each handler returns early while its timer has not
elapsed, so a cell only advances on its own cadence.

The four states carry a segment through its life. State 1 (`loc_2e5e`), additionally gated on the
low two bits of the free-running FRAME_COUNTER **[seen]** (0x8a5f), re-arms the timer and allocates a
free slot in the three-entry spawned-object table SPAWN_OBJECT_TABLE **[seen]** (0x8c48), seeding it
with state 0x07, a tile-column value derived from ROUND_COUNTER (clamped at 0x10), and coordinates
pulled from a small ROM lookup keyed by the cell index — then it advances the cell and blits the
segment tile. State 2 (`loc_2ecb`) writes a tile index derived from ROUND_COUNTER into the cell, then
indexes the formation table FORMATION_TABLE **[seen]** (0x8c30) by the cell's paired byte to bump
that record's tile field, clear its low position byte and drop another field, before advancing and
blitting. State 3 (`loc_2f01`) first runs the grab test (below) and bails out for the frame if it
fires; otherwise it writes a fixed tile, reaches into the linked formation record to drop its tile
and force its low position to 0xc0, then advances and blits. State 4 (`loc_2f2f`) is the retract:
while any segments remain (ROPE_SEGMENT_COUNT nonzero) it selects a retract-animation pointer from a
ROM table (0x2f93) keyed by ROUND_COUNTER >> 2 (clamped to 3) plus a bit of the DSW byte
DIFFICULTY_DSW **[code]** (0x8820), reads a per-segment attribute byte for index
ROPE_SEGMENT_COUNT - 1 (clamped to 0x1f) out of ROM, merges it into the paired cell, clears the
linked 0x8c30 formation record, then advances the cell and blits the final segment.

The grab, `loc_305f`, is what state 3 gates on. It looks up a catch-window half-width from a ROM
table keyed by the cell index and tests it against the player-actor position PLAYER_Y **[seen]**
(0x8a84); if the player is outside the window the routine returns normally and state 3 continues.
Inside the window — and only when neither the formation-teardown state WAVE_TEARDOWN_STATE **[seen]**
(0x8f24) nor the formation launch state FORMATION_STATE **[seen]** (0x8f08) is busy — it fires the
grab: it sets GRAB_ACTIVE_FLAG to 1, queues a sound, and returns through a caller-skip that aborts
state 3 for this frame. Thereafter GRAB_ACTIVE_FLAG reads as "busy" both to the rope even-frame
branch (`loc_2d66`) and to the spawn/event routines while the grab plays out.

Two resets bound the rope. On phase exhaustion (`loc_1a96`, reached when the phase-gauge count drains
to zero) the band is torn down: ROPE_SEGMENT_COUNT is zeroed alongside the lift/marker pointer word
at 0x8932 and a further flag at 0x89fc, and the play sub-state is bumped to move the stage on. The
broader board/HUD reset `loc_2527` — run at board start and on life transitions — clears the whole
0x8f00 scratch block (0x4f bytes from 0x8f00, which spans every rope and launch cell described here)
and, once the spawn-phase counter (0x8902) has reached 7, reseeds ROPE_DRAW_COUNT to 4 and clears the
0x20-byte 0x8920 direction/anim region; it is also where the band-built latch ANIM_ARMED_LATCH
**[code]** (0x8f63) is cleared.

### The arrow / rope-launch state machine

The launched shot is a five-state machine on LAUNCH_STATE **[seen]** (0x8f30). It is driven once per
frame from the sub-dispatch `loc_2101`, which calls the launch driver `loc_2778`; the driver masks
LAUNCH_STATE to its low three bits and vectors into handlers 0..4.

State 0 (`loc_278f`) arms and gates the launch. Arming is a one-shot on the armed flag
LAUNCH_ARMED_FLAG **[seen]** (0x8f3f): while that flag is clear the handler decides whether to arm.
If the lane-spawn countdown LANE_SPAWN_COUNTDOWN **[seen]** (0x8d75) is still running and the arm
latch LAUNCH_ARM_LATCH **[seen]** (0x8f20) is clear, it bumps the latch and arms unconditionally;
otherwise it requires the stage countdown STAGE_COUNTDOWN **[seen]** (0x8901) to be nonzero and an
exact multiple of eight before it will arm (else it returns and waits another frame). Once armed, it
still will not advance until the arrow has risen far enough — the arrow object's Y ARROW_Y **[code]**
(0x8ab4) must be at least 0x3c — and neither hunter-target record, ENEMY_TARGET_REC0 (0x8c90) nor
ENEMY_TARGET_REC1 **[seen]** (0x8ca8), has its hit bit (bit 1) set. With those gates clear it steps
LAUNCH_STATE, reseeds the tile-flip countdown LAUNCH_FLIP_COUNTDOWN **[code]** (0x892f) to 8, may
light the launch HUD cell LAUNCH_HUD_TILE **[code]** (0x8508) when the game is idle (GAME_ACTIVE_FLAG
**[seen]** 0x8806 is zero) but a play-mode or armed latch is set (PLAY_MODE_LATCH **[code]** 0x8f50
or the armed flag), refreshes LAUNCH_ARM_LATCH from its seed value LAUNCH_ARM_LATCH_SEED **[code]**
(0x8d7a) when that seed is nonzero, and finally blits the 2x2 launch tile from LAUNCH_TILE_SRC
**[code]** (0x2d51) to LAUNCH_TILE_VRAM **[code]** (0x84a7).

State 1 (`loc_27f3`) waits on the arrow's climb. While ARROW_Y is still at or above 0x34 it only
animates the tile: it counts LAUNCH_FLIP_COUNTDOWN down each frame, and on expiry reloads it to 0x10
and toggles the shared phase byte SHARED_PHASE_COUNTDOWN **[code]** (0x892e), whose bit 0 selects
between the two launch tiles (0x2d51 / 0x2d55). Once the arrow descends below 0x34 the state instead
scans the two-entry hunter-target table (0x8c90) for a free slot; finding one it advances
LAUNCH_STATE to 2, seeds a new hunter actor record (in the actor table around 0x8a99), and lights the
HUD cell when the same play-mode/armed condition holds.

State 2 (`loc_2856`) — unless PLAY_MODE_LATCH is set — finds the first empty slot in the six-entry
hunter table at 0x8c78 (records stepping downward by 0x18) and seeds a hunter there (state, anim,
coordinates and tiles at +1..+0x10), recording its pointer at 0x8f32. It then bumps LAUNCH_STATE and
either advances a sub-counter (when a flip flag at 0x8f61 is set) or seeds a 0x20-frame hold at
0x8f34 and enqueues a display command. State 3 (`loc_28ad`) runs that 0x8f34 hold down and returns
while it is nonzero; on expiry it bumps LAUNCH_STATE to 4 and — again unless PLAY_MODE_LATCH is set —
clears the 0x18-byte hunter record whose pointer was saved at 0x8f32. State 4 (`loc_28c5`) is a bare
return: the machine idles there until LAUNCH_STATE is reset.

The launch's arming state is torn back down from two directions. The board reset `loc_2527` clears
LAUNCH_ARMED_FLAG and LAUNCH_ARM_LATCH as part of wiping the 0x8f00 block, and on object arrival
`loc_3be3` zeroes LANE_SPAWN_COUNTDOWN and LAUNCH_ARM_LATCH together — releasing the arm gate so the
next shot can rearm.
## Rendering, HUD and display lists

Everything the machine draws lands in one 0x8000-page video RAM, split into two
0x400 halves. The low half, 0x8000-0x83ff, is the colour/attribute map — `ATTRIB_MAP_BASE`
[seen] at 0x8040 is its working base. The high half, 0x8400-0x87ff, holds the tile codes:
`PLAYFIELD_TILE_BASE` [code] at 0x8402 anchors the playfield, and the HUD columns and panels
live above it around 0x8500-0x87ff. The screen is addressed column-major for a vertical
cabinet: one screen row is 0x20 cells apart, so nearly every painter here steps its cursor by
+0x20 to walk *down* a column and by -0x20 to walk *up* one. Sprites are handled separately,
through a 24-entry display list at `SPRITE_DISPLAY_LIST` [seen] (0x8840) that is rebuilt each
frame and handed to sprite hardware.

### Clearing and filling the tile map

The whole-screen tile fill is a two-cell handshake. `seedTileFillCursor` arms it: it stores the
caller's pointer as the 16-bit write cursor `TILE_FILL_PTR` [seen] (0x880b) and seeds the
row counter `FILL_ROW_COUNTER` [seen] (0x8809) to 0x20 — thirty-two rows to fill — then hands
back 0x20 in A so the caller can kick its watchdog. `loc_02e3` is the fixed-address entry to the
same arming, always pointing the fill at `PLAYFIELD_TILE_BASE` (0x8402); the fill loop that walks
the pair down lives elsewhere, one row per pass. The generic constant-run fill primitive
`loc_0010` [code] backs the coarser clears: it stores a fixed byte down a run and advances the
pointer, a zero length meaning a full 256-byte pass (the hardware djnz wrap), and it is what
callers use to blank a swath of VRAM before stamping fresh content over it.

Narrow work is done a column at a time. `paintColumnBodyTiles` writes the two body tiles of a
three-tile column — a middle tile 0x25 one row-stride on, then a base tile 0x20 another stride
on — and `loc_02a8` prefixes it with a cap tile 0x01 to stamp the full three-cell column top to
bottom. `paintColumnBodyTilesUp` is the upward-stepping twin: from the caller's cell it climbs
one fixed row (-0x20) for the mid tile and another for the base, and `loc_1ce7` caps that variant
with tile 0x02 at `COLUMN_CAP_VRAM` [code] (0x84e0) before painting the body upward. `blankTileColumn`
is the eraser: it floods the blank tile 0x10 into three cells one stride apart and returns the
advanced pointer so a caller can chain column after column, scrubbing a scrolled-away strip.

### The colour/attribute map

`fillAttributeColumns` floods the colour map. Walking 31 columns from `ATTRIB_MAP_BASE`, it takes
one source byte per column and stamps it down all thirty rows at the 0x20 stride, the source
pointer advancing one byte per column — so each screen column gets a single flat colour. It leaves
0x1f in A (the loop's terminal `L & 0x1f`), a leftover a caller happens to stash but which carries
no meaning.

`loc_1dd3` [code] is the per-field colour painter that decides *which* attribute job to run from the
game's own flags. Reading `ROUND_IN_PROGRESS` [seen] (0x8904), `GAME_ACTIVE_FLAG` [seen] (0x8806)
and the `ROUND_COUNTER` [seen] (0x8907), it takes the alternate job only when a round is idle, the
game is active, and the round is odd or zero — and even then only while the `PLAY_MODE_LATCH` [code]
(0x8f50) is clear. The alternate job floods from `FIELD_ATTRIB_SRC_C` [code] (0x0859) and then stamps
a sixteen-row single-column strip of colour 0x09 down from `FIELD_C_ATTRIB_DEST` [code] (0x811c). The
default job instead floods from `FIELD_ATTRIB_SRC_A` [code] (0x0839) on an odd round or
`FIELD_ATTRIB_SRC_B` [code] (0x0879) on an even one, then paints a short four-row marker of colour
0x0f into columns 5 and 6 — the round-parity source table is what recolours the playfield as the
game advances.

### Count column and background tile animation

`loc_039b` draws the small vertical count gauge at `COUNT_COLUMN_VRAM` [code] (0x8482). It paints
nothing unless `GAME_ACTIVE_FLAG` is set; otherwise the fill height is the lead value in the
`ACTOR_TABLE` [seen] (0x8a80) plus one, clamped to the eight-cell column. It stamps that many fill
tiles (0x0c) down the column, then blanks the rest with tile 0x10 — a live readout of the actor
count. A zero fill height deliberately runs the full 256-cell wrap, faithful to the hardware
down-counter it mirrors.

A small tile strip in the high VRAM half animates continuously through a cursor pair. `TILE_ANIM_PARITY`
[seen] (0x8f37) is bumped every frame and decides which half of the animation runs.
`advanceTileAnimForwardOnOdd` acts on odd frames: it reads the 16-bit `TILE_ANIM_CURSOR` [seen]
(0x88be), and if the tile code under it has reached the wrap code 0x37 it steps the cursor forward one
cell and reseeds that cell to 0x34, otherwise it bumps the current cell's tile code up by one — a tile
that cycles then marches to the next cell. `retreatTileAnimScript` is the even-frame half and runs the
motion in reverse: a 0x34 marker reloads the base code 0x10 and backs the cursor up one cell, any other
value decrements in place. The two together sweep a code range back and forth across a run of cells.

### The tile-block blitters

Two low-level blitters copy fixed rectangular source patterns into VRAM.

`blit2x2TileBlock` copies four source bytes into a 2x2 square anchored at the destination — top-left,
top-right, then bottom-right at +0x21 and bottom-left at +0x20 — and returns the destination advanced to
the bottom-left cell (dst+0x20), which the two-tile animators read to step one row up before their next
blit. `paintTileBlock2x2` and `paintTileBlock2x2Above` are the memory-only variants: the first anchors at
the top-left and reads its four source bytes in top-left / top-right / bottom-right / bottom-left order;
the second anchors at the bottom-left with the top row one row up, reading bottom-left / bottom-right /
top-right / top-left. `loc_0a52` uses `paintTileBlock2x2` twice to stamp one shared four-byte pattern
`TILE_BLOCK_2X2_SRC` [code] (0x0a72) at two anchors, `VRAM_TILE_BLOCK_DEST_A` [code] (0x82aa) and
`VRAM_TILE_BLOCK_DEST_B` [code] (0x826a).

`blitTile3x3Block` [code] stamps a three-wide, three-tall block: three source bytes to consecutive cells
per row, then +0x1d to reach the next screen row (3 written + 0x1d = a full 0x20 line). It advances
*both* pointers on exit — HL to dst+0x60 and DE to src+9 — because a chained caller stamps the next block
straight from the advanced source. `blitGlyphBlock4x3` is the taller sibling for a 4-row, 3-column glyph:
each row copies three bytes advancing only the destination low byte (so the row stays inside its tilemap
page) then steps +0x1d, and it too returns both advanced pointers, HL at dst+0x80, because a caller
memsets through the returned HL right after.

`loc_1ffb` selects one of two fixed 3x3 glyph sources by bit 5 of its selector — `GLYPH_TILES_A` [code]
(0x203b) when clear, `GLYPH_TILES_B` [code] (0x2050) when set — and stamps it through `blitTile3x3Block`
into `GLYPH_BLOCK_DEST` [code] (0x8062). (That destination sits in the 0x8000 colour/attribute half, so
this particular glyph stamp writes attribute bytes rather than tile codes; the same 3x3 blitter serves the
round marker below, which writes into the tile half instead.)

### Animated squares, the ready marker and the blink

Several small on-screen graphics are frame-gated two-tile animations built on `blit2x2TileBlock`.
`loc_2563` runs while the `PLAY_MODE_LATCH` is idle: a hold countdown `TWOTILE_ANIM_HOLD` [code] (0x8f06)
ticks down each frame and, on expiry, reloads to 0x0c and advances the phase `TWOTILE_ANIM_PHASE` [code]
(0x8f07). The round parity and the phase parity together index one of four 4-byte source blocks (stride 4)
in `TWOTILE_SRC_TABLE` [code] (0x2744) and pick one of two anchors — `READY_SPRITE_TILE_VRAM` [code]
(0x87bb) on an odd round or `TWOTILE_ANIM_VRAM_ALT` [code] (0x84bb) otherwise — and that block is stamped
as two 2x2 squares, the second three rows above the first (the 0x60 gap). `loc_6b13` is a simpler cousin:
the same hold/phase countdown, but the phase's low bit alone picks one of two adjacent blocks from the
same table, stamped at `BLIT_SCREEN_ANCHOR` [code] (0x84b4) and again two rows up.

`loc_2bd3` paints the ready-sprite square: unless the anchor cell `READY_SPRITE_TILE_VRAM` already holds
the painted marker 0xba, it stamps `READY_SPRITE_SRC` [code] (0x2be1) there as a 2x2 block — a
paint-once guard. The launch-tile square is stamped the same way by the launch-state handler `loc_278f`,
which tail-blits `LAUNCH_TILE_SRC` [code] (0x2d51) into `LAUNCH_TILE_VRAM` [code] (0x84a7) once its
gameplay preconditions clear.

`loc_76af` drives a two-tile blink. A countdown `BLINK_COUNTDOWN` [code] (0x892a) ticks down and, on
expiry, reloads to 0x16, toggles `BLINK_PHASE` [code] (0x892b), and picks one of the two 2-byte pairs in
`BLINK_TILE_PAIRS` [code] (0x76e6) by phase parity, writing the pair into two cells 0x40 apart from
`BLINK_TILE_CELL_0` [code] (0x8471) — swapping the blinking tiles on a fixed cadence.

### The round marker

`loc_4a0b` draws the round marker and only runs when the `ROUND_COUNTER`'s low bit is set. It first
snapshots the spawn-phase count `SPAWN_PHASE_COUNTER` [seen] (0x8902) into `SPAWN_PHASE_SNAPSHOT` [code]
(0x8d43) and `ROPE_DRAW_COUNT` [seen] (0x8934). For a nonzero count it paints that many stacked pairs of
a two-wide marker down a column from `MARKER_VRAM_BASE` [code] (0x86c3) — tiles 0xda/0xdb on the upper row
and 0xd8/0xd9 one row below, stepping up 0x20 per pair — saves the column layout pointer into
`MARKER_LAYOUT_PTR` [code] (0x8932), and stamps `MARKER_GLYPH_SRC` [code] (0x2754) as a 3x3 glyph beneath
the column. For a zero count it saves the alternate layout pointer and stamps the glyph at the fixed
anchor. The saved layout pointer differs by one row between the two paths, so a later reader lands on the
right cell for the count it drew.

### HUD number machinery

Scores and counters are packed BCD, and a small stack of helpers turns them into stacked digit tiles.

Two converters feed the pipeline. `byteToPackedBcd` turns a binary byte into packed BCD mod 100 the Z80
way — BCD-correcting the low nibble, adding decimal 16 once per high-nibble unit, then folding the low
digit back — every step a faithful daa. `binToPackedBcd` counts a binary value up in BCD to produce the
low two decimal digits in A plus a hundreds tally in C, a zero count meaning a full 256 passes (so it
returns 0x56 with hundreds = 2).

Three painters emit the tiles. `splitBcdByte` takes one packed byte, writes its low (units) nibble as a
tile at the cursor, advances the cursor, and hands back the high (tens) nibble with a leading-zero sense
(high == 0). `renderDigitWithBlanking` paints a single digit with leading-zero suppression, threading a
cursor and a blank *budget* across a field: a real digit ends the blank run, a zero spends one unit of
budget as the blank tile 0x10, and once the budget is spent a zero draws as a genuine "0". `drawStackedBcdDigits`
paints a whole packed byte as two stacked tiles — tens at the cursor, units one row up — with the tens
zero suppressed to a blank.

The scores use these through `selectActivePlayerScoreBuffer`, which picks the live 3-byte BCD buffer by
bit 0 of `ACTIVE_PLAYER` [seen] (0x880d): `P1_SCORE_BCD` [seen] (0x88a2) when even, `P2_SCORE_BCD` [seen]
(0x88a5) when odd. `loc_056b` draws one of three counters down its column, selected 0/1/2: player 1 from
`P1_SCORE_BCD` into `P1_SCORE_VRAM` [code] (0x8781), player 2 from `P2_SCORE_BCD` into `P2_SCORE_VRAM`
[code] (0x8521), or the high score from `HIGH_SCORE_BCD_HI` [seen] (0x88aa) into `HIGH_SCORE_VRAM` [code]
(0x8641). Each of the three bytes is split into its high then low digit and painted one cell apart up the
column, most-significant byte first, with a shared blank budget of 4 suppressing leading zeros. `loc_0552`
is the reset-and-repaint variant: it zeroes the selected counter's three bytes first (for high score
writing through `HIGH_SCORE_BCD` [code] (0x88a8)) then repaints the same way — so the top four digits blank
and the last two show zero.

`loc_0439` renders the ten-row packed-BCD digit panel from `PANEL_DIGIT_SOURCE_TABLE` [code] (0x89c0) into
`PANEL_DIGIT_VRAM_DEST` [code] (0x8467). Each row skips one source byte then draws two source bytes as
digit pairs — the first byte's low then high nibble a row apart, a fixed separator tile 0x51 a row on, then
the second byte's low nibble and (unless its high nibble is zero) its high nibble — delegating each split
to `splitBcdByte`, the destination re-basing two cells right per row. `renderPanelFromTable` paints the
separate status panel from `PANEL_TILE_SOURCE` [code] (0x8e00) into `PANEL_VRAM_DEST` [seen] (0x8567): ten
rows of three cells, each source byte painted when nonzero and otherwise a blank tile 0x40, with the first
two cells of a row climbing one row (-0x20) and the third re-basing forward to the next column (+0x42).

`loc_05b2` draws a table-selected field of stacked characters. The selector's low seven bits (doubled)
index `FIELD_RECORD_PTR_TABLE` [code] (0x7a0d), whose entry heads a list of records; each record is a
two-byte destination followed by an inline string, written one row up per character. Selector bit 7 picks
the mode — clear writes each character as a digit tile (char minus '0'), set writes the blank tile for
every character (used to erase a field). A '.' ends a record and advances to the next; a '?' ends the whole
run.

`renderStageCountdownDigits` draws the stage number from `STAGE_COUNTDOWN` [seen] (0x8901) into
`HUD_STAGE_DIGIT_LO` [seen] (0x8743): a value below ten paints as one digit as-is, while ten or more is
converted to packed BCD first — and only that two-digit path is gated, drawing nothing while the
`PLAY_MODE_LATCH` is held. The units nibble always goes to the base cell; the tens nibble goes one row over
unless it is zero.

The phase gauge is drawn by `renderPhaseGauge` (and its identical twin `paintPhaseGauge`). Reading
`GAUGE_PHASE_COUNTER` [seen] (0x8908), a zero count leaves the gauge untouched; otherwise (count - 1) cells,
clamped to five, are filled with tile 0xb0 from `PHASE_GAUGE_BASE_TILE` [seen] (0x863f) upward, and the
cells above them are blanked with 0x10 — a five-cell vertical bar that drains as the phase counter drains.
`loc_1a85` repaints that gauge and then sets `PLAY_STATE_INDEX` [seen] (0x880a) to the base play sub-state,
plus one when `ACTIVE_PLAYER` is set, so downstream code lands on the right player's bank.
`loc_6f42` — the level-intro tally step — advances `INTRO_PHASE_INDEX` [code] (0x8f51) then draws the
target-hit tally `HIT_TALLY` [code] (0x8f52) as two stacked digit pairs at `HUD_INTRO_DIGITS_BASE` [code]
(0x8634): the packed-BCD tally at the base and its BCD double two rows up.

### The sprite display list

Each frame the sprite list at `SPRITE_DISPLAY_LIST` (0x8840) is rebuilt from actor records.
`copyObjectRecordsToDisplayList` copies four raw bytes of each record — fields +0x06, +0x10, +0x04, +0x0f —
into four successive list slots per record, stepping the record pointer by a stride and letting only the
list's low byte advance so the writes wrap inside its 256-byte page. `loc_0343` is the moving-object
variant that computes screen coordinates: for each record it emits a coordinate derived from the
(rec+6:rec+5) sub-pixel pair, the raw +0x10 byte, a second coordinate from the (rec+4:rec+3) pair, and the
raw +0x0f byte. A sub-pixel pair is a 16-bit fixed-point value reduced to a pixel with (pair >> 5) - 8. The
player is drawn as three stacked sprites, and `deriveStackedSpriteYs` fans the base `PLAYER_Y` [seen]
(0x8a84) out to those three slots' Y fields (at `ACTOR_TABLE` +0x1c/+0x34/+0x4c): the lowest gets the base
Y, the middle Y-0x10, and the top Y-0x10+0x0a.

For a flipped (cocktail) screen the list is mirrored. `mirrorSpriteListVertically` walks all 24 stride-4
entries in place, negating and offsetting each entry's two coordinate bytes (-x - 0x10) and toggling the
two flip bits in the attribute byte while keeping its low nibble. `loc_0320` gates that pass: it first
decrements a per-frame counter the caller points at, then reads `FLIP_SCREEN_FLAG` [seen] (0x881f) — while
it is nonzero (normal upright orientation) it stops, and only when it is zero (screen flipped) does it run
the mirror.

### The display-list interpreter and command ring

`loc_4381` is the display-list interpreter: a tiny copy engine that streams layout bytes into VRAM. It
first chooses a destination/source pointer pair — the primary pair `DISPLAY_LIST_DST_PTR` [seen] (0x8f43)
and `DISPLAY_LIST_SRC_PTR` [seen] (0x8f45), or the alternate pair `DISPLAY_LIST_DST_PTR_ALT` [code]
(0x88b8) / `DISPLAY_LIST_SRC_PTR_ALT` [code] (0x88ba) when `FORMATION_SLOT_TABLE` [seen] (0x8920) is
nonzero — then walks up to 0x1d source bytes. A plain byte is copied to the destination and both pointers
step; a skip opcode 0x10 advances the destination by the following byte and shrinks the remaining count; a
reload opcode 0xff loads a fresh destination pointer from the next two stream bytes and folds the byte after
it into the sub-phase tick `SUBPHASE_TICK` [seen] (0x88b7), ending the pass. Unless a reload ended it, the
destination is nudged a final +3. Whichever pair was chosen on entry is written back with the advanced
pointers, so the next call resumes where this one stopped.

The draw handlers above are scheduled through a small command queue rather than all called inline.
`loc_0038` [code] enqueues a two-byte display command into a ring on page 0x88, at
`DISPLAY_CMD_RING_WRITE_PTR` [code] (0x88a0): if the pointed slot is free (bit 7 set) it stores the
command's high byte there and its low byte in the next slot, advances the write pointer by two, and wraps
back to the ring start (low byte 0xc0) when it walks below it; an occupied slot silently drops the command.
The per-frame worker later drains that ring and dispatches each queued command to its draw handler.
## Sound

Pooyan drives its audio processor through a tiny producer/consumer pipeline: game code
queues one-byte sound commands into a ring buffer, and a per-frame drain pulls the oldest
queued byte and hands it to the audio CPU over a pair of hardware latches. Nothing on the
main CPU synthesises audio itself — it only decides *which* command to fire and *when*,
leaving the sound processor to interpret the code.

**The hardware hand-off.** Every command reaches the audio CPU through `sendSoundCommand`
(0x0e8f) [code]. It writes the command byte into SOUND_COMMAND_LATCH (0xa100) [seen] — the
port the sound processor reads — then pulses AUDIO_IRQ_LATCH (0xa181) [seen] bit 1 high and
immediately back low. That rising edge is what actually interrupts the sound CPU into
reading the latched byte; the latch value itself never needs to linger. In the raw machine
the pulse is held open by a short run of no-ops, but that width is pure timing with no state
behind it, so it drops away here and only the high-then-low strobe remains. The effect is
memory-only: the command latch plus the IRQ edge.

One caller skips the queue entirely. `loc_0f09` (0x0f09) [code] is a thin wrapper that hands
`sendSoundCommand` a single fixed command code (0x0b) — a preset one-shot emitted straight
to the audio CPU, bypassing the ring.

**The command ring.** Everything else flows through a circular buffer on page 0x8a. Two
cursors track it: SOUND_RING_WRITE_PTR (0x8a40) [code] is the tail, where the next byte is
deposited, and SOUND_RING_READ_PTR (0x8a41) [code] is the head, the next byte to consume.
Both hold a slot index in the range 0x43..0x5e, and the buffer's slots live at that index
added to the 0x8a00 page base — the 28 bytes spanning 0x8a43..0x8a5e. A free slot is marked
with 0xff, and that same sentinel is written back to a slot once its byte has been consumed.

Two routines deposit bytes at the tail. `loc_0eb3` (0x0eb3) [code] is the plain enqueue: it
stores the command byte into the slot named by the write pointer (0x8a00 + tail), then
advances that pointer, wrapping the last slot (0x5e) back to the first (0x43). It touches
nothing else.

`loc_0ea2` (0x0ea2) [code] is a gated append onto the same ring. Because sampling the gate
flags overwrites the working register, it first stashes the incoming byte in
TEXT_RING_PENDING_BYTE (0x8d20) [code] so the byte survives the check. The append then runs
only while GAME_ACTIVE_FLAG (0x8806) [seen] is set or PLAY_MODE_LATCH (0x8f50) [code] is
nonzero — that is, during actual play; with both clear it bails out at once, reporting a
zero cursor to its caller. When it does run, it recovers the stashed byte, writes it through
the write pointer (again 0x8a00 + cursor), steps the cursor with the same 0x5e->0x43 wrap,
and leaves the advanced cursor value behind for the caller to read.

**Draining to the audio CPU.** `loc_0e64` (0x0e64) [code] empties one entry per call. It
reads the slot at the head (0x8a00 + read pointer); if that slot holds the 0xff empty marker
the ring is idle and it returns immediately. Otherwise it decides whether the byte should
actually sound: it is silenced only when *both* attract sound is disabled —
DEMO_SOUNDS_DSW (0x8821) [code] bit 0 clear — *and* no game is active (GAME_ACTIVE_FLAG
zero). As long as either attract sound is enabled or a game is running, the byte is passed
to `sendSoundCommand` and reaches the audio CPU. Either way it then frees the consumed slot
(writes 0xff) and advances the head, wrapping 0x5e back to 0x43.

Note that the drain frees and advances even on the silent path: a command queued while
attract sound is off and no game is running is discarded, not held back for later. The
enqueue side likewise carries no full-buffer guard — neither producer checks the head before
writing — so a tail that laps the head simply overwrites still-unread slots.
## Anti-tamper

Woven through the boot chain, the attract loop, and the in-play state machines is a family of
self-checks that read the program image (and one region of video RAM) back to itself and compare the
result against a hard-coded sentinel. None of them changes what the game draws when the image is
intact; each exists only to notice a modified ROM and, on a mismatch, to poison a flag that other code
later reads. They come in three flavours: a signature sampler, a set of running checksums that tally
strikes or raise mismatch flags, and two region checks that trap outright.

**The program-signature sampler.** `verifyRomSignature` walks the 16-byte
`SIGNATURE_REFERENCE_TABLE` [seen] (0x20aa) against the code image, but it does not compare it to a
contiguous block — it samples every eighth byte of the region beginning at `SIGNATURE_SAMPLE_BASE`
[seen] (0x066d), stepping the reference pointer by one and the sample pointer by eight each turn. The
scan stops the instant a reference byte and its sampled counterpart disagree, and that stop sets
`SIGNATURE_MISMATCH_FLAG` [code] (0x8ef0) to 1; a clean sixteen-step pass leaves the flag untouched.
Because the sample stride skips seven of every eight bytes, a patch that lands in the gaps is invisible
to this guard — it is a spot-check, not a full sum.

**The descending ROM checksums that tally strikes.** Several guards sum a fixed program block and
read the *shape* of the total rather than its exact value, bumping a strike counter when the shape is
wrong. `verifyRomChecksum` sums sixteen bytes descending from `ROM_CHECKSUM_TOP` [code] (0x7780) into
a single byte; a healthy image is tuned so that byte has bit 0 clear, bit 5 set, and bit 7 set. Any
other bit pattern increments `TAMPER_STRIKES_STATE10` [code] (0x8a39). `loc_7e6d` runs the same idea
periodically rather than once: it is gated to fire only when `PLAYER1_LIVES` [seen] (0x8988) is at
least four and `FRAME_COUNTER` [seen] (0x8a5f) is at its zero crossing, then it sums downward from
`TAMPER_CKSUM_TOP_ADDR` [code] (0x64be) until it reaches the 0x34 sentinel byte, carrying both a byte
sum and a count of its overflows; if `(carries + sum)` has any bit of 0xb0 set, it bumps
`TAMPER_STRIKES_ROM` [code] (0x89ef). `loc_1bcc` folds a checksum while it snapshots the live page into
a player bank: after the copy it takes the low five bits of each of fourteen program bytes from
`TAMPER_CHECKSUM_CODE_BASE` [code] (0x5328) and adds them into a 16-bit accumulator, and unless the
result equals the sentinel word (high 0x8a, low 0x60) it bumps `TAMPER_STRIKES_SIG` [code] (0x8a38).

> **Reading warning (loc_1bcc):** the fold does *not* start from zero. It seeds the accumulator from
> the pointer just past the bank copy it has already performed (`PLAYER1_STATE_BANK` [seen] (0x8980)
> plus the bank size), so the expected sentinel bakes in that pointer value, not just the summed
> program bytes.

`flagTamperOnRound5ChecksumMiss` is armed by progress rather than by a timer: it returns immediately
unless `ROUND_COUNTER` [seen] (0x8907) reads exactly 5, and only then sums six program bytes from
0x1553 with a separate carry count. An intact image is tuned so that `(low sum + carry count + 0x7f)`
wraps to zero; any other total increments `TAMPER_FREEZE_FLAG` [code] (0x881e), the same freeze tally
several unrelated guards feed.

**The table and header checksums that raise mismatch flags.** `verifyTableChecksum` is the
caller-driven tripwire behind the eagle-spawn path: it sums a caller-supplied count of bytes from a
caller-supplied pointer into a 16-bit accumulator (low byte plus a high byte bumped on each 8-bit
carry). The table is trusted only when the total is exactly high 0x1d, low 0xc1; on any other total it
raises `TAMPER_ROM_CHECK_FLAG` [code] (0x882b). `flagHighScoreTableCorruptOnChecksumMiss` guards the
saved high-score table: the first byte of the four-byte block at `HISCORE_CHECKSUM_BASE` [seen]
(0x778a) must be the 0xc8 header marker, and the four bytes summed with the per-byte carry count
subtracted back off must equal 0x59. A wrong header or a mismatched total raises
`HISCORE_TABLE_CORRUPT_FLAG` [code] (0x8df8); a balanced checksum returns having written nothing.

> **Reading warning (0x882b):** `TAMPER_ROM_CHECK_FLAG` is a multiplexed cell — elsewhere the same
> byte is written as a small state index and read as a coordinate low byte — so a nonzero value there
> is not, on its own, proof of a checksum failure. Only `verifyTableChecksum`'s write treats it as a
> tamper signal.

**Guards folded into state handlers.** Three checks live inside routines that also do ordinary work,
so their fold runs every time that state is entered. The attract sub-state-0 handler (`loc_08b3`) runs
a backward ROM checksum from 0x64d5 down to a 0x96 sentinel, accumulating a sum and a carry count;
when `(0x96 - carry count)` is not 0x8f it sets `TAMPER_OBJECT_FREEZE_FLAG` [code] (0x89fb) to 1. A
play-state handler (`loc_1b43`) folds a 34-byte span at 0x5593 with a per-byte `AND 0x37 / RRCA / ADC`
kernel and, if the accumulator is not 0x7c, increments the shared `TAMPER_FREEZE_FLAG` (0x881e). The
actor-block allocator (`loc_5594`), at the first free block it finds, sums an eight-byte guard at
0x0bad against a local signature table and increments the same freeze tally if any pair fails to
cancel — the block is seeded either way, so the guard is a side observation, not a gate on the
allocation.

**The region checks that trap.** Two guards do not merely flag a miss — they behave as the original
code did on failure, which was to branch out of the routine into a region that is data rather than
code. `loc_3266`, the hunter-formation dispatch's state 2, sums a 0x20-byte block from
`FORMATION_GUARD_BASE` [code] (0x0799); an intact image sums to the 0xdc sentinel and the routine
returns to its shared epilogue, and anything else is a hard integrity trap. The playfield tile-region
check (`loc_68ac`, with the near-identical `loc_3278`) is the only self-check that reads video RAM
rather than ROM: guarded by the once-per-arm latch `TILE_CHECKSUM_LATCH` [code] (0x8f55), it walks the
tilemap from `PLAYFIELD_TILE_BASE` [code] (0x8402) — reading a column band of cells, skipping a
three-cell gap to the next band, and stepping a page at a time until the high byte reaches 0x88 —
keeping the running total as a low byte plus a wrap count. It then looks the low byte up among the four
candidates in `TILE_CHECKSUM_TABLE` [code] (0x68eb) and, on that hit, checks the wrap count against the
paired entries. A low-byte or wrap-count miss cannot arise from an intact tilemap, so it is a
data-integrity trap.

> **Reading warning (traps vs. tallies):** the strike counters and mismatch flags degrade gracefully —
> a modified image keeps running, just poisoned — whereas `loc_3266`, `loc_68ac`, and `loc_3278` do
> not fall through on a miss. In the current model that unreachable data-execution branch is a thrown
> integrity trap, so a mismatch here aborts rather than merely marking a flag.

**What the flags cost the player.** The strike counters and mismatch flags are inert until other code
consults them, and that consultation is spread across the game rather than centralised. The freeze
tally `TAMPER_FREEZE_FLAG` (0x881e) is the most consequential: while it is nonzero the actor-update
driver (`loc_241e`) aborts its per-frame work and the phase-1 spawner gate (`loc_6e75`) skips arming a
spawn — and that spawner gate also treats `SIGNATURE_MISMATCH_FLAG` (0x8ef0) as a second reason to
skip, so a bad program signature and a bad checksum both starve the board of enemies.
`TAMPER_OBJECT_FREEZE_FLAG` (0x89fb) is read alongside `BOARD_CLEAR_FLAG` [code] (0x89e5) by the
joystick sampler (`loc_1e55`), which zeroes the player-input state byte when either is set, so a
tripped tile-checksum leaves the controls dead. The net effect across the family is the classic bootleg
countermeasure: the game still boots and the attract screen still plays, but a patched ROM quietly
loses its enemies, its input, or both.

One further cell participates without a dedicated routine in view: `INTRO_DELAY_CKSUM_WORD` [seen]
(0x8f48) is dual-purpose — an intro-phase delay timer and a 16-bit anti-tamper column-checksum pointer
that walks in +2 steps while a checksum runs.
