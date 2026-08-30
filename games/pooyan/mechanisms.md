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
progression state machine and its timers, the actor arena where the player and enemies live and spawn,
the enemy attack waves with their rope and launch machinery, how all of it is turned into pixels, the
sound-command path, and finally the anti-tamper guards.

## Legend

Every cell and routine role carries a confidence tag:

- **[seen]** — the reading ends in a MAME observation (a value watched change, a poke, a write tap).
- **[code]** — read from the code: consistent across the routines that touch it, MAME-grounding pending.
- **[guess]** — inferred; the least certain, flagged so it is not trusted as fact.

A cell with no tag is named but its role is not yet pinned. Where a reading is counterintuitive, a
callout warns about it in place.

## The work RAM and its state model

Pooyan runs on Konami's GX320 board: a single Z80 clocked at 3.072 MHz, a 32 KB program ROM, 4 KB of tile RAM split into two planes, 2 KB of general work RAM, two banks of sprite RAM, and a small window of memory-mapped hardware ports. There is no second gameplay processor to worry about here — the sound Z80 lives on its own bus and only ever receives command bytes. Everything the game *is*, frame to frame, lives in that 2 KB of work RAM at 0x8800–0x8FFF, and the whole machine is driven by exactly two per-frame routines: a vblank NMI service that does the state work, and a free-running foreground loop that paints. This section surveys the memory map, the two video planes, the sprite banks, the I/O window, the layout of work RAM, and the dispatch tree that ties them together. The individual mechanisms named here are detailed in later sections.

### The address map

The Z80's 64 KB space (from `boards/pooyan/memory.js`) is laid out:

- **0x0000–0x7FFF** — program ROM (32 KB, four 8 KB images concatenated).
- **0x8000–0x83FF** — colour RAM, `COLOR_RAM_BASE` (0x8000) [seen]: one attribute byte per tile cell.
- **0x8400–0x87FF** — video RAM, `VIDEO_RAM_BASE` (0x8400) [seen]: one tile-code byte per cell.
- **0x8800–0x8FFF** — work RAM (2 KB): all game state.
- **0x9000–0x9FFF** — sprite RAM, two banks selected by address bit 0x0400 (bank 0 at 0x9000, bank 1 at 0x9400), each 256 bytes and indexed by the low address byte.
- **0xA000 and up** — the hardware I/O window (reads and writes at one address decode to *different* devices).

The decode is done with don't-care bit masks rather than clean ranges, and an access that decodes to nothing throws (`UnmappedAccess`): the program ROM fully fills 0x0000–0x7FFF and the hardware never floats an unmapped address high, so any stray read or write is a real bug, not a quietly-tolerated no-op.

The manifest (`games/pooyan/manifest.js`) fixes the display geometry: a 256×224 raster presented ROT90 (portrait/vertical), refreshing at 60.606061 Hz, with the CPU running 50688 cycles per frame. The visible region is native rows 16..239.

### The two video planes

The tilemap is a 32×32 grid of 8×8 cells drawn from two parallel planes that share the same cell index. Video RAM (0x8400) supplies the *tile code* for each cell; colour RAM (0x8000) supplies that cell's *attribute* byte. In the attribute byte the low nibble is the palette group (16 pens per cell — the graphics are 4bpp), bit 6 is horizontal flip and bit 7 is vertical flip. `boards/pooyan/video.js` renders a single layer: it paints the whole tilemap opaquely (pen 0 included), then lays sprites over the top — there is no priority split between playfield and sprites. The game seeds tile codes into video RAM and floods attribute columns into the colour plane from `ATTRIB_MAP_BASE` (0x8040) [seen]; the playfield's tile region is checksummed for tamper detection from `PLAYFIELD_TILE_BASE` (0x8402) [seen]. Flip-screen (cocktail) is a plain full mirror of both planes, gated by the orientation flag described below.

### The sprite banks

Sprite RAM occupies 0x9000–0x9FFF as two 256-byte banks, `SPRITE0_CLEAR_BASE` (0x9010) [seen] and `SPRITE1_CLEAR_BASE` (0x9410) [seen] marking where boot clears each. The two halves of one sprite sit at the *same* offset in the two banks: bank 0 holds `[offs]` = X and `[offs+1]` = tile code; bank 1 holds `[offs]` = colour (bits 0–3) plus flip-X (bit 6, active-low) and flip-Y (bit 7), and `[offs+1]` = 240 − Y. The renderer scans sprite slots ascending from offset 0x10 to 0x3E, so when two sprites overlap the *higher* offset wins. The game does not write sprite RAM directly during play; it builds a 24-entry sprite display list in work RAM (see `SPRITE_DISPLAY_LIST` below) and the display/DMA path transfers it into these banks.

### The hardware I/O window

Above 0xA000 the address decodes to memory-mapped hardware (`boards/pooyan/io.js`). Reads and writes at the same address are distinct devices:

| Address | Read | Write |
|---|---|---|
| 0xA000 | DSW1 (`DSW1_PORT`, 0xA000 [code]) | watchdog kick |
| 0xA080 | IN0 — coins / start / service (`IN0_PORT`, 0xA080 [code]) | — |
| 0xA0A0 | IN1 — player-1 up / down / fire (`IN1_PORT`, 0xA0A0 [code]) | — |
| 0xA0C0 | IN2 — player-2 (cocktail) controls (`IN2_PORT`, 0xA0C0 [code]) | — |
| 0xA0E0 | DSW0 — coinage (`DSW0_PORT`, 0xA0E0 [code]) | — |
| 0xA100 | — | sound-command latch to the audio CPU (`SOUND_COMMAND_LATCH`, 0xA100 [seen]) |
| 0xA180–0xA187 | — | LS259 control latch, one address per bit (bit = addr & 7) |

All three input ports are active-low (idle 0xFF); the two DIP banks read a fixed configuration. The LS259 latch carries the machine's control bits, addressed one bit per byte: bit 0 is the vblank-NMI enable (`NMI_ENABLE_LATCH`, 0xA180 [seen]), bit 1 the audio-IRQ strobe, bit 2 audio mute, bits 3/4 the two coin counters, bit 5 payout, and bit 7 (inverted) flip-screen (`FLIP_SCREEN_LATCH`, 0xA187 [code]). There is no video-enable bit — video is always on.

### The shape of work RAM

The 2 KB of work RAM is organised by region and role:

**Boot-decoded configuration (low 0x8800s).** The boot self-test decodes the DIP switches once into fixed cells: `BONUS_AWARD_DSW` (0x8800) [seen], `CREDIT_COUNT` (0x8802) [seen], `LIVES_DSW` (0x8807) [seen], `CABINET_MODE_FLAG` (0x880F) [seen], `DIFFICULTY_DSW` (0x8820) [seen], `DEMO_SOUNDS_DSW` (0x8821) [seen], and the two coinage nibbles `COINAGE_CONFIG` (0x882C) [seen] / `COINAGE_CONFIG_SLOT2` (0x882F) [seen].

**Top-level state and input.** `MAIN_GAME_STATE` (0x8805) [seen] selects the whole-machine mode; `GAME_ACTIVE_FLAG` (0x8806) [seen] gates in-play handlers; `PHASE_TIMER` (0x8808) [seen] and `PLAY_STATE_INDEX` (0x880A) [seen] time and sub-select the play phases; `ACTIVE_PLAYER` (0x880D) [seen] and `TWO_PLAYER_FLAG` (0x880E) [seen] pick the player bank. `FLIP_SCREEN_FLAG` (0x881F) [seen] holds the orientation copied to the latch each frame. The input edge-detect ring begins at `INPUT_PORT0` (0x8810) [seen] with `INPUT_PORT1` (0x8811) [seen] and `INPUT_PORT2` (0x8812) [seen] — the complemented (active-high) samples of IN0/IN1/IN2 — followed by the previous-frame copies the NMI shifts through for edge detection.

**Per-player banks.** Each player keeps a live 3-byte BCD score buffer — `P1_SCORE_BCD` (0x88A2) [seen] and `P2_SCORE_BCD` (0x88A5) [seen] — above the shared 3-byte high-score counter at `HIGH_SCORE_BCD` (0x88A8) [seen] / `HIGH_SCORE_BCD_HI` (0x88AA) [seen]. The full per-player state pages are `PLAYER0_STATE_BANK` (0x8940) [seen] (with lives at `PLAYER0_LIVES`, 0x8948 [seen]) and `PLAYER1_STATE_BANK` (0x8980) [seen] (`PLAYER1_LIVES`, 0x8988 [seen]); the live page at 0x8900 is swapped in and out of these on a player change. Per-player BCD play timers live at `PLAY_TIMER_BCD_P1` (0x8A30) [seen] / `PLAY_TIMER_BCD_P2` (0x8A33) [seen].

**The 0x8900 live block.** The active round's scalar state sits here: `SPEED_INDEX` (0x8900) [seen], `STAGE_COUNTDOWN` (0x8901) [seen], `SPAWN_PHASE_COUNTER` (0x8902) [seen], `WAVE_ARRIVAL_COUNTER` (0x8903) [seen], `ROUND_IN_PROGRESS` (0x8904) [seen], `ROUND_COUNTER` (0x8907) [seen], `GAUGE_PHASE_COUNTER` (0x8908) [seen], and the bonus-award queue `AWARD_QUEUE` (0x8909) [seen]. `SELFTEST_DISPATCH_STATE` (0x8921) [seen] rides in this page too.

**The 0x8928 timer/flag block.** A short block of per-frame timers and gates cleared at screen re-init: `FRAME_TIMER_BLOCK_BASE` (0x8928) [seen], `SHARED_FRAME_DELAY_TIMER` (0x8929) [seen], and the shared animation/blink counters through 0x8930.

**The free-running frame counter.** `FRAME_COUNTER` (0x8A5F) [seen] is decremented every vblank; its low bits phase animations and its zero-crossings gate integrity checks.

**Actor and object records (0x8A80+).** The main actor arena is a stride-0x18 record array at `ACTOR_TABLE` (0x8A80) [seen], whose slot 0 is the player/lead actor — its state index at `LEAD_ACTOR_STATE` (0x8A82) [seen] and vertical position at `PLAYER_Y` (0x8A84) [seen]. Beyond it sit the pooled record tables, all stride 0x18: `ENEMY_ACTOR_TABLE` (0x8AE0) [seen], `SPRITE_OBJECT_TABLE` (0x8B70) [seen], `OBJECT_STATE_RECORD_BASE` (0x8BA0) [seen], `PROJECTILE_TABLE` (0x8BE8) [seen], `FORMATION_TABLE` (0x8C30) [seen], `SPAWN_OBJECT_TABLE` (0x8C48) [seen], `FORMATION_SPAWN_TABLE` (0x8C60) [seen], `HUNTER_TABLE_BASE` (0x8C78) [seen], and the I-parity target pair `ENEMY_TARGET_REC0` (0x8C90) [seen] / `ENEMY_TARGET_REC1` (0x8CA8) [seen].

**Wave / launch state (the 0x8F00 page).** The attack-machinery scalars cluster here: the shared animation-script cursor `ANIM_SCRIPT_CURSOR` (0x8F00) [seen], `FORMATION_STATE` (0x8F08) [seen], `LAUNCH_STATE` (0x8F30) [seen], `WAVE_INDEX` (0x8F3D) [seen], `INTRO_PHASE_INDEX` (0x8F51) [seen], `HIT_TALLY` (0x8F52) [seen], and the main-loop selector `MAINLOOP_SUBSTATE_SELECTOR` (0x8F5C) [seen]. The attract sub-state selector `ATTRACT_SUBSTATE` (0x8E51) [seen] sits just below in the 0x8E00 page.

**Display-list and command-ring pointers.** The 24-entry sprite display list is built at `SPRITE_DISPLAY_LIST` (0x8840) [seen]. The display-command ring is a 32-slot two-byte buffer at `DISPLAY_CMD_RING_BUFFER` (0x88C0) [seen], with a write cursor `DISPLAY_CMD_RING_WRITE_PTR` (0x88A0) [seen] and read cursor `DISPLAY_CMD_RING_READ_PTR` (0x88A1) [seen]; the display-list interpreter walks source/dest pointer pairs `DISPLAY_LIST_SRC_PTR` (0x8F45) [seen] / `DISPLAY_LIST_DST_PTR` (0x8F43) [seen]. Separately, sound commands queue through a ring at `SOUND_RING_BUFFER` (0x8A43) [seen] with pointers `SOUND_RING_WRITE_PTR` (0x8A40) [seen] / `SOUND_RING_READ_PTR` (0x8A41) [seen].

**HUD / score storage.** The status panel is rendered from `PANEL_TILE_SOURCE` (0x8E00) [seen] and the packed-BCD digit panel from `PANEL_DIGIT_SOURCE_TABLE` (0x89C0) [seen]; the sorted ten-entry BCD high-score table lives at `HIGH_SCORE_TABLE` (0x8A00) [seen].

**Anti-tamper bookkeeping.** A scatter of strike counters records ROM/signature-checksum failures — the seven-flag block at `INTEGRITY_FLAG_SCAN_BASE` (0x89E7) [code], plus `TAMPER_FREEZE_FLAG` (0x881E) [code], `TAMPER_STRIKES_ROM` (0x89EF) [code], `TAMPER_STRIKES_SIG` (0x8A38) [code], and `TAMPER_OBJECT_FREEZE_FLAG` (0x89FB) [code]. A nonzero value here freezes spawns and diverts handlers.

**The stack.** The Z80 stack grows down from its 0x9000 seed; the reconciled scratch window is `STACK_SCRATCH` {0x8FC0, 0x9000}. `BOOT_STACK_TOP` (0x8FFE) [seen] is the seed after one unbalanced push that reserves the very top word for `ROM_SELFTEST_TALLY` (0x8FFF) [seen], keeping the self-test tally above the stack so the NMI's register save cannot clobber it.

### The per-frame dispatch model

Two routines drive every frame. The vblank NMI service `loc_066d` (0x066D) [seen] is the sole per-frame heartbeat — the main loop free-runs with no vblank wait, so all state work is hung off the interrupt. Each vblank it masks the NMI (clears LS259 bit 0), rebuilds the scrolling tile columns through `loc_0714` (0x0714) [seen], kicks the watchdog, shifts the three input ports through the edge-detect ring at 0x8810, ticks `WORKER_CONTROL_BYTE` (0x883F) [seen] and the frame counter, services coins via `serviceCoinCreditAndCountersUnlessFreePlay` (0x59E8) [seen] and drains the sound ring through `drainSoundCommandRing` (0x0E64) [seen]. It then dispatches on `MAIN_GAME_STATE` through the top-level jump table at 0x06F0 to one of five handlers: state 0 to `loc_072d` (0x072D) [seen] (attract setup / self-test drive), state 1 to `dispatchAttractSubstate` (0x0899) [seen], state 2 to `dispatchBoardBuildSubstate` (0x0C4E) [seen], state 3 to `runPlayStateFrame` (0x159B) [seen], and state 4 to `noopStateHandler` (0x0E53) [seen]. Finally it copies the orientation flag to the flip-screen latch and re-arms the NMI.

The foreground loop `mainLoop` (0x020F) [seen] runs endlessly, interrupted by that NMI. Each pass reads the display-command ring at `DISPLAY_CMD_RING_READ_PTR`: a worker slot (high bit set) runs the per-frame scroll/paint worker `loc_0254` (0x0254) [seen], which marks the true vblank boundary; any other slot consumes one two-byte command, advances and wraps the read cursor (wrapping at 0xC0), and runs the command's handler from a nine-entry table indexed by (command × 2) & 0x1F — the HUD, gauge, score and panel painters. The loop drains the whole ring within a frame, matching how the real machine empties it each vblank.

Underneath the top-level state, each mode has its own selector. The attract driver `dispatchAttractSubstate` keys `ATTRACT_SUBSTATE` through the inline jump table at 0x08A1 (nine handlers) and then runs a shared credit/start-press epilogue. Self-test/display work keys `SELFTEST_DISPATCH_STATE` (masked to two bits) through `loc_7442` (0x7442) [seen] and table 0x7448 (three handlers: ROM check, HUD-strip checksum, gameplay driver). In-play work keys `PLAY_STATE_INDEX` (low five bits) through `loc_15a1` (0x15A1) [seen] and table 0x15A8 (nineteen handlers). Level-intro phases key `INTRO_PHASE_INDEX` through `dispatchLevelIntroPhase` (0x6DA6) [seen] and table 0x6DAA (seven phases). The main-loop counter `MAINLOOP_SUBSTATE_SELECTOR` (masked to three bits) is dispatched by the frozen `loc_0fd5` (0x0FD5) through the inline table at 0x0FE3 (six handlers). The board-build state (top-level state 2) reuses `PLAY_STATE_INDEX` for its own three sub-states.

Below the mode selectors, the per-record dispatchers walk the actor tables one record at a time, each routing a record's state byte (`ix+2`) through its own table: the IX-object dispatcher `loc_40d0` (0x40D0) [seen] routes `(ix+2)&0x1F` through table 0x40E1 (seventeen handlers); the active-object dispatcher `dispatchActiveObjectState` (0x7707) [seen] routes `(ix+2)&3` to four handlers, skipping inactive records; the enemy-actor dispatcher `dispatchActiveEnemyActorState` (0x338A) [seen] routes `(ix+2)&0x1F` (below 0x11) to seventeen handlers; the special-object dispatcher `loc_6822` (0x6822) [seen], gated by `ENEMY_REC_DISPATCH_GATE` (0x8AFA) [seen], routes through table 0x6834 (three handlers); and the bonus/eagle-stage dispatcher `loc_71b9` (0x71B9) [seen] routes `WAVE_OUTER_PHASE` (0x8F38) [seen] through table 0x71C1 (three handlers) before a shared epilogue. All of these are tail dispatches through the Z80's rst-based jump tables, so a handler returns to the dispatcher's own caller rather than back through the dispatcher.

## The frame loop and the vblank heartbeat

### Reset and arming the heartbeat

Power-on lands on the reset vector at 0x0000, whose only job is to force the vblank interrupt off before anything else can run: it zeroes the accumulator and writes it to NMI_ENABLE_LATCH (0xa180) [seen] — LS259 bit 0, the vblank-NMI enable — then jumps straight to the boot entry loc_0092 (0x0092) [seen].

Boot is one long stretch of straight-line initialisation. It kicks the watchdog by writing to DSW1_PORT (0xa000) [code] (the write side of that address is the watchdog), points the stack at 0x9000, and runs the program-memory self-test: it sums each of the eight 4K banks and compares the 24-bit result against the reference table, bumping the pass tally ROM_SELFTEST_TALLY (0x8fff) [seen] once per matching bank, so a clean machine ends at 0x10. It reads the DIP switches from DSW0_PORT (0xa0e0) [code] and DSW1_PORT (0xa000) [code], clears work RAM from 0x8800 upward, and seeds the HUD and colour map (flooding COLOR_RAM_BASE (0x8000) [seen] with the default attribute). It blanks the display-command ring — DISPLAY_CMD_RING_BUFFER (0x88c0) [seen], the thirty-two two-byte slots spanning 0x88c0-0x88ff — to 0xff so every slot reads empty, and parks both cursors at 0xc0 by writing DISPLAY_CMD_RING_WRITE_PTR (0x88a0) [seen] and DISPLAY_CMD_RING_READ_PTR (0x88a1) [seen]. It decodes the cabinet, coinage, and difficulty bits out of the complemented DIP words, and then — near the end of boot — writes 1 to NMI_ENABLE_LATCH (0xa180) [seen], arming the vblank heartbeat. After a last handful of seeds it jumps to the main loop at 0x020f. From that moment the machine has two independent flows: the main loop running in the foreground, and the vblank NMI firing once per frame.

### The free-running main loop

The main loop (mainLoop, 0x020f) never busy-waits for vblank. Each pass reads the low byte at DISPLAY_CMD_RING_READ_PTR (0x88a1) [seen], forms a ring address on page 0x88 (in the 0x88c0-0x88ff window), and inspects the slot found there. When that slot's high bit is set — value 0xff, meaning the slot is free and the ring has fully drained — it runs the per-frame worker loc_0254 (0x0254) [seen]; that ring-idle pass is the loop's synthetic frame boundary. Otherwise the slot holds a live display command: the loop takes the command byte and the parameter byte that follows it, uses (command × 2) as an even offset into the display-handler table at 0x0242, frees both consumed bytes back to 0xff, and advances the read cursor by two, wrapping back to 0xc0 when it steps past the top of the ring. Because dispatching a command does not stop the loop, the whole ring drains within a single frame rather than trickling out one command per interrupt.

The worker itself is gated by WORKER_CONTROL_BYTE (0x883f) [seen]. If that byte's low nibble is set, the worker does nothing but run the program-signature guard verifyRomSignature (0x208c) [seen], which walks the sixteen-byte reference table against every eighth byte of the code region and raises SIGNATURE_MISMATCH_FLAG (0x8ef0) [code] on the first byte that differs. Otherwise, while a game is active, it repaints the three-tile scroll columns — four blank columns then the shared column in one-player mode, or a capped body column in two-player mode — and, only when the control byte's bit 4 and the game-active low bit are both set, blanks one further column, each column stepping one tilemap row upward per cell.

### The vblank interrupt: one beat of work

Once per frame the vblank NMI enters the service routine loc_066d (0x066d) [seen], the machine's real heartbeat. It first saves the whole register file — the main set, the shadow set, and IX/IY — on the stack, then masks further interrupts by clearing NMI_ENABLE_LATCH (0xa180) [seen]. It copies the sprite display list at SPRITE_DISPLAY_LIST (0x8840) [seen] into the sprite hardware banks (destinations 0x9010 and 0x9410) through the sprite-attribute copy loop loc_0714 (0x0714) [seen] — four column groups when PLAY_STATE_INDEX (0x880a) [seen] equals 4, otherwise a single 0x18-tall group — and kicks the watchdog again. It then samples the three input ports active-low and complements each: IN2 (0xa0c0) into INPUT_PORT2 (0x8812) [seen], IN1 (0xa0a0) into INPUT_PORT1 (0x8811) [seen], and IN0 (0xa080) into INPUT_PORT0 (0x8810) [seen], having first shifted the previous frame's samples up into adjacent shadow cells so handlers can detect coin and button edges. Two counters are decremented each beat — WORKER_CONTROL_BYTE (0x883f) [seen] and the free-running FRAME_COUNTER (0x8a5f) [seen]. It services coins and counters through serviceCoinCreditAndCountersUnlessFreePlay (0x59e8) [seen], drains one entry from the sound ring through drainSoundCommandRing (0x0e64) [seen], and only then performs the top-level state dispatch. When the chosen handler returns, the epilogue copies FLIP_SCREEN_FLAG (0x881f) [seen] into the hardware FLIP_SCREEN_LATCH (0xa187) [code], restores every saved register, re-arms NMI_ENABLE_LATCH (0xa180) [seen], and returns to the interrupted foreground code.

### The once-per-frame state branch

The dispatch reads MAIN_GAME_STATE (0x8805) [seen] and, through the Z80's rst 0x28 restart, indexes the five-entry table at 0x06f0 to one of five handlers, each of which returns to the service routine's own epilogue. State 0 is the attract/self-test handler loc_072d (0x072d) [seen]; state 1 the attract-demo driver dispatchAttractSubstate (0x0899) [seen]; state 2 the board-build driver dispatchBoardBuildSubstate (0x0c4e) [seen]; state 3 the play handler runPlayStateFrame (0x159b) [seen]; and state 4 the do-nothing noopStateHandler (0x0e53) [seen], a bare return that draws nothing.

Handler loc_072d also holds the self-test gate. Every frame it fills one 0x20-tile row of the screen, decrementing FILL_ROW_COUNTER (0x8809) [seen], and returns early while rows still remain. Once the fill completes it checks ROM_SELFTEST_TALLY (0x8fff) [seen]: unless the tally reached its full value of 0x10 it simply jumps into the main loop, leaving the machine sitting in attract state 0. Only on a full self-test pass does it finish attract setup — clearing GAME_ACTIVE_FLAG (0x8806) [seen], advancing MAIN_GAME_STATE (0x8805) [seen] to 1, clearing PLAY_STATE_INDEX (0x880a) [seen], flooding the attribute columns, enqueuing three display commands, and clearing the attract selector ATTRACT_SUBSTATE (0x8e51) [seen]. The play handler runPlayStateFrame first ticks the BCD play-timer, which itself returns immediately when GAME_ACTIVE_FLAG (0x8806) [seen] is clear, then dispatches the in-play sub-state selected by PLAY_STATE_INDEX (0x880a) [seen].

## Configuration, coinage and players

### Power-on: reading the DIP switches into config cells

The boot routine (loc_0092) runs the ROM self-test, clears work RAM from 0x8800 upward, seeds the HUD, and then unpacks the two DIP-switch banks into individual config cells. It reads DSW1 from DSW1_PORT (0xa000) [code], complements the whole byte once, and peels off one field at a time with repeated rotate-right steps: the bit that started as DSW1 bit 2 lands (masked to one bit) in CABINET_MODE_FLAG (0x880f) [seen], bit 3 in BONUS_AWARD_DSW (0x8800) [seen], the three bits 4-6 (kept as a 3-bit value) in DIFFICULTY_DSW (0x8820) [seen], and bit 7 in DEMO_SOUNDS_DSW (0x8821) [seen]. Because the port is complemented before the rotates, each of these config cells holds the inverted DIP bit.

Lives are handled with a second read of the same port: it complements DSW1 again, keeps the low two bits, and if both are set (value 3) writes the sentinel 0xff, otherwise writes the value plus 3, into LIVES_DSW (0x8807) [seen]. The cabinet lives count is therefore 3, 4, or 5, with 0xff as the special all-bits case.

Coinage comes from the other bank: it reads DSW0 from DSW0_PORT (0xa0e0) [code], takes the high nibble and looks it up in the ROM byte table COINAGE_TABLE (0x0053) [seen], storing the result in COINAGE_CONFIG_SLOT2 (0x882f) [seen]; it then looks up the low nibble through the same table into COINAGE_CONFIG (0x882c) [seen]. A resolved coinage value of 0x0f means free play.

The boot also establishes upright orientation up front, writing 1 to both FLIP_SCREEN_LATCH (0xa187) [code] and the software orientation flag FLIP_SCREEN_FLAG (0x881f) [seen], and seeds the default high-score MSB.

### Cabinet orientation

CABINET_MODE_FLAG (0x880f) is the decoded cocktail flag — the inverted DSW1 bit 2 — and round-init reads it as a boolean to gate the cocktail/flip handling. The live orientation is carried by FLIP_SCREEN_FLAG (0x881f), which is copied into bit 7 of the hardware flip-screen latch FLIP_SCREEN_LATCH (0xa187) every frame; the detailed copy belongs to the frame loop. That LS259 output is inverted in hardware (a latch value of 0 means flipped), so the boot's write of 1 corresponds to the normal, upright screen.

### Coin acceptance and credit accrual

serviceCoinCreditAndCountersUnlessFreePlay (0x59e8) is the per-frame coin/credit update, and it opens by short-circuiting free play: if either COINAGE_CONFIG or COINAGE_CONFIG_SLOT2 reads 0x0f it returns without touching credits. Otherwise it runs the coin-drip accrual steps, the coin-counter strobes, and a periodic integrity check.

Each drip debounces one coin-input edge through a rotate ring and, only on the accept phase, accrues toward a credit. accrueCreditFromCoin1Pulse (0x5a56) rotates bit 0 of the latest input sample INPUT_PORT0 (0x8810) [seen] into the ring DRIP_RING_C (0x882a) [seen]; when the ring's low three bits settle on 1 it emits the coin sound, bumps the queued-pulse counter COIN1_PULSE_COUNT (0x8824) [seen], and steps the score/credit-drip accumulator SCORE_DRIP_ACCUM (0x882b) [seen] by +0x10. That accumulator is exactly the drip's running position: once the +0x10 step carries past COINAGE_CONFIG, the surplus is folded back down into SCORE_DRIP_ACCUM and the low nibble of COINAGE_CONFIG decides the credit amount — a nibble of 0x0f takes the full-wrap amount 0x63, any other value contributes the nibble itself. accrueCreditsFromCoinSlot2 (0x5a1f) is the structural twin for the second slot: it rotates INPUT_PORT0 bit 1 into DRIP_RING_B (0x882d) [seen], bumps COIN2_PULSE_COUNT (0x8826) [seen], steps the coordinate DRIP_COORD_B (0x882e) [seen] by +0x10, and wraps it against COINAGE_CONFIG_SLOT2. (A third drip variant runs on DRIP_RING_A (0x8829) [seen].)

Every drip funnels into a shared accumulate tail. addCreditsAndQueueDisplay (0x5a8c) adds the resolved amount into the live BCD credit counter CREDIT_COUNT (0x8802) [seen], clamps the stored byte to 0x63, and tails into queueCreditDisplayRefresh (0x5a97), which enqueues the credit-display refresh command. addFullWrapCreditAmount (0x5a8a) is simply the full-wrap entry: it seeds the amount to 0x63 and drops into that same tail.

### The physical coin counters

The drips only queue pulses; the physical coin counters are driven by separate pulse generators that turn each queued pulse into a timed strobe on an LS259 output. loc_5a9c (coin slot 1) and pulseCoinCounter2Latch (0x5ac0) (coin slot 2) are identical in shape: with no queued pulses they return; with the phase timer idle (0) they seed it to 0x30 and raise the counter latch; while counting they step the phase down, drop the latch at 0x18, and retire one queued pulse when the phase reaches 0. Slot 1 works from COIN1_PULSE_COUNT (0x8824) and COIN1_PULSE_PHASE (0x8825) [seen] onto COIN1_COUNTER_LATCH (0xa183) [seen] (LS259 bit 3); slot 2 works from COIN2_PULSE_COUNT (0x8826) and COIN2_PULSE_PHASE (0x8827) [seen] onto COIN2_COUNTER_LATCH (0xa184) [seen] (LS259 bit 4). Only bit 0 of the value written to each latch address lands on the output.

### Starting a game and consuming credits

startSelectedPlayerGameConsumingCredits (0x0d78) reads the edge bits sampled into INPUT_PORT0 (0x8810). Bit 3 (the 1-player start) hands off to startOnePlayerGameOnCredit (0x0de4). Bit 4 (the 2-player start) requires at least two credits — it returns early with fewer — then subtracts two from CREDIT_COUNT, runs an integrity checksum over CREDIT_CHECKSUM_TABLE (0x776b) [code] that bumps CREDIT_TAMPER_COUNTER (0x89ea) [code] when the folded result is nonzero, and continues into beginTwoPlayerStartOfLife (0x0da8).

startOnePlayerGameOnCredit (0x0de4) spends one credit and restarts a fresh single-player game with the active-player word 0 when a credit remains; with no credit left it instead nudges MAIN_GAME_STATE (0x8805) [seen] to 1, unless play has already reached sub-state 0x0e in PLAY_STATE_INDEX (0x880a) [seen]. beginTwoPlayerStartOfLife (0x0da8) seeds the start-of-life state word 256 (0x0100) and drops into the same setup.

startNewGamePlay (0x0dab) receives that player word and splits it: the low byte becomes the active-player index in ACTIVE_PLAYER (0x880d) [seen] and the high byte becomes TWO_PLAYER_FLAG (0x880e) [seen]. A 1-player start therefore leaves ACTIVE_PLAYER 0 with the two-player flag clear; a 2-player start leaves ACTIVE_PLAYER 0 with the flag set. It then runs the pre-play display setup, seeds the top-level state — PLAY_STATE_INDEX 0, MAIN_GAME_STATE = 3 (in-play), GAME_ACTIVE_FLAG (0x8806) [seen] = 1, FLIP_SCREEN_FLAG = 1 (upright) — enqueues the start command, resets the actor tables, primes the periodic-event pair (WAVE_EVENT_LATCH (0x8d21) [seen] cleared, PERIODIC_EVENT_TIMER (0x8d22) [seen] reloaded to 0x20), and enqueues the start-of-life sound. On a two-player game it additionally enqueues the second-player variant and clears a 12-byte block at ANIM_WORK_BLOCK_PTR (0x8e1f) [seen]; that clear is a generic fill, and the cell's real role is the animation work-block pointer (owned by the rendering section).

The pre-play display setup itself is queueCreditDisplayCommands (0x0e54): it enqueues the primary display command and, only when COINAGE_CONFIG reads free play (0x0f), a second free-play command.

### Per-player score, lives and turn alternation

The two players alternate turns, each holding its own score, lives, and saved state page. selectActivePlayerScoreBuffer (0x04f2) resolves the active player's 3-byte BCD score buffer from bit 0 of ACTIVE_PLAYER: clear selects P1_SCORE_BCD (0x88a2) [seen], set selects P2_SCORE_BCD (0x88a5) [seen]. Lives are held separately per player in PLAYER0_LIVES (0x8948) [seen] and PLAYER1_LIVES (0x8988) [seen], both seeded from LIVES_DSW (0x8807) at board reset (each is byte +8 of its player's state bank).

Turn alternation swaps the live gameplay page against the two saved banks. The live page is based at SPEED_INDEX (0x8900) [seen] (its byte 0), and it is copied out to PLAYER0_STATE_BANK (0x8940) [seen] or PLAYER1_STATE_BANK (0x8980) [seen] when a turn ends. saveLiveStateToPlayerBank (0x1a47) copies the 0x3f-byte live page into player 0's bank when ACTIVE_PLAYER is 0 and into player 1's bank otherwise, then clears PLAY_STATE_INDEX. saveLivePageToPlayer0Bank (0x1bab) always snapshots into player 0's bank, but first latches ACTIVE_PLAYER to 1 when this is a two-player game whose player 1 still has lives — that latch is the hand-off to the other player's turn.

### Config-adjacent scheduling cells

The bonus/extra-life award schedule sits right beside the config cells. AWARD_QUEUE (0x8909) [seen] holds a queued BCD score threshold. When it reads 0 the schedule reloads it to 5 or 3 depending on BONUS_AWARD_DSW (0x8800). When it is nonzero it gates on the active player's score high byte (chosen off ACTIVE_PLAYER bit 0) reaching the queued value; on a match it bumps a saturating award tally and BCD-adds the next step — 8 or 7, again per BONUS_AWARD_DSW — into the queue, then runs its two award sub-handlers.

Per-frame scoring draws its increment from one of two config-adjacent sources selected by an award index. Index 0 uses PER_FRAME_SCORE_INCREMENT (0x88ab) [code], a 3-byte BCD increment; any nonzero index reads a 3-byte entry (stride 3) from the ROM table SCORE_AWARD_TABLE (0x0501) [seen]. The chosen increment is BCD-added into whichever score buffer selectActivePlayerScoreBuffer picked, the active player's score column is repainted, and the running counter is compared most-significant-byte-first against the high score.

## In-play progression and timers

Once a game is under way, the top-level game-state selector `MAIN_GAME_STATE` (0x8805) [seen] hands each frame to one of a small family of sibling handlers: a board-build dispatcher, a level-intro dispatcher, and the play handler proper. This section follows what happens inside that play handler — how a round is assembled, driven, and torn down, and the per-player bookkeeping that makes two-player alternation and the on-screen clocks work.

### The per-frame play loop and its sub-state selector

The play handler `runPlayStateFrame` (0x159b) does two things every frame: it ticks the active player's on-screen clock, and then it hands the frame to the in-play sub-state selector. The clock tick comes first; the sub-state dispatch follows and carries the bulk of the round's logic.

That dispatch lives in `loc_15a1` (0x15a1). It reads `PLAY_STATE_INDEX` (0x880a) [seen], masks it to its low five bits, and routes to one of nineteen handlers. The index is not a free-running counter — each handler advances it deliberately, so across a normal round it walks the discrete progression 1, 2, 3, 4, then 7, 10, 13, and 18, with the intermediate values used as transient staging steps as one handler seats the next. Sub-state 0 re-initialises the round arena; 1 through 4 build and start it; the higher values drive active play, phase transitions, the bank save, and the round-end path. Indices 15, 16 and 17 sit beyond the validated frontier and the slack above the table both refuse to run, so a corrupt index halts rather than dispatching into garbage.

### Building a round: the setup phases

Before the play handler ever runs, the board itself is painted by `dispatchBoardBuildSubstate` (0x0c4e), a three-state dispatcher keyed on the same `PLAY_STATE_INDEX` (0x880a) [seen]. Its state 0, `primeTileFillCursorAndAdvanceBoardBuild` (0x0c5c), clears its scratch byte, kicks the watchdog, drops the in-play gate `GAME_ACTIVE_FLAG` (0x8806) [seen], seats the row-fill cursor `TILE_FILL_PTR` (0x880b) [seen] at the playfield paint origin `PLAYFIELD_PAINT_START` (0x8442) [seen], primes the row counter `FILL_ROW_COUNTER` (0x8809) [seen] to fifteen, bumps the sub-state to 1, and clears the board-init RAM regions.

State 1, `fillIntroRowsThenBuildBoardIntro` (0x0c77), does the actual painting one frame at a time. Each call stamps two runs of twenty-nine blank tiles from `TILE_FILL_PTR` (0x880b) [seen], advancing the cursor past each run plus a small gap, and decrements `FILL_ROW_COUNTER` (0x8809) [seen]. While the counter still holds it simply returns, so the board fills progressively over several frames. When the counter drains it advances the sub-state and runs the one-shot intro build: a ROM integrity checksum, the attribute-column flood, the credit-display commands, a two-plane column stamp, a run of display commands whose one- versus two-player variants are chosen off a bonus-award configuration bit, and a pair of sound cues. State 2 hands off through `queueCreditDisplayAndEnterBoardBuild`.

The level's title/intro sequence is a separate machine, `dispatchLevelIntroPhase` (0x6da6), dispatched on `INTRO_PHASE_INDEX` (0x8f51) [seen] across seven phases. Its phase 0, `seatIntroLaunchScriptAndAdvancePhase` (0x6db8), runs the shared per-frame sound run, selects an intro-script timer word from its ROM table indexed by the round counter shifted down two and clamped to seven, seats that word at `LAUNCH_SCRIPT_PTR` (0x8f4a) [seen], primes the intro delay word to 0x40, and advances `INTRO_PHASE_INDEX` (0x8f51) [seen]. On the rounds whose counter has bit 2 set it additionally runs a ninety-six-byte anti-tamper compare of two ROM blocks and diverts on any mismatch. Each later phase handler advances the phase index in turn until the intro completes and play begins.

### Active gameplay and the progression drivers

Sub-state 4, `runActiveGameplayFrame` (0x18af), is the per-frame heartbeat of live play. It runs fourteen sub-handlers in a fixed order — player input, target-lock and aim, enemy-spawn servicing, all the enemy and formation state machines, the sprite display-list rebuild, the difficulty escalators, the actor update pipeline, and the stage-label draw — and then returns. It threads no state of its own; every sub-handler reads its own cells from the live progression block.

That block is the run of per-round scalars beginning at `SPEED_INDEX` (0x8900) [seen], the enemy speed/difficulty index that escalates with the round and indexes the velocity tables. Alongside it sit `STAGE_COUNTDOWN` (0x8901) [seen], counting down over a stage and gating actor AI as it nears zero; `SPAWN_PHASE_COUNTER` (0x8902) [seen], the per-round phase/step counter that cycles to seven selecting spawn and fire modes; `WAVE_ARRIVAL_COUNTER` (0x8903) [seen], bumped on each enemy arrival and bounding the rope segment count; `ROUND_IN_PROGRESS` (0x8904) [seen], the flag raised while a round runs; `ROUND_COUNTER` (0x8907) [seen], the round number rendered on the HUD whose low bits pick stage-type and difficulty variants; and `GAUGE_PHASE_COUNTER` (0x8908) [seen], the phase gauge drawn as the five-cell vertical HUD meter.

Several sub-states exist purely to reseed and re-key this block between phases. `reseedSpawnCountersAndArmPlayMode` (0x1a01) reseeds the spawn counters — writing the reseed result into both `SPAWN_PHASE_COUNTER` (0x8902) [seen] and `ROPE_DRAW_COUNT` (0x8934) [seen] — seats `STAGE_COUNTDOWN` (0x8901) [seen] to 0x30 or 0x28 depending on whether the round has reached two, and bumps `ROUND_COUNTER` (0x8907) [seen]. From there it forks: on the odd-frame path it saves the live state; with the credit gate closed it tears the game down; otherwise it either clears the display-list block or arms the play-mode latch `PLAY_MODE_LATCH` (0x8f50) [seen] (seating a one-tick stage countdown and a launch-script marker) before tailing into the bank save.

`advancePhaseGaugeCountdown` (0x1a64) drives the phase gauge between waves. When `PLAY_MODE_LATCH` (0x8f50) [seen] is set it defers to the spawn-reseed handler; otherwise it runs the reset pair, and — credit gate permitting — counts `GAUGE_PHASE_COUNTER` (0x8908) [seen] down. When the gauge reaches zero (or was already zero) it hands off to the phase-exhausted handler `loc_1a96` (0x1a96), which queues the phase-exhausted tile run, steps the sub-state (an extra step for player one), clears the round cells including `ROPE_SEGMENT_COUNT` (0x8931) [seen], and runs the high-score insert-sort. When the gauge still has phases left it repaints the meter and seats `PLAY_STATE_INDEX` (0x880a) [seen] to 0x0a, or 0x0b for player one.

`advancePlayStateAndStageHighScoreEntryOnTimer` (0x1c03) is gated on the per-frame phase countdown `PHASE_TIMER` (0x8808) [seen]: it decrements the timer and returns until it expires, then plays three sound cues, paints a tilemap column strip and its frame, enqueues a display command, and advances the sub-state to 0x0e. When a new high score has been staged — the insert rank being nonzero — it builds a stride-two column pointer from the wipe base, seeds the wipe tile, and copies a rotate-encoded source table into the display buffer, setting up the column-wipe teardown that follows.

Two more timing cells thread through these handlers. `PHASE_TIMER` (0x8808) [seen] is the general per-phase countdown that the sub-state handlers decrement to time their transitions, and `SUBPHASE_TICK` (0x88b7) [seen] is a period-0x1c tick used as a coarse sub-phase gate. Separately, the main-loop sub-state selector `MAINLOOP_SUBSTATE_SELECTOR` (0x8f5c) [seen] steps the BCD-field painter `loc_10c2` (0x10c2), which repaints the multi-field BCD HUD and bumps the selector on completion; the pixel-level detail of that painter belongs to the rendering section.

### Leaving a round: phase-out, player switch, and continue

The round-end master is `dispatchRoundEndElseWipeColumn` (0x1c66). Every frame it decrements `PHASE_TIMER` (0x8808) [seen]. When the reset-scan latch is armed and the timer has expired, it stamps the reset column, runs an integrity byte-sum over a HUD strip (which must equal a magic value before the re-init proceeds), disarms the latch, and branches on the two-player and lives flags into one of three tails. Otherwise it runs the write-anim pre-pass and, only once a high-score insert has been staged and only every eighth tick, wipes a vertical tilemap column: it walks `WIPE_COLUMN_VRAM_PTR` (0x89fd) [seen] down twenty-eight rows stamping the current `WIPE_COLUMN_FILL_TILE` (0x89ff) [seen], then steps that tile forward with a wraparound clamp so the column cycles through fill values as it clears.

The three tails split the possible exits. `reseedOtherPlayerForTurn` (0x1cf6) handles the player swap: with player one out of lives it falls through to the full clear, but otherwise it clears the sub-state, zero-fills player zero's bank, marks player one active via `ACTIVE_PLAYER` (0x880d) [seen], resets the display pointer, and stamps the scroll column for the incoming turn. `clearActorsAndEnterContinueState` (0x1d15) zero-fills the whole live actor page, reseeds one player's column, and — with credit remaining in `CREDIT_COUNT` (0x8802) [seen] — clears the active gate, arms flip-screen, and drops `MAIN_GAME_STATE` (0x8805) [seen] into its continue state; with no credit left it falls through to the cold teardown. `resetGameToAttractState` (0x1d3c) is that cold teardown: it zeroes the in-play state block (active gate, sub-state, `ACTIVE_PLAYER` (0x880d) [seen], `TWO_PLAYER_FLAG` (0x880e) [seen], attract sub-state), seeds the fresh-start flags — `MAIN_GAME_STATE` (0x8805) [seen] back to its attract value, flip-screen and launch-armed set — zeroes the board RAM, posts the attract sound, and unpacks the attract message table. The small helper `stampSecondScrollColumn` (0x1d0d) that several of these tails call simply writes the three tiles of the second scroll column, top to bottom, through `WORKER_COLUMN_VRAM` (0x8740) [seen].

### The live progression block and the per-player state banks

Everything in the 0x8900 live progression block belongs to whichever player is currently up. Two-player play works by swapping that whole page wholesale against a per-player save area: `PLAYER0_STATE_BANK` (0x8940) [seen] and `PLAYER1_STATE_BANK` (0x8980) [seen] each hold a 0x3f-byte snapshot of the live page.

`saveLiveStateToPlayerBank` (0x1a47) performs the save that most phase transitions tail into: it clears a status byte in the caller-seated page, block-copies the 0x3f-byte live page into player zero's bank — or player one's when `ACTIVE_PLAYER` (0x880d) [seen] is nonzero — and zeroes `PLAY_STATE_INDEX` (0x880a) [seen] so the incoming state starts clean. `saveLivePageToPlayer0Bank` (0x1bab) is the narrower variant used on one specific sub-state: it copies the live page into `PLAYER0_STATE_BANK` (0x8940) [seen] and resets the sub-state, first latching `ACTIVE_PLAYER` (0x880d) [seen] to one when this is a two-player game whose player one is still alive. Both are pure leaves — they touch only these cells. The gate that decides whether any of this runs at all is `GAME_ACTIVE_FLAG` (0x8806) [seen], set at start-of-life and cleared at game-over, with `MAIN_GAME_STATE` (0x8805) [seen] steering the top-level path around it.

### Lives and the player-alternation gates

Each player's remaining lives live in `PLAYER0_LIVES` (0x8948) [seen] and `PLAYER1_LIVES` (0x8988) [seen], both seeded at board reset from the cabinet lives setting `LIVES_DSW` (0x8807) [seen] and drained one per death. These counts are what gate the round-end branching. When a life ends, `TWO_PLAYER_FLAG` (0x880e) [seen] decides whether a swap is even possible; in a two-player game, `ACTIVE_PLAYER` (0x880d) [seen] selects whose turn just ended, and the other player's lives count decides whether control passes to them or the game ends. The swap path zero-fills the outgoing player's bank, flips `ACTIVE_PLAYER` (0x880d) [seen], and reseeds the arena; the game-over path falls through to the continue or cold-teardown tails once both players' lives reach zero.

### The BCD play timers

Each player carries its own on-screen clock as a small BCD bank: `PLAY_TIMER_BCD_P1` (0x8a30) [seen] and `PLAY_TIMER_BCD_P2` (0x8a33) [seen]. In each bank the base byte is a per-frame sub-counter and the two bytes above it are the BCD seconds and minutes digits. Two suppress gates, `PLAY_TIMER_GATE_P1` (0x89e1) [seen] and `PLAY_TIMER_GATE_P2` (0x89e2) [seen], hold the corresponding clock still while set.

The tick itself, `loc_7912` (0x7912), runs first thing each play frame. It bails immediately when the game is inactive, then selects the active player's gate/timer pair off `ACTIVE_PLAYER` (0x880d) [seen] and bails when that gate is set. Otherwise it advances the frame sub-counter toward its rollover limit — fifty-nine or sixty frames, the extra frame chosen by the low bit of the seconds byte — and on the rollover it clears the sub-counter and performs a BCD carry: the seconds digit rolls its low nibble at ten and its high nibble at sixty, and when the seconds reach sixty they clear and carry once into the minutes digit, which rolls the same way. The digits are painted up the column from `PLAY_TIMER_DIGIT_VRAM` (0x862d) [seen]; the rendering of those tiles is detailed in the rendering section.

## Deep states (round 2 and the bonus stage)

The in-play sub-state selector `loc_15a1` (0x15a1) [code] routes the low five bits of `PLAY_STATE_INDEX` (0x880a) [seen] to one of nineteen handlers. Indices 0 through 14 and 18 build, drive, and tear down an ordinary round (above); three more — 15, 16, and 17 — only come into play from round two onward and in the bonus stage, and they route to `loc_1d9c` (0x1d9c) [code], `loc_1d6e` (0x1d6e) [code], and `loc_6bb2` (0x6bb2) [code] respectively. This section follows those three branches and the machinery they reach.

### The round-2 gate and the main-loop worker chain

`loc_1d9c` (0x1d9c) [code] is a per-frame gate keyed on bit 1 of `ROUND_COUNTER` (0x8907) [seen]. While that bit is clear it hands the frame to a second, finer state machine: the main-loop sub-state dispatcher `loc_0fd5` (0x0fd5) [code], which reads `MAINLOOP_SUBSTATE_SELECTOR` (0x8f5c) [seen], masks it to its low three bits, and picks one of six workers — `loc_0fef` (0x0fef) [code], `loc_1016` (0x1016) [code], `loc_1090` (0x1090) [code], `loc_10a2` (0x10a2) [code], `loc_113c` (0x113c) [code], and `loc_114f` (0x114f) [code]. Each worker advances the selector deliberately, so the six run as an ordered per-frame chain rather than a free-running loop.

The workers cover three jobs. `loc_0fef` (0x0fef) [code] is the entry step: it reloads `STAGE_COUNTDOWN` (0x8901) [seen], runs the code-integrity walker on the rounds whose `ROUND_COUNTER` (0x8907) [seen] has bit 2 set, re-arms the three per-frame latches and the sound cue, then latches the pending sub-state and runs the worker chain (idling when that pending value is zero). `loc_1016` (0x1016) [code] is the active-play step: it runs one frame's ten subsystem updates in a fixed order — HUD repaint, lead-actor input, sub-state advance, the object-update gate, the enemy spawns, the enemy-record state sweep, formation dispatch, the sprite display-list rebuild, the actor pipeline, and the sound-ring drain — and its post-pass sibling `loc_1035` (0x1035) [code] runs the four trailing passes (the target-actor step, the per-object sweep, formation-state dispatch, and one more display-list rebuild). The remaining workers keep the on-screen numbers and the frame clocks moving: `loc_10a2` (0x10a2) [code] repaints the three sub-state HUD BCD digit fields and then bumps the selector and queues the phase sound; `loc_1090` (0x1090) [code] and `loc_113c` (0x113c) [code] are frame-delay countdowns that tick a timer down and, on expiry, advance the selector — `loc_1090` also enqueues the bonus-stage tally command `BONUS_STAGE_TALLY_DISPLAY_CMD` (0x0634) [code], and `loc_113c` reloads its timer and enqueues the hunter-spawn command while it counts. `loc_114f` (0x114f) [code] is the sub-state-5 exit: it ticks its countdown, and on expiry clears a nine-byte block from `LATCHED_ENEMY_X` (0x8f5b) [seen], enqueues the silence sound, sets `PLAY_STATE_INDEX` (0x880a) [seen] to 6, and then — unless `SCORE_DRIP_ACCUM` (0x882b) [seen] and its tamper-guard companion sum to zero — hands off to the enemy-spawn slot sweep.

When bit 1 of `ROUND_COUNTER` (0x8907) [seen] is instead set, `loc_1d9c` (0x1d9c) [code] takes the other branch: it runs the level-intro phase dispatcher and then a code-window integrity probe, re-reading one fixed program byte a fixed number of times and latching `INTEGRITY_FLAG_SCAN_BASE` (0x89e7) [code] if that byte is anything but its intact value — so on clean code the probe never fires.

### The enemy-spawn slot sweep

The slot sweep `loc_118d` (0x118d) [code] that `loc_114f` (0x114f) [code] tails into walks up to a caller-supplied count of actor records at a 0x18 stride, handing each to the per-record spawn initialiser with a fixed position seed. It seeds the first free record it finds and then, because the initialiser reloads the remaining count from the spawn-deficit index, stops after that one seed; it no-ops entirely when every record it walks is already active.

### The bonus stage: banner, tally, and the help-clear commit

Two of the deep branches drive the bonus stage. `loc_1d6e` (0x1d6e) [code], reached at index 16, is a countdown on the timer cell `LAUNCH_SCRIPT_PTR` (0x8f4a) [seen] that branches on where the pre-decrement value lands. At the boundary value 0x40 it runs the code-integrity check, enqueues the bonus-stage banner `BONUS_STAGE_BANNER_DISPLAY_CMD` (0x0626) [code], and queues its sound. When the timer instead reaches zero the stage is over: it clears `PLAY_STATE_INDEX` (0x880a) [seen], latches `PLAY_MODE_LATCH` (0x8f50) [seen] to 2, reloads `ENEMY_SPAWN_TIMER` (0x8d07) [seen] to 0x40, and — unless bit 1 of `ROUND_COUNTER` (0x8907) [seen] is set — raises `HUNTER_SPAWN_FLIP_FLAG` (0x8f61) [seen] to arm the next hunter formation.

The commit that ends the bonus stage is `loc_6bb2` (0x6bb2) [code], reached at index 17. It counts the pending-object timer `PENDING_OBJECT_COUNTDOWN` (0x8d5e) [seen] down each frame and does nothing until it underflows. On that tick it walks the eleven stride-3 records of the promoted-object list at `PROMOTED_OBJECT_LIST` (0x8d80) [seen]: for each active record — its stored pointer's high byte nonzero — it writes the record's value byte six bytes past the little-endian address the record holds, crediting the earned value into the target cell. It then sets `PLAY_STATE_INDEX` (0x880a) [seen] to 4 to resume ordinary play and enqueues five help-clear display commands starting at `ATTRACT_HELP_CLEAR_DISPLAY_CMD_A` (0x06ab) [code], the last of which tails into the sprite-display-list rebuild.

### The per-object state sweep

Independently of the sub-state chain, one of the per-frame passes sweeps the enemy-object records. `loc_1219` (0x1219) [code] walks the fourteen records of `ENEMY_ACTOR_TABLE` (0x8ae0) [seen] in order at a 0x18 stride, running the per-object state dispatcher `loc_122c` (0x122c) [code] on each with the record's pointer. `loc_122c` (0x122c) [code] skips a record whose active flag (bit 0 of its two-byte header) is clear or whose sub-state (state byte masked to five bits) is at or past 0x11, and otherwise routes the record to one of seventeen per-object handlers indexed 0 through 0x10. Several of those handlers move and retire objects:

- `loc_1270` (0x1270) [code] steps an object's animation then advances its fine/coarse position countdown by a signed per-frame step; on a coarse rollover it blanks the object's sprite band and runs the retire bookkeeping — decrementing `ACTIVE_ENEMY_COUNT` (0x8d40) [seen], draining `STAGE_COUNTDOWN` (0x8901) [seen] while it is nonzero, bumping `SPAWN_PHASE_COUNTER` (0x8902) [seen] during play-state 4, and mirroring the countdown into `HUD_STAGE_DIGIT_LO` (0x8743) [seen] once it drops below ten.
- `loc_12af` (0x12af) [code] is the travel tick: it steps the animation, and either delegates to the velocity mover (when the record's motion field is set) or accumulates its own position; while `STAGE_COUNTDOWN` (0x8901) [seen] is below three it dispatches to the spawn-cadence path, otherwise it reads the round's target column to spawn a child on a match, hold until the object reaches a coarse threshold, or latch its motion and restart the record on a new animation.
- `loc_1496` (0x1496) [code] steps an object's animation, walks its position by a signed step (decrementing a lap counter on wrap), and then either resets the record to its idle state (an active object whose lap count has run low) or arms its drop state and drop animation (an inactive one whose lap count is lower still).
- `loc_14dc` (0x14dc) [code] is the launch/hunter state-1 handler: it chooses an animation index and countdown, installs the sequence and advances the sub-state, and on countdown expiry renders a doubled packed field as stacked BCD before either arming the turn animation or running a retire step that blanks the sprite band.
- `loc_1518` (0x1518) [code] is a per-frame object update that steps animation and drains a frame timer, and on expiry redraws a doubled HUD field as packed BCD and advances the phase — at the final phase tailing into the turn-animation arm, otherwise reloading the timer, bumping the state, and blanking the sprite band.
- `loc_154d` (0x154d) [code] is the simplest of the family: it steps the animation sequence, drains the object's frame timer, and blanks the actor's sprite band when the timer expires.

Handlers not lifted here — for example the state-0 handler `loc_125f` (0x125f) — round out the seventeen entries.

### Two integrity traps guarding the deep path

Two anti-tamper checks sit on the deep path. `loc_50f1` (0x50f1) [code] is an object-freeze gate ahead of the phase-4 tilemap checksum: when `TAMPER_OBJECT_FREEZE_FLAG` (0x89fb) [code] is set, control diverts into an anti-tamper handler that is unreachable with intact data, so the arm traps; otherwise it runs the checksum guard `loc_6ac5` (0x6ac5) [code]. That guard is a one-shot playfield-tilemap checksum: it does nothing unless the wave index `WAVE_NUMBER` (0x892d) [seen] is exactly 2 and the once-latch `TILE_SUM_ONCE_LATCH` (0x8f56) [seen] is still clear. On the first qualifying frame it latches the once-flag and sums the tilemap column by column and row by row from a fixed video-RAM start — skipping one column and jumping a fixed span at each row end — until the scan leaves the tile page. A correct tilemap reaches a fixed total; a low-byte mismatch diverts into the screen-setup arm `loc_0929` (0x0929) [code] and a high-byte mismatch traps, both reachable only once work RAM has been corrupted, so neither fires on a valid board.

## The actor arena

Everything that moves on screen -- the player, the enemies that swoop and climb, the
projectiles and the spawned objects -- lives in a family of fixed-stride record arrays in work
RAM. The primary one is `ACTOR_TABLE` (0x8a80) `[seen]`, an array of 0x18-byte records
zero-filled at board init. Slot 0 is the player, also called the lead actor: its phase index sits
at `LEAD_ACTOR_STATE` (0x8a82) `[seen]`, its vertical position at `PLAYER_Y` (0x8a84) `[seen]`,
and its joystick/aim byte at `PLAYER_AIM_FLAGS` (0x8a87) `[seen]`. Running in parallel are more
0x18-stride pools, each carved for a different actor family: `ENEMY_ACTOR_TABLE` (0x8ae0)
`[seen]`, `SPRITE_OBJECT_TABLE` (0x8b70) `[seen]`, the six object-state records at
`OBJECT_STATE_RECORD_BASE` (0x8ba0) `[seen]` that run on into `PROJECTILE_TABLE` (0x8be8)
`[seen]`, and `SPAWN_OBJECT_TABLE` (0x8c48) `[seen]`. Wherever these records are walked the shape
is the same: byte 0 is a presence flag (bit 0 set means the slot is live), the state index that
selects a per-record handler lives at +2, and +6 carries a companion state/position field the
lead-actor handlers manipulate.

### Sweeping the records each frame

Three kinds of sweep drive these records each frame, and all three share the same idea: read a
record's state byte, mask it, and hand off to the handler that state names.

For a generic object record, `loc_40d0` (0x40d0) is the per-record dispatcher. It does nothing
unless the record is live (bit 0 of the byte-0/byte-1 pair) and its state `(rec+2)&0x1f` is below
0x11, in which case it dispatches through the 17-entry table at 0x40e1. The object-state cluster
has its own driver: `loc_76f4` (0x76f4) walks the six records from `OBJECT_STATE_RECORD_BASE`
forward at stride 0x18 and runs `dispatchActiveObjectState` (0x7707) on each. That routine skips
an inactive record, then uses the low two bits of the state byte to choose one of four handlers
from the table at 0x7715 -- `armObjectFromSpawnRing` (0x771d), `moveObject` (0x7740),
`drawObjectStackedTiles` (0x7790), and the state-3 branch -- so an object arms, moves, then draws
across successive frames.

The player has a richer, six-way machine. `advanceLeadActorPrimaryState` (0x241e) runs its
per-frame sub-passes, and then -- unless the tamper-freeze flag has tripped -- reads
`(ACTOR_TABLE+2)&7` and dispatches through the handler table 0x2442..0x24fb.
`beginLeadActorLiftOnClear` (0x2442) is state 0: once both tamper-strike tallies are clear it
seeds the record's frame delay, advances the state, snapshots the whole lead record into the
second slot at `ACTOR_TABLE_SLOT1` (0x8a98) `[seen]`, drops the record's +4 position one row,
loads a shape, and queues the tile-run sound unless a teardown is in progress.
`dropLeadActorAfterDelay` (0x2473), `nudgeLeadActorAndAdvanceOnDelay` (0x2497),
`descendLeadActorToLanding` (0x24b9), and `advanceActorDropStateOnDelay` (0x24db) each count a
per-record frame delay at +0x11 down and, on expiry, nudge the record's position, restamp its
shape, and step to the next state -- descend, for instance, ticks an alternate-frame sub-counter
and pushes base Y down two per frame until it reaches the floor at 0xdc. State 5 is
`advancePlayStateToPhase7OnActorDelay` (0x24fb): it counts the same +0x11 delay down and, on
expiry, writes 0x07 into `SCORE_DRIP_ACCUM` (0x882b) `[seen]` when that cell is already nonzero,
otherwise into `PLAY_STATE_INDEX` (0x880a) `[seen]`; then, when the HUD-guard tally at 0x8a3c is
nonzero, it reloads a shape (via the shared shape loader at 0x250f) keyed by whichever cell it
just wrote. The shape loader seats four display tiles into four consecutive records.

### Stepping an animation

Actors animate off small scripted streams. `advanceActorAnimFrame` (0x403c) and its twin
`advanceObjectAnimationFrame` (0x4006) treat +0x0e as a frame-hold counter: while it is nonzero
they simply decrement and return, holding the current frame. On expiry they walk the stream
addressed little-endian by +0x0c/+0x0d, where a 0xff opcode reloads that pointer from the next two
stream bytes (a jump) and any other byte begins a three-byte frame record -- tile into +0x10,
colour into +0x0f, and a fresh hold into +0x0e -- before storing the advanced pointer back.
`advanceActorAnimationFrame` (0x22e6) is the same idea against a shared script cursor,
`ANIM_SCRIPT_CURSOR` (0x8f00) `[seen]`: a normal `{tile, colour, delay}` triple is copied into the
record and the cursor advances past it, while a 0xff control marker replaces the cursor with its
two following bytes and re-reads (the rival full reset to `ANIM_SCRIPT_RESET_PTR` (0x26e7)
`[seen]` is only taken when a target-presence fold reaches 3, which never happens).
`setActorAnimation` (0x381e) and `storeActorAnimationPointer` (0x5c75) are the leaves that install
a new script pointer into +0x0c/+0x0d and zero the +0x0e step so an actor restarts on a fresh
sequence. `tickActorAnimHold` (0x5d1e) is a coarser hold: gated by a per-record animate bit or an
even `ROUND_COUNTER` (0x8907) `[seen]`, it drains a countdown at +0x12 and, at zero, steps a
two-bit phase down and re-arms, disarming when the phase runs out. `ANIM_FRAME_COUNTER` (0x8d41)
`[seen]` is the global sprite-id tick these routines lean on.

### Spawning new actors

New actors are placed by scanning a pool for a free slot. `spawnObjectIntoFreeSlot` (0x3680)
walks a table for the first record whose byte-0/byte-1 pair has bit 0 clear; if the table is full
it does nothing. On a hit it bumps `SLOT_SPAWN_INDEX` (0x8d7b) `[seen]` (and, when the template's
lane bit is armed, decrements `ACTIVE_LANE_COUNT` (0x8d79) `[seen]` into
`LANE_SPAWN_COUNTDOWN` (0x8d75) `[seen]`), steps `ANIM_FRAME_COUNTER` skipping a wrap to zero,
seats the anim vector and fixed fields, builds the attribute byte, and hands to
`spawnActorSlotFromTemplate` (0x379d). That initialiser copies the template's four position bytes
with fixed biases, looks a speed magnitude out of the difficulty-selected table via a
round-clamped `SPEED_INDEX` (0x8900) `[seen]` (negated on an odd round for a mirrored facing;
`DIFFICULTY_DSW` (0x8820) `[seen]` picks the table), seats the anim vector, and queues the spawn
sound. `launchProjectileIntoFreeSlot` (0x3a6c) is the projectile path: it scans the three-slot
`PROJECTILE_TABLE` for a free record, seeds its coordinate pair from a round-selected table, arms
the launcher's own animation and a hit-flash sequence, and stores a rotating display attribute. A
parallel path fills the secondary `SPRITE_OBJECT_TABLE` (0x8b70) `[seen]` pool with child actors: once an
approaching enemy reaches its target column (`loc_12d0`, 0x12d0) it tail-jumps through the range guard
`spawnChildActorIfInRange` (0x1383) `[seen]`, which bails when the column index is out of range (0x20 or
above) and otherwise hands off to the free-slot child spawner `loc_13bc` (0x13bc).
`initActorRecord` (0x619f) and `seedObjectRecord` (0x0a0c) are the low-level seeders that stamp a
fresh record's opening bytes and its descriptor/coordinate fields. At board boundaries the arena
is wiped: `clearActorArena` (0x19bc) zero-fills the 0x200-byte block from `ACTOR_TABLE`, and the
state-7 teardown `clearActorArenaAndCounters` (0x2ae8) zeroes an even larger span and then clears
`SPAWN_PHASE_COUNTER` (0x8902) `[seen]`, `WAVE_ARRIVAL_COUNTER` (0x8903) `[seen]`, and
`ROPE_SEGMENT_COUNT` (0x8931) `[seen]` before forcing `PLAY_STATE_INDEX` to 6. Live population is
tracked in `ACTIVE_ENEMY_COUNT` (0x8d40) `[seen]`, and the spawn cadence itself is metered by the
`ENEMY_SPAWN_TIMER` (0x8d07) `[seen]` countdown. Each time the enemy-record initialiser `loc_119a`
(0x119a) seeds a free `ENEMY_ACTOR_TABLE` (0x8ae0) `[seen]` slot it bumps `ACTIVE_ENEMY_COUNT` and, in
the adjacent instruction, the cumulative `HUNTER_SPAWN_COUNT` (0x8f5f) `[seen]` — a running spawn-init
tally that, unlike the per-wave live count beside it, is never reset, so it accumulates across the whole
game; nothing on the spawn path reads it back.

### Stacking the player sprite

The player is drawn as three sprites stacked vertically, and their Y bytes are all derived from
one value. `deriveStackedSpriteYs` (0x23d7) reads `PLAYER_Y` and fans it out to the Y fields of
stacked slots 3, 2, and 1: slot 3 gets the base Y, slot 2 gets Y-0x10, and slot 1 sits 0x0a
below slot 2's top. The player's own input is folded into slot 0 by `loc_1e55` (0x1e55): while
play is active (and no board-clear or teardown latch is set) it reads the joystick port -- one of
two ports chosen by the flip-screen flag -- complements it into `PLAYER_AIM_FLAGS`, rotates the
top bit through `INPUT_ROTATE_LATCH` (0x8f03) `[seen]`, and clears bit 4 unless that latch's low
three bits equal 1; if any abort condition holds it simply zeroes the aim byte instead. Vertical
motion runs through a direction split: `movePlayerVerticallyAndTickStatusRender` (0x2329) reads
the aim byte's bit 2 and either steps the player up here (decrement Y, clamp to 0x41, refresh the
stacked Ys, then advance a status-render ring) or defers to
`movePlayerDownAndTickStatusRender` (0x236a), which steps Y down toward the floor at 0xc0, again
refreshes the stacked Ys, and ticks the same render tail.

### The object-proximity collision scan

Collisions are found by sweeping actor coordinates against object records. `loc_5d4d` (0x5d4d)
runs the proximity test at 0x5d68 for three targets, holding a fixed source at
`PROXIMITY_SOURCE_OBJECT` (0x889c) `[seen]` while it walks the target slots at
`SPRITE_TARGET_SLOTS` (0x887c) `[seen]` (stride 4) against the records in `PROJECTILE_TABLE`
(stride 0x18); a clean pass advances to the next target, and the moment the test scores a hit the
whole sweep unwinds. A companion six-slot overlap scan uses `precheckCollisionBounds` (0x5f53) to
bias an actor's X by the flip-screen flag `FLIP_SCREEN_FLAG` (0x881f) `[seen]` and test whether
its Y plus a margin clears the bottom limit 0xe0; `advanceOverlapScanToNextSlot` (0x6018) is the
loop latch that steps the coordinate window (`SPRITE_SCAN_ACTOR_SLOTS` (0x8868) `[seen]` at +0/+2,
scanned with the y-slots at `SPRITE_SCAN_YSLOTS` (0x8852) `[seen]`) to the next record or finishes
the no-hit sweep. On a match `engageMatchedSpriteObjectAndResetActor` (0x6190) seats the target
record's engaged fields (state 0x01 at +8, parameter 0xd0 at +0xa) and falls into
`resetActorRecordQueueSoundAndAbortFrame` (0x6166), which resets the actor record to its idle
opening bytes, queues one of two sounds chosen by `ACTIVE_OBJECT_TYPE` (0x8d44) `[seen]` (0x08
when the type is 3, else 0x05), clears the type, and aborts the rest of the frame's object work.
The per-hit flags `OBJ_HIT_FLAG_I0` (0x8d1b) `[seen]` and `OBJ_HIT_FLAG_I1` (0x8d1c) `[seen]`
pulse for one frame on a collision, and `PROXIMITY_HIT_FLAG` (0x8d54) `[seen]` records that a
target-in-band hit was scored.

Layered over the scan is the aim-lock subsystem that paints the aiming indicator.
`driveAimIndicatorHitTimerElseRescan` steps whatever mode `AIM_INDICATOR_MODE` (0x8d52) `[seen]`
holds: mode 0 runs the redraw pass, mode 1 lights the "above" bit of the aim flags and any higher
mode the "below" bit, then drains `AIM_INDICATOR_TIMER` (0x8d53) `[seen]` and clears the mode when
it hits zero. The redraw pass, `clearAimIndicatorUnlessProximityHit` (0x6c18), scans three
projectile records for a target-in-band hit and, only if all three come back clean, clears the
above/below bits and zeroes `PROXIMITY_HIT_FLAG`. `acquireTargetLockAndSetAimIndicator` sits on
top: it runs only when `GAME_ACTIVE_FLAG` (0x8806) `[seen]` and `GRAB_ACTIVE_FLAG` (0x8d32)
`[seen]` are both clear, drops the indicator during a wave teardown, otherwise steps the indicator
and bails on a proximity hit. Failing that, `LAUNCH_STATE` (0x8f30) `[seen]` value 1 forces
"above", an existing lock in `TARGET_LOCK` (0x8f40) `[seen]` is re-evaluated, and if neither holds
it scans six `ENEMY_ACTOR_TABLE` blocks against the y-slots for the closest in-band target (band
0x40..0xc0), records the five-byte lock, and sets the above/below bit by comparing the target
against the player reference at `SPRITE_DISPLAY_LIST` (0x8840) `[seen]` +2.

### Teardown

Actors leave the arena in a couple of ways. `advanceActorToTopRowThenRetire` (0x667c) advances an
idle actor upward one sub-position per frame, carrying whole rows into +6, and once it reaches the
retire row 0x1d it marks the record retired (state byte at +1 becomes 2) and clears its position
fields. When a moving object despawns, `loc_34b0` (0x34b0) blanks the actor's sprite band,
decrements `ACTIVE_ENEMY_COUNT` and the depth counter `STAGE_COUNTDOWN` (0x8901) `[seen]`, and
renders that depth as two HUD digits from `HUD_STAGE_DIGIT_LO` (0x8743) `[seen]`, packing it to
BCD when it reaches 0x0a or above. A struck object follows the engage/reset chain above: its
record is seated engaged, the actor record is reset to idle, the collision sound is queued, the
active object type is cleared, and the frame's remaining object processing is abandoned so the
teardown settles cleanly before the next sweep.

## Waves, rope and launch

Above the player's rescue platform Pooyan runs three interlocking loops: waves of enemy actors that descend, travel and drop; the rope that the player extends and that objects hang and are caught from; and the arrow/launch sequence that promotes idle actors into the diving hunters and, on the bonus stage, into the eagle. All three read the same handful of per-wave counters and all three act on stride-0x18 actor records, so the machinery is best read as one system.

### The enemy attack wave

A wave begins in `spawnEnemyWave` (0x17c1) [seen], the play-state handler that seeds it. It chooses a seed table and a tile-anim cursor from `PLAY_MODE_LATCH` (0x8f50) [seen] and the parity of `ROUND_COUNTER` (0x8907) [seen], seeds four records at `ACTOR_TABLE` (0x8a80) [seen] (each stamped active with a pair of table bytes), seats the shared animation cursor and steps the animators. On the branch where the play-mode latch is nonzero and `ROUND_COUNTER` bit 1 is set it fans out a whole sprite group into `ENEMY_ACTOR_TABLE` (0x8ae0) [seen]: the group size (five to eight, saturating) is written to `TARGET_GROUP_COUNT` (0x8f47) [seen], each slot gets a packed coordinate and the shared retire animation, and the handler then advances the play sub-state.

Every frame the wave is swept twice, by two dispatcher families. The primary sweep is `dispatchAllEnemyActorStates` (0x3377) [seen], which walks the fourteen `ENEMY_ACTOR_TABLE` records and hands each to `dispatchActiveEnemyActorState` (0x338a) [seen]. That dispatcher runs only for an active record whose state byte (masked to 0x1f) is below 0x11, then routes seventeen states (0x00 through 0x10, the last being a ROM checksum guard) to their handlers. The interesting motion states cluster around state 5, `advanceEnemyActorMotion` (0x39af) [seen]: it steps the record's animation, then splits on `ROUND_COUNTER` parity — even frames hand to the horizontal-travel handler, odd frames to the vertical mover.

The vertical mover, `advanceEnemyVerticalAndDispatchByAltitude` (0x39ba) [seen], advances the record's fractional position by its signed velocity, borrowing into the high byte on underflow, and then branches on altitude: with a zero state byte it delegates to `armActorDropAnimationNearTop` (0x3a51) [seen], which — only when the actor is within two of the very top — seats the drop animation, marks the record dropping, and reloads its phase timer; a high byte below 4 resets the sub-state through `resetActorSubstateAndReloadStateTimer` (0x3a48) [seen] (clearing the sub-state and reloading the state timer to 0x20); below 0x10 it simply returns; and at or above 0x10 it falls into the fire/drop gate. The travel handler, `advanceTravelingEnemyToArrival` (0x3b87) [seen], advances the integer position along velocity, blanks the sprite band once the actor lands (position 0x1b) on the no-state path, and on the state-nonzero path keeps travelling until position 0x1d, at which point it retires the actor — advancing state, clearing the travel flags, and queuing the retire animation.

The fire decision lives in `fireEnemyShotWhenAlignedWithPlayer` (0x39e0) [seen]. It gates on the level counters — a high `WAVE_PROGRESS_COUNTER` (0x8d7d) [seen] (0x0e or more), a high `ROUND_COUNTER`, a too-low `GAUGE_PHASE_COUNTER` (0x8908) [seen], or a late wave — routing through an extra difficulty gate keyed on `DIFFICULTY_DSW` (0x8820) [seen]. Its shared firing tail bails while the global `LANE_SPAWN_COUNTDOWN` (0x8d75) [seen] is running, ticks a per-actor cooldown when armed, and otherwise derives a target column from the launcher's X (mirrored when the screen is flipped) and the frame parity, spawning a shot only when that column matches the actor's position.

Two more handlers round out the primary sweep. `resolveTargetColumnAndArmApproach` (0x357c) [seen] resolves a wanted tile — from a per-frame table row when no lane is active, or from an alternate lane table when one is — and, on an exact match, tails into the pre-spawn guard; short of a threshold it returns, at or above it latches the record and arms one of two approach-animation scripts. That same resolver is also reached through a commit-latch guard, `resolveActorTargetUnlessCommitted` (0x3625) [seen], which the per-actor phase dispatcher `loc_362d` (0x362d) [seen] tail-jumps to once the record's phase byte (ix+6) reaches 0x14: unless the record's +0x08 latch bit 0 marks it already committed, it delegates straight into `resolveTargetColumnAndArmApproach` in the same tail frame. `armEnemyTurnAnimation` (0x3d99) [seen] enters the turn/select animation state: it picks one of three sequences by the record's low two bits, installs it, arms the entry velocity and state bytes, and queues the accompanying sound. When a dropped object finally lands it reaches state 0x0f, `advanceFallingEnemyAndTallyCatchOnLanding` (0x3f7c) [seen]: still airborne it just ticks the fall, but on landing it installs the splash animation for the caught kind, resets the record, scores the catch, drops `ACTIVE_ENEMY_COUNT` (0x8d40) [seen], and (normal path) decrements `STAGE_COUNTDOWN` (0x8901) [seen] and repaints it, or (special path) zeroes the countdown, repaints, and runs an integrity checksum.

The second dispatcher family drives a smaller set of records. `updateEnemyActorsAndCycleLaunchFlipAnim` (0x66c5) [seen] runs `dispatchEnemyActorState` (0x66f1) [seen] over three consecutive records, then — unless the lead state byte is clear — steps a per-frame countdown that, on expiry, reloads, advances a flip toggle, and enqueues the launch-flip display command in one of two variants. `dispatchEnemyActorState` itself is a four-way router on the record's state byte, covering the descent/ascent lifecycle. Its descent leg is `loc_29a0` (0x29a0) [seen]: it reseats the frame-hold, toggles the display tile between two shapes every fourth frame, and drives a descent counter down by two; below the floor it either diverts to a countdown/redirect step (when a gate byte is set) or reseeds the spawn timer, advances the record state, and runs two block self-checks — a running sum and a byte compare against a reference. Only when both checks pass clean does it enqueue `DESCENT_STATE_COMPLETE_DISPLAY_CMD` (0x0614) [seen].

Speed and cadence come from a few ROM tables. When a child actor is spawned, the enemy velocity is looked up from `ENEMY_SPEED_TABLE` (0x148e) [seen] indexed by `SPEED_INDEX` (0x8900) [seen] clamped below eight, and negated on odd rounds to mirror the facing. The spawn cadence between "still spawning" and "fully grown" is paced by a per-round reload pulled from `STATE_TIMER_RELOAD_TABLE` (0x13d3) [seen] indexed by the round counter. The point at which a travelling object begins its turn animation is `TURN_COLUMN_LIMIT` (0x8d4b) [seen]: the X-movement handler compares the actor's masked column against it, arms the turn-around past it, and on the first arm at the limit bumps a capped animation phase, looks a fresh limit out of an animation table, and stamps the interior sprite band. Progress across a wave is tracked by `WAVE_INDEX` (0x8f3d) [seen] (bumped per wave, wrapping after the fourth), the number of records arrived in `WAVE_RECORDS_ARRIVED` (0x8f39) [seen] against the wave's record count, the inter-wave gate `WAVE_HOLD_TIMER` (0x8f36) [seen], and `WAVE_PROGRESS_COUNTER`. At the end of a level the bonus is settled by comparing `TARGET_GROUP_COUNT` against the running `HIT_TALLY` (0x8f52) [seen].

### The rope

The rope is driven on even frames by `driveRopeExtendAndRenderCells` (0x2d66) [seen], which bails while `GRAB_ACTIVE_FLAG` (0x8d32) [seen] is set or while `WAVE_ARRIVAL_COUNTER` (0x8903) [seen] still sits at its hold value, then runs two sub-drivers in order. The first is `dispatchRopeExtendState` (0x2d78) [seen], a two-state machine on `ROPE_EXTEND_STATE` (0x8f14) [seen]. State 0, `addRopeSegmentAndAdvanceExtendState`, stops once `ROPE_SEGMENT_COUNT` (0x8931) [seen] has grown to two below the stage's arrival count; otherwise it bumps the count and, while `ROPE_EXTEND_INDEX` (0x8f18) [seen] is below four, advances that index, looks the segment's video column out of `ROPE_CELL_COLUMN_TABLE` (0x2db8) [seen] into `ROPE_COLUMN_VRAM_PTR` (0x8f19) [seen] (fixed to video page 0x84), reloads that segment's cell timer in `ROPE_CELL_TIMERS` (0x8f28) [seen], advances the sub-state, and arms `ROPE_EXTEND_TIMER` (0x8f16) [seen]. State 1 counts that sub-timer down and, on each expiry, either blits the current animation frame's tile block at the rope column and bumps a frame index, or — once the eight-frame sequence completes — resets the index and state and re-arms the next rope cell. The number of rope rows drawn is snapshotted separately in `ROPE_DRAW_COUNT` (0x8934) [seen].

The second sub-driver, `driveActiveRopeCells` (0x2e22) [seen], walks one cell per counted rope index and hands each to a per-cell dispatcher that selects one of four handlers. The one that carries the grab is `advanceHangingRopeObjectWithGrabCheck` (0x2f01) [seen]: it first runs the grab-trigger test and, if a grab fires, abandons the cell update entirely; otherwise it ticks the cell's frame timer through `tickRopeCellFrameTimer` (0x2e45) [seen] (which decrements one of the four `ROPE_CELL_TIMERS` chosen by the low two bits of the cell index) and, on the frame that timer reaches zero, re-arms it to a fixed reload, walks into the `FORMATION_TABLE` (0x8c30) [seen] by the byte after the timer to drop one record's tile field, force its position to 0xc0 and bump another field, advances the cell state, and blits the segment's 2x2 square from `ROPE_SEGMENT_TILE_SRC` (0x2dfe) [seen] to its video column.

### The arrow and the launch

The arrow/launch sequence is a five-state machine on `LAUNCH_STATE` (0x8f30) [seen], driven each frame by `dispatchLaunchState` (0x2778) [seen] and sequenced together with the target-actor passes by `runLaunchAndTargetActorPipeline` (0x2101) [seen] (which runs the launch driver, then the trigger spawn, then the paired-slot scan). State 0 is `armLaunchAndAdvanceToHunterSpawn` (0x278f) [seen]: it arms `LAUNCH_ARMED_FLAG` (0x8f3f) [seen] once its preconditions hold — bumping `LAUNCH_ARM_LATCH` (0x8f20) [seen] while the lane countdown is up and the latch is still clear, otherwise requiring a `STAGE_COUNTDOWN` that is nonzero and a multiple of eight — and then returns until the arrow has risen far enough (`ARROW_Y` (0x8ab4) [seen] at or above 0x3c) and neither hunter-target record `ENEMY_TARGET_REC0` (0x8c90) [seen] nor `ENEMY_TARGET_REC1` (0x8ca8) [seen] reads a hit. Clearing those gates it steps the launch state, reseeds the flip countdown, may light a HUD cell, refreshes the arm latch from its seed, and blits the launch tile. The later states — `spawnEnemyTargetOrAnimateLaunchFlipTile`, `spawnHunterIntoTableAndAdvanceLaunch`, `advanceLaunchOnDelayAndClearHunterRecord`, and `loc_28c5` — carry the sequence through target spawn, hunter spawn, delay, and completion.

The one-shot target spawn is `spawnTargetActorOnLaunchTrigger` (0x210b) [seen]. It samples and clears the actor-table trigger bit; only a fresh trigger with the once-latch clear proceeds. It arms the latch, optionally marks the first target slot special when launch is far enough along and the second slot is ready-idle, then scans the two target slots for a free one and seeds it — position from the actor source, two timers, an optional buffer clear, a pair of side flags — before stepping the animators. The two live target records are stepped by `stepActiveTargetActorRecords` (0x2157) [seen], which runs `advanceTargetActorState` (0x21cf) [seen] on each present record and then runs a tamper check on the animation-script cursor. `advanceTargetActorState` splits on the record's flags: a launch sub-phase that raises the object's Y by four each tick until it exits the top and the record is cleared; otherwise a one-time prime (queuing a display command) followed by either the two-axis mover or a hit-timer/countdown that clears the record on expiry, consuming `OBJ_HIT_FLAG_I0` (0x8d1b) [seen] or `OBJ_HIT_FLAG_I1` (0x8d1c) [seen] by slot parity. The two-axis mover is `advanceTargetActorAlongVelocityElseDespawn` (0x2226) [seen]: it reloads the phase's motion params when the phase counter empties, integrates the X and Y velocities into the record, and — once the Y high byte reaches 0xe8 — marks the object spent, clearing `LAUNCH_STATE`, `LAUNCH_ARMED_FLAG`, and the launch scratch cells before blanking the record.

Sitting alongside the launch machine is the formation sub-machine that produces the diving hunters. `loc_308b` (0x308b) [seen] is the manager: while disabled it does nothing; while `FORMATION_STATE` (0x8f08) [seen] is nonzero it dispatches the low two bits (less one) of the state to a phase handler and then runs the shared epilogue; while idle it scans the enemy records for launch-ready slots, registers each record pointer into the slot table off `FORMATION_SLOT_TABLE` (0x8920) [seen] and marks it queued, arming the formation once the fourth entry fills the table. Phase 0 is `loc_30f1` (0x30f1) [seen], the hunter-formation launch: it seeds the four slot records from `HUNTER_LAUNCH_PARAM_TABLE` (0x3337) [seen] (fields +4/+6/+0x0f/+0x10 plus a fixed delay), primes the frame-timer block and bumps the formation state, blanks a 3x3 video block, seats `HUNTER_SCRIPT_PTR` (0x8f4b) [seen] to `HUNTER_SCRIPT_TABLE` (0x3370) [seen], queues a sound, and self-checks the routine's own copy against its original. The swoop step then walks that active script from `HUNTER_SCRIPT_PTR`; while the dive is not yet armed, once the lead hunter crosses the player position it latches `WAVE_TEARDOWN_STATE` (0x8f24) [seen] and repoints `HUNTER_SCRIPT_PTR` at `DIVE_SCRIPT_DATA` (0x3348) [seen], switching the swoop into a dive. The shared epilogue is `loc_32bd` (0x32bd) [seen], keyed on `WAVE_TEARDOWN_STATE`: state 1 dismantles the wave (clearing `WAVE_EVENT_LATCH` (0x8d21) [seen], reseeding `PERIODIC_EVENT_TIMER` (0x8d22) [seen], and running a self-check), and state 2 walks the lead actor down the screen two positions per frame until it reaches its limit, then queues the completion command and raises the grab latch. Each of the four formation records is separately advanced through its object state by `dispatchFormationObjectStates` (0x40bd) [seen].

The individual hunters live in a table scanned downward from `HUNTER_TABLE_BASE` (0x8c78) [seen]: `spawnHunterIntoTableAndAdvanceLaunch` walks the six records for the first free slot, stamps its opening state, coordinates and tile ids, records the slot pointer, and advances the launch state. Each hunter record carries its own movement cursor into `HUNTER_MOVE_SCRIPT` (0x2d00) [seen], seeded by `loc_2c85` (0x2c85) [seen]: when a record reaches state 0x11, `loc_2c85` advances it to 0x12, installs an animation sequence, points the record's script pointer at `HUNTER_MOVE_SCRIPT`, and clears its script step. Walking that script, a 0xff byte latches the record's field +15, an 0x88 opcode advances the record's state, and any other byte is a signed X-delta applied to the hunter. A separate formation-spawn path feeds the same kind of records on a timer: `loc_2b9a` services the countdown in `FORMATION_SPAWN_TIMER` (0x8d30) [seen] and, on zero, scans `FORMATION_SPAWN_TABLE` (0x8c60) [seen] downward for a free slot; `spawnFormationEnemiesOnTimer` is a second frame-timer-gated spawner over that same table, choosing a per-frame spawn count from the round and difficulty. The dive script pointer itself is tracked in `LAUNCH_SCRIPT_PTR` (0x8f4a) [seen].

### The eagle bonus wave

The bonus stage reuses the launch and target-actor machinery to fly the eagle, and its two phase bodies are `runEagleApproachPhaseFrame` (0x71c7) [seen] (the approach state machine plus the shared per-frame object update) and `runWaveLaunchPhaseFrame` (0x72a0) [seen] (the shared update plus the wave-launch driver). A wave is seeded by `seedNextEagleWave` (0x72e1) [seen], but only while the target slot `ENEMY_TARGET_REC0` is clear: it raises `WAVE_LAUNCH_FLAG` (0x8f3a) [seen] and advances `WAVE_INDEX`; on the fourth wave it merely re-arms `WAVE_OUTER_PHASE` (0x8f38) [seen] and reloads `WAVE_HOLD_TIMER`; otherwise it initialises `WAVE_RECORD_COUNT` (0x8f3c) [seen] records (twice the wave index) in `ENEMY_ACTOR_TABLE` from a parameter table, then clears the outer phase and `WAVE_RECORDS_ARRIVED`. The eagle's own live coordinates are the same target record's fields — `EAGLE_Y_COORD` (0x8c94) [seen] at +4 (its grid row) and `EAGLE_X_COORD` (0x8c96) [seen] at +6 (its grid column) — the very cells the arrow/launch pipeline's target-actor steppers integrate.

The per-frame heart is `advanceEagleApproachAndPaintGridMarker` (0x71ce) [seen]. A hold counter in `WAVE_HOLD_TIMER` gates entry. Once it clears, the machine drives the player's aim indicator in `PLAYER_AIM_FLAGS` (0x8a87) [seen] from the eagle's approach coordinate (read from `PLAYER_Y` (0x8a84) [seen]) against a near and a far X threshold, latching the enemy X into `LATCHED_ENEMY_X` (0x8f5b) [seen] once the coordinate crosses the far threshold; exactly at the near threshold it steps the records-arrived sub-phase. On the final sub-phase, once armed, it advances a grid pointer every eighth frame — timed by `EAGLE_GRID_STEP_TICK` (0x8f3b) [seen] — stamping a marker tile and its colour attribute, and delegates the grid-edge guard and the phase-reset epilogue. The guard is `armEagleFinishAtGridEdge` (0x7287) [seen]: it reads the eagle's advancing grid coordinate (`EAGLE_Y_COORD`) and, while short of the grid edge 0xd0, hands it back so the machine keeps stepping; at the edge it arms `EAGLE_FINISH_FLAG` (0x8f3e) [seen] and runs the epilogue. That epilogue, `advanceEaglePhaseAndClearAim` (0x7292) [seen], drops the aim flags and the latched enemy X, advances the eagle-wave outer phase one step, and clears the records-arrived sub-count so the next phase starts fresh.

## Rendering, HUD and display lists

Everything Pooyan draws lands in one of two planes of the 0x8000 video page: the tile-code
plane at VIDEO_RAM_BASE (0x8400) [seen], read cell-by-cell by the board renderer as the glyph
index, and the colour/attribute plane at COLOR_RAM_BASE (0x8000) [seen] (its playfield body
based at ATTRIB_MAP_BASE (0x8040) [seen]), which supplies each tile's palette and its two flip
bits. Both planes are 32 columns wide with a 0x20-byte row stride, so every routine below that
"steps one row" adds or subtracts 0x20. Sprites live apart, in two hardware banks the vblank
handler fills from a work-RAM display list; the renderer scans them ascending so the highest slot
wins an overlap.

### Clearing and filling the tile plane

The screen is wiped a row at a time under a small two-cell state pair. seedTileFillCursor (0x02e6)
arms it: it stores the caller's pointer as the 16-bit TILE_FILL_PTR (0x880b) [seen] write cursor
and seeds FILL_ROW_COUNTER (0x8809) [seen] to 0x20, so the fill walks thirty-two tilemap rows,
each pass writing a run then advancing the cursor by a row and dropping the counter until it hits
zero and the fill's owning state advances. The screen re-init has its own bulk paint: it stamps a
0x1d-by-0x1d field of the blank tile 0x10 from PLAYFIELD_PAINT_START (0x8442) [seen], one row down
per line. The boot erase is coarser still, flooding erase tile 0x1e across the whole tile region
from VIDEO_RAM_BLANK_START (0x8440) [seen] through 0x87ff.

### Painting the colour/attribute plane

fillAttributeColumns (0x075d) floods the attribute plane with per-column colour bytes. It walks
thirty-one columns out from ATTRIB_MAP_BASE (0x8040) [seen]; for each column it takes one source
byte and stamps it down all thirty rows at the 0x20 stride, then advances the source one byte to
the next column. The source is a ROM column table chosen by the caller: the round-init handlers
pass FIELD_ATTRIB_SRC_A (0x0839) [seen] when the round counter's low bit is set and
FIELD_ATTRIB_SRC_B (0x0879) [seen] when it is clear, while the alternate field-strip job draws from
FIELD_ATTRIB_SRC_C (0x0859) [seen]; the attract setup floods from its own table. The routine is a
pure leaf — it touches only the attribute cells.

### The two-plane column blitter

loc_0cf8 stamps a strip that spans both planes at once. It reads a source table of twelve-byte
columns beginning at COLUMN_BLIT_TILE_SRC (0x0d2f) [seen], writing each column bottom-up (stride
-0x20) into the tile-code plane starting at COLUMN_BLIT_TILE_DEST (0x86a7) [seen]. A steering byte
follows each column: 0xff switches the source to COLUMN_BLIT_ATTR_SRC (0x0d48) [seen] and the
destination to the attribute-plane base COLUMN_BLIT_ATTR_DEST (0x82a7) [seen], so the same loop then
lays colour behind the tiles it just drew; 0xee ends the stamp; any other value is simply the first
byte of the next column, one cell to the right.

### The scrolling columns

The per-frame worker loc_0254 keeps the playfield's moving tile columns fresh. When its gate
WORKER_CONTROL_BYTE (0x883f) [seen] has a nonzero low nibble it only runs the program-signature
check and returns; otherwise, while GAME_ACTIVE_FLAG (0x8806) [seen] is set, it repaints two
three-tile columns. In one-player mode it clears four columns with blankTileColumn (0x02b1) — which
writes blank tile 0x10 into three cells one stride apart and hands back the advanced pointer so the
next column chains from it — sweeping COLUMN_CAP_VRAM (0x84e0) [seen] and the three columns from
P2_SCORE_VRAM (0x8521) [seen]. In two-player mode it instead stamps a capped body column with
paintColumnBodyTiles (0x02aa), which lays the mid tile 0x25 and base tile 0x20 below a cap. It then
paints the shared scroll column at WORKER_COLUMN_VRAM (0x8740) [seen], all cells stepping one row
up, and finally blanks one more column (the WORKER_COLUMN_VRAM one when ACTIVE_PLAYER (0x880d)
[seen] is zero, else the cap column) only when the control byte's bit 4 and the game-active bit are
both set. paintColumnBodyTilesUp (0x1cec) is the fixed-up-stride sibling of the body paint, writing
the same mid/base tiles but always stepping one row up from its start.

### The block-stamp primitives

A family of small copiers moves fixed rectangles of tile codes from ROM into video RAM.
paintTileBlock2x2 (0x0a40) copies four source bytes into a 2x2 tilemap block anchored top-left, in
the order top-left, top-right, bottom-right, bottom-left; paintTileBlock2x2Above (0x780f) is the
bottom-anchored twin whose top row sits one row above the anchor. blit2x2TileBlock (0x3325) is the
video-RAM 2x2 square used by the animators: top-left, top-right (+1), bottom-right (+0x21),
bottom-left (+0x20), returning the bottom-left cell so a caller can step up a row for the next
square. blitTile3x3Block (0x3307) lays a three-wide, three-tall block (three source bytes per row,
then +0x1d to the next screen row), advancing both destination and source so a chained caller draws
the next glyph straight from the advanced source; the round-marker glyphs are drawn this way from
MARKER_GLYPH_SRC (0x2754) [seen]. blitGlyphBlock4x3 (0x1f8c) is the four-row, three-column variant,
advancing the destination low byte within its page per row.

### The sprite display list

Sprites are rebuilt every frame from the object-record banks. loc_02ef assembles the list at
SPRITE_DISPLAY_LIST (0x8840) [seen] by calling copyObjectRecordsToDisplayList (0x032a) for each
group: it emits record bytes +0x06, +0x10, +0x04, +0x0f into four successive list slots per record,
stepping the record pointer by its 0x18 stride and chaining the list pointer forward. Four groups
go in — the two lead actors from ACTOR_TABLE (0x8a80) [seen], the two enemy-target records from
ENEMY_TARGET_REC0 (0x8c90) [seen], the eighteen moving-object records from ENEMY_ACTOR_TABLE
(0x8ae0) [seen] (with coordinate math), and the two arrow/launch records — after which the arrow
group's two sprite-Y bytes are nudged down a pixel. The list overlaps windows the drivers read as
SPRITE_ACTOR_RECORD_SLOTS (0x8848) [seen] and SPRITE_TARGET_SLOTS (0x887c) [seen]. When the screen
is flipped, mirrorSpriteListVertically (0x0378) rewrites the twenty-four stride-4 entries in place,
negating and offsetting each coordinate byte (-x - 0x10) and toggling the attribute byte's two flip
bits while keeping its low nibble; whether it runs is gated on FLIP_SCREEN_FLAG (0x881f) [seen]. The
vblank handler then copies the finished list into the two sprite banks, laying attribute bytes from
SPRITE1_CLEAR_BASE (0x9410) [seen] and position bytes from SPRITE0_CLEAR_BASE (0x9010) [seen]; in
play-state 4 it threads four grouped copies across the cursors, otherwise a single 0x18-tall copy,
and feeds the last byte written to the watchdog.

### The display-command ring

Rendering work that a state handler wants done later is posted to a command ring rather than drawn
inline. loc_0038 enqueues a two-byte display command into DISPLAY_CMD_RING_BUFFER (0x88c0) [seen], a
thirty-two-slot buffer on page 0x88: if the slot at DISPLAY_CMD_RING_WRITE_PTR (0x88a0) [seen] is
free (bit 7 set) it stores the command's high byte there and the low byte in the next slot, advances
the write pointer by two, and wraps it back to the ring start (low byte 0xc0) once it falls below
it; an occupied slot silently drops the command. The command WORDs are a large family of two-byte
constants scattered through the handlers — object spawn (OBJECT_SPAWN_DISPLAY_CMD (0x0611) [seen]),
descent completion (DESCENT_STATE_COMPLETE_DISPLAY_CMD (0x0614) [seen]), the target-match /
target-mismatch pair (TARGET_MATCH_DISPLAY_CMD (0x0610) [seen] and TARGET_MISMATCH_DISPLAY_CMD
(0x0608) [seen]), the two siren phases (SIREN_DISPLAY_CMD_A (0x060f) [seen] and SIREN_DISPLAY_CMD_B
(0x068f) [seen]), the attract-setup and wave-spawn words, and so on — all sharing the same
high-byte-then-low-byte encoding.

The main loop drains the ring. It reads the slot at DISPLAY_CMD_RING_READ_PTR (0x88a1) [seen]: a
slot with bit 7 set is the per-frame worker marker, and hitting it runs loc_0254 and closes the
frame; any other slot is a command, so it takes the two bytes, frees them, advances and wraps the
read cursor, and dispatches on the command index (the slot byte doubled, masked to 0x1f) through the
handler table at 0x0242. Those handlers are the concrete painters — the count column, the phase
gauge, the high-score/score panels, the per-player score columns, the credit counter — so the ring
is what actually times each screen region's redraw against the rest of the frame.

### The display-list interpreter

paintDisplayListRunToVram (0x4381) walks a compact layout stream into the tilemap. It first picks a
pointer pair: the primary pair, source DISPLAY_LIST_SRC_PTR (0x8f45) [seen] and destination
DISPLAY_LIST_DST_PTR (0x8f43) [seen], or the alternates DISPLAY_LIST_SRC_PTR_ALT (0x88ba) [seen] and
DISPLAY_LIST_DST_PTR_ALT (0x88b8) [seen] when FORMATION_SLOT_TABLE (0x8920) [seen] is nonzero. It
then processes up to 0x1d source bytes: a plain byte is copied straight to the destination (the
destination in practice landing on tilemap cells such as DISPLAY_LIST_VRAM_TILE (0x8565) [seen]); a
0x10 opcode reads the following byte, advances the destination by that amount and shrinks the
remaining budget; a 0xff opcode reloads a fresh destination from the next two stream bytes and folds
the byte after it into SUBPHASE_TICK (0x88b7) [seen]. On exit the advanced pointer pair is written
back to whichever pair was chosen, so successive calls resume where the last left off.

### BCD and the HUD number primitives

Numbers reach the screen through a set of BCD helpers. splitBcdByte (0x0429) takes a packed-BCD byte
and writes its low nibble as a tile at the cursor, advances the cursor, and hands back the high
nibble (with a leading-zero sense on the high digit). drawStackedBcdDigits (0x1119) paints a packed
byte as two stacked tiles — tens at the cursor, units one tilemap row up — blanking a zero tens
digit. renderDigitWithBlanking (0x059d) paints one digit tile with a running leading-blank budget:
a real digit ends the blank run, a zero draws the blank tile 0x10 while the budget lasts and a
genuine 0 once it is spent, threading the advanced cursor and remaining budget to the next digit.
byteToPackedBcd (0x062a) converts a binary byte to packed BCD (value mod 100), and binToPackedBcd
(0x1131) converts a binary count to its low two BCD digits plus a hundreds tally (a zero counter
meaning a full 256 passes). loc_10c2 is the multi-field painter that ties them together: it walks a
counter toward a new value (up or down by the entry direction), stores it in SUBSTATE_FIELD1_COUNTER
(0x8f62) [seen] and draws it doubled at SUBSTATE_FIELD1_VRAM (0x85d0) [seen]; draws
SUBSTATE_FIELD2_VALUE (0x8f5e) [seen] at SUBSTATE_FIELD2_VRAM (0x8652) [seen] (raw when a single
digit, else re-encoded); and, when SUBSTATE_FIELD3_VALUE (0x8f60) [seen] is nonzero, folds it into
the counter and draws it doubled at SUBSTATE_FIELD3_VRAM (0x85d2) [seen], mirroring the hundreds
digit out to SUBSTATE_FIELD3_HUNDREDS_VRAM (0x85f2) [seen] when present, before advancing the
main-loop sub-state and queueing a sound cue.

### Scores, the high-score table, and the panels

selectActivePlayerScoreBuffer (0x04f2) returns the active player's three-byte BCD buffer —
P1_SCORE_BCD (0x88a2) [seen] when ACTIVE_PLAYER (0x880d) [seen] is even, P2_SCORE_BCD (0x88a5)
[seen] when odd. loc_0496 accrues a score: gated on the game-active flag, it BCD-adds either the
per-frame increment or a table award into that buffer, repaints the player's column, then compares
the counter most-significant-byte-first against the high score at HIGH_SCORE_BCD (0x88a8) [seen] and
copies it over when strictly greater. The score columns themselves are drawn by loc_056b (0x056b),
which paints a chosen counter up its column with leading-zero blanking into P1_SCORE_VRAM (0x8781)
[seen], P2_SCORE_VRAM (0x8521) [seen], or HIGH_SCORE_VRAM (0x8641) [seen]; loc_0552 (0x0552) is the
reset-and-repaint variant that zeroes a counter first. loc_03e9 draws the whole attract HUD: eleven
selector-indexed character fields, then the ten-entry high-score table from HIGH_SCORE_TABLE
(0x8a00) [seen] rendered as stacked BCD digit pairs into HIGH_SCORE_TABLE_VRAM (0x85c7) [seen] (each
source byte split low-then-high a row apart, the top digit's leading zero suppressed, the column
re-based two cells right per row), and finally the digit panel and, via renderPanelFromTable
(0x0460), the status panel. That routine walks ten rows of three cells, copying each byte of
PANEL_TILE_SOURCE (0x8e00) [seen] into PANEL_VRAM_DEST (0x8567) [seen] (or blank tile 0x40 for a
zero cell), the first two cells of a row climbing one row and the third re-basing to the next
column.

### Round, stage label, and countdown readouts

renderStageCountdownDigits (0x34c9) draws STAGE_COUNTDOWN (0x8901) [seen] as a two-cell HUD number
at HUD_STAGE_DIGIT_LO (0x8743) [seen]: a value under ten draws as a single units digit, ten or more
converts to packed BCD first (and that path is suppressed while PLAY_MODE_LATCH (0x8f50) [seen] is
held), with the tens tile placed one row over and a leading zero blanked. The vertical phase gauge
is drawn by renderPhaseGauge (0x03c2) — with paintPhaseGauge (0x2065) an identical routine called
from a second site: reading GAUGE_PHASE_COUNTER (0x8908) [seen], a zero count leaves the gauge
alone, otherwise (count - 1) cells clamped to five are filled with tile 0xb0 from
PHASE_GAUGE_BASE_TILE (0x863f) [seen] upward and the rest blanked. The round-marker glyphs are
stamped as 3x3 blocks from MARKER_GLYPH_SRC (0x2754) [seen] around MARKER_VRAM_BASE (0x86c3) [seen].

### The status-render ring

A shared render pacer redraws a small status field on a fixed cadence.
tickStatusRenderRingAndRedrawOnWrap (0x23a1) decrements the mod-8 ring STATUS_RENDER_RING (0x88bd)
[seen]; while it stays nonzero the display holds, and on wrap it borrows one from the mod-4
STATUS_RENDER_PHASE (0x88bc) [seen] and falls into wrapRenderPhaseAndPaintTileTriplet (0x23ad). That
tail masks the phase to 0..3, looks up a tile-block descriptor for it in STATUS_RENDER_TILE_TABLE
(0x26f6) [seen], and stamps three 2x2 blocks two rows apart from STATUS_RENDER_VRAM_BASE (0x8425)
[seen], the third alternating between STATUS_FIELD_TILE_A (0x270a) [seen] and STATUS_FIELD_TILE_B
(0x270e) [seen] on the phase's low bit.

Alongside it runs a tile-cycling cursor pair split by frame parity. advanceTileAnimForwardOnOdd
(0x2405) bumps TILE_ANIM_PARITY (0x8f37) [seen] and acts only on odd frames: it either steps
TILE_ANIM_CURSOR (0x88be) [seen] forward and reseeds the new cell to tile 0x34, or animates the
current cell's tile code up by one until it reaches the wrap code 0x37. retreatTileAnimScript
(0x23ec) is the even-frame half, walking the cursor's tile back — a 0x34 marker reloads the base
tile 0x10 and backs the pointer up a cell, any other value simply decrements in place.
blitTwoTileAnimFrameOnHoldTimer (0x2563) is a hold-timer animation: idle while PLAY_MODE_LATCH is
busy, it counts TWOTILE_ANIM_HOLD (0x8f06) [seen] down and, on expiry, reloads it (0x0c) and steps
TWOTILE_ANIM_PHASE (0x8f07) [seen]; the round parity (ROUND_COUNTER (0x8907) [seen]) and the phase
parity then pick one of four 4-byte source blocks in TWOTILE_SRC_TABLE (0x2744) [seen] and one of
two anchors (READY_SPRITE_TILE_VRAM (0x87bb) [seen] or TWOTILE_ANIM_VRAM_ALT (0x84bb) [seen]), which
is stamped as two 2x2 squares stacked. blinkTilePairOnCountdown (0x76af) is a two-phase blinker:
BLINK_COUNTDOWN (0x892a) [seen] drains, then reloads (0x16) and toggles BLINK_PHASE (0x892b) [seen],
picking a two-byte tile pair from BLINK_TILE_PAIRS (0x76e6) [seen] by parity and writing it into
BLINK_TILE_CELL_0 (0x8471) [seen] and the cell 0x40 past it, swapping the blinking tiles.

### The write-anim text animation

The write animation is a per-frame pre-pass that grows a run of tile writes into the tilemap.
loc_7e94 is its redirect: while RESET_SCAN_LATCH (0x8e2a) [seen] is set the animation is finished
and skipped, and while HIGH_SCORE_INSERT_RANK (0x89fc) [seen] is zero the latch is armed and the
pass skipped; otherwise WRITE_ANIM_HANDLER_SELECT (0x8e26) [seen] picks one of three handlers, and
every path finally polls the start button. Handler 0, loc_7eb2, seeds the work block: it stashes
the stamp base DISPLAY_LIST_VRAM_TILE (0x8565) [seen] into WRITE_ANIM_WRITE_PTR (0x8e27) [seen], sets
WRITE_ANIM_ROW_COUNT (0x8e25) [seen] to 3 and the 16-bit WRITEANIM_COUNTDOWN (0x8e2b) [seen] to the
fire-phase seed, then — starting from the record-array anchor WRITE_ANIM_RECORD_ANCHOR (0x8dfd) [code] —
walks a record pointer (+3 per pass) into ANIM_WORK_BLOCK_PTR (0x8e1f) [seen] and the stamp pointer (+2 per
pass) for as many passes as the insert rank, so the record pointer settles at 0x8dfd + 3×rank (always at or
past 0x8e00, since this handler runs only for a nonzero rank); it stamps a landing byte,
seeds WRITE_ANIM_TILE_INDEX (0x8e23) [seen], sets WRITE_ANIM_STEP_DELAY (0x8e24) [seen] to 0x0c, and
selects handler 1. Crucially it also latches the source pointer (held in the work cell loc_8e21) to
INPUT_PORT1 (0x8811) [seen] by default, or INPUT_PORT2 (0x8812) [seen] when the cabinet flag
CABINET_MODE_FLAG (0x880f) [seen] is clear and ACTIVE_PLAYER (0x880d) [seen] is nonzero — so the
animation's tempo is driven by whichever control port the running player is using.

Handler 1, loc_7f0e, drives the index. It drains the 16-bit WRITEANIM_COUNTDOWN (0x8e2b) [seen] and
hands off to the tail at zero; otherwise it reads the source byte through loc_8e21 and, on its bit 3
/ bit 2 flags, steps WRITE_ANIM_TILE_INDEX (0x8e23) [seen] down (wrapping at low bound 0x10 back to
0x2c) or up (wrapping at high bound 0x2c back to 0x10), gated each time by the WRITE_ANIM_STEP_DELAY
(0x8e24) [seen] sub-timer that reloads to 0x0c; with both flag bits clear it passes straight to the
append handler with no step. The stepped index is written through the stamp pointer, then it falls
into loc_7f5d. Handler 2, loc_7f5d, rotates bit 4 of the source byte into WRITEANIM_PHASE_RING
(0x8e29) [seen] and returns unless the ring's low three bits settle on the fire phase; on that phase
it re-seeds the countdown, appends the current index byte through ANIM_WORK_BLOCK_PTR (0x8e1f) [seen]
and advances that pointer, then decrements WRITE_ANIM_ROW_COUNT (0x8e25) [seen] — delegating to the
tail when it empties, otherwise writing the index at WRITE_ANIM_WRITE_PTR (0x8e27) [seen], backing
that pointer up one row (0x20), re-priming the cell there, and reselecting handler 1 for the next
row. loc_7fa8 is the shared tail: it queues a silence sound cue, then — when the row count is still
nonzero — floods that many cells with fill tile 0x10, stepping a tile pointer back one row group and
a record pointer up by one, before reloading PHASE_TIMER (0x8808) [seen] to 0x80, clearing
WRITE_ANIM_HANDLER_SELECT (0x8e26) [seen], and setting RESET_SCAN_LATCH (0x8e2a) [seen] to mark the
animation done.

## Sound

Pooyan drives its audio hardware through a single one-byte port. Everything the game
wants to hear — a coin tick, an arrow launch, an enemy hit, the attract-mode warning
siren — is reduced to a small numeric command code, and the entire sound subsystem is
just the machinery for choosing those codes, queueing them, and paying them out one per
frame to the audio processor.

### Handing a byte to the audio CPU

The bottom of the whole stack is `sendSoundCommand` (0x0e8f) [seen]. It takes a single
command byte and writes it into `SOUND_COMMAND_LATCH` (0xa100) [seen], the port the audio
processor reads. Writing the byte is not enough on its own; the audio side has to be told
a fresh command is waiting. So the routine then strobes `AUDIO_IRQ_LATCH` (0xa181) [seen]:
it raises the latch to 1 and immediately lowers it back to 0, and that rising edge is what
interrupts the audio processor into reading the new byte. The width of the pulse in the
original is nothing but a short timing pad with no state behind it, so the idiomatic form
keeps only the two writes that matter — raise, then lower. `sendSoundCommand` returns
nothing anyone reads; its whole effect is the latched byte and the pulse that announces it.

### The command ring

The game rarely calls `sendSoundCommand` directly during play. Instead, events deposit
command bytes into a small circular buffer and let a once-per-frame drainer pay them out,
so a burst of events in a single frame does not step on itself. That buffer is
`SOUND_RING_BUFFER` (0x8a43) [seen], sixteen slots running 0x8a43 through 0x8a5e, filled
with 0xff (empty) at boot. A write cursor `SOUND_RING_WRITE_PTR` (0x8a40) [seen] and a read
cursor `SOUND_RING_READ_PTR` (0x8a41) [seen] chase each other around it, each wrapping from
the last slot (0x5e) back to the first (0x43).

Two enqueue paths feed the ring. `enqueueSoundCommandRing` (0x0eb3) [seen] is the plain
one: it drops the byte into the slot the write cursor names and advances the cursor,
wrapping at the end — no conditions attached. `appendSoundCommandGated` (0x0ea2) [seen] is
the gated one: it first stashes the incoming byte in `SOUND_RING_PENDING_BYTE` (0x8d20)
[seen], then appends it only while a game is running or the play-mode latch is set,
otherwise dropping it; on a successful append it leaves the advanced cursor behind for a
caller to read. Both paths write into the same physical slots.

Draining happens exactly once per frame. `drainSoundCommandRing` (0x0e64) [seen] is called
from the vblank service routine loc_066d — the game's sole per-frame heartbeat — so one
queued byte is handed onward each frame. It reads the slot under the read cursor; if that
slot is empty it does nothing. Otherwise it decides whether to make noise at all: it stays
silent only when both attract-mode demo sounds are disabled and no game is active, and in
every other case it passes the byte to `sendSoundCommand`, which latches it and pulses the
interrupt. It then writes 0xff back into the slot to free it and advances the read cursor.
That is the bridge from the queue to the port: enqueue anywhere, and the frame's single
drain step feeds one byte to `sendSoundCommand`.

### The command set the game emits

Above the ring sits a family of thin selectors, each of which names one fixed command byte
and hands it to the ring. The `queueSoundCommand00` (0x0ecf) [seen] through
`queueSoundCommand0F` (0x0f1d) [seen] wrappers do exactly this — for example
`queueSoundCommand00` enqueues 0x00 (silence), `queueSoundCommand09` (0x0f01) [seen] enqueues
0x09, and `queueSoundCommand0F` appends 0x0f. Some of them go through the plain enqueue and
some through the gated append, but each is essentially a named constant.

Layered on top are a few composites and conditionals. `emitPresetSound` (0x0f09) [seen] is
special: rather than queueing, it hands its fixed code 0x0b straight to `sendSoundCommand`,
bypassing the ring for an immediate hit. `queueSoundCommands82And03` (0x0eda) [seen]
enqueues the pair 0x82 then 0x03. `queueSoundCommand04IfNotBusy` (0x0ee3) [seen] appends
0x04 only when neither the wave-teardown state nor the grab-active flag is set, dropping it
while either is busy. Two routines emit multi-byte runs: `queueFixedSoundCommandRun`
(0x0fc1) [seen] appends the fixed run 0x29,0x15,0x16,0x17, and `queueRoundSoundCommandRun`
(0x0f97) [seen] picks its lead byte from the round counter (two of its bits added to a base
of 0x1e) and then appends the shared completing run 0x15,0x16,0x17. Which event emits which
code is covered by the drivers below.

### The drip driver — coin and credit ticks

When a coin is inserted, the credit accrues over several frames as the drip logic rotates
input pulses through a small cadence ring, and each accepted pulse is meant to click.
`accrueCreditFromCoin1Pulse` (0x5a56) [seen] handles coin slot one: each frame it rotates
one input bit into its cadence ring, and only on the exact accept phase does it act. On that
phase, before it does any credit arithmetic, it calls `emitPresetSound` — so the coin/credit
tick is that immediate 0x0b hit. It then bumps the pulse counter and steps
`SCORE_DRIP_ACCUM` (0x882b) [seen] by 0x10, carrying into the coinage configuration when the
accumulator overtakes it. Its sibling `accrueCreditsFromCoinSlot2` handles coin slot two
identically, again firing `emitPresetSound` on the accept phase before advancing its own
coordinate pair. The audio angle here is simply that both drip steps announce an accepted
coin pulse with the same preset click; the credit arithmetic around it belongs to the
config section.

### The fire and hit driver

Gameplay events reach for the command selectors directly. When the player fires, the launch
state handler `spawnEnemyTargetOrAnimateLaunchFlipTile` animates the arrow's flip tile and
queues command 0x0a (`queueSoundCommand0A`) as the launch is worked; the target/arrow
object's own step, `advanceTargetActorState`, primes its record once and at that moment
queues command 0x01 (`queueSoundCommand01`). When an enemy turns into its select animation,
`armEnemyTurnAnimation` arms the record and tail-queues command 0x02 (`queueSoundCommand02`).

Hits run through a small dispatch. `dispatchHitToEnemyRecordElseQueueSound` scans the enemy
actor records for the one whose tag matches the collision key; on a match the matched-record
handler takes over, and with no match it queues command 0x05 (`queueSoundCommand05`) unless
the active object type is already 3. `resetActorRecordQueueSoundAndAbortFrame` resets a
struck actor record to its idle opening state and then queues one of two codes by the current
object type — 0x05 normally, or 0x08 (`queueSoundCommand08`) when the type is 3 — before
unwinding the frame. Catching a falling enemy is scored with a pair:
`advanceFallingEnemyAndTallyCatchOnLanding` queues commands 0x82 then 0x03 on the landing.

### The siren driver

The attract-mode warning siren is a small state machine spread across a few cooperating
pieces. `loc_19ca` is the tick: it runs only while no game is active and the siren is
enabled through `SIREN_ENABLE_GATE` (0x8d68) [seen]. Each call decrements
`SIREN_FRAME_COUNTDOWN` (0x8d6a) [seen]; until that reaches zero nothing else happens. On
expiry it reloads the countdown (0x18 frames) and flips `SIREN_PHASE_BYTE` (0x8d69) [seen]:
one phase resets the byte to 0 and queues `SIREN_DISPLAY_CMD_B` (0x068f) [seen], the other
sets it to 1 and queues `SIREN_DISPLAY_CMD_A` (0x060f) [seen], so the siren alternates
between its two phases roughly every 0x18 frames.

Firing the siren's tile run is driven by a periodic-event countdown. `loc_196e` is the gated
periodic driver: it does nothing while `PERIODIC_MODE_LATCH` (0x8d55) [seen] is non-zero,
and otherwise selects behaviour from the spawn-phase value — at phase five it arms the
siren-enable pair and fires a sound run, above five it latches the mode and fires a higher
run. Its shared tail returns early if `WAVE_EVENT_LATCH` (0x8d21) [seen] or the wave-teardown
state is set; otherwise it runs `PERIODIC_EVENT_TIMER` (0x8d22) [seen] down, and on expiry it
reloads that timer (0x20), raises `WAVE_EVENT_LATCH`, and calls `queueSirenSoundRun` (0x0f76)
[seen]. That helper, while the siren gate is clear, appends a round-selected lead byte (a
base of 0x1a offset by the round counter's low bit) followed by the completing sound-command
run. The latch is later cleared on wave teardown (loc_32bd), which reseeds the periodic
timer, so the cycle can arm again.

### The record/replay audio model

None of this drives a live audio processor. Per the manifest, the second (audio) Z80 is not
emulated at all; the manifest marks its ROM images present but unmodelled, and the audio
block declares a clips model — `manifest.audio.map` points at "audio/sounds.js" and
`manifest.audio.samples` at the "audio/samples" directory. The sound map in audio/sounds.js
confirms the arrangement: it is data only, declaring `model: "clips"` and `soundLatch:
0xa100`. Because the game's only audio output is the byte it writes to that latch (0xa100),
the player keys off each latch write and replays a recorded clip captured for that command
code. In other words the main CPU behaves exactly as on hardware — it latches command bytes
and pulses the interrupt — but instead of a synthesised voice, each command byte selects a
pre-recorded sample to play back. There is deliberately no separate control port modelled;
only the 0xa100 write is forwarded, matching how the recorded clips are indexed.

## Anti-tamper

Pooyan is riddled with self-checks. A dozen-odd routines scattered across boot, attract, the play loop, the HUD painter and even ordinary actor handlers stop what they are doing, re-derive a checksum or signature over a fixed slice of the program image, and compare it against a baked-in expected value. On a clean ROM every one of them balances and the game plays normally; the interesting behaviour lives entirely on the failure arms, which is why almost every strike counter reads static-zero and is honestly tagged `[code]`.

### The guards, and where they hide

The signature and ROM-image guards form the backbone. `verifyRomSignature` (0x208c) walks the 16-byte `SIGNATURE_REFERENCE_TABLE` (0x20aa) [seen] against every eighth byte of the code region from `SIGNATURE_SAMPLE_BASE` (0x066d) [seen]; the first byte that differs sets `SIGNATURE_MISMATCH_FLAG` (0x8ef0) [code] to 1 and stops. `verifyRomChecksum` (0x3fe9) sums sixteen read-only bytes descending from `ROM_CHECKSUM_TOP` (0x7780) [seen] into one byte and reads its shape — a healthy image has bit0 clear, bit5 set and bit7 set — and any other shape bumps `TAMPER_STRIKES_STATE10` (0x8a39) [code]. `verifyTableChecksum` (0x585b) folds a caller-sized block into a 16-bit accumulator and passes only when the sum is high 0x1d, low 0xc1; on any other total it writes 1 into `SCORE_DRIP_ACCUM` (0x882b) [seen]. That last write is a secondary, unreached facet of a multiplexed cell whose reached role is a score/credit-drip accumulator — it is not a dedicated tamper flag.

A cluster of guards hide inside routines that look like ordinary play-state or spawn work. `flagTamperOnRound5ChecksumMiss` (0x5b06) arms only when `ROUND_COUNTER` (0x8907) [seen] equals 5, sums six fixed program bytes, and bumps `TAMPER_FREEZE_FLAG` (0x881e) [code] unless the low sum plus its carry count plus 0x7f wraps to zero. `loc_1b43` — a play-state handler that also clears a tilemap row, floods attribute columns and copies a message string — folds a 34-byte block from `TAMPER_CKSUM_BASE_5593` (0x5593) [seen] with a mask/rotate/add-with-carry and bumps the same `TAMPER_FREEZE_FLAG` when the rolling result is not 0x7c. `loc_1bcc`, which snapshots the live page into `PLAYER1_STATE_BANK` (0x8980) [seen], then folds the low five bits of fourteen bytes from `TAMPER_CHECKSUM_CODE_BASE` (0x5328) [seen] onto the advanced copy pointer and bumps `TAMPER_STRIKES_SIG` (0x8a38) [code] unless the fold matches its sentinel word. `loc_5594`, a frame-timer spawner tail, checks an eight-byte guard region against its two's-complement signature at the first free slot and bumps `TAMPER_FREEZE_FLAG` on any nonzero pair. `loc_52f6`, a gated slot sweep, folds a 23-byte code block from `SLOT_SWEEP_CKSUM_BASE` (0x0bf3) [seen] and bumps `TAMPER_STRIKES_SLOTSWEEP` (0x89e8) [code] on a mismatch. `advanceEnemyToArrivalAndTallyWave`, an object arrival handler, sums an 0x12-byte window from `STATE0_CKSUM_BASE` (0x01d5) [seen] on its lane-reset path and bumps `TAMPER_STRIKES_STATE0` (0x89ed) [code] unless the sum is 0x55. `startSelectedPlayerGameConsumingCredits`, after consuming two credits on a 2P start, folds a credit checksum table and bumps `CREDIT_TAMPER_COUNTER` (0x89ea) [code] when the folded result is nonzero. `advanceActorStateOnTimerWithTamperCheck`, an actor state handler, folds a block backward from `ACTOR_TAMPER_CKSUM_TOP` (0x4282) [code] and bumps `SIGNATURE_MISMATCH_FLAG` on a bad result.

Two periodic guards straddle a shared address. `loc_7e6d` runs only while `PLAYER1_LIVES` (0x8988) [seen] is at least four and `FRAME_COUNTER` (0x8a5f) [seen] is at its zero crossing; it sums the image downward from `TAMPER_CKSUM_TOP_ADDR` (0x64be) [seen] to a 0x34 sentinel and bumps `TAMPER_STRIKES_ROM` (0x89ef) [code] when the carries-plus-sum keeps any bit of 0xb0. The terminator match-scan guard `loc_64be` walks `TERMINATOR_SCAN_SRC` (0x0bc2) [seen] downward against `TERMINATOR_MATCH_TABLE` (0x64d0) [seen] read upward, stopping at a 0x01 sentinel (clean) and bumping `TAMPER_STRIKES_TERMINATOR` (0x8df9) [code] on the first differing byte.

The playfield's own tiles are checked too. Guarded once-only by `TILE_CHECKSUM_LATCH` (0x8f55) [seen], `loc_68ac` and `loc_3278` sum the playfield tilemap region and look the running total up in `TILE_CHECKSUM_TABLE` (0x68eb) [seen] — first the low byte against four entries, then the wrap-count/high byte against the paired entries. A miss cannot arise from intact data, so the failure arm is an out-of-range branch into what is data on a clean image, modelled as a hard integrity trap. `loc_324d` reaches `loc_3278` from the board-clear path. The colour map is guarded by `reinitRoundArenaAndPlayfieldIfImageIntact` (0x67df), which sums ten colour-map cells one row apart from `HUD_INTEGRITY_STRIP_A` (0x82bc) [seen]; if the sum is not 0x5a it hands the frame to the per-object updater instead of re-initialising the arena. The same code window is the subject of a reversed-reference check: the actor state-5 handler `loc_2a96` compares `STATE5_SIGCHECK_CODE_BASE_ADDR` (0x67df) [code] read upward against the reversed reference `STATE5_SIGCHECK_REF_TOP` (0x2b23) [code] read downward for 0x20 bytes, and a single mismatch diverts into the state-2 handler rather than reseating the record.

The intro and attract paths carry their own copies. The level-intro phase-4 self-check `loc_6f9d` compares `PHASE4_TAMPER_ORIG` (0x6ac5) [seen] against its data copy `PHASE4_TAMPER_COPY` (0x6fed) [code] byte for byte; a full match queues its normal sound and display commands, while a mismatch wipes the work-RAM page forward from its base, bricking the run. `advanceAttractToBoardBuildIfImageIntact` (0x7071) [code] is the anti-tamper clone of `advanceAttractSequenceToPlay`, entered when the primary copy is found patched: it verifies the `HUD_INTEGRITY_STRIP_A` column (each cell equal to the one a row above), column-checksums a tile block against the pointer stored in `INTRO_DELAY_CKSUM_WORD` (0x8f48) [seen], and only on a clean pass clears that word, sets `MAIN_GAME_STATE` (0x8805) [seen] to 3 and advances to the board builder; any failure diverts to the attract reset. `seedDisplayListPointersAndVerifyRomSignature` runs a two-stage program-signature check at attract state 0 — eight boot bytes from `BOOT_CODE_BASE` (0x0000) [seen] then a 0x74-byte window from `SELFTEST_LOOP2_SCAN_BASE` (0x0092) [seen], each against its verbatim reference in `SELFTEST_REF_COPY_BOOT` (0x749a) [seen] — and a window divergence diverts into the screen re-init handler. Attract sub-state 1 (`loc_08e9`) straddles a fill re-arm and a colour flood with two data-table integrity sums, one of them over `ATTRACT_INTEGRITY_CKSUM_BASE` (0x0831) [seen], each an unreachable trap on a tampered table.

The HUD and boot round it out. The credit-draw tripwire `loc_05ee` draws `CREDIT_COUNT` (0x8802) [seen] as two digit tiles and, only when the units digit is exactly 2, sums 31 bytes downward from `HUD_GUARD_CKSUM_TOP` (0x64c8) [seen], bumping `TAMPER_STRIKES_HUD_GUARD` (0x8a3c) [code] on a miss of 0x8c. `runDisplayListAndAdvanceToGameplay` column-sums two fixed video-RAM strips and traps unless the total is exactly 0x014f. The shared timer-render handler `loc_7960` folds a block from `INTEGRITY_CHECKSUM_CODE_BLOCK` (0x2901) [seen] against the four guard bytes trailing it, traps on disagreement, and later scans `INTEGRITY_FLAG_SCAN_BASE` (0x89e7) [code] and runs a tail sum against `TAIL_CHECKSUM_GUARD` (0x7a0b) [seen]. `flagHighScoreTableCorruptOnChecksumMiss` (0x0644) requires a 0xc8 header at `HISCORE_CHECKSUM_BASE` (0x778a) [seen] and a summed-minus-carry total of 0x59, else raises `HISCORE_TABLE_CORRUPT_FLAG` (0x8df8) [seen]. Finally the boot entry `loc_0092` takes a 24-bit rolling sum over each 4K bank against `ROM_SELFTEST_CHECKSUM_TABLE` (0x0079) [seen], seeding `ROM_SELFTEST_TALLY` (0x8fff) [seen] at the bank count and bumping it once per matching bank so a full pass lands at 0x10; `loc_072d` refuses to finish the attract-to-play setup and falls back to the main loop unless the tally reads 0x10.

Across all of them the failure arm takes one of three shapes: it lands in a strike counter or flag (a plain data cell), it branches to bytes that are only data on a clean image (a hard trap, or the phase-4 work-RAM wipe), or it diverts the flow onto a reset or re-init path.

### The tally cells

`TAMPER_FREEZE_FLAG` (0x881e) [code] is the master miss-tally, incremented by the round-5, `loc_1b43` and `loc_5594` guards. Around it sits a row of per-check strike counters, each bumped by exactly one guard: `TAMPER_STRIKES_ROM` (0x89ef) [code], `TAMPER_STRIKES_SIG` (0x8a38) [code], `TAMPER_STRIKES_STATE0` (0x89ed) [code], `TAMPER_STRIKES_STATE10` (0x8a39) [code], `TAMPER_STRIKES_TERMINATOR` (0x8df9) [code], `TAMPER_STRIKES_SLOTSWEEP` (0x89e8) [code], `TAMPER_STRIKES_HUD_GUARD` (0x8a3c) [code] and `CREDIT_TAMPER_COUNTER` (0x89ea) [code]. Several of these live inside the seven-byte integrity flag block based at `INTEGRITY_FLAG_SCAN_BASE` (0x89e7) [code] that `loc_7960` scans. Two more flags stand apart: `SIGNATURE_MISMATCH_FLAG` (0x8ef0) [code], set by the signature and actor-timer checks, and `HISCORE_TABLE_CORRUPT_FLAG` (0x8df8) [seen], set by the high-score header/checksum guard.

Almost the entire set reads static-zero on a legitimate ROM, which is exactly why they carry `[code]` rather than `[seen]`: with the image intact every guard balances, no failure arm ever runs, and none of these cells is ever written during normal play. They change only under tampering that a legitimate image never triggers — hence the role is read from the code, with grounding still open. (`HISCORE_TABLE_CORRUPT_FLAG` earns `[seen]` because its guard's read of the checksum header runs on a clean image, even though the flag itself stays zero.)

### What a nonzero tally does

A raised tally never scores or animates anything — it degrades the machine. When `TAMPER_FREEZE_FLAG` is nonzero, `advanceLeadActorPrimaryState` runs its three sub-passes and then returns without running the lead actor's state handler at all, so the player stops advancing; `paintRoundNumberHud` skips the whole round-number HUD build (it still runs the per-frame update chain, but the round digits and glyphs never get laid down); and `loc_6e75`, the phase-1 spawner gate, finds its skip-spawn arm — taken when `SIGNATURE_MISMATCH_FLAG` or `TAMPER_FREEZE_FLAG` is set — pointing into data, so spawning simply cannot proceed on a tampered image.

The board-clear and object-freeze flags do the coarse-grained shutdown. `advanceGameStateOnCreditOrStartPress` arms `BOARD_CLEAR_FLAG` (0x89e5) [seen] whenever its HUD-strip reference scan or sub-state lookup disagrees with the live screen. Once set, that flag diverts handlers onto the board-clear path: `loc_324d`, on a hunter-return borrow, hands the frame to the tile-sum check `loc_3278` instead of continuing, and `loc_1e55` — the per-frame joystick sampler — zeroes the player-actor aim/state byte `PLAYER_AIM_FLAGS` (0x8a87) [seen] and returns the moment either `BOARD_CLEAR_FLAG` or `TAMPER_OBJECT_FREEZE_FLAG` (0x89fb) [code] is nonzero, so the stick goes dead. `TAMPER_OBJECT_FREEZE_FLAG` is raised by `resetToAttractScreenStart` when its own backward checksum misses, and `resetBoardRamAndReseedSpawnCounters` reads that flag as the fill value for its board-RAM reseed — on a clean image (zero) it zero-fills the arena as intended, but a raised flag seeds those actor and HUD cells with a nonzero value instead. `loc_20d4`, the per-frame object-update gate, watches the pair `HISCORE_TABLE_CORRUPT_FLAG` and `TAMPER_STRIKES_TERMINATOR`: while the play-mode latch is busy and both are nonzero it hands the frame straight to the lead-actor driver, bypassing the normal player-move, launch, animation and target sub-passes. The net effect of any tripped guard is the same — spawns freeze, actor and player updates are aborted or diverted, HUD setup is skipped, and control leaks onto the board-clear/reset path rather than into play.

## Open questions

A handful of cells and routines remain read from the code alone, tagged [code] or [guess] because no
run of the real machine has yet exercised the state that would confirm them. They fall into a few
groups.

The largest group is the **anti-tamper bookkeeping**. The master miss-tally TAMPER_FREEZE_FLAG (0x881e)
[code] and the long row of per-check strike counters — TAMPER_STRIKES_ROM (0x89ef) [code],
TAMPER_STRIKES_SIG (0x8a38) [code], TAMPER_STRIKES_STATE0 (0x89ed) [code], TAMPER_STRIKES_STATE10
(0x8a39) [code], TAMPER_STRIKES_TERMINATOR (0x8df9) [code], TAMPER_STRIKES_SLOTSWEEP (0x89e8) [code],
TAMPER_STRIKES_HUD_GUARD (0x8a3c) [code], TAMPER_STRIKES_CATCH (0x89eb) [code], TAMPER_STRIKES_OBJMOVE
(0x89e9) [code], TAMPER_STRIKES_OBJSIG (0x8a3a) [code], CREDIT_TAMPER_COUNTER (0x89ea) [code] — together
with SIGNATURE_MISMATCH_FLAG (0x8ef0) [code], TAMPER_OBJECT_FREEZE_FLAG (0x89fb) [code], and the
integrity flag block INTEGRITY_FLAG_SCAN_BASE (0x89e7) [code], all read static-zero on a healthy image.
Their roles are understood from the guards that write them, but a clean ROM never trips them, so the
confirming observation would require running a deliberately corrupted image and is out of scope. The
ROM-side checksum bases and reference blocks they read — STATE0_CKSUM_BASE (0x01d5) [code],
ACTOR_TAMPER_CKSUM_TOP (0x4282) [code], TAMPER_NIBBLE_SUM_BLOCK (0x557f) [code], PHASE4_TAMPER_COPY
(0x6fed) [code], STATE5_SIGCHECK_REF_TOP (0x2b23) [code], STATE5_SIGCHECK_CODE_BASE_ADDR (0x67df)
[code], STATE4_SIGCHECK_CODE_BASE_ADDR (0x1c66) [code], CHECKSUM_ROM_BASE (0x0bb5) [code],
FIELD_ATTRIB_REF_2980 (0x2980) [code], COLORRAM_CHECKSUM_SENTINEL (0x780e) [code], CREDIT_CHECKSUM_TABLE
(0x776b) [code], TAMPER_CHECK_BLOCK_0AC8 (0x0ac8) [code], and the anti-tamper clones
TAMPER_CHECK_CLONE_7071 (0x7071) [code] / TAMPER_CHECK_CLONE_6DF9 (0x6df9) [code] — are ROM constants
never written, so they stay [code] until a read-tap grounds them.

The **hardware ports** are a second group: DSW1_PORT (0xa000) [code], DSW0_PORT (0xa0e0) [code], IN0_PORT
(0xa080) [code], IN1_PORT (0xa0a0) [code], IN2_PORT (0xa0c0) [code], FLIP_SCREEN_LATCH (0xa187) [code],
and WATCHDOG_KICK (0xa028) [code]. Their behaviour is fixed by the board, and the work-RAM cells they
feed are grounded, so the ports themselves carry a code-level tag without a separate observation.

A few remaining work cells are read from the code but not yet watched change: PER_FRAME_SCORE_INCREMENT
(0x88ab) [code], the launch-arm seed LAUNCH_ARM_LATCH_SEED (0x8d7a) [code], the write-anim record-array
anchor WRITE_ANIM_RECORD_ANCHOR (0x8dfd) [code], and the two seed constants FIRE_PHASE_SEED (0x03a0)
[code] and its siblings. WRITE_ANIM_RECORD_ANCHOR is a base-minus-one anchor loaded only as an immediate
operand to derive a record pointer that always lands at or past 0x8e00, so the cell at 0x8dfd is never
itself read or written by role code — a structural reason it cannot terminate in a MAME cell observation
on a good ROM.
