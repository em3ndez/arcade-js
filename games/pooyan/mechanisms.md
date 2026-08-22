# Pooyan — how the machine works

This document describes the running machine as it is now, and is regenerated whole each understanding
pass. Confidence tags mirror `idiomatic/names.js`: **[seen]** = the cell's role is confirmed by a MAME
golden observation; **[code]** = read from the translated behaviour with MAME-grounding still open (the
cell is static or unobservable in the current goldens). The map covers both the machine's **state
architecture** — the work-RAM layout and the variables the game runs on — and its **control flow**: the
main loop, the vblank interrupt that is the machine's only per-frame heartbeat, and the state machines
that drive configuration, play, the actor arena, the wave/rope/launch cycle, rendering and the self-checks.


## The work RAM and its state model

The Z80 sees one flat 64K space, but only the bottom half is program: **`COLOR_RAM_BASE`** [code] at
0x8000 opens the machine's writable region and everything below it is ROM. From there up, five
distinct devices are pasted into the address map, and the whole state model rests on knowing which is
which. The tile picture lives in two planes — the colour/attribute map at 0x8000-0x83ff and the
tile-code map at 0x8400-0x87ff. The 2K of general-purpose work RAM occupies 0x8800-0x8fff. Two
256-byte hardware sprite banks sit at 0x9000 and 0x9400. And the strip at 0xa000-0xa1ff is not memory
at all but the input, DIP-switch, and control-latch hardware, where — critically — a read and a write
to the same address reach two entirely different devices.

### The two tile planes

The playfield is a pair of parallel 32x32 maps. **`VIDEO_RAM_BASE`** [code] at 0x8400 is the tile-code
plane: each cell names which 8x8 character ROM tile to draw, and cells are addressed row-major with a
0x20 stride between vertically-adjacent cells. **`COLOR_RAM_BASE`** [code] at 0x8000 is the matching
attribute plane, one attribute byte per tile cell, carrying the colour/palette selection. The two
planes are always written as a unit: a tile is placed by storing its code into the 0x8400 plane and
its colour into the corresponding 0x8000 cell.

Boot lays both planes down before play. It floods the attribute plane from **`ATTRIB_MAP_BASE`**
[seen] (0x8040) — the map is painted a column at a time, 31 columns of 30 rows on the 0x20 stride —
and it blanks the tile plane, writing the erase tile 0x1e across 0x3c0 cells from
**`VIDEO_RAM_BLANK_START`** [code] (0x8440) through the end of video RAM. The row-by-row fill that
repaints the playfield during state transitions marches a 16-bit cursor down the plane from
**`PLAYFIELD_TILE_BASE`** [code] (0x8402), advancing one 0x20-stride row per pass. The attribute plane
is not just decoration for the game logic: two vertical column strips of it, at
**`HUD_INTEGRITY_STRIP_A`** [code] (0x82bc) and its tile-plane sibling at 0x86bc, are column-summed as
a self-integrity check, so a corrupted picture region is also a tripped alarm.

### The sprite banks

Hardware sprites are attribute records, not pixels, and they live in their own two banks:
0x9000-0x90ff is sprite bank 0 and 0x9400-0x94ff is bank 1 (the bank is selected by address bit
0x0400 within the 0x9000-0x9fff window, which mirrors). Each bank holds stride-4 sprite records
beginning a little above its base — boot clears 0x30 bytes at **`SPRITE0_CLEAR_BASE`** [code] (0x9010)
and **`SPRITE1_CLEAR_BASE`** [code] (0x9410), i.e. bank-base + 0x10, which is where the live records
start.

These hardware banks are downstream of a staging buffer that lives in work RAM, not in the banks
themselves. **`SPRITE_DISPLAY_LIST`** [seen] at 0x8840 is the 24-entry, stride-4 sprite display list;
its first byte is the first sprite's Y coordinate, and the whole list is rebuilt every frame from the
moving-object records, then swept for collisions and — when the screen is flipped — mirrored
vertically before it reaches the sprite banks. So the model is: object records drive the 0x8840 list,
the list drives the 0x9000/0x9400 sprite hardware.

### The shape of work RAM

The 2K at 0x8800-0x8fff is where all mutable game state lives, and it has a deliberate top-to-bottom
shape. Boot zeroes almost the whole block — 0x7fe bytes up from **`BONUS_AWARD_DSW`** [code] (0x8800)
— but stops two bytes short of the top on purpose. The emulated stack pointer initialises to 0x9000
and grows downward through a scratch window of roughly 0x8fc0-0x8fff, so the top word must be kept
clear of both the zero-fill and the stack. That top word, **`ROM_SELFTEST_TALLY`** [code] (0x8fff),
holds the program-memory self-test result: boot reserves it with a single unbalanced push (leaving the
pointer parked at 0x8ffe), which keeps it physically above the stack so the per-frame register-save at
interrupt time cannot clobber it, because a later setup step refuses to advance unless the tally shows
a full pass.

Below that scratch region the 2K is organised by function, low addresses to high.

**Configuration (0x8800-0x882f).** The bottom of work RAM caches the cabinet's DIP-switch settings,
decoded once at boot and then treated as read-only. DIP bank 1 is complemented and rotated apart into
**`CABINET_MODE_FLAG`** [code] (0x880f), **`BONUS_AWARD_DSW`** [code] (0x8800),
**`DIFFICULTY_DSW`** [code] (0x8820, a 3-bit value scaling enemy schedules),
**`DEMO_SOUNDS_DSW`** [code] (0x8821), and the lives count **`LIVES_DSW`** [code] (0x8807). DIP bank 0
supplies the two coin-slot coinage nibbles, looked up through a ROM table into **`COINAGE_CONFIG`**
[seen] (0x882c) and **`COINAGE_CONFIG_SLOT2`** [code] (0x882f), where the sentinel value 0x0f means
free play. The live credit balance, **`CREDIT_COUNT`** [seen] (0x8802), also sits here: a coin adds
one, a 1-player start consumes one and a 2-player start consumes two, and the value is drawn as two
HUD digits.

**Top-level state selectors and the frame spine.** The single most important byte is
**`MAIN_GAME_STATE`** [seen] (0x8805): the vblank service routine reads it every frame and dispatches
through a jump table (attract / intro / play). Alongside it, **`GAME_ACTIVE_FLAG`** [seen] (0x8806)
gates the in-play handlers (set 1 at start-of-life, cleared 0 at game-over, and gameplay handlers
return early when it is 0), **`PLAY_STATE_INDEX`** [seen] (0x880a) is the masked in-play sub-state
dispatched through a second table, and **`FLIP_SCREEN_FLAG`** [seen] (0x881f) records the screen
orientation. One flag here overrides everything downstream: **`TAMPER_FREEZE_FLAG`** [code] (0x881e),
raised by the anti-tamper guards, freezes spawns and aborts actor updates when nonzero.

**The input edge-detect ring (0x8810-0x8816).** The vblank service samples the three hardware input
ports each frame, complements them (so an active-low pressed bit becomes a 1 in RAM), and stores them
at the head of this ring: IN0 into **`INPUT_PORT0`** [seen] (0x8810) with coin on bit 0, 1P-start on
bit 3 and 2P-start on bit 4; IN1 into 0x8811; IN2 into 0x8812. Immediately before writing the new
sample it shifts the previous frame's values up into 0x8813-0x8816, so the game can compare this frame
against last frame and detect a *press* (an edge) rather than a held level — that is how a single coin
insertion registers exactly once.

**The two command rings.** Work RAM carries two producer/consumer ring buffers, both marked empty
(0xff in every slot) at boot. The display-command ring occupies 0x88c0-0x88ff as 32 two-byte slots,
addressed by low byte within page 0x88; **`DISPLAY_CMD_RING_WRITE_PTR`** [code] (0x88a0) fills upward
two bytes per enqueue and **`DISPLAY_CMD_RING_READ_PTR`** [code] (0x88a1) drains it. The read side is
also the main loop's dispatcher: it reads the slot the cursor points at, and a value with bit 7 set —
the 0xff empty marker included — means "run the per-frame worker", while a value with bit 7 clear is a
real command whose type indexes a handler table and whose following slot supplies an argument; both
slots are then freed back to 0xff and the cursor advanced, wrapping 0xff back to 0xc0. So an idle ring
naturally keeps running the worker, and a backlog is drained within the frame. The sound-command ring
is smaller — slots 0x8a43-0x8a5e — with **`SOUND_RING_WRITE_PTR`** [code] (0x8a40) and
**`SOUND_RING_READ_PTR`** [code] (0x8a41); its head slot is addressed as high-score-table-base plus
the head index, and the drainer hands one byte per frame to the audio CPU (gated so attract stays
silent unless demo sounds are enabled) then frees the slot and advances the head, wrapping 0x5e back
to 0x43.

**Score, high score, and the per-player banks.** The active player's running score is a 3-byte BCD
buffer, **`P1_SCORE_BCD`** [seen] (0x88a2) or **`P2_SCORE_BCD`** [seen] (0x88a5), selected by the
active-player flag; **`PER_FRAME_SCORE_INCREMENT`** [code] (0x88ab) is added into it each frame when an
award is pending, and the running high score is kept in step at **`HIGH_SCORE_BCD`** [code]
(0x88a8..0x88aa), MSB at **`HIGH_SCORE_BCD_HI`** [seen] (0x88aa). The sorted top-ten sits separately at
**`HIGH_SCORE_TABLE`** [code] (0x8a00), ten 3-byte BCD entries seeded to a default at boot and
insert-sorted on game-over.

The per-player split is the heart of the two-player model. A single "live page" beginning at 0x8900
holds the transient state of whoever is currently playing — its speed index **`SPEED_INDEX`** [seen]
(0x8900), the round counter **`ROUND_COUNTER`** [seen] (0x8907), the phase gauge, spawn phase, and so
on. When play passes to the other player, that whole 0x3f-byte page is copied out to the outgoing
player's bank and the incoming player's bank is copied back into 0x8900. The two banks are
**`PLAYER0_STATE_BANK`** [seen] (0x8940) and **`PLAYER1_STATE_BANK`** [seen] (0x8980), each a frozen
mirror of the live page; the byte at bank + 8 is that player's remaining lives, **`PLAYER0_LIVES`**
[seen] (0x8948) and **`PLAYER1_LIVES`** [seen] (0x8988), seeded from the lives DIP and drained on
death. Which bank is live is chosen by **`ACTIVE_PLAYER`** [seen] (0x880d), and whether the game is a
two-player game at all by **`TWO_PLAYER_FLAG`** [seen] (0x880e).

**The actor arena.** Most of the upper work RAM is record arrays with a common 0x18-byte stride.
**`ACTOR_TABLE`** [seen] (0x8a80) is the primary arena, zero-filled at board init, whose slot 0 is the
player/lead actor: its vertical position **`PLAYER_Y`** [seen] (0x8a84) is the value enemy AI targets,
and its state byte carries the sampled joystick and the aim indicator. Around it are the other record
pools — the enemy sub-array at **`ENEMY_ACTOR_TABLE`** [seen] (0x8ae0), the object/projectile tables
(0x8b70, 0x8be8, 0x8c48), the formation and hunter tables (0x8c30, 0x8c78), and the I-parity
enemy-target pair at 0x8c90/0x8ca8 — each swept on the same stride by its own per-frame handler. Woven
through the same address range are the wave, spawn, launch, and rope state machines, each a small
cluster of a selector byte, a countdown timer, and one or two latches. Two free-running counters pace
everything: **`FRAME_COUNTER`** [seen] (0x8a5f), decremented every vblank, whose zero-crossings gate
the periodic integrity checks, and the frame counter's low bits phase the animations.

### The hardware I/O window (0xa000-0xa1ff)

The top strip of the address map is memory-mapped hardware, and the read side and write side of a
given address are unrelated devices — reading 0xa000 samples a DIP bank, writing it pets a watchdog.

**Reads — the inputs and DIP switches.** All four ports are active-low (idle 0xff, a set bit is a
released control). 0xa000 reads DIP bank 1 (**`DSW1_PORT`** [code]) and 0xa0e0 reads DIP bank 0
(**`DSW0_PORT`** [code], the coinage bank) — both consumed only at boot to fill the config cells above.
The live controls are three ports: 0xa080 is IN0, the coin and start inputs (coin bit 0, coin-2 bit 1,
service bit 2, 1P-start bit 3, 2P-start bit 4), sampled each frame into the edge-detect ring; 0xa0a0 is
IN1 (**`IN1_PORT`** [code]), the player-1 joystick and fire (up bit 2, down bit 3, fire bit 4), used in
the upright orientation; and 0xa0c0 is IN2 (**`IN2_PORT`** [code]), the player-2 controls used when the
cabinet is a flipped cocktail.

**Writes — the watchdog, sound port, and control latch.** A write to 0xa000 kicks the hardware
watchdog; the vblank service does this once per frame, so a hung CPU that stops servicing interrupts
lets the watchdog time out and reset the board. The sound port is a two-address handshake to the audio
CPU: the command byte is stored at **`SOUND_COMMAND_LATCH`** [seen] (0xa100), then the audio-IRQ line
is strobed high and low at **`AUDIO_IRQ_LATCH`** [seen] (0xa181), which interrupts the sound CPU into
reading the byte.

Everything from 0xa180 to 0xa187 is a single 8-bit addressable latch (an LS259) in which the address
selects *which bit* to write and only bit 0 of the written value lands — so one address is one control
line. 0xa180 is bit 0, the vblank-NMI enable (**`NMI_ENABLE_LATCH`** [code]): the frame service clears
it at entry to mask further NMIs and sets it again at exit to re-arm, and boot writes it 1 to turn
interrupts on once setup is done. 0xa181 is bit 1, the audio-IRQ strobe already described. 0xa183 is
bit 3, the coin-counter drive (**`COIN1_COUNTER_LATCH`** [code]), pulsed by a small timed strobe that
turns queued coin credits into physical counter clicks. 0xa187 is bit 7, the flip-screen latch
(**`FLIP_SCREEN_LATCH`** [code]): the frame service copies the orientation flag from work RAM
(0x881f) into it every frame — and note the polarity is *inverted* at the hardware, so a latched 0
means a flipped screen and the boot's write of 1 selects the normal upright picture. The remaining
latch bits (audio mute at bit 2, and the coin/payout lines) round out the same 259 but are touched
only by their dedicated handlers.


## The frame loop and the vblank heartbeat

Pooyan runs on two clocks that never touch each other directly. The CPU spends its whole life inside one tight loop at `loc_020f` that never waits for anything; the display's 60 Hz vertical blank fires a non-maskable interrupt into `loc_066d` that does the real per-frame work and then hands the CPU back exactly where it was. The loop is the muscle that keeps chewing through queued drawing work; the NMI is the metronome. Everything that has to happen "once a frame" -- reading the joysticks, aging the timers, kicking the watchdog, advancing the game's top-level state -- happens in the interrupt, because the loop itself has no sense of time.

The heartbeat has to be switched on deliberately. The power-on reset vector `loc_0000` immediately writes 0 to `NMI_ENABLE_LATCH` **[code]** (bit 0 of the LS259 at 0xa180), holding the vblank interrupt off so the boot self-test and RAM setup can run without being interrupted. The last thing the boot entry `loc_0092` does before dropping into the loop is write 1 back to that latch, arming the interrupt. From that instant on, the machine has a pulse, and the loop starts spinning.

The loop's job is to service the **display-command ring**, a 32-slot circular queue living at `DISPLAY_CMD_RING_BUFFER` **[code]** (0x88c0-0x88ff, two bytes per slot). Producers all over the code append work to it through the enqueue helper `loc_0038`: it looks at the slot under the write cursor `DISPLAY_CMD_RING_WRITE_PTR` **[code]**, and only if that slot is free (its top bit set, which the boot guarantees by flooding the whole ring with 0xff) does it drop the command's two bytes in -- a type byte then an argument byte -- and step the cursor forward by two, wrapping back to 0xc0 when it runs off the end. If the slot is already occupied, the command is simply dropped rather than overwriting live work.

Each pass of the loop reads the slot under the separate read cursor `DISPLAY_CMD_RING_READ_PTR` **[code]** and doubles that byte so its top bit lands in carry. An empty slot (0xff) has that bit set, and that is the loop's signal that the ring is drained: it runs the per-frame worker and comes back around. A real command has the bit clear, so instead the loop consumes the slot -- stamping both of its bytes back to 0xff to free them, advancing the read cursor by two (wrapping at 0xc0), and stashing the argument byte. It then indexes the doubled type byte into the handler jump table at ROM 0x0242, pushes the loop's own top address so the handler's return lands right back here, and jumps into the handler. Notice what this means: the ring is *self-terminating*. The loop never compares the read cursor against the write cursor; it drains commands until it hits the 0xff free-marker, then falls through to the worker. Several table entries point at `loc_0e53`, a bare-return phantom that consumes a command slot and draws nothing -- a deliberate no-op dispatch target.

> A counterintuitive but important reading: the loop has **no vblank wait** in it at all. Because it never blocks, it works through *every* command queued in the ring during the gap between two interrupts, not one command per frame. A backlog built up on, say, the credit screen is meant to be flushed in a single inter-vblank interval, not dribbled out one command at a time.

When the ring finally reads empty, the loop calls the per-frame worker `loc_0254`. The worker first consults `WORKER_CONTROL_BYTE` **[code]** (0x883f): if its low nibble is nonzero it spends the pass on the ROM-signature anti-tamper check `verifyRomSignature` (which trips `SIGNATURE_MISMATCH_FLAG` **[code]** on a mismatch) and returns. Otherwise, and only while `GAME_ACTIVE_FLAG` **[seen]** is set, it repaints the scrolling tilemap columns: in a one-player game it blanks a run of four three-tile columns starting at `COLUMN_CAP_VRAM` **[code]** and `P2_SCORE_VRAM` **[code]**, while in a two-player game (`TWO_PLAYER_FLAG` **[seen]**) it stamps a capped body column instead. It then paints the column at `WORKER_COLUMN_VRAM` **[code]** through `loc_02a8`, and if the control byte's bit 4 is set it blanks one final column, choosing between the two column bases by `ACTIVE_PLAYER` **[seen]**. Every column walks one tilemap row upward (a -0x20 stride) per cell.

The actual once-a-frame work all lives in the vblank NMI `loc_066d`. On entry it saves the entire register file -- main set, shadow set, and both index registers -- then immediately masks itself off by writing 0 to `NMI_ENABLE_LATCH`, so the service routine cannot re-enter itself. It rebuilds the hardware scroll columns (via `loc_0714`), kicks the watchdog with a write to 0xa000 -- the one duty that makes this a true heartbeat, since a missed frame would let the watchdog reset the board -- and samples the three input ports. Each port is read active-low, complemented, and pushed into the edge-detect ring headed by `INPUT_PORT0` **[seen]** (0x8810-0x8812), with the previous frame's samples shifted down alongside so handlers can tell a fresh press from a held button. It then ages the two per-frame counters, decrementing the worker's `WORKER_CONTROL_BYTE` and the free-running `FRAME_COUNTER` **[seen]** (0x8a5f) whose low bits phase animations and whose zero-crossings gate the integrity checks. It also drains one entry from the sound-command ring `SOUND_RING_BUFFER` **[code]** (via `loc_0e64`), handing it to the audio CPU.

The interrupt's centerpiece is the top-level dispatch: it reads `MAIN_GAME_STATE` **[seen]** (0x8805) and jumps through the table at 0x06f0 into exactly one of the attract / intro / play handlers, which does that frame's game logic and returns into the NMI's own epilogue. The epilogue copies `FLIP_SCREEN_FLAG` **[seen]** (0x881f) into bit 7 of the flip-screen latch `FLIP_SCREEN_LATCH` **[code]** to hold the screen orientation, restores every saved register in reverse, writes 1 back to `NMI_ENABLE_LATCH` to re-arm the next frame's interrupt, and returns to the interrupted PC -- dropping the CPU straight back into the middle of the main loop, which never even knew it had been away.


## Configuration, coinage and players

### Boot-time DIP-switch decode

Every operator-facing option lives in the two DIP-switch banks, and the machine reads them exactly
once — at power-on, inside the boot entry `loc_0092`. The switches are wired active-low, so the boot
first complements the byte it reads from `DSW1_PORT` [code] (0xa000) and then rotates the complemented
value field-by-field into a row of dedicated work-RAM configuration cells. Each cell is written here and
nowhere else, so from the main loop's point of view they are read-only settings.

The DSW1 fields land like this. Bits 0-1 select the starting life count: the boot maps the raw values
0/1/2 to three, four, or five lives and the fourth setting to 0xff, storing the result in `LIVES_DSW`
[code] (0x8807). Bit 2 becomes `CABINET_MODE_FLAG` [code] (0x880f), the upright/cocktail selector. Bit 3
becomes `BONUS_AWARD_DSW` [code] (0x8800), which picks the extra-life award schedule. Bits 4-6 are masked
into `DIFFICULTY_DSW` [code] (0x8820), a three-bit difficulty level. Bit 7 becomes `DEMO_SOUNDS_DSW`
[code] (0x8821), the attract-mode sound enable.

The coinage settings come from the other bank. The boot reads `DSW0_PORT` [code] (0xa0e0) uncomplemented
and splits it into two nibbles, one per coin slot. Each nibble is not used directly — it indexes the ROM
byte table `COINAGE_TABLE` [code] (0x0053), and the fetched byte is the packed coin/credit ratio for that
slot. The low nibble's lookup is stored in `COINAGE_CONFIG` [seen] (0x882c) for coin slot 1 and the high
nibble's in `COINAGE_CONFIG_SLOT2` [code] (0x882f) for coin slot 2. A resolved config byte of 0x0f is the
free-play sentinel and is tested for all over the credit logic.

The same boot pass also establishes screen orientation: it writes 1 (upright) to both the software flag
`FLIP_SCREEN_FLAG` [seen] (0x881f) and the hardware `FLIP_SCREEN_LATCH` [code] (0xa187), and every NMI
thereafter copies the software flag into bit 7 of the latch so the current orientation always reaches the
video hardware.

### Coin insertion and credit bookkeeping

Coins are serviced once per frame by the credit/coinage-gated chain `loc_59e8`. Its first act is a
free-play short-circuit: if either coinage config (`COINAGE_CONFIG` or `COINAGE_CONFIG_SLOT2`) reads the
0x0f sentinel it returns immediately — with free play there are no coins to count. Otherwise it runs three
coin-input handlers (`loc_5a06`, `loc_5a56`, `loc_5a1f`), then the coin-counter strobe generator
(`loc_5a9c`), then a program-integrity check (`loc_7e6d`).

All three coin-input handlers share one shape and differ only in which input line they watch and what they
do on a clean edge. Each reads the debounced input sample `INPUT_PORT0` [seen] (0x8810) — a per-NMI
complemented copy of the coin/start hardware port whose bit 0 is coin 1, bit 1 is coin 2, and bit 2 is the
service credit. The handler rotates the bit it cares about into carry, shifts it into a small per-line
shift ring (0x882a for coin 1, 0x882d for coin 2, 0x8829 for service), and fires only when the low three
bits of that ring hold the pattern `001` — i.e. exactly on the leading edge of a fresh press, which
debounces the switch so one coin cannot bank a burst of credits.

The service line (`loc_5a06`) is the simple case: on its edge it plays a sound and adds one credit
outright. The two real coin slots do coinage arithmetic. Coin 1 (`loc_5a56`) first queues a physical
coin-counter pulse by bumping `COIN1_PULSE_COUNT` [code] (0x8824), then adds a fixed step of 0x10 to a
per-slot accumulator (0x882b) and compares it against the slot's config byte: while the accumulator has
not passed the threshold packed in the config's high nibble it simply returns, so several coins may be
required before anything is granted. Once the threshold is crossed it subtracts the consumed amount back
out of the accumulator and grants credits equal to the config's low nibble — unless that low nibble is the
0x0f free-play sentinel, in which case the credit count is pinned to its 0x63 maximum. Coin 2 (`loc_5a1f`)
is identical but uses its own counter (0x8826), accumulator (0x882e) and config (`COINAGE_CONFIG_SLOT2`).

Warning: the coin-1 accumulator byte at 0x882b is the cell named `TAMPER_ROM_CHECK_FLAG` [code] elsewhere
in the map — the same RAM location is multiplexed as an eagle-spawn checksum flag during play and as this
coinage accumulator on the coin path. Read in the coin context it is a running coin tally, not a tamper
flag.

Granted credits accumulate in `CREDIT_COUNT` [seen] (0x8802), a BCD counter clamped to 0x63 (99). It is
drawn to the panel by `loc_05ee`, which clamps the value, converts it to packed BCD, and paints the tens
and units as two HUD tiles (the units digit also triggers a small program-checksum tripwire).

The queued physical pulses are turned into real meter movement by `loc_5a9c`, the coin-counter 1 pulse
generator. It ignores an empty queue; on a fresh pulse it seeds the phase timer `COIN1_PULSE_PHASE` [code]
(0x8825) to 0x30 and raises `COIN1_COUNTER_LATCH` [code] (0xa183, the LS259 bit driving the physical coin
meter); on subsequent frames it counts the phase down, drops the latch at phase 0x18, and retires one
queued pulse when the phase reaches zero — giving each coin a clean, timed strobe on the mechanical
counter.

### Consuming credits and starting a game

Whether a start button can launch a game is decided by the attract state handlers, and the rule depends on
coinage. In coin mode the shared attract epilogue `loc_0bb5` only lets the top-level state advance while
`CREDIT_COUNT` is non-zero; in free play (`COINAGE_CONFIG` == 0x0f) it instead inspects the start bits of
`INPUT_PORT0` directly — bit 3 for one-player, bit 4 for two-player — and jumps straight into the start
sequence, since no credit is needed.

The actual credit debit happens in the start handler `loc_0d78` and its one-player sibling `loc_0de4`. A
one-player start (`INPUT_PORT0` bit 3) decrements `CREDIT_COUNT` by one and enters the start sequence with
HL = 0x0000; a two-player start (bit 4) first checks that at least two credits are present, subtracts two,
and enters with HL = 0x0100. The start sequence itself, `loc_0da8`/`loc_0dab`, writes that HL word to the
player-selection pair in one 16-bit store: the low byte lands in `ACTIVE_PLAYER` [seen] (0x880d) and the
high byte in `TWO_PLAYER_FLAG` [seen] (0x880e). So a one-player start leaves both zero, while a two-player
start leaves the active player at 0 (player 1 goes first) and the two-player flag set. `loc_0dab` then
seeds the in-play state — clearing the play sub-state index, setting the main game state to play and the
in-play gate to 1, restoring upright orientation — and, when the two-player flag is set, fires the extra
player-2 setup. It calls `loc_0e54`, which enqueues the primary panel display command plus, only when the
coinage config is the free-play sentinel, an extra "FREE PLAY" panel command.

A game already in progress can still take a second coin: `loc_7fd6` is a per-frame trigger that returns
unless there is a credit banked, checks whether the relevant player slot is still empty (via
`TWO_PLAYER_FLAG`, `ACTIVE_PLAYER`, and the per-player life counts), and — if a start bit is pressed —
routes back through `loc_0d78` to debit the credit and bring the second player in.

At the end of a game the teardown path (`loc_1d0d`/`loc_1d15`) branches on `TWO_PLAYER_FLAG` and
`CREDIT_COUNT` to decide between restart and a full stop, and on final game-over it clears both
`ACTIVE_PLAYER` and `TWO_PLAYER_FLAG` back to zero.

### Active-player selection and two-player state

Once play is running, `ACTIVE_PLAYER` is the switch that routes every per-player resource. Its bit 0
selects the score buffer: `selectActivePlayerScoreBuffer` returns `P1_SCORE_BCD` [seen] (0x88a2) when the
bit is clear and `P2_SCORE_BCD` [seen] (0x88a5) when set, and the same bit chooses which score the running
totals and the bonus-award threshold compare against.

The two players are kept apart by a bank-swap discipline. There is a single live actor/state page, and
each player owns a saved 0x3f-byte bank — `PLAYER0_STATE_BANK` [seen] (0x8940) and `PLAYER1_STATE_BANK`
[seen] (0x8980) — whose byte 1 is the opening X position and whose lives are held at `PLAYER0_LIVES`
[seen] (0x8948) and `PLAYER1_LIVES` [seen] (0x8988). On a death or turn change the live page is written
out with `saveLiveStateToPlayerBank` (or `saveLivePageToPlayer0Bank`, which also latches the active player
to 1 when a two-player game's player 1 is still alive), always steering to the bank chosen by
`ACTIVE_PLAYER`. At the start of each round `loc_1601` copies the active player's saved bank back into the
live page, so a two-player game alternates by swapping whole state pages rather than by keeping two live
copies.

`loc_1601` is also where `CABINET_MODE_FLAG` earns its keep: on the first entry of a two-player round,
when the cabinet flag is clear (cocktail), it sets `FLIP_SCREEN_FLAG` to the incoming player's index so
the display flips for the second player sitting across the table, and it enqueues a per-player
player-select banner command; an upright cabinet leaves the orientation alone.

### Config-driven schedules

Three of the boot-decoded settings feed gameplay schedules rather than the credit path. Both players'
starting lives are seeded from `LIVES_DSW` by the board-reset routine `loc_0e00`, which stamps that value
into `PLAYER0_LIVES` and `PLAYER1_LIVES`; the same routine also copies `DIFFICULTY_DSW` into byte 0 of
each player's bank, where it doubles as the player sprite's colour, and the difficulty value additionally
scales enemy spawn and threshold tables during play.

`BONUS_AWARD_DSW` drives the extra-life award schedule in `loc_18da`. When the pending threshold queue
`AWARD_QUEUE` [code] (0x8909) is empty it reloads with 5 or 3 depending on the award switch; otherwise it
waits until the active player's score MSB reaches the queued threshold, then bumps the saturating award
gauge, BCD-advances the queue by 8 or 7 (again per the switch) to set the next threshold, redraws the HUD
gauge, and appends the award sound. `DEMO_SOUNDS_DSW`, finally, is the boot-decoded gate that enables (or
silences) sound during the attract loop.


## In-play progression and timers

### The top-level state machine

Every frame the vblank interrupt (loc_066d) samples the three input ports into the
`0x8810` edge-detect ring, decrements two per-frame counters, and then dispatches on the
one byte that decides what the whole machine is doing: `MAIN_GAME_STATE` **[seen]** at
`0x8805`. It is used as an index into a five-way jump table, so its value maps directly to
a handler:

- `0` &rarr; loc_072d, the attract set-up state that drains the row-by-row tilemap fill and,
  once a boot self-test reads as passed, hands off to the attract display (advancing
  `MAIN_GAME_STATE` to `1`);
- `1` &rarr; loc_0899, the attract/intro machine, which itself sub-dispatches on the attract
  sub-state at `0x8e51`;
- `2` &rarr; loc_0c4e, the coin/credit and start state, sub-dispatching on `PLAY_STATE_INDEX`
  (`0x880a`) and running the credit post-handler loc_0d78 afterward;
- `3` &rarr; loc_159b, the in-play state described below;
- `4` &rarr; loc_0e53, a bare no-op that returns without drawing.

Running underneath `MAIN_GAME_STATE` is the in-play gate `GAME_ACTIVE_FLAG` **[seen]** at
`0x8806`. Start-of-life (loc_0dab) seats the pair together: it writes `MAIN_GAME_STATE = 3`
and `GAME_ACTIVE_FLAG = 1`, resets the play sub-state to `0`, and calls the board reset
loc_0e00. Game-over runs the opposite path (loc_1d15 / loc_1d3c): it clears
`GAME_ACTIVE_FLAG` back to `0`, blanks the live-state page, resets `PLAY_STATE_INDEX`,
`ACTIVE_PLAYER` **[seen]** (`0x880d`) and `TWO_PLAYER_FLAG` **[seen]** (`0x880e`), and drops
`MAIN_GAME_STATE` back to `1` so the machine returns to attract. `GAME_ACTIVE_FLAG` is what
the per-frame gameplay handlers read to decide whether to do anything at all — the play-timer
tick, the field painter, and several object updaters all return immediately when it is clear.

The interrupt also keeps the free-running `FRAME_COUNTER` **[seen]** at `0x8a5f`, decremented
once per vblank so it walks steadily downward and wraps. Its low bits phase animations and its
zero-crossings gate the periodic integrity self-checks; a sibling per-frame counter, the
`WORKER_CONTROL_BYTE` **[code]** at `0x883f`, is decremented alongside it and controls the
per-frame display worker. Neither is reloaded by the progression logic — they simply free-run
while the machine is powered.

### The in-play sub-state machine and the phase timer

In state `3`, loc_159b does two things each frame: it ticks the active player's BCD play-timer
(below), then dispatches on the low five bits of `PLAY_STATE_INDEX` **[seen]** (`0x880a`)
through a second jump table. This sub-state is the level-intro-to-active-play sequencer, and its
handlers step it forward through the observed phase values (`1`, `2`, `3`, `4`, and the higher
transition/bonus phases):

- index `0` (loc_1601) is round init. It waits for the tilemap fill to drain (returning early
  until it does), clears the actor arena and a block of round-init cells, and then seeds the
  phase timer and advances the sub-state. On the first entry of a round it also raises a
  once-per-round latch, enqueues the player-select display command and floods the colour map;
  otherwise it uses a short timer seed. The shared tail restores the active player's saved bank
  into the live page (below) and copies the round message table into the tile message buffer.
- index `1` (loc_16b7) is a timed wait. Each frame it decrements `PHASE_TIMER` **[seen]**
  (`0x8808`) and returns while it is still nonzero; only when it expires does the phase run its
  field set-up — it chooses a (graphic, layout) pointer pair from a decision tree keyed on the
  round and in-progress flags, seeds the fixed pointers, bumps `PLAY_STATE_INDEX` to the next
  phase, and enqueues a display command. `PHASE_TIMER` is the general-purpose phase clock: it is
  reloaded (to `0x02`, `0x80`, or a latched value at round init) and counted down by the state
  handlers to time each transition.
- index `2` (loc_175d) advances the sub-phase animation clock and then commits to active play.
  It increments `SUBPHASE_TICK` **[seen]** (`0x88b7`), which wraps at `0x1c`; on each wrap it
  toggles the display sub-phase one-shot at `0x8920` (`FORMATION_SLOT_TABLE` **[seen]**, whose
  byte 0 fires on that wrap). Past those guards, and provided a credit is in play and the round
  has not already started, it marks the round in progress — `ROUND_IN_PROGRESS` **[seen]**
  (`0x8904`) `= 1` and `WAVE_ARRIVAL_COUNTER` **[seen]** (`0x8903`) `= 2` — runs the level-start
  batch (round-number render, siren/spawn set-up, seeding several object timers to `0x10`), and
  finally forces `PLAY_STATE_INDEX = 3`, the running-gameplay phase.

### Round and level progression

The round number lives in `ROUND_COUNTER` **[seen]** at `0x8907`. It is advanced by the
round-transition handler loc_1a01, which first reseeds the spawn/rope draw counters (via the
board/HUD reset loc_2527, whose returned fill value it stores into `SPAWN_PHASE_COUNTER`
**[seen]** at `0x8902` and the rope draw count at `0x8934`), seats the stage attribute, and then
bumps `ROUND_COUNTER`. It reads the new value's low bit: on the odd result it falls straight
through, and on the even result it either sets the play-mode latch `PLAY_MODE_LATCH` **[code]**
(`0x8f50`) — undoing the bump so the round only truly advances on the alternate pass — or, when
`GAME_ACTIVE_FLAG` is clear, diverts to the game-over reset. Every non-game-over exit tails into the
save-to-bank copy; the `GAME_ACTIVE_FLAG`-clear branch diverts to the game-over reset instead.

`ROUND_COUNTER` then drives most of the difficulty and cosmetic variation across the game.
Its low bit selects the playfield colour/attribute variant that loc_1dd3 paints (odd vs even
source tables, plus the special first/idle-round strip). It is BCD-rendered as the HUD round
number: both loc_1ead and loc_1f2f take `ROUND_COUNTER + 1`, convert it by a repeated
add-and-decimal-adjust loop, split it into high/low nibble tiles (blanking a leading zero) and
stamp them into the HUD. Its higher bits index the enemy speed/difficulty tables, and the
enemy speed index `SPEED_INDEX` **[seen]** at `0x8900` escalates with the round, so later
rounds run faster and fire harder.

Within a round, the stage is tracked by `STAGE_COUNTDOWN` **[seen]** at `0x8901`. It counts
down as the wave is cleared: the shared enemy-despawn tail loc_34b0 drops the active-enemy count
and, while `STAGE_COUNTDOWN` is still above zero, decrements it by one, then repaints it as its
two HUD digits (renderStageCountdownDigits). Its value doubles as the stage label index that
loc_1f2f maps to a column code and renders. `WAVE_ARRIVAL_COUNTER` (`0x8903`) counts enemy
arrivals across the stage and, at round init, is used to size the extended-rope count
`ROPE_SEGMENT_COUNT` **[seen]** (`0x8931`, set to the arrival count minus two). Board completion
is signalled by `BOARD_CLEAR_FLAG` **[code]** at `0x89e5`: when set it freezes the per-frame
object updates and diverts the handlers onto the board-clear / level-intro path. A parallel
anti-tamper freeze `TAMPER_OBJECT_FREEZE_FLAG` **[code]** (`0x89fb`) is ORed with it, so a
detected ROM-integrity strike stalls object updates the same way a real board clear does.

### The live-state page and per-player banking

The block of in-play state from `0x8900` upward — `SPEED_INDEX`, `STAGE_COUNTDOWN`,
`SPAWN_PHASE_COUNTER`, `WAVE_ARRIVAL_COUNTER`, `ROUND_IN_PROGRESS`, `ROUND_COUNTER` and the
rest — is a single live page that belongs to whichever player is currently up. Two saved copies
sit above it: `PLAYER0_STATE_BANK` **[seen]** at `0x8940` and `PLAYER1_STATE_BANK` **[seen]** at
`0x8980`, each a `0x3f`-byte snapshot of the page. At round init (loc_1601) the active player's
bank is copied down into the live page, and at each round transition the save tail loc_1a47
copies the live page back up into that player's bank (destination chosen by `ACTIVE_PLAYER`) and
zeroes `PLAY_STATE_INDEX`. In a two-player game this is how the two players alternate without
trampling each other's progress: `ACTIVE_PLAYER` selects the bank, the loser's page is banked out
and the next player's is banked in.

Each player's remaining lives live inside that bank — `PLAYER0_LIVES` **[seen]** at `0x8948`
and `PLAYER1_LIVES` **[seen]** at `0x8988` — seeded from the cabinet lives switch `LIVES_DSW`
**[code]** (`0x8807`) when a new board is reset (loc_0e00). loc_0e00 clears the whole live page,
seeds each bank's lives, opening X and sprite colour from the switches, and (only when the game
is active) clears the launch flags. The board/HUD reset loc_2527 reseeds the spawn-phase and
rope-draw counters to `4` once the spawn phase reaches its cap and mirrors a fill value into a
handful of actor/HUD cells, giving each stage a clean starting state.

### The per-player BCD play timers

Each player also owns a small wall-clock timer that accumulates their elapsed play time in
BCD: `PLAY_TIMER_BCD_P1` **[code]** at `0x8a30` and `PLAY_TIMER_BCD_P2` **[code]** at `0x8a33`.
Each is a three-byte bank — a per-frame sub-counter in byte 0, then BCD seconds and BCD minutes.
loc_7912 ticks the active player's timer once per in-play frame: it returns immediately if
`GAME_ACTIVE_FLAG` is clear, then selects the current player's bank from `ACTIVE_PLAYER` and
returns again if that player's gate byte is set. The gates are `PLAY_TIMER_GATE_P1` **[code]**
(`0x89e1`) and `PLAY_TIMER_GATE_P2` **[code]** (`0x89e2`); a nonzero gate suppresses the tick for
that player. When the tick runs, the sub-counter climbs to `0x3b` (or `0x3c`, the extra frame
chosen by bit 0 of the seconds byte, so successive seconds alternate 60/61 frames), and on that
roll it clears and carries into the seconds digit; the seconds low nibble rolls at `0x0a` and the
high nibble at `0x60` (i.e. 60 seconds), carrying in turn into the minutes digit. The result is a
straightforward MM:SS clock ticking about once a real second.

The timer is rendered by loc_7960, which stamps the active player's minutes and seconds BCD as
individual hi/lo nibble tiles up the video column anchored at `PLAY_TIMER_DIGIT_VRAM` **[code]**
(`0x862d`), parting the two digit groups with a spacer tile, and then clears the rendered timer
bytes. This render is bracketed by the game's anti-tamper self-checks: on entry it folds a
checksum over a fixed code block and matches it against the guard bytes that trail the block,
and after the render it scans a small flag block that can divert to a second tail checksum —
mismatches trip an integrity error (unreachable with intact ROM data).

Finally, the timer feeds the high-score table. When a finished player earns a high-score slot,
loc_1ab2 inserts their score into the sorted ten-entry table and, riding alongside, shifts the
parallel play-time side table `HIGH_SCORE_TIME_TABLE` **[code]** (`0x89e0`) down a slot and
writes the active timer's seconds/minutes BCD into the opened entry, seating that player's timer
gate to `1` so the timer stops accumulating. It also records the winning rank in
`HIGH_SCORE_INSERT_RANK` **[code]** (`0x89fc`). So the per-player play timer is both a live
metric during a game and a recorded value preserved next to each high score.


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

Three small state machines share the attack side of the playfield: the arrow/launch
sequence that fires from the player's side and seeds hunters, the rope-cell machine that
grows and animates a segmented rope down a video column, and the eagle wave that flies a
formation of records across a coordinate grid during the bonus stage. Each is a per-frame
selector-plus-handler-table driven by its own state cell, and each leans on a handful of
counters and timers rather than any shared scheduler.

### The arrow/launch state machine

The launch sequence is driven every frame from the in-play object update through the
dispatcher at `loc_2778`, which reads `LAUNCH_STATE` **[seen]** (0x8f30), masks it to three
bits, and dispatches through a five-entry table into handlers 0..4. The state cell walks
0->1->2->3->4->0, and each handler advances it in place, so the machine is a straight ring.

State 0 (`loc_278f`) is the arming and firing gate. If the one-shot `LAUNCH_ARMED_FLAG`
**[seen]** (0x8f3f) is still clear it tries to raise it: when the `LANE_SPAWN_COUNTDOWN`
**[seen]** (0x8d75) is still running and the `LAUNCH_ARM_LATCH` **[seen]** (0x8f20) is clear
it bumps that latch and arms; otherwise it demands that `STAGE_COUNTDOWN` **[seen]** (0x8901)
be nonzero and an exact multiple of eight before arming. Once armed, it will not advance
until the arrow object has risen — `ARROW_Y` **[code]** (0x8ab4), the Y field of launch slot
2, must have reached 0x3c — and until neither hunter-target record shows its hit bit, tested
in `ENEMY_TARGET_REC0` **[seen]** (0x8c90) and `ENEMY_TARGET_REC1` **[seen]** (0x8ca8). When
those clear it steps the state, reseeds the tile-flip countdown `LAUNCH_FLIP_COUNTDOWN`
**[code]** (0x892f) to eight, refreshes the arm latch from its seed `LAUNCH_ARM_LATCH_SEED`
**[code]** (0x8d7a) when that is nonzero, and blits the launch tile from `LAUNCH_TILE_SRC`
**[code]** (0x2d51) to `LAUNCH_TILE_VRAM` **[code]** (0x84a7). If the game is idle
(`GAME_ACTIVE_FLAG` **[seen]** (0x8806) zero) but a launch is nonetheless armed, it also
lights the status-panel cell `LAUNCH_HUD_TILE` **[code]** (0x8508).

State 1 (`loc_27f3`) splits on the same `ARROW_Y`. While the arrow is at or above 0x34 it
just animates: it counts `LAUNCH_FLIP_COUNTDOWN` down, and on each expiry reloads it to 0x10,
steps the shared phase byte `SHARED_PHASE_COUNTDOWN` **[code]** (0x892e), and blits one of
two arrow tiles — `LAUNCH_TILE_SRC` or its alternate `LAUNCH_TILE_SRC_ALT` **[code]**
(0x2d55) — chosen by that byte's parity, so the arrow visibly flickers between two frames as
it climbs. Once the arrow has fallen below 0x34 the handler instead looks for a free
hunter-target record among `ENEMY_TARGET_REC0`/`ENEMY_TARGET_REC1`; finding one it jumps the
launch state straight to 2, marks the record active, queues a display command, blits the
alternate tile, and seeds a small cluster of record fields (one of them a biased copy of a
source coordinate).

State 2 (`loc_2856`) is the hunter seeder proper. Unless the `PLAY_MODE_LATCH` **[code]**
(0x8f50) is set, it scans the six-slot hunter record table `HUNTER_TABLE_BASE` **[code]**
(0x8c78) *downward* one 0x18 stride at a time for the first slot whose two leading bytes are
both zero. A free slot is stamped with a fixed opening state, coordinates and tile ids, and
its address is stored little-endian into `HUNTER_RECORD_PTR` **[code]** (0x8f32). The handler
then advances the launch state and forks on `HUNTER_SPAWN_FLIP_FLAG` **[code]** (0x8f61):
with the flag clear it seeds `HUNTER_SPAWN_COUNTDOWN` **[code]** (0x8f34) to 0x20 and enqueues
`HUNTER_SPAWN_DISPLAY_CMD` **[code]** (0x0315); with it set it instead bumps
`HUNTER_SPAWN_SUBCOUNTER` **[code]** (0x8f5d) and emits nothing.

State 3 (`loc_28ad`) is the post-spawn hold. It drains `HUNTER_SPAWN_COUNTDOWN` a frame at a
time and returns while it is nonzero; on expiry it advances the state and, unless the play-mode
latch is set, zero-fills the 0x18-byte record pointed at by `HUNTER_RECORD_PTR`, tearing down
the slot it just seeded. State 4 (`loc_28c5`) is a bare return — the idle slot of the ring
that holds the machine quiescent until state 0 re-arms it.

### The rope cells

The rope belongs to the pull-rope / lift sprite driver `loc_25a6`, which forks on
`ROUND_COUNTER` **[seen]** (0x8907) bit 0: when that bit is clear it hands the frame off to
`loc_2d66`, the branch that grows and animates the segmented rope. That branch first aborts
if a grab is in progress — `GRAB_ACTIVE_FLAG` **[seen]** (0x8d32) nonzero — or if the stage's
`WAVE_ARRIVAL_COUNTER` **[seen]** (0x8903) has reached 2, and otherwise runs two passes back
to back: the extend driver `loc_2d78` and the per-cell sweep `loc_2e22`.

The extend driver dispatches on `ROPE_EXTEND_STATE` **[code]** (0x8f14): sub-state 0 adds a
segment (`loc_2d80`), sub-state 1 is the blit/hold pass (`loc_2dbc`). `loc_2d80` returns at
once when the rope has already grown to two below the stage's arrival count — that is, when
`ROPE_SEGMENT_COUNT` **[seen]** (0x8931) equals `WAVE_ARRIVAL_COUNTER` minus two, which is how
the per-stage counter bounds rope length. Otherwise it bumps the segment count and, while
`ROPE_EXTEND_INDEX` **[code]** (0x8f18) is below four, advances that index, looks the new
segment's video-column low byte up from `ROPE_CELL_COLUMN_TABLE` **[code]** (0x2db8), pairs it
with the fixed 0x84 video page into `ROPE_COLUMN_VRAM_PTR` **[code]** (0x8f19), reloads that
segment's cell timer in the `ROPE_CELL_TIMERS` **[code]** (0x8f28) block to 0x10, advances the
sub-state, and arms `ROPE_EXTEND_TIMER` **[code]** (0x8f16). WARNING: past the fourth segment
the extend does not simply stop — it proceeds only if a ROM-tamper strike is pending in
`TAMPER_STRIKES_ROM` **[code]** (0x89ef), and then uses that strike count as the column-table
index. In a clean image the strike count is zero, so the extend halts at four; the branch is
an anti-tamper entanglement, not a normal path. `loc_2dbc` runs `ROPE_EXTEND_TIMER` down and,
on expiry, either resets its own frame index and re-arms the next rope cell, or looks up a
tile block and blits it at `ROPE_COLUMN_VRAM_PTR`, stepping that frame index toward eight.

The sweep `loc_2e22` walks `ROPE_EXTEND_INDEX` active cells, pointing IX at the four per-cell
state bytes based at 0x8f1c and calling the per-cell dispatcher `loc_2e36` on each. That
dispatcher reads the cell state at (ix+0); a zero state is inactive and returns, otherwise it
dispatches state-1 into four handlers: `loc_2e5e`, `loc_2ecb`, `loc_2f01`, `loc_2f2f`. Two
tiny helpers serve all of them: `loc_2e45` ticks the cell's own frame timer (the low two bits
of IXL pick one of the four `ROPE_CELL_TIMERS` entries, stride 2) and reports reached-zero,
and `loc_2e52` rebuilds this cell's video-column base from `ROPE_CELL_COLUMN_TABLE` and the
0x84 page.

`loc_2e5e` is rope-cell state 1: acting only every fourth frame (gated on `FRAME_COUNTER`
**[seen]** (0x8a5f) low bits) and only once the cell timer elapses, it scans the three-slot
`SPAWN_OBJECT_TABLE` **[seen]** (0x8c48) for a free slot; finding one it re-arms the timer
with a `ROUND_COUNTER`-scaled reload, seeds the slot (state 0x07, coordinates, and a +4 field
looked up from `ROPE_SPAWN_IY4_TABLE` **[code]** (0x2ec7) keyed by IXL&3), advances the cell
state, and blits the rope segment tile from `ROPE_SEGMENT_TILE_SRC` **[code]** (0x2dfe). This
is where a rope cell drops a bonus object down the column. `loc_2ecb` (state 2) ticks the
timer and, on the frame it hits zero, writes a round-derived tile code into the timer cell,
indexes the `FORMATION_TABLE` **[seen]** (0x8c30) by the following byte to bump one record's
tile field, clear its position byte and drop another field, bumps the cell's own count, and
blits the alternate segment tile `ROPE_SEGMENT_TILE_SRC_ALT` **[code]** (0x2e1e). `loc_2f01`
(state 3) does similar formation-record bookkeeping after a helper gate. `loc_2f2f` (state 4)
is the retract: on the cell timer, and while `ROPE_SEGMENT_COUNT` segments remain, it selects
a retract animation and a per-segment attribute (both clamped and keyed by `ROUND_COUNTER`),
merges the attribute into the paired cell, clears the corresponding formation record, advances
the cell, and blits the shrinking segment. Alongside the live `ROPE_SEGMENT_COUNT`, the sprite
side keeps `ROPE_DRAW_COUNT` **[seen]** (0x8934) — a one-frame-later snapshot of the spawn
phase that sets how many rope sprite rows are drawn.

### The eagle wave

The eagle wave is the bonus-stage attack, driven through the phase dispatcher `loc_71b9`,
which reads `WAVE_OUTER_PHASE` **[code]** (0x8f38) and dispatches phases 0..2 into `loc_71c7`,
`loc_72a0` and `loc_7421`, pushing a shared display-rebuild epilogue as the common return.
Phase 0 runs the approach state machine; phase 1 runs the launch driver that seeds and moves
the wave; phase 2 tears the stage down.

Phase 1's driver is `loc_72a7`. While the wave has not been launched — `WAVE_LAUNCH_FLAG`
**[code]** (0x8f3a) zero — it seeds the next wave through `loc_72e1` and returns. `loc_72e1`
runs only while the first target slot `ENEMY_TARGET_REC0` is clear: it raises the launch flag,
advances `WAVE_INDEX` **[seen]** (0x8f3d), and on the fourth wave merely re-arms the outer
phase and reloads the inter-wave hold. On any earlier wave it initialises two records per wave
index in the `ENEMY_ACTOR_TABLE` **[seen]** (0x8ae0), stride 0x18, copying four fields apiece
from the `EAGLE_WAVE_PARAM_TABLE` **[code]** (0x7409) and marking each active, then records the
live-record total in `WAVE_RECORD_COUNT` **[code]** (0x8f3c) (two times the wave index) and
clears the outer phase and `WAVE_RECORDS_ARRIVED` **[seen]** (0x8f39). Once the flag is set,
the driver either hands off to the inter-wave idle handler when the record count has drained
to zero, or walks that many records through the per-record dispatcher `loc_72cf`, which skips
inactive records and dispatches each record's own state byte (ix+2) into three handlers.

Record state 0 (`loc_733c`) is arrival: it returns unless the eagle has reached this record's
grid slot — its column, `EAGLE_X_COORD` **[code]** (0x8c96) shifted right by three, must match
the record's target column (or the one just before it), and its row derived from `EAGLE_Y_COORD`
**[code]** (0x8c94) must fall within a five-row window of the record's target row. On arrival
it advances the record state and arms an animation, with odd and even records diverging on
bit 3 of the record's low address: odd records take `EAGLE_ODD_RECORD_ANIM` **[code]** (0x7403)
and a flag byte, even records take `EAGLE_EVEN_RECORD_ANIM` **[code]** (0x4086), bump
`WAVE_RECORDS_ARRIVED`, and — once every record of the wave has arrived, i.e. the arrived
count equals `WAVE_INDEX` — queue the wave-arrival display command from `WAVE_ARRIVAL_CMD_BASE`
**[code]** (0x0630) offset by that count. Record state 1 (`loc_7395`) is the dive/climb: it
runs the animation mover, then integrates the record's 16-bit vertical position by its
per-record speed — even records descend (add; a carry drops the row, and reaching the bottom
row advances the state), odd records climb (subtract; a borrow lifts the row, and reaching the
top row advances the state). Record state 2 (`loc_73ce`) retires the record: it zero-fills the
whole 0x18-byte record, decrements `WAVE_RECORD_COUNT`, and when the last record of the wave
has gone it seeds the inter-wave hold `WAVE_HOLD_TIMER` **[seen]** (0x8f36) to 0x30. The idle
handler `loc_73e3` runs between waves: it drains `WAVE_HOLD_TIMER`, and on expiry — if a wave
index is still set — enqueues an indexed wave command, reseeds the hold to 0x18, and clears the
launch flag so the driver seeds the next wave.

Phase 0's approach machine is `loc_71ce`. A hold gate fronts it: while `WAVE_HOLD_TIMER` is
nonzero it just ticks it down. Once clear, it drives the player's aim indicator from a
coordinate compared against two fixed thresholds — 0x59 (near) and 0x60 (far). WARNING: the
coordinate it reads is `PLAYER_Y` **[seen]** (0x8a84), the player-actor's own position, not a
separate eagle field; the machine sets bits in `PLAYER_AIM_FLAGS` **[code]** (0x8a87) —
on-target, below, armed — from where the player sits relative to those thresholds, latching
the enemy X into `LATCHED_ENEMY_X` **[seen]** (0x8f5b) when the coordinate first crosses the
far threshold. When the coordinate sits exactly on the near threshold it steps a
records-arrived sub-phase (0->1 clears the aim, anything-but-2->2 arms it, 2 runs the grid
step). On the grid step, once per eighth frame gated by `EAGLE_GRID_STEP_TICK` **[code]**
(0x8f3b), it stamps a marker tile (0x2c) and a colour attribute into the eagle grid region
based at `EAGLE_GRID_VRAM_BASE` **[code]** (0x87e0), with row and column offsets taken from the
eagle's live coordinates. The grid advance is bounded by the guard `loc_7287`, which hands the
advancing coordinate back while it is short of the grid edge (0xd0) and, once it reaches the
edge, arms `EAGLE_FINISH_FLAG` **[code]** (0x8f3e) and runs the reset epilogue
`advanceEaglePhaseAndClearAim` (0x7292). That epilogue clears the aim flags and the latched X,
advances `WAVE_OUTER_PHASE`, and clears the records-arrived sub-count so the next phase starts
clean.

Phase 2 (`loc_7421`) closes the bonus stage: it drains `WAVE_HOLD_TIMER`, and on expiry
zero-fills the nine-byte wave/phase block from `TILE_ANIM_PARITY` **[seen]** (0x8f37) and the
0x48-byte `ENEMY_ACTOR_TABLE` region, clears `PLAY_STATE_INDEX` **[seen]** (0x880a) and
`LATCHED_ENEMY_X`, and sets `ATTRACT_SUBSTATE` **[seen]** (0x8e51) to 7 to hand control back
out of the stage.


## Rendering, HUD and display lists

Pooyan draws onto two 32-cell-wide video planes. The tile-code plane lives from
`VIDEO_RAM_BASE` (0x8400) up through 0x87ff — `PLAYFIELD_TILE_BASE` (0x8402) is where the
visible playfield begins — and every cell one tilemap row below its neighbour is 0x20 bytes
further on. Overlaid on it is the colour/attribute plane at `COLOR_RAM_BASE` (0x8000), whose
per-cell bytes are flooded from `ATTRIB_MAP_BASE` **[seen]** (0x8040). Almost all of the
rendering code is a variation on "walk a column, stride 0x20 between cells," and the whole
machine is glued together by a queue of drawing commands that the main loop drains once per
frame. This section follows the paint primitives up from the smallest column-stamper to the
score panels, then the two display-list mechanisms that schedule and assemble a frame.

### Blanking and painting tilemap columns

The playfield is cleared and repainted a row (or a column) at a time. The row-by-row fill is
armed by `seedTileFillCursor`, which points the 16-bit write cursor `TILE_FILL_PTR` **[seen]**
(0x880b) at a chosen cell and seeds the pass counter `FILL_ROW_COUNTER` **[seen]** (0x8809) to
0x20 (thirty-two rows); `loc_02e3` is the fixed-origin variant that arms the fill from
`PLAYFIELD_TILE_BASE`. Each subsequent frame `loc_02ce` blanks a run of cells at the cursor
with the blank tile 0x10, walks the cursor forward exactly one full row (the run it wrote plus
the row's remainder), stores it back, and decrements the row counter; the Z flag it hands back
signals the drained state that ends the fill. `loc_02c9` is the same idea but first zeroes the
sprite/actor RAM and blanks only the 0x1d visible cells of the row, so it doubles as the
board-init clear. Because the count reaches zero after thirty-two passes, the fill spreads the
cost of erasing the screen across many frames rather than stalling one.

Vertical three-tile columns are stamped by a small family of helpers. `paintColumnBodyTiles`
writes the mid tile 0x25 and base tile 0x20 one stride apart; `loc_02a8` prepends the cap tile
0x01 to make a full cap-plus-body column, and `blankTileColumn` erases a three-cell column to
the blank tile 0x10, returning the advanced pointer so a caller can chain straight into the
next column. `paintColumnBodyTilesUp` and `loc_1ce7` are the fixed "step one row up each cell"
mirror of these, with `loc_1ce7` writing its own cap tile 0x02 at `COLUMN_CAP_VRAM` **[code]**
(0x84e0). These are what the per-frame scroll worker `loc_0254` uses: gated on the game-active
flag, it repaints two scroll columns — in one-player mode a run of four blanked columns from
`P2_SCORE_VRAM`, in two-player mode a capped body column — then a body column at
`WORKER_COLUMN_VRAM` **[code]** (0x8740), and optionally one more blanked column, all of it
keyed by `WORKER_CONTROL_BYTE` **[code]** (0x883f).

### Flooding the colour/attribute map

`fillAttributeColumns` is the colour painter: from a ROM source table it walks 31 columns of
`ATTRIB_MAP_BASE`, taking one source byte per column and flooding it down all thirty rows at
the 0x20 stride, so each screen column gets a single solid attribute. `loc_1dd3` chooses which
field variant to paint. The default job floods from `FIELD_ATTRIB_SRC_A` **[code]** (0x0839) or
`FIELD_ATTRIB_SRC_B` (0x0879) — selected by bit 0 of `ROUND_COUNTER` **[seen]** (0x8907) — then
stamps a short two-column marker (colour 0x0f) at columns 5 and 6. The alternate job runs only
when the round is idle-but-active on an even/first round and outside attract (`ROUND_IN_PROGRESS`
**[seen]** 0x8904 clear, `GAME_ACTIVE_FLAG` **[seen]** 0x8806 set, `PLAY_MODE_LATCH` **[code]**
0x8f50 clear): it floods from `FIELD_ATTRIB_SRC_C` (0x0859) and lays a taller sixteen-row strip
(colour 0x09) down `FIELD_C_ATTRIB_DEST` **[code]** (0x811c).

### 2x2 and 3x3 tile-block blitters

Small graphics are stamped as rectangular blocks copied from a four-, nine-, or twelve-byte ROM
source. `blit2x2TileBlock` copies four source bytes into a 2x2 square in the order top-left,
top-right (+0x01), bottom-right (+0x21), bottom-left (+0x20), and returns the pointer left at
that bottom-left cell so an animator can step one row up before its next blit.
`paintTileBlock2x2` is the memory-only sibling anchored at the top-left, and
`paintTileBlock2x2Above` anchors at the bottom-left with its top row one tilemap row higher;
`loc_0a52` uses `paintTileBlock2x2` to stamp two squares (at `VRAM_TILE_BLOCK_DEST_A`/`_B`,
0x82aa/0x826a) from one shared source `TILE_BLOCK_2X2_SRC` **[code]** (0x0a72).
`blitTile3x3Block` copies a three-wide, three-tall block, stepping the destination +0x1d after
each row of three (net +0x20) and advancing both the destination and the ROM source so chained
callers stamp consecutive blocks. `loc_2bd3` (and its stack-adjusted twin `loc_2bd2`) uses the
2x2 blitter to paint the "ready" indicator square at `READY_SPRITE_TILE_VRAM` **[code]**
(0x87bb) from `READY_SPRITE_SRC` (0x2be1), but only when that cell does not already hold the
painted marker tile 0xba.

Two frame-gated animators cycle a 2x2 graphic. `loc_2563` and `loc_6b13` each run a hold
countdown in `TWOTILE_ANIM_HOLD` **[code]** (0x8f06); on expiry they reload it to 0x0c, advance
`TWOTILE_ANIM_PHASE` **[code]** (0x8f07), and pick a four-byte block out of `TWOTILE_SRC_TABLE`
**[code]** (0x2744) by phase (and, in `loc_2563`, round) parity, then stamp it as two stacked
squares — the second three rows above the first. `loc_2563` chooses its anchor
(`READY_SPRITE_TILE_VRAM` or `TWOTILE_ANIM_VRAM_ALT`, 0x84bb) by round parity and is suspended
whenever the play-mode latch is busy; `loc_6b13` always stamps at `BLIT_SCREEN_ANCHOR`
(0x84b4). Separately, `loc_76af` runs a two-phase blink: a countdown in `BLINK_COUNTDOWN`
**[code]** (0x892a) that on expiry reloads to 0x16, toggles `BLINK_PHASE` (0x892b), and swaps a
two-tile pair from `BLINK_TILE_PAIRS` (0x76e6) into `BLINK_TILE_CELL_0` (0x8471) and its partner
0x40 bytes on.

### Glyph blocks

`blitGlyphBlock4x3` copies a three-wide, four-tall glyph (advancing the destination's low byte
within its page per cell, then +0x1d to the next row's origin). `loc_1ffb` renders one of two
fixed 3x3 glyph blocks into the colour/attribute plane at `GLYPH_BLOCK_DEST` **[code]** (0x8062)
via `blitTile3x3Block`, choosing `GLYPH_TILES_A` **[code]** (0x203b) or `GLYPH_TILES_B` (0x2050)
by bit 5 of its selector.

The round marker `loc_4a0b` is the most elaborate glyph user. Gated on bit 0 of `ROUND_COUNTER`,
it snapshots the spawn-phase count from `SPAWN_PHASE_COUNTER` **[seen]** (0x8902) into
`SPAWN_PHASE_SNAPSHOT` (0x8d43) and `ROPE_DRAW_COUNT` **[seen]** (0x8934), then draws the marker
column at `MARKER_VRAM_BASE` **[code]** (0x86c3): for a nonzero count it stamps that many stacked
pairs of a two-wide marker (tiles 0xda/0xdb over 0xd8/0xd9) climbing the column, saves the
column layout pointer into `MARKER_LAYOUT_PTR` (0x8932), and caps it with the marker glyph block
from `MARKER_GLYPH_SRC` (0x2754); a zero count just stamps the glyph at the fixed anchor. The
`blitTile3x3Block` call places the round-marker glyph beneath the stacked count.

### The HUD digit primitives

Every numeric field is built from a handful of digit routines that share a leading-zero
convention (a suppressed leading zero draws the blank tile 0x10, not a "0"). `splitBcdByte`
takes a packed-BCD byte, writes its low nibble as a tile at the cursor, advances the cursor,
and hands back the high nibble (zero doubling as the leading-zero test). `renderDigitWithBlanking`
paints one digit with a running blank budget threaded across a field: a nonzero digit ends the
blank run, a zero spends a blank while the budget lasts, and once the budget is gone a genuine 0
appears. `drawStackedBcdDigits` paints a packed byte as two vertically stacked tiles — tens at
the cursor, units one row up — with the tens' leading zero suppressed. The two binary-to-BCD
converters feed these: `byteToPackedBcd` reproduces the Z80 `daa` chain to give value-mod-100,
and `binToPackedBcd` returns both the packed low two digits and a hundreds tally (a zero counter
counts a full 256-pass wrap, matching the hardware down-counter).

### Scores, high score, credit, and panels

The three BCD score counters are painted down screen columns by `loc_056b`, whose selector picks
player 1 (`P1_SCORE_BCD` **[seen]** 0x88a2 into `P1_SCORE_VRAM` **[code]** 0x8781), player 2
(`P2_SCORE_BCD` **[seen]** 0x88a5 into `P2_SCORE_VRAM` 0x8521), or the high score
(`HIGH_SCORE_BCD_HI` **[seen]** 0x88aa into `HIGH_SCORE_VRAM` 0x8641); each of the three counter
bytes is split into high then low digit up the column through `renderDigitWithBlanking` with a
four-digit blank budget. `loc_0552` is the reset twin: it zeroes a counter's three bytes and
repaints it (so the field shows four blanks and two zeros). `selectActivePlayerScoreBuffer`
resolves which buffer is "the active player's" from bit 0 of `ACTIVE_PLAYER` **[seen]** (0x880d),
and `loc_0496` is the score accrual: while the game is live it BCD-adds a per-frame increment
(`PER_FRAME_SCORE_INCREMENT` for award index 0, else a `SCORE_AWARD_TABLE` entry) into that
buffer, repaints its column, then compares MSB-first against `HIGH_SCORE_BCD` **[code]** (0x88a8)
and — if the score is strictly higher — copies it over and repaints the high-score column.

The credit counter `loc_05ee` draws `CREDIT_COUNT` **[seen]** (0x8802) clamped to 99: the tens
nibble into `CREDIT_HUD_TENS_VRAM` **[code]** (0x86bf, only when nonzero) and the units into
`CREDIT_HUD_UNITS_VRAM` (0x869f); when the units digit happens to be 2 it also runs a hidden
31-byte checksum tripwire (see the anti-tamper section). `loc_05b2` is the general character-field
painter used for the credit label and the attract text: a selector indexes `FIELD_RECORD_PTR_TABLE`
(0x7a0d), and each record is a destination address followed by an inline string drawn bottom-up
(one row per character), with a `.` ending a record and a `?` ending the run — bit 7 of the
selector switches from digit-fill to blank-fill.

The status panel and the digit panel are two table-driven paints. `renderPanelFromTable` walks
ten rows of three cells, painting each byte of `PANEL_TILE_SOURCE` **[code]** (0x8e00) into
`PANEL_VRAM_DEST` **[seen]** (0x8567) (climbing within a row, re-basing forward per row) with an
empty cell showing the panel-blank tile 0x40. `loc_0439` renders the packed-BCD digit panel: ten
rows of `PANEL_DIGIT_SOURCE_TABLE` **[code]** (0x89c0) drawn into `PANEL_DIGIT_VRAM_DEST` (0x8467)
as digit pairs a fixed separator tile 0x51 apart, delegating the nibble split to `splitBcdByte`.
The big attract paint `loc_03e9` ties these together: it draws eleven consecutive character
fields, renders the ten-entry `HIGH_SCORE_TABLE` **[code]** (0x8a00) as stacked BCD pairs into
`HIGH_SCORE_TABLE_VRAM` (0x85c7), then calls `loc_0439` and `renderPanelFromTable`.

### Counters, gauges and in-play numbers

`loc_039b` paints the "count column" at `COUNT_COLUMN_VRAM` **[code]** (0x8482): gated on the
game-active flag, it fills the top cells with tile 0x0c to a height of `ACTOR_TABLE` **[seen]**
(0x8a80) count plus one (clamped to the eight-cell column) and blanks the rest. The phase gauge
is drawn by `renderPhaseGauge` (with an identical sibling `paintPhaseGauge`): it reads
`GAUGE_PHASE_COUNTER` **[seen]** (0x8908), draws (count − 1) filled cells (tile 0xb0) from
`PHASE_GAUGE_BASE_TILE` **[seen]** (0x863f) upward and blanks the rest of the five, leaving the
gauge alone when the count is zero. `loc_1a85` repaints the gauge and then latches the play
sub-state index for the active player. The stage number is `renderStageCountdownDigits`: it reads
`STAGE_COUNTDOWN` **[seen]** (0x8901) and writes its units nibble to `HUD_STAGE_DIGIT_LO`
**[seen]** (0x8743) and the tens one row over (values under ten draw as a single digit; ten and
above convert through `binToPackedBcd`, and that path is skipped while `PLAY_MODE_LATCH` is held).

`loc_10c2` is a three-field sub-state display: it walks a counter toward a target one step at a
time, stores it in `SUBSTATE_FIELD1_COUNTER` **[code]** (0x8f62), and paints three stacked-BCD
fields (`SUBSTATE_FIELD1_VRAM` 0x85d0, `SUBSTATE_FIELD2_VRAM` 0x8652, `SUBSTATE_FIELD3_VRAM`
0x85d2 with a hundreds cell at 0x85f2) through `drawStackedBcdDigits`, then advances the
main-loop sub-state and queues a sound. `loc_6f42` (level-intro phase 2) draws the target-hit
tally `HIT_TALLY` **[code]** (0x8f52) as two stacked digit pairs at `HUD_INTRO_DIGITS_BASE`
**[code]** (0x8634) — the packed value and its BCD double two rows up. `loc_18da` steps the
pending bonus-award tally: when the active player's score MSB reaches the queued threshold in
`AWARD_QUEUE` **[code]** (0x8909) it bumps the saturating gauge counter, BCD-steps the queue, and
redraws the gauge via `renderPhaseGauge`.

The play-timer digits are rendered by `loc_7960`, which (behind a pair of code-block integrity
checksums) splits the active player's minutes and seconds BCD bytes — `PLAY_TIMER_BCD_P1` **[code]**
(0x8a30) or `PLAY_TIMER_BCD_P2` (0x8a33) — into hi/lo nibble tiles up the column at
`PLAY_TIMER_DIGIT_VRAM` **[code]** (0x862d), separated by the spacer tile 0x51, then clears those
timer bytes. The timer itself is advanced (not drawn) by `loc_7912`, whose frame sub-counter rolls
at 0x3b/0x3c and BCD-carries the seconds and minutes digits.

### The sprite display list

Every frame the hardware sprite list is rebuilt from the object-record banks by `loc_02ef`. It
copies four record groups into `SPRITE_DISPLAY_LIST` **[seen]** (0x8840): the two lead actors and
the two enemy-target records go through `copyObjectRecordsToDisplayList`, which emits record
bytes +0x06, +0x10, +0x04, +0x0f into four successive list slots per record; the eighteen moving
objects go through `loc_0343`, which is the same layout but derives two of the four bytes as
screen coordinates from the record's sub-pixel position pairs (a 16-bit hi:lo pair reduced to a
pixel as `(pair >> 5) − 8`); and the arrow/launch group is copied raw. `loc_02ef` then nudges the
arrow group's two sprite-Y bytes down a pixel and falls into `loc_0320`, which ticks a per-frame
counter and, when the orientation flag `FLIP_SCREEN_FLAG` **[seen]** (0x881f) is zero (screen
flipped), calls `mirrorSpriteListVertically` — that walks the twenty-four stride-4 entries in
place, negating each coordinate byte (−x − 0x10) and toggling the two flip bits of the attribute
byte while preserving its low nibble. `loc_09f8` is a lighter path that first advances four
object records' animations and then rebuilds the list through `loc_02ef`.

### The display-list interpreter

`loc_4381` is a stream copier that lays out layout data into video RAM. It chooses a
destination/source pointer pair — the primary pair `DISPLAY_LIST_DST_PTR` **[seen]** (0x8f43) and
`DISPLAY_LIST_SRC_PTR` **[seen]** (0x8f45), or the alternate pair 0x88b8/0x88ba when
`FORMATION_SLOT_TABLE` **[seen]** (0x8920) is nonzero — then walks up to 0x1d source bytes. A
plain byte is copied to the destination and both pointers step forward; a 0x10 opcode advances
the destination by the following byte and shrinks the remaining count (a run-skip); and a 0xff
opcode reloads the destination from the next two stream bytes and folds the byte after that into
`SUBPHASE_TICK` **[seen]** (0x88b7), ending the pass. On exit it writes the advanced pointers back
to whichever pair it chose, so successive calls resume mid-stream.

### The display-command ring

The rendering work above is scheduled through a ring of two-byte drawing commands. `loc_0038`
enqueues one: it looks at the slot the write pointer `DISPLAY_CMD_RING_WRITE_PTR` **[code]**
(0x88a0) names within the `DISPLAY_CMD_RING_BUFFER` **[code]** (0x88c0, 32 slots), and — only if
that slot is free (bit 7 set) — stores the command's high byte there and its low byte in the next
slot, advances the pointer by two, and wraps it back to 0xc0; an occupied ring drops the command.
The main loop drains this ring within the frame: it reads the slot the read cursor
`DISPLAY_CMD_RING_READ_PTR` **[code]** (0x88a1) points at, and if that slot is free (bit 7 set) it
runs the per-frame worker `loc_0254` and treats that as the frame boundary. Otherwise it takes the
slot's high byte as a command index — doubled and masked to 0x1f, it selects a handler from the
jump table at 0x0242 — frees the slot (writes 0xff), reads the low byte as the handler's argument,
advances the cursor (wrapping at 0xc0), and dispatches. The handlers are the drawing routines
(attract/board setup, the field and panel painters, sound emitters, and so on); `loc_0e53` is a
deliberate phantom no-op handler that returns without drawing. Because the loop keeps draining
until it hits a free slot, a backlog of commands queued on one screen is fully rendered on the
next frame rather than one command at a time.


## Sound

Sound is produced in two tiers. At the bottom sits a single emitter that pokes the audio
CPU; above it sits a small ring buffer that lets producers all over the game queue a command
byte without touching the audio port themselves. The main CPU never blocks on sound: it drops
a byte into the ring and moves on, and one byte per frame is handed down to the emitter.

**The emitter.** `sendSoundCommand` (0x0e8f) is the only code that speaks to the audio CPU. It
writes the command byte into the sound-command latch `SOUND_COMMAND_LATCH` 0xa100 **[seen]**,
then strobes the audio-IRQ latch `AUDIO_IRQ_LATCH` 0xa181 **[seen]** high and immediately back
low. That rising/falling pulse is what interrupts the sound processor into reading the byte it
just latched; the width of the pulse is nothing but a hardware settling delay carrying no state,
so it collapses to two adjacent writes. `loc_0f09` is a direct-emit shortcut: it hands the fixed
code 0x0b straight to `sendSoundCommand`, bypassing the ring entirely for that one preset.

**The command queue.** Everything else reaches the emitter through a ring buffer living in
page 0x8a. The slots run from `SOUND_RING_BUFFER` 0x8a43 **[code]** up to 0x8a5e — a band of
one-byte slots addressed as `0x8a00 + index`. Two cursors track it: the tail
`SOUND_RING_WRITE_PTR` 0x8a40 **[code]** where the next byte is stored, and the head
`SOUND_RING_READ_PTR` 0x8a41 **[code]** from which the next byte is consumed. Each cursor is a
bare low-byte index confined to 0x43..0x5e; both advance by one per operation and wrap 0x5e back
to 0x43, so the buffer is circular. Boot fills every slot with 0xff, which serves as the
empty/free marker throughout — a slot reads 0xff when nothing is queued there.

**Enqueue.** Two entry points push into the same ring through the same write pointer.
`loc_0eb3` is the raw enqueue: it stores the byte at `0x8a00 + tail`, then advances and wraps the
tail — no gating, the byte always lands. `loc_0ea2` is the gated append: it first stashes the
incoming byte in `TEXT_RING_PENDING_BYTE` 0x8d20 **[code]**, then appends only while a game is
in progress — `GAME_ACTIVE_FLAG` 0x8806 **[seen]** nonzero — or the `PLAY_MODE_LATCH` 0x8f50
**[code]** is set; with both clear it drops the byte and returns 0. On the appending path it
writes the stashed byte at `0x8a00 + cursor`, advances and wraps the same write pointer, and
returns the advanced cursor to its caller. Because both entry points key off 0x8a40 and write
into 0x8a00, the two paths interleave into one shared queue.

WARNING: the gated append is described in places as a "text" ring and the raw path as a "sound"
ring, but they are one and the same buffer — same slots, same write pointer, same drain. The
distinction is only which producers use which entry point, not two separate queues.

Above these two helpers sits a bank of thin command selectors, one per effect, that just name a
fixed byte (or a short run of bytes) and hand it down. Some go through the raw enqueue —
`loc_0ecf` queues 0x00 (silence), `loc_0ed6` 0x02, `loc_0eda` the pair 0x82 then 0x03, `loc_0ef1`
(and its trampoline `loc_5f02`) 0x05, `loc_0f01` 0x09 — while others go through the gated append —
`loc_0ed2` 0x01, `loc_0ef9` 0x07, `loc_0f11` 0x0c, `loc_0f2b` 0x11. A game-logic site that wants
a particular sound just calls the matching selector; the byte ends up in the ring either way.

**Drain.** `loc_0e64` empties the ring one byte at a time, driven from the per-frame vblank
interrupt so at most one queued command reaches the audio CPU each frame — this is what
serializes a burst of enqueues down to the single-latch port. It reads the head slot
`0x8a00 + head`; if it holds 0xff the queue is empty and the routine returns without touching the
port. Otherwise it applies a silence gate: the byte is suppressed only when attract-mode sound is
disabled *and* no game is active — that is, when `DEMO_SOUNDS_DSW` 0x8821 **[code]** bit 0 is
clear and `GAME_ACTIVE_FLAG` is 0 — so gameplay always plays and attract mode plays only when the
operator DIP enables it. When not silenced it forwards the byte to `sendSoundCommand`, which
latches and strobes as above. Either way it then writes 0xff back into the slot to free it and
advances the head with the same 0x5e→0x43 wrap, so the next frame picks up the following byte.


## Anti-tamper

Pooyan carries an unusually dense web of self-verification: better than a dozen routines that read the
program image (and, in a couple of cases, the live video RAM) back as data, fold it into a checksum, and
compare the result against a hard-coded sentinel. None of them touch gameplay when the image is intact —
they are pure tripwires. They differ only in *when* they fire, *what* they sum, and *how loudly* they
answer a mismatch: some halt outright on a path an untampered ROM can never reach, while most just bump a
quiet strike counter and let corrupted downstream code discover the damage on its own.

### The front door: the power-on self-test

The very first thing the boot entry `loc_0092` does, before it builds any machine state, is checksum the
eight 4 KB program-memory banks. Each bank is folded with a 24-bit rolling sum kept as three bytes
(low/mid/high) and compared against its three-byte entry in **ROM_SELFTEST_CHECKSUM_TABLE [code]** (0x0079),
a 24-byte table of the eight banks' expected checksums. A pass tally is seeded with the bank count (8) and
bumped once per matching bank, so a wholly-intact image lands at exactly 0x10; the result is written to
**ROM_SELFTEST_TALLY [code]** (0x8fff). That cell is deliberately parked at the top of the boot stack — an
unbalanced push reserves the word above the stack pointer so the per-frame vblank register-save can never
clobber it. The tally is the gate: the attract state-0 handler `loc_072d` refuses to finish the
attract-to-play handoff — clearing the in-play flag, advancing the top-level state, flooding the attribute
map, queueing its display commands — unless ROM_SELFTEST_TALLY reads 0x10. A single bad bank leaves the
tally short and the machine simply never leaves attract setup.

### The program-signature samplers

The lightest-weight check is `verifyRomSignature` (0x208c). It walks **SIGNATURE_REFERENCE_TABLE [seen]**
(0x20aa) — sixteen expected bytes — against every eighth byte of the sampled code region starting at
**SIGNATURE_SAMPLE_BASE [seen]** (0x066d): the reference pointer steps by one, the sample pointer by eight.
On the first byte that differs it sets **SIGNATURE_MISMATCH_FLAG [code]** (0x8ef0) to 1 and stops; a clean
sweep leaves the flag untouched. This sampler is driven from the per-frame scroll worker `loc_0254`, which
runs it *instead of* its normal column repaint whenever the low nibble of **WORKER_CONTROL_BYTE [code]**
(0x883f) is set — so the signature is re-sampled opportunistically as the control byte cycles.

`loc_744e` (attract/self-test state 0) does a stricter, two-stage byte-for-byte comparison rather than a
folded sum. Loop 1 compares the first eight boot bytes at **BOOT_CODE_BASE [code]** (0x0000) against a
verbatim reference copy at **SELFTEST_REF_COPY_BOOT [code]** (0x749a); loop 2 continues the reference walk
across a 0x74-byte program window from **SELFTEST_LOOP2_SCAN_BASE [code]** (0x0092). A loop-2 divergence
aborts straight into the screen re-init handler `loc_67df` (below); an intact image passes both loops having
written only its display-list seeds.

### The rolling-checksum tripwires that feed the strike counters

Most of the guards share one shape: sum a fixed span of program bytes, test the running total against a
sentinel, and on a miss increment a per-guard strike counter — never halting, so the effect only surfaces
later when other code reads that counter. Each guard owns its own counter, and they cluster in two bands of
work RAM (0x89e7..0x89ef and 0x8a38..0x8a3c).

- `verifyRomChecksum` (0x3fe9, the state-10 integrity guard) sums sixteen bytes descending from
  **ROM_CHECKSUM_TOP [code]** (0x7780) into a byte, then reads its *shape* rather than an exact value: a
  healthy image has bit 0 clear, bit 5 set and bit 7 set. Any other shape bumps
  **TAMPER_STRIKES_STATE10 [code]** (0x8a39).
- `loc_7e6d` is a periodic guard gated twice over — it runs only when player 1 has at least four lives and
  the frame counter is at its zero crossing. It sums the image downward from **TAMPER_CKSUM_TOP_ADDR [code]**
  (0x64be) to a 0x34 terminator, tracking both the byte sum and a carry tally; if `(carries + sum)` keeps any
  bit of 0xb0 the image is judged tampered and **TAMPER_STRIKES_ROM [code]** (0x89ef) is bumped. That same
  entry address doubles as the terminator match-scan guard `loc_64be`, whose miss instead bumps
  **TAMPER_STRIKES_TERMINATOR [code]** (0x8df9).
- `loc_05ee` hides a tripwire behind the credit HUD: after drawing the credit count it arms the check *only*
  when the units digit is exactly 2, then sums 31 bytes downward from **HUD_GUARD_CKSUM_TOP [code]** (0x64c8)
  and, on anything but the 0x8c sentinel, bumps **TAMPER_STRIKES_HUD_GUARD [code]** (0x8a3c).
- `loc_52f6` runs a gated slot sweep: only while **SCRIPT_ADVANCE_GUARD [seen]** (0x8d6d) is set and the
  once-only **SLOT_SWEEP_LATCH [code]** (0x8d6e) is still clear, and only when at least four of the six actor
  slots are free. It latches the free count, then folds 23 bytes from **SLOT_SWEEP_CKSUM_BASE [code]**
  (0x0bf3) into a 16-bit sum; a low byte other than 0x15 or high byte other than 0x09 bumps
  **TAMPER_STRIKES_SLOTSWEEP [code]** (0x89e8).
- `loc_3266` (hunter-formation dispatch state 2) sums a 0x20-byte block upward from
  **FORMATION_GUARD_BASE [code]** (0x0799); an intact image reaches the 0xdc sentinel and returns to the
  shared epilogue, while any other sum halts on a path a valid ROM never takes.
- Two guards ride inside the actor state machine and only fire on the frame-counter zero crossing. `loc_3865`
  (when the record has reached the object-table band) sums downward from **ACTOR_TAMPER_CKSUM_TOP [code]**
  (0x4282) to a 0x1a terminator and bumps SIGNATURE_MISMATCH_FLAG if `(carries + sum)` keeps any bit of 0x9e.
  `loc_4103` folds the *low nibbles* of a 56-byte block at **TAMPER_NIBBLE_SUM_BLOCK [code]** (0x557f); an
  intact image lands on low total 0x67 with exactly one carry, and any deviation bumps
  **TAMPER_STRIKES_SIG [code]** (0x8a38).
- `loc_3be3` (object state 0) runs its check only while the screen is upright and the stage countdown is
  still low: it sums an 0x12-byte window descending from **STATE0_CKSUM_BASE [code]** (0x01d5), and a running
  sum other than 0x55 bumps **TAMPER_STRIKES_STATE0 [code]** (0x89ed) — the last slot of the seven-flag
  integrity band based at **INTEGRITY_FLAG_SCAN_BASE [code]** (0x89e7).

### The freeze-flag folds

Three guards feed a single master tally, **TAMPER_FREEZE_FLAG [code]** (0x881e), whose consequences are the
harshest of the soft responses. `loc_1b43` (a play-state handler) folds a 34-byte ROM block from
**TAMPER_CKSUM_BASE_5593 [code]** (0x5593) with a mask-rotate-add-with-carry recurrence and bumps the freeze
flag on any result but 0x7c. `flagTamperOnRound5ChecksumMiss` (0x5b06) arms only when **ROUND_COUNTER**
(0x8907) equals 5: it sums six program bytes and bumps the freeze flag unless `(low sum + carry count + 0x7f)`
wraps to zero. A third guard (`loc_5594`) sums an eight-byte signature pair at the first free actor block and
bumps the freeze flag on a mismatch. A raised TAMPER_FREEZE_FLAG is read all over the update chain: `loc_6e75`
skips the phase-1 spawner, `loc_241e` aborts the actor-update helpers, and `loc_1ead` short-circuits the
board setup — so a tampered image quietly loses its enemies and never arms a round.

A companion signature fold lives in `loc_1bcc`, which snapshots the live state page into player 1's bank and
then, quirkily, *seeds the checksum from the advanced copy pointer rather than zero* before adding fourteen
program bytes (each masked to its low five bits) from **TAMPER_CHECKSUM_CODE_BASE [code]** (0x5328); unless
the fold lands on the expected sentinel word it bumps TAMPER_STRIKES_SIG.

### The byte-for-byte copy compares

Two guards keep a second, redundant copy of a block in ROM and compare the two verbatim, answering a
mismatch by *wiping work RAM* rather than nudging a counter — a hard brick. `loc_6f9d` (level-intro phase 4)
compares 0x44 bytes of **PHASE4_TAMPER_ORIG [code]** (0x6ac5) against **PHASE4_TAMPER_COPY [code]** (0x6fed):
a full match queues one sound and one display command, and any mismatch propagates zero forward across work
RAM. `loc_30f1` (hunter-formation launch) compares a two-byte pointer header plus 0x40 body bytes of the copy
at **TAMPER_COPY_3278 [code]** (0x3278) against the original routine at
**SELFCHECK_ROUTINE_BASE_ADDR [code]** (0x68ac); a mismatch likewise wipes work RAM upward from its base.

That same 0x68ac routine is also self-summed by `loc_79e9`, which walks its bytes forward until the
terminating 0xc9 return opcode, accumulating a 16-bit checksum, and matches it against the two-byte word at
**TAIL_CHECKSUM_GUARD [code]** (0x7a0b): a low-byte miss is an integrity trap (unreachable while the summed
bytes are intact) and a high-byte miss diverts to the phase-gauge path. The shared integrity/timer handler
`loc_7960` performs the most elaborate fold of all — a 0x5b-byte sum over **INTEGRITY_CHECKSUM_CODE_BLOCK
[code]** (0x2901) *plus* a second sum taken only at even offsets, all four result bytes matched against the
four guard bytes that trail the block — before it renders the play timer. After rendering it scans the
seven-flag integrity band from INTEGRITY_FLAG_SCAN_BASE; because several strike counters physically live
inside that band, a strike raised anywhere diverts loc_7960 into a second, tail checksum (summed to a 0xc9
sentinel and again matched against TAIL_CHECKSUM_GUARD).

### The tile-region and colour-map checks

Two guards verify the display memory rather than the code. `loc_68ac` runs at most once — guarded by
**TILE_CHECKSUM_LATCH [code]** (0x8f55), which it sets on entry — and sums the whole playfield tilemap from
**PLAYFIELD_TILE_BASE [code]** (0x8402), walking a 29-cell-wide column, skipping a three-cell gap to the next
row, and advancing pages until the high byte reaches 0x88. It keeps the running sum as a low byte and a wrap
count, looks the low byte up in **TILE_CHECKSUM_TABLE [code]** (0x68eb), and on a hit checks the wrap count
against the table's paired entry; a miss on either is a tamper condition on an unreachable path. `loc_67df`
gates a screen re-init behind a colour-map checksum: it sums ten colour cells one row apart from
**HUD_INTEGRITY_STRIP_A [code]** (0x82bc), and only a 0x5a sentinel lets it arm a fresh screen (round flag,
timers, arena wipe, playfield paint) — any other sum hands off to the per-object frame updater instead. The
attract sub-state handler `loc_08e9` straddles its colour-map flood with two data-table guards: a 0x20-byte
sum from **FIELD_ATTRIB_SRC_C [code]** (0x0859) must reach 0x63, and a nine-byte sum from
**ATTRACT_INTEGRITY_CKSUM_BASE [code]** (0x0831) must reach 0xaa; either miss halts on a path intact data
never reaches.

### The table and high-score guards

`verifyTableChecksum` (0x585b) is a reusable tripwire taking a pointer, a count and a seed: it sums the span
into a 16-bit accumulator (low byte plus a carry-counted high byte) and, unless the result is high 0x1d /
low 0xc1, raises **TAMPER_ROM_CHECK_FLAG [code]** (0x882b) — the flag the eagle-spawn path (its caller
`loc_5835`) reads. `flagHighScoreTableCorruptOnChecksumMiss` (0x0644) guards the saved high-score table: the
first byte of the four-byte block at **HISCORE_CHECKSUM_BASE [seen]** (0x778a) must be the 0xc8 header, and
the four bytes summed minus the per-byte carry count must equal 0x59; a bad header or a mismatched total sets
**HISCORE_TABLE_CORRUPT_FLAG [code]** (0x8df8) so a corrupted table can be rebuilt rather than trusted.

### How a raised flag manifests

The traps that halt are the exception; the norm is a flag that degrades play quietly. **TAMPER_FREEZE_FLAG**
freezes spawns, aborts actor updates and skips setup, as above. **TAMPER_OBJECT_FREEZE_FLAG [code]** (0x89fb),
raised by the `loc_08b3` guard and cleared at reset by `loc_2527`, is ORed with the board-clear flag to
freeze the whole per-frame object update in `loc_1e55`/`loc_2527`. **SIGNATURE_MISMATCH_FLAG**, once nonzero,
makes `loc_6523` bail out of its update. **TAMPER_STRIKES_TERMINATOR** is ORed with the board-clear flag in
`loc_2514` to divert into the board/HUD reset. Even the rope-extend driver `loc_2d80` reads
**TAMPER_STRIKES_ROM** and forces an extra segment advance while a strike is pending. And because the seven
flags scanned by loc_7960 include the slot-sweep and state-0 strike counters, a single strike also rewires
that handler's control flow. The net design: an intact ROM sails through every guard untouched, while a
patched one accumulates strikes that starve spawns, freeze objects, corrupt the reset path, and — for the
copy-compare guards — zero out work RAM entirely.
