# Pooyan — how the machine works

This document describes the running machine as it is now, and is regenerated whole each understanding
pass. Confidence tags mirror `idiomatic/names.js`: **[seen]** = the cell's role is confirmed by a MAME
golden observation; **[code]** = read from the translated behaviour with MAME-grounding still open (the
cell is static or unobservable in the current goldens). The map covers both the machine's **state
architecture** — the work-RAM layout and the variables the game runs on — and its **control flow**: the
main loop, the vblank interrupt that is the machine's only per-frame heartbeat, and the state machines
that drive configuration, play, the actor arena, the wave/rope/launch cycle, rendering and the self-checks.

## The work RAM and its state model

The Z80 sees one flat 64 KB address space, and the way it is carved up is the frame
on which every other mechanism hangs. The bottom half, 0x0000-0x7FFF, is the 32 KB
program ROM and is never written -- a store there is an unmapped-write fault, not a
side effect. Above it sit four RAM-backed regions, each attached to a different piece of
hardware: the colour/attribute plane at 0x8000-0x83FF, the tile-code plane at
0x8400-0x87FF, the general-purpose work RAM at 0x8800-0x8FFF, and the two 256-byte
sprite banks reachable through 0x9000-0x9FFF. From 0xA000 up there is no memory at all
-- that window is the I/O port block, and a read there and a write there talk to
entirely different devices. Only work RAM is scratch the program owns outright; the
video planes and sprite banks are output surfaces the game paints into, and the I/O
window is the door to the coin door, joysticks, DIP switches, sound board, and the
control latch.

### Work RAM: the game's memory (0x8800-0x8FFF)

Everything the machine remembers between one instruction and the next lives in this
2 KB page: what screen it is showing, whose turn it is, where every actor sits, the
scores, the high-score table, and dozens of timers and one-shot latches. Boot clears
the whole span to zero (an LDIR fill from 0x8800 upward), then seeds the handful of
cells that must not start at zero, so the state model always begins from a known
floor.

The lowest addresses hold configuration and top-level control. The four DIP-derived
config bytes are decoded once, at boot, by reading the physical switch ports and
complementing them: BONUS_AWARD_DSW [code] at 0x8800 selects the extra-life award
schedule, DIFFICULTY_DSW [code] at 0x8820 carries the three difficulty bits that scale
enemy spawn schedules, DEMO_SOUNDS_DSW [code] at 0x8821 gates attract-mode sound, the
lives count LIVES_DSW [code] at 0x8807 is copied into both players' life counters at
board reset, and COINAGE_CONFIG [seen] at 0x882c holds the coin-slot nibble (the value
0x0F meaning free play). These are written exactly once and read forever after; they
are effectively constants for the life of the power-on. CREDIT_COUNT [seen] at 0x8802
is the live BCD credit counter, bumped by a coin and consumed by a start button.

The single most important cell is MAIN_GAME_STATE [seen] at 0x8805: it is the
top-level selector the per-frame service routine dispatches on, choosing among
attract, intro, and play handlers through a jump table. Below it, GAME_ACTIVE_FLAG
[seen] at 0x8806 is the in-play gate -- set to 1 at start-of-life and cleared to 0 at
game-over -- and most gameplay handlers return immediately when it is zero. Within a
running game a second selector, PLAY_STATE_INDEX [seen] at 0x880a, steps through the
round and intro sub-phases via its own table, and PHASE_TIMER [seen] at 0x8808 is the
per-frame countdown those handlers reload and drain to time transitions. This is the
shape of the whole state model: a small number of discrete state selectors near the
top of the page choose which handler runs, and a forest of countdown timers decides
when each state gives way to the next.

Two-player play is expressed as a banking scheme. TWO_PLAYER_FLAG [seen] at 0x880e is
nonzero for a two-player game, and ACTIVE_PLAYER [seen] at 0x880d selects whose turn
is live: with bit 0 clear the machine reads and writes player 1's cells, and with it
set, player 2's. The two players' persistent state is held in mirror-image banks --
PLAYER0_STATE_BANK [seen] at 0x8940 and PLAYER1_STATE_BANK [seen] at 0x8980, each a
0x3F-byte block, with the remaining-lives counts PLAYER0_LIVES [seen] at 0x8948 and
PLAYER1_LIVES [seen] at 0x8988 -- while a single live working page at 0x8900 is
swapped in and out of the inactive player's bank at each turn change. Scores follow
the same pattern: P1_SCORE_BCD [seen] at 0x88A2 and P2_SCORE_BCD [seen] at 0x88A5 are
three-byte BCD buffers, one of which is selected by the active-player bit and
accumulated during that player's turn, and HIGH_SCORE_BCD_HI [seen] at 0x88AA tops the
running high score that is kept in step with them. The full sorted leaderboard, ten
three-byte BCD entries, sits at HIGH_SCORE_TABLE [code] 0x8A00.

Input reaches the game through a small ring near 0x8810. Each frame the service
routine samples the three controller ports, complements them (the ports are
active-low), and lays the fresh readings down at INPUT_PORT0 [seen] 0x8810 and its two
neighbours, first shifting the previous frame's samples up into 0x8813-0x8816. Holding
one and the previous frame side by side is what lets the game distinguish a fresh
button press -- a coin, a start, a fire -- from a button merely being held down.
FLIP_SCREEN_FLAG [seen] at 0x881F records the cabinet orientation and is copied out to
the hardware flip latch every frame.

Above the control band, the bulk of the page is dynamic object state. The actor arena
begins at ACTOR_TABLE [seen] 0x8A80, a stride-0x18 array whose slot 0 is the player
actor (its vertical position at PLAYER_Y [seen] 0x8A84, its input/aim byte at 0x8A87);
the enemy, projectile, formation, and spawned-object record pools are laid out in
further stride-0x18 tables up through the 0x8B-0x8C pages, and the eagle/rope/wave
state machines with their countless timers and latches fill the 0x8D-0x8F pages. Each
record carries its own state byte, and the per-frame drivers dispatch on those bytes
exactly the way the top-level selector dispatches on 0x8805 -- the state model is the
same idea repeated at every scale. Underpinning all of it is FRAME_COUNTER [seen] at
0x8A5F, a free-running byte the service routine decrements every vblank; its low bits
phase animations and its zero-crossings gate periodic checks. A second per-frame
counter, WORKER_CONTROL_BYTE [code] at 0x883F (deliberately placed one byte below the
sprite display list), is decremented alongside it and its low nibble gates a periodic
integrity check.

The very top of work RAM belongs to the CPU stack. The stack pointer initialises to
0x9000 -- the byte just past the end of the page -- and pushes grow downward, staying
within roughly 0x8FC0-0x9000 in practice. Because this window holds transient return
addresses and saved registers rather than durable game state, its contents are not
part of the state model even though they share the page.

### The video planes

Two planes describe the fixed tilemap, paired cell-for-cell 0x400 apart. The
colour/attribute map begins at 0x8000, with ATTRIB_MAP_BASE [seen] at 0x8040 the base
of the playfield's colour region, flooded column by column as a stage loads. The
tile-code map begins at 0x8400, with PLAYFIELD_TILE_BASE [code] at 0x8402 the start of
the playfield tile region; the same offset within each plane names one on-screen cell,
so a cell's tile code lives at 0x84xx and its colour/attribute byte at the
corresponding 0x80xx address. These are write-mostly surfaces: the game stamps
columns, HUD digits, score panels, and message strings into them, and the renderer
reads them back out. The score and HUD digit columns, the phase gauge, the round
marker, and the high-score display are all just specific cell addresses inside these
two planes.

The moving objects live in the two sprite banks reached through 0x9000-0x9FFF. The
address decode there is a mirror: bit 0x0400 selects the bank (0x9000 is bank 0,
0x9400 is bank 1) and only the low byte indexes within it, so each bank is a 256-byte
window. The two banks together describe up to 24 hardware sprites at stride-2 offsets
running 0x10 upward: for a given offset, bank 0 holds the sprite's X and tile code and
bank 1 holds its colour/flip control byte and its (240-minus-)Y. Crucially, the game
does not manipulate the sprite banks directly during a frame. It builds a
24-entry, four-bytes-each sprite display list in work RAM at SPRITE_DISPLAY_LIST
[seen] 0x8840, rewriting it from the live object records every frame, and the vblank
service routine then fans those four-byte records out into the two banks -- two bytes
to bank 1 from SPRITE1_CLEAR_BASE-region 0x9410 and two to bank 0 from
SPRITE0_CLEAR_BASE-region 0x9010 -- so the on-screen sprites are a refreshed copy of
the work-RAM list, not a separate state. Boot blanks the tops of both banks
(SPRITE0_CLEAR_BASE [code] 0x9010 and SPRITE1_CLEAR_BASE [code] 0x9410) so no stale
sprite shows before the first list is built.

### The hardware I/O window (0xA000 and up)

From 0xA000 the address space stops being memory. Every access here is a device, and
the governing rule -- the one that makes this region easy to misread -- is that a read
and a write at the same address are two different devices. The decode is done with
don't-care bit masks (hardware mirrors), so many addresses alias onto each canonical
port, but the canonical addresses are these.

On the read side sit the inputs and DIP switches. 0xA000 reads DSW1 (the lives,
cabinet, bonus, difficulty, and demo-sound switches, idle value 0x7B); 0xA080 reads
IN0; IN1_PORT [code] at 0xA0A0 reads the player-1 controls and IN2_PORT [code] at
0xA0C0 the player-2 controls (used when the screen is flipped for a cocktail cabinet);
and 0xA0E0 reads DSW0, the coinage switches. All the controller ports are active-low
-- idle reads 0xFF, and a pressed bit reads 0 -- which is why the service routine
complements each sample before storing it in the input ring. The DIP ports are the
raw source the boot routine decodes into the work-RAM config cells described above.

On the write side sit the control outputs, and here 0xA000 is the standout: writing it
kicks the watchdog (the boot and per-frame code strobe it constantly to prove the CPU
is alive), even though reading it returns DSW1. 0xA100 is the sound-command port --
SOUND_COMMAND_LATCH [seen] at 0xA100 is where a command byte is handed to the audio
CPU. 0xA180-0xA187 is an eight-bit addressable control latch (an LS259): rather than
writing a byte, the program writes one bit per address, the low bit of the value
landing in the latch whose index is the low three bits of the address. Those eight
outputs are the machine's discrete controls: bit 0 (0xA180) is the vblank-NMI enable
gate, and the service routine clears it on entry and re-arms it on exit so the next
vblank interrupt fires cleanly; AUDIO_IRQ_LATCH [seen] at 0xA181 strobes the audio
CPU's interrupt after a command is posted; bit 2 mutes audio; COIN1_COUNTER_LATCH
[code] at 0xA183 and its neighbour drive the physical coin counters; bit 5 is the
payout line; and bit 7 (0xA187) is the flip-screen output, driven inverted, which the
service routine loads every frame from FLIP_SCREEN_FLAG in work RAM. The work-RAM flip
flag is thus the durable state and the latch bit is its per-frame echo to the
hardware -- a pattern typical of how this machine keeps its persistent decisions in
work RAM and mirrors them out to the control latch each vblank.
## The frame loop and the vblank heartbeat

Pooyan's foreground code never waits for the beam. The main loop at `loc_020f` is a
tight infinite spin that free-runs as fast as the CPU will carry it; nothing in it
polls a vblank bit or counts scanlines. All of the machine's timing hangs instead off
a single interrupt: the vblank NMI at `loc_066d`, which fires once per displayed frame
and is the sole heartbeat the rest of the game is paced against. The foreground loop is
the hands; the NMI is the metronome.

What the main loop actually does each pass is decide between two jobs by peeking at a
ring of pending display commands. It fixes the high byte of its address to page `0x88`,
reads the ring's read cursor out of `0x88a1`, and uses that byte as the low half of a
pointer back into the same page — so the cursor names a slot inside the ring. It fetches
that slot's byte and doubles it, which drops bit 7 into carry. A slot whose top bit is
set is a *free* slot (freed slots are stamped `0xff`): finding one means the ring is
drained, and the loop takes that as its cue to run the per-frame worker at `loc_0254`
and come back around. A slot whose top bit is clear is a real, pending command, and the
loop dispatches it.

That ring is the machine's deferred-drawing mailbox. Producers deposit two-byte
commands through `loc_0038` (reached as the `rst 0x38` vector): it reads the write
pointer from **DISPLAY_CMD_RING_WRITE_PTR** [code] at `0x88a0`, and if the slot it
points at is still free it drops the command's high byte there, its low byte in the next
cell, and steps the write pointer on by two — wrapping back to `0xc0` whenever it would
fall below it, so the storage cycles through the 64-cell window `0x88c0`–`0x88ff`. If the
target slot is already occupied the command is simply dropped rather than clobbering
unread work. When the main loop consumes a command it mirrors this exactly: it masks the
first byte with `0x1f` to form an even offset into the handler table at `0x0242`, pulls
the second byte out into `A` as a parameter for the handler, stamps both consumed slots
back to `0xff`, and advances the read cursor at `0x88a1` by two with the same wrap to
`0xc0`. It pushes `0x020f` as the handler's return address and jumps into the selected
handler, so every drawing handler falls straight back into the top of the loop when it
returns. The first byte of a command therefore selects *which* piece of screen work runs
and the second carries its argument — for example **OBJECT_SPAWN_DISPLAY_CMD** [code]
(`0x0611`) and **HUNTER_SPAWN_DISPLAY_CMD** [code] (`0x0315`) are words enqueued through
`loc_0038` when objects and hunters appear. Crucially the loop keeps dispatching command
after command until the ring runs dry within the same span of foreground time; only when
it finally lands on a free slot does it fall through to the worker. A whole burst of
commands queued up during, say, the credit screen is flushed in one drain rather than
dribbling out one per frame and leaving stale tiles on the playfield.

The per-frame worker `loc_0254` is the light housekeeping the loop does whenever the ring
is idle. It is paced not by its own logic but by a counter the NMI keeps ticking:
**WORKER_CONTROL_BYTE** [code] at `0x883f`, the cell one below the sprite display list.
If that byte's low nibble is nonzero the worker only runs a program-signature integrity
check and returns; since the NMI decrements the byte every frame, the low nibble spends
fifteen frames out of sixteen nonzero and the signature check dominates. On the one frame
in sixteen where the low nibble reaches zero — and only while **GAME_ACTIVE_FLAG** [seen]
(`0x8806`) is set — the worker instead repaints the machine's scrolling tile columns:
in a one-player game it blanks a run of three-tile columns, in a two-player game it caps
and paints a body column, then stamps a further scroll column through `loc_02a8`. A last
column is blanked only when bit 4 of the control byte and bit 0 of the game-active flag
are both set. Which column that final blank lands on is chosen by **ACTIVE_PLAYER** [seen]
(`0x880d`), and the two-player branch is taken on **TWO_PLAYER_FLAG** [seen] (`0x880e`).
Every column the worker touches steps one tilemap row upward per cell.

The heartbeat itself, `loc_066d`, is where the real per-frame work lives. It opens by
saving the entire register file — main set, shadow set, and both index registers — and
immediately masks further NMIs by clearing bit 0 of the LS259 latch at `0xa180`, so a
frame's service can't re-enter itself. It then refreshes the hardware sprite banks:
walking the sprite display list from **SPRITE_DISPLAY_LIST** [seen] (`0x8840`) and its
neighbouring record regions and copying them into the two sprite banks at `0x9010` and
`0x9410`. How many groups it copies depends on **PLAY_STATE_INDEX** [seen] (`0x880a`):
in state 4 it transfers four separate record groups, otherwise a single tall group. Next
it kicks the watchdog by writing `0xa000`, then samples the three control ports — IN2 at
`0xa0c0`, IN1 at `0xa0a0`, IN0 at `0xa080` — complementing each (the inputs are active-low)
and storing them down into the edge-detect ring headed by **INPUT_PORT0** [seen]
(`0x8810`), first shuffling the previous frame's samples up the history cells so button
edges can be detected against the prior frame.

With input latched, the NMI ticks its two per-frame counters — the worker-pacing
`0x883f` and the free-running **FRAME_COUNTER** [seen] (`0x8a5f`), whose low bits phase
animation and whose zero-crossings gate periodic integrity checks — then services coin
and credit logic and drains one entry from the sound-command ring into the audio CPU
(`loc_0e64`). Only then does it run the frame's game logic: it reads the top-level state
selector **MAIN_GAME_STATE** [seen] (`0x8805`) and dispatches through the jump table at
`0x06f0` (attract, intro, and play handlers), pushing a return into its own epilogue so
whichever handler runs lands back inside the interrupt. Those handlers are the producers
that fill the display-command ring the foreground loop is busy draining. Finally the
epilogue copies **FLIP_SCREEN_FLAG** [seen] (`0x881f`) into bit 7 of the flipscreen
latch at `0xa187` so the screen orientation tracks the flag every frame, restores every
saved register in reverse, re-arms the NMI by setting bit 0 of `0xa180` back to 1, and
returns to whatever address the free-running main loop had reached when the beam
interrupted it.

The two pieces thus form a clean producer/consumer split running off one clock. Sixty
times a second the vblank NMI preempts the spinning main loop, refreshes the sprites,
reads the sticks, advances the frame counters, and runs one frame of game state — and
that game state, rather than drawing directly, posts display commands into the page-`0x88`
ring. Between interrupts the main loop empties that ring, executing the deferred drawing
handlers, and idles into the housekeeping worker until the next NMI arrives. No part of
the foreground counts time on its own; the NMI is the only thing tied to the frame, which
is exactly why the game's whole cadence is governed by that single vblank heartbeat.
## Configuration, coinage and players

### Reading the DIP switches at boot

The two option banks are read straight off the input hardware during the reset sequence
(the boot routine at loc_0092). The board exposes DSW0 at port `0xa0e0` and DSW1 at port
`0xa000` -- the same `0xa000` cell that doubles as the watchdog on a write, so a *read* of it
returns the second switch bank. Both banks are wired active-low, so every field is complemented
(`cpl`) as it is unpacked; the game's work-RAM config cells therefore hold the *logical* option
value, not the raw switch bits.

DSW1 is decoded first. After `cpl` the byte is rotated right and sliced field by field: bit 2
lands at 0x880f (the cabinet-type flag), bit 3 becomes **BONUS_AWARD_DSW [code]** at 0x8800,
bits 4-6 become the 3-bit **DIFFICULTY_DSW [code]** at 0x8820, and bit 7 becomes
**DEMO_SOUNDS_DSW [code]** at 0x8821. The routine then re-reads DSW1, complements it again, and
maps its low two bits into **LIVES_DSW [code]** at 0x8807: values 0/1/2 select 3/4/5 lives (the
decode adds 3 to the two-bit field), and the all-ones case is stored as the 0xff sentinel. This
lives byte is later seeded into both players' life counters at board reset.

DSW0 carries the coinage. Its two nibbles are each used, high nibble first, as an index into the
ROM coinage table at 0x0053; the looked-up byte for the high nibble is stored at 0x882f (the
second coin slot's coinage) and the byte for the low nibble becomes **COINAGE_CONFIG [seen]** at
0x882c (the first coin slot's coinage). Each coinage byte packs the slot's exchange rate: the
high part sets how far the coin accumulator must climb before a credit is granted, and the low
nibble is the number of credits granted per exchange. The whole-byte value 0x0f is the free-play
sentinel. Alongside this, boot seeds **FLIP_SCREEN_FLAG [seen]** at 0x881f (and its latch bit 7
of the LS259 at 0xa187) to 1 for the normal upright orientation.

Note that all of 0x8800-0x8ffd is zero-filled earlier in boot; the DIP-derived values above are
written *after* that clear, so they are the durable configuration for the session. There is no
runtime re-read of the switches -- the game runs entirely off these decoded cells.

### Sampling coin and start inputs each frame

The vblank service routine (loc_066d) samples the three player-input ports every frame,
complementing each (they are active-low) and storing them into a small edge-detect ring. IN0 at
port `0xa080` is inverted into **INPUT_PORT0 [seen]** at 0x8810, IN1 (**IN1_PORT [code]**,
`0xa0a0`) into 0x8811, and IN2 (**IN2_PORT [code]**, `0xa0c0`) into 0x8812. Before the fresh
sample is taken the previous two frames' bytes are shuffled up into 0x8813-0x8816, so the coinage
and start logic can distinguish a fresh press from a held button. Within INPUT_PORT0, bit 0 is
coin slot 1, bit 1 is coin slot 2, bit 2 is the service coin, bit 3 is the 1-player start, and
bit 4 is the 2-player start.

### Coinage bookkeeping and the credit counter

Coin handling runs through the coinage-gated chain at loc_59e8, which the vblank service calls
each frame. Its first act is a free-play short-circuit: if either coinage byte (0x882c or 0x882f)
reads the 0x0f sentinel it returns immediately, so none of the coin accounting or coin-meter
strobing runs in free play. Otherwise it drives three near-identical coin-accumulate steps and the
two coin-counter pulse generators.

The three accumulate steps (loc_5a06, loc_5a1f, loc_5a56) each isolate one coin bit from
INPUT_PORT0 -- the service bit (bit 2), coin-slot-2 (bit 1), and coin-slot-1 (bit 0) respectively
-- by rotating that bit into carry and shifting it (`rl`) into a per-slot debounce ring byte at
0x8829 / 0x882d / 0x882a. A ring value whose low three bits equal 1 means the bit was low for two
frames and is high this frame: a single clean coin edge. Coin-slot-1 and coin-slot-2 respond to an
edge by stepping a per-slot progress accumulator (0x882b for slot 1, 0x882e for slot 2) up by
0x10 and comparing it against that slot's coinage byte (0x882c / 0x882f); until the accumulator
overtakes the coinage threshold no credit is granted, so several coins can be required per credit.
When it does overtake, the accumulator wraps and the low nibble of the coinage byte -- the
credits-per-exchange count -- is added to the credit counter. Each of those two slots also bumps
its queued coin-meter pulse count (**COIN1_PULSE_COUNT [code]** at 0x8824 for slot 1, and its
sibling at 0x8826 for slot 2) so the physical coin meter ticks once per accepted coin. The service
input takes a shorter path: it grants exactly one credit per edge and does not tick a coin meter.

All three funnel into a shared accumulate tail (loc_5a8a / loc_5a8c / loc_5a97): the credit amount
in A is added to **CREDIT_COUNT [seen]** at 0x8802, the running total is clamped to a maximum of
0x63 (99 in BCD), and a display command (0x0701) is queued so the on-screen credit field is
redrawn. The MAME golden confirms CREDIT_COUNT is precisely this credit tally -- a coin drives it
0->1, and starting a game consumes it back down -- and that it stays static at 0 through attract.

A current-state caution: the byte at 0x882b is multiplexed. In the coinage path it is coin-slot-1's
progress accumulator (just below COINAGE_CONFIG at 0x882c), but a separate eagle-spawn code path
reads and writes the same cell as **TAMPER_ROM_CHECK_FLAG [code]**. The two uses are keyed by which
routine touches it, not by any tag on the cell itself.

### Coin-counter pulse generators

The physical coin meters are strobed by two structurally identical generators (loc_5a9c for
counter 1, loc_5ac0 for counter 2). Each watches its queued-pulse count (COIN1_PULSE_COUNT at
0x8824, or 0x8826 for counter 2) and returns immediately when nothing is queued. On a fresh pulse
it seeds a phase timer -- **COIN1_PULSE_PHASE [code]** at 0x8825 (0x8827 for counter 2) -- to 0x30
and raises the meter latch: for counter 1 that is **COIN1_COUNTER_LATCH [code]**, bit 3 of the
LS259 at `0xa183` (counter 2 uses bit 4 at `0xa184`). These latch writes are write-d0, so only bit
0 of the value physically lands. While a pulse is in flight the phase counts down; at phase 0x18 it
drops the latch again, and when phase reaches 0 it decrements the queued-pulse count. The net
effect is one clean, timed high/low strobe of the coin meter per accepted coin.

### Credit display, free-play and demo sounds

The credit field is drawn by loc_05ee: it reads CREDIT_COUNT, clamps it to 99, converts to packed
BCD, and writes the tens digit to **CREDIT_HUD_TENS_VRAM [code]** (0x86bf, only when the tens
nibble is nonzero) and the units digit to **CREDIT_HUD_UNITS_VRAM [code]** (0x869f). (The same
routine hides an anti-tamper tripwire: only when the units digit is exactly 2 does it sum the
31-byte program block below **HUD_GUARD_CKSUM_TOP [code]** at 0x64c8 and bump
**TAMPER_STRIKES_HUD_GUARD [code]** if the sum misses its 0x8c sentinel.)

Free play is surfaced to the player through loc_0e54: it always queues the primary display command
(0x0701) and, only when COINAGE_CONFIG reads the 0x0f free-play sentinel, queues an extra command
(0x0606) that lights the free-play indication. DEMO_SOUNDS_DSW gates attract-mode audio: the sound
ring consumer (loc_0e64) dispatches a queued sound whenever bit 0 of DEMO_SOUNDS_DSW is set, but
when that bit is clear it suppresses queued sounds while the game is idle -- silencing the attract
demo when the operator has disabled demo sounds.

### Spending credits and starting a game

With at least one credit banked, the attract/epilogue logic advances toward the start prompt: the
shared handler epilogue at loc_0bb5, in the paid (non-free-play) branch, returns early if
CREDIT_COUNT is zero and otherwise steps the top-level state forward so the game can be started.

The actual start-button handling and credit spend live at loc_0d78. It inspects INPUT_PORT0: a
1-player start (bit 3) routes to loc_0de4, which -- if CREDIT_COUNT is nonzero -- decrements it by
one credit and jumps into the start-of-life setup with HL=0 (a one-player game). A 2-player start
(bit 4) requires at least two credits; it subtracts two, then falls into the same setup with
HL=0x0100. In free play, loc_0bb5 takes the parallel path: it reads the start bits directly and
launches without touching the credit counter. A guarded variant, loc_7fd6, lets a start press mid
sequence hand off to loc_0d78 only when a credit is present and the addressed player's slot is
still open.

The start-of-life setup (loc_0dab) writes the 16-bit HL into **ACTIVE_PLAYER [seen]** (0x880d) and
**TWO_PLAYER_FLAG [seen]** (0x880e) as a pair -- so HL=0 seats player 1 active with the two-player
flag clear, while HL=0x0100 seats player 1 active *and* raises the two-player flag. It then clears
the play sub-state, sets the top-level state to the play value, raises the in-play gate, re-asserts
the normal-orientation flag, and (for a two-player game) fires the extra start jingle and clears an
init block.

### Active-player selection and two-player alternation

Throughout a two-player game the low bit of ACTIVE_PLAYER selects which player's banks are live:
bit 0 clear picks player 1, bit 0 set picks player 2. The score path uses this directly --
selectActivePlayerScoreBuffer (loc_04f2) returns the pointer to **P1_SCORE_BCD [seen]** (0x88a2)
or **P2_SCORE_BCD [seen]** (0x88a5) from that bit, and the per-player timer and extra-life
bookkeeping select their banks the same way (the bonus/extra-life step at loc_18da, for instance,
compares the active player's score-counter MSB and reloads its award queue and BCD step size from
BONUS_AWARD_DSW). TWO_PLAYER_FLAG is the master gate: it is nonzero only for a two-player game, and
the MAME golden confirms it goes 0->1 at the 2-player start and holds, staying static at 0 in a
one-player game.

The alternation itself is a live-page/bank swap. Each player owns a 0x3f-byte saved state block --
**PLAYER0_STATE_BANK [seen]** at 0x8940 and **PLAYER1_STATE_BANK [seen]** at 0x8980 -- and the
game plays out of a single live page at 0x8900. When a life ends the finishing player's live page
is copied out to their bank (loc_1a47 and loc_1bcc block-copy the live page to the bank chosen by
ACTIVE_PLAYER, and the player-1 snapshot path at loc_1bab latches the active-player flag when the
other player is still alive), and at the next round init (loc_1601) the *incoming* active player's
bank is copied back into the live page. ACTIVE_PLAYER flips as each turn ends -- loc_1bcc clears it
when player 0 still has lives, and the snapshot path raises it -- so the two players trade turns.
The per-player life counts that decide when the swap and game-over happen are **PLAYER0_LIVES
[seen]** at 0x8948 and **PLAYER1_LIVES [seen]** at 0x8988, both seeded from LIVES_DSW at board
reset; the MAME two-player golden shows ACTIVE_PLAYER toggling exactly on each player's death.
## In-play progression and timers

The machine runs off the vblank interrupt. Once per frame the service routine at 0x066d
saves the register file, samples the three input ports into the edge-detect ring, decrements
two per-frame counters, and then hands the frame to whatever the game is currently doing.
The first counter is `FRAME_COUNTER` **[seen]** at 0x8a5f, a free-running down-counter whose
low bits phase animations and whose zero-crossings arm the periodic integrity checks; the
second is `WORKER_CONTROL_BYTE` **[code]** at 0x883f, the per-frame scroll worker's control
byte (its low nibble and bit 4 steer the rendering worker, covered elsewhere). With the
counters ticked, the service routine reads `MAIN_GAME_STATE` **[seen]** at 0x8805 and
dispatches through the jump table at 0x06f0.

`MAIN_GAME_STATE` is the top-level selector; it takes five values, one per handler in that
table, and it is the spine the whole game hangs from:

- **0 -> initial video fill (0x072d).** The tilemap is blanked a row at a time; on the frame
  the fill drains (and the boot self-test tally at 0x8fff reads 0x10) the handler clears
  `GAME_ACTIVE_FLAG`, raises `MAIN_GAME_STATE` to 1, clears `PLAY_STATE_INDEX`, floods the
  attribute columns, enqueues the opening display commands, and clears the attract sub-state
  — i.e. it hands the machine off to attract.
- **1 -> attract/demo (0x0899).** This state dispatches a sub-state selector,
  `ATTRACT_SUBSTATE` **[seen]** at 0x8e51, through its own 0..6 phase table at 0x08a1, every
  handler returning through a shared epilogue.
- **2 -> board build / start (0x0c4e).** Reached when a game is starting, this state runs a
  three-entry sub-machine of its own keyed on `PLAY_STATE_INDEX` (table 0x0c56); the build
  step (0x0c5c) clears `GAME_ACTIVE_FLAG`, seats the tile-fill cursor and re-seeds the fill
  row counter, and the machine ultimately raises `MAIN_GAME_STATE` to 3 to begin play. This
  is also the state the play loop drops back into on game-over (see below).
- **3 -> in play (0x159b).** The gameplay driver, described in detail below.
- **4 -> idle (0x0e53).** A bare-return slot that consumes a frame without drawing.

### The in-play driver and its phase machine

Every in-play frame the state-3 entry (0x159b) does two things in order. First it ticks the
active player's play timer (0x7912, below). Then it dispatches a second, finer state machine
on `PLAY_STATE_INDEX` **[seen]** at 0x880a: only the low five bits are used, indexing the
play-phase table at 0x15a8 (the dispatch itself is at 0x15a1). This inner index is how a
round walks through its phases — the phase handlers advance it themselves (`inc (0x880a)`) to
step to the next phase, so gameplay is a script the index reads off one entry at a time.

Several of those phase handlers pace themselves with `PHASE_TIMER` **[seen]** at 0x8808, the
general per-phase countdown. The field-setup phase (0x16b7) is the clearest example: it
decrements `PHASE_TIMER` and returns unchanged until the timer hits zero, then paints the
playfield for the current variant, seeds the fixed pointers, bumps `PLAY_STATE_INDEX` to the
next phase and enqueues a display command. A handler that wants to hold a phase for a fixed
span seeds `PHASE_TIMER` and spins on it this way before moving on.

The round-start phase (0x175d) is gated instead by a periodic one-shot: it ticks a mod-0x1c
frame tick at 0x88b7 and, on each wrap, toggles the display one-shot at 0x8920. When that
fires and a credit is present, it marks the round live — `ROUND_IN_PROGRESS` **[seen]** at
0x8904 set to 1 and `WAVE_ARRIVAL_COUNTER` **[seen]** at 0x8903 set to 2 — runs the
level-start batch (field build, gauge paint, round marker), and forces `PLAY_STATE_INDEX` to
3 so the round proper begins on the next frame.

### The round/level counters (the 0x8900 page)

The state that describes "which round, how deep, how far along" lives in a compact block at
the base of the 0x8900 page, and the whole block is wiped together at each board reset (see
`loc_0e00` below), so a fresh game starts every one of these at zero.

`ROUND_COUNTER` **[seen]** at 0x8907 is the round number. It is bumped by the round-phase
handler (0x1a01), rendered +1 as the HUD round digit, and its low bits pick stage variants:
bit 0 selects the stage type / facing, bit 1 gates the target-group fan-out. It also indexes
the difficulty tables that scale enemy behaviour.

`STAGE_COUNTDOWN` **[seen]** at 0x8901 is the on-screen depth number — the count that ticks
down as the round drains. The round-phase handler (0x1a01) seeds it at the top of a round
(0x28 for the first rounds, 0x30 once `ROUND_COUNTER` reaches 2, i.e. the seed is scaled by
round), and the despawn tick (0x34b0) drains it one step at a time and renders it as the
two-digit HUD stage number at `HUD_STAGE_DIGIT_LO` **[seen]** (0x8743, tens one tilemap row
up), BCD-converting the value for display once it is 0x0a or greater. As it nears zero it
gates the enemy AI. WARNING: this one cell is both the live countdown and the value the HUD
digit painter reads — nothing else caches the displayed stage number, so a write here is a
write to the screen next frame.

The rest of the block carries the finer round bookkeeping. `SPAWN_PHASE_COUNTER` **[seen]**
at 0x8902 cycles across a round (to 7) selecting the spawn/fire-mode branch; the round-phase
handler reseeds it and mirrors it into its snapshot `ROPE_DRAW_COUNT` **[seen]** (0x8934),
and the despawn tick bumps it on the specific sub-state where `PLAY_STATE_INDEX` is 4.
`WAVE_ARRIVAL_COUNTER` (0x8903) counts arrivals within the stage. `ROUND_IN_PROGRESS`
(0x8904) is simply the "a round is running" flag, raised at level start and read by the
render/state decision trees. `SPEED_INDEX` **[seen]** at 0x8900 is the enemy speed/difficulty
index that escalates as rounds advance.

`GAUGE_PHASE_COUNTER` **[seen]** at 0x8908 is a phase gauge, drawn as a five-cell vertical
HUD column that fills from `PHASE_GAUGE_BASE_TILE` **[seen]** (0x863f) upward — the renderers
at 0x03c2 / 0x2065 light `value - 1` cells, clamped to five. It behaves oppositely at its two
ends. It *fills* on scoring milestones: the pending-award stepper (0x18da) bumps it
(saturating at 0xff) each time the active player's score high byte reaches the queued award
threshold, then advances the award queue. It *drains* one cell per phase in the gauge-drain
sub-state (0x1a64): while a play-latch is clear that handler decrements the gauge and
repaints it, and on reaching zero it tails into the phase-exhausted handler (0x1a96), which
clears the rope segment/marker cells, advances `PLAY_STATE_INDEX`, and runs the high-score
insert-sort (0x1ab2). Between those, the gauge-drain entry re-seeds `PLAY_STATE_INDEX` to
0x0a (or 0x0b for the second player) so the drain phase repeats until the gauge empties.

### The per-player play timers

Two identical BCD play-time accumulators run, one per player: `PLAY_TIMER_BCD_P1` **[code]**
at 0x8a30 and `PLAY_TIMER_BCD_P2` **[code]** at 0x8a33. Each is a three-byte bank — the base
byte is a per-frame sub-counter, +1 is the BCD seconds digit, +2 is the BCD minutes digit.

The tick (0x7912), run at the very top of every in-play frame, first bails if
`GAME_ACTIVE_FLAG` is clear. It then selects the pair belonging to the active player through
`ACTIVE_PLAYER` **[seen]** at 0x880d: player 0 gets gate 0x89e1 with counter 0x8a30, player 1
gets gate 0x89e2 with counter 0x8a33. Before touching the counter it checks that player's
gate byte — `PLAY_TIMER_GATE_P1` **[code]** (0x89e1) or `PLAY_TIMER_GATE_P2` **[code]**
(0x89e2) — and bails if it is set. The gate is the pause switch: a nonzero gate freezes that
player's clock (both gates and both banks are zeroed at each board reset). Otherwise the
frame sub-counter advances and, at its roll, BCD-carries into seconds and then minutes.

WARNING: two readings here are counterintuitive. The sub-counter's roll point is 0x3b or
0x3c, chosen by bit 0 of the current seconds byte, so the accumulator alternates a 60- and
61-frame "second" rather than using a fixed period. And the timer counts *up* — it is a
running record of elapsed play time, not a countdown that can end the game. The seconds
digit's low nibble rolls at 0x0a and its high nibble at 0x60 (true base-60 seconds); minutes
carry the same way.

The accumulated time is drawn by the render handler at 0x7960, also run inside the in-play
frame. It splits the active player's minutes and seconds BCD bytes into hi/lo nibble tiles up
the video column at `PLAY_TIMER_DIGIT_VRAM` **[code]** (0x862d), parted by a spacer tile,
then clears those three timer bytes — so on-screen the figure is redrawn from a bank the
render itself has just zeroed. (This same handler carries integrity checksums around the
render; those belong to the anti-tamper story.) When a game ends, the player's final time is
copied into the parallel high-score time side-table by the insert-sort (0x1ab2), which is why
a scoreboard entry carries a play time beside its score.

### Board reset and the game-over turnaround

A new board is set up by `loc_0e00`. It zeroes the entire 0x8900-page state region in one
sweep — 0xbf bytes from 0x8900, which takes down `SPEED_INDEX`, `STAGE_COUNTDOWN`, the
spawn/wave counters, `ROUND_IN_PROGRESS`, `ROUND_COUNTER`, `GAUGE_PHASE_COUNTER` and the rest
at once — and separately clears `PLAY_STATE_INDEX` and both play-timer gates. It then seeds
both players' lives, `PLAYER0_LIVES` **[seen]** (0x8948) and `PLAYER1_LIVES` **[seen]**
(0x8988), from the cabinet lives byte `LIVES_DSW` **[code]** (0x8807), gives each its opening
X and colour, and — only when the game is active — clears the launch/formation flags.

When play ends, the state-3 driver's post-dispatch continuation (0x15d1) governs the
turnaround. While `GAME_ACTIVE_FLAG` is still set it simply returns, leaving the game running.
Once that flag is clear (game over) and a credit remains and the cabinet is not on free play,
it forces `MAIN_GAME_STATE` back to 2 and `PLAY_STATE_INDEX` to 0, runs the board/HUD reset,
and blanks an eight-tile column — handing the machine back to the board-build state to start
the next game. That closes the loop: fill (0) -> attract (1) -> board build (2) -> play (3)
-> back to board build (2) for the next credit.
## The actor arena

Every moving thing in Pooyan — the player, the wolves that ride the elevators, the arrows and meat and stones in flight, the eagle waves of the bonus stage — lives as a fixed-length record in one contiguous bank of work RAM. The bank begins at `ACTOR_TABLE` **[seen]** (0x8a80) and is carved into 24-byte (0x18) records on a uniform stride. Slot 0 is the player/lead actor; `LEAD_ACTOR_STATE` **[seen]** (0x8a82) is that record's phase byte, and `PLAYER_Y` **[seen]** (0x8a84) its vertical position, from which the elevator carries the hunter up and down. The rest of the bank is a landscape of sub-tables, each a run of the same 24-byte records reached at a fixed address: the enemy/eagle records at `ENEMY_ACTOR_TABLE` **[seen]** (0x8ae0), the secondary sprite-object pool at `SPRITE_OBJECT_TABLE` **[seen]** (0x8b70), the six per-frame object records at `OBJECT_STATE_RECORD_BASE` **[code]** (0x8ba0), the projectile records at `PROJECTILE_TABLE` **[seen]** (0x8be8), the four-slot `FORMATION_TABLE` **[seen]** (0x8c30), the three-slot `SPAWN_OBJECT_TABLE` **[seen]** (0x8c48), the six-slot `HUNTER_TABLE_BASE` **[code]** (0x8c78, scanned downward), and the two-record I-parity target pair `ENEMY_TARGET_REC0` **[seen]** / `ENEMY_TARGET_REC1` **[seen]** (0x8c90, 0x8ca8). These are not separate structures — they are windows into one arena of identically-shaped records.

That uniform shape is the key to reading the whole subsystem, but it comes with a warning: the 24-byte record is a *union*, not a struct. Each state handler interprets the fields in the way its own kind of object needs, and the same offset means different things to different handlers. Reliably across the arena, the first two bytes (+0x00 / +0x01) hold the active/mode flags — a record is "live" when bit 0 of one of them is set — and +0x02 is the state/phase index that selects which handler runs. Beyond that the reuse is heavy: +0x03/+0x04/+0x05/+0x06 are a two-axis 16-bit position (fraction and integer row for each axis), +0x09 is usually a signed per-frame velocity or step (with its two's-complement negation cached at +0x0a), +0x0c:+0x0d is a 16-bit animation-sequence pointer with the frame-hold counter at +0x0e, +0x0f/+0x10 receive the colour and tile the animation stream emits, and +0x11 is a dwell/phase down-counter. But +0x12, for instance, is a 0xff opening marker to the record-seeder, a waypoint-script pointer to the in-flight mover, and an animation-hold timer to the hold-ticker — same byte, three readings. A person tracing one field across the arena must follow the handler, not the offset.

**Board setup and teardown.** A fresh board begins by zeroing the arena. `clearActorArena` (0x19bc) wipes a 0x200-byte block from `ACTOR_TABLE` — the player record, the enemy sub-array, and everything past it — so no stale actor state survives into a new board. The teardown counterpart `clearActorArenaAndCounters` (0x2ae8) is the state-7 handler: it clears a 0x241-byte span from the same base, resets the spawn/wave/rope tallies (`SPAWN_PHASE_COUNTER`, `WAVE_ARRIVAL_COUNTER` **[seen]**, `ROPE_SEGMENT_COUNT`), and forces the in-play sub-state `PLAY_STATE_INDEX` to 6, handing control on to the next phase. Individual records are torn down in place by `loc_221e` (blank the 0x18-byte record at IY to zero) and `loc_3553` (blank a 0x17-byte sprite band from IX); both simply drive the shared run-fill helper across the record.

**The per-frame state dispatch.** The heart of the arena is a small family of sweeps that walk a table and hand each live record to a state machine. The main one iterates six records of stride 0x18 from `OBJECT_STATE_RECORD_BASE` (0x8ba0), calling `dispatchActiveObjectState` (0x7707) on each. That routine skips any record whose +0x00/+0x01 both have bit 0 clear (inactive — nothing to service), and for a live record it takes the low two bits of the state byte (+0x02)&3 and tail-hands off to one of four handlers. State 0 (0x771d) *arms a new object*: it counts a frame timer at +0x11 down, and on expiry pulls the next spawn index from a ring counter, records it at +0x13, looks up a word from a spawn table into +0x15/+0x16, seeds the velocity byte at +0x0a, then bumps the state and falls straight into state 1 so the just-armed object also moves this frame. State 1 (0x7740) *advances* the object: it steps the animation, integrates the signed speed (+0x0a) into the sub-position with a borrow into +0x04, and once the object crosses into the next cell it advances the state, reloads the frame timer to 0x18, and queues an effect. State 2 (0x7790) *draws* the object twice (once at its screen pointer, once a row above) and then falls through into the record-clear path. Each handler returns straight to the sweep's continuation.

The same dispatch shape recurs for the other object kinds. The fountain/object dispatcher `loc_64fb` (0x64fb) selects among three handlers by the full state byte at +0x02 (0/1/2). The 0x8b28 enemy record — a single record 0x48 bytes into the enemy sub-array — is serviced by a gated dispatcher (0x6822) that returns immediately unless `ENEMY_REC_DISPATCH_GATE` **[code]** (0x8afa) is non-zero, then dispatches its state byte through a three-entry table (0x683a / 0x6857 / board-clear check). And the object-state handlers themselves form a rich set: `loc_683a` advances a record to its next state (bump the phase, zero the sub-position, seat fixed field values, arm an animation from `ANIM_PARAM_68EF` **[code]**); `loc_4103` and `loc_4350` are per-object frame steps that animate then count a dwell timer down before advancing; `loc_67a0`, `loc_672a` and `loc_69c6` are descent steppers; `loc_3e9c` is the in-flight mover.

**Motion.** The arena's movers are small, self-contained steppers that each own one record's kinematics. `advanceFallStep` (0x3fd5) treats the vertical position as 16-bit fixed point — fraction at +0x03, integer row at +0x04 — adding the fall velocity (+0x09) into the fraction and carrying one whole row on an 8-bit overflow; it reports (via carry) whether the actor is still above the landing row 0x1e. `advanceRisingActorStep` (0x2ab3) is its mirror for a rising actor: it reloads a short delay, flips the display tile between 0x15 and 0x1e every fourth frame, drives the rise upward, and on reaching the top (0xc0) nudges the base Y and advances the state with a long inter-state delay. `advanceActorDropStateOnDelay` (0x24db) counts the delay at +0x11 down and only at zero nudges the actor down, restamps its tile, reseeds the delay to 0x30, and advances the state. `loc_667c` advances an idle actor's sub-position and retires the record at the top row (0x1d) by forcing its state to 2 and clearing its position. `loc_2a32` is the state-3 handler: it flips the tile every fourth frame, advances the 16-bit position by a fixed step, and fires milestone display commands as the high byte passes 0x52 and 0x64. `loc_3e9c` moves a spawned object either along a dx/dy waypoint script (a 0xee lead byte is a "rewind here" loop marker) or in free flight with optional homing toward a target, landing when it crosses the gate and flipping into the landing state via `LANDING_ANIM_SEQ_40B4` **[code]**. `loc_69c6` steps a *paired* ix/iy descending object, lowering both records' positions together and retiring both (0x18-byte wipe each) when the ix high byte reaches zero.

The eagle wave has its own movers. Its records are walked out of the 0x8ae0 table — the driver at 0x72a7 runs `2 * WAVE_INDEX` **[seen]** records once the wave is launched. `loc_733c` is the approach/arrival test: an eagle "arrives" at a record's grid slot when its column (`EAGLE_X_COORD` **[code]** >> 3) matches the record's target column (+0x06) or the one just before it, and its row (`EAGLE_Y_COORD` **[code]** >> 3, +4) falls inside a five-row window above the record's target row (+0x04). On arrival it advances the state and arms an animation, choosing between `EAGLE_ODD_RECORD_ANIM` **[code]** and `EAGLE_EVEN_RECORD_ANIM` **[code]** by bit 3 of the record's low address; the even records also bump `WAVE_RECORDS_ARRIVED` **[seen]** and, once the whole wave has arrived, queue the wave-arrival command (`WAVE_ARRIVAL_CMD_BASE` **[code]** offset by the count). `loc_7395` then integrates the record's vertical position by its speed — even records dive (advance state at the bottom row 0x1d), odd records climb (advance state below the top row 0x04). The wave's end-of-phase reset, `advanceEaglePhaseAndClearAim` (0x7292), drops the player aim flags in `PLAYER_AIM_FLAGS` **[code]** (0x8a87) and the latched enemy X in `LATCHED_ENEMY_X` **[seen]** (0x8f5b), steps the eagle-wave outer phase, and clears the arrived count.

**Animation stepping.** An actor is pointed at an animation by `setActorAnimation` (0x381e) or its sibling `storeActorAnimationPointer` (0x5c75): both write a 16-bit sequence pointer little-endian into +0x0c:+0x0d and reset the frame index at +0x0e to zero, restarting the stream. The stream is then walked frame by frame by `advanceActorAnimFrame` (0x403c) and its twin `loc_4006` (called by nearly every object-state handler). The frame-hold counter at +0x0e is a countdown: while it is non-zero the current frame simply holds. At zero the walker reads the byte the +0x0c:+0x0d pointer addresses — a 0xff opcode reloads that pointer from the next two stream bytes (a jump within the sequence) and re-reads, and any other byte begins a three-byte frame record whose bytes land at +0x10 (tile), +0x0f (colour/attribute) and +0x0e (the new hold), after which the advanced pointer is stored back. The ROM supplies the sequences: `ANIM_TABLE_3829` **[code]**, `ANIM_TABLE_3838` **[code]**, the turn scripts `ANIM_SCRIPT_4203` **[code]** and `ANIM_SCRIPT_4212` **[code]**, `ANIM_PARAM_68EF`, `RECORD_ANIM_SEQ_2CA7` **[code]** and the eagle sequences; the specific on-screen animations they encode are read from the sequence data but not otherwise pinned down.

A second, shared animation channel runs off a single global cursor. `loc_22b1` (0x22b1) steps four actor records one stride apart from `ACTOR_TABLE` through `loc_22e6` (0x22e6), unless a rope grab is in progress (`GRAB_ACTIVE_FLAG` **[seen]** set), in which case the whole pass is skipped. `loc_22e6` reads a {tile, colour, delay} triple from the shared `ANIM_SCRIPT_CURSOR` **[seen]** (0x8f00), copies it into the record, and advances the cursor; a 0xff lead byte is a control marker whose two following bytes replace the cursor (an inline jump). There is a rival full-reset arm — resetting the cursor to `ANIM_SCRIPT_RESET_PTR` **[code]** (0x26e7) — but it fires only when `foldTargetPresenceBits` (0x22d0) returns 3, and that fold seeds zero and is only ever rotate-shifted, so it never reaches 3: the marker always resolves as the inline jump. Separately, `tickActorAnimHold` (0x5d1e) runs a per-record hold countdown at +0x12, stepping a two-bit phase at +0x13 and disarming at phase end; `loc_5d0b` (0x5d0b) drives it across all six records of the enemy actor table.

**Spawning and seeding.** New records are stamped by a small set of seeders. `initActorRecord` (0x619f) writes the fixed opening constants (+0x00=0, +0x01=1, +0x02=8), the 0xff marker at +0x12, and a 16-bit datum at +0x16:+0x17. `seedObjectRecord` (0x0a0c) fills a record from a two-byte descriptor and a two-byte coordinate stream and clears the frame timer. `loc_6523` (0x6523) seats a fresh object record — bailing on an odd id word or while `SIGNATURE_MISMATCH_FLAG` **[code]** (0x8ef0) is held — then snapshots `SHARED_FRAME_DELAY_TIMER` **[code]** (0x8929) into +0x06, steps that shared timer down by two, and enqueues `OBJECT_SPAWN_DISPLAY_CMD` **[code]** (0x0611), plus `OBJECT_SPAWN_DISPLAY_CMD_ALT` **[code]** (0x0607) when `ROUND_COUNTER` **[seen]** (0x8907) is zero. `stampObjectAndDecCounter` (0x57e5) reads a control byte, decrements a shared counter in place, and stamps two fixed state bytes (+0x13, +0x16) into a record. The formation spawn `loc_53b0` (0x53b0) is one-shot and triply gated — a non-zero descriptor, a clear `SPAWN_LATCH` **[code]** (0x8d59), and `FRAME_COUNTER` **[seen]** (0x8a5f) at its zero crossing — and on firing it latches the spawn, fills the `FORMATION_TABLE` record (a field byte from `SPAWN_FIELD_TABLE` **[code]** and its negation, fixed state/phase bytes, an armed turn animation), and derives the spawn speed from the round counter (halved, +1, clamped to 6) through `SPAWN_SPEED_INDEX` **[code]** into `SPAWN_SPEED_VALUE` **[code]** via `SPAWN_SPEED_TABLE` **[code]**. `adjustSpawnColumn` (0x57b4) nudges the spawn-column index by wave progress (`WAVE_PROGRESS_COUNTER` **[seen]**) only in the early stages, while `STAGE_COUNTDOWN` **[seen]** is still low.

An actor's colour/attribute byte at +0x08 is built by `loc_36de` (0x36de): it indexes `ACTOR_ATTR_BASE_TABLE` **[code]** by `2*DIFFICULTY_DSW` **[code]** plus the clamped round, steps that base value down past the record's armed-gate flags (+0x16, +0x13) and its phase (+0x06), biases it up by 3 when the stage countdown is nearly out, and ORs the value looked up from `ACTOR_ATTR_MERGE_TABLE` **[code]** into +0x08. The turn animations are armed by `loc_425c` and `loc_423a`, which set or clear `TURN_COLUMN_LIMIT` **[seen]** (0x8d4b) and point the record at its turn script; `loc_141c` / `loc_1389` gate an actor's spawn/queue step on its phase and flag byte before re-arming its animation.

**Collision and retirement.** Shots are hit-tested against objects by the proximity scan at 0x6435. It picks its target and object tables by `PLAY_MODE_LATCH` **[code]** (0x8f50) — one player's set scans the `SPAWN_OBJECT_TABLE` against the target slots, the other scans the `PROJECTILE_TABLE` against `SPRITE_TARGET_SLOTS` **[seen]** (0x887c) — then walks three object slots (stride 0x18). An object is a hit when it is active and lies within ±7 of the scanning actor in both X and Y, using an X bias that depends on `FLIP_SCREEN_FLAG` **[seen]** (0x881f). On a hit the object is reset (bytes 0/1/2 cleared, +0x11 reseeded to 0x20), a one-frame hit flag is raised — `OBJ_HIT_FLAG_I0` **[seen]** (0x8d1b) or `OBJ_HIT_FLAG_I1` **[seen]** (0x8d1c), chosen by an I-parity slot index rather than by the player — effects are queued, and the running `HIT_TALLY` **[code]** (0x8f52) is bumped for the end-of-level bonus. The struck object is then dismantled the following frame by `loc_21cf`, which consumes a per-object timer cell and falls into the 0x221e record-clear. On the display side, the player is drawn as three stacked sprites: `deriveStackedSpriteYs` (0x23d7) fans `PLAYER_Y` out into the Y fields of arena slots 3/2/1 (base Y, Y−0x10, and 0x0a below that). `precheckCollisionBounds` (0x5f53) is the shared off-screen gate — it biases an actor's X by the flip flag and reports whether its Y+8 still clears the bottom limit 0xe0.

Two anti-tamper tripwires are woven directly into the object update, firing on the frame-counter zero crossing so they cost nothing most frames: the state-1 object handler folds a five-byte ROM guard and bumps a strike counter on a miss, and `loc_4103` folds the low nibbles of `TAMPER_NIBBLE_SUM_BLOCK` **[code]** (0x557f) and bumps `TAMPER_STRIKES_SIG` **[code]** (0x8a38) unless the running total matches its sentinel. They mutate no actor state — a clean image simply falls through them.
## Waves, rope and launch

Three cooperating state machines run the attack side of the board: the eagle attack
wave that seeds and flies a batch of enemy records, the arrow/launch machine that arms
a shot and spawns hunters from it, and the rope that grows a column of cells down the
screen and animates each one through its life. They share a common vocabulary of small
work-RAM cells — a state selector, a hold timer, an index, a done latch — and they hand
control to one another through the wave counters they all read.

### The eagle attack wave

The wave driver runs once per frame. While the launch flag `WAVE_LAUNCH_FLAG` [code]
(0x8f3a) is still clear it seeds a fresh wave and returns; once a wave is up it either
falls through to the inter-wave idle handler (when the live record count has drained) or
walks the active records and steps each one's own approach machine.

Seeding a wave only happens while the target slot `ENEMY_TARGET_REC0` [seen] (0x8c90) is
clear. When it is, the seeder raises `WAVE_LAUNCH_FLAG` and bumps the wave index
`WAVE_INDEX` [seen] (0x8f3d). The fourth wave is special: rather than laying down new
records it just advances the outer-phase counter `WAVE_OUTER_PHASE` [code] (0x8f38) and
reloads the inter-wave hold `WAVE_HOLD_TIMER` [seen] (0x8f36) to 0x20. Every other wave
lays down two records per wave index into the enemy-actor table `ENEMY_ACTOR_TABLE`
[seen] (0x8ae0), stepping by the 0x18 record stride and copying four fields per record
out of the four-byte-per-record parameter table `EAGLE_WAVE_PARAM_TABLE` [code] (0x7409):
the target column (+6), a tile id (+0x10), the target row (+4) and a speed (+0x0f). Each
record is stamped active (state 1), a fixed flag byte lands in field +5 (and also +3 for
records whose own low address has bit 3 set — the odd/even split that recurs everywhere
below), and the record count `WAVE_RECORD_COUNT` [code] (0x8f3c) is set to twice the wave
index. Finally the outer phase and the records-arrived count `WAVE_RECORDS_ARRIVED`
[seen] (0x8f39) are cleared so the new wave starts fresh.

With records laid down, the driver walks `WAVE_RECORD_COUNT` of them and runs a small
per-record state machine on each. An arriving record (its approach state) is handled by
gating the eagle's live position against the record's grid slot: the live column
`EAGLE_X_COORD` [code] (0x8c96) shifted right by three must equal the record's target
column (+6) or the one just before it, and the live row `EAGLE_Y_COORD` [code] (0x8c94)
shifted right by three plus four must sit inside a five-row window above the record's
target row (+4). Only on a match does the record advance and arm an animation: odd
records (bit 3 of the record's low byte) take the odd animation descriptor
`EAGLE_ODD_RECORD_ANIM` [code] (0x7403) and a 0x38 field; even records take
`EAGLE_EVEN_RECORD_ANIM` [code] (0x4086), a 0x40 field, bump `WAVE_RECORDS_ARRIVED`, and —
once the arrived count has reached the wave index, meaning every record of the wave is
home — queue the wave-arrival display command whose base is `WAVE_ARRIVAL_CMD_BASE`
[code] (0x0630) offset by the arrived count.

A record that has arrived then flies its dive-or-climb leg. Each frame it advances its
animation and integrates a 16-bit vertical position by the per-record speed (+9). Even
records descend — the speed is added, a carry drops the sprite one row (+4), and reaching
the bottom row (0x1d) advances the record's state byte; odd records climb — the speed is
subtracted, a borrow lifts the row, and rising above the top row (0x04) advances the
state. Once a record reaches its retire state it is zero-filled across its whole 0x18
bytes and the live record count is decremented; when that count hits zero the last member
of the wave has retired, and the retire handler seeds the inter-wave hold to 0x30.

The inter-wave idle handler drains `WAVE_HOLD_TIMER` a step per frame. On expiry, if a
wave index is still set it enqueues a command carrying that index (opcode 0x06, parameter
0xb0 + index — the wave sound), then reseeds the hold to 0x18 and drops `WAVE_LAUNCH_FLAG`
so the driver seeds the next wave. The bonus-stage teardown is a heavier version of the
same shape: it holds on `WAVE_HOLD_TIMER`, and on expiry zeroes the nine-byte wave/phase
block and the 0x48-byte enemy-record region, clears the play sub-state and the latched
enemy X, and sets the attract sub-state selector to 7 to hand control back out of the
bonus stage.

### The eagle approach and grid marker

Running alongside the record machine is the approach/aim machine, also once per frame and
also hold-gated on `WAVE_HOLD_TIMER`: while the hold is nonzero it just ticks down. Once
released it drives the player aim-indicator flags `PLAYER_AIM_FLAGS` [code] (0x8a87) from
the eagle's approach coordinate against two X thresholds — a near threshold of 0x59 and a
far threshold of 0x60. Past the far threshold it captures the coordinate into
`LATCHED_ENEMY_X` [seen] (0x8f5b); once latched the flags read on-target, otherwise below.
When the coordinate sits exactly at the near threshold it steps a sub-phase held in
`WAVE_RECORDS_ARRIVED`: 0 becomes 1 with the aim cleared, anything else becomes 2 with the
aim armed, and 2 runs the grid-marker step.

> Note: the approach machine reads the coordinate it compares against 0x59/0x60 out of
> `PLAYER_Y` [seen] (0x8a84) — the same cell that elsewhere is the player-actor's vertical
> position, here serving as the eagle's advancing approach value. The rope-grab test below
> reads the same 0x8a84 cell as a horizontal catch position. The reading is by cell, not by
> a label, so do not assume "player Y" means only the player in this machinery.

The grid-marker step advances every eighth frame, gated by the low three bits of the tick
counter `EAGLE_GRID_STEP_TICK` [code] (0x8f3b). It walks a marker tile (code 0x2c) across
a grid anchored at `EAGLE_GRID_VRAM_BASE` [code] (0x87e0), stepping up by one tilemap row
per unit of one grid coordinate and right by the other, and stamps a colour attribute one
0x400-cell back from the tile derived from the low bits of the two grid coordinates
(held in the target record's +6 and +4 fields). A grid-edge guard reads the advancing
grid coordinate (target record +4): while it is short of the edge (0xd0) it just hands the
coordinate back so the marker keeps stepping; once it reaches the edge it arms the
grid-advance done latch `EAGLE_FINISH_FLAG` [code] (0x8f3e) and runs the phase-reset
epilogue. That epilogue drops the aim flags, clears `LATCHED_ENEMY_X`, advances the outer
phase, and clears `WAVE_RECORDS_ARRIVED` — so once the done latch is set the whole approach
machine short-circuits to the epilogue on its next entry.

### The arrow / launch state machine

The launch machine is a five-state selector held in `LAUNCH_STATE` [seen] (0x8f30); its
per-frame driver masks the low three bits and vectors to the matching handler (states 0..4,
with 4 a bare no-op idle). It builds around the arrow's climbing height `ARROW_Y` [code]
(0x8ab4) — the Y of the launch object (slot 2, field +4).

State 0 arms the shot. If the arm flag `LAUNCH_ARMED_FLAG` [seen] (0x8f3f) is still clear
it arms it one of two ways: when the lane-spawn countdown `LANE_SPAWN_COUNTDOWN` [seen]
(0x8d75) is up and the arm latch `LAUNCH_ARM_LATCH` [seen] (0x8f20) is still clear it bumps
the latch (blocking a re-arm), otherwise it requires the stage countdown `STAGE_COUNTDOWN`
[seen] (0x8901) to be nonzero and a multiple of eight; either way it then sets
`LAUNCH_ARMED_FLAG`. It then gates: the arrow must have risen to at least 0x3c and neither
target record `ENEMY_TARGET_REC0` / `ENEMY_TARGET_REC1` [seen] (0x8c90 / 0x8ca8) may have
its hit bit (0x02) set. Clearing those gates, it advances the state, reseeds a tile-flip
countdown, may light the launch HUD cell `LAUNCH_HUD_TILE` [code] (0x8508) with tile 0x6f
while the game is idle, refreshes the arm latch from its seed `LAUNCH_ARM_LATCH_SEED`
[code] (0x8d7a) when that is nonzero, and blits the 2x2 launch tile from `LAUNCH_TILE_SRC`
[code] (0x2d51) to `LAUNCH_TILE_VRAM` [code] (0x84a7).

State 1 is the rising-arrow handler. Below arrow height 0x34 it runs a tile-flip animation:
it decrements the flip countdown `LAUNCH_FLIP_COUNTDOWN` [code] (0x892f), and each time
that reaches zero it reloads it to 0x10, bumps the parity byte `SHARED_PHASE_COUNTDOWN`
[code] (0x892e), and blits one of two ROM tile blocks (0x2d51 or 0x2d55) selected by that
parity's bit 0. Once the arrow has risen to 0x34 it instead scans the two-entry target
pair at 0x8c90 for a free slot; finding one, it advances to state 2, marks the slot,
blits, optionally lights the HUD tile, and seeds a target record (0x8a99 = 1, 0x8a9e from
the player field 0x8a86 + 0x0c, 0x8aa7 = 0x10). With no free slot it simply returns and
retries next frame.

State 2 spawns a hunter. Unless the play-mode latch `PLAY_MODE_LATCH` [code] (0x8f50) is
set, it scans the six-slot hunter table `HUNTER_TABLE_BASE` [code] (0x8c78) downward one
stride at a time for the first slot whose two leading bytes are both zero; with no free
slot it bails untouched. A free slot is stamped with a fixed opening record — state 5,
coordinates and tile ids — and its address is saved into the record pointer
`HUNTER_RECORD_PTR` [code] (0x8f32). It then advances the launch state and branches on the
flip flag `HUNTER_SPAWN_FLIP_FLAG` [code] (0x8f61): with the flag clear it seeds the spawn
countdown `HUNTER_SPAWN_COUNTDOWN` [code] (0x8f34) to 0x20 and enqueues the spawn display
command `HUNTER_SPAWN_DISPLAY_CMD` [code] (0x0315); with it set it instead bumps the
sub-counter `HUNTER_SPAWN_SUBCOUNTER` [code] (0x8f5d).

State 3 is a hold-and-clear. While `HUNTER_SPAWN_COUNTDOWN` is nonzero it just decrements
and returns; on expiry it advances the launch state and, unless `PLAY_MODE_LATCH` is set,
zero-fills the whole 0x18-byte record addressed by `HUNTER_RECORD_PTR`. State 4 is the
phantom idle — a bare return — where the machine rests until it is re-armed.

### The enemy formation and its teardown

A separate formation manager gathers launch-ready enemies and later tears the wave down.
It aborts unless its enable cell (0x8f04) is set. While the formation state
`FORMATION_STATE` [seen] (0x8f08) is zero it scans the seventeen records at 0x8ae0 for a
launch-ready one (state 0 or 5 with field +1 clear), registers each one's pointer into the
formation slot table `FORMATION_SLOT_TABLE` [seen] (0x8920) two bytes at a time, and marks
it state 5; once the slot table has filled it arms `FORMATION_STATE` to 1 (with a companion
countdown of 0x20 in 0x8f09). Once the formation state is nonzero the manager vectors on
(state & 3) − 1 into its own handlers and then always runs the shared teardown epilogue.

That epilogue is keyed on the teardown state `WAVE_TEARDOWN_STATE` [seen] (0x8f24), which
runs in lockstep with the formation. State 1 tears the wave down: it clears the periodic-
event latch `WAVE_EVENT_LATCH` [seen] (0x8d21) and its companion timer, runs a cleanup,
advances the teardown state, and re-checks the wave-build code's checksum against a
sentinel (diverting to the anti-tamper guard on a miss). State 2 walks the boss actor
down: it steps the boss coordinate (0x8a84) two units per frame, running a mover until the
coordinate passes 0xdb, at which point it runs a settle routine, sets a completion flag
`GRAB_ACTIVE_FLAG` [seen] (0x8d32), and advances the teardown state. State 3 and above
simply return. Because both `WAVE_TEARDOWN_STATE` and `FORMATION_STATE` read as "busy"
whenever nonzero, they are exactly the cells the rope-grab test consults before it will
fire (below).

### The rope: extend, animate, grab, retract

The rope is drawn segment by segment down a column by a two-state extend driver held in
`ROPE_EXTEND_STATE` [code] (0x8f14). Its state 0 adds one segment. It returns at once once
the rope has grown to two below the stage's arrival count — the segment count
`ROPE_SEGMENT_COUNT` [seen] (0x8931) equals `WAVE_ARRIVAL_COUNTER` [seen] (0x8903) minus
two, the per-stage length bound. Otherwise it bumps `ROPE_SEGMENT_COUNT` and, while the
extend index `ROPE_EXTEND_INDEX` [code] (0x8f18) is below four (above that it needs a
pending tamper strike to continue), advances that index, looks the segment's video-column
low byte up from the four-byte column table `ROPE_CELL_COLUMN_TABLE` [code] (0x2db8),
combines it with the fixed video page 0x84 into the column pointer `ROPE_COLUMN_VRAM_PTR`
[code] (0x8f19), reloads this segment's cell timer inside the four-entry timer block
`ROPE_CELL_TIMERS` [code] (0x8f28) (one timer per counted segment, stride 2, reload 0x10),
advances the sub-state, and arms the extend sub-timer `ROPE_EXTEND_TIMER` [code] (0x8f16)
to 0x10.

State 1 is the extend blitter. It holds on `ROPE_EXTEND_TIMER`; on expiry it reloads that
to 8 and consults a per-cell frame index (0x8f1b): once that index has counted to 8 the
segment is fully drawn, so it resets the index and re-arms the next rope cell (derived from
`ROPE_EXTEND_STATE` and `ROPE_EXTEND_INDEX`); otherwise it looks up the next tile block
and blits it at `ROPE_COLUMN_VRAM_PTR`, bumping the frame index. So each segment paints in
over eight frames before the driver moves to the next. A snapshot count `ROPE_DRAW_COUNT`
[seen] (0x8934), reseeded to 4 alongside the spawn-phase counter at board reset, tracks the
rope's sprite rows.

Once cells exist, a separate per-cell state machine animates each one through its life. A
cell whose state byte (field +0) is zero is inactive and skipped; otherwise (state − 1)
selects one of four handlers, and every handler is paced by that cell's timer inside
`ROPE_CELL_TIMERS`, decremented in place and read back through its zero flag so the handler
returns early until the timer elapses. Cell state 1 is additionally gated on the low two
bits of the free-running frame counter `FRAME_COUNTER` [seen] (0x8a5f); when both fire it
re-arms the timer, finds a free slot in the three-entry bonus/spawned-object table
`SPAWN_OBJECT_TABLE` [seen] (0x8c48), seeds it (state, animation, coordinates, a field from
a small lookup keyed by the cell index), advances the cell, and blits the segment tile.
Cell state 2, on its timer, writes a tile derived from the round counter `ROUND_COUNTER`
[seen] (0x8907) into the cell, then indexes the formation table `FORMATION_TABLE` [seen]
(0x8c30) to bump the paired record's tile and clear its low position byte before advancing
the cell and blitting.

Cell state 3 is where a catch can happen. It first runs the rope-grab trigger, which looks
up a catch-window half-width keyed by the cell index and compares it against a window
around the player position (0x8a84) − 7. If the player is outside the window it returns
normally and the cell continues; if the player is inside — and only when neither
`WAVE_TEARDOWN_STATE` nor `FORMATION_STATE` is busy — it fires the grab: it sets the
grab-active latch `GRAB_ACTIVE_FLAG` (0x8d32) to 1, runs the grab routine, and aborts the
rest of the cell handler. That latch is the same one other systems consult to freeze the
board while a grab is in progress — the animation walker skips its script step and the
sound path suppresses its enqueue while it is set. When no grab fires, cell state 3
finishes by writing tile 0x0c, dropping the paired formation record's tile, setting its
low position to 0xc0, advancing the cell, and blitting.

Cell state 4 retracts the rope. On its timer, and while `ROPE_SEGMENT_COUNT` still holds
segments, it selects a retract animation pointer from a table keyed by `ROUND_COUNTER`
shifted right twice and clamped to 3 (plus the cabinet upright/cocktail bit), reads a
per-segment attribute byte indexed by `ROPE_SEGMENT_COUNT` − 1 clamped to 0x1f, merges that
attribute into the paired cell, clears the corresponding formation record, advances the
cell, and blits the shrinking segment. Draining `ROPE_SEGMENT_COUNT` this way is what
retires the rope; the board reset, when the spawn-phase counter has hit its cap, reseeds
the phase and `ROPE_DRAW_COUNT` to 4 and refills the formation slot table so the next
stage's rope starts clean.
## Rendering, HUD and display lists

Everything the player sees is assembled into two parallel byte maps on the video pages and a
pair of sprite banks. The tilemap is 32 cells wide, so one screen row is a stride of `0x20`
and "up one row" is `-0x20` throughout this code. Tile *codes* live on the `0x84xx` page from
`PLAYFIELD_TILE_BASE` (0x8402) **[code]**; the matching per-cell colour/attribute bytes live on
the `0x80xx` page from `ATTRIB_MAP_BASE` (0x8040) **[seen]**, with small fixed anchors such as
`GLYPH_BLOCK_DEST` (0x8062) **[code]** also inside that region. Sprites are double-banked at
`SPRITE0_CLEAR_BASE` (0x9010) **[code]** and `SPRITE1_CLEAR_BASE` (0x9410) **[code]**. Almost
every drawing routine here is a leaf that touches only these cells; the interesting behaviour is
in *where* it walks and *how* it decides what to stamp.

### The blit primitives

Four hand-unrolled copiers do the actual pixel-block work, and they all share the `0x20` row
stride. `blit2x2TileBlock` (0x3325) and its two siblings `paintTileBlock2x2` (0x0a40) and
`paintTileBlock2x2Above` (0x780f) each drop four consecutive source bytes into a 2x2 square,
differing only in corner order and in which corner is the anchor: `blit2x2TileBlock` writes
top-left, top-right, bottom-right (`+0x21`), bottom-left (`+0x20`) and then leaves the pointer
sitting on that bottom-left cell so a caller can chain the next block one row up; `paintTileBlock2x2`
anchors at the top-left and discards its pointer; `paintTileBlock2x2Above` anchors at the
bottom-left and reaches *up* a row for its top pair. `blitTile3x3Block` (0x3307) copies three
rows of three, stepping the destination `+0x1d` after each triple to land on the next screen row
(3 written + `0x1d` = a full `0x20`), and advances *both* the destination and the source pointer
so a caller can stamp a run of glyphs straight through. `blitGlyphBlock4x3` (0x1f8c) is the taller
cousin: four rows of three, but it advances only the destination's low byte within a row (the row
never straddles a `0x100` page) before the `+0x1d` row step.

### Columns and the row-by-row screen fill

Vertical strips are built from a cap tile plus two body tiles. `paintColumnBodyTiles` (0x02aa)
writes the mid tile `0x25` and base tile `0x20` at successive strides; `paintColumnBodyTilesUp`
(0x1cec) is the fixed `-0x20` (upward) variant; `blankTileColumn` (0x02b1) erases a three-cell
column to the blank tile `0x10`. The two composite column stampers put a cap on top of the body:
`loc_02a8` prepends cap tile `0x01` then calls the body painter, and `loc_1ce7` writes cap tile
`0x02` at `COLUMN_CAP_VRAM` (0x84e0) **[code]** then paints its body upward.

Clearing or repainting the whole playfield is a two-cell state machine over `TILE_FILL_PTR`
(0x880b) **[seen]** and `FILL_ROW_COUNTER` (0x8809) **[seen]**. `seedTileFillCursor` (0x02e6)
arms it — it stores a 16-bit write cursor and seeds the row counter to `0x20` (32 rows) — and
`loc_02e3` is the fixed-start entry that seeds the cursor at `PLAYFIELD_TILE_BASE`. Each pass,
`loc_02ce` blanks `B` cells at the cursor (through the byte-run filler `loc_0010` (0x0010), which
fills a run with a constant and treats a zero count as a full 256), then advances the cursor by
exactly one whole row — it adds the remainder `0x20 - B` after the `B` cells the fill already
moved — stores it back, decrements the row counter, and reports drained via the Z flag so the
driver can loop until the screen is done. The boot-time blank, `loc_01ea` (0x01ea), reuses the
byte filler to clear the tops of both sprite banks and then floods `0x3c0` tiles from
`VIDEO_RAM_BLANK_START` (0x8440) **[code]** with the erase tile `0x1e`.

### The colour/attribute map and its field variants

Colour is painted independently of tile codes. `fillAttributeColumns` (0x075d) floods the
attribute map from `ATTRIB_MAP_BASE`: it walks 31 columns, and for each column takes one source
byte and stamps it down all 30 rows at the row stride, so a single byte colours a whole vertical
strip. `loc_1dd3` drives it for the current stage's look. It picks between two jobs from
`ROUND_IN_PROGRESS` (0x8904) **[seen]**, `GAME_ACTIVE_FLAG` (0x8806) **[seen]**, `ROUND_COUNTER`
(0x8907) **[seen]** and `PLAY_MODE_LATCH` (0x8f50) **[code]**: the default job floods from a
round-parity source table — `FIELD_ATTRIB_SRC_A` (0x0839) **[code]** on odd rounds, else
`FIELD_ATTRIB_SRC_B` (0x0879) **[code]** — then stamps a short four-row marker in columns 5 and 6
with colour `0x0f`; the alternate job (taken only when a round is not in progress but the game is
active, on an even/zeroth round, and outside the play-mode latch) floods from `FIELD_ATTRIB_SRC_C`
(0x0859) **[code]** and stamps a taller 16-row single strip of colour `0x09` at `FIELD_C_ATTRIB_DEST`
(0x811c) **[code]**.

### Scrolling and animated tile strips

`loc_0254` is the per-frame worker that keeps the moving scroll columns fresh. Its behaviour
turns on `WORKER_CONTROL_BYTE` (0x883f) **[code]**: if the control byte's low nibble is set it
short-circuits into the program-signature check instead of drawing; otherwise, while the game is
active, it repaints two three-tile columns — four blanked columns then the shared column in
one-player mode, or a capped body column in two-player mode keyed off `TWO_PLAYER_FLAG` (0x880e)
**[seen]** — restamps the second scroll column at `WORKER_COLUMN_VRAM` (0x8740) **[code]** via
`loc_02a8`, and, when both control bit 4 and the game-active bit are set, blanks one further
column (the one chosen by `ACTIVE_PLAYER` (0x880d) **[seen]**). Every column here steps upward a
row per cell.

A separate marching strip is animated in place through `TILE_ANIM_CURSOR` (0x88be) **[seen]**, a
16-bit cursor into the `0x84xx` tilemap, gated by the parity counter `TILE_ANIM_PARITY` (0x8f37)
**[seen]**. The two halves bump the parity every call and act only on their own phase.
`advanceTileAnimForwardOnOdd` (0x2405) runs on odd frames: if the tile under the cursor has
reached the wrap code `0x37` it steps the cursor forward one cell and reseeds it with `0x34`,
otherwise it just increments the current tile code — cycling the strip forward. `retreatTileAnimScript`
(0x23ec) runs on even frames and walks it the other way: a `0x34` marker reloads the base code
`0x10` and backs the pointer up one cell, any other value is decremented in place. The net effect
is a tile strip that scrolls/cycles one direction on odd frames and unwinds on even ones.

### Glyphs, markers and the little animators

`loc_1ffb` stamps one of two fixed 3x3 glyph sources — `GLYPH_TILES_A` (0x203b) **[code]** or,
when bit 5 of its selector is set, `GLYPH_TILES_B` (0x2050) **[code]** — into the tilemap at
`GLYPH_BLOCK_DEST` via the 3x3 blitter. The round marker, `loc_4a0b`, is drawn only when
`ROUND_COUNTER`'s low bit is set: it first snapshots `SPAWN_PHASE_COUNTER` (0x8902) **[seen]**
into `SPAWN_PHASE_SNAPSHOT` (0x8d43) **[code]** and `ROPE_DRAW_COUNT` (0x8934) **[seen]**, then,
for a nonzero count, paints that many stacked pairs of a two-wide marker (tiles `0xda`/`0xdb`
over `0xd8`/`0xd9`) up a column from `MARKER_VRAM_BASE` (0x86c3) **[code]**, saves the column
layout pointer into `MARKER_LAYOUT_PTR` (0x8932) **[code]**, and stamps the marker glyph block
from `MARKER_GLYPH_SRC` (0x2754) **[code]** beneath it; a zero count saves the alternate layout
pointer and stamps the glyph at the fixed anchor.

The "ready" indicator, `loc_2bd3`, stamps a 2x2 square from `READY_SPRITE_SRC` (0x2be1) **[code]**
at `READY_SPRITE_TILE_VRAM` (0x87bb) **[code]** — but only if that anchor cell does not already
hold the painted marker tile `0xba`, so it will not redraw an already-present square. (`loc_2bd2`
is an alternate entry that discards a return byte and falls straight into it; its drawing effect
is identical.) Two small frame-gated animators cycle 2x2 blocks: `loc_2563` and `loc_6b13` each
run a hold countdown in `TWOTILE_ANIM_HOLD` (0x8f06) **[code]** — decrement and return until it
lapses, then reload `0x0c`, advance `TWOTILE_ANIM_PHASE` (0x8f07) **[code]**, pick a four-byte
source block out of `TWOTILE_SRC_TABLE` (0x2744) **[code]** by parity, and stamp it as two 2x2
squares one above the other. `loc_2563` folds in `ROUND_COUNTER` parity to choose among four
blocks and between anchors `READY_SPRITE_TILE_VRAM` and `TWOTILE_ANIM_VRAM_ALT` (0x84bb) **[code]**,
and stands down while the play-mode latch is busy; `loc_6b13` uses only the phase parity between two
adjacent blocks at `BLIT_SCREEN_ANCHOR` (0x84b4) **[code]**. `loc_0a52` is the simplest of the
family — it stamps one shared source pattern `TILE_BLOCK_2X2_SRC` (0x0a72) **[code]** into two
fixed anchors, `VRAM_TILE_BLOCK_DEST_A` (0x82aa) **[code]** and `VRAM_TILE_BLOCK_DEST_B` (0x826a)
**[code]**. Finally `loc_76af` is a two-phase blink: it counts `BLINK_COUNTDOWN` (0x892a) **[code]**
down, and on expiry reloads `0x16`, toggles `BLINK_PHASE` (0x892b) **[code]**, and writes one of
two tile pairs from `BLINK_TILE_PAIRS` (0x76e6) **[code]** into `BLINK_TILE_CELL_0` (0x8471)
**[code]** and the cell `0x40` below it, swapping the blinking tiles.

### Turning numbers into digit tiles

The HUD renders packed-BCD counters as columns of digit tiles, and a handful of primitives do the
nibble work. `splitBcdByte` (0x0429) writes a byte's low nibble as a tile at the cursor, advances
the cursor by a caller-supplied stride, and hands back the high nibble (a zero high nibble is the
leading-zero signal). `renderDigitWithBlanking` (0x059d) paints one digit while suppressing
leading zeros through a running blank budget: a nonzero digit prints as-is and ends the blank run,
a zero prints the blank tile `0x10` while budget remains (spending one), or a genuine `0` once the
budget is gone. `drawStackedBcdDigits` (0x1119) draws a whole packed byte as two vertically
stacked tiles — tens at the cursor, units one row up — with the tens leading zero blanked. Binary
counts are converted first: `byteToPackedBcd` (0x062a) turns a byte into packed BCD (value mod 100)
by reproducing the Z80 `daa` correction exactly, and `binToPackedBcd` (0x1131) counts up in BCD to
produce the low two decimal digits plus a hundreds tally.

### Scores and the high-score table

`selectActivePlayerScoreBuffer` (0x04f2) resolves which 3-byte BCD score buffer is live — bit 0 of
`ACTIVE_PLAYER` picks `P1_SCORE_BCD` (0x88a2) **[seen]** or `P2_SCORE_BCD` (0x88a5) **[seen]**.
`loc_056b` draws any one of the three counters (player 1, player 2, or the top score's high byte
`HIGH_SCORE_BCD_HI` (0x88aa) **[seen]**) down its screen column — `P1_SCORE_VRAM` (0x8781) **[code]**,
`P2_SCORE_VRAM` (0x8521) **[code]** or `HIGH_SCORE_VRAM` (0x8641) **[code]** — splitting each of its
three bytes into high-then-low digits up the column with a shared blank budget of 4. `loc_0552`
is the reset twin: it zeroes the selected counter's three bytes and repaints the column, so the
first four digits show as blanks and the last two as zeros.

Score accrual is `loc_0496`. Running only while the game-active bit is set, it chooses a 3-byte BCD
increment — the per-frame trickle `PER_FRAME_SCORE_INCREMENT` (0x88ab) **[code]** when the award
index is 0, otherwise a stride-3 entry out of `SCORE_AWARD_TABLE` (0x0501) **[code]** — BCD-adds it
into the active player's buffer with carry chained LSB-first, repaints that player's score column,
then compares the buffer MSB-first against the live high score `HIGH_SCORE_BCD` (0x88a8) **[code]**;
a strictly greater buffer is copied over the high score and its column repainted. When a game ends,
`loc_1ab2` inserts the finished player's score into the sorted ten-entry high-score table
`HIGH_SCORE_TABLE` (0x8a00) **[code]** — ten 3-byte packed-BCD scores ranked high to low. It scans
MSB-first for the first slot the score reaches or beats, and if it beats none it returns; otherwise
it records the winning rank in `HIGH_SCORE_INSERT_RANK` (0x89fc) **[code]**, opens a slot by an
overlap-safe descending shift of the tail, and writes the score in. Two parallel side tables ride
along: the per-entry play-time pair `HIGH_SCORE_TIME_TABLE` (0x89e0) **[code]** is shifted and the
new play-time copied from the active timer bank (`PLAY_TIMER_BCD_P1`/`P2`, with its gate
`PLAY_TIMER_GATE_P1`/`P2` set), and the display-tile side table `PANEL_TILE_SOURCE` (0x8e00)
**[code]** is shifted and the new entry's three cells blanked to `0x10`.

### Character fields and the status panels

`loc_05b2` is the general character-field renderer. Its selector's low seven bits (doubled) index
the pointer table `FIELD_RECORD_PTR_TABLE` (0x7a0d) **[code]**, whose entry heads a list of records;
each record is a two-byte destination address followed by an inline string, drawn one tile-row *up*
per character. Bit 7 of the selector chooses the mode: clear renders each character as a digit tile
(`char - '0'`), set writes the blank tile for every character (used to erase a field). A `'.'` ends
one record and moves to the next; a `'?'` ends the whole run.

The status panel has two renderers over its work-RAM source tables. `renderPanelFromTable` (0x0460)
walks ten rows of three cells from `PANEL_TILE_SOURCE` into `PANEL_VRAM_DEST` (0x8567) **[seen]**,
painting each source byte or the blank tile `0x40` when it is zero, with a stride that climbs two
cells up a column then re-bases forward to the next column. `loc_0439` renders ten rows of
packed-BCD digit pairs from `PANEL_DIGIT_SOURCE_TABLE` (0x89c0) **[code]** into
`PANEL_DIGIT_VRAM_DEST` (0x8467) **[code]**: each row draws two source bytes as low/high digit
pairs a row apart, with a fixed separator tile `0x51` wedged between them, re-basing the column two
cells right per row. The attract-screen aggregator `loc_03e9` ties it together: it draws eleven
consecutive selector-indexed character fields via `loc_05b2`, renders the whole ten-entry
`HIGH_SCORE_TABLE` as stacked BCD digit pairs into `HIGH_SCORE_TABLE_VRAM` (0x85c7) **[code]**, then
repaints the digit panel (`loc_0439`) and the status panel (`renderPanelFromTable`).

### Gauges, counters and the credit HUD

The phase gauge is a five-cell vertical bar. Both `renderPhaseGauge` (0x03c2) and `paintPhaseGauge`
(0x2065) read `GAUGE_PHASE_COUNTER` (0x8908) **[seen]**: a zero leaves the gauge untouched, else
`count - 1` cells (clamped to five) are drawn with the filled tile `0xb0` upward from
`PHASE_GAUGE_BASE_TILE` (0x863f) **[seen]** and the rest with the blank tile. `loc_1a85` repaints
the gauge and then sets the play sub-state index `PLAY_STATE_INDEX` (0x880a) **[seen]** to the base
value (bumped by one for the second player). The stage number is drawn by `renderStageCountdownDigits`
(0x34c9), which reads `STAGE_COUNTDOWN` (0x8901) **[seen]** and writes its units nibble to
`HUD_STAGE_DIGIT_LO` (0x8743) **[seen]** and its tens nibble one row over; values under ten draw as a
single digit, ten or more convert through packed BCD first (and that path draws nothing while the
play-mode latch is held). `loc_039b` paints a live count column: gated on the game-active flag, it
fills the top `ACTOR_TABLE` (0x8a80) **[seen]** count + 1 cells (clamped to eight) with tile `0x0c`
down `COUNT_COLUMN_VRAM` (0x8482) **[code]** and blanks the remainder. The level-intro tally,
`loc_6f42`, advances `INTRO_PHASE_INDEX` (0x8f51) **[code]** and draws `HIT_TALLY` (0x8f52) **[code]**
as two stacked digit pairs at `HUD_INTRO_DIGITS_BASE` (0x8634) **[code]** — the packed tally at the
base and its BCD double two rows up.

The credit HUD is `loc_05ee`. It draws the credit field, then reads `CREDIT_COUNT` (0x8802) **[seen]**
clamped to 99, converts it to packed BCD, writes the tens digit to `CREDIT_HUD_TENS_VRAM` (0x86bf)
**[code]** (skipped when zero) and the units to `CREDIT_HUD_UNITS_VRAM` (0x869f) **[code]**. WARNING:
this drawing routine hides an anti-tamper tripwire — only when the units digit happens to be exactly
2 does it also sum a fixed 31-byte program block down from `HUD_GUARD_CKSUM_TOP` (0x64c8) **[code]**
and, on a sentinel miss, bump the strike counter `TAMPER_STRIKES_HUD_GUARD` (0x8a3c) **[code]**; the
checksum is incidental to the digit paint and fires only on that one digit value.

### The display-list interpreter

`loc_4381` copies a compact layout stream into video RAM. On entry it chooses its pointer pair from
`FORMATION_SLOT_TABLE` (0x8920) **[seen]**: the primary pair `DISPLAY_LIST_DST_PTR` (0x8f43) **[seen]**
/ `DISPLAY_LIST_SRC_PTR` (0x8f45) **[seen]**, or the alternate pair `DISPLAY_LIST_DST_PTR_ALT` (0x88b8)
**[code]** / `DISPLAY_LIST_SRC_PTR_ALT` (0x88ba) **[code]** when that selector is nonzero. It then
walks up to `0x1d` source bytes as a tiny opcode stream: a plain byte is copied to the destination and
both pointers step; a skip opcode (`0x10`) advances the destination by the following byte and shrinks
the remaining budget (so runs of untouched cells cost only two stream bytes); a reload opcode (`0xff`)
loads a fresh 16-bit destination from the next two stream bytes and folds the byte after that into
`SUBPHASE_TICK` (0x88b7) **[seen]**, then stops. Unless a reload ended the walk, the destination is
nudged a final `+3`. On exit the advanced destination and source are written back into whichever
pointer pair was chosen, so the next call resumes exactly where this one left off.
## Sound

Sound on this board is a two-processor affair: the game CPU never synthesizes audio itself, it
only hands one-byte *commands* to a separate audio CPU. The whole subsystem is the plumbing for
that handoff — a hardware latch the audio CPU reads, an interrupt strobe that pokes it into
reading, and a small ring buffer that lets gameplay code queue commands faster than they are
actually delivered.

### Handing a command to the audio CPU

The primitive at the bottom is `sendSoundCommand` [code]. It writes the command byte into
`SOUND_COMMAND_LATCH` [seen] at 0xa100 — the port the audio CPU reads — and then pulses
`AUDIO_IRQ_LATCH` [seen] at 0xa181 high and immediately back low. That rising edge is what
interrupts the audio CPU into fetching the byte it just latched; the two writes together are the
complete "here is a command, go read it" gesture. The original code holds the strobe high for a
few cycles before dropping it, but that pulse width is pure timing with no state behind it, so it
does not survive as anything but the high-then-low pair. Nothing is returned — the effect is
entirely in the latched byte and the interrupt it raises.

Most callers never touch `sendSoundCommand` directly; they queue a byte instead (below). The one
routine that bypasses the queue is the direct preset emitter, which simply loads the fixed
command code 0x0b and hands it straight to `sendSoundCommand`, latching and strobing in one shot
with no buffering.

### The command ring

Between those two extremes sits a small circular buffer that decouples the producers (gameplay
events that *want* a sound) from the single-command-per-frame rate at which commands are actually
shipped. The ring lives in page 0x8a, sharing that page with the high-score table
(`HIGH_SCORE_TABLE` [code] at 0x8a00) below it and the frame counter (`FRAME_COUNTER` [seen] at
0x8a5f) above: the slots occupy 0x8a43 through 0x8a5e, and both cursors are single bytes that
hold just the low offset into that page. `SOUND_RING_WRITE_PTR` [code] at 0x8a40 is the tail
(where the next byte is stored), and `SOUND_RING_READ_PTR` [code] at 0x8a41 is the head (where
the next byte is consumed). Each cursor walks 0x43..0x5e and wraps the last slot back to the
first (0x5e -> 0x43). A slot value of 0xff means *empty*, and freeing a consumed slot writes 0xff
back into it.

There are two front doors for enqueueing, and — importantly — they feed the *same* ring through
the *same* write pointer. The plain path stores the byte into the slot the write pointer names,
then advances and wraps the write pointer; it is unconditional, always appending. The gated path
first stashes the incoming byte in `TEXT_RING_PENDING_BYTE` [code] at 0x8d20, then appends only
while a game is running — `GAME_ACTIVE_FLAG` [seen] at 0x8806 set, or `PLAY_MODE_LATCH` [code] at
0x8f50 set — otherwise it drops the byte and returns 0. On a real append it writes into the same
page-0x8a slot at the write cursor, advances and wraps identically, and leaves the *advanced*
cursor value behind for its caller to read. So the difference between the two enqueue paths is
only the gate (and that one leaves the cursor in hand); the buffer, the slot range, the pointer,
and the wrap are one and the same.

> WARNING: the read/write pointers are named for "sound," and the gated appender is described as
> a "text" ring, but there is only one physical buffer here. A byte queued by either path lands
> in the same slots behind the same write pointer and is drained by the same consumer — the "text
> command" and "sound command" rings are not two structures, they are two entrances to one.

### Draining the ring

Once per vblank the drain routine takes exactly one step of the ring. It reads the slot the head
pointer names; if that slot is 0xff the ring is empty and it returns having done nothing. Otherwise
it decides whether the queued byte is actually audible: it is silenced only when *both* attract
sound is disabled and no game is in progress — that is, when bit 0 of `DEMO_SOUNDS_DSW` [code] at
0x8821 is clear *and* `GAME_ACTIVE_FLAG` is 0. If either condition allows sound (attract sounds
enabled, or a game active), the byte is passed to `sendSoundCommand`, latched, and strobed out to
the audio CPU. Either way — whether it was delivered or suppressed — the head slot is then freed
back to 0xff and the head pointer is advanced and wrapped. Because this runs once per frame, the
ring drains at one command per vblank; a burst of enqueues during a single frame is metered out
over the following frames.

### Command producers

Above the two enqueue helpers sits a family of tiny wrapper routines, one per fixed command code,
that gameplay uses as its sound vocabulary. Each simply loads a constant and calls the appropriate
enqueue helper: some go through the unconditional path (for example the selectors that queue codes
0x00, 0x02, 0x05, 0x09, and the wave/effect pairs like 0x19-then-0x15 or 0x27-then-0x15), while
others go through the game-active-gated path (the run of codes 0x01, 0x06..0x0f, 0x11..0x14, and
so on). A few queue several bytes in sequence in one call — for instance one routine appends
0x96,0x97 through the gated path *and* 0x18,0x15 through the unconditional path, and another queues
a short text-tile run 0x28,0x15,0x16,0x17. One producer is conditional on game state before it
even enqueues, tail-appending its code (0x04) only when a wave is being torn down or a grab is
active. From the ring's point of view none of this matters: every producer just deposits bytes
that the per-vblank drain will eventually hand to the audio CPU.
## Anti-tamper

Pooyan does not trust its own ROMs. Scattered through the render, spawn, and per-actor
state code is a family of self-check routines that each fold a fixed span of the program
image — or of the on-screen tilemap — into a running sum and compare that sum against a
constant the authentic image was tuned to produce. When the sum matches, the guard is
invisible: it returns having touched nothing and the game plays on. When it misses, the
guard either raises one of a set of strike/corrupt flags — a slow-acting poison the rest
of the machine reads later — or, for the harshest checks, branches into a byte range that
is data or a dead code fragment, a jump that can only be taken on a genuinely altered
image. Because every summed span is read-only program (or a tilemap the game itself
paints from ROM), all of these guards are silent on an intact machine; they exist to make
a patched or bootlegged ROM misbehave in ways that are hard to trace back to their cause.

**The payload flags.** The guards deliberately separate detection from punishment. The
central sink is `TAMPER_FREEZE_FLAG` (0x881e) **[code]** — a miss tally that several
guards increment. Once it is nonzero the game quietly comes apart: the actor-group driver
at 0x241e reads it and aborts its per-frame dispatch before it ever reaches the actor
state table; the phase-1 spawner gate at 0x6e75 ORs it together with `SIGNATURE_MISMATCH_FLAG`
(0x8ef0) **[code]** and, if either is set, takes a `jp` into a data table at 0x4c92 that
cannot execute as code; and the round/HUD setup at 0x1ead treats a nonzero value as
"already initialised" and skips straight to the update chain, so the HUD never gets built.
Alongside that shared flag sits a rank of dedicated strike counters that only tally and
are never (in this code) cleared — `TAMPER_STRIKES_ROM` (0x89ef) **[code]**,
`TAMPER_STRIKES_SIG` (0x8a38) **[code]**, `TAMPER_STRIKES_STATE10` (0x8a39) **[code]**,
`TAMPER_STRIKES_SLOTSWEEP` (0x89e8) **[code]**, and `TAMPER_STRIKES_HUD_GUARD` (0x8a3c)
**[code]** — plus three single-bit verdict cells: `HISCORE_TABLE_CORRUPT_FLAG` (0x8df8)
**[code]**, `TAMPER_ROM_CHECK_FLAG` (0x882b) **[code]**, and `TAMPER_OBJECT_FREEZE_FLAG`
(0x89fb) **[code]**. The last is ORed with `BOARD_CLEAR_FLAG` (0x89e5) **[code]** by the
player-input sampler at 0x1e55 to freeze the per-frame object update, and is cleared only
at board reset by 0x2527.

**The program-signature sampler.** `verifyRomSignature` (0x208c) is the recurring one. It
walks the 16-byte `SIGNATURE_REFERENCE_TABLE` (0x20aa) **[seen]** one byte at a time while
striding through the sampled code region from `SIGNATURE_SAMPLE_BASE` (0x066d) **[seen]**
eight bytes at a time, so the reference is a sparse fingerprint of the low ROM. The first
byte that disagrees raises `SIGNATURE_MISMATCH_FLAG` and stops; a clean sweep leaves the
flag alone. It runs off the per-frame worker `loc_0254`: that worker reads
`WORKER_CONTROL_BYTE` (0x883f) **[code]** and, when its low nibble is nonzero, does nothing
but call the signature check and return — so the sampler is folded into the same code path
that otherwise repaints the scroll columns, hiding it inside ordinary frame work.

**The ROM- and table-checksum guards.** Several guards sum a block and match a baked
sentinel. `verifyRomChecksum` (0x3fe9) sums sixteen bytes descending from `ROM_CHECKSUM_TOP`
(0x7780) **[code]** into one byte and inspects its *shape* rather than its value — a healthy
image has bit 0 clear, bit 5 set, and bit 7 set; any other pattern bumps `TAMPER_STRIKES_STATE10`.
`loc_7e6d` is the periodic ROM guard: it fires only when `PLAYER1_LIVES` (0x8988) **[seen]**
is at least four and `FRAME_COUNTER` (0x8a5f) **[seen]** sits at its zero crossing, then sums
downward from `TAMPER_CKSUM_TOP_ADDR` (0x64be) **[code]** to a 0x34 sentinel byte while
counting the sum's carries; if `carries + sum` keeps any bit of 0xb0 it strikes
`TAMPER_STRIKES_ROM`. The lives gate is worth flagging: this guard is only armed under the
higher-lives DSW settings, so it never runs in a default three-life game. `verifyTableChecksum`
(0x585b) accumulates a caller-supplied count of bytes into a full 16-bit sum (low byte plus a
high byte bumped on each 8-bit carry) and demands high 0x1d / low 0xc1; anything else raises
`TAMPER_ROM_CHECK_FLAG` on the eagle-spawn path. `flagHighScoreTableCorruptOnChecksumMiss`
(0x0644) guards the high-score block: the first byte at `HISCORE_CHECKSUM_BASE` (0x778a)
**[seen]** must be the 0xc8 header marker, then the four bytes are summed with each carry
counted separately and `sum - carries` must equal 0x59 — a bad header or a wrong total raises
`HISCORE_TABLE_CORRUPT_FLAG`. And `flagTamperOnRound5ChecksumMiss` (0x5b06) is armed only when
`ROUND_COUNTER` (0x8907) **[seen]** is 5: it sums six program bytes at 0x1553 with a carry tally
and, unless `low + carries + 0x7f` wraps to zero, bumps `TAMPER_FREEZE_FLAG` — a tripwire that
lies dormant for the first four rounds.

**Checks piggybacked on gameplay routines.** Most of the family is not standalone; each guard
rides inside a routine that has an unrelated day job, so the sum runs as a side effect of normal
play. `loc_05ee` draws the two-digit credit HUD from `CREDIT_COUNT` (0x8802) **[seen]**, but
only when the units digit comes out exactly 2 does it sum thirty-one bytes descending from
`HUD_GUARD_CKSUM_TOP` (0x64c8) **[code]**; a total other than the 0x8c sentinel strikes
`TAMPER_STRIKES_HUD_GUARD`. `loc_1bcc` snapshots the live page into player 1's bank and then,
seeding its accumulator from the *advanced* copy pointer rather than zero, folds fourteen bytes
of `TAMPER_CHECKSUM_CODE_BASE` (0x5328) **[code]** each masked to its low five bits; unless the
result lands on the sentinel word 0x8a60 it bumps `TAMPER_STRIKES_SIG`. `loc_52f6` sweeps six
enemy records at `ENEMY_ACTOR_TABLE` (0x8ae0) **[seen]** for free slots — running only while
`SCRIPT_ADVANCE_GUARD` (0x8d6d) **[seen]** is set and `SLOT_SWEEP_LATCH` (0x8d6e) **[code]** is
still clear — and, if it finds at least four free, latches the count and folds twenty-three bytes
from `SLOT_SWEEP_CKSUM_BASE` (0x0bf3) **[code]**; a miss against low 0x15 / high 0x09 strikes
`TAMPER_STRIKES_SLOTSWEEP`. Two actor-state handlers carry their own sums gated on the frame
zero crossing: `loc_3865`, once its per-record timer expires and the record has reached the
object band, folds a block descending from `ACTOR_TAMPER_CKSUM_TOP` (0x4282) **[code]** to a
0x1a terminator and, if `carries + sum` keeps any bit of 0x9e, bumps `SIGNATURE_MISMATCH_FLAG`;
`loc_4103`, on its dwell expiry, folds the low nibbles of fifty-six bytes from
`TAMPER_NIBBLE_SUM_BLOCK` (0x557f) **[code]** and demands low 0x67 with exactly one carry, else
strikes `TAMPER_STRIKES_SIG`. Two more state handlers bump `TAMPER_FREEZE_FLAG` directly:
`loc_1b43` folds a 34-byte span at 0x5593 (each byte `& 0x37`, rotated, added with carry) and
increments the freeze tally unless the accumulator equals 0x7c, and `loc_5594`, on reaching a
free actor block, adds an eight-byte guard at 0x0bad against a local signature table and bumps
the tally if any pair is nonzero.

**The hard traps.** A second class of guard does not set a flag at all — a failure jumps into
bytes that are data or an isolated dead fragment, so the branch is simply unreachable while the
image is intact and manifests as a crash on a tampered one. `loc_7960`, the shared play-timer
render handler, first folds a 0x5b-byte block from `INTEGRITY_CHECKSUM_CODE_BLOCK` (0x2901)
**[code]** — a full 16-bit sum plus a second sum sampled at even offsets — and matches all four
result bytes against the four guard bytes that trail the block; a mismatch traps. After
rendering it scans a seven-byte flag block at `INTEGRITY_FLAG_SCAN_BASE` (0x89e7) **[code]**,
and if any flag is set it sums from there to a 0xc9 sentinel and checks the two-byte result
against `TAIL_CHECKSUM_GUARD` (0x7a0b) **[code]** — a low-byte miss traps, a high-byte miss
diverts to a phase-gauge repaint instead. `loc_79e9` is the pure self-check: it sums a routine
forward from `SELFCHECK_ROUTINE_BASE_ADDR` (0x68ac) **[code]** until it hits that routine's own
terminating `ret` opcode and matches the 16-bit total against the same `TAIL_CHECKSUM_GUARD`
word — low-byte miss traps, high-byte miss diverts. `loc_3266`, the hunter-formation state-2
handler, sums a 0x20-byte block up from `FORMATION_GUARD_BASE` (0x0799) **[code]** and demands
the 0xdc sentinel; a miss re-enters the guarded region, which is modelled as a trap.

**The tile-region checks.** Two guards checksum the painted playfield itself, catching a
tampered tile ROM by its on-screen output. `loc_68ac` and `loc_3278` both sweep the tilemap
from `PLAYFIELD_TILE_BASE` (0x8402) **[code]** — walking each 29-cell row, skipping a three-cell
gap, and stepping pages until the high byte reaches 0x88 — accumulating a low-byte sum and a
wrap count, then matching both against the paired entries of `TILE_CHECKSUM_TABLE` (0x68eb)
**[code]**. Each runs at most once, guarded by `TILE_CHECKSUM_LATCH` (0x8f55) **[code]** which
it sets on the first pass; a low-byte or wrap-count miss is a data-integrity trap that intact
tiles cannot produce. A sibling, `loc_6a7f`, sums a different tilemap stride from 0x8450 into a
16-bit total and demands 0x29b8, guarded once by `TILE_SUM_ONCE_LATCH` (0x8f56) **[code]** (this
latch is re-armed to 0 when the state-1 descending object reaches the bottom, so the check
re-runs per board); its two fail arms jump into a data address and a dead fragment. Finally,
`loc_08b3` — the attract sub-state-0 handler — folds a backward checksum from 0x64d5 to a 0x96
sentinel (sum into H, carry count into L) and, unless `0x96 - carries` equals 0x8f, raises
`TAMPER_OBJECT_FREEZE_FLAG`, the object-update freeze described above.

**A reading warning.** A couple of the cells this system touches are multiplexed and should not
be read as tamper-only. `TAMPER_ROM_CHECK_FLAG` (0x882b) is written as a mismatch flag on the
eagle-spawn path but is also written elsewhere as a plain state index (0x07) and read elsewhere
as a coordinate low byte selected by the coinage config, so its value is not always a tamper
verdict. Likewise `INTRO_DELAY_CKSUM_WORD` (0x8f48) **[seen]** serves double duty as an
intro-phase delay timer and as the 16-bit pointer walked by a column-checksum routine; the same
word means different things in the two contexts.
