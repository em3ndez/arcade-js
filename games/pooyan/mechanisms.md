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

Pooyan's program runs on a single Z80 with a small, sharply partitioned address space: 32KB of program ROM, three kilobytes of tile/attribute video memory split across two planes, two kilobytes of general work RAM, two banks of sprite registers, and a thin window of memory-mapped hardware ports. Almost everything the game *is* — its mode, its actors, its waves, its scores, its pending draw work — lives in that two-kilobyte work-RAM slab from 0x8800 to 0x8FFF, and the whole machine is driven by a handful of state-selector bytes in it that pick, once per frame, which body of code runs. This section lays out the map, the two display planes, the sprite banks, the I/O ports, the shape of work RAM cell by region, and finally the per-frame dispatch that ties them together.

### The address map

The Z80 sees one flat 64KB space carved into fixed regions. The bottom half, 0x0000-0x7FFF, is the 32KB program ROM (four 8KB images concatenated), and it is strictly read-only: the running program only fetches and reads there, never writes. Everything the game mutates sits above it, and each live address the code touches decodes to exactly one device — RAM, a sprite bank, or a hardware port.

Above the ROM sit the RAM regions, each a small backing array indexed by its offset from a base:

- **0x8000-0x83FF — colour/attribute RAM** (1KB): the tile plane's per-cell attribute byte.
- **0x8400-0x87FF — video RAM** (1KB): the tile plane's per-cell character code.
- **0x8800-0x8FFF — work RAM** (2KB): all game state.
- **0x9000-0x90FF / 0x9400-0x94FF — sprite banks 0 and 1** (256 bytes each): the two sprite register files.

The sprite region deserves care because it is decoded by *don't-care bit masks*, not clean ranges. The whole 0x9000-0x9FFF window aliases into the two 256-byte banks: bit 0x0400 selects the bank and the low eight bits pick the offset, so many addresses mirror onto the same physical byte. Altogether the machine's writable state is just five backing regions — the two 1KB tile planes, the 2KB work slab, and the two 256-byte sprite banks, 4608 bytes in all — and every byte is reachable only at its own decoded address.

Two decode invariants shape everything above 0xA000. First, a read and a write to the *same* address are different devices — reading 0xA000 returns DIP bank 1, writing 0xA000 kicks the watchdog. Second, the I/O ports are also mirror-masked: a read decodes by masking the address (`addr & 0xA1E0` for the input/DIP ports, `addr & 0xA180` for DIP bank 1), and a write decodes similarly, with the control latch carrying its target bit *in the low three address bits* rather than in the data.

### The two video planes

The visible playfield is a single tile layer built from **two parallel 1KB planes** that share one 32x32 cell grid of 8x8 tiles. Video RAM at 0x8400-0x87FF (VIDEO_RAM_BASE, 0x8400; the game addresses the drawable body from PLAYFIELD_TILE_BASE 0x8402) holds the *character code* for each cell — which of the 256 tile shapes to draw. Colour RAM at 0x8000-0x83FF (COLOR_RAM_BASE, 0x8000) holds the matching *attribute* byte for the same cell. A cell's index is `row*32 + col`, and the two planes are read in lockstep: the code byte selects the tile bitmap, the attribute byte's low nibble selects the 16-entry colour block (pen base = colour*16, and char pens occupy palette entries 0-255), while attribute bit 6 flips the tile in X and bit 7 flips it in Y.

Tiles are **4 bits per pixel** — a subtlety, since the closely related Time Pilot hardware is 2bpp. Each tile's pen index is assembled from four ROM planes split across two halves of the character ROM, giving sixteen pens per cell. The plane is drawn **opaquely** (pen 0 included), so the tilemap is a solid background with no transparency of its own; sprites are then composited on top. Screen flip (driven by the orientation flag, below) is implemented as a plain native mirror: the cell address is mirrored across both axes *and* each tile's own flip bits are XORed with the flip state, which together produce a correct 180-degree rotation. The raster is 256x224 visible, presented ROT90 as a portrait screen, and it is *always on* — there is no video-enable bit to blank it.

Work RAM holds several named windows *into* these two planes where the HUD and playfield furniture are painted: the attribute-map body base ATTRIB_MAP_BASE (0x8040) [seen], the status panel's VRAM destination PANEL_VRAM_DEST (0x8567) [seen], the vertical phase-gauge cells rooted at PHASE_GAUGE_BASE_TILE (0x863f) [seen], the stage-countdown digit HUD_STAGE_DIGIT_LO (0x8743) [seen], the per-player score columns P1_SCORE_VRAM (0x8781) [seen] and P2_SCORE_VRAM (0x8521) [code], the high-score column HIGH_SCORE_VRAM (0x8641) [code], the credit-counter digits CREDIT_HUD_UNITS_VRAM (0x869f) [code] / CREDIT_HUD_TENS_VRAM (0x86bf) [code], and the scroll-column origins WORKER_COLUMN_VRAM (0x8740) [seen] and its siblings that the per-frame worker stamps and blanks. These are addresses inside the 0x8000/0x8400 planes, written by the drawing routines rather than being work-RAM cells.

### The sprite banks

Sprites live in the two 256-byte register files at 0x9000 (sprite0) and 0x9400 (sprite1). The two banks store *halves of the same sprite record at the same offset*: for a sprite at offset `offs`, sprite0[offs] is the screen X and sprite0[offs+1] is the tile code (modulo 64 — there are 64 sprite shapes), while sprite1[offs] is a control byte (colour in bits 0-3, flip-X in bit 6 which is *active low*, flip-Y in bit 7) and sprite1[offs+1] encodes Y as `240 - value`. Sprites are 16x16, 4bpp, and their pens sit in the upper half of the palette (entries 256-511). The hardware scans records **ascending** from offset 0x10 to 0x3E, so on overlap the *highest* offset wins — draw order is last-writer-on-top. Each pixel's pen 0 is transparent, letting the opaque tilemap show through.

The software side of the sprite pipeline is a display list in work RAM, not the banks themselves. SPRITE_DISPLAY_LIST (0x8840) [seen] is the base of a 24-entry, 4-bytes-per-entry list whose first record's Y sits at byte 0; it is rebuilt every frame and swept for collisions. Overlapping windows onto that same list carry different roles: SPRITE_ACTOR_RECORD_SLOTS (0x8848) [seen] are stride-4 actor slots swept by the display driver, SPRITE_TARGET_SLOTS (0x887c) [seen] are proximity-target coordinate slots scanned against the object records (with a player-2 counterpart SPRITE_TARGET_SLOTS_P1 at 0x888c [code]), and PROXIMITY_SOURCE_OBJECT (0x889c) [seen] is a fixed source record (X at +0, Y at +2) that sits inside the same list and is scanned against the others. The finished list is copied out into the sprite banks each frame.

### The hardware I/O window

Everything from 0xA000 up is memory-mapped hardware, all inputs **active-low** (idle = all bits high):

- **0xA000** — read: DIP-switch bank 1 (DSW1, idle 0x7B: three lives, upright, 50K bonus, easy, demo sounds on); write: watchdog reset.
- **0xA080** — IN0: coin 1/coin 2 in bits 0/1, service in bit 2, 1P/2P start in bits 3/4. The vblank interrupt samples the *complement* of this port into work RAM each frame.
- **0xA0A0** — IN1: player-1 controls. Pooyan's stick is two-way only — up in bit 2, down in bit 3, fire in bit 4; there is no left/right.
- **0xA0C0** — IN2: player-2 controls, used when the screen is flipped for cocktail play.
- **0xA0E0** — DSW0: the Konami coinage switches (idle 0xFF).
- **0xA100** — write: the sound-command latch to the second (audio) Z80. SOUND_COMMAND_LATCH (0xA100) [seen] is the byte handed over; the game pulses AUDIO_IRQ_LATCH (0xA181) [seen] to strobe the audio CPU's interrupt around each command.
- **0xA180-0xA187** — the LS259 control latch, addressed *one bit per address* (the target bit is `addr & 7`, and only data bit 0 lands). Its outputs are: bit 0 NMI-enable (NMI_ENABLE_LATCH 0xA180), bit 1 audio-IRQ trigger, bit 2 audio mute, bit 3 coin counter 1 (COIN1_COUNTER_LATCH 0xA183), bit 4 coin counter 2 (COIN2_COUNTER_LATCH 0xA184), bit 5 payout (a no-op here), and bit 7 flip-screen (FLIP_SCREEN_LATCH 0xA187), which is *inverted* — a latched 0 means a flipped screen. There is deliberately no video-enable bit.

The NMI-enable bit is load-bearing for the frame model: the vblank interrupt only fires while that latch bit is set, so the game gates its own per-frame heartbeat by writing it, and clearing it silences the interrupt entirely.

### The shape of work RAM

The 2KB work-RAM slab is densely packed. Grouped by role:

**Boot-decoded configuration.** A cluster near the base holds DIP-derived settings, all decoded once at boot by complementing the DSW ports. BONUS_AWARD_DSW (0x8800) [code] is DSW1 bit 3 complemented and selects the extra-life award schedule (award-queue reload 5 vs 3, BCD step 8 vs 7). DIFFICULTY_DSW (0x8820) [code] is a 3-bit difficulty from DSW1 bits 4-6 that scales spawn schedules. DEMO_SOUNDS_DSW (0x8821) [code] gates attract audio. CABINET_MODE_FLAG (0x880f) [code] carries the cocktail/upright bit. COINAGE_CONFIG (0x882c) [seen] and its slot-2 twin COINAGE_CONFIG_SLOT2 (0x882f) [code] hold the per-slot coinage nibbles (0x0F meaning free play), looked up through the ROM coinage table. LIVES_DSW (0x8807) [code] holds the starting life count seeded into both players. CREDIT_COUNT (0x8802) [seen] is the live BCD credit counter (max 0x63): a coin adds one, a 1P start consumes one and a 2P start two, and it is drawn as two HUD digits.

**Top-level state and input.** MAIN_GAME_STATE (0x8805) [seen] is the master mode selector (attract / intro / play). GAME_ACTIVE_FLAG (0x8806) [seen] is the in-play gate, set at start-of-life and cleared at game-over, that makes the gameplay handlers bail early when zero. INPUT_PORT0 (0x8810) [seen] is the complemented IN0 sample at the head of a short edge-detect ring. FLIP_SCREEN_FLAG (0x881f) [seen] is copied to the flipscreen latch every frame (1 = upright). FRAME_COUNTER (0x8a5f) [seen] is a free-running down-counter decremented every vblank whose low bits phase animations and whose zero-crossings gate the integrity checks. ACTIVE_PLAYER (0x880d) [seen] and TWO_PLAYER_FLAG (0x880e) [seen] together select which player's banks are live.

**Per-player banks.** The game keeps a *live page* at 0x8900 and swaps it wholesale with a saved 0x3F-byte block per player: PLAYER0_STATE_BANK (0x8940) [seen] and PLAYER1_STATE_BANK (0x8980) [seen], each with its remaining-lives byte at PLAYER0_LIVES (0x8948) [seen] / PLAYER1_LIVES (0x8988) [seen] (seeded from LIVES_DSW, drained on death, gating the player switch and game-over). Scores are three-byte BCD buffers, P1_SCORE_BCD (0x88a2) [seen] and P2_SCORE_BCD (0x88a5) [seen], selected by ACTIVE_PLAYER; the play timers are BCD banks PLAY_TIMER_BCD_P1 (0x8a30) [code] / PLAY_TIMER_BCD_P2 (0x8a33) [code] with their own suppress gates PLAY_TIMER_GATE_P1 (0x89e1) / PLAY_TIMER_GATE_P2 (0x89e2).

**The 0x8900 live block and the 0x8928 timer/flag block.** The live page opens with the per-round scalars: SPEED_INDEX (0x8900) [seen], STAGE_COUNTDOWN (0x8901) [seen], SPAWN_PHASE_COUNTER (0x8902) [seen], WAVE_ARRIVAL_COUNTER (0x8903) [seen], ROUND_IN_PROGRESS (0x8904) [seen], ROUND_COUNTER (0x8907) [seen] (rendered as the HUD round number, its low bits selecting stage-type variants), GAUGE_PHASE_COUNTER (0x8908) [seen] (drained per phase and drawn as the vertical gauge), the extra-life AWARD_QUEUE (0x8909) [seen], the rope counters ROPE_SEGMENT_COUNT (0x8931) [seen] and ROPE_DRAW_COUNT (0x8934) [seen], and the enemy-population counters ACTIVE_ENEMY_COUNT (0x8d40) [seen] and ANIM_FRAME_COUNTER (0x8d41) [seen]. Just after it comes a compact nine-byte per-frame timer/flag block from FRAME_TIMER_BLOCK_BASE (0x8928) [code]: SHARED_FRAME_DELAY_TIMER (0x8929) [seen] (a shared countdown gating several object sweeps), BLINK_COUNTDOWN (0x892a) [code] / BLINK_PHASE (0x892b) [code], ANIM_PHASE_TOGGLE_892C (0x892c) [seen] (grow-vs-shrink half selector), WAVE_NUMBER (0x892d) [code], SHARED_PHASE_COUNTDOWN (0x892e) [seen], LAUNCH_FLIP_COUNTDOWN (0x892f) [code], and SHARED_PHASE_GATE (0x8930) [code]. This block is zeroed at screen re-init.

**Actor and object records.** The heart of the entity model is the 0x18-stride record array based at ACTOR_TABLE (0x8a80) [seen], zero-filled at board init, whose *slot 0 is the player/lead actor*. Its fields include LEAD_ACTOR_STATE (0x8a82) [seen] (a 6-way dispatch index), the player's vertical position PLAYER_Y (0x8a84) [seen] (note this is the *Y* axis — the elevator-style up/down motion, not X — and enemy AI targets it to arm dives), and PLAYER_AIM_FLAGS (0x8a87) [seen] (joystick bits plus the aim above/on/below indicator). Beyond the lead actor, parallel 0x18-stride record pools carve up the rest of the entity population: ENEMY_ACTOR_TABLE (0x8ae0) [seen], SPRITE_OBJECT_TABLE (0x8b70) [seen], OBJECT_STATE_RECORD_BASE (0x8ba0) [seen] (which spans into) PROJECTILE_TABLE (0x8be8) [seen], FORMATION_TABLE (0x8c30) [seen], SPAWN_OBJECT_TABLE (0x8c48) [seen], FORMATION_SPAWN_TABLE (0x8c60) [seen], the six-slot HUNTER_TABLE_BASE (0x8c78) [seen] (scanned *downward*), and the two-entry I-parity pair ENEMY_TARGET_REC0 (0x8c90) [seen] / ENEMY_TARGET_REC1 (0x8ca8) [seen]. Each record's byte 0 is a presence/active flag and byte +2 (or +6) is the per-record state byte the dispatchers switch on; the eagle records carry live coordinates EAGLE_X_COORD (0x8c96) [code] / EAGLE_Y_COORD (0x8c94) [code] integrated from the velocity words OBJECT_VEL_X (0x8f10) [seen] / OBJECT_VEL_Y (0x8f12) [seen]. Spawn cadence is governed by ENEMY_SPAWN_TIMER (0x8d07) [seen] and a family of per-type countdowns around 0x8d04-0x8d06.

**Wave and launch state.** A cluster in the 0x8F00 page drives the attack-wave state machines. WAVE_INDEX (0x8f3d) [seen] is the current wave (wrapping after the fourth), with WAVE_RECORD_COUNT (0x8f3c) [seen] = 2*index and WAVE_RECORDS_ARRIVED (0x8f39) [seen] counting arrivals against it; WAVE_HOLD_TIMER (0x8f36) [seen] paces the inter-wave gap, WAVE_OUTER_PHASE (0x8f38) [seen] and WAVE_LAUNCH_FLAG (0x8f3a) [seen] sequence the eagle waves, and EAGLE_FINISH_FLAG (0x8f3e) [seen] diverts the approach machine at the grid edge. The formation/launch sub-machines each have their own selector: FORMATION_STATE (0x8f08) [seen] (gather → full → dispatch), LAUNCH_STATE (0x8f30) [seen] (a 5-state arrow/rope launcher), WAVE_TEARDOWN_STATE (0x8f24) [seen], the rope-extend machine ROPE_EXTEND_STATE (0x8f14) [seen] with its frame index ROPE_EXTEND_FRAME_INDEX (0x8f1b) [seen] and per-cell timers ROPE_CELL_TIMERS (0x8f28) [seen], plus assorted arm/latch flags (LAUNCH_ARM_LATCH 0x8f20 [seen], LAUNCH_ARMED_FLAG 0x8f3f [seen], GRAB_ACTIVE_FLAG 0x8d32 [seen]). The end-of-level bonus is scored by comparing TARGET_GROUP_COUNT (0x8f47) [seen] against the running HIT_TALLY (0x8f52) [code], and the aim/target-lock subsystem records a five-byte lock at TARGET_LOCK (0x8f40) [seen] alongside AIM_INDICATOR_MODE (0x8d52) [seen] / AIM_INDICATOR_TIMER (0x8d53) [seen] / PROXIMITY_HIT_FLAG (0x8d54) [seen].

**Display-list and command-ring pointers.** The drawing pipeline is fed by paired read/write pointers. The display-command *ring* is a 32-slot, two-byte buffer from DISPLAY_CMD_RING_BUFFER (0x88c0) [code] to 0x88FF, filled with 0xFF (empty) at boot, with a write pointer DISPLAY_CMD_RING_WRITE_PTR (0x88a0) [code] and a read/dispatch cursor DISPLAY_CMD_RING_READ_PTR (0x88a1) [code]. The display-*list* interpreter walks a source/layout stream through DISPLAY_LIST_SRC_PTR (0x8f45) [seen] into a destination DISPLAY_LIST_DST_PTR (0x8f43) [seen], with alternate-pointer variants DISPLAY_LIST_SRC_PTR_ALT (0x88ba) [seen] / DISPLAY_LIST_DST_PTR_ALT (0x88b8) [seen] used when the formation-slot table is active. Sound is queued through a parallel ring SOUND_RING_BUFFER (0x8a43) [code] with write/read pointers SOUND_RING_WRITE_PTR (0x8a40) [code] / SOUND_RING_READ_PTR (0x8a41) [code].

**HUD and score storage.** Beyond the per-player score buffers, the top score is a three-byte BCD value HIGH_SCORE_BCD (0x88a8) [code] whose MSB HIGH_SCORE_BCD_HI (0x88aa) [seen] anchors the compare-and-copy on a new record, and the full leaderboard is the sorted ten-entry, three-bytes-each HIGH_SCORE_TABLE (0x8a00) [code] (insert-sorted on game over, with a play-time side table HIGH_SCORE_TIME_TABLE at 0x89e0 and an insert-rank cell HIGH_SCORE_INSERT_RANK at 0x89fc).

**Anti-tamper.** A striking amount of RAM is devoted to copy-protection bookkeeping. TAMPER_FREEZE_FLAG (0x881e) [code] is the master miss-tally: when nonzero it freezes spawns, aborts actor updates and skips HUD setup. It is joined by a long row of per-check strike counters — TAMPER_STRIKES_ROM (0x89ef), TAMPER_STRIKES_SIG (0x8a38), TAMPER_STRIKES_STATE0 (0x89ed), TAMPER_STRIKES_STATE10 (0x8a39), TAMPER_STRIKES_TERMINATOR (0x8df9), TAMPER_STRIKES_SLOTSWEEP (0x89e8), TAMPER_STRIKES_HUD_GUARD (0x8a3c), and more — mostly [code] because a clean ROM leaves them static at zero. BOARD_CLEAR_FLAG (0x89e5) [code] and TAMPER_OBJECT_FREEZE_FLAG (0x89fb) [code] together freeze the per-frame object update and divert control to the board-clear path. All of these fire only against a corrupted ROM, which is precisely why they read static in a healthy capture.

Finally, the stack lives just below its 0x9000 initial pointer, growing down through STACK_SCRATCH (0x8FC0-0x9000); those are transient scratch writes rather than persistent game state. A single unbalanced boot push drops the pointer to BOOT_STACK_TOP (0x8ffe) and parks the ROM-check tally ROM_SELFTEST_TALLY (0x8fff) in the word just above it — out of reach of the vblank register-save, which only ever writes at 0x8ffe and below.

### The per-frame dispatch model

Pooyan does its once-per-frame work in two coordinated places, and the choice of *which* code runs is entirely table-driven off state bytes in work RAM.

The heartbeat is the vblank interrupt at 0x066D, which fires once per frame while the NMI-enable latch bit is set. Each firing it samples the complemented IN0 into INPUT_PORT0 (0x8810), decrements the free-running FRAME_COUNTER (0x8a5f), and then performs the **top-level dispatch**: it indexes a jump table at 0x06F0 by MAIN_GAME_STATE (0x8805) and runs one of five handlers — the attract state-0 handler 0x072D, the attract/demo sequence driver dispatchAttractSubstate (0x0899), the board-build dispatcher dispatchBoardBuildSubstate (0x0c4e), the play-state handler runPlayStateFrame (0x159b), and a bare-return placeholder noopStateHandler (0x0e53). Once the chosen handler returns, the interrupt's epilogue copies FLIP_SCREEN_FLAG (0x881f) out to the flipscreen latch and re-arms the interrupt for the next frame. MAIN_GAME_STATE cycles through 0 → 1 → 2 → 3 as the game moves attract → setup → play.

Between interrupts, the main loop (mainLoop, 0x020F) does the drawing housekeeping: each pass it either drains one entry from the display-command ring (0x88C0-0x88FF, advancing DISPLAY_CMD_RING_READ_PTR) or runs the per-frame scroll worker 0x0254, which repaints the scroll tile columns (and, when the worker control byte's low nibble is set, runs a program-signature integrity check). The entire command ring is drained within a single frame — a backlog that built up on the credit screen must not be metered out one command per frame, or stale attract tiles would linger on the playfield into gameplay.

Underneath the top level, each mode fans out through its own **state selector**, so the dispatch is a shallow tree of table lookups rather than a monolith:

- **Attract** runs off ATTRACT_SUBSTATE (0x8e51) [seen], a 0-8 sub-state that dispatchAttractSubstate (0x0899) indexes into the table at 0x08A1 to reach handlers like resetToAttractScreenStart (0x08b3), paintAttractColorsAndQueueDraws (0x092c), buildAttractSpritesAndPrimeTextScript (0x099c), typeAttractTextColumn (0x0ac8), and advanceAttractSequenceToPlay (0x0b32); each handler advances the sub-state to sequence the demo.
- **Self-test / attract-to-play** runs off SELFTEST_DISPATCH_STATE (0x8921) [seen], masked to its low two bits and dispatched by 0x7442 into a three-entry table at 0x7448: state 0 is boot/ROM-check init, state 1 is runDisplayListAndAdvanceToGameplay (0x7517) (which runs the display-list interpreter and a HUD column-checksum, then advances to state 2 on a clean sum), and state 2 is the gameplay driver updateGameplayFrame (0x755d).
- **In-play** runs off PLAY_STATE_INDEX (0x880a) [seen], masked with 0x1F and dispatched by 0x15A1 into a 19-entry table at 0x15A8. Its handlers carry the round through its phases — selectRoundDisplayListAndAdvancePhase (0x16b7) at index 1, startRoundAfterIntroDelay (0x175d) at index 2, spawnEnemyWave (0x17c1) at index 3, the per-frame gameplay coordinator runActiveGameplayFrame (0x18af) at index 4, and the round-end master dispatchRoundEndElseWipeColumn (0x1c66) — stepping the index through the discrete values 1/2/3/4/7/10/13/18 as the round advances.
- **Level intro** runs off INTRO_PHASE_INDEX (0x8f51) [code], a 0-6 phase dispatched by dispatchLevelIntroPhase (0x6da6) through the jump table at 0x6DAA, with each phase handler (seatIntroLaunchScriptAndAdvancePhase 0x6db8, runLevelIntroPhase1Frame 0x6e59, advanceLevelIntroFromPhase3 0x6f5e, …) advancing to the next.
- **The main-loop sub-phase** for HUD/BCD field painting runs off MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) [code], masked with 7 and dispatched through an inline table at 0x0FE3.

The same table-driven idea recurs one level down for *per-record* actor and object state. Each entity record carries a state byte (typically at +2 or +6), and a per-record dispatcher walks the active records and routes each one to its handler: the generic IX-object dispatcher 0x40D0 routes `(ix+2)&0x1f` through a 17-handler table at 0x40E1; dispatchActiveObjectState (0x7707) routes `(ix+2)&3` through the table at 0x7715 (arm at armObjectFromSpawnRing 0x771d, move at moveObject 0x7740, draw at drawObjectStackedTiles 0x7790); dispatchActiveEnemyActorState (0x338a) and dispatchActiveEagleRecordState (0x72cf) do the same for the enemy and eagle record pools; the special-object dispatcher 0x6822 (gated by ENEMY_REC_DISPATCH_GATE 0x8afa) routes into a three-handler table at 0x6834; and the bonus/eagle-stage phase dispatcher 0x71B9 routes WAVE_OUTER_PHASE (0x8f38) into a three-handler table at 0x71C1. There are still finer sub-machines nested inside these — the lead actor's primary and secondary state machines, the rope-cell dispatcher dispatchRopeCellState (0x2e36), the formation and launch dispatchers dispatchFormationObjectStates and dispatchLaunchState — each keyed on its own byte in the 0x8F00 wave-state cluster.

The overall picture, then, is a machine whose entire per-frame behaviour is chosen by reading a small set of selector bytes out of work RAM — MAIN_GAME_STATE at the top, then ATTRACT_SUBSTATE / SELFTEST_DISPATCH_STATE / PLAY_STATE_INDEX / INTRO_PHASE_INDEX for the mode, then the per-record state bytes for each entity — and jumping through fixed ROM tables to the handler each byte names.

## The frame loop and the vblank heartbeat

Pooyan runs on a single Z80 with no game clock of its own. The whole machine breathes on one signal — the vblank interrupt raised once per displayed frame. Everything that has to happen exactly once per frame (sampling the stick, ticking timers, advancing the game one step, handing the video hardware a fresh picture to draw) is folded into the interrupt service routine at 0x066d. The code the CPU runs the rest of the time is not doing per-frame arithmetic at all: it is a small foreground loop that empties a queue of drawing commands and then spins, waiting for the next beat. Understanding the machine starts with seeing that split — the heartbeat is the interrupt, and the foreground is its scribe.

### Reset and arming the heartbeat

At power-on the CPU jumps to the reset vector [code] (0x0000). It does almost nothing: it clears A and writes zero to the NMI-enable latch NMI_ENABLE_LATCH (0xa180) [code], which is bit 0 of the board's LS259 control latch. That single write pins the vblank interrupt *off* — the heartbeat must not fire while memory and hardware are still uninitialised — and then it falls straight through into the boot entry [code] (0x0092).

Boot is where the machine is built. It first sets the stack pointer to 0x9000 (the stack then grows downward through the scratch region STACK_SCRATCH, 0x8fc0–0x9000) and kicks the watchdog at DSW1_PORT (0xa000) [code], whose write side is the watchdog reset. It then runs the program-memory self-test: it sums each of the eight 4K ROM banks and compares each bank's three-byte checksum against a reference table in ROM, bumping a pass tally ROM_SELFTEST_TALLY (0x8fff) [code] on every match. That tally is seeded to the bank count and ends at 0x10 only when every bank verifies; it is deliberately parked just above the stack so the interrupt's register save can never clobber it. After the self-test, boot reads the DIP switches, clears work RAM, seeds the HUD tiles and colour map, decodes coinage and cabinet configuration, and blanks the display-command ring (a 0x40-byte region based at 0x88c0, filled with the free marker 0xff) with its read and write cursors DISPLAY_CMD_RING_WRITE_PTR (0x88a0) [code] and DISPLAY_CMD_RING_READ_PTR (0x88a1) [code] both parked at 0xc0. It clears the lower video RAM through the boot RAM-clear helper [code] (0x01ea).

Only once all of that is standing does boot write 1 to NMI_ENABLE_LATCH (0xa180) — the heartbeat is now armed and the first vblank will be serviced. Boot finishes seeding a few more RAM structures and then jumps into the main loop at 0x020f. From this point the CPU never "returns" anywhere; it lives inside that loop, interrupted sixty times a second by the vblank NMI.

### The free-running main loop

The foreground code is mainLoop [code] (0x020f). It is an unbounded loop, and — this is the key reading — it contains no busy-wait on the vblank flag. It does not poll a scanline register or spin on a "vblank now" bit the way many drivers do. Its job is to service a small ring of pending display commands and, when that ring is empty, to idle until the interrupt wakes it with more work.

Each pass, the loop reads the byte the read cursor DISPLAY_CMD_RING_READ_PTR (0x88a1) points at inside the command ring (page 0x88, offsets 0xc0–0xff). It doubles that byte to test bit 7. A free ring slot holds 0xff, so bit 7 set means "the ring is drained": there is nothing left to draw. In that case the loop runs the per-frame worker (described next), then loops back and looks again — parking on the free slot and re-running the worker every pass. That parked, ring-empty state *is* the machine at rest between frames. When instead the slot holds an occupied command (bit 7 clear), the loop treats the byte as an index into the display-handler table at 0x0242, frees the slot, advances the read cursor (wrapping it back to 0xc0 when it runs past 0xff), and dispatches that one drawing handler, which returns to the loop top to take the next command. So the read cursor chases the write cursor, draining one queued command per pass until it catches up.

The producers of those commands are the interrupt's game-state handlers: the heartbeat computes the frame and enqueues drawing work, and the foreground loop empties the queue and hands the pictures to the video hardware. The frame boundary — where one beat of computation ends and the machine settles to wait for the next vblank — is therefore not "every loop pass" but the *idle* pass, the point at which the ring is drained and the worker has just run. That yield point sits at 0x021c, the instruction right after the per-frame worker returns; it is reached only on the ring-empty path, which is exactly where the machine sits waiting for vblank. (Timing the boundary at the loop top 0x020f instead would wake the interrupt once per *command* rather than once per drained ring, which is why the idle-pass point is the correct heartbeat boundary.)

The per-frame worker itself is 0x0254 [code]. It is gated by the worker control byte WORKER_CONTROL_BYTE (0x883f) [code]: if that byte's low nibble is non-zero it diverts into the ROM signature guard verifyRomSignature (0x208c) [code] (a running integrity check that resamples the code region against a reference table); otherwise it repaints the scrolling tile columns, walking the scroll-column VRAM structures at 0x8740 and 0x84e0 through the column-stamp and column-blank helpers, with bit 4 of that same control byte gating a final blank pass. This is the light, every-idle-pass tile upkeep that runs whenever the command ring is empty.

### The vblank interrupt: one beat of work

Every displayed frame, the vblank line fires the interrupt and the CPU vectors to the service routine at 0x066d. This is the heartbeat, and one entry into it is exactly one frame of the game advancing.

It opens by saving the entire register file — main set, shadow set, and both index registers — because it is stealing the CPU mid-instruction from the foreground loop and must give it back untouched. Its very next act is to write zero to NMI_ENABLE_LATCH (0xa180): it masks further vblank interrupts for the duration of the beat, so a long frame cannot re-enter itself.

With the CPU its own, the routine does the fixed per-frame work in order. It copies the finished sprite display list out into the two hardware sprite banks through the sprite-attribute copy loop [code] (0x0714) — how many records it moves depends on the state byte, four record groups in one state and a single tall run otherwise. It kicks the watchdog at 0xa000. It then samples the three hardware input ports — IN2, IN1, IN0 — inverting each (the inputs are active-low, idle-high) and storing them into the edge-detect ring headed by INPUT_PORT0 (0x8810) [seen], having first rolled the previous frames' samples down through 0x8813/0x8815/0x8816 so the game can detect button *edges*, not just held levels. It ticks two per-frame counters down: the worker control byte WORKER_CONTROL_BYTE (0x883f), and the free-running frame counter FRAME_COUNTER (0x8a5f) [seen] whose low bits phase animations and whose zero-crossings gate periodic integrity checks. It runs the coin/credit and coinage-counter service serviceCoinCreditAndCountersUnlessFreePlay (0x59e8) [code], and drains one entry from the sound-command ring out to the audio CPU via drainSoundCommandRing (0x0e64) [seen].

Then comes the actual game step — the top-level state dispatch, covered below — after which control reaches the epilogue at 0x06fa. The epilogue copies the software flip-screen flag FLIP_SCREEN_FLAG (0x881f) [seen] out to the hardware flip latch FLIP_SCREEN_LATCH (0xa187) [code], restores every saved register in reverse order, writes 1 back to NMI_ENABLE_LATCH (0xa180) to re-arm the heartbeat for next frame, and returns to whatever address in the foreground loop it interrupted. The foreground then finds the drawing commands this beat enqueued and paints them.

### The once-per-frame state branch

The single decision that separates attract from play from a quiet frame lives inside the interrupt, right before the epilogue. The service routine reads the top-level state selector MAIN_GAME_STATE (0x8805) [seen] and dispatches through a five-entry jump table at 0x06f0 keyed on it. Because this branch runs once per interrupt, the whole game advances by exactly the one mode-appropriate step per frame; the selected handler is what enqueues that frame's drawing commands for the foreground loop to consume, and it returns into the epilogue.

The five destinations are the machine's top-level modes. State 0 goes to the attract state-0 handler [code] (0x072d): it blanks the tilemap a row at a time and, once that drain completes *and* the boot self-test passed (the tally at ROM_SELFTEST_TALLY reached 0x10), performs the attract-to-play setup — advancing the state, flooding the attribute map, and enqueuing the first display commands; a *failed* self-test instead tails off into the main loop, so a bad ROM never leaves the attract entry. This is the "self-test" arm of the branch: the machine only proceeds past its first attract state when its own program memory verified at boot. State 1 goes to dispatchAttractSubstate (0x0899) [seen], the attract/demo sequence driver that walks the title and demonstration screens. State 2 goes to dispatchBoardBuildSubstate (0x0c4e) [seen], which builds up a board before a round begins. State 3 goes to runPlayStateFrame (0x159b) [seen] — the live-gameplay handler, one frame of an actual round, itself gated internally by the in-play flag GAME_ACTIVE_FLAG (0x8806) [seen] that is raised at start-of-life and cleared at game-over. State 4 goes to noopStateHandler (0x0e53) [code], a bare no-op return: a dispatch slot that deliberately draws nothing, occupied on frames where the top level wants the beat to pass without a mode step.

So one frame of Pooyan is: vblank fires the heartbeat at 0x066d, it saves state and masks itself, does the fixed render/input/counter/coin/sound upkeep, dispatches the one applicable mode handler off MAIN_GAME_STATE (0x8805) which advances that mode and queues its drawing, then restores state and re-arms; the foreground loop resumes, empties the freshly queued command ring, paints the columns through the worker, and settles back onto its idle pass to wait for the next beat.

## Configuration, coinage and players

Everything the operator can dial in — how the cabinet stands, what a coin is worth,
how many lives a game grants, when a bonus life is earned — is read exactly once at
power-on out of two hardware DIP-switch banks, decoded into a scatter of one-byte
config cells in work RAM, and thereafter consulted (never re-read) by the credit
logic, the board-reset code and the scoring code. On top of that sits the runtime
bookkeeping that turns a coin into a credit, a credit into a game, and a game into
alternating turns between two players.

### Power-on: reading the DIP switches into config cells

The boot routine at `0x0092` runs the program-memory self-test and then does the whole
one-time config decode before it ever enables the vblank interrupt. It reads the two
switch banks off their hardware ports — `DSW1_PORT` (0xa000) [code] and `DSW0_PORT`
(0xa0e0) [code] — and fans their bits out into individual cells.

`DSW1` is treated as active-low: the routine complements the byte first, then rotates it
apart. Bit 2 lands in `CABINET_MODE_FLAG` (0x880f) [code]; bit 3 lands in
`BONUS_AWARD_DSW` (0x8800) [code]; the three-bit field in bits 4-6 becomes
`DIFFICULTY_DSW` (0x8820) [code]; and bit 7 becomes `DEMO_SOUNDS_DSW` (0x8821) [code].
The lives setting is decoded separately and non-linearly: the routine re-reads `DSW1`,
complements it, isolates the low two bits, and if that two-bit value is 3 it stores
`0xff`, otherwise it stores the value plus 3. So `LIVES_DSW` (0x8807) [code] carries 3,
4, 5, or the sentinel 0xff — the ordinary three/four/five-lives choices plus a special
maximum. Because the capture goldens run at the default settings, most of these cells
sit at 0 the whole time, which is why they carry the [code] tag rather than [seen]; the
one exception is difficulty, whose default-0 value is also quietly reused downstream as
the sprite colour seeded into each player's saved bank at board reset.

Coinage is decoded from `DSW0`, and here the byte is *not* complemented. The high nibble
(bits 4-7) and the low nibble (bits 0-3) are each used as an index into the ROM byte
table `COINAGE_TABLE` (0x0053) [code], which maps a raw switch nibble to a coinage
descriptor byte. The high-nibble lookup is stored in `COINAGE_CONFIG_SLOT2` (0x882f)
[code] (coin slot 2) and the low-nibble lookup in `COINAGE_CONFIG` (0x882c) [seen]
(coin slot 1). A descriptor of `0x0f` is the free-play sentinel. `COINAGE_CONFIG` is
grounded as [seen] because the boot seed of the default 1-coin/1-credit descriptor is
observable at power-on; its slot-2 sibling stays [code].

The same boot pass also establishes the initial screen orientation (see below), enables
the vblank NMI so the frame loop can begin, and seeds the on-screen high-score display to the
factory 10000 by writing ten `(0,0,1)` BCD triples into `HIGH_SCORE_TABLE` (0x8a00) [code] and
setting the top score MSB `HIGH_SCORE_BCD_HI` (0x88aa) [seen]. From this point on the config cells are read-only inputs to the rest of
the machine.

### Cabinet orientation

Two distinct cells govern the display's handedness, and it helps to keep them apart. The
static operator setting is `CABINET_MODE_FLAG` (0x880f) [code] — the complemented `DSW1`
bit 2 decoded at boot — which is a fixed boolean answering "is this an upright or a
cocktail cabinet." It is consulted by round-init (the gameplay-state idx0 handler at
`0x1601`) to decide whether the per-turn cocktail flip machinery is engaged at all.

The live, moment-to-moment orientation is `FLIP_SCREEN_FLAG` (0x881f) [seen]. Boot seeds
it to 1, meaning normal/upright, and it is grounded [seen] precisely because it goes
0->1 at power-on and holds. Every vblank the NMI service copies this flag into the
hardware flip-screen latch bit, `FLIP_SCREEN_LATCH` (0xa187) [code] bit 7 (an LS259
control line, which boot also pre-loads to 1), and it gates the vertical-mirror pass so
the tilemap and sprites draw right-side-up. Because the two seated players in a cocktail
share one screen facing opposite ways, the runtime flag is what the game rewrites at
turn boundaries: `startNewGamePlay` sets it to 1 at the start of a fresh game, and the
player-swap tail of the round-end handler sets it back to 1 when control returns to
player one. The upright/cocktail *choice* (0x880f) decides whether those rewrites do
anything visible; the runtime flag (0x881f) is the thing actually latched to hardware.
Orientation also selects which control port is live — the player-one port `IN1_PORT`
(0xa0a0) [code] normally, the player-two port `IN2_PORT` (0xa0c0) [code] when the screen
is flipped.

### Coin acceptance and credit accrual

Coins are serviced once per frame by the chain rooted at
`serviceCoinCreditAndCountersUnlessFreePlay` (`0x59e8`) [code]. Its first act is a
free-play short-circuit: if either coinage descriptor reads the `0x0f` sentinel it
returns immediately, doing no coin bookkeeping at all (in free play, credits are
meaningless and the start buttons are read directly instead). Otherwise it runs a fixed
sequence of per-frame sub-steps — three coin-slot accrual steps, the two physical
coin-counter strobes, and a periodic anti-tamper check — then returns to the
per-frame NMI service that invoked it.

Each of the three coin inputs has the same shape: a tiny software debounce that turns a
noisy switch line into exactly one accepted pulse. The routine takes the inverted IN0
sample `INPUT_PORT0` (0x8810) [seen], shifts the relevant bit into a rolling three-bit
shift register, and acts only when the register's low three bits settle on the pattern
`001` — i.e. a clean rising edge sustained across frames. The coin-slot-1 step
`accrueCreditFromCoin1Pulse` (`0x5a56`) [seen] watches IN0 bit 0 through the ring at
`DRIP_RING_C` (0x882a); the coin-slot-2 step `accrueCreditsFromCoinSlot2` (`0x5a1f`)
[code] watches IN0 bit 1 through `DRIP_RING_B` (0x882d); and the service-coin step at
`0x5a06` [code] watches IN0 bit 2 through `DRIP_RING_A` (0x8829).

The service coin is the simplest: on an accepted pulse it plays the coin sound and adds
exactly one credit, bypassing coinage entirely. The two real coin slots run the classic
coinage divider. Each slot owns a two-byte pair — an accumulator that advances by 0x10
on every accepted coin, and the coinage descriptor as its threshold. For slot 1 the
accumulator lives in the cell at 0x882b (a byte multiplexed with an unrelated ROM-check
flag elsewhere) and the threshold is `COINAGE_CONFIG` (0x882c); for slot 2 the
accumulator is `DRIP_COORD_B` (0x882e) [code] and the threshold is `COINAGE_CONFIG_SLOT2`
(0x882f). While the accumulator has not overtaken the threshold, the coin is banked but
no credit is awarded yet (this is how "N coins for one credit" is realized). When the
accumulator crosses the threshold it wraps back down and awards credits: the low nibble
of the descriptor gives the number of credits to add, unless that nibble is `0x0f`, in
which case the full-wrap amount `0x63` is used. Both slots funnel into the same tail:
`addFullWrapCreditAmount` (`0x5a8a`) [code] seeds the full-wrap constant, and
`addCreditsAndQueueDisplay` (`0x5a8c`) [seen] adds the amount to the running credit total
`CREDIT_COUNT` (0x8802) [seen], clamping it at `0x63` so credits never exceed 99 (BCD).
It always finishes through `queueCreditDisplayRefresh` (`0x5a97`) [code], which enqueues
the display command that repaints the two-digit credit HUD — units at
`CREDIT_HUD_UNITS_VRAM` (0x869f) [code], tens at `CREDIT_HUD_TENS_VRAM` (0x86bf) [code]
(the tens cell is written only when that nibble is nonzero).

`CREDIT_COUNT` is grounded [seen] from watching it tick up 0->1 the instant a coin is
inserted and back down when a game is started — the decisive evidence that this byte is
the credit counter and not a score accumulator.

### The physical coin counters

Independently of the credit math, the game strobes the cabinet's mechanical coin meters
so an operator's totals stay honest. When a coin-slot step accepts a pulse it not only
runs the divider, it also bumps a queued-pulse count: `COIN1_PULSE_COUNT` (0x8824)
[seen] for slot 1, `COIN2_PULSE_COUNT` (0x8826) [code] for slot 2. Two pulse
generators drain those queues into timed strobes on the meter solenoids — the
coin-counter-1 generator at `0x5a9c` [code] driving `COIN1_COUNTER_LATCH` (0xa183)
[code] (LS259 bit 3), and its structural twin `pulseCoinCounter2Latch` (`0x5ac0`) [code]
driving `COIN2_COUNTER_LATCH` (0xa184) [code] (LS259 bit 4). Each generator is a small
state machine over a phase timer — `COIN1_PULSE_PHASE` (0x8825) [code] and
`COIN2_PULSE_PHASE` (0x8827) [code]: with no pulses queued it does nothing; on a fresh
pulse it seeds the phase timer to `0x30` and raises the meter line; while counting down
it lowers the line at the `0x18` drop point and, when the phase reaches zero, retires one
queued pulse. The result is a clean fixed-width pulse per coin on the physical counter,
paced out one at a time even if several coins were fed quickly. `COIN1_PULSE_COUNT` is
[seen] because its 0->1 bump was caught at the exact frame of a coin accept.

### Starting a game and consuming credits

Pressing a start button is polled off the inverted IN0 sample: bit 3 is one-player start,
bit 4 is two-player start. The guarded trigger `startGameOnStartButtonPress` (`0x7fd6`)
[seen] refuses to fire while `CREDIT_COUNT` is zero, and refuses again if a game is
already in progress — it folds together the two-player flag, one player's banked life
count (selected by the active-player flag) and the phase gauge into a status byte and bails if any
of that is nonzero. Only
with a credit waiting, no game live, and a start bit held does it enqueue a sound and
hand off to the credit-consuming entry.

That entry, `startSelectedPlayerGameConsumingCredits` (`0x0d78`) [code], reads the IN0
edge bits and forks. Bit 3 (one-player) routes to `startOnePlayerGameOnCredit` (`0x0de4`)
[seen], which spends a single credit (decrementing `CREDIT_COUNT`) and starts a fresh
one-player game with the active-player word cleared to zero; if no credit remains it
merely nudges the top-level state. Bit 4 (two-player) is heavier: it requires at least
two credits, subtracts two, and runs an integrity checksum over the ROM table
`CREDIT_CHECKSUM_TABLE` (16-bit sum with byte-carries folded) — a nonzero fold bumps
`CREDIT_TAMPER_COUNTER` (0x89ea) [code] as an anti-cheat tripwire — before continuing
into the start-of-life entry `beginTwoPlayerStartOfLife` (`0x0da8`) [code], which seeds
the two-player start seed and falls through to the shared setup.

Both paths converge on `startNewGamePlay` (`0x0dab`) [seen]. It records the active-player
word — low byte into `ACTIVE_PLAYER` (0x880d), high byte into `TWO_PLAYER_FLAG` (0x880e)
— runs the pre-play display setup, then seeds the top-level machine into play: it sets
`GAME_ACTIVE_FLAG` (0x8806) [seen] to 1 (the in-play gate), `MAIN_GAME_STATE` (0x8805)
[seen] to 3 (the play state), `PLAY_STATE_INDEX` (0x880a) [seen] to 0, and
`FLIP_SCREEN_FLAG` to normal. It resets the actor tables for a fresh board (which is
where each player's lives are seeded, below), primes the periodic-event scheduling pair,
and enqueues the start-of-life sound. On a two-player game it additionally enqueues the
second-player start variant and zero-fills a twelve-byte panel block. `GAME_ACTIVE_FLAG`
is grounded [seen] from its 0->1 at game start (coincident with the main state entering
play) and 1->0 at game over — it is the gate on which nearly every gameplay handler
returns early when idle.

A parallel credit-to-play path exists for continuing between boards:
`queueCreditDisplayAndEnterBoardBuild` (`0x0d61`) [seen] plays the coin jingle and drops
the machine into board-build state 2 when a credit is present, and
`resetToBoardBuildToContinuePlay` (`0x15d1`) [seen] — the play dispatcher's
end-of-life continuation — sends the machine back to board-build (main state 2, sub-index
0) when a game has ended but a credit remains, tail-delegating instead to the shared
attract epilogue on free play. The attract-side coin/credit handling lives in
`advanceGameStateOnCreditOrStartPress` (`0x0bb5`) [seen] and
`advanceAttractOnStartPress` (`0x0c2a`) [code]: the former, when not free play, advances
the top-level state as soon as a credit is waiting, and when free play routes the raw IN0
start bits into the one- or two-player builders directly; the latter watches the start
bit during attract and, on a press, jumps the attract sequence forward and wipes the
tile page. The `queueCreditDisplayCommands` (`0x0e54`) [code] helper enqueues the primary
credit-display command and, only under the free-play sentinel, an extra "free play"
message command.

### Per-player score, lives and turn alternation

Two players share one live actor page but keep independent banks. `ACTIVE_PLAYER`
(0x880d) [seen] is the selector — its bit 0 clear picks player zero's cells, set picks player
one's — and `TWO_PLAYER_FLAG` (0x880e) [seen] marks whether a second player is in the
game at all; both are grounded from a two-player capture in which the selector toggles
exactly on each player's death and the flag flips 0->1 at a two-player start and holds.

Scores are three-byte BCD buffers, one per player: `P1_SCORE_BCD` (0x88a2) [seen] and
`P2_SCORE_BCD` (0x88a5) [seen], each accumulating only during its own player's turn
(grounded by watching the middle byte climb under one selector value and freeze after the
swap). The scoring routine at `0x0496` [code] accrues the active player's score and keeps
the top score in step. Gated on `GAME_ACTIVE_FLAG` bit 0, it picks a three-byte BCD
increment — from the award table `SCORE_AWARD_TABLE` (0x0501) [code] for a nonzero award
index, or the per-frame increment `PER_FRAME_SCORE_INCREMENT` (0x88ab) [code] when the
index is zero — and BCD-adds it into the active player's buffer. Which buffer is chosen
is decided by the selector at `0x04f2`, which points at 0x88a2 or 0x88a5 off
`ACTIVE_PLAYER` bit 0 (preserving flags so the score math is unaffected). After adding,
the column is re-rendered, and the new value is compared most-significant-byte-first
against the running high score at `HIGH_SCORE_BCD_HI` (0x88aa) [seen]; if it is higher it
is copied down into `HIGH_SCORE_BCD` (0x88a8) [code] and re-rendered, so the on-screen
top score tracks the leader live.

Lives are single bytes: `PLAYER0_LIVES` (0x8948) [seen] and `PLAYER1_LIVES` (0x8988)
[seen], both seeded from `LIVES_DSW` when the board is reset (see below) and both
grounded from watching them count 3->2->1->0 across deaths and reset to 3 for the next
game — decisive evidence these are the lives countdowns and not activity flags.

Turn alternation is orchestrated by the round-end master
`dispatchRoundEndElseWipeColumn` (`0x1c66`) [seen]. When a life ends and its re-init
timing and integrity checksum pass, it branches on the two-player flag, the active-player
selector and player-zero's remaining lives. In a one-player game (flag zero) it goes
straight to the full-clear continue path. In a two-player game, if player zero's turn just
ended (selector 0) it hands to `reseedOtherPlayerForTurn` (`0x1cf6`) [code], which — so
long as player one still has lives — clears the play sub-state, zero-fills player zero's
bank, marks player *one* active, and reseeds the display for the incoming turn; if player
one's turn just ended (selector nonzero) and player zero still has lives, it flips the
selector back to zero, zero-fills player one's bank, restores normal orientation, and
resumes player zero. When the other player is out of lives it falls through to the shared
continue/teardown path instead.

The banks that make hot-seat play work are `PLAYER0_STATE_BANK` (0x8940) [seen] and
`PLAYER1_STATE_BANK` (0x8980) [seen] — each a 0x3f-byte snapshot of the live actor/state
page. On a death the live page is copied out to the departing player's bank so it can be
restored on their next turn: `saveLiveStateToPlayerBank` (`0x1a47`) [code] copies the
live page into whichever bank `ACTIVE_PLAYER` selects, while `saveLivePageToPlayer0Bank`
(`0x1bab`) [seen] is the player-zero-specific variant that also latches the active-player
flag when player one is still alive. Both banks' byte 0 holds the sprite colour (seeded
from difficulty) and byte 1 holds the opening X; both clear the play sub-state index
after copying.

### Config-adjacent scheduling cells

Several one-byte timers are primed at start-of-life from, or alongside, the config seed,
and they pace the round rather than the coin logic. `startNewGamePlay` primes the
periodic-event pair: it clears `WAVE_EVENT_LATCH` (0x8d21) [seen] and reloads
`PERIODIC_EVENT_TIMER` (0x8d22) [seen] to `0x20`. That timer counts down each frame; on
expiry it reloads and raises the wave-event latch (which fires the siren-tile run), and
the latch is cleared again on wave teardown — grounded [seen] as a long-held one-shot.

The heartbeat behind all frame-paced scheduling is `FRAME_COUNTER` (0x8a5f) [seen], a
free-running byte decremented once every vblank NMI. Its low bits phase animations, and
its zero-crossing is the trigger that lets the periodic anti-tamper ROM checks run —
including the guard at `0x7e6d` [code] that is one of the six per-frame steps in the
coin-service chain and bumps the ROM tamper-strike counter on a signature miss. This is
the juncture where config-time integrity meets runtime scheduling: the checks only fire on
the counter's wrap.

Finally, the extra-life schedule is config-driven but runs as a per-frame tally. The
selected award schedule comes from `BONUS_AWARD_DSW` (0x8800) [code] — decoded at boot
from `DSW1` bit 3 — and drives the bonus-award step at `0x18da` [seen]: an empty
`AWARD_QUEUE` (0x8909) [seen] reloads its next BCD threshold (5 or 3 depending on the
switch), and once the active player's score most-significant byte reaches the queued
threshold it saturating-bumps the `GAUGE_PHASE_COUNTER` (0x8908) [seen] gauge, BCD-steps
the queue to the next threshold (by 8 or 7), redraws the HUD gauge, and appends the tally
sound. In this way the operator's bonus-life DIP setting becomes a running schedule the
scoring code walks as each player climbs.

## In-play progression and timers

Once a coin has been spent and a game is running, the machine spends every frame inside one top-level
state — the play state — and inside that state it runs a second, finer state machine that carries a
round from its first blanked tile through active shooting, phase-out, the two-player hand-off, and
either a fresh round or the fall back to attract. This section follows that inner machine: the
per-frame entry, the phases that build and run a round, the exits, the block of RAM that holds a
player's progress and how it is banked between two players, the lives count and the gates that
alternate turns, and the two BCD stopwatches that time each player's play.

### The per-frame play loop and its sub-state selector

The top-level game state cell MAIN_GAME_STATE (0x8805, [seen]) selects one of five per-frame handlers
each vblank; value 3 is "in play" and lands on `runPlayStateFrame` (0x159b, [seen]). That handler does
only three things per frame: it ticks the active player's BCD play-timer, it dispatches the in-play
sub-state, and it runs the end-of-frame housekeeping continuation. The whole richness of gameplay is
therefore reached through one indirection — the sub-state dispatcher at 0x15a1 ([seen]).

That dispatcher reads PLAY_STATE_INDEX (0x880a, [seen]), masks it to its low five bits, and routes to
one of nineteen phase handlers. This index is the spine of the entire round: it is not a mode you set
once but a program counter the handlers themselves advance, each phase writing the next index before
it returns. The counter is counterintuitively non-linear — a phase can jump the index forward several
steps (a completed round-init bumps it by one; a phase-out can force it to 0x0c, 0x0e, or all the way
to the bonus-stage entry at 0x12), and several phases loop the index back to 0 to restart the build.
Indices 15, 16, and 17 sit past the validated frontier and never occur in real play; anything above 18
is guard slack past the nineteen-entry table. Index 18 is the bonus/eagle stage, handled by the phase
dispatcher at 0x71b9 ([code]), which itself sub-selects on WAVE_OUTER_PHASE (0x8f38, [seen]) between the
eagle-approach frame, the wave-launch frame, and the teardown that hands the bonus stage back to
attract.

After the selected phase returns, `runPlayStateFrame` falls into `resetToBoardBuildToContinuePlay`
(0x15d1, [seen]), the end-of-life housekeeping continuation. While a game is still live
(GAME_ACTIVE_FLAG 0x8806, [seen], nonzero) it does nothing and returns. It only bites once the game has
ended: on free play (COINAGE_CONFIG 0x882c, [seen], equal to the free-play sentinel 0x0f) it tail-hands
to the shared credit/start epilogue; with no credit banked it simply stays put; but with a credit
available it drops MAIN_GAME_STATE back to the board-build state (value 2), zeroes PLAY_STATE_INDEX,
runs the board/HUD reset and the arena clear, and blanks an eight-tile attribute column upward — i.e.
it rebuilds the board so a waiting player can continue.

One neighbour of the play entry deserves a note: `tickHudRefresh` (0x1583, [code]) bumps a HUD-refresh
tick and, on every sixteenth frame, enqueues a display-refresh command (argument 0xb5 or 0x35 chosen
by bit 4 of the tick). It then falls through into the full state-3 dispatch only while the ROM
tamper-strike counter (0x89ef) is nonzero — an anti-tamper re-entry, dormant on an intact ROM.

### Building a round: the setup phases

Sub-state 0, the round-init handler at 0x1601 ([seen]), is where a round is assembled. It first drives
the row-by-row tilemap clear and returns early each frame until that fill drains, so the build spreads
across many frames rather than stalling one. Once the screen is blanked it re-arms the fill, clears
the actor arena and a cluster of round-init cells (the wave-event latch, the rope-extend timers, and
two RAM blocks), and — on the first entry of a two-player round only — raises a once-per-round latch at
0x89e3, enqueues a player-select display command, floods the colour/attribute map, and picks a longer
phase-timer seed (0x80 on first entry, versus 0x02 for a one-player round). It then seeds PHASE_TIMER
(0x8808, [seen]), advances PLAY_STATE_INDEX, and — decisively — restores the active player's saved state
bank into the live progression block (described below). Finally it derives the rope-segment count from
the wave-arrival counter and, unless gated by a flag at 0x8906, copies the round message table into the
display message buffer.

Sub-state 1, `selectRoundDisplayListAndAdvancePhase` (0x16b7, [seen]), is a timed gate: it decrements
PHASE_TIMER every frame and returns until it hits zero, so the freshly-built board is held on screen
for its full seed count. On expiry it re-arms the fill, paints the field colour map, and — unless the
play-mode latch has diverted the round — resets the sub-phase tick, renders the phase gauge, and walks
a decision tree keyed on PLAY_MODE_LATCH (0x8f50, [code]), ROUND_IN_PROGRESS (0x8904, [seen]),
GAME_ACTIVE_FLAG, and the parity and value of ROUND_COUNTER (0x8907, [seen]) to choose a
(graphic, layout) display-list pointer pair. That pair plus the fixed pointers are committed, the
enemy spawn timer is seeded to 0x20, the index is bumped, a display command is enqueued, and the
message-buffer completion compare runs. When the play-mode latch's bit 0 is set the phase short-circuits
to sub-state 0x10 instead.

Sub-state 2, `startRoundAfterIntroDelay` (0x175d, [seen]), runs the display-list interpreter each frame
and holds behind two guards before it starts the round proper: SUBPHASE_TICK (0x88b7, [seen]) must wrap
its 0x1c-frame period, and on that wrap a one-shot at the formation-slot cell returns the first time and
proceeds only the second — a two-hit delay. Past both guards it picks its action from the same
latch/flag/round tree: it either arms sub-state 0x0d, or runs the level-start batch (round-number HUD,
phase gauge and round marker, the frame-delay / anim-hold / rope-draw timer seeds of 0x10, the enemy
spawn driver, and the sprite-list rebuild) and forces sub-state 3, raising ROUND_IN_PROGRESS and seating
the wave-arrival counter to 2 as it does.

Sub-state 3, `spawnEnemyWave` (0x17c1, [seen]), lays down the wave. It selects a seed table and a
tile-animation cursor by the play-mode latch and round parity, seeds four actor records at the actor
table (a start flag plus two table bytes each, with record 0 nudged when the screen is unflipped),
seats the shared animation cursor, and steps the animators. Its exit again forks on PLAY_MODE_LATCH:
the zero branch either arms the bonus-stage sub-state 0x12 (when the game is idle and the launch is
armed) or bumps the index and copies a biased intro string into the message buffer; the nonzero branch,
when ROUND_COUNTER bit 1 is set, fans out an enemy sprite group whose size scales with the round
(clamped to eight, tile base pulled from a word table, per-slot coordinates packed with a rippling
carry) and forces sub-state 0x0f.

Two further build-adjacent handlers sit at indices 8 and 9 — 0x1b43 ([seen]) and its sibling 0x1b8c
([code]). Both tick and drain the tilemap clear, reflood the attribute columns, enqueue two display
commands, run the shared integrity/timer render (0x7960, below), and latch the play sub-state to 0x0c;
0x1b43 additionally folds a 34-byte program block into a rolling checksum and bumps the tamper-freeze
flag (0x881e) on any result other than 0x7c, then copies a biased ROM string into the message buffer,
while 0x1b8c reloads PHASE_TIMER to 0x60.

### Active gameplay and the progression drivers

Two indices carry the running round. Sub-state 4, `runActiveGameplayFrame` (0x18af, [seen]), is the main
per-frame coordinator: it runs fourteen sub-handlers in a fixed order — joystick sampling into the
player state byte, aim-indicator/target acquisition, the object-update gate, enemy spawn servicing,
the enemy-actor and formation-object state sweeps, the sprite-list rebuild, the pending-bonus-award
tally, the target-group speed selection, the master actor-update pipeline, the periodic siren/event
driver, the once-per-level stage label, the deferred-object promoter, and the warning-siren tick. Each
reads its own state from RAM and leaves its effect there; the coordinator holds nothing of its own.
Sub-state 5, `stepGameplayFrame` (0x19ee, [code]), is the leaner sibling used on the alternate track:
formation manager, lift/marker column driver, the two state sweeps, the lead actor's secondary state
machine, and the sprite-list rebuild.

Sub-state 6, `reseedSpawnCountersAndArmPlayMode` (0x1a01, [code]), advances the round's difficulty. It
reseeds the spawn-phase counter and the rope-draw count from the board/HUD reset's return value, sets
STAGE_COUNTDOWN (0x8901, [seen]) to 0x30 once the round counter reaches 2 (else 0x28), and bumps
ROUND_COUNTER. On the odd-round branch it saves the live state to the player bank; on the even branch,
with the game no longer active it tears down to attract, and otherwise it either clears a display-list
block (when the play-mode
latch is already set) or arms the latch itself — undoing the round bump, setting PLAY_MODE_LATCH to 1,
STAGE_COUNTDOWN to 1, and the launch-script pointer to 0x40. Every non-teardown path tails into the
bank-save, which reuses the frame and resets the index to 0. The play-mode latch is thus the switch
that flips the setup phases onto their alternate (bonus/attract-driven) track.

Sub-state 7, `advancePhaseGaugeCountdown` (0x1a64, [seen]), drives the vertical HUD gauge. While the
play-mode latch is set it tails to the sub-state-6 handler. Otherwise it queues a sound, runs the
board/HUD reset, clears the once-per-round latch, and — with the game still active — counts
GAUGE_PHASE_COUNTER (0x8908, [seen]) down by one. If that count was already zero, or reaches zero on this
tick, it tail-hands to the phase-exhausted handler at 0x1a96 ([seen]); otherwise it repaints the gauge
and seats the play sub-state for the active player (0x0a for player zero, 0x0b for player one). The
helper at 0x1a85 ([seen]) does the same gauge-plus-index seating standalone. The phase-exhausted handler
at 0x1a96 queues the exhaustion sound, advances the index once more for player one and once
unconditionally, clears the high-score insert rank and two round cells, and tail-hands to the
high-score insert-sort — the beginning of that player's game-over bookkeeping.

### Leaving a round: phase-out, player switch, and continue

Indices 10 through 14 wind a round down. Sub-states 10 and 11 snapshot the live progression block into
a player bank (covered below) and reset the index to 0. Sub-state 12,
`advancePlayStateAndStageHighScoreEntryOnTimer` (0x1c03, [seen]), ticks PHASE_TIMER and holds until it
expires; on expiry it plays three sounds, paints a tilemap column strip and its frame, enqueues a
display command, and advances the index to 0x0e — and, only when the high-score insert rank
(0x89fc) is nonzero, it builds a stride-2 wipe-column pointer, seeds the wipe tile, and copies a
rotate-through-carry source table into the display buffer, staging the "you made the table" entry
screen. Sub-state 13, the per-frame object driver at 0x1c53 ([code]), just splits on ROUND_COUNTER
parity — the group-update pass on odd rounds, the spawn-subtree driver on even — and rebuilds the
sprite list.

Sub-state 14, `dispatchRoundEndElseWipeColumn` (0x1c66, [seen]), is the master exit. It ticks
PHASE_TIMER; while a reset latch is armed and the timer has expired it stamps the reset column, sums a
ten-row HUD strip and proceeds only when that sum equals the magic 0xaa (an integrity gate on the
re-init), disarms the latch, and branches on the player situation: a one-player game goes to the
full-clear/continue tail; in a two-player game, player zero's turn ending routes to the
reseed-the-other-player tail, an exhausted player-zero life count routes to the full-clear tail, and
otherwise it swaps to player zero, zeroes PLAY_STATE_INDEX, zero-fills player one's bank, arms the flip
flag, resets the display pointer, and stamps the cap-first column. When the reset condition is not yet
met it instead runs the per-frame write-anim pre-pass `loc_7e94` [code] and, only every eighth tick and
only while a high-score entry is pending, wipes a vertical column with a stepping fill tile (clamped back
to 0x06 once it passes 0x10).

The write-anim pre-pass `loc_7e94` [code] is a run-once-latched dispatch redirect: once the latch
(RESET_SCAN_LATCH) is set, or while HIGH_SCORE_INSERT_RANK is zero (which arms the latch), it skips
straight to the epilogue; otherwise a selector picks one of three write-anim state handlers — `loc_7eb2`
[code] seeds an animation work block (stamping the 16-bit `FIRE_PHASE_SEED` (0x03a0, [code]) into the
block's word cell 0x8e2b), `loc_7f0e` [code] counts the block down and steps its index, and
`loc_7f5d` [code] rotates a phase ring and, when the ring settles on the fire phase, re-stamps that same
`FIRE_PHASE_SEED` before advancing the block pointers — before every path tail-returns
into the per-frame start-button poll `startGameOnStartButtonPress`. Two of those handlers share a
fill-and-latch tail `loc_7fa8` [code] that floods a run of tile and record cells and re-arms the latch.

The two swap/continue tails carry the alternation. `reseedOtherPlayerForTurn` (0x1cf6, [code]) hands off
to the full-clear tail when player one is out of lives; otherwise it clears the index, zero-fills
player zero's bank, marks player one active, resets the display pointer, and stamps the second scroll
column, letting the incoming player's own round-init restore their state.
`clearActorsAndEnterContinueState` (0x1d15, [code]) zero-fills the live actor page, reseeds one player's
sprite slots (fixed-stride paint for one player, cap-first stamp for two), and then — with no credit
left — tails to the cold teardown, or, with credit banked, clears the active gate and index, arms the
flip flag, and drops MAIN_GAME_STATE to the board-build state (2): the continue screen. The cold
teardown, `resetGameToAttractState` (0x1d3c, [seen]), zeroes the whole in-play state block (game-active,
index, active player, two-player flag, attract sub-state), seeds the fresh-start flags (main state 1,
flip normal, launch armed), zeroes the board RAM, posts sound command 0, and unpacks the packed attract
message table ATTRACT_INIT_MESSAGE_SRC (0x1e4c) [code] (each byte halved) into the display buffer.

### The live progression block and the per-player state banks

A player's entire round-state lives in a contiguous 0x3f-byte block based at 0x8900 — SPEED_INDEX
(0x8900, [seen]) is its byte 0. Read in order the block holds the enemy speed index (byte 0, also the
sprite colour), STAGE_COUNTDOWN (byte 1, 0x8901), the spawn-phase counter (byte 2, 0x8902,
[seen]), the wave-arrival counter (byte 3, 0x8903, [seen]), ROUND_IN_PROGRESS (byte 4, 0x8904),
ROUND_COUNTER (byte 7, 0x8907), the phase/gauge counter (byte 8, 0x8908), the pending award queue
(byte 9, 0x8909), and the rest of the per-round counters. This is the state that must persist across a
two-player alternation, so the machine keeps two saved copies: PLAYER0_STATE_BANK (0x8940, [seen]) and
PLAYER1_STATE_BANK (0x8980, [seen]), each a 0x3f-byte mirror of the live block at the same byte offsets.

The swap is a plain block copy in each direction. `saveLiveStateToPlayerBank` (0x1a47, [code]) first
clears the round-in-progress byte of the caller's page, then copies the 0x3f live bytes into whichever
bank the active-player flag selects, and zeroes PLAY_STATE_INDEX. `saveLivePageToPlayer0Bank` (0x1bab,
[seen]) is sub-state 10: in a two-player game whose player one still has lives it first latches the
active player, then snapshots the live page into player zero's bank and resets the index.
The handler at 0x1bcc ([code]) is sub-state 11's counterpart for player one: it marks player zero active
when that player is still alive, copies the live page into player one's bank, resets the index, and then
folds the low five bits of a fixed program block onto the advanced copy pointer as a signature
tripwire — bumping the signature tamper counter (0x8a38) unless the fold lands on its expected
sentinel word. The restore direction is inside round-init (0x1601), which copies the incoming player's
bank back over the live block before play resumes.

### Lives and the player-alternation gates

Whether a game continues or ends turns on two cells and two flags. ACTIVE_PLAYER (0x880d, [seen])
selects which banks are live — its bit 0 clear points at player zero's score and state, set points at
player one's — and TWO_PLAYER_FLAG (0x880e, [seen]) marks the game as a two-player game and gates the
alternation entirely; when it is zero, a round-out goes straight to the one-player continue/teardown
path with no swap. Each player's remaining count is kept inside their saved bank at byte offset 8:
PLAYER0_LIVES (0x8948, [seen]) and PLAYER1_LIVES (0x8988, [seen]). Both are seeded from the cabinet
lives switch LIVES_DSW (0x8807, [code]) by `resetActorStateForBoard` (0x0e00, [seen]), which also seats
the opening sprite X and the sprite colour (from the difficulty switch) into each bank and clears the
live page. Because that lives byte sits at block offset 8, it occupies the same physical cell that,
while a player holds the turn, is the live phase/gauge counter GAUGE_PHASE_COUNTER (0x8908) — the count
`advancePhaseGaugeCountdown` drains and draws as the vertical HUD gauge, and whose exhaustion runs the
phase-exhausted handler (0x1a96) into the high-score insert-sort.

The swap master (`dispatchRoundEndElseWipeColumn`) reads these banked counts to decide: a two-player
game with player zero's turn ending swaps to player one's turn, and an incoming player with zero lives
banked routes to the full-clear/continue tail instead — that is the game-over test. The
credit-in-slot path is guarded by `startGameOnStartButtonPress` (0x7fd6, [seen]): with a credit present
it folds the two-player flag, the gauge counter, and one player's banked lives (picked by the
active-player flag) into a status byte and fires only when that status is zero (nobody already active) and the input-port start bits are
set, tailing into `startSelectedPlayerGameConsumingCredits` (0x0d78, [code]). That handler routes a
one-player start (input bit 3) to `startOnePlayerGameOnCredit` (0x0de4, [seen]) — which spends one
credit and restarts a fresh single-player game — and a two-player start (bit 4) through a two-credit
spend and a credit-table checksum into the two-player entry `beginTwoPlayerStartOfLife` (0x0da8, [code]),
which seeds the start-of-life seed and falls into `startNewGamePlay` (0x0dab, [seen]). That common
start-of-life setup records the active-player word (low byte the player index, high byte the two-player
flag), runs the pre-play display setup, sets the top-level state to play (main state 3, index 0,
game-active 1, flip normal), resets the actor tables, primes the periodic-event pair, and enqueues the
start-of-life sound — with a second-player variant and a panel-block clear when the game is two-player.

### The BCD play timers

Each player is timed by a three-byte BCD stopwatch: PLAY_TIMER_BCD_P1 (0x8a30, [code]) for player one
and PLAY_TIMER_BCD_P2 (0x8a33, [code]) for player two. In each bank byte 0 is a per-frame sub-counter,
byte 1 the BCD seconds, and byte 2 the BCD minutes. `runPlayStateFrame` ticks the active player's timer
once per frame through the handler at 0x7912 ([code]). It bails when the game is inactive, selects the
active player's gate/timer pair, and bails again when that player's gate byte — PLAY_TIMER_GATE_P1
(0x89e1, [code]) or PLAY_TIMER_GATE_P2 (0x89e2, [code]) — is set, so a benched player's clock is frozen
by simply raising the gate. The frame sub-counter counts up to a limit that is not a fixed 60 but
alternates between 0x3b and 0x3c, the extra frame chosen by bit 0 of the seconds byte — a per-second
correction for the machine's frame rate. On reaching the limit it clears and BCD-carries the seconds
digit (low nibble rolling at 0x0a, the whole digit at 0x60), and on a seconds roll-over carries into
the minutes digit the same way.

Rendering and archival of the timer are handled by the shared integrity/timer routine at 0x7960
([code]), invoked from the phase-out handlers 0x1b43 and 0x1b8c. After a code-block integrity checksum,
it splits the active player's minutes and seconds BCD bytes into hi/lo nibble tiles up the timer column
at PLAY_TIMER_DIGIT_VRAM (0x862d, [code]), separated by a spacer tile, then clears those three timer
bytes and scans a small flag block that can divert to a tail checksum (a high-byte miss repaints the
phase gauge). The timers also feed the high-score record: a parallel side table
HIGH_SCORE_TIME_TABLE (0x89e0, [code]) shifts alongside the sorted score table on an insert, storing the
new entry's two play-timer BCD bytes into the opened slot — so a table placement remembers not just the
score but how long that player survived.

## The actor arena

Almost everything that moves on screen -- the eagles, the arrows, the falling
enemies, the growing/shrinking "fountain" sprites, the player himself -- lives in one
contiguous block of work RAM as a table of fixed-size records. That table is
`ACTOR_TABLE` (0x8a80), a 0x18-byte-per-record array zero-filled at board init, and slot
0 is the player/lead actor. Sub-regions of the same array are reached through their own
base pointers: `ENEMY_ACTOR_TABLE` (0x8ae0) is the enemy-actor sub-array sitting 0x60
bytes (four records) into the arena, and its records are what most of this section
touches. All of these bases are [seen]: slot-0 field-0 toggles exactly when
the player becomes active, and the enemy records' active flags cycle in play.

A record is a small struct addressed by fixed byte offsets, and the offsets are reused
by whichever state handler owns the record that frame. The recurring ones: byte +0 is the
active/id-low flag (bit 0 = active), +1 a secondary state gate, +2 the primary state byte
that selects the record's per-frame handler, +4 the sprite Y coordinate, the +5/+6 pair a
16-bit sub-position (low fraction, high row), +7/+8 a link pointer to a partner record,
+9 the per-frame step or a tile id, +0x0c/+0x0d an animation-sequence pointer with +0x0e
its frame index, +0x0f the display-tile byte, +0x11 a frame-hold timer, +0x13 a sprite
index, +0x14 a match tag, and +0x15/+0x16 a screen-pointer. Nothing enforces this layout;
it is simply the convention every handler agrees on.

Alongside the arena sit several smaller record pools with the same 0x18 stride, each with
its own base and slot count: the 3-slot spawned-object table `SPAWN_OBJECT_TABLE`
(0x8c48, [seen]) that descending enemies drop into and that shots are tested against; the
formation spawn table `FORMATION_SPAWN_TABLE` (0x8c60, [seen]); and the 6-slot hunter
record table `HUNTER_TABLE_BASE` (0x8c78, [seen], scanned downward), which doubles as the
"fountain" record the grow/shrink animation drives. A 6-record object-state array at
`OBJECT_STATE_RECORD_BASE` (0x8ba0, [seen]) spans forward into the projectile table
`PROJECTILE_TABLE` (0x8be8).

### Sweeping the records each frame

The arena is not walked by one master loop but by several small sweeps, each ticking a
count of records from a base at the 0x18 stride. The shared engine is the animation-tick
walk `advanceEnemyActorStateWalk`: from `ENEMY_ACTOR_TABLE` it ticks `count` records in
order, and a tick may abort the whole walk -- when one signals a hit/abort the walk
returns early and leaves the rest of the records untouched that frame. Two thin entries
pick the count: `advanceFirstGroupEnemyActorStates` (0x7621's sibling entry) ticks the
first 8 records, and `advanceAllEnemyActorStates` (0x7621, [code]) ticks all 14. Each
per-record tick is `0x7638`, which reads the low two bits of the record's +2 state byte
and hands off to one of three tick-state handlers (0x7644, 0x7675, 0x76a6); states 0 and 1
may abort the walk, state 2 always continues.

A parallel sweep, `dispatchAllEnemyActorStates`, walks the same 14 enemy records and runs
the full per-record state dispatcher on each. And the six-record object-state array at
0x8ba0 is swept by `0x76f4` via `dispatchActiveObjectState`: a record is skipped entirely
unless bit 0 of (+0 | +1) is set, and for a live record the low two bits of +2 select one
of four object-state handlers (0x771d, 0x7740, 0x7790, 0x7881). A separate lighter pass,
`advanceActorAnimationsUnlessGrabbing`, steps just the animation script of the first four
arena records -- but only while the rope-grab latch `GRAB_ACTIVE_FLAG` (0x8d32, [seen]) is
clear; a grab in progress freezes those four.

Two distinct per-frame pass-drivers sit above the sweeps. `runObjectAndEnemyActorUpdate`
(0x76ea, [code]) runs three subsystems in fixed order: advance the six-record object-state
table (0x76f4), tick the first 8 enemy records' animations, then rebuild the sprite
display list (0x02ef). `runObjectAndSpawnUpdatePass` (0x64e2, [code]) instead drives the
fountain/spawn subtree: it seeds the stacked two-tile blitter, dispatches the fountain
(hunter) record's own state handler, runs a 3-record enemy-actor state pass
(`updateEnemyActorsAndCycleLaunchFlipAnim`), then the special-object dispatcher `0x6822`.
The choice between them is made by `0x1c53`, which branches on the low bit of the round
counter `ROUND_COUNTER` (0x8907): odd rounds run one pass (0x68f8), even rounds run the
spawn subtree, and either way the sprite display list is rebuilt afterward. (Its
descriptive name reads "even frame", but the bit it actually tests is the round counter's
low bit, not a frame parity -- the split is per-round, not per-frame.)

The enemy records themselves run a four-state machine.
`updateEnemyActorsAndCycleLaunchFlipAnim` (0x66c5, [seen]) dispatches three consecutive
records through `dispatchEnemyActorState` (0x66f1, [code]), which reads each record's +2
state byte and routes state 0/1/2/3 to, respectively, the descent-delay handler, the
descend-and-seat handler, the ascend handler, and the round reinit. State 0 is
`advanceEnemyActorToDescentStateOnDelay` (0x66fd, [seen]): it idles while the shared phase
gate `SHARED_PHASE_GATE` (0x8930, [code]) is clear, otherwise counts the shared phase
countdown `SHARED_PHASE_COUNTDOWN` (0x892e, [seen]) down; on expiry it reloads that
countdown to 0x12, bumps the record's +2 phase into descent, clears +3/+5, seats +4 = 0x15
and +6 = 0x02, points the record at its animation sequence, and stores the tile id 0x2c
into +9. After the three-record dispatch, and only while the enemy table's lead state byte
(0x8ae2) is non-zero, the routine runs a flip-command cadence: it decrements the countdown
in `WAVE_NUMBER` (0x892d) while it is live, and on expiry reloads that cell to 0x10, bumps
the flip toggle 0x892f, and enqueues one of two flip display commands by the toggle's low
bit. `WAVE_NUMBER` is [code] and honestly multiplexed -- its primary role is a wave/stage
progression index counting 0..8, and this per-frame countdown-to-0x10 reuse is a distinct,
mode-dependent use the same cell is put to here.

### Stepping an animation

The fountain sprites -- the enemies that visibly grow then shrink -- are animated by
`animateActorGroupGrowShrink` (0x6566, [code]), run once per frame against the fountain
record. It is gated by a flip countdown held in `LAUNCH_FLIP_COUNTDOWN` (0x892f). This
cell is [code] and honestly multiplexed: the eagle/launch path at 0x65xx also writes and
decrements it, and here it serves as the grow/shrink flip timer. While it is non-zero the
routine just ticks it down and returns, so the sprite holds its current size. When it
reaches zero the routine advances the phase toggle `ANIM_PHASE_TOGGLE_892C` (0x892c,
[seen]) and reads its new bit 0: bit 0 set selects the shrink (odd) half, clear selects
the grow (even) half, and the same bit reselects the tile-source row for the render.

The shrink half reseeds the flip countdown to 0x0c and shrinks the sprite: it subtracts
the +8 delta from the +3 field (a borrow steps the +4 coordinate down), subtracts the +9
delta from the +5 field (a borrow walks the +6 field down by 1/3/5), and does so across a
base bank plus two shadow banks a fixed 0x18 and 0x30 below -- three mirror copies kept in
lockstep. It then renders three records from a tile-source row chosen by the toggle's bit
0 (`TILE_SRC_ROW_66C2` when set, `TILE_SRC_ROW_66BF` when clear, both [code] ROM rows),
copying tiles into successive record +0x0f fields. The grow half instead reseeds the flip
countdown to 0x06 and adds the +8 delta into +3 (an overflow steps +4 up) across the three
banks, then -- unless the record's +6 field has already reached the 0x0c cap -- reseeds the
record's three timer fields (+0x10 to 0x40, +9 to 0x18, +2 to 0x02 across all three banks),
arms the shared phase gate and countdown, and runs a mirror-bank integrity sweep over the
colour-map strips: each of ten strip slots must equal its shadow one row below, and the
running 16-bit sum of twenty cells must land on 0x012a, or the routine throws (intact data
never trips it).

A second, simpler animation stepper is `cycleActorGroupSpriteFramesOnTimer` (0x66a1,
[code]). It counts down `BLINK_PHASE` (0x892b) -- another [code], role-contested
multiplexed cell: the blink-tile path toggles it as a parity bit in step with a tile swap,
while this object-anim path seeds it to 0x08 (in `spawnActorGroupRecords`) and treats it as
a countdown. While the count stays non-zero the routine returns at once; on reaching zero
it reloads to 0x08, advances the same phase toggle 0x892c, and by that phase's bit 0 picks
one of the two 3-tile source rows, handing three records (one record backward each) their
tiles. So both animation steppers share the 0x892c phase toggle but gate on different
countdowns (0x892f for grow/shrink, 0x892b for the sprite-frame cycle).

The stacked-tile blitter `blitStackedTwoTileAnimFrameOnHoldTimer` follows the same
countdown-then-toggle shape but paints tilemap directly rather than seeding records: a hold
timer `TWOTILE_ANIM_HOLD` (0x8f06, [seen], reload 0x0c) gates the work, on expiry the phase
`TWOTILE_ANIM_PHASE` (0x8f07, [seen]) advances and its low bit picks one of two adjacent
4-byte source patterns, which is stamped as a 2x2 block at the screen anchor and again two
rows higher.

A separate one-shot arms an actor's fall rather than stepping frames: `armActorDropAnimationNearTop`
(0x3a51, [seen]) acts only when the actor is near the top of its travel (its high-position byte below
2), seating the ROM drop-animation descriptor `DROP_ANIM_DESCRIPTOR` (0x3bd1, [code]) into the record
through `setActorAnimation`, marking the record's sub-state as dropping (0x02), and reloading its phase
timer (0x28).

### Spawning new actors

New actors enter the arena through the fountain record's state-0 handler
`spawnActorGroupRecords` (0x6505, [code]). It first seeds two cells -- the shared frame-
delay timer `SHARED_FRAME_DELAY_TIMER` (0x8929, [seen]) to 0x1c and the blink-phase cell
0x892b to 0x08 -- then walks three object records backward one 0x18 stride at a time,
seating each and bumping its +2 phase byte, and finally emits a tile-command sound run.

The per-record seating is `seatActorRecordAndQueueSpawnDisplay` (0x6523, [code]). It bails
if the record's id word (+0 | +1) is odd or the signature-mismatch flag
`SIGNATURE_MISMATCH_FLAG` (0x8ef0, [code]) is held; otherwise it stamps the opening state
-- active flag +0 = 1, cleared +3/+5, fixed +4 = 0x15, +0x0f = 0x03, +0x10 = 0xc0,
+8 = 0x30, +9 = 0xf0 -- and snapshots the shared frame-delay counter into +6 before stepping
that counter down by two, so successive records get staggered delays. It then enqueues the
object-spawn display command `OBJECT_SPAWN_DISPLAY_CMD` (0x0611), plus a second variant
`OBJECT_SPAWN_DISPLAY_CMD_ALT` (0x0607) when the round counter is zero.

The descending-enemy path seats spawn slots as it falls. `descendEnemyActorAndSeatSpawnSlot`
(0x672a, [seen]) is the state-1 handler of an enemy record: it steps the animation, advances
the record's 16-bit sub-position (+5 low, +6 high) by the +9 step, and while the high byte
is still above the landing row (0x18) it scans the three `SPAWN_OBJECT_TABLE` (0x8c48) slots
for a free one whose +6 row matches the record's. On a match it bumps the wave-arrival
counter `WAVE_ARRIVAL_COUNTER` (0x8903, [seen]), marks the slot seated, seats a biased X
(source -0x80, borrowing into the slot's high byte) and Y (source +0x40, carry decrementing
the high byte), writes the slot init byte 0xc0, links the slot back into the record's +7/+8,
and arms the shared frame-delay timer to 0x20; a scan that finds no free matching slot returns
at once without advancing. Otherwise -- the landing row already reached, or a slot just seated --
it bumps the record state, reloads the step to the row height 0x18, and re-arms the record's
animation. The ascent
counterpart `ascendEnemyActorAndLinkedSlotOnTimer` (0x67a0, [seen]) is gated by that same
shared frame-delay timer: while it is non-zero the handler just decrements and returns; on
expiry it steps the animation and moves two 16-bit positions up by the +9 speed -- its own
+5/+6 pair and, if the record links a partner (its +8 high byte non-zero), the linked
record's +5/+6 too -- and advances the record's state once its own +6 high byte reaches
zero.

The fountain's other two states advance the group upward and retire it. `advanceActorGroup
RiseAndCycleTiles` (0x6666, [code], state-2 handler) walks three actor records backward from
the fountain pointer running `advanceActorToTopRowThenRetire` on each, then runs the
countdown-gated sprite-frame cycle over the hunter table. `advanceActorToTopRowThenRetire`
(0x667c, [code]) advances one actor only while its +1 gate is idle: it adds the +9 step into
the +5 sub-position, carries an 8-bit overflow into the +6 row, and once that row reaches the
retire row 0x1d it retires the record -- +1 = 2 with +4 and +6 cleared. The whole fountain
subtree is selected by `runActorGroupStateHandler` (0x64fb, [code]), which reads the
fountain record's +2 state byte and dispatches state 0/1/2 to the seed, animate, and rise
handlers respectively.

### Stacking the player sprite

The player is drawn as three sprites stacked vertically, and the vertical axis they all
follow is the single cell `PLAYER_Y` (0x8a84, [seen]) -- the player-actor's Y, which the
joystick drives and which enemy AI reads to aim its dives. `deriveStackedSpriteYs` fans that
one base Y out to the Y fields (+4) of arena slots 1/2/3 (at ACTOR_TABLE + 0x1c/0x34/0x4c):
slot 3 takes the base Y, slot 2 takes Y - 0x10 (one sprite-height up), and slot 1 takes
Y - 0x10 + 0x0a, tucking it 0x0a below slot 2's top. Feeding all three from the same source
each frame is what keeps the stack rigid as the player rides up and down.

The objects the enemies drop are drawn with the same stacking idiom by `drawObjectStacked
Tiles`, the object-record state-2 handler. It advances the record's animation, decrements the
+0x11 frame timer and holds while it runs; on expiry it draws two stacked 2x2 tile blocks --
the record's +0x13 sprite index selects a char-table word painted at the +0x15/+0x16 screen
pointer for the lower row, and the row above (pointer - 0x400) from a second char table --
sets the one-shot `OBJECT_DRAWN_FLAG` (0x8d58, [code]), and falls through to clear and reseed
the slot. Tiles reach the arena records themselves through `copyDisplayTilesIntoActorRecords`,
which copies a run of source bytes into successive records' +0x0f tile fields; when the run
finishes it ORs the terminator-strike counter `TAMPER_STRIKES_TERMINATOR` (0x8df9, [code])
with the board-clear flag and, if either is set, diverts into the board/HUD reset.

### The object-proximity collision scan

Collision is a set of proximity scans run in a fixed order each frame from the master actor
updater `runActorUpdatePipeline`, which invokes its eleven subsystem handlers straight
through. Three of them are the scan drivers this section covers, and each runs its scan twice
-- once per target slot -- aborting the moment a pass claims a hit so the struck object is
serviced before any second slot is even looked at.

`resolveObjectProximityHitsBothSlots` (0x602f, [code]) walks the two target slots based at
`SPRITE_ACTOR_RECORD_SLOTS` (0x8848, stride 4), tagging each pass with a slot selector (0
then 2), and runs the per-slot arm `0x6048` for each. That arm picks the slot's presence
block -- `ENEMY_TARGET_REC0` (0x8c90) for slot 0 or `ENEMY_TARGET_REC1` (0x8ca8) for slot 1,
both [seen] -- and gates on its lead byte: an empty (0) or already-engaged (3) block is inert
and the pass returns cleanly; a live block latches its kind into `ACTIVE_OBJECT_TYPE`
(0x8d44, [seen]) and enters the five-record scan `0x6069` over the object table. The actual
overlap test is `0x5fa2`: an empty slot (record +0 = 0) or a non-type-5 record (+2 != 5)
advances to the next slot; otherwise it measures per-axis distance between the record's box
and the target, biasing X by the screen-flip sign (`FLIP_SCREEN_FLAG` 0x881f, [seen]:
+6 upright, -5 flipped) and both boxes by a fixed +8 in Y, and applies the wider window
(0x10 / 0x12) when the hit type is 3 or the tight 8 / 8 otherwise. A full overlap of a
type-3 record tallies the hit (bumps 0x8d45) and retires it via `0x613d`; a full overlap of
any other type flags the struck record's cell -- 0x8c91 or 0x8ca9 by the target's low byte --
and its +6 partner, sounds the hit, and aborts. `advanceOverlapScanToNextSlot` (0x6018,
[code]) is the advance-and-loop latch: it steps the record index by one slot and the geometry
pointer by one 0x18 stride, counts the slot down, and either re-enters the scan pass for the
next slot or reports the sweep exhausted with no hit.

`resolveProjectileCollisionsBothActorSlots` (0x6368, [code]) runs the projectile-proximity
scan against the two actor boxes at 0x8848 +0 and +4, handing pass 1 the interrupt-parity
selector 0 and pass 2 the stride value 4. Each pass (`0x6381`) points the coordinate cursor
at `SPRITE_TARGET_SLOTS` (0x887c, [seen]) and the record cursor at `PROJECTILE_TABLE`
(0x8be8), and the instant a pass claims a hit the driver aborts the remaining pass.

`scanActorCollisionsBothSlots` (0x6404, [code]) is the scoring collision driver, and
it is conditionally skipped: it does nothing when the play-mode latch `PLAY_MODE_LATCH`
(0x8f50, [code]) is clear and the round counter's bit 0 is set. Otherwise it scans the actor
record twice (selectors 0 then 4) via `0x6435`, aborting on the first collision. `0x6435`
picks its object set by the play-mode latch -- when clear it scans the P1 coordinate slots
`SPRITE_TARGET_SLOTS_P1` (0x888c, [code]) against `SPAWN_OBJECT_TABLE` (0x8c48), when set the
main target slots against the projectile table -- tests up to three records for both biased
axes within magnitude 7, and on a hit resets the struck record, raises the interrupt-parity
hit flag (`OBJ_HIT_FLAG_I0` 0x8d1b or `OBJ_HIT_FLAG_I1` 0x8d1c, both [seen]), restarts its
animation, queues the hit sound, queues a hunter-spawn command when the play-mode latch is clear, bumps the
target hit tally `HIT_TALLY` (0x8f52, [code]), then runs a terminator integrity guard whose
abort unwinds the frame.

Two supporting paths finish the hit. `markHitFlagSeedActorAndScanEnemyRecords` (0x60d9,
[code]) marks the interrupt-parity hit-flag slot active, stamps the opening state (a 0x0404
datum at +0x16/+0x17) into a fresh actor record, then runs `dispatchHitToEnemyRecordElse
QueueSound` (0x611f, [code]): it reads a scan key from a computed record byte and walks up to
six enemy records at 0x8ae0 for the first whose +0x14 tag matches; a match is handed to
`0x613d` (which aborts the frame), and with no match a fixed sound is queued unless the
active object type is already 3. `0x613d` decides how a matched record is handled -- unwind at
once, clearing the object type without touching the record, when the record's +0 bit 0 is clear;
reset it while the round is odd or the object
type is not 3 (`resetActorRecordQueueSoundAndAbortFrame`, 0x6166, [code], which clears the
record to its idle opening state and queues one of two sounds by type), or on the type-3 path
run a six-record engage scan whose first match calls `engageMatchedSpriteObjectAndResetActor`
(0x6190, [code]) -- seating +8 = 0x01 and +0xa = 0xd0 on the target before falling into the
same reset. Every one of these branches ends by clearing `ACTIVE_OBJECT_TYPE` and aborting
the frame (`0x618a`). The shared leaf `precheckCollisionBounds` biases an actor's X by the
flip sign and reports whether its Y+8 margin clears the 0xe0 bottom limit -- the off-screen
gate the scans consult before testing an actor.

### Teardown

When a round ends the arena and the playfield are wiped and rebuilt by `reinitRoundArenaAnd
PlayfieldIfImageIntact` (0x67df, [seen]), which is also the enemy-record state-3 handler and
the tail of the special-object dispatcher `0x6822`. Before it destroys anything it verifies
the screen image: it sums ten colour-map cells one tilemap row (0x20) apart into an 8-bit
accumulator and requires the clean sentinel 0x5a. A mismatch means the image is not intact,
so instead of reinitializing it hands off to the per-object frame updater
(`ascendEnemyActorAndLinkedSlotOnTimer`) and returns, leaving the round running.

On a matching checksum it arms a fresh screen: it raises the round-in-progress flag
`ROUND_IN_PROGRESS` (0x8904, [seen]) and seeds both the phase timer `PHASE_TIMER` (0x8808,
[seen]) and the play sub-state `PLAY_STATE_INDEX` (0x880a, [seen]) to 1, clears the nine-byte
per-frame timer block at `FRAME_TIMER_BLOCK_BASE` (0x8928, [code]), zeroes the entire
0x241-byte actor/object arena from `ACTOR_TABLE`, and paints the playfield -- a 0x1d x 0x1d
square of the blank tile 0x10 from `PLAYFIELD_PAINT_START` (0x8442), one row per pass with a
row-gap step to the next row's first cell. The colour-map checksum guarding the wipe is the
same strip that the grow-half integrity sweep sums, so a corrupted image both blocks the
reinit and trips the animation guard.

## Waves, rope and launch

Three loosely related subsystems share the 0x7000-0x73ff region and the object machinery
around it. The first is the bonus-stage attack wave — the "eagle" wave — a self-contained
attractor that seeds a batch of enemy records, marches them onto a grid, then dives, climbs,
and retires them before holding for the next wave. The second is the rope, a segment-by-segment
structure that extends across a stage, drops hanging bonus objects, and can be grabbed. The
third is the arrow-and-launch machine, which raises a launch object, spawns the wolves
("hunters") from it, and — while the game is idle — drives the player's aim indicator.

The bonus wave has an outer skeleton in the phase dispatcher at 0x71b9. It reads
WAVE_OUTER_PHASE (0x8f38) and routes the frame to one of three phase bodies: phase 0 is the
approach (`runEagleApproachPhaseFrame`), phase 1 is the launch/dive driver
(`runWaveLaunchPhaseFrame`), and phase 2 tears the bonus stage down and returns to attract
(`clearWaveStateAndArenaOnHoldExpiry`). Whichever body runs, the dispatcher finishes in the
shared per-frame sprite epilogue (the display-list rebuild at 0x02ef), so the wave logic and
the rest of the frame stay stitched together.

### The enemy attack wave

The wave's lifecycle is seed → arrive → dive/climb → retire → inter-wave hold → re-arm, spread
across two outer phases.

**Approach (outer phase 0).** `runEagleApproachPhaseFrame` [code] steps the approach state
machine and then runs the shared per-frame object update; the two do not hand any register back
and forth, so the update simply follows. The state machine itself is
`advanceEagleApproachAndPaintGridMarker` [seen]. A hold counter gates it: while WAVE_HOLD_TIMER
(0x8f36) — the same inter-wave hold countdown drained elsewhere — is nonzero it just ticks down
and returns. Once the hold clears, the machine drives the player aim-indicator flags from the
eagle's advancing coordinate and, on its final sub-phase, paints a marching grid marker.

A subtlety worth stating plainly: the advancing coordinate the approach machine reads is
PLAYER_Y (0x8a84), not the eagle record's own X. In the bonus stage that cell carries the
eagle's approach position. The machine compares it against two X thresholds — a near threshold
of 0x59 and a far threshold of 0x60. When no target is present it aims straight from that
coordinate; once the coordinate reaches the far threshold it latches the value into
LATCHED_ENEMY_X (0x8f5b) and shows the "below" aim bit, and once latched it flips to
"on-target". Sitting exactly at the near threshold steps the records-arrived sub-phase
WAVE_RECORDS_ARRIVED (0x8f39): 0→1 clears the aim bits, anything-but-2 → 2 arms the aim flag,
and 2 runs the grid-marker step.

The grid-marker step advances only on an eighth-frame boundary, gated by the low three bits of
EAGLE_GRID_STEP_TICK (0x8f3b). On that boundary it computes a cell up from EAGLE_GRID_VRAM_BASE
(0x87e0) by the record's grid column, stamps a marker tile (0x2c) there, and writes a colour
attribute derived from the low bits of the record's column and position fields. The grid-edge
guard `armEagleFinishAtGridEdge` [code] reads the eagle's advancing grid coordinate (field +4 of
the target record) and, while it is short of the edge (0xd0), hands it back so the marker keeps
stepping; once it reaches the edge it sets EAGLE_FINISH_FLAG (0x8f3e) and runs the phase-reset
epilogue. When the finish flag is set the marker paint falls back to writing at the
records-arrived cell address — a quirk of the epilogue repointing the running cursor there. The
epilogue `advanceEaglePhaseAndClearAim` [seen] drops the aim flags and the latched enemy X,
advances WAVE_OUTER_PHASE (which sits one cell below the arrived count), and clears the arrived
count so the next phase starts fresh.

**Launch and dive (outer phase 1).** `runWaveLaunchPhaseFrame` [code] runs the shared per-frame
update, then the wave driver `driveEagleWavePerFrame` [code]. The driver is a three-way switch on
two flags. If WAVE_LAUNCH_FLAG (0x8f3a) is clear, it seeds the next wave and returns. If
WAVE_RECORD_COUNT (0x8f3c) is zero, it hands off to the inter-wave idle handler. Otherwise it
walks the wave's live records — two per WAVE_INDEX (0x8f3d) — through the per-record state
handler, stepping the enemy-actor table ENEMY_ACTOR_TABLE (0x8ae0) by 0x18 each time. A count
that comes out zero means a full 256-record pass, matching the eight-bit down-counter.

`seedNextEagleWave` [seen] runs only while the target slot ENEMY_TARGET_REC0 (0x8c90) is clear.
It raises the launch flag and bumps WAVE_INDEX. On the fourth wave (index 4) it seeds no records
at all — it just re-arms the outer phase and reloads the hold timer to 0x20. Otherwise it sets
WAVE_RECORD_COUNT to twice the wave index and initialises that many records from the four-byte
parameter table EAGLE_WAVE_PARAM_TABLE (0x7409) [code]: each record is marked active with its
target column (+6), row (+4), and two other fields copied in, records whose own low address has
bit 3 set also get a flag byte at +3, and all get a flag at +5. It finishes by clearing the
outer phase and the arrived count.

The per-record dispatcher `dispatchActiveEagleRecordState` [code] skips a record whose active bit
(bit0 of the first two bytes) is clear, then routes the record state byte (+2), which is bounded
0..2, to one of three handlers. State 0 is `advanceEagleToArrivalAndTallyWave` [seen]: it returns
unless the eagle has reached this record's grid slot — its column (EAGLE_X_COORD 0x8c96, shifted
right by 3) must equal the target column at +6 or the one just before it, and its row
(EAGLE_Y_COORD 0x8c94 shifted right by 3, plus 4) must fall within a five-row window beginning at
the target row at +4 — the target row, or up to four rows past it. On arrival it advances the record state and arms an animation: odd records
(bit 3 of the low address set) get EAGLE_ODD_RECORD_ANIM (0x7403) and a flag; even records get
EAGLE_EVEN_RECORD_ANIM (0x4086), bump the arrived count, and — once every record of the wave has
arrived (arrived equals the wave index) — queue the wave-arrival display command from
WAVE_ARRIVAL_CMD_BASE (0x0630) offset by the arrived count. Both EAGLE_X_COORD and EAGLE_Y_COORD
are [code]: they are shared actor-record coordinate cells, and the eagle's use of them is read
from the code, not yet write-confirmed for this species.

State 1 is `advanceEagleDiveClimbToRetireAtLimit` [seen]. It steps the record's animation, then
integrates the record's sixteen-bit vertical position (fractional byte at +3, row at +4) by the
per-record speed at +9. An even-indexed record descends: it adds the speed, a carry drops the
row one line, and reaching the bottom row (0x1d) advances the state byte. An odd-indexed record
climbs: it subtracts, a borrow lifts the row, and rising above the top row (0x04) advances the
state. So even records dive to the floor and odd records climb to the ceiling before both retire.

State 2 is `despawnEagleAndSeedHoldOnWaveEmpty` [seen]: it zero-fills the whole 0x18-byte record,
decrements WAVE_RECORD_COUNT, and — when that reaches zero, meaning the last record of the wave
has retired — seeds the inter-wave hold WAVE_HOLD_TIMER to 0x30.

**Inter-wave hold and re-arm.** When the driver finds no records left it calls
`tickEagleInterWaveHoldAndRearmLaunch` [seen]. While the hold timer runs it just ticks it down.
On expiry, if a wave index is still set, it enqueues a display command (opcode 0x06, parameter 0xb0
plus the wave index) via the rst-0x38 ring, reseeds the hold to 0x18, and clears WAVE_LAUNCH_FLAG so
the driver's next frame seeds a fresh wave. This is the loop that carries one wave into the next.

### The rope

The rope has its own extend state machine plus a bank of per-cell state machines, both run once
per frame from the even-frame driver `driveRopeExtendAndRenderCells` [code]. That driver bails
while a grab is in progress (GRAB_ACTIVE_FLAG 0x8d32 nonzero) or while WAVE_ARRIVAL_COUNTER
(0x8903) still sits at its hold value of 2; otherwise it runs the extend state machine and then
the active-cell walker, in that order.

The extend machine dispatches on ROPE_EXTEND_STATE (0x8f14) [seen], which has two states. State 0
is `addRopeSegmentAndAdvanceExtendState` [seen]: it stops the moment the rope has grown to two
below the stage's arrival count (ROPE_SEGMENT_COUNT 0x8931 equals WAVE_ARRIVAL_COUNTER minus 2),
so the per-stage arrival counter bounds the rope's length. Otherwise it bumps the segment count
and, while ROPE_EXTEND_INDEX (0x8f18) is below four, advances that index, looks this segment's
video-RAM column low-byte up from ROPE_CELL_COLUMN_TABLE (0x2db8) and stores the full page-0x84
address into ROPE_COLUMN_VRAM_PTR (0x8f19), reloads this segment's cell timer in the
ROPE_CELL_TIMERS bank (0x8f28, one two-byte entry per counted segment) to 0x10, advances the
extend state, and arms the extend sub-timer ROPE_EXTEND_TIMER (0x8f16) to 0x10. (At or above the
four-segment limit the extend only proceeds when a tamper strike is pending, an integrity
side-effect.) State 1 is `advanceRopeExtendAnimation` [seen]: it counts the hold timer down, and
on expiry reloads it to 8 and plays out an eight-frame blit. Each frame it looks up the frame's
tile block from ROPE_TILE_BLOCK_TABLE (0x2dee) and blits it at the rope column, bumping
ROPE_EXTEND_FRAME_INDEX (0x8f1b); when the frame index reaches 8 it resets the index and state
and re-arms the next rope cell (a computed page-0x8f byte keyed on the extend index).

The active-cell walker `driveActiveRopeCells` [code] uses ROPE_EXTEND_INDEX as the count of live
cells and steps through the per-cell state array from ROPE_CELL_STATE_BASE (0x8f1c), handing each
cell to the per-cell dispatcher `dispatchRopeCellState` [seen]. A cell in state 0 is inactive and
skipped; otherwise the cell's state (less one) selects one of four handlers. The four handlers
share two helpers: `tickRopeCellFrameTimer` [seen] decrements the timer selected by the low two
bits of the cell index (stride two from ROPE_CELL_TIMERS) and reports reached-zero, and
`computeRopeCellVramColumn` [code] turns those same two bits into a page-0x84 video-RAM column
base via the column table.

The first cell handler, `spawnHangingRopeObject` [seen], is the rope's payload dropper. It acts
only every fourth frame (low two bits of FRAME_COUNTER 0x8a5f clear) and only once the cell's
timer elapses. It scans the three-slot spawn-object table SPAWN_OBJECT_TABLE (0x8c48) for a free
slot; finding one it reloads the cell timer with a round-scaled value, stores the slot index,
seeds the slot with state 0x07, an animation code, coordinates, and a +4 field pulled from a
fixed table (ROPE_SPAWN_IY4_TABLE 0x2ec7) keyed by the cell index, advances the cell state, blits
the segment tile from ROPE_SEGMENT_TILE_SRC (0x2dfe), and enqueues the segment's display command.
The next two handlers, `advanceHangingRopeObject` [seen] and its grab-checked sibling
`advanceHangingRopeObjectWithGrabCheck` [seen], tick the cell timer and, on the frame it reaches
zero, re-arm the timer cell — `advanceHangingRopeObject` with a round-derived tile value, the
grab-checked sibling with a fixed reload — index into the FORMATION_TABLE (0x8c30) by the byte
after the timer to nudge that record's tile/position/drop fields, bump the cell's own state, and
blit the segment's 2x2 tile square. The grab-checked variant runs the grab trigger
test first; if a grab fires it abandons the cell update entirely (this is what raises
GRAB_ACTIVE_FLAG and suspends the whole rope driver). The fourth handler, `retractRopeSegment`
[code], is the rope's teardown: on the cell timer's expiry, and only while segments remain, it
picks a retract-animation pointer (round shifted right by two, clamped, plus a difficulty term),
reads this segment's attribute and merges it into the timer cell (carrying the paired cell's bits
unless the cell is the terminal column 0x28), clears the count-selected formation record, resets
the cell state, and blits the retract tile.

### The arrow and the launch

The launch machine raises an arrow-like launch object and, when it has risen far enough, spawns
the wolves. It is driven per frame by the launch-and-target pipeline `runLaunchAndTargetActorPipeline`
[seen], which runs three passes in order: the launch state driver, the one-shot target-slot
spawn, and the paired-slot integrity scan. The state driver `dispatchLaunchState` [seen] selects
a handler from the low three bits of LAUNCH_STATE (0x8f30), a five-state machine.

State 0, `armLaunchAndAdvanceToHunterSpawn` [seen], arms and gates the launch. It arms
LAUNCH_ARMED_FLAG (0x8f3f) once — either by bumping the arm latch LAUNCH_ARM_LATCH (0x8f20) when
a lane spawn is still running (LANE_SPAWN_COUNTDOWN 0x8d75 nonzero and the latch still clear), or
otherwise by requiring STAGE_COUNTDOWN (0x8901) to be nonzero and an exact multiple of eight.
It then returns unless the arrow has risen far enough — ARROW_Y (0x8ab4) at or above 0x3c — and
neither hunter-target record (ENEMY_TARGET_REC0 0x8c90 / ENEMY_TARGET_REC1 0x8ca8) carries the
hit bit. Clearing those gates it advances the launch state, reseeds the flip countdown
LAUNCH_FLIP_COUNTDOWN (0x892f), may light the launch HUD cell LAUNCH_HUD_TILE (0x8508) while the
game is idle, refreshes the arm latch from its seed, and blits the launch tile
(LAUNCH_TILE_SRC 0x2d51) at LAUNCH_TILE_VRAM (0x84a7).

State 1, `spawnEnemyTargetOrAnimateLaunchFlipTile` [seen], does one of two things depending on
the arrow's height. While the arrow is at or above 0x34 it runs the flip countdown, and each time
that reaches zero it reseeds it to 0x10, steps the shared phase byte SHARED_PHASE_COUNTDOWN
(0x892e), and blits one of two arrow tiles chosen by that byte's parity — the flapping/flight
animation. Once the arrow has dropped below 0x34 it scans the two enemy-target records for a free
one; finding it, it advances the launch state to 2, marks the record with state 2, queues a sound
command, blits the alternate launch tile, may light the HUD cell, and seeds three record fields
(the middle one a biased copy of a source coordinate). So state 1 both animates the rising launch
object and, at the top of its arc, seeds the target record that becomes the wolf.

State 2, `spawnHunterIntoTableAndAdvanceLaunch` [seen], seats the actual hunter record. Unless
the play-mode latch PLAY_MODE_LATCH (0x8f50) [code] is set, it scans the six-slot hunter table
HUNTER_TABLE_BASE (0x8c78) downward one 0x18 stride at a time for the first free slot (both
leading bytes zero), stamps it with a fixed opening state, coordinates, and tile ids, and records
its address in HUNTER_RECORD_PTR (0x8f32). It advances the launch state, and — when the flip flag
is clear — seeds the spawn countdown HUNTER_SPAWN_COUNTDOWN (0x8f34) to 0x20 and enqueues a
display command; when set it instead bumps a sub-counter. State 3,
`advanceLaunchOnDelayAndClearHunterRecord` [seen], runs that spawn countdown as a hold; on expiry
it advances the launch state and, unless the play-mode latch is set, clears the 0x18-byte record
pointed at by HUNTER_RECORD_PTR. State 4 is an idle bare return (0x28c5), the resting state of
the machine between launches.

The pipeline's second pass, `spawnTargetActorOnLaunchTrigger` [seen], is the one-shot that turns
a fire trigger into a player-launched target actor. It samples and clears the trigger bit (bit 4
of ACTOR_TABLE+7); if it was set and the once-latch TARGET_SPAWN_ARM_LATCH (0x8f02) is clear, it
arms the latch, optionally marks the first target slot special (when launch has reached its
threshold and the second slot reads ready-idle), then scans the two target slots for the first
free one and seeds it: one axis from the source actor minus three, the other plus four, a pair of
timers, an optional buffer clear for a special slot, and two side flags, before tailing into the
actor-animation stepper. This is the point where the player's shot becomes a live target record.

Finally, the aim indicator. PLAYER_AIM_FLAGS (0x8a87) [seen] carries the joystick input in its
low bits and the aim indicator in bits 2 (above / on-target) and 3 (below). It is maintained by
`acquireTargetLockAndSetAimIndicator` [seen], which runs only while the game is not in active
play (GAME_ACTIVE_FLAG 0x8806 zero) and not grabbing. During a wave teardown
(WAVE_TEARDOWN_STATE 0x8f24 nonzero) it simply drops the indicator. Otherwise it steps the
indicator stepper, bails on a proximity hit, and then resolves the direction: launch state 1
forces "above"; an existing lock (TARGET_LOCK+1 nonzero) is re-evaluated and dropped if the
locked block reactivated or left the y-band; and with no lock it scans six enemy blocks
(ENEMY_ACTOR_TABLE, stride 0x18) against the player y-reference for the closest target inside the
0x40..0xc0 y-band, records the five-byte lock at TARGET_LOCK (0x8f40) — closest-distance byte, the
y-slot pointer, and the enemy-block pointer — and sets the above/below bit from the target-vs-player
comparison. The stepper `driveAimIndicatorHitTimerElseRescan` [seen] branches on
AIM_INDICATOR_MODE (0x8d52): mode 0 runs the proximity redraw; mode 1 lights "above" and any
higher mode "below" (each clearing the other), then drains AIM_INDICATOR_TIMER (0x8d53) and
clears the mode when it hits zero. The redraw itself, `clearAimIndicatorUnlessProximityHit`
[seen], scans three projectile records against the fixed sprite record; the moment one scores a
proximity hit the scan aborts, and only if all three come back clean does it clear the above/below
aim bits and zero PROXIMITY_HIT_FLAG (0x8d54).

## Rendering, HUD and display lists

Pooyan draws onto two parallel video-RAM planes that sit exactly 0x400 apart. The colour/attribute
plane lives on the 0x80 page (its map base is ATTRIB_MAP_BASE, 0x8040) and the tile-code plane on the
0x84 page; the same on-screen cell therefore has a tile byte at 0x84xx and a colour byte 0x400 lower at
0x80xx. Both planes are a flat 0x20-wide (32-column) grid, so every vertical step is a `-0x20`/`+0x20`
addend and every routine that walks a column does so one row-stride at a time. On top of the tile grid
the hardware reads a 24-entry sprite display list based at SPRITE_DISPLAY_LIST (0x8840). Three software
mechanisms feed these planes: a bank of leaf blitters that stamp fixed-size tile blocks, a small
display-command ring that other subsystems post refresh requests into, and a stream interpreter that
paints the attract/board layout out of ROM. The whole render layer is stateless between frames except
for a handful of cursor and phase cells; each frame the state handlers repaint what changed.

### Clearing and filling the tile plane

The workhorse for any run-fill is 0x0010 [code], a byte memset that writes a constant across a run and
hands back the pointer advanced past it (a zero length means a full 256 bytes, matching the hardware's
decrement-and-loop). Almost every clear delegates to it.

A fresh screen is filled row by row rather than in one sweep, spread across frames so the fill never
stalls the game loop. seedTileFillCursor (0x02e6) [seen] arms the fill: it stores the caller's tile-plane
pointer into the 16-bit write cursor TILE_FILL_PTR (0x880b) and seeds FILL_ROW_COUNTER (0x8809) to 0x20
(32 rows). 0x02e3 [code] is the fixed-start variant, arming the same fill from the constant playfield
base. Each frame 0x02ce [code] blanks one row's worth of cells (a caller-supplied width) from the cursor
to the blank tile 0x10, then advances the cursor by exactly one full row (it adds `0x20 - width` after
the fill so partial-width rows still land on the next row), stores the cursor back, and decrements the
row counter, reporting through its zero flag whether the fill has drained. State handlers loop on that
flag until all 32 rows are blank.

The heavier board re-init is reinitRoundArenaAndPlayfieldIfImageIntact (0x67df) [seen], and it only fires
behind a colour-map integrity gate: it sums ten colour-plane cells one row apart (walking upward from
HUD_INTEGRITY_STRIP_A, 0x82bc) and requires the 8-bit total to equal 0x5a; any other sum means the image
is corrupt and it diverts to the per-object frame updater instead of re-initialising. On a clean sum it
raises ROUND_IN_PROGRESS, seeds the phase timer and play sub-state to 1, clears the per-frame timer
block, zeroes the whole 0x241-byte actor/object arena, and paints the playfield as a 0x1d-by-0x1d square
of the blank tile (0x10) one row per pass out of PLAYFIELD_PAINT_START (0x8442). The plain arena wipes
are clearActorArena (0x19bc) [seen], which zeroes 0x200 bytes from ACTOR_TABLE at board init, and
clearActorArenaAndCounters (0x2ae8) [code], the teardown variant that additionally clears the
spawn/wave/rope counters and forces the play sub-state to 6. Board start also calls 0x02b9 [code], which
zeroes the two RAM regions a fresh game depends on — the sprite display list and the actor arena — in
two run-fills. A single column can be erased on its own with blankTileColumn (0x02b1) [seen], which writes
the blank tile 0x10 into three cells a row-stride apart and returns the advanced pointer so successive
columns chain. Text is laid into the tile plane by copyBiasedTileString (0x1b80) [seen], which copies a
ROM string byte-for-byte into a tile buffer, adding a fixed 0x08 tile bias to reindex character codes
into display-tile codes, and stopping at the 0xa0 terminator (which is not copied).

### Painting the colour/attribute plane

The colour plane is flooded column by column by fillAttributeColumns (0x075d) [seen]. It walks 31 columns
from ATTRIB_MAP_BASE (0x8040): each column takes one source byte and stamps it down all 30 rows at the
0x20 stride, so a single attribute byte colours an entire vertical strip, and the source pointer steps
one byte per column. The observed attribute codes flooded here in play are 0x10/0x1d/0x0d. The attract
build reaches this flood through paintAttractColorsAndQueueDraws (0x092c) [seen], attract sub-state 2:
it first spends frames draining the row-by-row tile clear, and only once that is done does it re-arm the
fill, advance the attract sub-state, zero the board-init RAM, run its copy-protection stalls and a
seven-byte program-signature check (a mismatch corrupts into a data table, modelled as a throw), then
flood the attribute map from its fixed source and post three display commands into the ring. Several
sibling play-state handlers do the same attribute flood plus two-command post as part of their per-tick
work.

### The two-plane column blitter

A single primitive, 0x0cf8 [code], stamps a whole column strip into both planes from a compact
steering-coded source. It walks a table of 0x0c-byte (12-tall) columns, writing each column bottom-up at
the 0x20 row stride into the tile plane starting at COLUMN_BLIT_TILE_DEST (0x86a7) from
COLUMN_BLIT_TILE_SRC (0x0d2f). After each column it reads a steering byte: 0xff switches both the source
and the destination over to the attribute plane — reading from COLUMN_BLIT_ATTR_SRC (0x0d48) and writing
to COLUMN_BLIT_ATTR_DEST (0x82a7), which is precisely 0x400 below the tile destination — 0xee ends the
stamp, and any other value is taken as the first byte of the next column, one cell to the right. The two
destinations differing by exactly 0x400 is the two-plane structure made explicit: the same on-screen
column is filled with tile codes on the 0x84 page and colour codes on the 0x80 page in one pass.

### The scrolling columns

The animated tile strip that scrolls across the play area is driven by a cursor pair. TILE_ANIM_CURSOR
(0x88be) [seen] is a 16-bit pointer into the tile plane (its high byte is fixed at 0x84, its low byte
oscillating around 0xe6-0xf0), and TILE_ANIM_PARITY (0x8f37) [seen] is a per-frame parity tick that
selects which of two twin steppers acts. On odd frames advanceTileAnimForwardOnOdd (0x2405) [seen] runs:
if the tile under the cursor has reached the wrap code 0x37 it steps the cursor forward one cell and
reseeds that cell to 0x34, otherwise it bumps the current cell's tile code up by one — so the strip both
cycles a cell's appearance and marches forward. On even frames retreatTileAnimScript (0x23ec) [seen] runs
the mirror image: a 0x34 marker at the cursor reloads the base tile 0x10 and backs the pointer up one
cell, any other value is decremented in place. The two together make the strip crawl one way and unwind
the other. The second scroll column is stamped by stampSecondScrollColumn (0x1d0d) [seen], which seeds
the top cell of WORKER_COLUMN_VRAM (0x8740) with tile 0x01 and stamps the two body tiles 0x25 then 0x20
one row up each; the column-body helpers paintColumnBodyTiles (0x02aa) [seen] and paintColumnBodyTilesUp
(0x1cec) [seen] stamp the same mid/base pair (0x25 then 0x20) downward or upward from a caller cell, and
0x02a8 [code] prepends the cap tile 0x01 to make a full three-tile column.

The rope is a scrolling column of its own. driveRopeExtendAndRenderCells (0x2d66) [code] is the even-frame
rope driver: it bails while a grab is in progress or while the wave-arrival counter still holds its
suppression value, then runs the rope tile driver and the rope cell writer in order. The video column a
rope cell lands in is computed by computeRopeCellVramColumn (0x2e52) [code]: the low two bits of the
record index a small ROM table of column low-bytes, and that byte becomes the low half of a 0x84-page
tile-plane pointer, returned for the rope-cell handlers to draw through.

### The block-stamp primitives

A family of small leaf blitters stamps fixed rectangles of tiles; every larger draw is composed from
them. blit2x2TileBlock (0x3325) [seen] copies four source bytes into a 2x2 square (top-left, top-right,
bottom-right, bottom-left) at the 0x20 row stride and returns the destination advanced to the bottom-left
cell — the two-tile animators rely on that returned pointer to step up a row between blits.
paintTileBlock2x2 (0x0a40) [seen] and paintTileBlock2x2Above (0x780f) [seen] are the tilemap variants,
one anchored at the top-left and one anchored at the bottom-left with its top row a row above; both are
pure leaves. blitTile3x3Block (0x3307) [seen] stamps a 3-wide, 3-tall block, writing three cells then
stepping down a screen row (three writes plus 0x1d = a full 0x20), and returns both the advanced
destination and the advanced source, because chained glyph draws read straight on from the advanced
source. blitGlyphBlock4x3 (0x1f8c) [seen] stamps a 4-row, 3-column glyph the same way, advancing the
destination low byte within its page per cell and stepping +0x1d per row; it too returns both advanced
pointers, and its callers memset through the returned destination to blank trailing tiles. The shared
render tail wrapRenderPhaseAndPaintTileTriplet (0x23ad) [seen] shows the primitives in composition: it
masks a phase counter to 0..3, looks up a tile-block descriptor word for that phase, and stamps three
2x2 blocks two video rows apart (0x40 stride) into video RAM from STATUS_RENDER_VRAM_BASE (0x8425), with
the third block's source alternating between two field tiles on the phase's low bit.

### The sprite display list

The 24-entry sprite display list at SPRITE_DISPLAY_LIST (0x8840) is a stride-4 array; byte +0 is a Y
coordinate, +1 an attribute byte carrying two flip bits in its top nibble, +2 an X coordinate, and +3 a
tile/plumbing byte. Inside it, SPRITE_ACTOR_RECORD_SLOTS (0x8848) [seen] and SPRITE_TARGET_SLOTS (0x887c)
[seen] are the stride-4 actor and collision-target sub-arrays the collision drivers sweep. The player is
drawn as three vertically stacked sprites, and deriveStackedSpriteYs (0x23d7) [seen] fans the player's
base Y (PLAYER_Y, 0x8a84) out to the Y fields of stacked slots 3/2/1: slot 3 gets the base Y, slot 2
gets Y-0x10, and slot 1 sits 0x0a below slot 2's top. When the screen is mirrored,
mirrorSpriteListVertically (0x0378) [code] rewrites all 24 entries in place — negating and offsetting each
coordinate byte (`-x - 0x10`) and toggling the two flip bits in the attribute byte while preserving its
low nibble — gated by the flip-screen flag. An actor whose sprites should vanish is cleared by
blankActorSpriteBand (0x3553) [seen], a 0x17-byte zero-fill over the record. The sprite attribute/position
bytes are refreshed in bulk by 0x0714 [code], which per pass reads four source bytes and lays two into
the attribute area (at attr+1 then attr+0) and two at the position cursor, advancing both cursors, so
attributes and coordinates are streamed together.

### The display-command ring

Rather than repaint directly, several subsystems post two-byte display commands into a small ring on the
0x88 page and let the display driver consume them. 0x0038 [code] is the enqueue: it reads the low-byte
write pointer DISPLAY_CMD_RING_WRITE_PTR (0x88a0), and if the pointed slot is free (its bit 7 set) it
stores the command's high byte there and its low byte in the next slot, advances the write pointer by
two, and wraps it back up to the ring start 0xc0 when it falls below it; an occupied slot simply drops
the command. Per-frame HUD upkeep enters here through tickHudRefresh (0x1583) [code], which bumps
HUD_REFRESH_TICK and, on every 16-frame boundary, enqueues a display-refresh command (argument 0xb5 or
0x35 depending on bit 4 of the counter), then falls through into the gameplay dispatcher only while the
tamper-strike counter is nonzero. The attract build posts its layout draws the same way — three commands
from paintAttractColorsAndQueueDraws and two from each sibling play-state handler. A credit-display
refresh enters the same enqueue: queueCreditDisplayRefresh (0x5a97) [code] hands the fixed command word
CREDIT_DISPLAY_COMMAND (0x0701) [code] to 0x0038 through DE. A related buffer is
the display message buffer: clearDisplayMsgBufOnRoundInitMatch (0x1694) [seen] compares a terminated ROM
pattern against DISPLAY_MSG_BUF and, on a full match, clears the seven-cell buffer, otherwise tail-branches
into the round display-list state handler and reuses the frame.

### The display-list interpreter

The attract screen and the between-round layouts are painted by a stream interpreter,
paintDisplayListRunToVram (0x4381) [seen]. It chooses a destination/source pointer pair, walks up to 0x1d
source bytes, and for each: a plain byte is copied to the destination and both pointers advance; a 0x10
skip opcode advances the destination by the following byte and shrinks the remaining count; a 0xff reload
opcode loads a fresh 16-bit destination from the stream and folds the next byte into the sub-phase tick.
On exit the advanced pointers are written back. There are two pointer pairs, and the selector is
FORMATION_SLOT_TABLE (0x8920) [seen] — worth flagging as counterintuitive: nonzero there does *not* mean
a formation is active in this path, it simply routes the interpreter to the *alternate* pair
DISPLAY_LIST_DST_PTR_ALT (0x88b8) / DISPLAY_LIST_SRC_PTR_ALT (0x88ba) [both seen] instead of the primary
DISPLAY_LIST_DST_PTR (0x8f43) / DISPLAY_LIST_SRC_PTR (0x8f45) [both seen]. The two pairs address the two
planes: the primary destination is seeded to a colour-plane cell and the alternate to the tile-plane
playfield start. A second overlap to keep in mind: the primary destination pointer at 0x8f43 shares
bytes with TARGET_LOCK+3/+4 (the lock structure based at 0x8f40) — the same two RAM bytes are the
display-list destination during the attract build and the locked enemy-block pointer during play,
multiplexed by game phase.

The interpreter is scheduled by a three-way self-test/attract dispatcher, 0x7442 [code], which masks
SELFTEST_DISPATCH_STATE (0x8921) [seen] to its low two bits and jumps to state 0 (init/ROM check), state 1
(display + HUD-checksum), or state 2 (gameplay). State 0 is seedDisplayListPointersAndVerifyRomSignature
(0x744e) [seen]: it clears the sub-phase tick SUBPHASE_TICK (0x88b7) [seen], seeds all four display-list
pointer bytes from the attract seed constants ATTRACT_LIST_SRC_ALT_SEED (0x43e1), ATTRACT_LIST_SRC_SEED
(0x4af0), ATTRACT_LIST_DST_SEED (0x8042) [all seen] plus the tile-plane playfield start, advances the
dispatch selector, and then runs a two-stage program-signature check (eight boot bytes against their
reference copy, then a 0x74-byte program window against its copy); a divergence in the second stage aborts
into the screen re-init handler. State 1 is runDisplayListAndAdvanceToGameplay (0x7517) [seen]: it runs the
interpreter once, then increments SUBPHASE_TICK and returns until it reaches its 0x1c period; on that tick
it steps a one-shot sub-phase (byte 0 of FORMATION_SLOT_TABLE) and returns on the first pass. Otherwise it
column-sums two fixed video strips as a HUD integrity check — walking 14 tiles upward from
HUD_INTEGRITY_STRIP_A (0x82bc) [code] in the colour plane and HUD_INTEGRITY_STRIP_B (0x86bc) [code] in the
tile plane (the same column in both planes) — and requires the 16-bit total to be exactly 0x014f; any other
total is a hard integrity trap. On a clean sum it advances the dispatch selector to state 2 and queues two
sound commands. Note that SUBPHASE_TICK does double duty: the interpreter folds reload-opcode bytes into
it, and this state handler uses it as the mod-0x1c cadence counter.

### BCD and the HUD number primitives

Numbers are stored as packed BCD and drawn as tiles whose codes are the digit values 0..9 (with 0x10 as
the blank tile). Two converters turn binary into packed BCD: binToPackedBcd (0x1131) [code] counts up in
BCD `count` times, leaving the low two digits packed in one byte and the hundreds in a second (a zero
count means a full 256 passes, giving 0x56 with hundreds 2), and byteToPackedBcd (0x062a) [code] converts
a single byte to its value-mod-100 packed form by reproducing the Z80's decimal-adjust exactly. Three
painters emit the digits. splitBcdByte (0x0429) [seen] splits one packed byte, writing the low nibble as
a tile at the cursor, advancing the cursor by a caller stride, and handing back the high nibble (with a
zero flag when it is zero, the leading-zero signal). renderDigitWithBlanking (0x059d) [seen] paints one
digit with leading-zero suppression: a nonzero digit stores as-is and ends the blank run, a zero digit
stores the blank tile 0x10 while a blank budget remains (decrementing it) or a real 0 once the budget is
spent; it threads the advanced cursor and remaining budget so a whole field of digits blanks its leading
zeros consistently. drawStackedBcdDigits (0x1119) [code] draws a packed byte as two stacked tiles — tens
at the cursor, units one tilemap row up (toward lower addresses) — with a zero tens digit drawn blank.
0x10c2 [code] is a compound HUD updater built on these: it walks a counter toward a new value one step at
a time (direction from the entry carry), stores it, and repaints three stacked-BCD fields — field 1 as
double the counter, field 2 directly when a single digit else re-encoded, and field 3 (when its source is
nonzero) folded into the counter and drawn with its hundreds mirrored out — then advances the main-loop
sub-state and queues a sound cue.

### Scores, the high-score table, and the panels

Each player keeps a 3-byte little-endian packed-BCD score. selectActivePlayerScoreBuffer (0x04f2) [code]
picks the active bank from bit 0 of ACTIVE_PLAYER (0x880d): even selects P1's buffer, odd P2's. Scoring
runs through 0x0496 [code], gated on the game-active flag: it picks a 3-byte increment (the per-frame
increment cell for award index 0, otherwise a stride-3 award-table entry), BCD-adds it into the active
player's counter with carry chained from the least-significant byte up, repaints that player's score
column, then compares the counter against the high score most-significant byte first and, if the counter
is strictly greater, copies it over the high score and repaints the high-score column. The score column
painter is 0x056b [code]: a selector (0/1/2) picks a counter and its on-screen column, and each of the
three bytes is split high-then-low digit and painted one cell up the column with leading zeros suppressed
by a shared budget. 0x0552 [code] is the reset-and-repaint twin — it zeroes a selected 3-byte counter and
redraws it (so the field shows blanks then two zeros). The credit count CREDIT_COUNT (0x8802) is drawn by
0x05ee [code]: it paints the credit field, clamps the count to 99, converts to packed BCD, writes the tens
tile (skipped when zero) and units tile, and — only when the units digit is exactly 2 — sums a 31-byte
program block as a hidden checksum tripwire, bumping an anti-tamper strike counter on a miss. The
high-score table's own integrity is guarded by flagHighScoreTableCorruptOnChecksumMiss (0x0644) [code],
which checks the 0xc8 header marker and a four-byte checksum (summed bytes minus carry count must equal
0x59) and raises the table-corrupt flag on any mismatch. When a score qualifies for the table,
advancePlayStateAndStageHighScoreEntryOnTimer (0x1c03) [seen] — the play-state handler that acts only
while the high-score insert rank is nonzero — copies the ROM name-entry source table
HIGH_SCORE_ENTRY_TABLE_SRC (0x1754) [code] into the display-message buffer, rotating each byte left
through carry up to its 0x5a terminator, to stage the entry readout.

The attract screen composes all of this in 0x03e9 [code]: it draws eleven selector-indexed character
fields, then renders the ten-entry high-score table as stacked BCD digit pairs (each source byte split
low-then-high a row apart, the top pair's leading zero suppressed, the column re-based two cells right per
row), and finally repaints the digit panel and the status panel. The digit panel is 0x0439 [code], which
renders ten rows of packed-BCD digits from a source table — two digit pairs per row separated by a fixed
0x51 tile, reading bytes 1 and 2 of every three-byte record and re-basing two cells right each row. The
status panel is renderPanelFromTable (0x0460) [seen]: it walks ten rows of three cells out of
PANEL_TILE_SOURCE (0x8e00), painting each source byte when nonzero and the blank tile 0x40 otherwise, with
the first two cells of a row climbing one row (-0x20) and the third re-basing forward to the next column
(+0x42), landing in the panel at PANEL_VRAM_DEST (0x8567).

### Round, stage label, and countdown readouts

The round number is set up once per round by paintRoundNumberHud (0x1ead) [seen], gated on the tamper
freeze flag being clear: it copies an attribute field bottom-up into the reset attribute column through a
0x10 sentinel, BCD-converts round+1 and paints its two digits (blanking a leading zero), stamps the round
glyph blocks (the tens bit selects which glyph word via a word-table lookup, then a 3x3 block and a 4x3
glyph block are stamped), stashes the low digit, and renders a selector glyph. Both entry paths then run
the per-frame update chain: refreshRoundStageHud then renderStageCountdownDigits. refreshRoundStageHud
(0x1f18) [seen] holds off while any of the seven integrity-flag slots is armed; otherwise it derives the
stage countdown's tens digit by repeated subtraction, and only on the first stage (tens zero) draws the
BCD round number (choosing one of two glyph banks by a tens bit), blanks three trailing tiles, and mirrors
the countdown into its HUD digit; either way it then draws the fixed stage label from a pointer table.
drawStageLabelOncePerLevel (0x1f2f) [seen] is the once-per-level variant: it is a one-shot latched by
LEVEL_TAG_DONE_LATCH, treats a stage below ten as label column zero (arming the latch), matches a higher
stage against a five-entry column table (returning without drawing on a miss), and on column zero draws
the round number and mirrors the countdown before drawing the label. The countdown itself is drawn by
renderStageCountdownDigits (0x34c9) [seen]: it reads STAGE_COUNTDOWN, writes its units nibble to the low
HUD tile and (unless zero) its tens nibble one row over; a value of ten or more is converted to packed BCD
first, and that two-digit path is gated off while the play-mode latch is held. The between-round intro
uses 0x6f42 [code] to advance the intro phase and draw the target-hit tally as two stacked digit pairs.

The phase gauge is a five-cell vertical bar. renderPhaseGauge (0x03c2) and paintPhaseGauge (0x2065) [both
seen] are byte-identical routines (two separate copies of the same code at different addresses): each reads GAUGE_PHASE_COUNTER
(0x8908) — a phase counter drained per phase from 3 down to 0 — and, for a nonzero count, draws
`count - 1` cells (clamped to five) with the filled tile 0xb0 upward from PHASE_GAUGE_BASE_TILE (0x863f)
at the -0x20 stride and blanks the remaining cells above with tile 0x10; a zero count leaves the gauge
untouched.

### The status-render ring

The player-status animation is timed by a two-level counter pair and shares one render tail. The ring
counter STATUS_RENDER_RING (0x88bd) [seen] runs mod 8 and the phase counter STATUS_RENDER_PHASE (0x88bc)
[seen] mod 4; the render only fires when the ring wraps, at which point the phase advances and the shared
tail repaints. tickStatusRenderRingAndRedrawOnWrap (0x23a1) [seen] is the decrementing entry: it steps the
ring down mod 8, holds (returns) while it stays nonzero, and on a wrap borrows one from the phase and
falls into the render tail. The render tail is wrapRenderPhaseAndPaintTileTriplet (0x23ad) [seen], already
described above — it masks the phase mod 4, looks up the phase's tile descriptor from
STATUS_RENDER_TILE_TABLE (0x26f6), and stamps three 2x2 blocks 0x40 apart from STATUS_RENDER_VRAM_BASE
(0x8425), the third alternating source on the phase's low bit.

Two direction-split player drivers advance the same ring while moving the actor and refreshing its stacked
sprite Ys. movePlayerVerticallyAndTickStatusRender (0x2329) [seen] reads bit 2 of the actor's aim byte:
clear steps the actor down (handing off to the descent handler), set steps it up — decrementing the actor
Y, clamping it to the low bound 0x41, refreshing the stacked sprite Ys, then advancing the ring *upward*
(via the retreat tile-anim stepper) unless the tile-anim cursor sits at its 0xe6 sentinel over a low tile
while every integrity flag is clear (in which case there is no work and the counter holds); a ring wrap
carries into the phase and paints. movePlayerDownAndTickStatusRender (0x236a) [seen] is the descent half,
active only while aim bit 3 is set: it increments the actor Y, clamps at the floor 0xc0, refreshes the
sprite Ys, and — once the tile-anim cursor reaches its 0xf6 end marker — runs the render tail only while a
tamper strike is recorded or a colour-parity sum is nonzero, otherwise freezing the display. The tamper
handler tail clampActorYAndAdvanceRenderPhase (0x2334) [seen] does the same shape: it floors the actor
base-Y at 0x41, refreshes the sprite Ys, then looks for pending work (the tile-anim cursor off its
sentinel, its target tile at/above 0x35, or any of the seven integrity flags set) and on work retreats the
tile-anim script, steps the ring mod 8, and paints on the wrap.

The two-tile and blink animators round out the render layer. blitStackedTwoTileAnimFrameOnHoldTimer
(0x6b13) [seen] runs a hold countdown in TWOTILE_ANIM_HOLD (0x8f06): while nonzero it counts down and
returns, and on expiry it reloads the hold to 0x0c, advances TWOTILE_ANIM_PHASE (0x8f07), selects one of
two adjacent 4-byte source patterns by the phase's low bit from TWOTILE_SRC_TABLE (0x2744), and stamps it
as a 2x2 block at the screen anchor BLIT_SCREEN_ANCHOR (0x84b4) and again two rows higher.
blitTwoTileAnimFrameOnHoldTimer (0x2563) [seen] is the play-mode-gated sibling: idle while the play-mode
latch is busy, it runs the same hold countdown but selects one of four source blocks and one of two video
anchors from the round parity and the phase parity together, again stamping two stacked squares. The
blink animator blinkTilePairOnCountdown (0x76af) [seen] drains BLINK_COUNTDOWN (0x892a), and on expiry
reloads it to 0x16, toggles BLINK_PHASE (0x892b), and by phase parity writes one of two 2-byte tile pairs
from BLINK_TILE_PAIRS (0x76e6) into two cells a 0x40 stride apart at BLINK_TILE_CELL_0 (0x8471), swapping
the blinking tiles. BLINK_PHASE (0x892b) [code] is multiplexed — the blink path toggles it in step with
the tile swap, while the object-animation path treats it as a countdown: cycleActorGroupSpriteFramesOnTimer
(0x66a1) [code] counts it down, and on zero reloads it to 0x08, advances a separate select phase, picks a
3-tile source table by that phase's bit 0, and copies those tiles into three actor records through
copyDisplayTilesIntoActorRecords (0x2514) [seen], which lays one source byte into each record's tile field
and, when the run is done, diverts to the board/HUD reset if the terminator strike counter or the
board-clear flag is set.

The aim indicator is a small render/state machine driven while the game is *not* in active play.
acquireTargetLockAndSetAimIndicator (0x6cab) [seen] runs only when both GAME_ACTIVE_FLAG and
GRAB_ACTIVE_FLAG are clear; during a wave teardown it just clears the player aim flags. Otherwise it steps
the indicator, bails on a proximity hit, then resolves the above/below indicator bit — a launch state of 1
forces "above"; an existing lock (TARGET_LOCK+1 nonzero) is re-evaluated (dropped if its block reactivated
or the target left the y-band 0x40..0xc0, else the aim delta recomputed on an 8-frame cadence); otherwise
it scans six enemy blocks for the closest in-band target, records the 5-byte lock at TARGET_LOCK (0x8f40),
and sets the bit from the target-versus-player comparison. The stepper it calls is
driveAimIndicatorHitTimerElseRescan (0x6bee) [seen], selected by AIM_INDICATOR_MODE (0x8d52): mode 0 runs
the proximity redraw pass, mode 1 lights the "above" bit (bit 2) and any higher mode the "below" bit (bit
3) of PLAYER_AIM_FLAGS (0x8a87) — each clearing the other — then drains AIM_INDICATOR_TIMER (0x8d53) and,
at zero, clears the mode to end the sequence. The redraw pass is clearAimIndicatorUnlessProximityHit
(0x6c18) [seen]: it scans three projectile records against the fixed sprite record (advancing the target
slot by 4 and the projectile-gate record by 0x18 each pass), aborting the whole scan on the first hit, and
only if all three come back clean does it clear both aim bits and zero PROXIMITY_HIT_FLAG (0x8d54).

## Sound

Pooyan's sound hardware is a second Z80 (the shared Konami timeplt audio board) that the main
CPU talks to through exactly one byte: a command latch. The main program never generates a
waveform. It decides *what* should be heard, encodes that as a small command byte, and hands the
byte across. Everything on the main-CPU side is therefore about choosing command bytes, buffering
them, and pacing them out one per video frame; everything about turning a command into an actual
tune lives on the audio CPU, which this port does not run at all (see the record/replay model at
the end).

### Handing a byte to the audio CPU

The single act of communication is `sendSoundCommand` (0x0e8f) [seen]. It writes the command byte
into `SOUND_COMMAND_LATCH` (0xa100) [seen], then pulses `AUDIO_IRQ_LATCH` (0xa181) [seen] high and
immediately back low. That rising edge is the interrupt that tells the audio CPU "a fresh byte is
waiting in the latch — come read it." The pulse itself carries no data; its width is just the few
cycles the hardware needs to register an edge, so the on/off pair is the whole story.

The command byte, however, is *held*. Nothing clears the latch after the strobe — the value sits
at 0xa100 until the next command overwrites it. Because the byte is only ever replaced once per
video frame (the drain step below runs a single command per vblank), each command occupies the
latch for at least one full frame, which is what gives the audio CPU a stable value to read after
its interrupt fires. `emitPresetSound` (0x0f09) [code] is the thinnest possible caller of this
path: it hands over one fixed byte (0x0b) and nothing else, and it is the mechanism the coin ticks
use to reach the audio CPU *directly*, bypassing the buffering the rest of the game relies on.

### The command ring

Almost every game sound is not sent immediately. It is deposited into a small circular buffer, the
sound-command ring at `SOUND_RING_BUFFER` (0x8a43), which occupies the slots 0x8a43 through 0x8a5e
and is filled with 0xff (the empty marker) at boot. Two one-byte cursors index it: a producer
cursor `SOUND_RING_WRITE_PTR` (0x8a40) [code] where the next command is stored, and a consumer
cursor `SOUND_RING_READ_PTR` (0x8a41) [code] from which the next command is taken. Each cursor
holds a low-byte index in the range 0x43..0x5e and wraps from the last slot back to the first, so
the two chase each other around the ring.

Producers reach the ring by two closely related helpers. `enqueueSoundCommandRing` (0x0eb3) [seen]
is the unconditional path: it drops the byte into the slot the write cursor names and advances the
cursor, wrapping 0x5e back to 0x43. `appendSoundCommandGated` (0x0ea2) [code] is the guarded path:
it first stashes the incoming byte in `SOUND_RING_PENDING_BYTE` (0x8d20), then performs the store
and advance *only* while a game is active (`GAME_ACTIVE_FLAG`, 0x8806 [seen]) or the play-mode
latch (`PLAY_MODE_LATCH`, 0x8f50 [code]) is set — when both are clear the sound is simply dropped.
That gate is why gameplay effects fall silent in the idle/attract state while credit ticks (which
use the direct path) still sound. Longer sound events are built from a "run": `appendSoundCommandRun`
(0x0fc3) [code] appends a caller-chosen lead byte and then the three fixed bytes 0x15, 0x16, 0x17
that terminate the run, four appends in a row.

Draining is the reverse, and it happens exactly once per frame. The per-frame vblank interrupt
(0x066d) calls `drainSoundCommandRing` (0x0e64) [seen], which reads the slot at the read cursor and
returns immediately if it is empty (0xff). If a byte is waiting, it is dispatched to the audio CPU
through `sendSoundCommand` — but only when demo sounds are enabled (bit 0 of `DEMO_SOUNDS_DSW`,
0x8821 [code]) or a game is active; when both are false the byte is consumed silently. Either way
the slot is then freed back to 0xff and the read cursor advances (0x5e wrapping to 0x43). So the
ring smooths a burst of commands queued in one frame into a steady one-command-per-frame stream to
the latch, which dovetails with the one-frame hold described above.

### The command set the game emits

The game reaches the ring through a broad family of tiny selector routines, one per command byte,
that exist only to load a constant and append it. The plain single-byte selectors span the low
range — `queueSoundCommand00` (0x0ecf) [code] through `queueSoundCommand0F` (0x0f1d) [code] queue
bytes 0x00..0x0f — some via the unconditional enqueue, some via the gated append. Above them sit
composite and run-emitting selectors that queue several bytes at once: `queueSoundCommands82And03`,
`queueSoundCommands95And10`, `queueSoundCommands95And03And11`, `queueSoundCommand12`..`14`,
`queueSoundCommands82And95`, `queueSoundRun26` (0x0fad) [code], `queueSoundCommands27And15`,
`queueSoundRun28`, and `queueFixedSoundCommandRun` (0x0fc1) [code] which lays down the four-byte run
0x29,0x15,0x16,0x17. Bytes with bit 7 set (0x82, 0x95, 0x96, 0x97) appear as leading/prefix bytes
ahead of a run; the main CPU only shuffles them, and their exact effect is the audio CPU's to
decide.

Several selectors pick their command byte from game state rather than a constant. `queueRoundSoundCommandRun`
(0x0f97) [code], `queueRoundVariantSoundRun` (0x0fa2) [code], and `queueSirenSoundRun` (0x0f76)
[code] all fold bits of `ROUND_COUNTER` (0x8907) [seen] into a small selector so the sound varies
by round: `queueRoundSoundCommandRun` builds a run whose lead byte is 0x1e + ((round >> 1) & 3),
`queueRoundVariantSoundRun` builds one at 0x22 + that same selector, and the siren run offsets its
base tile 0x1a by the round's low bit. Others are conditional: `queueSoundCommand04IfNotBusy`
(0x0ee3) [code] appends byte 0x04 only when neither the wave-teardown state (`WAVE_TEARDOWN_STATE`,
0x8f24 [seen]) nor the grab-active flag (`GRAB_ACTIVE_FLAG`, 0x8d32 [seen]) is set, so an effect is
suppressed while the board is busy tearing a wave down or a rescue is in progress. The two most
gameplay-visible bytes are 0x05 (the target-hit effect, below) and 0x0b (the coin/credit tick).

### The drip driver — coin and credit ticks

Coin acceptance runs through `serviceCoinCreditAndCountersUnlessFreePlay` (0x59e8) [code], which
bails at once if either coinage nibble — `COINAGE_CONFIG` (0x882c) [seen] for slot 1 or
`COINAGE_CONFIG_SLOT2` (0x882f) [code] for slot 2 — reads the free-play value 0x0f, and otherwise
runs three per-frame credit-accrual steps (plus the physical coin-counter strobes) before tailing
into the credit/attract display update.

Each of the three steps is a debounced edge detector built out of a one-byte shift ring. Every
frame it rotates one bit sampled from `INPUT_PORT0` (0x8810) [seen] into the ring — step A (0x5a06)
[code] samples input bit 2 into `DRIP_RING_A` (0x8829) [code], the slot-2 step `accrueCreditsFromCoinSlot2`
(0x5a1f) [code] samples bit 1 into `DRIP_RING_B` (0x882d) [code], and the slot-1 step
`accrueCreditFromCoin1Pulse` (0x5a56) [seen] samples bit 0 into `DRIP_RING_C` (0x882a) [code]. A
step "fires" only when the ring's low three bits settle on the pattern 1 — that is, one high sample
preceded by two lows, a clean debounced press rather than a hold. On that fire the step emits the
audible tick by calling `emitPresetSound`, which sends command 0x0b straight to the latch (this is
the one game sound that never touches the ring). It then bumps the matching pulse count
(`COIN1_PULSE_COUNT`, 0x8824 [seen] / `COIN2_PULSE_COUNT`, 0x8826 [code], later drained into the
mechanical coin-counter strobes) and does the coinage arithmetic: it advances a coordinate by 0x10,
compares it against the coinage nibble, and once the nibble tops out it funnels an amount into the
shared accumulate tail.

That tail is `addCreditsAndQueueDisplay` (0x5a8c) [seen]. It adds the incoming amount to the credit
counter `CREDIT_COUNT` (0x8802) [seen], clamps the stored value at 0x63 (the counter's BCD ceiling),
and queues the credit-HUD refresh so the on-screen digits track the new total. The full-wrap case
enters through `addFullWrapCreditAmount` (which seeds the amount 0x63) and the partial case passes
the coinage low nibble; step A instead adds a fixed 1 per fire. So each accepted coin pulse produces
one 0x0b tick and, once enough pulses have accrued per the coinage setting, one credit added and one
HUD update. (The precise pairing of physical coin slots to rings A/B/C carries mostly [code]
confidence; the tick and credit behaviour is the observed part.)

### The fire and hit driver

When a shot connects with a target the game plays command 0x05. The proximity scan 0x5f11 [code]
walks the target-slot records; for each live slot (state neither empty 0 nor already-struck 3) it
measures the horizontal and vertical gap between the shot and the target centre, and on a hit
(dx < 7, dy < 6) it marks the slot struck, sets the parity-selected cell of the collision-flash
pair `FLASH_CELL_BASE` (0x8d19) [code], and hands off to 0x5f02 [code], which passes straight
through to `queueSoundCommand05` (0x0ef1) [code] — byte 0x05 into the ring.

The same 0x05 byte is the hit sound down the enemy-record path. `dispatchHitToEnemyRecordElseQueueSound`
(0x611f) [code] hunts the six enemy actor records for one whose tag matches the struck key; on a
match the record's own handler takes over the frame, but on *no* match it queues command 0x05 —
unless the active object type `ACTIVE_OBJECT_TYPE` (0x8d44) [seen] already reads 3, in which case it
stays quiet. `resetActorRecordQueueSoundAndAbortFrame` (0x6166) [code] shows the one variation: when
it resets a struck actor to its idle state it chooses the sound by object type, queuing the usual
0x05 for ordinary objects but command 0x08 when the type is 3. So the fire/hit feedback is a single
effect (0x05) for the common case, with 0x08 reserved for the one special object class.

### The siren driver

The warning siren is the alternating alarm heard while the eagle wave is building, and it is driven
by two cooperating routines that only run when no game is active. 0x19ca [code] is the tick: it
returns unless `GAME_ACTIVE_FLAG` is clear and the siren is enabled via `SIREN_ENABLE_GATE`
(0x8d68) [code], then counts `SIREN_FRAME_COUNTDOWN` (0x8d6a) [code] down each frame; on expiry it
reloads the countdown to 0x18 and toggles `SIREN_PHASE_BYTE` (0x8d69) [code]. The two phases queue
the two halves of the alternating warble — one phase resets the byte to 0 and queues
`SIREN_DISPLAY_CMD_B` (0x068f) [code], the other sets it to 1 and queues `SIREN_DISPLAY_CMD_A`
(0x060f) [code]. So the siren is a slow square wave in software, flipping between two commands every
0x18 frames for as long as the gate stays open.

The arming and the periodic wave-alarm sit in 0x196e [seen], the gated periodic driver. It idles
while `PERIODIC_MODE_LATCH` (0x8d55) [code] is nonzero. It then reads the spawn-phase value
`SPAWN_PHASE_COUNTER` (0x8902) [seen] as a mode: at exactly 5 it arms a pair of gate cells (the
siren-enable gate when no grab is active) and fires the mode-5 run `queueSoundCommands96And97And18And15`;
above 5 it latches the mode and, if no grab is active, fires `queueSoundCommands19And15`. After the
mode branch it runs a shared event countdown: unless `WAVE_EVENT_LATCH` (0x8d21) [seen] or the
wave-teardown state is set, it ticks `PERIODIC_EVENT_TIMER` (0x8d22) [seen] down, and on expiry
reloads it to 0x20, raises the wave-event latch, and calls `queueSirenSoundRun` — which (while the
siren gate is clear) appends a round-selected base byte (0x1a or 0x1b) followed by the completing
run, giving the periodic alarm blip that punctuates a building wave.

### The record/replay audio model

Because the audio CPU is not emulated, the port models sound as *record and replay*, declared in the
audio map (`audio/sounds.js`) as `model: "clips"` with `soundLatch: 0xa100`. The idea is simple:
every distinct command byte the game hands to the latch corresponds to one captured sound, so a
recorder (run locally against the visitor's own MAME plus the real ROM) writes one WAV per command
plus an index of which commands actually produced audio. Those clips are not shipped — a missing
index is the normal case and just means the game runs silent.

At playback the web player loads the clips keyed by command byte and listens for writes to 0xa100.
A deliberate detail makes this work: the board surfaces *only* the latch write to the audio sink and
never reports the audio-IRQ strobe at 0xa181, so the map intentionally declares no separate control
port. With no control port, the player treats each change of the latched byte as the trigger and
fires that command's clip directly — matching how the real strobe would have handed the same byte
across. The model is strictly one voice: there is a single audio CPU, so before starting a new
clip the player stops whatever is currently sounding, and exactly one sound plays at a time (a clip
may carry a loop flag to sustain until the next command replaces it). Commands with no recorded,
sounding clip leave the current voice untouched. This is why the one-command-per-frame drain
matters end to end: it is what turns the game's queued command stream into a well-spaced sequence of
distinct latch values, each held long enough to key a clip, exactly as it would have keyed the real
audio CPU's interrupt.

## Anti-tamper

Pooyan is riddled with self-checksum guards. They are not a single subsystem sitting in one
place; they are scattered through the boot path, the attract loop, the per-frame drivers, and even
individual actor-state handlers, and their job is uniform: read a block of ROM (or of the
work-RAM tilemap), fold it into a small checksum, and compare that against a hard sentinel baked
into the code. When the fold matches, the guard returns as if nothing happened and the machine
plays normally. When it misses, the guard either bumps a counter that later gameplay reads, or it
branches straight into garbage — a target address that is data, not code, deliberately chosen so a
patched ROM crashes the CPU rather than running altered. Every checksum here is against a known
sentinel, and against a clean image every fold hits it; a firing arm therefore means the code or
the tilemap has been altered.

### The guards, and where they hide

The earliest guard runs before the game is even up. The power-on boot entry at 0x0092 walks the
eight 4K program banks, and for each one sums its bytes into a 16-bit total plus a carry count,
then compares that triple against the 24-byte reference table ROM_SELFTEST_CHECKSUM_TABLE (0x0079)
— three expected bytes per bank. The pass tally ROM_SELFTEST_TALLY (0x8fff) is seeded with the
bank count before the walk and bumped once per matching bank, so a fully intact image leaves the
tally at 0x10 — twice the bank count. That tally is the boot's gate: the
attract state-0 handler at 0x072d, once its tilemap blanking has drained, reads 0x8fff and only
finishes the attract-to-play setup (state advance, attribute flood, the opening display commands)
when it reads exactly 0x10 — any other value drops it straight into the main loop, so a machine
whose banks don't all verify never completes its opening handoff.

The attract loop then carries a second layer. Its state dispatcher at 0x7442 masks the self-test
selector (SELFTEST_DISPATCH_STATE, 0x8921) and routes to three handlers, two of which are guards.
State 0, seedDisplayListPointersAndVerifyRomSignature (0x744e) [seen], seeds the display-list
pointer pairs and then runs a two-stage program-signature check: loop 1 compares the first eight
boot bytes against their verbatim reference copy SELFTEST_REF_COPY_BOOT (0x749a), and loop 2 walks
a 0x74-byte program window from SELFTEST_LOOP2_SCAN_BASE (0x0092) against the copy continuing at
0x74a2. A loop-2 divergence abandons the state handler and tails into the screen re-init at 0x67df;
an intact image returns with only the seed writes applied. State 1,
runDisplayListAndAdvanceToGameplay (0x7517) [seen], runs the display-list interpreter and then
column-sums two video-RAM strips, HUD_INTEGRITY_STRIP_A (0x82bc) and HUD_INTEGRITY_STRIP_B
(0x86bc), each 14 tiles tall stepping one row at a time; the two column sums must total 0x014f
before the selector advances to the gameplay-driver state. Attract sub-state 1 at 0x08e9 wraps its
colour/attribute flood in two ROM-table integrity guards over the block from
ATTRACT_INTEGRITY_CKSUM_BASE (0x0831), whose intact low-byte sum is the 0xaa sentinel, before it
enqueues its display commands and advances the sub-state. The attract text painter itself is
duplicated for tamper detection: paintAttractColumnWithTamperChecksum (0x6df9) is a byte-identical
clone of the ordinary column typer, and advanceAttractToBoardBuildIfImageIntact (0x7071) is a clone
of the attract-to-play sequencer. The level-intro phase handlers do the comparing: one runs a
0x60-byte compare of the column typer against its clone (TAMPER_CHECK_BLOCK_0AC8 vs
TAMPER_CHECK_CLONE_6DF9) whenever bit 2 of the round counter is set, and another runs a 0x79-byte
compare of the 0x7071 clone against its own original (0x0b32) on round 3; each compare, on a
divergence, tails into the other clone as its tamper-response handler. A patch applied to one copy
but not the other therefore shows up as a mismatch that reroutes the machine into the duplicated
code. The attract sub-state 0 handler resetToAttractScreenStart (0x08b3) [seen] carries a guard of
its own: it sums ROM backward from CHECKSUM_SCAN_START (0x64d5) [code] down to a 0x96 sentinel and,
unless (0x96 minus the carry count) lands on 0x8f, raises the object-freeze flag
TAMPER_OBJECT_FREEZE_FLAG (0x89fb).

The signature guards proper live deeper in play. verifyRomSignature (0x208c) [code] samples the
code region from SIGNATURE_SAMPLE_BASE (0x066d) — every eighth byte — against the 16-byte
SIGNATURE_REFERENCE_TABLE (0x20aa), and on any mismatch raises SIGNATURE_MISMATCH_FLAG (0x8ef0);
it is invoked from the per-frame scroll worker at 0x0254 whenever a control byte's low nibble is
set. loc_1bcc [code] snapshots the live player page into player 1's bank and then folds fourteen
ROM bytes from TAMPER_CHECKSUM_CODE_BASE (0x5328), each masked to five bits, and unless the running
sum lands on its fixed low/high pair bumps the signature strike counter TAMPER_STRIKES_SIG (0x8a38).
loc_4103 [code] runs the object animation and, on its frame-zero crossing, folds a signature
checksum that likewise bumps TAMPER_STRIKES_SIG. advanceActorStateOnTimerWithTamperCheck (0x3865)
[seen] is an ordinary actor-state handler that hides a check inside itself: after advancing the
record it acts only once the record pointer has climbed into the sprite object-table band and the
free-running frame counter FRAME_COUNTER (0x8a5f) reads zero, whereupon it folds a fixed program
block backward from ACTOR_TAMPER_CKSUM_TOP (0x4282) to its 0x1a terminator and, if the masked
result keeps any bits, bumps SIGNATURE_MISMATCH_FLAG. loc_7e6d [code] is the same shape aimed at a
different block — gated on the lives cell (0x8988) being 4 or more and the frame counter being zero,
it sums ROM downward from TAMPER_CKSUM_TOP_ADDR (0x64be) to a 0x34 sentinel and bumps the ROM
strike counter TAMPER_STRIKES_ROM (0x89ef) on a miss.

Several guards target specific ROM blocks and raise their own dedicated strike cells.
verifyRomChecksum (0x3fe9) [code] sums sixteen bytes descending from ROM_CHECKSUM_TOP (0x7780) and
inspects the checksum's bit pattern — a healthy image clears bit 0 and sets bits 5 and 7 — bumping
TAMPER_STRIKES_STATE10 (0x8a39) on any deviation. verifyTableChecksum (0x585b) [code] is a generic
16-bit sum-of-bytes tripwire whose match requires the low byte to land on 0xc1 and the high byte on
0x1d, and any other outcome raises the eagle-spawn ROM-check flag TAMPER_ROM_CHECK_FLAG (0x882b).
flagTamperOnRound5ChecksumMiss (0x5b06) [code] fires only when the round selector (0x8907) equals
5, sums the six bytes at 0x1553, and on an unbalanced result bumps the freeze tally
TAMPER_FREEZE_FLAG (0x881e). loc_1b43 [seen], one of the play-state handlers, folds a 34-byte
checksum over TAMPER_CKSUM_BASE_5593 (0x5593) — each byte masked with 0x37, rotated, added with
carry — and bumps TAMPER_FREEZE_FLAG unless the accumulator equals 0x7c. loc_5594 [code], a spawner
tail, sums the eight bytes of INTEGRITY_GUARD_REGION_0BAD (0x0bad) against their two's-complement
signature INTEGRITY_GUARD_SIGNATURE_55B5 (0x55b5) and bumps TAMPER_FREEZE_FLAG on any nonzero pair
before it seeds the free slot. loc_52f6 [code], gated behind a spawn guard, runs a 23-byte rolling
checksum of ROM downward from 0x0bf3 and bumps the slot-sweep strike counter
TAMPER_STRIKES_SLOTSWEEP (0x89e8) unless the sum lands on 0x0915. loc_05ee [code] draws the credit
count and then, only when its low BCD nibble is 2, folds a 31-byte checksum downward from
HUD_GUARD_CKSUM_TOP (0x64c8) whose intact sum is 0x8c, bumping the credit-draw strike counter
TAMPER_STRIKES_HUD_GUARD (0x8a3c) on a miss.

A cluster of guards uses the harsher response — a branch into data. loc_6a7f (0x6a7f) [code] is
mostly a per-frame object driver, but on the pass where the blink phase is clear and the wave index
is 2 it runs once (latched through TILE_SUM_ONCE_LATCH, 0x8f56) and checksums the playfield tilemap
from 0x8450, skipping column 0x1b and stepping row by row, and the intact sum is 0x29b8; a miss
jumps to 0x0929/0x3829, both of which are data, so a corrupted tilemap crashes rather than
mis-renders. loc_68ac [code] and loc_3278 [code] are the tile-region twins: each sums the tile
columns from 0x8402 into a 16-bit total and looks it up in the 4-entry paired table
TILE_CHECKSUM_TABLE (0x68eb), latched once through TILE_CHECKSUM_LATCH (0x8f55); a low-byte miss
tails to 0x76d4 (data) and a high-byte miss to 0x3829 (data). loc_30f1 [code], the hunter-formation
launcher, byte-compares the 0x40-byte body of the loc_3278 routine (read as data through
TAMPER_COPY_3278, 0x3278) against the loc_68ac original, and a mismatch wipes all of work RAM from
0x8800 upward. loc_6f9d [code], the level-intro phase-4 handler, byte-compares the ROM block
PHASE4_TAMPER_ORIG (0x6ac5) against its data copy PHASE4_TAMPER_COPY (0x6fed): a match queues sound
and display commands, a mismatch again wipes work RAM. loc_79e9 [code] sums the loc_68ac routine
forward to its terminating opcode and compares the 16-bit result against the stored word at
TAIL_CHECKSUM_GUARD (0x7a0b), diverting to 0x07d0 or 0x1a85 on a miss; loc_7960 [code], the shared
integrity-and-render handler reached from the play-state handlers, folds a 0x5b-byte checksum over
INTEGRITY_CHECKSUM_CODE_BLOCK (0x2901), verifies four checksum bytes against the guard trailing that
block, and jumps to one of four data addresses (0x7a0b/0x0fa0/0x1388/0x1770) on any miss. That same
handler ends by scanning the seven-flag integrity block at INTEGRITY_FLAG_SCAN_BASE (0x89e7), and
the first nonzero flag it finds diverts it into the tail checksum at loc_79e9 — the strike counters
are not only read by gameplay, they feed back into the guard net itself. Two actor-state handlers
carry field checks: loc_2a01 [code] integrity-checks the field attribute table (a 0x20-byte sum that
must equal 1) and tail-jumps its hunter guard on a mismatch, and loc_2a96 [code] does a reversed-
signature comparison of the round-reinit code window at 0x67df against the reference block at 0x2b23,
falling back to loc_2a01 on any miss. loc_3266 [code] sums a 0x20-byte block to a 0xdc sentinel and
traps on a mismatch. The screen re-init reinitRoundArenaAndPlayfieldIfImageIntact (0x67df) [seen] is
itself gated: it sums ten colour-map cells one row apart and only arms a fresh screen when the sum is
the 0x5a sentinel, otherwise handing off to the frame updater. And the high-score table has its own
guard, flagHighScoreTableCorruptOnChecksumMiss (0x0644) [code]: the 4-byte block at
HISCORE_CHECKSUM_BASE (0x778a) must lead with the 0xc8 marker and its summed bytes minus their carry
count must equal 0x59, or it raises HISCORE_TABLE_CORRUPT_FLAG (0x8df8).

### The tally cells

The guards write into a spread of one-byte counters and flags in work RAM, and every one of them
is tagged [code]: in a clean ROM each reads a static value (0 for the strike counters, 0x10 for the
positive pass tally), so their write paths are understood from the code but never exercised in
normal play. The freeze tally TAMPER_FREEZE_FLAG (0x881e) is the loudest — it is bumped by
loc_1b43's 0x5593 fold, by loc_5594's 0x0bad signature check, and by
flagTamperOnRound5ChecksumMiss — and it is the one gameplay watches most closely. The
signature-mismatch flag SIGNATURE_MISMATCH_FLAG (0x8ef0) is raised by verifyRomSignature and
advanceActorStateOnTimerWithTamperCheck. A run of adjacent strike counters sits in
the seven-flag block at INTEGRITY_FLAG_SCAN_BASE (0x89e7): TAMPER_STRIKES_SLOTSWEEP (0x89e8) from
the slot-sweep checksum, TAMPER_STRIKES_OBJMOVE (0x89e9), CREDIT_TAMPER_COUNTER (0x89ea),
TAMPER_STRIKES_CATCH (0x89eb), and TAMPER_STRIKES_STATE0 (0x89ed) from the state-0 code-window
sum; just past that block, TAMPER_STRIKES_ROM (0x89ef) is bumped by loc_7e6d's 0x64be sum. A second
adjacency holds the signature-family strikes: TAMPER_STRIKES_SIG (0x8a38) from loc_1bcc and
loc_4103, TAMPER_STRIKES_STATE10 (0x8a39) from verifyRomChecksum, TAMPER_STRIKES_OBJSIG (0x8a3a),
and TAMPER_STRIKES_HUD_GUARD (0x8a3c) from the credit-draw tripwire. The terminator match-scan guard
feeds its own TAMPER_STRIKES_TERMINATOR (0x8df9), sitting right beside the high-score corruption flag
HISCORE_TABLE_CORRUPT_FLAG (0x8df8). There is also an object-freeze flag TAMPER_OBJECT_FREEZE_FLAG
(0x89fb), cleared by the board reset and read each frame by the joystick sampler as a halt condition. On the
positive side of the ledger, ROM_SELFTEST_TALLY (0x8fff) counts up rather than striking — it reaches
0x10 only on a clean boot pass, and it physically shares the top of the boot stack, deliberately
reserved above the stack so the vblank register-save can't clobber it.

One cell in this set is not a pure tally: TAMPER_ROM_CHECK_FLAG (0x882b) is multiplexed. As an
anti-tamper cell it is the eagle-spawn ROM-checksum flag that verifyTableChecksum raises on a
mismatch, but the same byte is reused by unrelated code — advancePlayStateToPhase7OnActorDelay
stamps 0x07 into it as a play-state shape index, and accrueCreditFromCoin1Pulse reads and steps it
as a coordinate low byte under the coinage config. So a nonzero reading there does not by itself
mean tamper; its meaning depends on which subsystem last touched it.

### What a nonzero tally does

The tally cells only matter because ordinary gameplay reads them and degrades when they are set —
a patched ROM does not just fail a check, it plays a broken game. The freeze tally
TAMPER_FREEZE_FLAG (0x881e) is the clearest example, and it reaches three separate systems. The
lead-actor driver advanceLeadActorPrimaryState runs its three per-frame sub-passes and then, if the
freeze tally is nonzero, returns without dispatching the lead actor's state at all — so with the
flag set the actors stop being driven. The round-HUD painter paintRoundNumberHud treats a set
freeze tally as the signal to skip its one-time round-number setup entirely (the attribute-column
copy, the BCD digit paint, the round glyph stamp) and run only the per-frame update chain, so the
HUD never gets built. And the phase-1 spawner gate loc_6e75 checks both SIGNATURE_MISMATCH_FLAG and
TAMPER_FREEZE_FLAG together: with either set it takes a skip-spawn branch whose target is data, a
dead trap — meaning a machine that has struck either flag doesn't quietly stop spawning, it crashes
when it next tries to. The signature-mismatch flag SIGNATURE_MISMATCH_FLAG (0x8ef0) also gates
routine spawning on the softer path: seatActorRecordAndQueueSpawnDisplay bails without seating a
fresh object record or enqueuing its display command whenever that flag is held, so objects simply
stop appearing. The object-freeze flag TAMPER_OBJECT_FREEZE_FLAG (0x89fb) is read by the per-frame
joystick sampler loc_1e55, which — if that flag or its companion board-clear flag (0x89e5) is
nonzero — zeroes the player-actor state byte and bails instead of sampling the stick, freezing the
player's aim input.

The strike counters in the 0x89e7 block close the loop back onto the guard net: the shared
integrity handler loc_7960, at the end of its own checksum, scans those seven flags and the first
nonzero one it finds sends it into the tail checksum loc_79e9, whose own low-byte miss branches into
data. So striking a counter in that block arms a further trap on the next pass through the shared handler.
The remaining counters (the signature-family strikes at 0x8a38–0x8a3c, the terminator strike at
0x8df9, the ROM strike at 0x89ef) accumulate as evidence that a specific block failed, feeding the
handlers that divert to the board/reset path or, through the same flag-scan and trap plumbing,
toward a crash. Across the whole system the design is consistent: a checksum that matches leaves the
machine untouched, and a checksum that misses either poisons a counter that starves the next frame
of actors, spawns, and HUD, or — for the guards aimed at data — simply stops the CPU on a patched
image.

## Open questions

These are the readings the code fixes but MAME has not yet confirmed, the paths no capture has
exercised, and the cells whose one byte serves two masters. Each is a work item for a following
grounding pass.

- **Sound byte-to-effect map.** The page-0x8a sound-command FIFO is [seen] as a ring that reaches the
  audio CPU, but which specific sound each command byte selects is [code]/[guess] — it needs an
  audio-side grounding pass that watches the audio CPU, not just the latch write.
- **Multiplexed timer cells.** Two bytes in the 0x8928 timer block carry a genuinely contested role,
  each written one way by one subsystem and another way by a second. BLINK_PHASE (0x892b) is toggled as
  a blink phase by the tile-blink animator, yet the object-anim path seeds it to 0x08 and decrements it
  as a countdown; WAVE_NUMBER (0x892d) reads as a 0..8 wave/stage index in the progression code, yet the
  launch-flip animator treats it as a per-frame countdown reloaded to 0x10. Which use dominates in which
  game state needs a capture that exercises both.
- **Cell axes and same-address aliases.** PLAYER_X_COORD (0x8842) is [code] with its axis (X vs Y) still
  unverified; and several addresses carry two candidate names awaiting reconciliation to one consensus
  reading — 0x8d4a (spawn-active vs special-actor-active), 0x8d65 (active-target-pair pointer vs
  struck-target latch), 0x8f04 (formation-enable vs rope-draw-complete).
- **Top-level state 2.** Two setup dispatchers each describe themselves as the main-state-2 handler by a
  different path (the board-build slot of the 0x06f0 table, and the level-intro phase selector); which
  the machine actually enters at state 2 is not decidable from the code alone.
- **Foreground scroll worker 0x0254.** Whether it does load-bearing drawing during live play or is an
  attract/idle task is unsettled; its gating byte 0x883f is [code]-only and its scroll-column duties
  overlap the vblank NMI's own column rebuild.
- **Coin path beyond slot 1.** Slot 2 bumps a pulse counter at 0x8826 but only slot 1's counter has a
  wired coin-meter strobe, so whether 0x8826 drives a second physical meter is unconfirmed; and the third
  acceptor (a flat +1 credit, no coinage or meter) is unlabelled as service-credit vs a third coin slot.
- **The six-slot object-state array 0x8ba0.** Its arm/advance/draw/integrity machine and the per-pool
  overloading of the shared 0x18-byte record fields are [code]-only — no golden exercised a full cycle.
- **Formation, band-build and intro-launch.** The formation-spawn timer (0x8d30) and the band-build arm
  latch (0x8f63) are static-0 in every golden, so those paths — including the rope-extend tamper-strike
  branch and the formation phase-handler table — are [code]-only, unconfirmed by MAME.
- **Display-command ring drain.** The ring cells are [code], never watched transitioning in a golden, so
  which screen region each command word repaints is inferred from the enqueue sites rather than confirmed
  by watching the ring drain.
- **Inferred cells.** A handful remain [guess] rather than code-consistent — loc_8f5f (0x8f5f, role
  open), the wave-tile cursor WAVE_TILE_CURSOR_84F6, the formation state row FORMATION_STATE_ROW2, and
  the spawn-sweep pair SPAWN_SWEEP_COUNTDOWN / SPAWN_SWEEP_TRIGGER — flagged so they are not trusted as
  fact.
