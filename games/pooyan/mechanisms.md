# Pooyan — how the machine works

This document describes the running machine as it is now, and is regenerated whole each understanding
pass. Confidence tags mirror `idiomatic/names.js`: **[seen]** = the cell's role is confirmed by a MAME
golden observation; **[code]** = read from the code (the decompiled routines) with MAME-grounding still open (the
cell is static or unobservable in the current goldens); **[guess]** = a provisional reading. The map
covers both the machine's **state architecture** — the work-RAM layout and the variables the game runs
on — and its **control flow**: the main loop, the vblank interrupt that is the machine's only per-frame
heartbeat, and the state machines that drive configuration, play, the actor arena, the wave/rope/launch
cycle, rendering and the self-checks. Its outside-in counterpart is [gameplay.md](gameplay.md); where the
two disagree this file says so rather than quietly siding with one.

## The work RAM and its state model

The Z80 sees one flat 64K space carved into four hardware regions. The bottom half is program ROM: the code plus the constant tables the game indexes at runtime. Two video planes sit at 0x8000 and 0x8400. The 2K of work RAM the game actually lives in occupies 0x8800-0x8FFF. The two hardware sprite banks answer at 0x9000 and 0x9400, and the memory-mapped I/O devices — inputs, DIP switches, and the write-only control latches — answer from 0xa000 up. Both the work-RAM cells and the video planes are ordinary read/write memory, so everything below is described by where in that map a cell lives and who writes it. The power-on reset vector holds the vblank interrupt off, then falls straight into the boot entry, which runs the program-memory self-test and lays down the entire initial geography of work RAM before the first frame ever renders.

Work RAM is a flat scratchpad, not a struct, but boot gives it a consistent shape. The boot entry zeroes the whole region from 0x8800 upward in one sweep — all but the top two bytes — then seeds the pieces that must not start at zero. The very top of the region is the Z80 stack: the pointer is seeded just below 0x9000 (at BOOT_STACK_TOP **[code]**, 0x8ffe) and grows downward through the STACK_SCRATCH window (0x8fc0-0x9000), so transient pushes never reach the game state below. One byte is deliberately fenced off *above* the running stack: the program-memory self-test tally, ROM_SELFTEST_TALLY **[code]** at 0x8fff, reserved by an unbalanced push so the full register file the vblank interrupt saves onto the stack each frame can never clobber it — the attract-to-play setup refuses to finish until that tally reads a clean full pass.

The low end of work RAM, roughly 0x8800-0x882f, is a configuration header decoded once at boot from the two DIP-switch ports and thereafter treated as read-only. The boot entry complements DIP bank 1 and rotates its fields out into BONUS_AWARD_DSW **[code]** (0x8800, the bonus/extra-life schedule), DIFFICULTY_DSW **[code]** (0x8820, a 3-bit enemy-difficulty index), DEMO_SOUNDS_DSW **[code]** (0x8821), the CABINET_MODE_FLAG **[code]** (0x880f, upright vs cocktail), and the starting LIVES_DSW **[code]** (0x8807); it runs both nibbles of DIP bank 0 through a coinage table into COINAGE_CONFIG **[seen]** (0x882c) and its coin-slot-2 sibling COINAGE_CONFIG_SLOT2 **[code]** (0x882f). Interleaved with that header are the live top-level state cells the rest of the machine dispatches on: MAIN_GAME_STATE **[seen]** (0x8805), the coarse attract/intro/play selector the vblank service routine reads to choose a per-frame handler; GAME_ACTIVE_FLAG **[seen]** (0x8806), set at start-of-life and cleared at game-over so idle handlers bail; the running BCD CREDIT_COUNT **[seen]** (0x8802); and PLAY_STATE_INDEX **[seen]** (0x880a), the in-play sub-state that a jump table fans out on.

Player inputs land a little higher, at INPUT_PORT0 **[seen]** (0x8810) and the two bytes just above it. Each vblank the service routine samples the three input ports, complements them (the hardware is active-low), and writes the trio into 0x8810-0x8812, shifting the previous two frames' samples up into the 0x8813-0x8816 history so that state handlers can edge-detect a fresh coin drop or start press rather than re-firing on a held level.

The middle of work RAM holds the game's larger structures. The sprite display list begins at SPRITE_DISPLAY_LIST **[seen]** (0x8840): 24 four-byte entries rebuilt every frame from the object records, which the vblank routine then streams out to the hardware sprite banks. Two producer/consumer ring buffers decouple the frame logic from its output devices. The display-command ring, DISPLAY_CMD_RING_BUFFER **[code]** (0x88c0-0x88ff, 32 two-byte slots), is walked by a write pointer DISPLAY_CMD_RING_WRITE_PTR **[code]** (0x88a0) and a read pointer DISPLAY_CMD_RING_READ_PTR **[code]** (0x88a1) that the main loop drains within the frame. The sound-command ring, SOUND_RING_BUFFER **[code]** (0x8a43-0x8a5e), has its own write/read cursors SOUND_RING_WRITE_PTR **[code]** (0x8a40) and SOUND_RING_READ_PTR **[code]** (0x8a41). Boot fills both rings with the 0xff empty marker and parks all four cursors at their origins.

Per-player state is banked, so a two-player game can hold one player's entire round frozen while the other plays. The active player's score accumulates in a three-byte BCD buffer — P1_SCORE_BCD **[seen]** (0x88a2) or P2_SCORE_BCD **[seen]** (0x88a5) — selected by ACTIVE_PLAYER **[seen]** (0x880d), with TWO_PLAYER_FLAG **[seen]** (0x880e) marking a two-player game. The whole live gameplay page at 0x8900 is swapped wholesale against a saved bank per player: PLAYER0_STATE_BANK **[seen]** (0x8940) and PLAYER1_STATE_BANK **[seen]** (0x8980), each a 0x3f-byte snapshot that carries that player's remaining lives (PLAYER0_LIVES **[seen]** 0x8948 / PLAYER1_LIVES **[seen]** 0x8988). The sorted ten-entry HIGH_SCORE_TABLE **[code]** (0x8a00) holds the leaderboard, seeded to ten default entries at boot. Above the banks, the actor arena at ACTOR_TABLE **[seen]** (0x8a80) is an array of 0x18-byte records — slot 0 is the player, the rest enemies and objects — zero-filled at board init and swept every frame. A free-running FRAME_COUNTER **[seen]** (0x8a5f) is decremented every vblank to phase animation and gate the periodic integrity checks. The remainder of the region, up toward the stack, is dense with the per-timer and per-flag cells of the individual state machines (spawn cadence, wave, rope, launch, level-intro), which belong to those mechanisms.

The two video planes are written by the CPU as plain memory and scanned out by the display hardware. The colour/attribute plane occupies 0x8000-0x83ff, based at COLOR_RAM_BASE **[code]** (0x8000), with the per-column attribute map flooded from ATTRIB_MAP_BASE **[seen]** (0x8040) — 31 columns of 30 rows, one tilemap row being 0x20 cells apart, one source byte held down each whole column. The tile-code plane occupies 0x8400-0x87ff, based at VIDEO_RAM_BASE **[code]** (0x8400); it carries both the playfield (from PLAYFIELD_TILE_BASE **[code]** 0x8402) and all of the HUD text — the two players' scores, the credit count, the high score, and the status panel. Boot primes both planes: it floods the colour map with attribute value 0x10, arms a row-by-row fill of the tile map, and blanks the lower tile region to erase tile 0x1e from VIDEO_RAM_BLANK_START **[code]** (0x8440) through the end of the plane.

Sprites are double-buffered through work RAM. The CPU never writes the sprite hardware directly during play; it builds the 24-entry display list at 0x8840 and, on the next vblank, the service routine copies it out into the two hardware sprite banks at 0x9000 and 0x9400 (cleared at boot from SPRITE0_CLEAR_BASE **[code]** 0x9010 and SPRITE1_CLEAR_BASE **[code]** 0x9410). The two banks hold complementary halves of each sprite's attributes — one bank the position pair, the other the tile/attribute pair — both fed from the single work-RAM list in one pass, so every on-screen sprite updates atomically at the frame boundary.

Memory-mapped I/O lives from 0xa000 up, and this is the region to read carefully, because the read side and the write side of one address are two entirely different devices: reading a port returns an input device, while writing the *same* address drives an unrelated latch. On the read side are the inputs and DIP banks — IN0 at 0xa080 (the port that feeds INPUT_PORT0's edge-detect ring), player-1 controls IN1_PORT **[code]** at 0xa0a0, player-2 controls IN2_PORT **[code]** at 0xa0c0 (used when the screen is flipped for cocktail play), and the two switch banks DSW1_PORT **[code]** at 0xa000 and DSW0_PORT **[code]** at 0xa0e0. On the write side, writing 0xa000 — the very address that reads back as DIP bank 1 — kicks the hardware watchdog, which the vblank routine strobes every frame to prove the CPU is alive. The sound-command latch SOUND_COMMAND_LATCH **[seen]** (0xa100) hands a command byte to the audio CPU. And an addressable LS259 latch based at 0xa180 exposes one control bit per address offset, each write latching that bit from the value's bit 0: NMI_ENABLE_LATCH **[code]** (0xa180) bit 0 gates the vblank interrupt (boot holds it off, then enables it; the service routine masks it on entry and re-arms it on exit); AUDIO_IRQ_LATCH **[seen]** (0xa181) bit 1 is pulsed high-then-low to interrupt the audio CPU into reading its latched command; COIN1_COUNTER_LATCH **[code]** (0xa183) bit 3 is strobed by the coin-counter pulse generator to advance the mechanical coin meter; and FLIP_SCREEN_LATCH **[code]** (0xa187) bit 7 is copied every frame from the work-RAM FLIP_SCREEN_FLAG **[seen]** (0x881f) to set the display orientation.

## The frame loop and the vblank heartbeat

The machine runs on two clocks that never quite line up. In the foreground a single
infinite loop spins as fast as the CPU can carry it, draining a ring of drawing work and
keeping a couple of housekeeping chores warm. Underneath it the vblank NMI fires exactly
once per displayed frame, preempts whatever the foreground was doing, does the frame-critical
work that has to happen in the vertical-blank window, runs one tick of the game's top-level
logic, and hands control back to the interrupted instruction. The NMI is the true
heartbeat; the foreground loop is just the thing it interrupts.

### The foreground: the main loop at 0x020f

The main loop reads a single cursor, `DISPLAY_CMD_RING_READ_PTR` [code] (0x88a1), which is a
low-byte index into page 0x88. It forms the address 0x88:cursor and fetches the byte living
there, then doubles it (`add a,a`) purely to slide bit 7 into the carry flag. That one bit
decides everything the iteration does.

An empty ring slot holds 0xff. Doubling 0xff sets the carry, and a set carry sends the loop
into the **per-frame worker at 0x0254**: the loop runs the worker once and jumps straight back
to the top *without advancing the read cursor*. So whenever the current slot is idle, the loop
simply parks on that slot and runs the worker over and over.

A real command has a high byte with bit 7 clear (the game's display commands are 16-bit words
of the form 0x06xx, so the leading byte is 0x06). Doubling that leaves the carry clear, and the
loop takes the dispatch path instead. It masks the doubled value with 0x1f to get an even byte
offset, writes 0xff back over both bytes of the slot to free them, and advances the cursor by
two. When the cursor climbs past the top of the ring it is clamped back down to 0xc0, so the
read cursor sweeps the same 0xc0..0xff window forever. The freed slot's second byte is carried
in as the handler's argument, the offset indexes the handler-address table at 0x0242, and the
loop pushes its own address (0x020f) before jumping into the handler so that the handler's
return drops the machine right back into the loop. The loop has no exit of its own; it only
ever leaves by being interrupted.

A word of caution about the name "per-frame worker": that routine is emphatically *not* run
once per frame. It runs on every idle pass of the loop, which is many times between two
vblanks. The genuine once-per-frame cadence lives entirely in the NMI, described below.

### The display-command ring

The ring buffer, `DISPLAY_CMD_RING_BUFFER` [code], occupies 0x88c0..0x88ff — thirty-two
two-byte slots, all seeded to 0xff (empty) at boot. It is a straightforward producer/consumer
queue that decouples "decide what to draw" from "actually draw it". The producer side is the
`rst 0x38` enqueue at 0x0038: it takes a 16-bit command in DE, looks at its own write cursor
`DISPLAY_CMD_RING_WRITE_PTR` [code] (0x88a0), and — only if the target slot is still free
(bit 7 set) — stores D then E, advances the write cursor by two, and clamps it back up to 0xc0
whenever it would drop below. Writer and reader therefore chase each other around the same
0xc0..0xff window, the writer depositing 0x06xx command words and the reader draining them; when
the reader catches an empty slot it falls back to running the worker until the writer deposits
something new. The game's per-frame logic (the top-level state handlers reached from the NMI)
is what feeds this ring, so the ring is the boundary across which frame logic posts drawing work for
the foreground loop to carry out before the next frame.

### The per-frame worker at 0x0254

When the ring is idle the worker keeps two things alive. It first reads
`WORKER_CONTROL_BYTE` [code] (0x883f), the byte sitting one below the sprite display list. If
that byte's low nibble is non-zero it diverts into the program-signature check at 0x208c — an
integrity guard folded into the idle time of the main loop. Otherwise the worker does its real
job: maintaining the scrolling tile columns in the 0x84e0 / 0x8740 region through the column
painters at 0x02a8 / 0x02aa / 0x02b1. Which columns it touches is gated by `GAME_ACTIVE_FLAG`
[seen] (0x8806) — if no game is in progress it returns immediately — and then by
`TWO_PLAYER_FLAG` [seen] (0x880e) and `ACTIVE_PLAYER` [seen] (0x880d), which steer it to the
correct side's column base. A final blank of the trailing column is gated on bit 4 of the same
`WORKER_CONTROL_BYTE`. Because that control byte is decremented on every NMI (see below), both
its low-nibble gate and its bit-4 gate rotate in step with the frame clock, so the signature
check and the trailing blank each recur on a fixed cadence rather than every pass.

### The heartbeat: the vblank NMI at 0x066d

The power-on reset vector at 0x0000 begins by clearing the NMI enable latch, so no interrupt can
fire until boot deliberately arms it. Once armed (LS259 bit 0 driven to 1), the NMI asserts once
per vertical blank, and that single routine at 0x066d is the metronome the whole game runs on.

Its first act is to make itself safe and self-contained: it pushes the entire register file —
main set, the shadow set via `ex af,af'` / `exx`, and both index registers IX and IY — then
immediately drives LS259 bit 0 back to 0, masking further NMIs so the service routine cannot
re-enter itself. Everything after that happens inside a guaranteed-atomic vblank window.

With the beam blanked it does the display refresh that must not tear: the copy loop at 0x0714
walks the sprite display list at `SPRITE_DISPLAY_LIST` [seen] (0x8840) out to the sprite
position/attribute hardware at 0x9410 and 0x9010. How many groups it copies depends on
`PLAY_STATE_INDEX` [seen] (0x880a): in state 4 it fans the copy across four separate column
groups, otherwise it does a single 0x18-tall pass. It then kicks the watchdog by writing 0xa000
— a heartbeat the hardware itself watches, so a wedged frame loop is caught by the board reset.

Next it services input. The three input ports are read active-low and complemented on the way
in: IN0 at 0xa080 into `INPUT_PORT0` [seen] (0x8810), IN1 at 0xa0a0, and IN2 at 0xa0c0. Before
the fresh sample lands, the routine shuffles the previous samples down a small history ring
(0x8813/0x8815/0x8816) so the game can edge-detect this frame's presses against last frame's —
`INPUT_PORT0` is the live head where coin (bit 0), 1P-start (bit 3) and 2P-start (bit 4) show up.

Then it advances time. It decrements `WORKER_CONTROL_BYTE` (0x883f) — the very byte that paces
the foreground worker's gates — and decrements `FRAME_COUNTER` [seen] (0x8a5f), a free-running
down-counter that ticks once per vblank and never stops. That counter is the game's master phase
clock: its low bits sequence animation, and its zero crossings gate the periodic integrity
checks. Two more per-frame services run here in passing — the coin/credit handler at 0x59e8 and
one drain of the sound-command ring at 0x0e64 — before the routine reaches the point of it all.

Finally it runs one tick of top-level game logic. It reads `MAIN_GAME_STATE` [seen] (0x8805) —
the attract / intro / play selector — and dispatches through the word table at 0x06f0 to exactly
one of the five state handlers (0x072d, 0x0899, 0x0c4e, 0x159b, 0x0e53), having first pushed the
epilogue address 0x06fa so the chosen handler returns straight into the tail of the NMI. Those
handlers are the producers that post drawing work into the display-command ring for the
foreground loop to execute.

The epilogue closes the frame symmetrically. It copies `FLIP_SCREEN_FLAG` [seen] (0x881f) into
the flipscreen latch at 0xa187 bit 7 (screen orientation, applied inverted at the hardware),
pops the full register file back — index registers, shadow set, main set — re-arms the NMI by
driving LS259 bit 0 to 1, and returns to the exact instruction the foreground loop was executing
when the vblank arrived. The foreground picks up mid-stride, keeps draining the ring, and the
whole cycle waits on nothing but the next vertical blank.

That is why the NMI, not the foreground loop, is the heartbeat: it is the only code that runs
once and exactly once per displayed frame. It refreshes the sprites in the safe window, samples
input, ticks the master frame counter, and runs one step of game logic — while the foreground
loop, with no vblank wait of its own, simply spends the leftover time turning that logic's queued
commands into pixels before the next beat lands.

## Configuration, coinage and players

### Reading the operator switches at power-on

Every operator-selectable setting is latched once, during the boot entry (loc_0092), and never
re-read afterward — the machine copies the two hardware DIP-switch banks into a small block of
work-RAM cells and treats those cells as the truth for the rest of the run. The two banks are the
`DSW1_PORT` **[code]** and `DSW0_PORT` **[code]** read ports; both are wired active-low, so the boot
complements each byte before decoding it.

`DSW1_PORT` carries the gameplay options and is unpacked by rotating the complemented byte and masking
one field at a time. Bit 2 becomes `CABINET_MODE_FLAG` **[code]** — the upright/cocktail selector,
kept as a plain boolean. Bit 3 becomes `BONUS_AWARD_DSW` **[code]**, which later picks the
extra-life award schedule (the award-queue reload of 5 vs 3 and the BCD step of 8 vs 7). Bits 4-6
become the 3-bit `DIFFICULTY_DSW` **[code]**, which scales enemy spawn schedules and indexes the
tier/threshold tables. Bit 7 becomes `DEMO_SOUNDS_DSW` **[code]**, the attract-sound enable. The
lives selection lives in bits 0-1 and is decoded specially into `LIVES_DSW` **[code]**: a raw
selection of 0/1/2 stores 3/4/5 lives (selection + 3), and the fourth setting (0x03) stores 0xff
instead. `LIVES_DSW` is the cabinet lives count, seeded into both players' life counters when a board
resets.

`DSW0_PORT` carries coinage and is decoded through a small ROM lookup, `COINAGE_TABLE` **[code]** at
0x0053: the byte's low nibble indexes the table to produce `COINAGE_CONFIG` **[seen]** (coin slot 1)
and its high nibble produces `COINAGE_CONFIG_SLOT2` **[code]** (coin slot 2). Each config byte
encodes that slot's coin-to-credit ratio; the special value 0x0f means **free play** for that slot,
a sentinel the credit logic checks by name throughout. The out-of-the-box wiring seeds both to a
one-coin/one-credit configuration.

The same boot pass also seeds the orientation and interrupt hardware that the rest of the machine
leans on: it writes `FLIP_SCREEN_LATCH` **[code]** and the shadowing `FLIP_SCREEN_FLAG` **[seen]** to
1 (upright, unflipped), and — after clearing work RAM, arming the command rings, and laying down the
default high-score table — enables the vblank interrupt via `NMI_ENABLE_LATCH` **[code]**. Before any
of that it runs a program-memory self-test, summing each 4K bank against a checksum table and bumping
`ROM_SELFTEST_TALLY` **[code]** once per matching bank; the attract-setup path later refuses to finish
unless that tally reflects a fully-intact image.

### Coins in: edge-detecting the slots and accruing credits

The coin path runs once per frame, inside the vblank service. That service first samples the three
input ports (each complemented, so a pressed/active line reads as a 1) into a small edge-detect ring
whose head is `INPUT_PORT0` **[seen]** at 0x8810 — bit 0 is coin slot 1, bit 1 is coin slot 2, bit 2
is the service credit, bit 3 is 1-player start and bit 4 is 2-player start. It then calls the
credit/coinage chain (loc_59e8), which is the gate for everything coin-related: if **either** coinage
nibble reads the 0x0f free-play sentinel it returns immediately, so under free play no coin is ever
counted and no credit is ever accrued.

Otherwise the chain runs three near-identical slot detectors, one per input bit. Each detector shifts
its slot's bit into a per-slot history byte (in the 0x8829/0x882a/0x882d scratch cells) and fires only
on the clean low-to-high pattern of a fresh insertion, which debounces the mechanical switch. On a
detected coin it emits the coin-acknowledgement sound (preset command 0x0b) and then applies that
slot's coinage. Coin slot 1 (loc_5a56) bumps `COIN1_PULSE_COUNT` **[code]** to queue a physical
coin-counter tick, advances a progress accumulator in 0x10 steps, and compares it against
`COINAGE_CONFIG`; coin slot 2 (loc_5a1f) does the same against `COINAGE_CONFIG_SLOT2`, keeping its own
parallel tally at 0x8826. When a slot's accumulator crosses the configured threshold the shared
accumulate tail (loc_5a8c) adds the earned credit(s) to `CREDIT_COUNT` **[seen]** at 0x8802 and clamps
the total at 0x63 — credits saturate at 99. The service input (loc_5a06) is the simple case: it grants
one credit directly, with no coinage ratio and no coin-counter pulse. Every credit change also queues
a display-refresh command so the HUD count follows.

### The physical coin counter

Queuing a coin-counter tick and delivering one are separate: loc_5a9c turns the queued count into a
timed strobe on the hardware. With nothing queued in `COIN1_PULSE_COUNT` it does nothing. On a fresh
pulse (phase idle) it seeds `COIN1_PULSE_PHASE` **[code]** to 0x30 and raises `COIN1_COUNTER_LATCH`
**[code]** — the LS259 bit that drives the mechanical counter (only bit 0 of the written value
reaches the latch). While counting it steps the phase down each frame, drops the latch back low at
phase 0x18 (producing a fixed-width pulse), and retires one queued count when the phase reaches zero.
This paces the strobe so a burst of coins produces distinct, countable ticks rather than one smeared
pulse.

### Credits on the HUD

The credit count is painted by loc_05ee. It reads `CREDIT_COUNT`, clamps it to 99, and converts it to
packed BCD: the tens nibble is drawn to `CREDIT_HUD_TENS_VRAM` **[code]** (skipped entirely when the
tens digit is zero, so single-digit counts show no leading zero) and the units nibble to
`CREDIT_HUD_UNITS_VRAM` **[code]**. Riding inside this innocuous draw routine is an anti-tamper
tripwire: **only** when the units digit happens to be exactly 2 does it sum a fixed 31-byte program
block downward from `HUD_GUARD_CKSUM_TOP` and, if the sum misses its clean-image sentinel 0x8c, bump
`TAMPER_STRIKES_HUD_GUARD`. The check hides behind an ordinary-looking screen update and fires only
intermittently, which is the point.

### Starting a game: consuming credits and choosing players

The start buttons are handled off the same per-frame input ring. In attract, the trigger (loc_7fd6)
first checks that `CREDIT_COUNT` is non-zero — with no credits, pressing start does nothing — and that
no player is already active (it inspects `TWO_PLAYER_FLAG` **[seen]** and the two per-player life
counters), then, if either start bit (bits 3/4 of `INPUT_PORT0`) is down, hands off to the
start/credit handler (loc_0d78).

That handler distinguishes the two buttons and charges accordingly. A **1-player start** (bit 3) takes
the loc_0de4 path: it decrements `CREDIT_COUNT` by one and begins a game with the 16-bit seed 0x0000,
which lands `ACTIVE_PLAYER` **[seen]** = 0 (player 1's banks) and `TWO_PLAYER_FLAG` = 0. A **2-player
start** (bit 4) first checks that at least two credits are held (it bails if fewer), subtracts two from
`CREDIT_COUNT`, and begins with the seed 0x0100 — `ACTIVE_PLAYER` = 0 but `TWO_PLAYER_FLAG` = 1. So the
low byte of that seed becomes the active-player select and the high byte becomes the two-player flag.
The 2-player path also carries its own checksum tripwire, folding a 0x14-byte block and bumping a
strike counter on a miss before it starts the game.

The common start-of-life setup (loc_0dab) then stores the player seed into `ACTIVE_PLAYER` /
`TWO_PLAYER_FLAG`, clears the play sub-state index, sets the main game state to the play value, raises
`GAME_ACTIVE_FLAG` **[seen]**, re-asserts upright orientation, fires the start jingles, and resets the
board actors. When the two-player bit is set it additionally posts the two-player start event and
clears an extra state block.

### Two-player bookkeeping

Once a two-player game is running, `ACTIVE_PLAYER` selects which player's persistent state is live and
`TWO_PLAYER_FLAG` marks the game as two-handed. Each player owns a saved 0x3f-byte state block —
`PLAYER0_STATE_BANK` **[seen]** at 0x8940 and `PLAYER1_STATE_BANK` **[seen]** at 0x8980 — plus a life
counter (`PLAYER0_LIVES` **[seen]**, `PLAYER1_LIVES` **[seen]**, both seeded from `LIVES_DSW`) and a
3-byte BCD score buffer (`P1_SCORE_BCD` **[seen]** at 0x88a2, `P2_SCORE_BCD` **[seen]** at 0x88a5).
At any moment there is a single live state page; turns are swapped by snapshotting that page into the
current player's bank and restoring the other player's bank back into it. On a death the live page is
copied out to the owning bank (saveLiveStateToPlayerBank / saveLivePageToPlayer0Bank, which pick the
destination from `ACTIVE_PLAYER` and, in a two-player game with the other player still alive, latch the
active-player select to bring the partner in). Round init (loc_1601) restores the incoming player's
saved bank into the live page. Score reads and writes follow `ACTIVE_PLAYER` the same way:
selectActivePlayerScoreBuffer returns the player-1 buffer when its low bit is clear and the player-2
buffer when set, so the running score always accrues into the active player's slot.

`ACTIVE_PLAYER` also feeds the display in a two-player game: it drives which score column the HUD
worker keeps painting, and it selects the "player 1 up" vs "player 2 up" turn-change banner. The
`CABINET_MODE_FLAG` closes the loop for cocktail cabinets — on the first frame of a player's round,
when the flag reads cocktail (0), round init copies the active-player number into `FLIP_SCREEN_FLAG`
(which the vblank epilogue pushes to the flip-screen hardware latch), so the two players see the
playfield from their own side of the table; an upright cabinet leaves the orientation alone.

### Attract sounds and free play

Two of the boot-latched config cells act as run-time gates rather than one-time seeds. The queued-sound
consumer (loc_0e64) dispatches a pending sound only when `DEMO_SOUNDS_DSW` bit 0 is set **or** a game
is active; with the switch off, the attract mode plays silent. And the free-play sentinel keeps
surfacing: besides short-circuiting the whole coin chain, `COINAGE_CONFIG` == 0x0f makes the
credit-line renderer (loc_0e54) post an extra "free play" display command, and it steers the
attract-state continuation (loc_15d1) to its shared epilogue rather than the credit-gated intro.

## In-play progression and timers

Everything the game does happens under one vblank-driven state machine. Each frame the NMI
service (0x066d) samples the three input ports into the edge-detect ring, ticks a couple of
counters, and then dispatches on the top-level game state **MAIN_GAME_STATE** [seen] at 0x8805
through the jump table at 0x06f0: state 0 runs the attract setup (0x072d), state 1 the
attract/demo sequence (0x0899), state 2 the board-intro build (0x0c4e), state 3 the live game
(0x159b), and state 4 is a bare no-op. The chosen handler runs to completion and returns into the
NMI epilogue, which restores the register file, copies **FLIP_SCREEN_FLAG** [seen] at 0x881f out to
the flip-screen latch, and re-arms the interrupt. So the whole game is a per-frame walk through
0x8805, and the transitions between attract, intro and play are just writes to that one byte.

### The frame counters

Two free-running timers advance on every NMI regardless of state. **FRAME_COUNTER** [seen] at
0x8a5f is decremented once per vblank; its low bits phase animations and its zero-crossings gate
the periodic integrity checks. A second byte at 0x883f (the per-frame worker control) is decremented
alongside it. Distinct from these is **PHASE_TIMER** [seen] at 0x8808, a countdown that individual
state handlers reload (e.g. to 0x60 or 0x80) and drain one per frame to time a phase transition: a
handler such as the idx-1 phase setup at 0x16b7 does `dec (0x8808)` and returns immediately while it
is still non-zero, only running its body on the frame it hits zero. That is the basic idiom for
pacing every scripted step — decrement, early-return until expiry, act once.

A third pair paces the screen-clear that precedes each board. **FILL_ROW_COUNTER** [seen] at 0x8809
holds a row count (seeded 0x20, or 0x0f in the intro build) and **TILE_FILL_PTR** [seen] at 0x880b is
the 16-bit video-RAM write cursor. Each frame a row of blank tiles is written, the cursor advances
one tilemap row (+0x20), and the row counter drops; a state handler stays parked, returning early,
until the fill drains, at which point it advances its sub-state. Round-init at 0x1601 is gated
exactly this way.

### Starting a game

While the machine idles in the attract/intro states, credits accumulate in the credit counter and a
1P- or 2P-start press (bits 3 and 4 of the inverted **INPUT_PORT0** sample) is picked up by the
state-2 coin/start post-handler at 0x0d78. A 1P start restarts through the start-of-life setup at
0x0dab with a start value of 0x0000; a 2P start subtracts two credits and enters with 0x0100. That
value is written 16-bit into **ACTIVE_PLAYER** [seen] at 0x880d / **TWO_PLAYER_FLAG** [seen] at
0x880e, so a one-player game leaves both zero while a two-player game sets the two-player flag and
starts on player one. ACTIVE_PLAYER's bit 0 is the bank selector used everywhere after: 0 points at
player one's score buffer **P1_SCORE_BCD** [seen] (0x88a2) and saved state bank
**PLAYER0_STATE_BANK** [seen] (0x8940), 1 points at **P2_SCORE_BCD** [seen] (0x88a5) and
**PLAYER1_STATE_BANK** [seen] (0x8980).

The same start-of-life setup seeds **MAIN_GAME_STATE** to 3 (live play), raises **GAME_ACTIVE_FLAG**
[seen] at 0x8806, clears the in-play sub-state, and calls the new-board reset at 0x0e00. That reset
clears the whole live-state page (0x8900 upward), zeroes both play-timer gates, and seeds each
player's saved bank from the cabinet switches: lives from **LIVES_DSW** [code] at 0x8807 into
**PLAYER0_LIVES** [seen] (0x8948) and **PLAYER1_LIVES** [seen] (0x8988), a fixed opening X, and the
sprite colour from the difficulty switch. GAME_ACTIVE_FLAG is the master in-play gate: dozens of
handlers, including the play-timer tick, return immediately when it is clear.

### The in-play sub-state machine

Once in state 3, each frame first ticks the active player's play-timer (below) and then dispatches on
the in-play sub-state index **PLAY_STATE_INDEX** [seen] at 0x880a, masked to five bits, through the
jump table at 0x15a8. This index is a script cursor that walks discrete phase values (the observed
set includes 1, 2, 3, 4, 7, 10, 13, 18); each handler advances it — usually only after its phase
timer expires — so the game marches deterministically through the stages of a round. The same 0x880a
byte doubles as the inner selector for the board-intro build in state 2 (table 0x0c56), so it is the
shared "where are we in the current sequence" cursor across both the intro and the play states.

Sub-state 0 is round-init at 0x1601: it waits for the tile fill to drain, re-arms it, clears the
actor arena and a run of round cells, and on the first entry of a round raises a once-per-round latch,
seeds **PHASE_TIMER** (0x80 on first entry, else 0x02), advances 0x880a, and restores the active
player's saved bank into the live page. It also derives the rope-segment count from the arrival
counter (segment count = arrivals − 2) and copies the round message string into the display buffer.
Sub-state 1 (0x16b7) drains the phase timer, then paints the field colour/attribute map and selects
the playfield graphic/layout for the current variant off a decision tree keyed on the round and the
play-mode latch. Two sibling handlers at 0x1b43 / 0x1b8c drive later phases: they re-arm the fill,
flood the attribute columns, enqueue display commands, and run the shared integrity-plus-timer-render
handler that draws the play clock.

A separate multi-valued latch, **PLAY_MODE_LATCH** [code] at 0x8f50 (values 0/1/2), selects between
the ordinary phase flow and an alternate update path. When it is set, the gauge-phase handler at
0x1a64 tails straight into 0x1a01, which is the per-frame round-advance step.

### The round / stage / wave counters (0x8900 region)

The live-state page opens with the counters that describe the current round. **ROUND_COUNTER** [seen]
at 0x8907 is the headline value, rendered as the BCD round number on the HUD and bumped once per
stage transition by the round-advance handler at 0x1a01; its bit 0 selects the stage-type / facing
variant and its low bits index the difficulty tables. **SPEED_INDEX** [seen] at 0x8900 is the enemy
speed/difficulty index, clamped below 8 to look up a velocity magnitude and escalated as the round
climbs. **STAGE_COUNTDOWN** [seen] at 0x8901 counts down (seeded 0x20) across a stage; its initial
value selects the stage label and, near zero, it gates the actor AI. It is drawn as the two-digit
stage number by renderStageCountdownDigits (into **HUD_STAGE_DIGIT_LO** [seen] at 0x8743) and is
dropped one step by the shared enemy-despawn tail at 0x34b0 each time an enemy leaves the field.

**SPAWN_PHASE_COUNTER** [seen] at 0x8902 is the per-round phase/step counter that cycles up to 7; the
despawn tail bumps it while the play sub-state is the fourth phase, and the board/HUD reset at 0x2527
reseeds it (and the parallel **ROPE_DRAW_COUNT** [seen] at 0x8934) back to 4 once it reaches its cap
of 7. Its value is snapshotted into **SPAWN_PHASE_SNAPSHOT** [code] (0x8d43) and 0x8934 for the
renderers. **WAVE_ARRIVAL_COUNTER** [seen] at 0x8903 counts enemy arrivals within a stage (capped at
8), bounds the rope-segment count, and its parity picks a spawn variant. **ROUND_IN_PROGRESS** [seen]
at 0x8904 is the boolean "a round is actively running", set to 1 at level start and read by the
field-select and render decision trees.

### The phase gauge and the bonus-award queue

**GAUGE_PHASE_COUNTER** [seen] at 0x8908 is drawn as a five-cell vertical HUD gauge
(renderPhaseGauge, whose bottom cell is **PHASE_GAUGE_BASE_TILE** [seen] at 0x863f) and is the timer
for the whole phase. The gauge handler at 0x1a64 counts it down; when it reaches zero — or is already
zero — control tails into the phase-exhausted handler at 0x1a96, which queues the phase-exhausted tile
run, advances the play sub-state (an extra step for player one), clears the round cells including the
rope-segment count, and hands off to the high-score insert-sort. When the gauge is still non-zero the
handler repaints it and re-seeds PLAY_STATE_INDEX to 0x0a (0x0b for player one) so the flow lands on
the correct player's bank. Note the counterintuitive reading: draining this gauge to zero is a normal
phase transition, not a death.

Feeding the gauge is the pending bonus-award step at 0x18da. **AWARD_QUEUE** [code] at 0x8909 holds a
BCD threshold; when it is empty the step reloads it from the schedule selected by
**BONUS_AWARD_DSW** [code] at 0x8800 (5 or 3). Otherwise it gates on the active player's score MSB
reaching the queued threshold, and on a match it bumps the (saturating) gauge counter, BCD-adds the
schedule step (8 or 7) to set the next threshold, redraws the gauge, and appends the tally sound. So
the vertical gauge fills as the player's score crosses successive award thresholds.

### The per-player play timers

Each player accumulates a real-time BCD play clock, ticked once per play frame (before the sub-state
dispatch) by the routine at 0x7912. It bails when GAME_ACTIVE_FLAG is clear, selects the active
player's pair — **PLAY_TIMER_BCD_P1** [code] at 0x8a30 with gate **PLAY_TIMER_GATE_P1** [code] at
0x89e1, or **PLAY_TIMER_BCD_P2** [code] at 0x8a33 with gate **PLAY_TIMER_GATE_P2** [code] at 0x89e2 —
and bails again if that gate byte is set (the gate lets round-init and death handlers freeze the
clock). The bank's base byte is a frame sub-counter that rolls at 0x3b or 0x3c (the extra frame
chosen by bit 0 of the seconds digit, giving roughly one real second at ~60 Hz); on the roll it
BCD-carries the seconds digit (low nibble rolls at 0x0a, whole digit at 0x60) and then, at sixty
seconds, the minutes digit. The gate bytes and both timer banks are zeroed by the new-board reset at
0x0e00.

The clock is rendered by the shared integrity-plus-render handler at 0x7960, invoked from the
0x15a8-dispatch play handlers. After verifying its entry checksum it splits the active player's
minutes and seconds BCD bytes into hi/lo nibble tiles up a video column from **PLAY_TIMER_DIGIT_VRAM**
[code] at 0x862d (with a spacer tile between them), then clears those three timer bytes so the next
render starts fresh. When the player later earns a high-score slot, the elapsed clock is carried into
the parallel play-time side-table alongside the sorted score entries.

### Losing a life, switching players, and game over

When a life ends the live-state page is snapshotted back into the current player's saved bank and the
sub-state index is reset. saveLivePageToPlayer0Bank copies the live page into player 0's bank and, in
a two-player game whose player 1 is still alive, latches ACTIVE_PLAYER to 1 to hand the turn over; its
sibling at 0x1bcc does the mirror for player 1 (deselecting to player 0 while it is still alive) and
carries a signature tripwire. **PLAYER0_LIVES** and **PLAYER1_LIVES** are the decisive countdowns —
seeded from the lives switch, drained per death — and they gate the player-switch versus game-over
decision: whether the other player still has lives determines whether the machine alternates turns or
tears the game down.

Game over is a write of zero to GAME_ACTIVE_FLAG combined with the reset path at 0x1d3c, which also
clears PLAY_STATE_INDEX, ACTIVE_PLAYER and TWO_PLAYER_FLAG, resets the attract sub-state, and sets
**MAIN_GAME_STATE** back to 1 — returning the machine to the attract/demo loop from which the next
coin-and-start can begin the cycle again.

### Board clear and the level intro

Advancing to the next board is governed by **BOARD_CLEAR_FLAG** [code] at 0x89e5 (ORed at several
sites with the object-freeze flag at 0x89fb): when it is set the per-frame object updates are frozen
and the handlers divert to the board-clear / level-intro path instead of the normal in-play flow. The
level-intro phases themselves run off their own phase selector and delay timer, latch and scale the
target-group count, and step through a short scripted sequence before dropping the play sub-state back
to its "ready" value and re-entering the round-init flow for the next board — the same PLAY_STATE_INDEX
walk that started the previous round, now one round higher.

## The actor arena

Every moving thing on screen -- the player, the enemy birds, the arrows, the falling and
rising objects, the rope segments and the formation hunters -- lives as a fixed 0x18-byte
record inside one contiguous block of work RAM that begins at `ACTOR_TABLE` **[seen]**
(0x8a80). At board init `clearActorArena` zeroes the 0x200-byte span from that base, so a
fresh board starts with every record blank and inactive; the heavier teardown
`clearActorArenaAndCounters` zeroes an even longer 0x241-byte span and then resets the
per-board tallies `SPAWN_PHASE_COUNTER` **[seen]** (0x8902), `WAVE_ARRIVAL_COUNTER`
**[seen]** (0x8903) and `ROPE_SEGMENT_COUNT` **[seen]** (0x8931) before forcing
`PLAY_STATE_INDEX` **[seen]** (0x880a) to sub-state 6. The single-record clear helper
`loc_221e` blanks one 0x18-byte slot to zero, and `loc_3553` clears a record's 0x17-byte
"sprite band" (the whole body bar its last byte) -- the routine the game reaches for when it
retires an actor mid-frame.

### One block, many overlapping views

The arena is not a set of disjoint allocations; it is one address range that different
routines view through different windows, each a run of records one 0x18 stride apart. Named
regions sit at fixed offsets from the base:

- `ACTOR_TABLE` (0x8a80) holds the lead actors. Slot 0 is the player: its state selector is
  `LEAD_ACTOR_STATE` **[seen]** (0x8a82, slot0+2), its vertical position is `PLAYER_Y`
  **[seen]** (0x8a84, slot0+4), and its input/aim byte is `PLAYER_AIM_FLAGS` **[code]**
  (0x8a87, slot0+7). The player is *drawn* as three vertically stacked sprites, so
  `deriveStackedSpriteYs` fans `PLAYER_Y` out into the +4 Y fields of slots 3/2/1 (base Y at
  slot 3 = 0x8acc, Y-0x10 at slot 2, and 0x0a below that at slot 1). Slot 2's record
  (`ACTOR_TABLE`+0x30) is also read as the arrow/launch group when the display list is
  rebuilt, and its +4 Y is named `ARROW_Y` **[code]** (0x8ab4) -- the same byte the
  stacked-sprite derivation touches, so the two roles share the cell.
- `ENEMY_ACTOR_TABLE` **[seen]** (0x8ae0 = base+0x60) is the moving-object band. It is the
  widest window: the per-frame display rebuild treats 0x12 (18) records starting here as
  movers, and 18 strides of 0x18 reach exactly to 0x8c90 -- so this one view spans every
  object pool up to the enemy-target pair. The single record at 0x8b28 (0x8ae0+0x48) has its
  own dispatcher, `loc_6822`, gated by `ENEMY_REC_DISPATCH_GATE` **[code]** (0x8afa): when
  that byte is zero the dispatch is skipped entirely.
- `SPRITE_OBJECT_TABLE` **[seen]** (0x8b70) is a 5-slot secondary pool that `loc_13bc` scans
  for a free entry; `OBJECT_STATE_RECORD_BASE` **[code]** (0x8ba0) is a 6-slot per-frame
  state array that runs into `PROJECTILE_TABLE` **[seen]** (0x8be8). Further up sit
  `FORMATION_TABLE` **[seen]** (0x8c30), `SPAWN_OBJECT_TABLE` **[seen]** (0x8c48),
  `HUNTER_TABLE_BASE` **[code]** (0x8c78, scanned downward), and the two-entry I-parity
  target pair `ENEMY_TARGET_REC0` **[seen]** (0x8c90) / `ENEMY_TARGET_REC1` **[seen]**
  (0x8ca8, base0+0x18).

### The record structure

Across the routines a consistent 24-byte layout emerges. The first two bytes are activity
flags -- a record is live when bit 0 of (+0) or (+1) is set; several handlers key their whole
behaviour off (+1) as a secondary state. (+2) is the primary state/kind byte the dispatchers
read. The position fields are 16-bit fixed point split across two pairs: (+3):(+4) is a
fraction:row for the vertical axis and (+5):(+6) is the second axis, with (+9) the per-frame
velocity/step folded into the fraction (an 8-bit overflow carries one whole unit into the
integer byte). (+7) and (+8) are flag bytes (joystick bits, spawn-step and turn-select bits,
a high-nibble gate); (+0a)/(+0b) carry a mirrored velocity and an animate/every-4th-frame
counter. The animation fields are (+0c):(+0d) the little-endian sequence pointer, (+0e) the
frame-hold countdown, (+0f) the colour attribute and (+10) the tile code -- exactly the bytes
the display copy pulls out. (+11) is a per-frame delay/dwell timer, (+12) a hold timer or
0xff spawn marker, (+13) a 2-bit phase, (+14) a sprite id, and (+16):(+17) a secondary
16-bit script pointer with (+15) its step index.

### The animation engine

Animation is a shared byte-code interpreter. `advanceActorAnimFrame` (and its identical
sibling `loc_4006`) is the per-record stepper: while (+0e) is non-zero it decrements and holds
the current frame; at zero it walks the sequence stream addressed by (+0c):(+0d). A 0xff
opcode reloads that pointer from the next two stream bytes (a jump) and re-reads; any other
byte begins a three-byte frame -- tile into (+10), colour into (+0f), the new hold into (+0e)
-- after which the advanced pointer is written back. `loc_22e6` is a variant that pulls its
frames not from a per-record pointer but from a single shared cursor, `ANIM_SCRIPT_CURSOR`
**[seen]** (0x8f00): a normal {tile, colour, delay} triple is copied into the record and the
cursor advanced, while a 0xff lead byte is a control marker whose two following bytes replace
the cursor. That marker has a rival full-reset branch to `ANIM_SCRIPT_RESET_PTR` **[code]**
(0x26e7), but it only fires when `foldTargetPresenceBits` returns 3 -- and that fold seeds 0
and is only ever rotated, so in practice the marker always resolves as the inline jump.

Two helpers arm a record onto a new sequence: `setActorAnimation` and
`storeActorAnimationPointer` both write the little-endian pointer into (+0c):(+0d) and reset
the frame index (+0e) to 0, restarting the animation from step 0. `tickActorAnimHold` is the
countdown-driven variant used for the enemy band: it proceeds only for records flagged to
animate (or, absent the flag, on even `ROUND_COUNTER` **[seen]** frames), and on each timer
underflow at (+12) it steps the 2-bit phase at (+13) down, re-arming (+16) while phase
remains and disarming at phase end.

These leaves are driven in batches. `loc_22b1` steps four lead records through the shared-cursor
stepper unless `GRAB_ACTIVE_FLAG` **[seen]** (0x8d32) is set (a rope-grab freezes the pass);
`loc_5d0b` ticks the hold countdown across the six enemy records from `ENEMY_ACTOR_TABLE`; and
`loc_09f8` animates four `SPRITE_OBJECT_TABLE` records and then rebuilds the display list.

### Per-frame state dispatch

Each actor family runs a small state machine, always selected off the record's (+2) byte
through a jump table. The player/lead record is driven by `loc_241e`: after running its
pre-pass helpers it aborts the whole update when the anti-tamper freeze `TAMPER_FREEZE_FLAG`
**[code]** (0x881e) is non-zero, then dispatches `(0x8a82)&7` six ways into handlers such as
`loc_24b9` (state 3: drive base Y down by two per frame toward the floor 0xdc, then queue a
sound and advance), `advanceActorDropStateOnDelay` (count the (+11) delay down, then nudge
the actor down and advance), `advanceRisingActorStep` (state 6: rise (+6) toward the top 0xc0,
flipping the tile every 4th frame, then advance and seed a long delay), and `loc_24fb`
(state 5: frame-delay countdown that on expiry sets a shape-reload flag). The state byte is
carried forward by the handlers themselves incrementing (+2); `loc_2c85` is the generic
"advance from the trigger state" transition -- only a record sitting in state 0x11 is bumped
to 0x12, armed onto a sequence, and given a fresh script pointer.

The object pools are swept by counted loops. `loc_76f4` walks six records from
`OBJECT_STATE_RECORD_BASE`, calling `dispatchActiveObjectState` on each: inactive records
(bit 0 of (+0)|(+1) clear) are skipped, and an active one has `(+2)&3` select one of four
handlers. `loc_6f2d` is the enemy-record dispatcher: state 2 tails into the frame-hold tick
`loc_3536`, any state below 0x0b runs the generic mover, and states 0x0b/0x0c index a two-entry
table. `loc_64fb` dispatches the fountain record three ways on the full (+2) value, and
`loc_72a7` walks 2x`WAVE_INDEX` records of the enemy table for the eagle wave. Retirement is
handled inside the movers: `loc_667c` integrates an idle actor's position and, at the retire
row 0x1d, marks it state 2 and clears its coordinates; `advanceFallStep` reports (via carry)
whether a falling actor is still above the landing row 0x1e; and `loc_3536` blanks the sprite
band on every non-holding exit, bumping a shared tally (0x8d76) that, on its third bump,
clears `LANE_SPAWN_COUNTDOWN` **[seen]** (0x8d75) and `LAUNCH_ARM_LATCH` **[seen]** (0x8f20).

### Collision

Proximity hits are found by `loc_5f11`, a slot scan against a target box. It walks B records
by their stride, skipping empty (state 0) and already-struck (state 3) slots, and measures
each live one through `precheckCollisionBounds`, which biases the actor's X by the
`FLIP_SCREEN_FLAG` **[seen]** (0x881f) orientation (+6 upright, -2 flipped), forms the biased
Y+8, and returns an on-screen flag by comparing that Y against the bottom limit 0xe0.
Off-screen slots are skipped; a hit requires the horizontal gap to the target centre under 7
and the vertical gap (target Y + margin) under 6. On a hit the slot is marked struck (state
3), the interrupt-parity flash cell `FLASH_CELL_BASE` **[code]** (0x8d19, or +1 by interrupt
register parity) is set to 1, and the routine tail-hands to the hit-sound enqueue via
`loc_5f02`. The I-parity target pair carries its own one-frame hit flags, `OBJ_HIT_FLAG_I0`
**[seen]** (0x8d1b) and `OBJ_HIT_FLAG_I1` **[seen]** (0x8d1c), set by the sibling scanners and
torn down together with the struck object.

### Spawning and seeding

A fresh record is opened by `initActorRecord`, which stamps the fixed spawn constants
(+0=0x00, +1=0x01, +2=0x08), the 0xff marker at (+12), and a 16-bit datum at (+16):(+17),
returning the advanced pointer for the caller's scan. `seedObjectRecord` fills a record's
descriptor and coordinate fields from two source streams and clears the (+0e) timer,
returning both advanced source pointers. `stampObjectAndDecCounter` reads a control byte,
decrements a shared one-byte counter in place (its Z result steering the caller), and stamps
two fixed state bytes (+13=0x01, +16=0xc1).

The child-spawn path begins at `loc_13bc`: it scans the five `SPRITE_OBJECT_TABLE` slots for
a free one (bit 0 of the first two bytes clear), and on finding one bumps the wrapping
`ANIM_FRAME_COUNTER` **[seen]** (0x8d41, skipping zero) into the parent's sprite-id field,
points the parent at animation sequence `ANIM_SEQ_3988` **[code]** (0x3988), seeds its timer
and kind, then tail-calls `loc_142c`. That routine builds the child from the parent: fixed
slots (+0=1, +2=4), a biased position copy (+80 into the X/Y fraction bytes), and a velocity
looked up from `ENEMY_SPEED_TABLE` **[code]** (0x148e) via the round-clamped `SPEED_INDEX`
**[seen]** (0x8900) -- negated on odd `ROUND_COUNTER` **[seen]** (0x8907) so the enemy faces
the mirrored direction -- mirrored into the child (+0a/+0b) and parent (+0a). It arms the
child onto sequence `ANIM_SEQ_38CB` **[code]** (0x38cb), seeds the spawn timer, and tail-hands
to the spawn-sound enqueue. Two small guards gate the spawn/queue step: `loc_1389` runs it
only when bit 0 of a record's (+8) flag is set, and `loc_141c` no-ops once the record's (+6)
phase has reached 2, otherwise clearing (+8) and re-arming the record onto animation table
`ANIM_TABLE_3829` **[code]** (0x3829).

### Records become sprites

Every frame `loc_02ef` rebuilds the sprite display list at `SPRITE_DISPLAY_LIST` **[seen]**
(0x8840) from four record groups in turn: the two lead actors, the two I-parity target
records, the eighteen moving-object records, and the two arrow/launch records. The two small
groups and the arrow group are copied verbatim by `copyObjectRecordsToDisplayList`, which
emits record bytes (+6), (+10), (+4), (+0f) into four successive list slots per record --
raw Y, tile, X, colour. The eighteen movers go through `loc_0343`, which does the same layout
but converts the (+5):(+6) and (+3):(+4) sub-pixel pairs into screen coordinates ((pair >> 5)
- 8) instead of copying them raw. Both advance the list pointer by four bytes per record,
wrapping within the list's 256-byte page. After the copy `loc_02ef` nudges the two arrow
sprites' Y bytes down a pixel and hands off to the shared tail that ticks the second byte and,
when the screen is flipped, vertically mirrors the whole list.

## Waves, rope and launch

Three cooperating machines govern how enemies arrive, how the rope/lift grows and retracts, and how
a launched arrow spends itself into a hunter. Each is a small per-frame state machine keyed off its
own selector cell; they share the enemy-actor and target records, so the boundaries between them are
worth keeping straight.

### The eagle attack wave

The eagle wave is the bonus-stage attack loop. It runs as two alternating bodies — one frame drives
the approach machine, the next drives the launch/record machine — with a third body tearing the stage
down when it is over.

Seeding begins in the wave-launch step. It fires only while the lead target record is clear
(`ENEMY_TARGET_REC0` **[seen]**, 0x8c90 reads zero); otherwise a wave is already on screen and it
returns. When it does run it raises the eagle-wave launch flag (`WAVE_LAUNCH_FLAG` **[code]**, 0x8f3a)
and bumps the wave index (`WAVE_INDEX` **[seen]**, 0x8f3d). The fourth wave is special: instead of
seeding records it only advances the outer-phase counter (`WAVE_OUTER_PHASE` **[code]**, 0x8f38) and
reloads the inter-wave hold to 0x20, deferring to the idle handler. On the other waves it writes a
record count of twice the wave index (`WAVE_RECORD_COUNT` **[code]**, 0x8f3c) and initialises that
many records in the enemy-actor table (`ENEMY_ACTOR_TABLE` **[seen]**, 0x8ae0, stride 0x18) from a
four-byte-per-record parameter table in ROM (`EAGLE_WAVE_PARAM_TABLE` **[code]**, 0x7409). Each record
is marked active (state 1) and takes four copied fields (its target column at +6, plus +0x10, +4, and
+0x0f); records whose own low address has bit 3 set additionally get a flag byte at +3, and every
record gets a flag byte at +5. It finishes by zeroing the outer-phase counter and the arrived count
(`WAVE_RECORDS_ARRIVED` **[seen]**, 0x8f39).

Once launched, the wave driver walks two-times-the-wave-index records of the enemy-actor table each
frame, dispatching every active record on its state byte (+2): state 0 is the approach test, state 1
the dive/climb, state 2 the retire. The **approach test** returns unless the eagle has reached this
record's grid slot — its column (the eagle X, `EAGLE_X_COORD` **[code]**, 0x8c96, taken as a
field of the target record, shifted right by three) must equal the record's target column or the one
just before it, and its row (the eagle Y, `EAGLE_Y_COORD` **[code]**, 0x8c94, shifted right by three
plus four) must land in a five-row window above the record's target row. On arrival it advances the
record state and arms an animation: odd records (bit 3 of the record's low address) take one animation
sequence (`EAGLE_ODD_RECORD_ANIM` **[code]**, 0x7403) and a speed field of 0x38; even records take
another (`EAGLE_EVEN_RECORD_ANIM` **[code]**, 0x4086) and a speed of 0x40, bump the arrived count, and
— when every record of the wave has arrived (the arrived count equals the wave index) — queue a
display command offset from a base by the arrived count (`WAVE_ARRIVAL_CMD_BASE` **[code]**, 0x0630).

In the **dive/climb** state the driver advances the record's animation, then integrates its 16-bit
vertical position by its per-record speed field. Even-indexed records descend: the speed is added to
the sub-position, a carry drops the row, and reaching the bottom row (0x1d) advances the state byte.
Odd-indexed records climb: the speed is subtracted, a borrow lifts the row, and rising above the top
row (0x04) advances the state byte. The **retire** state zero-fills the whole 0x18-byte record, then
decrements the live-record count; when the last record of the wave has retired it seeds the inter-wave
hold countdown to 0x30 (`WAVE_HOLD_TIMER` **[seen]**, 0x8f36).

When no records remain the driver hands off to the **inter-wave idle handler**. While the hold timer
is nonzero that handler simply ticks it down. On expiry, if a wave index is still set it enqueues a
command carrying that index (opcode 0x06, parameter 0xb0 + index), then reseeds the hold to 0x18 and
clears the launch flag — arming the next seed.

The other bonus-stage body per frame is the **approach state machine**, which drives the player's aim
indicator and the on-screen grid marker. A hold gate (the same `WAVE_HOLD_TIMER`) blocks it while
nonzero. Once open, it reads the approaching enemy's screen coordinate and thresholds it: sitting
exactly at the near threshold 0x59 steps the sub-phase; above it, or with no target present, it runs
the aim update; below it, it flags "below target." The aim update shows on-target once the enemy X has
been latched, otherwise it latches that X past the far threshold 0x60 into `LATCHED_ENEMY_X`
**[seen]** (0x8f5b) and flags below. WARNING: the coordinate this machine reads as the enemy's
approach position is the cell named `PLAYER_Y` **[seen]** (0x8a84) — in the bonus-stage approach that
cell carries the incoming enemy coordinate, and 0x8f5b captures it exactly at the 0x60 crossing, not
the player's own vertical position as its name suggests elsewhere.

Stepping the sub-phase (`WAVE_RECORDS_ARRIVED` again) runs 0 -> 1 (clear the aim bits), anything but 2
-> 2 (arm the aim), and on the final sub-phase steps the grid marker. The grid-marker step, once the
finish latch is set (`EAGLE_FINISH_FLAG` **[code]**, 0x8f3e), just runs the phase-reset epilogue.
Otherwise it bumps a frame tick (`EAGLE_GRID_STEP_TICK` **[code]**, 0x8f3b) and, only on every eighth
frame, stamps a marker tile (0x2c) into a cell derived from the grid-marker VRAM base
(`EAGLE_GRID_VRAM_BASE` **[code]**, 0x87e0) — stepped up by whole rows from the eagle Y and across by
the eagle X — and writes the matching colour attribute one page (0x400) back. The **grid-edge guard**
it delegates to hands the coordinate back while the eagle is short of the grid edge (0xd0), and on
reaching the edge arms the finish latch and runs the phase-reset epilogue. That epilogue clears the
aim flags (`PLAYER_AIM_FLAGS` **[code]**, 0x8a87) and the latched enemy X, advances the outer phase,
and clears the arrived count.

Bonus-stage phase 2 is the **teardown**: while the hold timer is nonzero it ticks down, and on expiry
it zeroes a nine-byte wave/phase block and the 0x48-byte enemy-record region, clears the play
sub-state index (`PLAY_STATE_INDEX` **[seen]**, 0x880a) and the latched enemy X, and hands control
back by setting the attract sub-state selector to 7.

### The rope and its cells

The rope is grown and retracted by the pull-rope/lift driver, which on its round-parity branch (round
counter bit 0 clear) first gates on the rope-grab latch (`GRAB_ACTIVE_FLAG` **[seen]**, 0x8d32) and on
the per-stage arrival counter (`WAVE_ARRIVAL_COUNTER` **[seen]**, 0x8903) not equalling 2, then runs
two sub-machines back to back: the rope-extend driver and the per-cell writer.

The **rope-extend driver** dispatches on a two-way selector (`ROPE_EXTEND_STATE` **[code]**, 0x8f14).
Sub-state 0 adds one segment. It returns at once once the rope has already grown to two below the
stage's arrival count (the extended-segment count `ROPE_SEGMENT_COUNT` **[seen]**, 0x8931, equals the
arrival counter minus two). Otherwise it bumps that segment count and, while the segment index
(`ROPE_EXTEND_INDEX` **[code]**, 0x8f18) is below four (or a tamper strike is pending, which lets it
run past the limit), advances the index, looks this segment's video-column low byte up from a ROM
table (`ROPE_CELL_COLUMN_TABLE` **[code]**, 0x2db8) and stores the full page-0x84 column base
(`ROPE_COLUMN_VRAM_PTR` **[code]**, 0x8f19), reloads this segment's cell timer to 0x10 (one entry in
the per-cell timer block `ROPE_CELL_TIMERS` **[code]**, 0x8f28, stride 2), advances the extend
sub-state, and arms the sub-timer to 0x10 (`ROPE_EXTEND_TIMER` **[code]**, 0x8f16). Sub-state 1 is the
blit driver: it counts the sub-timer down, and on expiry either — once its frame index has reached 8 —
resets that index and re-arms the next rope cell, or looks up a tile block and blits it at the stored
column, bumping the frame index. This is what animates the rope column growing upward.

The **per-cell writer** loops over the active rope cells (their count is the extend index), running a
per-cell dispatcher on each. That dispatcher reads the cell's own state byte (a small array of state
bytes at 0x8f1c onward, one per cell) and returns for an idle cell; otherwise it routes the cell into
one of four handlers, and the low two bits of the cell address select that cell's frame timer and
video column throughout.

The shared timer tick decrements the selected rope-cell timer in place and reports whether it reached
zero, so every cell handler is gated the same way. **Cell state 1** acts only every fourth frame and
only when the timer elapses: it tentatively re-arms the timer to 1, scans the three spawn-object
records (`SPAWN_OBJECT_TABLE` **[seen]**, 0x8c48, stride 0x18) for a free slot, and with none leaves
the timer at 1 and returns. With a free slot it rewrites the timer entry with a round-scaled reload
and stashes the slot index in the timer's paired byte, seeds the slot (opening state 0x07, tile and
coordinate fields, the +4 field pulled from a ROM table keyed by the cell index,
`ROPE_SPAWN_IY4_TABLE` **[code]**, 0x2ec7), advances the cell state, and blits the segment tile
(`ROPE_SEGMENT_TILE_SRC` **[code]**, 0x2dfe) at the cell's column before queuing its display command —
this is the cell that drops a bonus object down the rope.

**Cell states 2 and 3** are timer handlers that both, on the frame their cell timer reaches zero, walk
into the formation table (`FORMATION_TABLE` **[seen]**, 0x8c30, stride 0x18) by the slot index stored
beside the timer and rewrite one record's fields, bump the cell's state byte, and blit the segment's
2x2 square. State 2 writes a round-derived tile value (the round clamped to 0x10, doubled, plus 0x18)
into the timer cell, bumps that record's tile field (+0x0f), clears its position byte (+5), drops
another field (+6), and draws with an alternate tile source (`ROPE_SEGMENT_TILE_SRC_ALT` **[code]**,
0x2e1e). State 3 first runs the **rope-grab trigger test**, and if a grab fires it abandons the cell
update entirely; otherwise it re-arms the timer to a fixed 0x0c, drops that formation record's tile
field, forces its position byte to 0xc0, bumps its +6 field, advances the cell, and redraws with the
primary tile source. The grab test looks a catch-window half-width up from a ROM table
(`GRAB_WINDOW_TABLE` **[code]**, 0x3087, keyed by the cell index) and compares it against a window
around the player X (0x8a84 minus 7, plus 0x0e); with the player outside the window it returns
normally, and inside it — only when neither the enemy-formation teardown state (`WAVE_TEARDOWN_STATE`
**[seen]**, 0x8f24) nor the enemy-formation launch state (`FORMATION_STATE` **[seen]**, 0x8f08) is
busy — it fires, setting the grab latch to 1 and queuing a sound.

**Cell state 4** retracts. Gated on the same cell timer and on rope segments still remaining, it
selects a retract animation pointer from a ROM table (keyed by the round counter shifted right twice
and clamped to 3, plus the cabinet bit), reads a per-segment attribute byte (the segment count minus
one, clamped to 0x1f), merges it into the paired cell, clears the indexed formation record, advances
the cell state, and blits the retracting segment. The related `ROPE_DRAW_COUNT` **[seen]** (0x8934)
mirrors the spawn-phase snapshot and sets how many rope rows are drawn. The whole rope is torn back
down to zero segments at phase exhaustion, so the extended-segment count resets to 0 between phases.

### The arrow launch state machine

An independent per-frame driver runs the arrow/rope launch as a five-state machine dispatched on the
low three bits of its selector (`LAUNCH_STATE` **[seen]**, 0x8f30), cycling 0 -> 1 -> 2 -> 3 -> 4 and
back to 0. The launched object is the actor at arena slot 2, whose Y is tracked in `ARROW_Y`
**[code]** (0x8ab4); the display rebuild nudges the arrow group's sprite-Y down one pixel per frame,
so the arrow visibly rises while the machine watches its height.

**State 0** arms and gates the launch. It raises the one-shot arm flag (`LAUNCH_ARMED_FLAG`
**[seen]**, 0x8f3f) once its preconditions hold: if a lane-spawn sequence is still counting
(`LANE_SPAWN_COUNTDOWN` **[seen]**, 0x8d75) and the arm latch is still clear (`LAUNCH_ARM_LATCH`
**[seen]**, 0x8f20) it bumps that latch; otherwise it requires the stage countdown (`STAGE_COUNTDOWN`
**[seen]**, 0x8901) to be nonzero and a multiple of eight. It then returns unless the arrow has risen
to at least 0x3c and neither hunter-target record (`ENEMY_TARGET_REC0` / `ENEMY_TARGET_REC1`
**[seen]**, 0x8c90 / 0x8ca8) has its hit bit (0x02) set. Clearing those gates, it advances the state,
reseeds the tile-flip countdown to 8 (`LAUNCH_FLIP_COUNTDOWN` **[code]**, 0x892f), lights the launch
HUD cell (`LAUNCH_HUD_TILE` **[code]**, 0x8508 = tile 0x6f) when the game is idle but the launch is
armed, refreshes the arm latch from its seed value (`LAUNCH_ARM_LATCH_SEED` **[code]**, 0x8d7a) when
that is nonzero, and blits the launch tile (`LAUNCH_TILE_SRC` **[code]**, 0x2d51) at the launch anchor
(`LAUNCH_TILE_VRAM` **[code]**, 0x84a7).

**State 1** either animates the arrow or seeds a hunter into a target record. While the arrow is at or
above 0x34 it runs the flip countdown; each time that reaches zero it reseeds to 0x10, steps a shared
phase byte (`SHARED_PHASE_COUNTDOWN` **[code]**, 0x892e), and blits one of two arrow tiles chosen by
that byte's parity (`LAUNCH_TILE_SRC` or `LAUNCH_TILE_SRC_ALT` **[code]**, 0x2d55). Once the arrow has
fallen below 0x34 it instead scans the two target records for a free one; with none it returns, and
with a free record it jumps the launch state to 2, marks the record (state 2), queues a display
command, blits the alternate tile, conditionally lights the HUD cell (with tile 0x10), and seeds three
scratch fields.

**State 2** seeds a new hunter into the hunter table and advances. Unless the play-mode latch
(`PLAY_MODE_LATCH` **[code]**, 0x8f50) is set, it scans the six hunter records downward one stride
apart (`HUNTER_TABLE_BASE` **[code]**, 0x8c78, stride 0x18) for the first free slot; with none it
bails untouched. A free slot is stamped with fixed opening state, coordinates and tile ids (+0x0f =
0x37, +0x10 = 0x42), and its address is recorded (`HUNTER_RECORD_PTR` **[code]**, 0x8f32). It then
bumps the launch state, and — when the flip flag is clear (`HUNTER_SPAWN_FLIP_FLAG` **[code]**,
0x8f61) — seeds the spawn countdown to 0x20 (`HUNTER_SPAWN_COUNTDOWN` **[code]**, 0x8f34) and enqueues
a hunter-spawn display command; when the flip flag is set it instead advances a sub-counter
(`HUNTER_SPAWN_SUBCOUNTER` **[code]**, 0x8f5d).

**State 3** runs that spawn countdown: while it is nonzero it decrements and returns, and on expiry it
advances the launch state and — unless the play-mode latch is set — clears the whole 0x18-byte record
that state 2 recorded. **State 4** is an idle no-op, holding the machine until it is re-armed. The
re-arm happens when the launched arrow object is finally spent: the two-axis object mover declares it
gone once its Y high byte reaches 0xe8 and, on that frame, clears both the launch state and the arm
flag (and the board-reset path clears the same two cells for a fresh board), so the next stage begins
the cycle again from state 0.

A related script pointer (`LAUNCH_SCRIPT_PTR` **[seen]**, 0x8f4a) holds the 0xff-terminated
launch/dive script and doubles as a countdown that fires at 0x40 along the launch path; the seeded
hunters themselves are then driven by the separate hunter-formation machinery, so the launch state
machine's job ends once a hunter record has been stamped and handed off.

## Rendering, HUD and display lists

Everything the machine puts on screen lands in two parallel maps on the 0x8000 video page. Tile
codes live in the tile region based at `VIDEO_RAM_BASE` 0x8400 [code] (`PLAYFIELD_TILE_BASE` 0x8402
[code] is the first playfield cell), and the per-cell colour/attribute bytes live in the map based at
`COLOR_RAM_BASE` 0x8000 [code], whose playfield body starts at `ATTRIB_MAP_BASE` 0x8040 [seen]. Both
maps are 32 cells wide, so one screen row is a stride of 0x20 and "up the column" means walking toward
*lower* addresses (stride -0x20) — a fact that recurs in almost every HUD painter below, because the
cabinet is rotated and most number fields are drawn bottom-up. Sprites are handled separately through a
display list at `SPRITE_DISPLAY_LIST` 0x8840 [seen], rebuilt from the actor records every frame. The
routines that follow are all read from the code and are code-level [code] unless a cell they touch
carries a MAME [seen] tag.

### The tile-block primitives

At the bottom of the drawing stack sit a handful of leaf blitters that stamp a rectangle of tiles from
a source pattern. `blit2x2TileBlock` (0x3325) copies four consecutive source bytes into a 2x2 square in
the order top-left, top-right (+1), bottom-right (+0x21), bottom-left (+0x20), and leaves the cursor at
that bottom-left cell (dest + 0x20) — the two-tile animators exploit this, stepping one row up before
their next blit. `paintTileBlock2x2` (0x0a40) writes the same square anchored at the top-left, while
`paintTileBlock2x2Above` (0x780f) anchors at the bottom-left and puts its top row one tilemap row above
the anchor; both take source order top-left/top-right/bottom-right/bottom-left (and bottom-left first,
respectively). `blitTile3x3Block` (0x3307) stamps a 3-wide, 3-tall block, copying three source bytes
per row and then stepping the destination down a full screen row (three written + 0x1d = 0x20); it
advances *both* the destination (+0x60) and the source (+9) so a caller can chain the next block
straight from the advanced source. `blitGlyphBlock4x3` (0x1f8c) is the 4-row, 3-column variant used for
glyph art: it advances only the destination low byte across a row (so the write stays inside the
tilemap page) then adds 0x1d for the net +0x20 row step, ending at dest+0x80 and source+12.

Vertical columns get their own painters because they recur in the scrolling playfield. `loc_02a8`
(0x02a8) stamps a three-tile column downward: a cap tile (0x01) at the start cell, then the body helper
`paintColumnBodyTiles` (0x02aa) writes the mid tile (0x25) one stride down and the base tile (0x20) a
second stride down. `loc_1ce7` (0x1ce7) is the upward twin: it writes a cap tile (0x02) at
`COLUMN_CAP_VRAM` 0x84e0 [code] and then `paintColumnBodyTilesUp` (0x1cec) walks the mid and base tiles
one row *up* each (fixed -0x20 stride). `blankTileColumn` (0x02b1) erases a three-cell column by
writing the blank tile 0x10 into three cells a stride apart, returning the advanced pointer so a caller
can chain column after column when a scrolled strip is wiped.

### Clearing the playfield row by row

A full screen wipe is not done in one shot; it is amortised one tilemap row per pass so it can run
inside the per-frame budget. `seedTileFillCursor` (0x02e6) arms the fill by storing a 16-bit write
cursor in `TILE_FILL_PTR` 0x880b [seen] and seeding the row count `FILL_ROW_COUNTER` 0x8809 [seen] to
0x20 (32 rows); `loc_02e3` (0x02e3) is the convenience entry that arms it from the fixed
`PLAYFIELD_TILE_BASE`. Each pass then calls `loc_02ce` (0x02ce), which blanks the incoming loop count
of cells (blank tile 0x10) from the cursor, advances the cursor by exactly one whole row for any count
(it writes `count` cells forward, then adds the 0x20-`count` remainder), stores the cursor back, and
decrements the row counter — signalling with the zero flag when the last row has drained. `loc_02c9`
(0x02c9) wraps that: it first zeroes the board-init RAM regions (via `loc_02b9` at 0x02b9, which clears
the sprite display list and the actor/object arena) and then blanks one tilemap row at the cursor, so a
board reset scrubs both state and screen together as the counter winds down.

### Flooding the colour/attribute map

The playfield's colours are painted a column at a time. `fillAttributeColumns` (0x075d) walks 31
columns from `ATTRIB_MAP_BASE`, taking one source byte per column and flooding it down all 30 rows at
the 0x20 stride, the source pointer advancing one byte per column — a single ROM table thus colours the
whole field. `loc_1dd3` (0x1dd3) chooses which field variant to paint from the round and game flags.
The default job floods a round-parity source — `FIELD_ATTRIB_SRC_A` 0x0839 [code] when
`ROUND_COUNTER` 0x8907 [seen] is odd, `FIELD_ATTRIB_SRC_B` 0x0879 [code] when even — then stamps a
short four-row, two-column marker (columns 5 and 6) in colour code 0x0f. The alternate job runs only
when the round is idle but the game is active (`ROUND_IN_PROGRESS` 0x8904 [seen] clear,
`GAME_ACTIVE_FLAG` 0x8806 [seen] set), on an odd or zeroth round, and only outside the attract dispatch
(`PLAY_MODE_LATCH` 0x8f50 [code] clear); it floods `FIELD_ATTRIB_SRC_C` 0x0859 [code] and stamps a
taller 16-row single-column strip in colour 0x09 at `FIELD_C_ATTRIB_DEST` 0x811c [code].

### Turning numbers into digit tiles

Score, timer and counter fields all funnel through a small set of BCD-to-tile helpers.
`splitBcdByte` (0x0429) takes a packed-BCD byte, writes its low nibble as the units tile at the cursor,
advances the cursor, and hands back the high nibble (with a zero-sense so the caller can suppress a
leading zero). `renderDigitWithBlanking` (0x059d) paints one digit with a leading-zero *budget*: a
non-zero digit stores as-is and ends the blank run, a zero digit stores the blank tile 0x10 while the
budget lasts (decrementing it) and only becomes a real "0" once the budget is spent — it threads both
the advanced cursor and the remaining budget out so a caller can walk a whole field. `drawStackedBcdDigits`
(0x1119) paints a packed byte as two stacked tiles — tens at the cursor, units one row up — with the
tens leading-zero suppressed. Two converters feed these: `byteToPackedBcd` (0x062a) turns a binary byte
into packed BCD (value mod 100) the way the Z80 does, through repeated decimal-adjust adds; and
`binToPackedBcd` (0x1131) counts a binary value up in BCD to produce the low two decimal digits plus a
hundreds tally — note the counterintuitive edge the hardware imposes: a count of zero means a full 256
passes, not zero, yielding 0x56 with a hundreds tally of 2.

### The score columns and the high score

`selectActivePlayerScoreBuffer` (0x04f2) resolves which BCD score buffer is live from bit 0 of
`ACTIVE_PLAYER` 0x880d [seen]: even selects player 1's `P1_SCORE_BCD` 0x88a2 [seen], odd selects
player 2's `P2_SCORE_BCD` 0x88a5 [seen]. `loc_056b` (0x056b) draws one of three counters down its
on-screen column: selector 0 paints P1's three bytes into `P1_SCORE_VRAM` 0x8781 [code], selector 1
paints P2's into `P2_SCORE_VRAM` 0x8521 [code], and any other value paints the high score (from
`HIGH_SCORE_BCD_HI` 0x88aa [seen] downward) into `HIGH_SCORE_VRAM` 0x8641 [code]; each byte is split
into its high then low digit and stacked one cell up per digit, with a four-blank leading budget so
short scores don't show leading zeros. `loc_0552` (0x0552) is the reset variant — it zeroes the
selected three-byte counter first, then repaints it, so the first four digits come out blank and the
last two as zeros.

`loc_0496` (0x0496) is the per-frame score accrual. It runs only while `GAME_ACTIVE_FLAG` bit 0 is set.
An award index of 0 adds the standing `PER_FRAME_SCORE_INCREMENT` 0x88ab [code]; any other index reads
a three-byte increment from `SCORE_AWARD_TABLE` 0x0501 [code] (stride 3). The increment is BCD-added
into the active player's counter with carry chained LSB-first, that column is repainted through
`loc_056b`, and then the counter is compared most-significant-byte-first against `HIGH_SCORE_BCD`
0x88a8 [code]; a strictly greater counter is copied over the high score and its column repainted with
the high-score selector, so the top-of-screen best tracks the leader in real time.

### Attract-screen panels

`loc_03e9` (0x03e9) paints the whole attract HUD. It first draws eleven consecutive character fields
(selectors 0x1a through 0x24) through `loc_05b2` (0x05b2), then renders the ten-entry high-score table
from `HIGH_SCORE_TABLE` 0x8a00 [code] into `HIGH_SCORE_TABLE_VRAM` 0x85c7 [code] as stacked BCD digit
pairs — three source bytes per row split low-then-high a row apart, the top pair's leading zero
suppressed, the column re-based two cells to the right each row — and finally repaints the digit panel
via `loc_0439` and the status panel via `renderPanelFromTable`. `loc_05b2` is the field engine: the low
seven bits of the selector, doubled, index the pointer table `FIELD_RECORD_PTR_TABLE` 0x7a0d [code];
each record is a two-byte destination address followed by an inline string, its characters written one
row up per cell. Bit 7 of the selector picks the mode — clear writes each character as a digit tile
(char minus '0'), set writes the blank tile for every character (used to erase a field). A '.' (0x2e)
ends a record and steps to the next, a '?' (0x3f) ends the whole run.

`loc_0439` (0x0439) renders ten rows of packed-BCD panel digits from `PANEL_DIGIT_SOURCE_TABLE`
0x89c0 [code] into `PANEL_DIGIT_VRAM_DEST` 0x8467 [code]: each row draws two source bytes as digit
pairs a row apart with a fixed separator tile (0x51) wedged between them, reading bytes 1 and 2 of
every three (it skips one byte per row) and re-basing two cells right each row. `renderPanelFromTable`
(0x0460) paints the status panel — ten rows of three cells from `PANEL_TILE_SOURCE` 0x8e00 [code] into
`PANEL_VRAM_DEST` 0x8567 [seen], each source byte painted when non-zero else the blank tile 0x40, the
first two cells of a row climbing (-0x20) and the third re-basing forward to the next column (+0x42).

### The credit counter

`loc_05ee` (0x05ee) draws the credit field (through `loc_05b2` selector 5), then reads
`CREDIT_COUNT` 0x8802 [seen] clamped to 99, converts it to packed BCD, and paints the tens tile into
`CREDIT_HUD_TENS_VRAM` 0x86bf [code] (skipped when zero) and the units into `CREDIT_HUD_UNITS_VRAM`
0x869f [code]. A current-state warning: this credit painter has an anti-tamper tripwire welded onto its
tail — only when the units digit is exactly 2 does it sum a fixed 31-byte program block and bump a
strike counter on a checksum miss, so the routine's behaviour is not purely cosmetic even though its
visible job is two digits.

### In-play HUD: gauge, stage number, count column, round marker

The phase gauge is a five-cell vertical bar. `renderPhaseGauge` (0x03c2) and its identical twin
`paintPhaseGauge` (0x2065) read `GAUGE_PHASE_COUNTER` 0x8908 [seen]: a zero count leaves the gauge
untouched, otherwise `count - 1` cells (clamped to five) are filled with tile 0xb0 from
`PHASE_GAUGE_BASE_TILE` 0x863f [seen] upward and the cells above them blanked with 0x10. Note the count
is drawn as count-*minus*-one filled cells, not count. `loc_1a85` (0x1a85) repaints the gauge and then
stores the play sub-state index for the active player. The same gauge counter doubles as the bonus
meter: `loc_18da` (0x18da) drains the pending award queue `AWARD_QUEUE` 0x8909 [code] — reloading it
from the schedule (5 or 3, per `BONUS_AWARD_DSW` 0x8800 [code]) when empty — and, when the active
player's score MSB reaches the queued threshold, saturating-bumps `GAUGE_PHASE_COUNTER`, BCD-steps the
queue to its next threshold, and redraws the gauge.

`renderStageCountdownDigits` (0x34c9) draws the stage number from `STAGE_COUNTDOWN` 0x8901 [seen]: a
value below ten renders as a single digit as-is at `HUD_STAGE_DIGIT_LO` 0x8743 [seen]; ten or more is
converted to packed BCD first (and that path is suppressed while `PLAY_MODE_LATCH` is held), with the
tens tile placed one row over and a leading zero dropped.

`loc_039b` (0x039b) paints the eight-cell count column at `COUNT_COLUMN_VRAM` 0x8482 [code], gated on
`GAME_ACTIVE_FLAG`: the fill height is the `ACTOR_TABLE` 0x8a80 [seen] head count plus one, clamped to
the column height, drawn with tile 0x0c and the remaining cells blanked with 0x10. A current-state
warning: the fill loop is an exit-tested down-counter, so a zero fill height runs a full 256-cell wrap
rather than painting nothing — faithful to the original hardware loop.

`loc_4a0b` (0x4a0b) draws the round marker, gated on bit 0 of `ROUND_COUNTER`. It snapshots
`SPAWN_PHASE_COUNTER` 0x8902 [seen] into both `SPAWN_PHASE_SNAPSHOT` 0x8d43 [code] and `ROPE_DRAW_COUNT`
0x8934 [seen], then, for a non-zero count, paints that many stacked two-wide marker pairs (top tiles
0xda/0xdb, bottom tiles 0xd8/0xd9) up a column from `MARKER_VRAM_BASE` 0x86c3 [code], saves the column
layout pointer in `MARKER_LAYOUT_PTR` 0x8932 [code], and stamps the 3x3 marker glyph from
`MARKER_GLYPH_SRC` 0x2754 [code] just below it; a zero count saves the alternate layout pointer and
stamps the glyph at the fixed anchor.

### Play-timer and multi-field displays

`loc_7960` (0x7960) renders the active player's play timer. It splits the minutes and seconds BCD bytes
of the live timer bank (`PLAY_TIMER_BCD_P1` 0x8a30 [code] or `PLAY_TIMER_BCD_P2` 0x8a33 [code], +2
being the minutes byte) into hi/lo nibble tiles walking up the column at `PLAY_TIMER_DIGIT_VRAM`
0x862d [code], parting the two fields with a spacer tile (0x51), and then clears the rendered timer
bytes. As a current-state warning, this render is bracketed by two integrity checksums — an entry check
over a fixed code block and a tail check reached only when a flag scan is dirty — so the routine is a
guarded handler, not a bare painter.

`loc_10c2` (0x10c2) drives a three-field packed-BCD sub-state display. It first walks a counter
(`SUBSTATE_FIELD1_COUNTER` 0x8f62 [code]) one step at a time toward a target — up or down per the entry
carry — then draws double that counter as field 1 at `SUBSTATE_FIELD1_VRAM` 0x85d0 [code]. Field 2 draws
`SUBSTATE_FIELD2_VALUE` 0x8f5e [code] directly when it is a single digit, otherwise re-encoded to
packed BCD, at `SUBSTATE_FIELD2_VRAM` 0x8652 [code]. Field 3, present only when `SUBSTATE_FIELD3_VALUE`
0x8f60 [code] is non-zero, is folded into the counter and drawn doubled at `SUBSTATE_FIELD3_VRAM`
0x85d2 [code], with the hundreds digit mirrored out to `SUBSTATE_FIELD3_HUNDREDS_VRAM` 0x85f2 [code]
when present; all three go through `drawStackedBcdDigits`. The routine closes by advancing
`MAINLOOP_SUBSTATE_SELECTOR` 0x8f5c [code] and queuing a sound cue. `loc_6f42` (0x6f42) is the
level-intro tally: it advances the intro phase and draws `HIT_TALLY` 0x8f52 [code] as a packed-BCD
pair at `HUD_INTRO_DIGITS_BASE` 0x8634 [code] with its doubled value two rows up.

### Glyph blocks and animated decorations

`loc_1ffb` (0x1ffb) renders one of two fixed 3x3 glyph blocks into the tilemap at `GLYPH_BLOCK_DEST`
0x8062 [code]: bit 5 of its selector chooses between `GLYPH_TILES_A` 0x203b [code] and `GLYPH_TILES_B`
0x2050 [code], delegating the stamp to `blitTile3x3Block`.

Several small decorations cycle a tile block on a hold timer. `loc_2563` (0x2563) is the main two-tile
animator: suspended while `PLAY_MODE_LATCH` is busy, it counts down a hold (`TWOTILE_ANIM_HOLD` 0x8f06
[code], reload 0x0c), and on expiry advances a phase (`TWOTILE_ANIM_PHASE` 0x8f07 [code]) and uses the
round parity and phase parity together to pick one of four four-byte source blocks from
`TWOTILE_SRC_TABLE` 0x2744 [code] and one of two anchors — `READY_SPRITE_TILE_VRAM` 0x87bb [code] on an
odd round, `TWOTILE_ANIM_VRAM_ALT` 0x84bb [code] otherwise — stamping it as two 2x2 squares, the second
three rows above the first. `loc_6b13` (0x6b13) is a simpler sibling: the same hold/phase machinery
picks one of two adjacent source patterns and stamps them at `BLIT_SCREEN_ANCHOR` 0x84b4 [code] and two
rows higher. `loc_76af` (0x76af) is a two-phase blink: on each countdown expiry (`BLINK_COUNTDOWN`
0x892a [code], reload 0x16) it toggles `BLINK_PHASE` 0x892b [code], selects one of the two-byte pairs
in `BLINK_TILE_PAIRS` 0x76e6 [code] by phase parity, and writes the pair into `BLINK_TILE_CELL_0`
0x8471 [code] and a cell 0x40 further on, swapping the blinking tiles. `loc_2bd3` (0x2bd3) stamps the
ready-sprite square from `READY_SPRITE_SRC` 0x2be1 [code] at `READY_SPRITE_TILE_VRAM` unless the
painted marker (top-left tile 0xba) is already there; `loc_2bbf` (0x2bbf) is the formation-panel
sibling that guards and paints the indicator at `FORMATION_READY_TILE_VRAM` 0x877b [code] before
stamping the same square. `loc_0a52` (0x0a52) paints two fixed 2x2 blocks from one shared source
`TILE_BLOCK_2X2_SRC` 0x0a72 [code] at `VRAM_TILE_BLOCK_DEST_A` 0x82aa [code] and
`VRAM_TILE_BLOCK_DEST_B` 0x826a [code].

A separate pair of routines animates a marching tile strip in place rather than re-stamping a block.
`advanceTileAnimForwardOnOdd` (0x2405) and `retreatTileAnimScript` (0x23ec) share the parity gate
`TILE_ANIM_PARITY` 0x8f37 [seen] and the video cursor `TILE_ANIM_CURSOR` 0x88be [seen], each bumping the
parity and acting only on its own half of the frame. On an odd frame the forward half either steps the
cursor one cell along and seeds the fresh cell with tile 0x34 (once the current tile code reaches the
wrap value 0x37) or otherwise animates the current cell's tile code up by one; on an even frame the
retreat half reverses this — a 0x34 marker reloads to 0x10 and steps the pointer back, any other code
is decremented. The net effect is a tile strip that creeps forward on odd frames and back on even,
cycling tile codes 0x10/0x34/0x37 to animate on screen.

### Rebuilding the sprite display list

Sprites are not drawn by these tile painters at all; they are described by a display list that
`loc_02ef` (0x02ef) rebuilds every frame at `SPRITE_DISPLAY_LIST` from the object-record banks. It
copies four record groups in turn: the two lead actors from `ACTOR_TABLE`, the two enemy-target records
from `ENEMY_TARGET_REC0` 0x8c90 [seen], the eighteen moving-object records from `ENEMY_ACTOR_TABLE`
0x8ae0 [seen] (with coordinate math), and the two arrow/launch records from ACTOR_TABLE+0x30. The plain
copies go through `copyObjectRecordsToDisplayList` (0x032a), which for each record emits bytes +0x06,
+0x10, +0x04 and +0x0f into four successive list slots and steps the record pointer by its stride,
advancing only the list's low byte so the writes wrap inside the list's 256-byte page. The moving-object
group instead goes through `loc_0343` (0x0343), which derives two of its four bytes as screen
coordinates from the record's sub-pixel position pairs (rec+5:+6 and rec+3:+4): a 16-bit fixed-point
pair is reduced to a pixel coordinate as (pair >> 5) - 8. After the four groups, `loc_02ef` drops each
of the arrow group's two sprite-Y bytes one pixel and hands the second to `loc_0320` (0x0320), which
decrements a caller-set frame counter and then — only when `FLIP_SCREEN_FLAG` 0x881f [seen] is zero,
i.e. the screen is flipped — mirrors the whole list through `mirrorSpriteListVertically` (0x0378). That
mirror walks the 24 stride-4 entries in place, negating and offsetting each coordinate byte (-x - 0x10)
and toggling the attribute byte's two flip bits while preserving its low nibble.

Two helpers feed this list. `deriveStackedSpriteYs` (0x23d7) fans the player-actor base Y from
`PLAYER_Y` 0x8a84 [seen] out to the three stacked player-sprite slots — slot 3 gets the base Y, slot 2
gets Y-0x10, and slot 1 gets Y-0x10+0x0a — since the player is drawn as three vertically stacked
sprites (their Y fields sit at ACTOR_TABLE +0x1c/+0x34/+0x4c). `loc_09f8` (0x09f8) is the combined
entry that steps four object records' animations and then rebuilds the display list.

### The display-list interpreter

Separate from the sprite list is a layout interpreter, `loc_4381` (0x4381), that copies a compressed
source stream into video RAM. It first chooses a pointer pair: the primary
`DISPLAY_LIST_DST_PTR` 0x8f43 [seen] / `DISPLAY_LIST_SRC_PTR` 0x8f45 [seen], or the alternate
`DISPLAY_LIST_DST_PTR_ALT` 0x88b8 [code] / `DISPLAY_LIST_SRC_PTR_ALT` 0x88ba [code] when
`FORMATION_SLOT_TABLE` 0x8920 [seen] is non-zero. It then walks up to 0x1d source bytes, interpreting
each: a plain byte is copied to the destination and both pointers advance one; a skip opcode (0x10)
reads the following byte, advances the destination by that many cells, and shrinks the remaining count;
a reload opcode (0xff) loads a fresh destination pointer from the next two stream bytes and folds the
byte after that into `SUBPHASE_TICK` 0x88b7 [seen], then stops. On exit — unless a reload broke the loop
— the destination is nudged forward three more cells, and the advanced destination and source pointers
are written back to whichever pair was chosen on entry, so the interpreter resumes mid-stream on the
next call.

## Sound

The main CPU never plays audio itself. It hands single command bytes to a separate audio CPU
across two ports and lets that processor do the work. There are two ways a command reaches it:
the main CPU can emit a byte immediately, or it can drop bytes into a command ring that a
frame-service routine drains one at a time. Almost every in-game sound and speech cue takes the
ring; only a couple of housekeeping cases go direct.

### Emitting a command

Every command that crosses to the audio CPU passes through **sendSoundCommand** (0x0e8f). It
writes the byte to **SOUND_COMMAND_LATCH** 0xa100 **[seen]** — the port the audio CPU reads —
and then strobes **AUDIO_IRQ_LATCH** 0xa181 **[seen]** high and immediately back low. That
rising-then-falling edge on the latch's single bit is the interrupt request that pulls the audio
CPU into reading the byte it just found on the port. In the running machine the strobe is a bare
pulse: the byte is placed, the line is raised, the line is dropped, and nothing about the pulse
width is remembered — so the latch/strobe pair is the whole visible act of "send."

Two callers reach this emitter directly, bypassing the ring entirely. Boot (in the power-on
setup) sends command 0 once, silencing the audio CPU before the game proper begins. And
**loc_0f09** is a fixed wrapper that emits the single preset code 0x0b straight to the port. A
direct emit is used only where there is no queue to speak of yet.

### The command ring

Everything else funnels through a small circular buffer that shares the top of the high-score
page. Its slots run from **SOUND_RING_BUFFER** 0x8a43 **[code]** up through 0x8a5e — twenty-eight
one-byte slots — and the code addresses them as **HIGH_SCORE_TABLE** 0x8a00 **[code]** plus a
cursor value. Note the counterintuitive layout: the ring lives in the same 0x8a00 page as, and
immediately above, the sorted high-score table; the two are adjacent regions the code reaches
through the same page base, not one shared buffer.

Two cursors track the ring. **SOUND_RING_WRITE_PTR** 0x8a40 **[code]** is the tail where the next
byte is stored; **SOUND_RING_READ_PTR** 0x8a41 **[code]** is the head that is consumed next. Both
hold a low-byte slot index in the range 0x43..0x5e, and both wrap the same way — stepping off the
last slot 0x5e returns to the first slot 0x43. When head and tail hold the same value with the
pointed-at slot marked empty, the ring is drained.

Boot lays this out cleanly: it fills all twenty-eight slots with the empty marker 0xff, seeds both
the write and read cursors to the origin 0x43, and separately writes the value 8 into the lone
cell 0x8a42 that sits between the read cursor and the first slot (its exact use is not pinned down
by the surrounding code; it is initialized here and left alone). 0xff therefore doubles as both
"slot never written" and "slot already consumed" — freeing a slot after use writes 0xff back into
it.

### Producing into the ring

Two writers feed the ring, and both advance the single write cursor 0x8a40 in lock-step. The raw
enqueue **loc_0eb3** takes a byte, stores it into the slot the write pointer names, and steps the
pointer (wrapping 0x5e back to 0x43). It is unconditional — the byte always lands. The gated
append **loc_0ea2** writes into the same ring through the same cursor, but first stashes the
incoming byte in **TEXT_RING_PENDING_BYTE** 0x8d20 **[code]** and then appends only while a game
is in progress (**GAME_ACTIVE_FLAG** 0x8806 **[seen]**) or the **PLAY_MODE_LATCH** 0x8f50
**[code]** is set; with both clear it returns having queued nothing. This gate keeps text/speech
appends from piling up outside of play. The append also hands its advanced cursor back to the
caller, which the immediate byte-store path does not.

Above these two writers sits a family of tiny fixed-command entries, each of which supplies one
or two constant bytes and defers to a writer. Single-byte cases cover the common effects — for
example loc_0ecf enqueues 0x00, loc_0ed6 enqueues 0x02, loc_0ef1 (and its trampoline loc_5f02)
enqueues 0x05, and loc_0f01 enqueues 0x09. Others queue a short burst in order: loc_0eda sends
0x82 then 0x03, loc_0f4e sends 0x82 then 0x95, loc_0f6c sends 0x19 then 0x15, and loc_0fb2 sends
0x27 then 0x15. loc_0f58 shows the two writers working side by side in one call: it appends the
two bytes 0x96 and 0x97 through the gated text path, then enqueues 0x18 and 0x15 through the raw
sound path. Sound cues and speech/text cues therefore travel the same ring and are told apart
only by their byte values and by which writer laid them down.

### Draining the ring

The head is emptied by **loc_0e64**, which the vblank service routine calls once per frame (a
second call site runs it in the level-intro per-frame body). One entry moves per call. It reads
the slot the read pointer names; if that slot holds the empty marker 0xff, the ring is empty and
it returns having done nothing. Otherwise it decides whether to actually voice the byte: it stays
silent only when demo sounds are disabled — bit 0 of **DEMO_SOUNDS_DSW** 0x8821 **[code]** clear —
*and* no game is active. In every other case (in play, or in attract with demo sounds enabled) it
passes the byte to sendSoundCommand, latching and strobing it across to the audio CPU.

Whether or not the byte was voiced, the drain then frees the slot by writing 0xff back into it and
advances the read pointer one step (wrapping 0x5e to 0x43). This is the important nuance: the ring
always drains at one byte per frame, and the enable check gates *sound*, not *consumption* — in a
silent attract the queued bytes are still eaten and their slots freed, they simply never reach the
audio CPU. Because production can burst several bytes into the ring in a single frame while the
service routine only ever removes one, the ring is what smooths those bursts into an
ordered, one-per-frame stream to the audio processor.

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


## Open questions — not yet grounded

These readings are consistent with the code but not yet closed; each is a candidate for MAME grounding
or a later understanding pass.

- **Display-command handler table (0x0242).** The main loop dispatches each dequeued display command's
  low byte through this ~16-entry table, but the per-handler semantics — what each 0x06xx argument paints
  or triggers — are not individually enumerated here.
- **Sprite hardware banks (0x9000 / 0x9400).** That the two banks hold complementary halves of each
  sprite's attributes (a position pair in one, a tile/attribute pair in the other) is read from the
  per-vblank copy pattern; the exact byte-role split is inferred, not independently grounded.
- **Input edge-detect history.** The vblank service shuffles the previous two frames' input samples up
  through 0x8813-0x8816 before writing the fresh inverted IN0/IN1/IN2; those history cells (and the raw
  IN0 read at 0xa080) carry no `names.js` const yet.
- **Standing stage-B work.** Many cells above carry **[code]**: their role is read from the translated
  behaviour but not yet confirmed against a MAME golden (they are static or unobservable in the current
  captures). Promoting each to **[seen]** — or overturning it — is the grounding still owed.
