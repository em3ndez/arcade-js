// SPDX-License-Identifier: GPL-3.0-only
//
// pooyan idiomatic-layer name registry.
//
// The frozen oracle in ../translated/ is the source of truth. This file is a naming
// convenience for the readable idiomatic layer: descriptive symbols for work-RAM cells
// (imported by idiomatic modules) plus the ROUTINES map that dispatches idiomatic
// rewrites over the translated fallback (resolveAllIdiomatic). A name here must never
// be treated as authoritative behaviour -- the translated routine is.
//
// Each cell/routine carries a confidence tag: [seen] role confirmed by a MAME
// observation (the golden RAM trajectory); [code] role read from the translated
// behaviour, MAME-grounding still open (the cell is static/unobservable in the
// attract + gameplay goldens).

// == Work-RAM cells (0x8800-0x8FFF) -- core game state, grounded vs the attract + gameplay goldens ==
/** [seen] (both goldens static 0 (DSW1 bit3=0 default) -> unobservable/code; loc_0092 boot cpl's the DSW1 port then decodes ~(bit3) here, loc_18da picks award queue 5/3 & step 8/7 off it) DSW1 bit3 (complemented, boot-only): selects bonus/extra-life award schedule -- queue reload 5/3, BCD step 8/7 */
export const BONUS_AWARD_DSW = 0x8800;
/** [seen] (gameplay golden: coin at f302 -> 0->1, 1P start at f362 -> 1->0 (credit added then consumed); static 0 in attract = credit counter, REFUTES A's score-drip) BCD credit counter (max 0x63): coin +1, 1P start consumes 1, 2P start consumes 2; drawn as 2 HUD digits */
export const CREDIT_COUNT = 0x8802;
/** [seen] (attract cycles 0/1/3, gameplay 0->1->2->3 (distinct=4) discrete states; loc_066d indexes table 0x06f0 on (0x8805)) top-level NMI state selector dispatched via table 0x06f0 (072d/0899/0c4e/159b/0e53): attract/intro/play */
export const MAIN_GAME_STATE = 0x8805;
/** [seen] (gameplay: 0->1 at f362 (game start, coincides 0x8805->3), 1->0 at f4324 (game over); static 0 in attract) in-play gate: set 1 at start-of-life, cleared 0 at game-over; gameplay handlers ret early when 0 */
export const GAME_ACTIVE_FLAG = 0x8806;
/** [seen] (gameplay distinct=256, wraps 0->255, 530 transitions = a per-frame countdown timer reloading/wrapping; selectRoundDisplayListAndAdvancePhase 'dec (0x8808)... ret nz') per-frame phase countdown decremented by state handlers, reloaded (e.g. 0x60) to time phase transitions */
export const PHASE_TIMER = 0x8808;
/** [seen] (both goldens: 0->32 then decrement 32..0 per frame, repeated (420/468 trans); loc_02e6 seeds 0x20, loc_02ce/fillIntroRowsThenBuildBoardIntro walk down) down-counter (seeded 0x20) for the row-by-row VRAM tile fill; zero ends the fill and advances state */
export const FILL_ROW_COUNTER = 0x8809;
/** [seen] (steps discrete phase values 1/2/3/4/7/10/13/18 (gameplay distinct=12); loc_15a1 dispatches (0x880a)&0x1f via table 0x15a8) in-play sub-state index (&0x1f) dispatched via table 0x15a8; stepped through round/intro phases */
export const PLAY_STATE_INDEX = 0x880a;
/** [seen] (low byte steps +32 (0,32,64,..,224,0) with 465 transitions; loc_02e6 stores HL, loc_02ce fills B tiles then adds 0x20-B) 16-bit VRAM write cursor for the row-by-row tile fill, advanced +0x20 per row (paired with 0x8809) */
export const TILE_FILL_PTR = 0x880b;
/** [seen] (MAME 2P golden: toggles P1<->P2 exactly on swaps -- 0->1 at P1 death f2854, 1->0 at P2 death f7129; the f319 scratch 0x1f is loc_075d's leftover stored by loc_0c45, not a player value) active-player select; bit0=0 -> P1 banks (score 0x88a2/counter 0x88a4), 1 -> P2 (0x88a5/0x88a7) */
export const ACTIVE_PLAYER = 0x880d;
/** [seen] (MAME 2P golden: 0->1 at 2P start f402, holds 1; static 0 in the 1P golden = positive control; startNewGamePlay sets 1 on 2P start, startGameOnStartButtonPress picks player bank when nonzero) nonzero for a 2-player game; gates per-player bank selection (with 0x880d) and the 2P start event */
export const TWO_PLAYER_FLAG = 0x880e;
/** [seen] (gameplay: bit0=1 at f302 (coin), bit3(val 8) at f362 (1P start); loc_066d writes cpl(IN0 @a080) here each NMI) inverted IN0 sample (head of 0x8810-0x8812 edge-detect ring): coin bit0, 1P-start bit3, 2P-start bit4 */
export const INPUT_PORT0 = 0x8810;
/** [code] (static 0 in BOTH goldens (ROM intact) -> code; only bumped by checksum guards (loc_1b43 !=0x7c, loc_5594 signature), aborts actors (advanceLeadActorPrimaryState), traps spawn (loc_6e75) -- REFUTES B's round-active (would go nonzero during a round)) anti-tamper miss tally bumped by ROM/signature checksum guards; nonzero freezes spawns, aborts actor updates, skips HUD setup */
export const TAMPER_FREEZE_FLAG = 0x881e;
/** [seen] (both goldens: 0->1 at f32 (boot init to normal orientation), held; loc_066d epilogue copies (0x881f)->0xa187 b7, loc_0320 gates mirror pass when ==0) screen orientation flag copied to flipscreen latch 0xa187 b7 each NMI; 1=normal (upright), gates the vertical-mirror pass */
export const FLIP_SCREEN_FLAG = 0x881f;
/** [seen] (static 0 in both goldens (difficulty 0) -> unobservable/code; loc_0092 boot cpl's the DSW1 port then writes (~DSW1>>4)&0x07 (only writer), spawnFormationEnemyOnInterval/spawnShotTargetOnInterval/loc_39fb threshold spawns on it) 3-bit difficulty (DSW1 bits4-6, complemented, boot-only); scales enemy spawn schedules and tier/threshold tables */
export const DIFFICULTY_DSW = 0x8820;
/** [seen] (both goldens: 0->1 at f32 (boot seeds coinage=1c/1c via table 0x0053, 0x882f gets hi nibble); serviceCoinCreditAndCountersUnlessFreePlay/resetToBoardBuildToContinuePlay/queueCreditDisplayCommands test ==0x0f free play (A's slot-B label unverified)) coin-slot coinage nibble from DSW0 low nibble via table 0x0053; 0x0f = free play; read by credit logic */
export const COINAGE_CONFIG = 0x882c;
/** [seen] (attract+play: byte0 0->176 then descends ~1 per 2f (35/40 distinct) = a live sprite Y at the list base; loc_02ef builds it, loc_0378 mirrors 24 entries) Base of the 24-entry x4 sprite display list; byte0 is the first sprite's Y, rebuilt each frame, swept for collisions */
export const SPRITE_DISPLAY_LIST = 0x8840;
/** [seen] (attract 1766 / play 2735 transitions, byte descends by 3 = an actively-rewritten sprite record region (loc_5e78/5f6a walk it)) Stride-4 actor-record slots inside the sprite display list, swept B=2 by the display/DMA drivers (gated on 0x8907 bit0) */
export const SPRITE_ACTOR_RECORD_SLOTS = 0x8848;
/** [seen] (attract 1410 / play 951 transitions, range to 248 = live sprite-coordinate target slots (loc_5d4d/5df7 IY=0x887c, loc_6435 player-2)) Stride-4 target/collision slots in the sprite list, scanned as proximity targets vs 0x8be8 records (player-2 set in 2P split) */
export const SPRITE_TARGET_SLOTS = 0x887c;
/** [seen] (attract+play: 0->1 at f65 then held = default high score 10000 (MSB byte 0x01), rarely written; loc_0496 compares descending from 0x88aa) MSB of the 3-byte BCD high score (0x88a8..0x88aa); a new score is compared MSB-first here and copied down if higher */
export const HIGH_SCORE_BCD_HI = 0x88aa;
/** [seen] (cycles 0..27 (28 distinct), 457 transitions = mod-0x1c counter) period-0x1c frame tick; on wrap advances the 0x8920 display sub-phase one-shot */
export const SUBPHASE_TICK = 0x88b7;
/** [seen] (both goldens: high byte 0x84 (VIDEO RAM), low byte oscillates 0xe6-0xf0; loc_2405 (odd frames)/loc_23ec (even) dereference it and WRITE tile codes -- not ROM) 16-bit cursor into video RAM (0x84xx tilemap) marching a tile strip forward on odd frames / back on even, cycling tile codes 0x10/0x34/0x37 to animate on screen (0x34/0x37 gate the step) */
export const TILE_ANIM_CURSOR = 0x88be;
/** [seen] (MAME round-advance capture: escalates 0->2->4->..->14 = 2x round as round steps 1->7; loc_142c/379d speed-table index, loc_191c escalating write) Enemy speed/difficulty index, read clamped <8 to index velocity tables (negated per 0x8907 bit0); escalates with wave/round */
export const SPEED_INDEX = 0x8900;
/** [seen] (gameplay 0x20 then slow decrement 32->..->25 = per-stage countdown) counts down from 0x20 over a stage; near 0 gates actor AI; init value selects the stage label */
export const STAGE_COUNTDOWN = 0x8901;
/** [seen] (MAME round-advance capture: cycles per-round 0->1 f1291, 1->2 f7618, 2->3 f7750; static 0 without a round poke; loc_196e mode-select, resetBoardRamAndReseedSpawnCounters reseed at 7) Per-round phase/step counter (cycles to 7) selecting spawn/fire mode branches; snapshotted into 0x8d43/0x8934 */
export const SPAWN_PHASE_COUNTER = 0x8902;
/** [seen] (play: counts up 0..6 per stage then resets at transition = a per-stage arrival/wave counter (advanceEnemyToArrivalAndTallyWave bump, loc_2a01 cap, addRopeSegmentAndAdvanceExtendState rope bound)) Per-stage counter bumped on enemy arrival (caps 9->8); bounds the rope-segment count (0x8931 <= this-2), parity picks spawn variant */
export const WAVE_ARRIVAL_COUNTER = 0x8903;
/** [seen] (attract+play: 0/1 flag, 1 while a round runs, resets at stage/life transitions (startRoundAfterIntroDelay/1798 set, loc_1dd3/16b7 read)) In-progress flag for the active round; set to 1 at level start, keys render/state decision trees */
export const ROUND_IN_PROGRESS = 0x8904;
/** [seen] (MAME round-advance capture: increments per stage transition -- natural 2->3 f2059, 3->4 f2431 beyond the poked value; bit1 gates target-group fan-out, bit0 the rope path; drawStageLabelOncePerLevel/1ead BCD render) Round counter; +1 BCD-rendered as the HUD round number; bit0 selects stage-type/facing variant, low bits index difficulty tables */
export const ROUND_COUNTER = 0x8907;
/** [seen] (play: 3->2->1->0 then reset to 3; exhaustion runs loc_1a96 (phase transition, not death) rendered by loc_03c2 = a phase gauge) Phase counter drained per phase, drawn as a 5-cell vertical HUD gauge; on reaching 0 it triggers phase-exhausted (clears rope) */
export const GAUGE_PHASE_COUNTER = 0x8908;
/** [seen] (both goldens: byte0 cycles 0/1/2 = the 0x88b7-wrap display one-shot (startRoundAfterIntroDelay/7517 inc/test/clear); the pointer-table role (loc_308b/30f1 register 4 formation slots, stride 2) is unobserved -- no formation spawned in 180s) display sub-phase one-shot (byte0, fired on the 0x88b7 mod-0x1c wrap); byte0 also the base of the 4-slot enemy-formation pointer table (stride 2) */
export const FORMATION_SLOT_TABLE = 0x8920;
/** [seen] (play: up-counter 0..4, resets to 0 at phase exhaustion (f3778); static 0 in attract (no rope); addRopeSegmentAndAdvanceExtendState steps it, retractRopeSegment retracts) Count of extended rope segments; stepped up to 0x8903-2; drives per-segment retract anim and the attribute byte */
export const ROPE_SEGMENT_COUNT = 0x8931;
/** [seen] (MAME round-advance capture: mirrors 0x8902 one frame later -- 0->1 f1292 vs 0x8902 f1291, 1->2 f7623) rope/lift segment draw count (snapshot of 0x8902 phase, reseeds to 4 at 7); sets rope sprite rows */
export const ROPE_DRAW_COUNT = 0x8934;
/** [seen] (MAME 2P golden: block saved on P1 death f2854 -- byte1 0x8941 0x20->0x1a via saveLivePageToPlayer0Bank; base byte0=colour stays 0 (source 0x8820=0) so grounded at BLOCK level. loc_1a47/loc_1601 ldir 0x8900<->0x8940 per 0x880d) Base of player-0's 0x3f-byte saved actor/state block, swapped with live page 0x8900; byte0=sprite colour */
export const PLAYER0_STATE_BANK = 0x8940;
/** [seen] (Gameplay golden: 0->3 (seed=default 3 lives) then 3->2->1->0 drain per death, then ->3 for next game. Decisive lives countdown; overturns A's 'active flag' guess. Seeded 0x8807 in resetActorStateForBoard (bank +8).) Player-0 remaining lives, seeded from lives DSW 0x8807; decrements on death, gates player-switch/game-over */
export const PLAYER0_LIVES = 0x8948;
/** [seen] (MAME 2P golden: block saved on P2 death f7129 -- byte1 0x8981 0x20->0x0f; base byte0=colour stays 0 (source 0x8820=0) so grounded at BLOCK level. loc_1a47/loc_1bcc ldir 0x8900->0x8980 per 0x880d) Base of player-1's 0x3f-byte saved actor/state block, swapped with live page 0x8900; byte0=sprite colour */
export const PLAYER1_STATE_BANK = 0x8980;
/** [seen] (Both goldens: 0->3 (seed=lives DSW), gameplay 3->0->3 reset pattern parallel to 0x8948. Value 3 = default lives; loc_7e6d gates integrity on >=4 (only under 4/5-life DSW). Overturns A's 'active flag'.) Player-1 remaining lives, seeded from lives DSW 0x8807; gates player-switch and an integrity check (>=4) */
export const PLAYER1_LIVES = 0x8988;
/** [code] (Static 0 both goldens (no board completed in capture). Code: advanceGameStateOnCreditOrStartPress arms it on enemy-scan/table-lookup mismatch; loc_324d tail-jumps to board-clear loc_3278 when set; loc_1e55 freezes object update. A/B synonyms (stage-transition vs board-clear).) When set, freezes per-frame object updates and diverts handlers to the board-clear/level-intro path */
export const BOARD_CLEAR_FLAG = 0x89e5;
/** [code] (static 0 (ROM intact) -> code) anti-tamper strike counter bumped when the 0x64be ROM checksum misses its sentinel */
export const TAMPER_STRIKES_ROM = 0x89ef;
/** [seen] (Both goldens: toggles 0<->0x0a (tile code written then cleared). Code: loc_1601/spawnEnemyWave/loc_1b80/stampSecondScrollColumn copy ROM strings/tables in; clearDisplayMsgBufOnRoundInitMatch matches 0xff-pattern @0x16ae and rst-0x10 clears the 7 cells.) Base of a 7-cell tile message buffer; ROM strings copied in, pattern-matched for completion, then cleared */
export const DISPLAY_MSG_BUF = 0x89f0;
/** [code] (Static 0 both goldens (top-score MSB stays 0 in short capture). Code: loc_0092 seeds 10x(0,0,1) at 0x8a00-0x8a1d, loc_1ab2 insert-sorts, loc_03e9 splits bytes into BCD nibbles for display.) Base of the sorted 10-entry x 3-byte BCD high-score table; insert-sorted on game over, rendered on HUD */
export const HIGH_SCORE_TABLE = 0x8a00;
/** [code] (static 0 (ROM intact) -> code) anti-tamper strike counter bumped when the 0x5328/0x557f signature checksums miss their sentinel */
export const TAMPER_STRIKES_SIG = 0x8a38;
/** [seen] (Both goldens: 256 distinct, ~10.8k transitions, decrements 255->254->253... one per frame. Free-running down-counter. Code: loc_066d NMI dec (0x8a5f); spawnHangingRopeObject gates on &3; loc_7e6d/advanceActorStateOnTimerWithTamperCheck/loc_4103 run only when ==0.) Free-running counter decremented every vblank NMI; low bits phase animation, zero-crossing gates integrity checks */
export const FRAME_COUNTER = 0x8a5f;
/** [seen] (Both goldens: slot-0 field0 toggles 0<->1 exactly when the player becomes active (gameplay f1090, same frame 0x8a84 starts moving). Code: loc_19bc/loc_2ae8 zero-fill 0x8a80..; advanceActorAnimationsUnlessGrabbing walks stride 0x18; dozens of state handlers dispatch over it.) Base of the 0x18-stride actor record array (zero-filled at board init); slot 0 is the player/lead actor */
export const ACTOR_TABLE = 0x8a80;
/** [seen] (Both goldens: steps 0->1->2->3->4->5->0 in ~16-frame intervals, matching the 6-entry dispatch table (advanceLeadActorPrimaryState reads (ix+2)&7 -> 0x2442..0x24fb; loc_2901 inc's it). Overturns B's ACTOR_COUNT (misreads the cp-3 spawn gate as a population count).) Lead-actor (slot 0) state/phase index driving the 6-way dispatch table; also gates spawn/formation at >=3 */
export const LEAD_ACTOR_STATE = 0x8a82;
/** [seen] (Both goldens: smoothly varies 0..225 (elevator motion; attract decrements, gameplay increments). loc_23d7 derives THREE stacked sprite Y bytes from (ix+4)=0x8a84 -> vertical axis; loc_1e55 writes joystick to slot-0 -> it is the player. Corrects both derivers' 'X' axis to Y.) Player-actor (slot 0) vertical position; sprite Ys derived from it, enemy AI targets it to arm dives */
export const PLAYER_Y = 0x8a84;
/** [seen] (MAME: takes nonzero aim values in play -- 0x8a87=0x04 (pc 6d0d/71f8 n=611/240), 0x08 (pc 71f5/6bfa), 0x18 (pc 6d12 n=490), 0x10 (pc 7226); cleared to 0 by loc_7292 in the eagle-phase reset. Code: loc_1e55 complements joystick into (ix+7)=0x8a87; acquireTargetLockAndSetAimIndicator/driveAimIndicatorHitTimerElseRescan/loc_6c3f/advanceEagleApproachAndPaintGridMarker set bit2/bit3 for aim on-target/above/below.) Player-actor state byte: low bits = joystick input, bits 2/3 = aim above/on-target/below indicator */
export const PLAYER_AIM_FLAGS = 0x8a87;
/** [seen] (byte0 toggles 0/1, 30 transitions = live record-active flag) enemy actor record sub-array (stride 0x18) at +0x60 in the 0x8a80 arena; byte0 = record-active */
export const ENEMY_ACTOR_TABLE = 0x8ae0;
/** [seen] (attract+play: byte0 toggles 0/1 (38/30 transitions) = slot-active flag; loc_13bc scans 5 slots stride 0x18 for a free one) Base of the secondary 5-slot object/sprite record pool (stride 0x18); slot free when byte0/1 bit0 clear */
export const SPRITE_OBJECT_TABLE = 0x8b70;
/** [seen] (attract+play: byte0 toggles 0/1 (50/38 transitions); launchProjectileIntoFreeSlot allocates a free slot (bumps 0x8d42) and writes byte0=1) Base of the 3-slot projectile/object record table (stride 0x18); launch marks byte0=1 active */
export const PROJECTILE_TABLE = 0x8be8;
/** [seen] (MAME round-advance capture: byte0 record-active toggles 0<->1, 35 transitions from f1863, only under a round-gated formation; dispatchFormationObjectStates sweeps 4 records stride 0x18) Base of the 4-slot formation object table (stride 0x18); one-shot spawn/init, swept per-record */
export const FORMATION_TABLE = 0x8c30;
/** [seen] (gameplay: byte0 takes {0,1,7} matching spawnHangingRopeObject writing (iy+0)=0x07 to a free slot; loc_6435 collision-scans B=3; attract static 0) Base of the 3-slot spawned-object table (stride 0x18) hit-tested vs shots; free slot seeded with state 0x07 */
export const SPAWN_OBJECT_TABLE = 0x8c48;
/** [seen] (attract+play: byte0 cycles 0..3 = presence bits (loc_5b99 tests iy+0 bit0/bit1); loc_5f83 selects 0x8c90 when I==0) Slot 0 (I=0) of the 2-entry I-parity enemy/target actor-record pair; byte0 low bits = presence/state */
export const ENEMY_TARGET_REC0 = 0x8c90;
/** [seen] (attract+play: byte0 cycles 0..2 = presence bits of slot 1; loc_5f83 selects 0x8ca8 when I!=0 (0x8ca8=0x8c90+0x18)) Slot 1 (I!=0) of the 2-entry I-parity enemy/target actor-record pair (0x8c90+0x18); byte0 low bits = presence/state */
export const ENEMY_TARGET_REC1 = 0x8ca8;
/** [seen] (attract+play: reloads 0x80/0x20 and drains 128->127->...->0 (3734/2647 transitions) = countdown; loc_1171 dec-while-nonzero, loc_119a reseeds) Spawn-cadence countdown; decremented each tick, at 0 gates the 0x8ae0 spawn sweep then reseeded */
export const ENEMY_SPAWN_TIMER = 0x8d07;
/** [seen] (attract+play: 0/1 one-frame pulses (set on hit, cleared next frame) = a FLAG; BOTH this and 0x8d1c fire in the 1P golden, so the selector is the I-parity/0x8848 slot index, NOT the player) Hit flag for the I=0 slot (pairs 0x8c90): set 1 on a collision; advanceTargetActorState clears it and tears the struck object down */
export const OBJ_HIT_FLAG_I0 = 0x8d1b;
/** [seen] (attract+play: 0/1 one-frame pulses = flag; selected when I!=0 in loc_6435/loc_638a/markHitFlagSeedActorAndScanEnemyRecords; fires in the 1P golden = an I-parity slot index, not player 1) Hit flag for the I!=0 slot (pairs 0x8ca8, partner of 0x8d1b): set 1 on a collision, cleared on teardown by advanceTargetActorState */
export const OBJ_HIT_FLAG_I1 = 0x8d1c;
/** [seen] (attract: 0->1 at f1448 held to f5798 then 0 (only 3 transitions) = long-held latch; loc_196e sets it on 0x8d22 expiry, loc_0cf8/32bd clear it) One-shot latch set when the 0x8d22 periodic-event timer expires (fires queueSirenSoundRun); cleared on wave teardown */
export const WAVE_EVENT_LATCH = 0x8d21;
/** [code] (static 0 in BOTH goldens (no formation-spawn cycle observed in 180s); loc_2b9a decs while nonzero, on expiry sets IX=0x8c60/DE=0xffe8) Formation-spawn countdown (seeded from level 0x8903); returns while nonzero, at 0 runs the 0x8c60 spawn loop */
export const FORMATION_SPAWN_TIMER = 0x8d30;
/** [seen] (attract: 0->1 at f4466 held ~147f to f4613 then 0 (4 transitions) = event latch; loc_305f sets 0x8d32=1 on catch, loc_196e/others gate on ==0) Rope-grab in-progress latch; set 1 when a grab fires, gates/aborts spawn & event routines while nonzero */
export const GRAB_ACTIVE_FLAG = 0x8d32;
/** [seen] (play: ramps 0..5 then resets 0 per wave (gated 0x8901/cap6); attract: ramps 0..32 (anim); loc_34b0 dec on despawn, loc_0a28 uses &0x03 as 4-phase anim) Active enemy count: inc on spawn, dec on despawn, gated vs threshold 0x8901/cap 6; low 2 bits = anim phase */
export const ACTIVE_ENEMY_COUNT = 0x8d40;
/** [seen] (attract: counts down 10->1 reloading 0x0a each frame (loc_0a28); play: increments 0..5; loc_13bc bumps skipping 0, resolveTargetColumnAndArmApproach/loc_12d0 index by &7/&0x0f) Global anim frame counter; reseeded to 0x0a, bumped skipping 0 as sprite id, indexes tile cols by &7/&0x0f */
export const ANIM_FRAME_COUNTER = 0x8d41;
/** [seen] (attract: 4 distinct 0..3 incl 3 (f1469 0->2); play: 0..3 — cycles discrete object-type values, confirms type/mode byte) Latched type byte of the active hit record (0x8c90/0x8ca8, I-parity); type 0 skips, ==3 selects the main hit path */
export const ACTIVE_OBJECT_TYPE = 0x8d44;
/** [seen] (MAME round-advance capture: takes {0, 8, 0xff} -- 0->8 f1291, 8->0xff f1863 = threshold then interior-entry; loc_343e/34f2 compare vs (ix+6)&0x1f, loc_425c arm) Tile-column threshold at which a moving object starts its turn animation; anim-arm routines set it to 0 or 0xff */
export const TURN_COLUMN_LIMIT = 0x8d4b;
/** [seen] (attract+play: values {0,16,24,32} latched then cleared to 0 (few transitions) — discrete guard thresholds, confirms guard role) Threshold the phase counter (0x8901) must reach before the attract/board script advances; latched to it, nonzero=busy */
export const SCRIPT_ADVANCE_GUARD = 0x8d6d;
/** [seen] (gameplay 5->4->..->0 repeated (32 transitions) = countdown) counts down (from the 0x8d79 lane count) while a lane-spawn sequence runs; suppresses enemy fire; cleared at wave end */
export const LANE_SPAWN_COUNTDOWN = 0x8d75;
/** [seen] (attract+play: ramps up 0->5 then drains 5->0 — activate/consume counter, confirms lane count) Count of activated lane actors: inc on activate (activateLaneActorSlot), dec on slot init (spawnObjectIntoFreeSlot); ==0 selects primary target table */
export const ACTIVE_LANE_COUNT = 0x8d79;
/** [seen] (attract+play: ramps 0->5 then resets to 0 at board-script re-arm (armEnemySpawnScript) — confirms per-spawn tally) Per-slot spawn tally bumped each actor-slot init; indexes the alternate target-column/anim source (with 0x8d6f); cleared on script re-arm */
export const SLOT_SPAWN_INDEX = 0x8d7b;
/** [seen] (play: monotone 0->1->2->3->4 then reset (f3261+); attract static 0 — confirms progress/arrival counter (advanceEnemyToArrivalAndTallyWave inc, fireEnemyShotWhenAlignedWithPlayer/57b4 gate)) Arrival/progress counter bumped on each object arrival; ramps enemy fire aggressiveness and gates late-wave phases */
export const WAVE_PROGRESS_COUNTER = 0x8d7d;
/** [seen] (attract+play: 256 distinct, sawtooth 255->254->...->0 (f795 0->255) — classic per-frame countdown timer) Per-frame countdown for the attract/intro text-draw script; on expiry advances the script step and pulls the next byte */
export const SCRIPT_FRAME_TIMER = 0x8e50;
/** [seen] (attract+play: 9 distinct 0..8 cycling (f99 0->1) — discrete state selector, confirms sub-state (dispatchAttractSubstate dispatch)) Attract/demo sequence sub-state selector; indexes dispatch table 0x08a1; handlers inc/set it to advance phases */
export const ATTRACT_SUBSTATE = 0x8e51;
/** [seen] (attract+play: low byte steps down by 0x20 per pass (72->40->8->232->200...) — confirms row-stride VRAM cursor) 16-bit VRAM write pointer for the attract/text-draw script; bytes emitted through it, backed up one row (0x20) each pass */
export const SCRIPT_WRITE_PTR = 0x8e56;
/** [seen] (attract+play: cursor cycles 213->228->243->reset (238+/376 transitions) — moving script cursor, confirms role (advanceActorAnimationFrame)) 16-bit cursor into the shared per-actor animation script; advanced past 3-byte {tile,colour,delay} entries; 0xff lead = control marker */
export const ANIM_SCRIPT_CURSOR = 0x8f00;
/** [seen] (MAME formation capture: cycles 0->1->2->3->0, 100 transitions from f1101 = gather->full->dispatch->reset, exactly as noted; loc_308b) Enemy-formation launch state; 0 while gathering launch-ready slots, set 1 when full then dispatched (&3)-1 into launch handlers */
export const FORMATION_STATE = 0x8f08;
/** [seen] (attract+play: toggles 0<->1 (f1805 0->1) — binary latch, confirms arm-flag role (armLaunchAndAdvanceToHunterSpawn gate)) Arrow/rope launch arm latch: nonzero blocks re-arming launch flag 0x8f3f, seeded from 0x8d7a; cleared with 0x8d75 at wave end */
export const LAUNCH_ARM_LATCH = 0x8f20;
/** [seen] (MAME formation capture: cycles 0->2->3->0, 75 transitions from f1157, in lockstep with the formation; loc_32bd) Enemy-formation teardown dispatch state: state1 tears down wave, state2 walks boss down; nonzero gates new grabs/launch as busy */
export const WAVE_TEARDOWN_STATE = 0x8f24;
/** [seen] (attract+play: cycles 0->1->2->3->4->0 (f1448) — confirms 5-state launch state machine (dispatchLaunchState dispatch)) State selector for the arrow/rope launch state machine; per-frame driver dispatches (&7) into handlers 0..4 */
export const LAUNCH_STATE = 0x8f30;
/** [seen] (attract+play: 48->47->...->0 one step/frame (range 0..48, reseed to 0x30) = drains toward 0 = hold countdown) Inter-wave hold countdown; drains to 0 per frame to gate the next attack wave, reseeded 0x18/0x20/0x30 */
export const WAVE_HOLD_TIMER = 0x8f36;
/** [seen] (gameplay sub-phase progress counter vs 0x8f3d) count of records arrived in the current attack wave; compared to wave count 0x8f3d */
export const WAVE_RECORDS_ARRIVED = 0x8f39;
/** [seen] (attract+play: monotonic 0->1->2->3->4->0 (range 0..4) = wave counter incrementing then wrapping) Current attack-wave index; bumped per wave (wraps after 4th), scales record counts and wave sounds */
export const WAVE_INDEX = 0x8f3d;
/** [seen] (attract+play: toggles 0<->1 (range 0..1, 33/27 trans) = flag arming (armLaunchAndAdvanceToHunterSpawn=1) then clearing (resetActorStateForBoard/2226)) One-shot arm flag for the arrow/formation launch; set when preconditions hold, cleared at init and when object spent */
export const LAUNCH_ARMED_FLAG = 0x8f3f;
/** [seen] (attract+play: low byte cycles many pointer values (232/265 trans) = paintDisplayListRunToVram write pointer advancing then stored back) Destination pointer for the display-list interpreter, paired with source 0x8f45; advanced during the copy */
export const DISPLAY_LIST_DST_PTR = 0x8f43;
/** [seen] (attract+play: low byte sweeps 0..255 (44/69 distinct) = paintDisplayListRunToVram read pointer advancing through layout data then stored back) Source/layout read pointer for the display-list interpreter, paired with dest 0x8f43; advanced during the copy */
export const DISPLAY_LIST_SRC_PTR = 0x8f45;
/** [seen] (MAME target-group capture: 0->5 at f1090 when block-C fans out (0x880a 3->0x0f), value 5 = round-2 clamp 5..8, recycles per stage; written only when 0x8907 bit1 set; spawnEnemyWave seeds) Targets in the current group; scaled x5 into HUD 0x8634 and 3x compared to hit tally 0x8f52 for end-level bonus */
export const TARGET_GROUP_COUNT = 0x8f47;
/** [seen] (attract+play: low byte steps +2 across 0x26..0x30 then resets = checksum-ptr walk (advanceAttractSequenceToPlay/6df9 r/w 16-bit); 0x8f51 intro machine idle so delay-timer use unobserved) Dual-use: intro-phase delay timer (0x40/0x60/0x80, counts down) & anti-tamper column-checksum pointer */
export const INTRO_DELAY_CKSUM_WORD = 0x8f48;
/** [seen] (MAME formation capture: toggles 0<->1, 50 transitions from f1157, in lockstep with the launch path; the 0x40-countdown sub-role is [code], not distinctly observed; loc_6e86/6db8 script ptr) Dual-use: 0xff-terminated object launch/dive-script pointer & 8-bit countdown firing at 0x40 in the launch path */
export const LAUNCH_SCRIPT_PTR = 0x8f4a;
/** [code] (static 0 across BOTH goldens (incl. attract) -> refutes A attract-flag; only writes set 1 (reseedSpawnCountersAndArmPlayMode) & 2 (loc_1d6e) -> refutes B P1/P2 index; a mode/state latch) Multi-valued play-state latch (0/1/2): set by gameplay handler / post-countdown; gates alternate update paths + table select */
export const PLAY_MODE_LATCH = 0x8f50;
/** [code] (static 0 in BOTH goldens (intro machine idle at capture) -- role code-confident: dispatchLevelIntroPhase rst-0x28 dispatch, handlers advance it) Level-intro phase selector (0..6); dispatched through the 0x6daa jump table, advanced by each phase handler */
export const INTRO_PHASE_INDEX = 0x8f51;
/** [code] (static 0 in BOTH goldens -- role code-confident: loc_6435 inc per hit, loc_6edb/6f42 consume for bonus, resetBoardRamAndReseedSpawnCounters/705f clear) Running tally of target hits; bumped per collision, compared vs group count 0x8f47 for end-level bonus, cleared on reset */
export const HIT_TALLY = 0x8f52;
/** [seen] (attract+play: toggles 0<->96 (0x60) exactly matching the >=0x60 latch threshold in advanceEagleApproachAndPaintGridMarker = captures/clears the enemy X) Latched enemy screen-X; captured when the enemy X>=0x60, drives its animation-flag bits, cleared at phase reset */
export const LATCHED_ENEMY_X = 0x8f5b;
/** [code] (static 0 in BOTH goldens (band-build path not sampled) -- role code-confident: loc_343e/3473 gate+set=1, resetBoardRamAndReseedSpawnCounters/25a6 clear) One-shot latch: interior/rope sprite band has been built; gates re-setup, cleared on board reset and at rope terminal */
export const ANIM_ARMED_LATCH = 0x8f63;

// == Batch-2 decompile cells (role from the frozen oracle; [code] -- MAME-grounding pending) ==
/** [seen] (MAME 2P golden: buffer accumulates during P1's turn only -- mid byte 0x88a3 0->0x14 while ACTIVE_PLAYER=0, frozen after the swap; base 0x88a2 low BCD pair stays 0 (scores x100) so grounded at BUFFER level; loc_04f2 selects this vs P2_SCORE_BCD off ACTIVE_PLAYER) player-1 live 3-byte BCD score buffer (0x88a2..0x88a4) */
export const P1_SCORE_BCD = 0x88a2;
/** [seen] (MAME 2P golden: buffer accumulates during P2's turn only -- mid byte 0x88a6 0->0x78 while ACTIVE_PLAYER=1, frozen otherwise; base 0x88a5 low BCD pair stays 0 (scores x100) so grounded at BUFFER level; loc_04f2 P2 bank) player-2 live 3-byte BCD score buffer (0x88a5..0x88a7) */
export const P2_SCORE_BCD = 0x88a5;
/** [code] (loc_585b sets 1 on a checksum mismatch; MULTIPLEXED -- advancePlayStateToPhase7OnActorDelay writes 0x07 as a state index, accrueCreditFromCoin1Pulse reads it as a coord low byte by COINAGE_CONFIG) eagle-spawn ROM-checksum mismatch flag */
export const TAMPER_ROM_CHECK_FLAG = 0x882b;
/** [code] (loc_0460 paints PANEL_VRAM_DEST from here) 30-byte status-panel tile source table (10 rows x 3 cells), work RAM */
export const PANEL_TILE_SOURCE = 0x8e00;
/** [seen] (MAME gameplay golden: status-panel tiles painted here in play; loc_0460 destination) VRAM base of the status panel painted from PANEL_TILE_SOURCE */
export const PANEL_VRAM_DEST = 0x8567;
/** [code] VRAM tile for the high BCD digit of the on-screen wave-arrival count (low digit at -0x20 = 0x861b) */
export const WAVE_COUNT_HUD_HI = 0x863b;
/** [seen] (MAME gameplay golden: holds 0xb0 filled / 0x10 blank as the gauge fills; loc_03c2/loc_2065 draw upward, stride -0x20) bottom cell of the 5-cell vertical phase-gauge HUD */
export const PHASE_GAUGE_BASE_TILE = 0x863f;
/** [seen] (MAME gameplay golden: holds the stage-digit tile, observed 2/1/0; loc_34c9 draws the 2-cell stage number, tens at +0x20) units tile of the stage-countdown HUD number */
export const HUD_STAGE_DIGIT_LO = 0x8743;
/** [code] (loc_3fe9 state-10 integrity guard bumps it on a checksum bit-pattern failure; adjacent TAMPER_STRIKES_SIG) anti-tamper strike counter for the state-10 ROM checksum */
export const TAMPER_STRIKES_STATE10 = 0x8a39;
/** [code] (loc_208c sets 1 on a signature mismatch) work-RAM ROM-signature mismatch flag */
export const SIGNATURE_MISMATCH_FLAG = 0x8ef0;
/** [seen] (MAME gameplay golden: increments +1 per frame in play; loc_2405 advance/even, loc_23ec retreat, bit0 gates which pass runs on TILE_ANIM_CURSOR) per-frame tile-animation parity counter */
export const TILE_ANIM_PARITY = 0x8f37;
/** [seen] (MAME write-trace: distinct sound-command bytes latched here in play, e.g. 0x01/0x04/0x09/0x15; loc_0e8f writes the command byte for the audio CPU) sound-command latch to the audio CPU */
export const SOUND_COMMAND_LATCH = 0xa100;
/** [seen] (MAME write-trace: a clean b1 high/low pulse per sound command; loc_0e8f pulses b1 high, 6x nop, low after a command) audio-IRQ strobe latch (mainlatch b1) */
export const AUDIO_IRQ_LATCH = 0xa181;
/** [seen] (MAME read-tap: read by loc_208c at pc=2095 in attract; loc_208c samples every 8th byte from here) ROM base of the sampled code region for the signature guard */
export const SIGNATURE_SAMPLE_BASE = 0x066d;
/** [seen] (MAME read-tap: read by loc_208c at pc=2094, paired 1:1 with the sample; loc_208c compares the sample against this) 16-byte expected-signature reference table in ROM */
export const SIGNATURE_REFERENCE_TABLE = 0x20aa;
/** [code] (loc_3fe9 sums the 16-byte block descending from here) top of the ROM block checked by the state-10 integrity guard */
export const ROM_CHECKSUM_TOP = 0x7780;
/** [seen] (MAME read-tap: read by loc_0644 at pc=064A once per attract cycle; the byte here = 0xc8 = the header loc_0644 asserts; bytes0..3 summed, (sum-carry) must equal 0x59) ROM base of the 4-byte high-score-table checksum block */
export const HISCORE_CHECKSUM_BASE = 0x778a;
/** [code] (loc_0644 sets 1 on a bad header or wrong checksum) work-RAM high-score-table corruption flag */
export const HISCORE_TABLE_CORRUPT_FLAG = 0x8df8;
/** [seen] (MAME gameplay golden: attribute codes flooded here in play, observed 0x10/0x1d/0x0d; loc_075d floods 31 columns x 30 rows, stride 0x20 from here) base of the tile-attribute/colour map on the 0x8000 video page */
export const ATTRIB_MAP_BASE = 0x8040;
/** [seen] ROM base of the boot code; self-test loop 1 checks its first eight bytes against the reference copy at 0x749a */
export const BOOT_CODE_BASE = 0x0000;
/** [seen] ROM base where self-test loop 2 walks the checked program window (through ROM[0x0105]) against the reference copy at 0x74a2 */
export const SELFTEST_LOOP2_SCAN_BASE = 0x0092;
/** [code] display-command word base (type 0x03) enqueued on the (ix+0x11) countdown expiry; its low byte 0x12 is offset by the adjusted (ix+0x16) before enqueue */
export const COUNTDOWN_EXPIRE_DISPLAY_CMD = 0x0312;
/** [code] display-command word (0x06:0x00) enqueued via loc_0038 by the 0x15a8-dispatch state handlers loc_1b43/loc_1b8c */
export const DISPLAY_CMD_0600 = 0x0600;
/** [code] display-command word (0x06:0x02) enqueued via loc_0038 by loc_1b43 */
export const DISPLAY_CMD_0602 = 0x0602;
/** [code] display-command word (0x06:0x03) enqueued via loc_0038 by loc_1b8c */
export const DISPLAY_CMD_0603 = 0x0603;
/** [seen] ROM colour/attribute column source table (bytes from 0x0819) flooded into the attribute map by fillAttributeColumns from the 0x15a8-dispatch handlers loc_1b43/loc_1b8c */
export const FIELD_ATTRIB_SRC_0819 = 0x0819;
/** [seen] ROM 0xff-terminated tile/message table copied into DISPLAY_MSG_BUF at round init */
export const ROUND_INIT_MSG_TABLE = 0x16ae;
/** [seen] ROM source string copied (each byte +8 tile bias) into DISPLAY_MSG_BUF by copyBiasedTileString from loc_1b43 */
export const BIASED_TILE_STRING_1FF2 = 0x1ff2;
/** [code] ROM address of the loc_3278 routine, read as data by loc_30f1's anti-tamper guard which byte-compares its body (after a 2-byte 0x68ac pointer header) against the loc_68ac original */
export const TAMPER_COPY_3278 = 0x3278;
/** [code] ROM 4-byte-per-slot parameter table seeding the four formation-slot records (fields +4/+6/+0x0f/+0x10) at hunter-formation launch (loc_30f1) */
export const HUNTER_LAUNCH_PARAM_TABLE = 0x3337;
/** [code] ROM base of the hunter dive-movement script, armed into HUNTER_SCRIPT_PTR when the hunter crosses the player */
export const DIVE_SCRIPT_DATA = 0x3348;
/** [code] ROM base of the hunter-formation script table seated into HUNTER_SCRIPT_PTR by loc_30f1 */
export const HUNTER_SCRIPT_TABLE = 0x3370;
/** [code] rst-0x20 byte table indexed by the bumped spawn-phase snapshot; supplies the new turn-column limit written to TURN_COLUMN_LIMIT on the interior-band arm */
export const ANIM_TABLE_3418 = 0x3418;
/** [seen] (MAME: spawnObjectIntoFreeSlot loads ld hl,0x3988 then pc=0x36c6 writes 0x88 -> (ix+0x0c) and pc=0x36c9 writes 0x39 -> (ix+0x0d), n=11 each on records 0x8aec/0x8b04/0x8b1c - exactly the documented 'seeded into a…) ROM animation-sequence descriptor pointer seeded into a spawner/parent actor record (+0x0c/+0x0d) */
export const ANIM_SEQ_3988 = 0x3988;
/** [seen] attract display-list ALT source-pointer seed stored into DISPLAY_LIST_SRC_PTR_ALT (0x88ba) at self-test state 0 */
export const ATTRACT_LIST_SRC_ALT_SEED = 0x43e1;
/** [seen] attract display-list source-pointer seed stored into DISPLAY_LIST_SRC_PTR (0x8f45) at self-test state 0 */
export const ATTRACT_LIST_SRC_SEED = 0x4af0;
/** [seen] base of a 34-byte ROM block folded (&0x37, rrca, adc a,c) into loc_1b43's anti-tamper checksum; a result != 0x7c bumps TAMPER_FREEZE_FLAG */
export const TAMPER_CKSUM_BASE_5593 = 0x5593;
/** [code] ROM 3-byte tile-code source row copied into the 0x8c78 record + its two mirror banks by the shrink render (copyDisplayTilesIntoActorRecords) when the phase toggle bit0 is clear */
export const TILE_SRC_ROW_66BF = 0x66bf;
/** [seen] ROM 3-byte tile-code source row copied into the 0x8c78 record + its two mirror banks by the shrink render (copyDisplayTilesIntoActorRecords) when the phase toggle bit0 is set */
export const TILE_SRC_ROW_66C2 = 0x66c2;
/** [seen] ROM reference copy of the boot bytes; self-test loop 1 compares it against ROM[0x0000..0x0007] and loop 2 continues into it from 0x74a2 (verified verbatim copies of the checked code) */
export const SELFTEST_REF_COPY_BOOT = 0x749a;
/** [seen] attract display-list dest-pointer seed (colour-map cell) stored into DISPLAY_LIST_DST_PTR (0x8f43) at self-test state 0 */
export const ATTRACT_LIST_DST_SEED = 0x8042;
/** [code] video-RAM base of the 3x3 tile block blanked (blank tile 0x10) by loc_30f1 at hunter-formation launch */
export const FORMATION_LAUNCH_VRAM_CLEAR = 0x84c2;
/** [code] video-RAM base of the 2x2 interior sprite band stamped on the anim-arm path (tiles 0xd8/0xd9 at +0/+1, 0xda/0xdb one row down at +0x20/+0x21) */
export const SPRITE_BAND_86E3 = 0x86e3;
export const loc_890a = 0x890a;
/** [seen] toggle byte incremented when the flip countdown (0x892f) expires; bit0 selects the grow (even) vs shrink (odd) animation half and the render tile-source row */
export const ANIM_PHASE_TOGGLE_892C = 0x892c;
/** [code] base of the collision-flash cell pair (interrupt-register parity selects base or +1, i.e. 0x8d19/0x8d1a); set to 1 on a proximity hit */
export const FLASH_CELL_BASE = 0x8d19;
/** [seen] periodic-event countdown; on expiry reloads (0x20), sets the wave-event latch and fires the siren-tile run (per the existing wave-event-latch note) */
export const PERIODIC_EVENT_TIMER = 0x8d22;
export const loc_8d23 = 0x8d23;
/** [code] busy/mode latch for the periodic siren driver: nonzero disables the whole routine; the >5 spawn-phase value is latched here */
export const PERIODIC_MODE_LATCH = 0x8d55;
/** [seen] spawn ring counter: read+incremented per object-arm by the object cluster's state-0 handler (0x771d); cleared to 0 by the state-1 animation-tick handler on the phase-transition reseed */
export const SPAWN_RING_COUNTER = 0x8d57;
/** [seen] per-object "drawn" flag: set to 1 once an object is drawn (object cluster's state-2 handler 0x7790); the state-2 animation tick holds while it is set */
export const OBJECT_DRAWN_FLAG = 0x8d58;
export const loc_8e21 = 0x8e21;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8565 = 0x8565;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8811 = 0x8811;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8812 = 0x8812;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8dfd = 0x8dfd;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8e23 = 0x8e23;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8e24 = 0x8e24;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8e25 = 0x8e25;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8e26 = 0x8e26;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8e27 = 0x8e27;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8e29 = 0x8e29;
/** [code] write-anim work cell (0x7e94 dispatch cluster) — role pending grounding */
export const loc_8e2b = 0x8e2b;
export const loc_8f17 = 0x8f17;
/** [code] 16-bit read-pointer into the lead hunter's active movement script (swoop; repointed to the dive script when the dive arms) */
export const HUNTER_SCRIPT_PTR = 0x8f4b;
/** [code] ROM byte table mapping a DSW0 coinage nibble to a coinage-config value (rst-0x20 lookup base) */
export const COINAGE_TABLE = 0x0053;
/** [seen] 24-byte table of the eight program-memory banks' 3-byte (low/mid/high) 24-bit checksums; verified: all 8 match the built ROM */
export const ROM_SELFTEST_CHECKSUM_TABLE = 0x0079;
/** [code] highest address of the 0x12-byte program-memory window summed by the state-0 integrity check (the sum walks downward from here; expected running sum 0x55) */
export const STATE0_CKSUM_BASE = 0x01d5;
/** [code] display-command WORD (not a RAM cell) enqueued at attract state-0 completion */
export const ATTRACT_SETUP_DISPLAY_CMD_B = 0x0500;
/** [code] display-command WORD (not a RAM cell) enqueued at attract state-0 completion */
export const ATTRACT_SETUP_DISPLAY_CMD_C = 0x0502;
/** [code] display-command WORD (not a RAM cell) enqueued at attract state-0 completion */
export const ATTRACT_SETUP_DISPLAY_CMD_A = 0x0604;
/** [code] display-command word (0x06:0x0b) enqueued via loc_0038 by attract sub-state 1 (loc_08e9), immediately after the 0x0611 (OBJECT_SPAWN_DISPLAY_CMD) command */
export const ATTRACT_DISPLAY_CMD_060B = 0x060b;
/** [code] display-command word queued (rst 0x38 -> loc_0038) on the phase-4 anti-tamper match */
export const DISPLAY_CMD_0627 = 0x0627;
/** [code] display-command word queued (rst 0x38 -> loc_0038) on the first spawn of a wave (paired with _B) */
export const WAVE_SPAWN_DISPLAY_CMD_A = 0x0625;
/** [code] second display-command word queued (rst 0x38 -> loc_0038) on the first spawn of a wave (paired with _A) */
export const WAVE_SPAWN_DISPLAY_CMD_B = 0x060a;
/** [code] display-command word (type 0x06) queued via the display-ring helper on deferred-object fire (1 of 5, 0x062b..0x062f) */
export const PROMOTE_DISPLAY_CMD_A = 0x062b;
/** [code] display-command word queued on deferred-object fire (2 of 5) */
export const PROMOTE_DISPLAY_CMD_B = 0x062c;
/** [code] display-command word queued on deferred-object fire (3 of 5) */
export const PROMOTE_DISPLAY_CMD_C = 0x062d;
/** [code] display-command word queued on deferred-object fire (4 of 5) */
export const PROMOTE_DISPLAY_CMD_D = 0x062e;
/** [code] display-command word queued on deferred-object fire (5 of 5) */
export const PROMOTE_DISPLAY_CMD_E = 0x062f;
/** [code] display-command word queued (via rst 0x38) by intro phase 5 when the toggle's new bit0 is 0 */
export const INTRO_PHASE5_DISPLAY_CMD_A = 0x06a7;
/** [seen] ROM colour/attribute column source table flooded into the attribute map at attract state-0 completion (fillAttributeColumns source) */
export const ATTRACT_FIELD_ATTRIB_SRC = 0x0779;
/** [seen] ROM block (0x0831..0x0839, 9 bytes) anti-tamper checksummed by attract sub-state 1 (loc_08e9); valid-image low-byte sum sentinel 0xaa (verified against maincpu.bin) */
export const ATTRACT_INTEGRITY_CKSUM_BASE = 0x0831;
/** [seen] ROM base of the 12-byte (6-word) attract-script word table 0x0b26-0x0b31 (per typeAttractTextColumn's note), seeded as the start of the dual-use 0x8f48 attract cursor that advanceAttractSequenceToPlay walks */
export const ATTRACT_SCRIPT_TABLE_BASE = 0x0b26;
/** [code] 8-byte inline ROM speed-magnitude table indexed (via the rst-0x20 lookup) by the clamped SPEED_INDEX */
export const ENEMY_SPEED_TABLE = 0x148e;
/** [seen] ROM alternate 4-byte 2x2 tile source for the launch blit (spawnEnemyTargetOrAnimateLaunchFlipTile uses this or LAUNCH_TILE_SRC per flip parity; names.js already references 0x2d55 in a comment but exports no name for it) */
export const LAUNCH_TILE_SRC_ALT = 0x2d55;
/** [seen] ROM 4-byte 2x2 tile source blitted (via 0x3325) as the rope segment tile */
export const ROPE_SEGMENT_TILE_SRC = 0x2dfe;
/** [code] ROM 4-byte 2x2 tile source block blitted for a rope-cell segment (blit2x2TileBlock source) */
export const ROPE_SEGMENT_TILE_SRC_ALT = 0x2e1e;
/** [code] ROM 4-byte table indexed by IXL&3 (via rst 0x20) supplying the spawned slot's +4 field value */
export const ROPE_SPAWN_IY4_TABLE = 0x2ec7;
/** [code] animation-sequence table (turn-around variant, sibling of ANIM_TABLE_3829) armed into an actor record when its flag byte (ix+7) bit1 is set */
export const ANIM_TABLE_3847 = 0x3847;
/** [code] ROM animation-sequence descriptor seeded little-endian into a spawned child actor's +0x0c/+0x0d anim field */
export const ANIM_SEQ_38CB = 0x38cb;
/** [code] ROM original bytes (0x44) compared by the level-intro phase-4 anti-tamper self-check */
export const PHASE4_TAMPER_ORIG = 0x6ac5;
/** [code] ROM data copy of the phase-4 tamper block, compared byte-for-byte against PHASE4_TAMPER_ORIG */
export const PHASE4_TAMPER_COPY = 0x6fed;
/** [code] base of the colour/attribute map (0x8000-0x83ff) */
export const COLOR_RAM_BASE = 0x8000;
/** [seen] video-RAM base of the first 14-tile column strip (colour region) column-summed upward (stride -0x20) by runDisplayListAndAdvanceToGameplay's state-1 HUD integrity check */
export const HUD_INTEGRITY_STRIP_A = 0x82bc;
/** [code] base of the tile-code video RAM (0x8400-0x87ff); also the row-by-row tile-fill cursor origin seeded here */
export const VIDEO_RAM_BASE = 0x8400;
/** [seen] video-RAM start cell of the screen re-init playfield tile paint (0x1d x 0x1d tiles of blank tile 0x10, +0x20 per row) */
export const PLAYFIELD_PAINT_START = 0x8442;
/** [code] video-RAM digit-column base for loc_10c2's first 2-digit BCD field */
export const SUBSTATE_FIELD1_VRAM = 0x85d0;
/** [code] video-RAM digit-column base for loc_10c2's third 2-digit BCD field */
export const SUBSTATE_FIELD3_VRAM = 0x85d2;
/** [code] video-RAM cell for the hundreds digit of loc_10c2's third field (written only when the hundreds count is nonzero) */
export const SUBSTATE_FIELD3_HUNDREDS_VRAM = 0x85f2;
/** [code] video-RAM digit-column base for loc_10c2's second 2-digit BCD field */
export const SUBSTATE_FIELD2_VRAM = 0x8652;
/** [code] video-RAM base of the second 14-tile column strip (tile region) column-summed upward (stride -0x20) by runDisplayListAndAdvanceToGameplay's HUD integrity check; combined intact total 0x014f */
export const HUD_INTEGRITY_STRIP_B = 0x86bc;
/** [seen] cabinet/cocktail flag (DSW1 bit2 complemented, boot-decoded); read by round-init (loc_1601) as a boolean to gate cocktail/flip handling */
export const CABINET_MODE_FLAG = 0x880f;
/** [seen] coin-slot-2 coinage nibble, from the DSW0 high nibble via the coinage table; 0x0f = free play; read by serviceCoinCreditAndCountersUnlessFreePlay (sibling of COINAGE_CONFIG 0x882c) */
export const COINAGE_CONFIG_SLOT2 = 0x882f;
/** [seen] read/dispatch cursor into the display-command ring (walks 0xc0..0xff, indexes page 0x88); read+advanced by loc_020f / mainLoopStep (paired with write ptr 0x88a0) */
export const DISPLAY_CMD_RING_READ_PTR = 0x88a1;
/** [seen] base of the display-command ring buffer (0x88c0-0x88ff, 32 two-byte slots); boot fills 0xff (empty); read via computed page-0x88 addressing by the main loop */
export const DISPLAY_CMD_RING_BUFFER = 0x88c0;
/** [seen] pending bonus-award queue value (BCD threshold): 0 reloads the slot (5/3 per BONUS_AWARD_DSW), else gated vs the active player's score MSB then BCD-stepped (8/7) */
export const AWARD_QUEUE = 0x8909;
/** [seen] attract/self-test state selector (masked &3) dispatched by loc_7442 to handlers 0x744e/0x7517/0x755d; runDisplayListAndAdvanceToGameplay is state 1 and advances it to state 2 */
export const SELFTEST_DISPATCH_STATE = 0x8921;
/** [code] base of the 9-byte per-frame timer/flag block (0x8928..0x8930) cleared at screen re-init (byte before SHARED_FRAME_DELAY_TIMER=0x8929) */
export const FRAME_TIMER_BLOCK_BASE = 0x8928;
/** [code] anti-tamper strike counter (last slot of the 7-flag integrity table at INTEGRITY_FLAG_SCAN_BASE=0x89e7) bumped when the state-0 code-window checksum misses its 0x55 running-sum sentinel */
export const TAMPER_STRIKES_STATE0 = 0x89ed;
export const loc_8a42 = 0x8a42;
/** [seen] base of the sound-command ring buffer (slots 0x8a43-0x8a5e); boot fills 0xff (empty); confirmed by enqueueSoundCommandRing */
export const SOUND_RING_BUFFER = 0x8a43;
export const loc_8a86 = 0x8a86;
export const loc_8a9e = 0x8a9e;
export const loc_8aa7 = 0x8aa7;
/** [code] countdown gating the deferred-object promotion: 0 idles, >1 decrements, ==1 fires; reseeded to 0xff on fire */
export const PENDING_OBJECT_COUNTDOWN = 0x8d5e;
/** [code] deferred-object promotion busy/state latch; must be 0 to run, armed to 0x11 (matching the play-state) on fire */
export const PENDING_OBJECT_STATE = 0x8d5f;
export const loc_8d76 = 0x8d76;
/** [seen] (MAME: 0x3be3 (state-0 handler) reads 0x8d7e as a guard (pc 3c54: read, ret if nonzero) then re-arms it to 0x02 at pc=3c6f after running the reset -- matches the doc's read-guard + re-arm-to-2 rol…) one-shot guard for the state-0 lane reset: nonzero blocks re-running the reset; re-armed to 2 by the reset itself and cleared elsewhere (armEnemySpawnScript) */
export const LANE_RESET_LATCH = 0x8d7e;
/** [code] base of the promoted-object list built on fire (3 bytes/entry: record pointer low/high + the saved (rec+6) field) */
export const PROMOTED_OBJECT_LIST = 0x8d80;
/** [code] anti-tamper strike counter bumped by the terminator match-scan guard (loc_64be); nonzero diverts handlers to the board/reset path */
export const TAMPER_STRIKES_TERMINATOR = 0x8df9;
/** [code] level-intro phase-5 toggle byte incremented each 16-frame boundary; its new bit0 selects which display command is queued */
export const INTRO_PHASE5_TOGGLE = 0x8f54;
/** [code] main-loop sub-state selector (&7), dispatched by loc_0fd5 via the inline table at 0x0fe3; loc_10c2 bumps it to advance the phase */
export const MAINLOOP_SUBSTATE_SELECTOR = 0x8f5c;
/** [code] source value for loc_10c2's second BCD HUD field (drawn raw when <10, else re-encoded to packed BCD) */
export const SUBSTATE_FIELD2_VALUE = 0x8f5e;
/** [code] presence/source value for loc_10c2's third BCD HUD field: nonzero enables the field (drawn x2) and is folded into the field-1 counter */
export const SUBSTATE_FIELD3_VALUE = 0x8f60;
/** [code] counter adjusted by loc_10c2 and drawn x2 as its first BCD HUD field; the third-field source is added into it when present */
export const SUBSTATE_FIELD1_COUNTER = 0x8f62;
/** [seen] ROM self-test pass tally; seeded to the bank count (8) and bumped once per matching bank, == 0x10 on a full pass; loc_072d requires 0x10 to finish setup. NOTE: physically the top of the boot's own stack and inside STACK_SCRATCH */
export const ROM_SELFTEST_TALLY = 0x8fff;
/** [code] DIP-switch bank 1 hardware read port (the write side of this address is the watchdog) */
export const DSW1_PORT = 0xa000;
/** [code] DIP-switch bank 0 hardware read port */
export const DSW0_PORT = 0xa0e0;
/** [seen] LS259 latch bit 0: vblank-NMI enable (boot writes 1) */
export const NMI_ENABLE_LATCH = 0xa180;
/** [code] LS259 latch bit 7: flip-screen latch (boot writes 1 = upright) */
export const FLIP_SCREEN_LATCH = 0xa187;
/** [code] display-command WORD (not a RAM cell) enqueued via loc_0038 on hunter spawn */
export const HUNTER_SPAWN_DISPLAY_CMD = 0x0315;
/** [code] ROM table of 3-byte BCD score-award increments (stride 3), indexed by the award index (index!=0 path) */
export const SCORE_AWARD_TABLE = 0x0501;
/** [code] alternate display-list command word (0x06:0x07) enqueued on object init when the round counter is zero */
export const OBJECT_SPAWN_DISPLAY_CMD_ALT = 0x0607;
/** [code] display-command WORD (not a RAM cell) enqueued via loc_0038 for siren phase A */
export const SIREN_DISPLAY_CMD_A = 0x060f;
/** [code] display-list command word (0x06:0x11) enqueued via the page-0x88 ring on object spawn/init (also used by loc_08e9) */
export const OBJECT_SPAWN_DISPLAY_CMD = 0x0611;
/** [code] base display-command code queued when an eagle wave fully arrives, offset by the arrived count */
export const WAVE_ARRIVAL_CMD_BASE = 0x0630;
/** [code] display-command WORD (not a RAM cell) enqueued via loc_0038 for siren phase B */
export const SIREN_DISPLAY_CMD_B = 0x068f;
/** [seen] ROM base of the 23-byte block rolling-summed downward by the slot-sweep checksum (the block is code inside another routine, read as data) */
export const SLOT_SWEEP_CKSUM_BASE = 0x0bf3;
/** [seen] base of a code region read as data for this handler's entry integrity checksum (0x5b bytes summed, followed by its 4 guard bytes) */
export const INTEGRITY_CHECKSUM_CODE_BLOCK = 0x2901;
/** [seen] ROM 4-byte table: rope-cell index (IXL&3) -> video-RAM column low byte (paired with page 0x84 to form the column base) */
export const ROPE_CELL_COLUMN_TABLE = 0x2db8;
/** [code] ROM byte table indexed by the adjusted attribute value; OR-ed into an actor attribute byte (+0x08) */
export const ACTOR_ATTR_MERGE_TABLE = 0x3727;
/** [code] ROM byte table indexed by 2*DIFFICULTY_DSW + clamped ROUND_COUNTER; supplies the base value for an actor attribute byte (+0x08) */
export const ACTOR_ATTR_BASE_TABLE = 0x3737;
/** [seen] ROM 4-frame animation table (sibling of ANIM_TABLE_3829) armed into the descending object's record by the descent step */
export const ANIM_TABLE_3838 = 0x3838;
/** [code] animation-sequence pointer armed into even eagle records (IXL bit3 clear) */
export const EAGLE_EVEN_RECORD_ANIM = 0x4086;
/** [code] ROM animation-sequence descriptor armed via setActorAnimation when a spawned object lands/settles (also installed by the rope-grab path) */
export const LANDING_ANIM_SEQ_40B4 = 0x40b4;
/** [code] top of the ROM block advanceActorStateOnTimerWithTamperCheck sums backward (to the 0x1a terminator) for its tamper check; a ROM address, not a RAM cell */
export const ACTOR_TAMPER_CKSUM_TOP = 0x4282;
/** [code] ROM byte table indexed by the clamped spawn speed index; result stored at 0x8d5d */
export const SPAWN_SPEED_TABLE = 0x5407;
/** [code] fixed 56-byte block whose folded low-nibble sum is the object-frame anti-tamper sentinel (running low byte 0x67 with exactly one carry) */
export const TAMPER_NIBBLE_SUM_BLOCK = 0x557f;
/** [seen] ROM byte table; the spawn reads entry [1] into the formation record's +0x09 field (its two's-complement negation into +0x0a) */
export const SPAWN_FIELD_TABLE = 0x5902;
/** [code] top of the 31-byte program block summed downward by the credit-draw anti-tamper tripwire (clean-image sum sentinel 0x8c) */
export const HUD_GUARD_CKSUM_TOP = 0x64c8;
/** [code] code base whose bytes loc_79e9 sums (forward to the terminating ret) as an integrity self-check */
export const SELFCHECK_ROUTINE_BASE_ADDR = 0x68ac;
/** [code] animation-sequence pointer armed into odd eagle records (IXL bit3 set) */
export const EAGLE_ODD_RECORD_ANIM = 0x7403;
/** [code] 2 guard bytes (0x7a0b/0x7a0c) the tail integrity checksum's 16-bit sum is verified against */
export const TAIL_CHECKSUM_GUARD = 0x7a0b;
/** [seen] start of the boot-blanked video-RAM tile region (video base 0x8400 + 0x40); 0x3c0 tiles through 0x87ff set to erase tile 0x1e */
export const VIDEO_RAM_BLANK_START = 0x8440;
/** [seen] video-RAM column base where the 10-entry high-score table is drawn (stacked BCD nibble tiles) */
export const HIGH_SCORE_TABLE_VRAM = 0x85c7;
/** [seen] video-RAM base cell of the play-timer digit column; minutes/seconds nibble tiles are written here and up the column (stride -0x20) */
export const PLAY_TIMER_DIGIT_VRAM = 0x862d;
/** [seen] video-RAM units-digit tile cell of the 2-digit credit HUD counter */
export const CREDIT_HUD_UNITS_VRAM = 0x869f;
/** [code] video-RAM tens-digit tile cell of the 2-digit credit HUD counter (written only when the tens nibble is nonzero) */
export const CREDIT_HUD_TENS_VRAM = 0x86bf;
/** [seen] (MAME: blanked 10->10 n=4683 as the top of the 0x8700/0x8720/0x8740 scroll column (0x8700/0x8720 receive body tiles 0x20/0x25 from loc_02aa); the blank-to-0x10 matches WORKER_COLUMN_VRAM's 'conditionally blanks' role) video-RAM base of the second 3-tile scroll column the per-frame worker stamps (via loc_02a8) and conditionally blanks, stride one tilemap row up */
export const WORKER_COLUMN_VRAM = 0x8740;
/** [seen] video-RAM base (bottom origin) of the eagle grid-marker cell region; row (up) and column (right) offsets index from here */
export const EAGLE_GRID_VRAM_BASE = 0x87e0;
/** [seen] cabinet lives-count byte (from the lives DSW), seeded into both players' lives at board reset */
export const LIVES_DSW = 0x8807;
/** [seen] per-frame worker control byte (one below SPRITE_DISPLAY_LIST): low nibble != 0 gates the program-signature check, bit 4 gates the final scroll-column blank */
export const WORKER_CONTROL_BYTE = 0x883f;
/** [code] 3-byte BCD per-frame score increment added to the active player's score when the award index is 0 */
export const PER_FRAME_SCORE_INCREMENT = 0x88ab;
/** [seen] shared per-frame delay/timer counter; decremented while nonzero to gate several object-update sweeps (ascendEnemyActorAndLinkedSlotOnTimer/6905/756d/6523), reseeded by their handlers */
export const SHARED_FRAME_DELAY_TIMER = 0x8929;
/** [code] top of the per-entry play-time side table (3-byte stride) shifted alongside the high-score table on insert; the new entry's two play-timer BCD bytes are stored into the opened slot */
export const HIGH_SCORE_TIME_TABLE = 0x89e0;
export const loc_89e3 = 0x89e3;
/** [code] base of a 7-byte flag block scanned after the timer render; the first nonzero flag diverts to the tail integrity checksum */
export const INTEGRITY_FLAG_SCAN_BASE = 0x89e7;
/** [code] anti-tamper strike counter bumped when the slot-sweep code-block checksum misses its sentinel; also read by the eagle-spawn handler */
export const TAMPER_STRIKES_SLOTSWEEP = 0x89e8;
/** [code] high-score insert rank+1: set to the winning rank plus one when a new score is inserted */
export const HIGH_SCORE_INSERT_RANK = 0x89fc;
/** [code] anti-tamper strike counter bumped when the credit-draw checksum tripwire misses its 0x8c sentinel */
export const TAMPER_STRIKES_HUD_GUARD = 0x8a3c;
export const loc_8a99 = 0x8a99;
/** [code] base page of the per-slot hunter-return paced counters; a slot's counter cell is this | ((field-0 + 5) & 0xff) */
export const HUNTER_COUNTER_PAGE = 0x8c00;
/** [seen] (SHARED actor table — the 0x65xx path also seeds it; kept code; observed MAME: spawnHunterIntoTableAndAdvanceLaunch seeds fields 0x8c79..0x8c88 (pc 2872-2892) and stores base ptr 0x8c78 to 0x8f32/0x8f33; only slot 0 exercised in capture, so the 6-slot / 0x18-stride / downward-scan structure rema…) base of the 6-slot hunter record table (0x18 stride, scanned DOWNWARD) seeded by launch state 2 */
export const HUNTER_TABLE_BASE = 0x8c78;
/** [seen] (SHARED actor-record coord — eagle species (read by advanceEagleToArrivalAndTallyWave) not write-confirmed; kept code; observed MAME: advanceTargetActorState writes 0x8c94 at pc=0x2218 n=356, 0x5b->0xea (launch-phase Y+=4). Same cell seeded by spawnTargetActorOnLaunchTrigger (pc=0x218d) and velocity-integrated by advanceTargetActorAlongVelocityElseDespawn (pc=0x2264, n=1547) -- a live p…) eagle live Y coordinate; >>3 +4 is its grid row, matched within a 5-row window of the record's target row (ix+4) */
export const EAGLE_Y_COORD = 0x8c94;
/** [seen] (SHARED actor-record coord — eagle species (read by advanceEagleToArrivalAndTallyWave) not write-confirmed; kept code; observed MAME: advanceTargetActorState writes 0x8c96 at pc=0x2200 n=2101, 0xb0->0x50 (X-=4 per frame; JS despawns when < 4). Same cell seeded by spawnTargetActorOnLaunchTrigger (pc=0x2195) and velocity-integrated by advanceTargetActorAlongVelocityElseDespawn (pc=0x224e,…) eagle live X coordinate; >>3 is its grid column, matched against the record's target column (ix+6) or that minus one */
export const EAGLE_X_COORD = 0x8c96;
/** [code] one-shot spawn latch for the 0x8c30 formation record; set 1 when spawned, gates re-spawn */
export const SPAWN_LATCH = 0x8d59;
/** [code] spawn speed index = (ROUND_COUNTER>>1)+1 clamped to 6; indexes SPAWN_SPEED_TABLE */
export const SPAWN_SPEED_INDEX = 0x8d5c;
/** [code] spawn speed value looked up from SPAWN_SPEED_TABLE via SPAWN_SPEED_INDEX */
export const SPAWN_SPEED_VALUE = 0x8d5d;
/** [code] warning-siren enable gate: loc_19ca ticks only while nonzero */
export const SIREN_ENABLE_GATE = 0x8d68;
/** [code] warning-siren phase byte; bit0 selects the phase-A/B command, reset to 1/0 on toggle */
export const SIREN_PHASE_BYTE = 0x8d69;
/** [code] warning-siren frame countdown (reload 0x18); on expiry toggles the phase */
export const SIREN_FRAME_COUNTDOWN = 0x8d6a;
/** [seen] once-only latch for the gated slot-sweep checksum guard; 0 = pending, set to the free-slot count once the sweep runs */
export const SLOT_SWEEP_LATCH = 0x8d6e;
export const loc_8f0e = 0x8f0e;
export const loc_8f0f = 0x8f0f;
/** [seen] (MAME: n=4 v0=00 vN=00, set to 0 when the frame index reaches 8) rope-extend sub-state selector (0/1) dispatched by the rope state handler; this routine is its state-0 handler and advances it */
export const ROPE_EXTEND_STATE = 0x8f14;
/** [seen] (MAME: n=356 v0=0f vN=08, decremented per frame and reloaded, play-only) rope-extend sub-timer, reloaded to 0x10 when a segment is added (timer role inferred from the reload, not grounded) */
export const ROPE_EXTEND_TIMER = 0x8f16;
/** [seen] (MAME: pc 2d98 inc 01->04 (n=4); feeds the rst-0x20 column lookup at 2d9c and the 0x8f26+2*idx timer loop at 2da3) rope-extend segment index: gates the extend (below 4), indexes the video-column table and the per-segment cell timer */
export const ROPE_EXTEND_INDEX = 0x8f18;
/** [seen] (MAME: pc 2da0 writes low byte 0x8f19 (97..8a) and high byte 0x8f1a=0x84 (n=4), from the 0x2db8 column table) 16-bit video-RAM column base (page 0x84) for the current rope segment, looked up from the column table */
export const ROPE_COLUMN_VRAM_PTR = 0x8f19;
/** [seen] (MAME: pc 2892 stores 0x8c78 (low 0x78 @0x8f32, high 0x8c @0x8f33, n=17) immediately after seeding the record) work-RAM word holding the pointer to the most-recently-seeded hunter record */
export const HUNTER_RECORD_PTR = 0x8f32;
/** [seen] (MAME: pc 28a6 writes 0x20 (n=17); consumed (decremented to 0) by advanceLaunchOnDelayAndClearHunterRecord pc 28b4 (1f->00, n=544)) spawn countdown seeded 0x20 by launch state 2 on the non-flip path */
export const HUNTER_SPAWN_COUNTDOWN = 0x8f34;
/** [seen] eagle grid-advance frame tick; low 3 bits gate the every-eighth-frame grid marker step */
export const EAGLE_GRID_STEP_TICK = 0x8f3b;
/** [code] run-once latch for the playfield tilemap-sum integrity check (loc_6a7f sums once and sets 1); cleared/re-armed to 0 when the state-1 descending object reaches the bottom */
export const TILE_SUM_ONCE_LATCH = 0x8f56;
/** [code] sub-counter bumped by launch state 2 on the flip path */
export const HUNTER_SPAWN_SUBCOUNTER = 0x8f5d;
/** [code] flip flag: when set, launch state 2 bumps a sub-counter instead of enqueuing the spawn display command */
export const HUNTER_SPAWN_FLIP_FLAG = 0x8f61;
/** [seen] sprite bank 0 fill start (bank base 0x9000 + 0x10); boot clears 0x30 bytes here */
export const SPRITE0_CLEAR_BASE = 0x9010;
/** [seen] sprite bank 1 fill start (bank base 0x9400 + 0x10); boot clears 0x30 bytes here */
export const SPRITE1_CLEAR_BASE = 0x9410;
/** [code] ROM base of the 0x20-byte block summed by the hunter-formation state-2 integrity guard (valid-ROM sum sentinel 0xdc) */
export const FORMATION_GUARD_BASE = 0x0799;
/** [code] ROM colour/attribute column source table for the default field job, selected when the round counter's low bit is set */
export const FIELD_ATTRIB_SRC_A = 0x0839;
/** [seen] ROM colour/attribute column source table for the alternate field strip job */
export const FIELD_ATTRIB_SRC_C = 0x0859;
/** [code] ROM colour/attribute column source table for the default field job, selected when the round counter's low bit is clear */
export const FIELD_ATTRIB_SRC_B = 0x0879;
/** [seen] four-byte source/pattern table (in ROM) read by the 2x2 tile-block copier */
export const TILE_BLOCK_2X2_SRC = 0x0a72;
/** [code] fixed 3x3 glyph tile source selected when the selector register B's bit5 is clear */
export const GLYPH_TILES_A = 0x203b;
/** [code] fixed 3x3 glyph tile source selected when the selector register B's bit5 is set */
export const GLYPH_TILES_B = 0x2050;
/** [seen] base animation-script address reloaded into the script cursor on a control-marker full reset */
export const ANIM_SCRIPT_RESET_PTR = 0x26e7;
/** [seen] base of four 4-byte 2x2 tile source blocks (stride 4) for the two-tile animator */
export const TWOTILE_SRC_TABLE = 0x2744;
/** [code] ROM source tiles for the round-marker 3x3 glyph block (blitTile3x3Block src) */
export const MARKER_GLYPH_SRC = 0x2754;
/** [code] 4-byte 2x2 tile source block for the ready-sprite square */
export const READY_SPRITE_SRC = 0x2be1;
/** [code] ROM animation-sequence descriptor stored into a record's anim field (ix+0x0c/0x0d) by setActorAnimation */
export const RECORD_ANIM_SEQ_2CA7 = 0x2ca7;
/** [code] ROM script/table pointer seeded little-endian into a record's +0x16/+0x17 script field */
export const RECORD_SCRIPT_2D00 = 0x2d00;
/** [seen] ROM 4-byte 2x2 tile-block source blitted by the launch state machine (spawnEnemyTargetOrAnimateLaunchFlipTile uses this or 0x2d55) */
export const LAUNCH_TILE_SRC = 0x2d51;
/** [seen] ROM animation-sequence table (4-frame attr/tile/colour loop) an actor record is pointed at */
export const ANIM_TABLE_3829 = 0x3829;
/** [code] turn-animation script table (4-byte-per-frame {attr,tile,colour} loop, sibling of moveFormationAndSpawnObject's scripts) armed into an actor record by loc_425c; specific animation not grounded */
export const ANIM_SCRIPT_4203 = 0x4203;
/** [seen] ROM animation-script table armed via setActorAnimation on the interior-entry turn path (mirror of moveFormationAndSpawnObject) */
export const ANIM_SCRIPT_4212 = 0x4212;
/** [code] base of the 14-byte program block loc_1bcc folds (each byte masked to 5 bits) into the signature sentinel; the block is actually code inside loc_52f6's range, read as data (a self-checksum) */
export const TAMPER_CHECKSUM_CODE_BASE = 0x5328;
/** [code] top of the ROM block summed downward (to the 0x34 sentinel) by the loc_7e6d anti-tamper guard; also routine entry loc_64be, hence the _ADDR suffix */
export const TAMPER_CKSUM_TOP_ADDR = 0x64be;
/** [code] ROM table of expected tile-region checksum values (low-byte sum / wrap-count pairs) for the tamper guard */
export const TILE_CHECKSUM_TABLE = 0x68eb;
/** [seen] ROM animation parameter block armed via setActorAnimation when an object advances to its next state */
export const ANIM_PARAM_68EF = 0x68ef;
/** [seen] ROM animation-sequence pointer armed on spawn for pre-bump phase 0 or 1 (sibling of ANIM_PARAM_68EF) */
export const ANIM_PARAM_76D4 = 0x76d4;
/** [code] ROM animation-sequence pointer armed on spawn for pre-bump phase >= 3 (sibling of ANIM_PARAM_68EF) */
export const ANIM_PARAM_6B0A = 0x6b0a;
/** [code] ROM 4-byte-per-record eagle-wave parameter table (record fields +6/+0x10/+4/+0x0f) */
export const EAGLE_WAVE_PARAM_TABLE = 0x7409;
/** [seen] two 2-byte blink tile pairs in ROM ({0x3f,0x46} at +0, {0x46,0x3f} at +2) */
export const BLINK_TILE_PAIRS = 0x76e6;
/** [seen] ROM pointer table of field-record lists, indexed by the field-render selector */
export const FIELD_RECORD_PTR_TABLE = 0x7a0d;
/** [seen] (MAME: n=7 v0=00 as top-left of a 3x3 block (0x8062/8082/80a2), rows stride 0x20) 0x8000-page tilemap destination cell where loc_1ffb stamps the selected 3x3 glyph block (in the 0x8000-0x83ff colour/attribute region per the memory map) */
export const GLYPH_BLOCK_DEST = 0x8062;
/** [seen] colour/attribute-map base for the alternate field job's 16-row vertical strip */
export const FIELD_C_ATTRIB_DEST = 0x811c;
/** [seen] (MAME: written 00->00 n=2 as a 2x2 pattern (0x826a,0x826b,0x828a,0x828b) by the 2x2 stamper — confirms VRAM_TILE_BLOCK_DEST_B is a 2x2 block anchor) video-RAM anchor for the second 2x2 tile block stamped by loc_0a52 (specific graphic ungrounded) */
export const VRAM_TILE_BLOCK_DEST_B = 0x826a;
/** [seen] (MAME: written 00->00 n=2 as a 2x2 pattern (0x82aa,0x82ab,0x82ca,0x82cb) by the same 2x2 stamper — confirms VRAM_TILE_BLOCK_DEST_A is a 2x2 block anchor) video-RAM anchor for the first 2x2 tile block stamped by loc_0a52 (specific graphic ungrounded) */
export const VRAM_TILE_BLOCK_DEST_A = 0x82aa;
/** [code] base of the playfield tilemap tile region in video RAM (checksum/fill scan start) */
export const PLAYFIELD_TILE_BASE = 0x8402;
/** [seen] video-RAM base of the 10-row packed-BCD digit panel */
export const PANEL_DIGIT_VRAM_DEST = 0x8467;
/** [seen] first video cell of the blinking tile pair (second cell at +0x40) */
export const BLINK_TILE_CELL_0 = 0x8471;
/** [code] VRAM base of an 8-cell vertical tile column: top N cells filled (0x0c), the rest blanked (0x10), N derived from the actor-table count */
export const COUNT_COLUMN_VRAM = 0x8482;
/** [seen] (MAME: 0x84a7 f0->a2, n=253, play) VRAM anchor for the arrow/launch 2x2 tile blit (shared with spawnEnemyTargetOrAnimateLaunchFlipTile) */
export const LAUNCH_TILE_VRAM = 0x84a7;
/** [seen] (MAME: 0x84b4 5c->e3, n=107 (A+P); partner 0x8474 written n=95) video-RAM anchor for the two-tile blit; the second block is stamped two rows above */
export const BLIT_SCREEN_ANCHOR = 0x84b4;
/** [seen] (MAME: 0x84bb=3d n=606 play; 0x847b(-0x40)=3d n=606) video-RAM 2x2-blit anchor of the two-tile animator when round bit0 is clear */
export const TWOTILE_ANIM_VRAM_ALT = 0x84bb;
/** [seen] top cap cell of the 3-tile video-RAM column stamped by loc_1ce7 (cap 0x02, then mid/base upward) */
export const COLUMN_CAP_VRAM = 0x84e0;
/** [seen] (MAME: pc 2840 (spawnEnemyTargetOrAnimateLaunchFlipTile) writes tile 0x10 (n=15); sibling pc 27de writes 0x6f (n=17) — a launch-state tile toggle in VRAM) status-panel VRAM tile cell lit (0x6f here / 0x10 in spawnEnemyTargetOrAnimateLaunchFlipTile) when the launch fires while the game is idle */
export const LAUNCH_HUD_TILE = 0x8508;
/** [seen] video-RAM column base where player-2's score digits are drawn */
export const P2_SCORE_VRAM = 0x8521;
/** [seen] video-RAM base cell for the level-intro digit pair (tally at the base, its BCD double two rows up) */
export const HUD_INTRO_DIGITS_BASE = 0x8634;
/** [seen] video-RAM column base where the top/high-score digits are drawn */
export const HIGH_SCORE_VRAM = 0x8641;
/** [code] video-RAM top-left cell of the round-marker column (offsets -0x20/+0x20/-0x41 give the count>0 saved ptr, count-0 saved ptr, and count-0 glyph anchor) */
export const MARKER_VRAM_BASE = 0x86c3;
/** [seen] (MAME: written by the digit renderer, leading-blank 0x10 n=7, with a real digit appearing lower in the same column (0x8721 10->08) — matches P1_SCORE_VRAM) video-RAM column base where player-1's score digits are drawn (cursor walks up one row per digit) */
export const P1_SCORE_VRAM = 0x8781;
/** [code] video-RAM 2x2-blit anchor (round-bit0-set anchor of the two-tile animator; also the ready-sprite indicator tile used by loc_2bd3) */
export const READY_SPRITE_TILE_VRAM = 0x87bb;
/** [seen] DSW1 bit7 complemented (boot-only; decoded in loc_0092): demo/attract sounds enable; bit0 gates queued sound dispatch when the game is idle */
export const DEMO_SOUNDS_DSW = 0x8821;
/** [seen] (gwtrace pc=5a6c inc (0x8824) 0x00->0x01 at a coin accept; decremented one per completed strobe by the coin-1 pulse generator) coin-counter 1 queued-pulse count */
export const COIN1_PULSE_COUNT = 0x8824;
/** [seen] coin-counter 1 pulse phase timer (seeded 0x30, drop point 0x18) */
export const COIN1_PULSE_PHASE = 0x8825;
/** [seen] low-byte write pointer into the display-command ring (page 0x88), advanced by two per enqueue and clamped up to 0xc0 */
export const DISPLAY_CMD_RING_WRITE_PTR = 0x88a0;
/** [code] LSB of the 3-byte BCD high-score counter (0x88a8..0x88aa, MSB at 0x88aa) */
export const HIGH_SCORE_BCD = 0x88a8;
/** [seen] (MAME: Written 308x by paintDisplayListRunToVram (whose interpreter role is confirmed), value 0x8462->0x87c2 -- a live pointer INTO video RAM (0x8400-0x87ff), i.e. the paint destination. Advanced-pointer writeback…) alternate destination pointer for the display-list interpreter (used when FORMATION_SLOT_TABLE != 0), paired with 0x88ba */
export const DISPLAY_LIST_DST_PTR_ALT = 0x88b8;
/** [seen] (MAME: Written 308x by paintDisplayListRunToVram, value 0x43eb->0x4872 -- a live pointer INTO the display-list stream table (0x43e1-0x4a0a in ROM), i.e. the layout source. Advanced-pointer writeback on the (0x8920…) alternate source/layout read pointer for the display-list interpreter (used when FORMATION_SLOT_TABLE != 0), paired with 0x88b8 */
export const DISPLAY_LIST_SRC_PTR_ALT = 0x88ba;
export const loc_8905 = 0x8905;
export const loc_8906 = 0x8906;
/** [seen] blink-timer countdown (reload 0x16); decremented per tick, on 0 toggles the phase */
export const BLINK_COUNTDOWN = 0x892a;
/** [seen] (MULTIPLEXED, role contested: MAME shows the blink path (blinkTilePairOnCountdown/0x76af) toggle it in step with the tile swap (n=30), while the object-anim path seeds it 0x08 (spawnActorGroupRecords) and decrements/reloads it as a countdown (cycleActorGroupSpriteFramesOnTimer/0x66a1); kept code) blink path: phase byte toggled on 0x892a expiry, parity selects the tile pair */
export const BLINK_PHASE = 0x892b;
/** [seen] shared per-frame phase/animation countdown reloaded to 0x12 (also used by spawnEnemyTargetOrAnimateLaunchFlipTile/loc_7638) */
export const SHARED_PHASE_COUNTDOWN = 0x892e;
/** [seen] (MULTIPLEXED w/ the 0x65xx eagle path (both write/dec); kept code; observed MAME: pc 27fd dec (n=3492), 27ff reload 0x10 (n=216); expiry increments 0x892e at 2802; sibling 27ca reseeds to 8 (v 08->08, n=20)) frame countdown reseeded to 8 by this handler and decremented by spawnEnemyTargetOrAnimateLaunchFlipTile; on reaching 0 it drives the 0x892e tile-flip bit */
export const LAUNCH_FLIP_COUNTDOWN = 0x892f;
/** [seen] boolean gate flag enabling the shared actor phase countdown (written by animateActorGroupGrowShrink) */
export const SHARED_PHASE_GATE = 0x8930;
/** [code] work-RAM word holding the saved round-marker layout pointer */
export const MARKER_LAYOUT_PTR = 0x8932;
/** [code] work-RAM source table (ten 3-byte rows) rendered as packed-BCD digit pairs into the digit panel */
export const PANEL_DIGIT_SOURCE_TABLE = 0x89c0;
/** [code] gate byte for the player-0/1 BCD play-timer; nonzero suppresses the per-frame tick */
export const PLAY_TIMER_GATE_P1 = 0x89e1;
/** [code] gate byte for the player-1/2 BCD play-timer; nonzero suppresses the tick */
export const PLAY_TIMER_GATE_P2 = 0x89e2;
/** [code] anti-tamper flag (set by the resetToAttractScreenStart guard, cleared at reset by resetBoardRamAndReseedSpawnCounters); ORed with BOARD_CLEAR_FLAG to freeze the per-frame object update */
export const TAMPER_OBJECT_FREEZE_FLAG = 0x89fb;
/** [seen] player-0/1 BCD play-timer bank: base byte = per-frame sub-counter (rolls at 0x3b/0x3c), +1/+2 = BCD seconds/minutes digits */
export const PLAY_TIMER_BCD_P1 = 0x8a30;
/** [code] player-1/2 BCD play-timer bank (frame sub-counter + BCD seconds/minutes) */
export const PLAY_TIMER_BCD_P2 = 0x8a33;
/** [seen] sound-command ring buffer write/tail pointer (0x43..0x5e, wraps); enqueueSoundCommandRing stores into the slot it points at */
export const SOUND_RING_WRITE_PTR = 0x8a40;
/** [seen] sound-command ring buffer read/head index (0x43..0x5e, wraps); the slot it points at is consumed then freed */
export const SOUND_RING_READ_PTR = 0x8a41;
/** [seen] (MAME: n=3782 v0=49 vN=46, exactly 0x8acc(baseY)-0x10 each frame) actor-record Y of the arrow/launch object (slot 2, ix+4); launch state machine gates on it (>=0x3c here, >=0x34 in state 1) */
export const ARROW_Y = 0x8ab4;
/** [seen] gate byte: when zero, loc_6822 skips the 0x8b28 enemy-record state dispatch */
export const ENEMY_REC_DISPATCH_GATE = 0x8afa;
/** [seen] (MAME: 0x8ba0=00, 0x8ba1=01, 0x8ba2=08 (n=4 each), +0x12=0x8bb2=ff, +0x16/17=0x8bb6/b7=04/04; play) base of the 6-slot per-frame object-state record array (stride 0x18, spans into PROJECTILE_TABLE at 0x8be8) swept by loc_76f4 via dispatchActiveObjectState */
export const OBJECT_STATE_RECORD_BASE = 0x8ba0;
/** [seen] byte pending append into the page-0x8a00 text ring (stashed across the append gate) */
export const SOUND_RING_PENDING_BYTE = 0x8d20;
/** [code] work-RAM snapshot of the spawn-phase counter (written alongside ROPE_DRAW_COUNT) */
export const SPAWN_PHASE_SNAPSHOT = 0x8d43;
/** [code] value copied into the launch-arm latch (0x8f20) when nonzero; producer not in the decompiled set */
export const LAUNCH_ARM_LATCH_SEED = 0x8d7a;
/** [seen] shift latch: loc_1e55 rotates the complemented joystick's bit4 into bit0 each frame; its low 3 bits decide whether the aim bit4 is cleared (also touched by acquireTargetLockAndSetAimIndicator) */
export const INPUT_ROTATE_LATCH = 0x8f03;
/** [seen] (MAME: MAME pc 0x256f dec 0x0f->0x04 n=7362; pc 0x2571 reload 0x0c n=606 (and loc_6b1a/6b1c dec 0x0b->0x00 + reload 0x0c, same discipline)) two-tile animation hold countdown (reload 0x0c); decremented per frame, on 0 advances the phase */
export const TWOTILE_ANIM_HOLD = 0x8f06;
/** [seen] (MAME: MAME pc 0x2574 inc 0x8f07 n=606, exact lockstep with the 606 reloads of 0x8f06) two-tile animation phase byte; incremented on hold expiry, its parity selects the source block */
export const TWOTILE_ANIM_PHASE = 0x8f07;
/** [seen] (MAME: PC 2e50 (0x2e45) writes all four stride-2 cells as decrementing timers (n=131/108/64/6); re-arm writes to 0x8f28 come from the state handlers (PC 2e68/2e8d in 0x2e5e -> 01/27, 2edb in 0x2ec…) base of four per-cell frame timers (stride 2) for the rope-cell state handlers */
export const ROPE_CELL_TIMERS = 0x8f28;
/** [seen] (MAME: inc (0x8f38) observed, n=8, play; 0x8f39 cleared to 0 in the same routine) eagle-wave outer-phase counter; cleared when a wave seeds (alongside WAVE_RECORDS_ARRIVED 0x8f39), incremented on the 4th-wave re-arm */
export const WAVE_OUTER_PHASE = 0x8f38;
/** [seen] eagle-wave launch flag; set 1 when a wave is seeded, driveEagleWavePerFrame gates its driver on it being nonzero */
export const WAVE_LAUNCH_FLAG = 0x8f3a;
/** [seen] eagle-wave record count = 2*WAVE_INDEX; driveEagleWavePerFrame walks this many records of the 0x8ae0 table */
export const WAVE_RECORD_COUNT = 0x8f3c;
/** [seen] eagle grid-advance done latch: set 1 when the eagle reaches the grid edge (>=0xd0); diverts the approach machine to its reset epilogue */
export const EAGLE_FINISH_FLAG = 0x8f3e;
/** [seen] once-only latch gating the playfield tile-region tamper checksum (loc_68ac/loc_3278) */
export const TILE_CHECKSUM_LATCH = 0x8f55;
/** [code] state/flag ORed with WAVE_TEARDOWN_STATE (0x8f24) to gate/abort the player-object update; base of a 4-byte block cleared at reset by resetBoardRamAndReseedSpawnCounters (role partially understood) */
export const SECONDARY_TEARDOWN_FLAG = 0x8f57;
/** [code] player-1 controls hardware input port (IN1), active-low; used in upright orientation */
export const IN1_PORT = 0xa0a0;
/** [code] player-2 controls hardware input port (IN2), active-low; used when the screen is flipped (cocktail) */
export const IN2_PORT = 0xa0c0;
/** [seen] LS259 latch bit 3 driving the physical coin counter 1 (write_d0: only bit 0 of the value lands) */
export const COIN1_COUNTER_LATCH = 0xa183;

// Stack-scratch window [lo, hi): the emulated Z80 stack lives just below its 0x9000 init (SP inits
// to 0x9000 at loc_0092; measured min SP 0x8fd0 over the boot). Equivalence tests exclude it -- a
// routine's transient stack writes are not game state.
export const STACK_SCRATCH = { lo: 0x8fc0, hi: 0x9000 };
/** [code] boot stack-pointer seed: SP=0x9000 then one unbalanced push (reserves the top word 0x8fff for
 * ROM_SELFTEST_TALLY, keeping it above the stack so the vblank NMI's register-save cannot clobber it). */
export const BOOT_STACK_TOP = 0x8ffe;


// -- batch 4 leaf-decompile cells --
/** [code] display-command word (0x06:0x08) queued by loc_6edb when 3x the target-group count (0x8f47) != the hit tally (0x8f52) */
export const TARGET_MISMATCH_DISPLAY_CMD = 0x0608;
/** [code] display-command word (0x06:0x10) queued by loc_6edb when 3x the target-group count == the hit tally (also forces intro phase 4) */
export const TARGET_MATCH_DISPLAY_CMD = 0x0610;
/** [code] display-command word queued via loc_0038 by loc_6edb when phase-1 completes */
export const PHASE1_COMPLETE_DISPLAY_CMD = 0x0635;
/** [code] ROM byte table (idx = (ROUND_COUNTER&0x3f)>>2) giving the ENEMY_SPAWN_TIMER reseed value */
export const SPAWN_TIMER_TABLE_11F9 = 0x11f9;
/** [code] ROM byte table (idx = (ROUND_COUNTER&0x3f)>>2) giving a spawned actor's facing byte (ix+9); its two's-complement negation goes to ix+0xa */
export const SPAWN_FACING_TABLE_1209 = 0x1209;
/** [code] ROM 4-byte actor shape/display-tile source table loaded into the actor records by the shape loader (loc_250f) */
export const SHAPE_TABLE_26BD = 0x26bd;
/** [code] ROM shape/tile source table loaded into the actor record (stride 0x18) via the pattern-A shape loader from the state-1 handler dropLeadActorAfterDelay */
export const SHAPE_TABLE_26C1 = 0x26c1;
/** [code] ROM tile/shape source table (pattern A) copied into the four actor records by the loc_250f shape-loader */
export const SHAPE_TABLE_26C5 = 0x26c5;
/** [seen] ROM animation-sequence descriptor armed into the hunter record (via setActorAnimation) on the 0x88 script opcode */
export const ANIM_SEQ_2D5D = 0x2d5d;
/** [seen] (MAME: pc=245a writes the contiguous 0x18-byte range 0x8a98..0x8aaf in one pass = the 0x18-byte lead-record copy into slot 1, matching the documented role.) second 0x18-stride actor record slot (ACTOR_TABLE + 0x18); beginLeadActorLiftOnClear snapshots the lead record here */
export const ACTOR_TABLE_SLOT1 = 0x8a98;
/** [seen] (MAME: 0x3e69 increments 0x8bea via incMem8(ix+0x02) at pc=3e99 from 0x0b to 0x0c, handing the slot to the state-12 in-flight mover (0x3e9c), which then runs on it -- confirming +2 is the dispatch…) state byte (+2) of each of the 3 projectile-table slots (0x8be8, stride 0x18); loc_6edb gates phase-1 completion on all three being idle (also coincides with the +2 state bytes of enemy-actor records 11/12/13 at 0x8ae0) */
export const PROJECTILE_SLOT_STATE = 0x8bea;
/** [guess] byte incremented once per actor spawn by loc_119a (paired with ACTIVE_ENEMY_COUNT); no reader found, purpose open */
export const loc_8f5f = 0x8f5f;


// -- batch 4 caller-skip cluster cells --
/** [code] display command enqueued by updateEnemyActorsAndCycleLaunchFlipAnim's flip cadence when the flip toggle (0x892f) bit0 is set */
export const FLIP_ANIM_DISPLAY_CMD = 0x0612;
/** [code] display-command word (0x06:0x15) enqueued via loc_0038 by the actor state-2 handler on a clean integrity check */
export const DISPLAY_CMD_0615 = 0x0615;
/** [code] display command enqueued by updateEnemyActorsAndCycleLaunchFlipAnim's flip cadence when the flip toggle (0x892f) bit0 is clear */
export const FLIP_ANIM_DISPLAY_CMD_ALT = 0x0692;
/** [code] ROM table of rope-grab catch-window half-widths, indexed by IXL&3 */
export const GRAB_WINDOW_TABLE = 0x3087;
/** [code] ROM animation-sequence for a spawned formation child (data table 0x3d0f-0x3d17 just past the routine), seeded little-endian into the child's anim field (+0x0c/+0x0d) and walked by advanceActorAnimFrame */
export const ANIM_SEQ_3D0F = 0x3d0f;
/** [code] ROM handler-routine pointer seeded little-endian into a struck record's +0x12/+0x13 field on a proximity hit */
export const PROXIMITY_HIT_HANDLER = 0x5dc2;
/** [code] ROM animation/movement-script data installed as the matched record's animation-script pointer (low/high at +0x0c/+0x0d, step index reset at +0x0e) */
export const ANIM_SCRIPT_634F = 0x634f;
/** [code] ROM animation-script pointer installed by the award path into a struck record via setActorAnimation (sibling of ANIM_SCRIPT_634F) */
export const ANIM_SCRIPT_6343 = 0x6343;
/** [code] ROM animation-script pointer installed by the award path into a struck record via setActorAnimation (sibling of ANIM_SCRIPT_634F) */
export const ANIM_SCRIPT_6349 = 0x6349;
/** [code] ROM byte table (rst-0x20 lookup base) indexed by ((ROUND_COUNTER&7)>>1); the fetched byte is a signed per-round delta added into a record's +0x0a field (sibling of POSITION_DELTA_TABLE_6360) */
export const POSITION_DELTA_TABLE_6358 = 0x6358;
/** [code] ROM byte table (rst-0x20 lookup base) indexed by ((ROUND_COUNTER&7)>>1); the fetched byte is a signed per-round delta added into the matched record's +0x0a field */
export const POSITION_DELTA_TABLE_6360 = 0x6360;
/** [code] ROM animation-sequence descriptor pointed into a claimed proximity-target record (rec+0x0c/0x0d, frame index rec+0x0e reset) on a hit */
export const ANIM_SEQ_63FB = 0x63fb;
/** [code] video-RAM base of the 3 consecutive tile cells the actor state-2 handler paints with tile 0xbc */
export const STATE2_TILE_PAINT_VRAM = 0x875a;
/** [code] video-RAM 2x2-blit anchor / formation ready-sprite indicator cell checked and painted by loc_2bbf; distinct sibling of READY_SPRITE_TILE_VRAM 0x87bb (loc_2bd3's cell) */
export const FORMATION_READY_TILE_VRAM = 0x877b;
/** [seen] (MAME: 0x889c written 00->c0 n=11038 as byte-0 of a display-list object entry (alongside 0x889d=00->40,0x889e=00->56,0x889f=00->16) — confirms PROXIMITY_SOURCE_OBJECT 'sits inside the sprite display list') fixed source object record scanned for proximity by loc_5d4d (screen X at +0, Y at +2); sits inside the sprite display list */
export const PROXIMITY_SOURCE_OBJECT = 0x889c;
/** [seen] wave/stage progression index (0..8): incremented per wave (launchWolfIntoSlot/756d), gated at >=8 = all-waves-done (loc_6905), indexes the wave-param table; loc_6a7f arms its tilemap integrity check at ==2. NOTE: updateEnemyActorsAndCycleLaunchFlipAnim instead treats it as a per-frame countdown reloaded to 0x10 (possible mode-dependent reuse, needs MAME grounding) */
export const WAVE_NUMBER = 0x892d;
/** [seen] base of the formation spawn record table scanned by loc_2bb3/loc_2be5 (records 0x18 bytes apart, descending) */
export const FORMATION_SPAWN_TABLE = 0x8c60;
/** [seen] aim-indicator mode/direction latch: 0 triggers a redraw pass, 1 selects the above bit and 2 the below bit of PLAYER_AIM_FLAGS; set to 1/2 on a timed proximity hit and read by the indicator stepper (driveAimIndicatorHitTimerElseRescan) */
export const AIM_INDICATOR_MODE = 0x8d52;
/** [seen] aim-indicator countdown reloaded to 0x18 on a timed proximity hit; decremented by the indicator stepper (driveAimIndicatorHitTimerElseRescan), and on reaching 0 it clears AIM_INDICATOR_MODE */
export const AIM_INDICATOR_TIMER = 0x8d53;
/** [seen] proximity-hit/target-acquired flag: set 1 on a target-in-band hit, cleared 0 by this scan when no record hits (gates the aim-acquisition updater acquireTargetLockAndSetAimIndicator, which bails when nonzero) */
export const PROXIMITY_HIT_FLAG = 0x8d54;

// == Routine dispatch map (idiomatic overrides layered over the translated oracle) ==
// mainLoop runs as the born-live generator on runIdiomaticGame, yielding at the per-frame worker
// (ring-idle) iteration -- the vblank boundary -- and draining the display command ring within the frame
// (as MAME does per vblank); the frozen boot chain's tail call into the main loop returns this generator,
// which the engine drives frame by frame. The leaves below are wired as direct overrides: the memory-only ones
// return their result, and the register/flag-live-out ones set it through the return-assignment bridge
// (return (m.regs.X = v)) so the frozen caller reads it back out of the register. Only the jump-table
// dispatchers stay UNWIRED (tools/registry-coverage.config.mjs).

// -- batch 5 decompile cells --
/** [code] ROM source pointer (walked downward) whose bytes the terminator guard matches against TERMINATOR_MATCH_TABLE; a mismatch bumps TAMPER_STRIKES_TERMINATOR */
export const TERMINATOR_SCAN_SRC = 0x0bc2;
/** [code] top of the reversed reference copy of reinitRoundArenaAndPlayfieldIfImageIntact's first 0x20 bytes; the state-5 signature check reads it downward (0x2b23..0x2b04) comparing against the code window read upward from 0x67df */
export const STATE5_SIGCHECK_REF_TOP = 0x2b23;
/** [code] ROM expected-byte table (walked upward) for the terminator match-scan, terminated when a fetched byte decrements to zero (a 0x01 sentinel) */
export const TERMINATOR_MATCH_TABLE = 0x64d0;
/** [code] ROM animation-sequence pointer handed to setActorAnimation for a struck/collided object */
export const ANIM_SEQ_64DF = 0x64df;
/** [code] base of the code window the 0x8a80 actor state-5 handler signature-checks (its first 0x20 bytes, read ascending) against the reversed reference at 0x2b23; this is also the entry of reinitRoundArenaAndPlayfieldIfImageIntact */
export const STATE5_SIGCHECK_CODE_BASE_ADDR = 0x67df;
/** [seen] stride-4 sprite y-coordinate slots (6 scanned) tested for the closest in-band aim target vs the player's y (SPRITE_DISPLAY_LIST+2) */
export const SPRITE_SCAN_YSLOTS = 0x8852;
/** [seen] stride-4 actor coordinate slots (base IX, 5 scanned) swept by the object-record proximity scan; +0 (x)/+2 (y) is the moving actor tested against each object record */
export const SPRITE_SCAN_ACTOR_SLOTS = 0x8868;
/** [seen] player-1 stride-4 target/collision coordinate slots scanned vs the 0x8c48 records (counterpart of 0x887c/SPRITE_TARGET_SLOTS; selected when PLAY_MODE_LATCH==0) */
export const SPRITE_TARGET_SLOTS_P1 = 0x888c;
/** [seen] 5-byte acquired-aim-target lock: +0 closest-distance/lock-active byte, +1..+2 the locked y-slot pointer (little-endian), +3..+4 the locked enemy-block pointer (block+1, little-endian); overlaps DISPLAY_LIST_DST_PTR at 0x8f43 (multiplexed by game phase), accessed here as TARGET_LOCK+3/+4 */
export const TARGET_LOCK = 0x8f40;


// == Batch: object/marker/rope/config/anim decompile cells [code] (ungrounded; MAME-grounding pending) ==
// Aliases (same address, two code-level readings) are flagged for the understanding pass to reconcile.
/** [code] display cmd (0x0614) */
export const DISPLAY_CMD_0614 = 0x0614;
/** [code] checksum rom base (0x0bb5) */
export const CHECKSUM_ROM_BASE = 0x0bb5;
/** [seen] column blit tile src (0x0d2f) */
export const COLUMN_BLIT_TILE_SRC = 0x0d2f;
/** [seen] column blit attr src (0x0d48) */
export const COLUMN_BLIT_ATTR_SRC = 0x0d48;
/** [code] anim seq table (0x12fb) */
export const ANIM_SEQ_TABLE_12FB = 0x12fb;
/** [code] state timer reload table (0x13d3) */
export const STATE_TIMER_RELOAD_TABLE = 0x13d3;
/** [code] state4 sigcheck code base addr (0x1c66) */
export const STATE4_SIGCHECK_CODE_BASE_ADDR = 0x1c66;
/** [code] stage label ptr table (0x1fa3) */
export const STAGE_LABEL_PTR_TABLE = 0x1fa3;
/** [code] round digit glyphs (0x1fda) */
export const ROUND_DIGIT_GLYPHS = 0x1fda;
/** [code] round digit glyphs alt (0x1fe6) */
export const ROUND_DIGIT_GLYPHS_ALT = 0x1fe6;
/** [code] actor group state dispatch (0x2436) */
export const ACTOR_GROUP_STATE_DISPATCH = 0x2436;
/** [code] anim frame word table (0x26f6) */
export const ANIM_FRAME_WORD_TABLE = 0x26f6;
/** [seen] status render tile table (0x26f6) */
export const STATUS_RENDER_TILE_TABLE = 0x26f6;
/** [code] status field tile a (0x270a) */
export const STATUS_FIELD_TILE_A = 0x270a;
/** [code] status field tile b (0x270e) */
export const STATUS_FIELD_TILE_B = 0x270e;
/** [code] motion param table (0x2712) */
export const MOTION_PARAM_TABLE_2712 = 0x2712;
/** [code] motion param table (0x271c) */
export const MOTION_PARAM_TABLE_271C = 0x271c;
/** [code] motion param table (0x2730) */
export const MOTION_PARAM_TABLE_2730 = 0x2730;
/** [code] marker glyph src odd (0x275e) */
export const MARKER_GLYPH_SRC_ODD = 0x275e;
/** [code] marker column glyph src (0x2768) */
export const MARKER_COLUMN_GLYPH_SRC = 0x2768;
/** [code] marker column glyph src odd (0x276c) */
export const MARKER_COLUMN_GLYPH_SRC_ODD = 0x276c;
/** [code] marker retract glyph src (0x2770) */
export const MARKER_RETRACT_GLYPH_SRC = 0x2770;
/** [code] marker retract glyph src odd (0x2774) */
export const MARKER_RETRACT_GLYPH_SRC_ODD = 0x2774;
/** [code] field attrib ref (0x2980) */
export const FIELD_ATTRIB_REF_2980 = 0x2980;
/** [code] shape table (0x2d59) */
export const SHAPE_TABLE_2D59 = 0x2d59;
/** [code] formation dispatch table (0x30eb) */
export const FORMATION_DISPATCH_TABLE = 0x30eb;
/** [code] target tile row table (0x35c7) */
export const TARGET_TILE_ROW_TABLE = 0x35c7;
/** [code] delay reload table (0x368e) */
export const DELAY_RELOAD_TABLE_368E = 0x368e;
/** [code] anim table (0x3856) */
export const ANIM_TABLE_3856 = 0x3856;
/** [code] speed table (0x38a5) */
export const SPEED_TABLE_38A5 = 0x38a5;
/** [code] speed table (0x38ad) */
export const SPEED_TABLE_38AD = 0x38ad;
/** [code] anim ptr table (0x38b5) */
export const ANIM_PTR_TABLE_38B5 = 0x38b5;
/** [code] anim seq (0x3952) */
export const ANIM_SEQ_3952 = 0x3952;
/** [code] spawn anim table (0x396a) */
export const SPAWN_ANIM_TABLE_396A = 0x396a;
/** [code] spawn anim table (0x3979) */
export const SPAWN_ANIM_TABLE_3979 = 0x3979;
/** [code] anim seq (0x3994) */
export const ANIM_SEQ_3994 = 0x3994;
/** [code] spawn anim table (0x39a0) */
export const SPAWN_ANIM_TABLE_39A0 = 0x39a0;
/** [code] spawn attr table (0x3b37) */
export const SPAWN_ATTR_TABLE_3B37 = 0x3b37;
/** [code] spawn attr table (0x3b3f) */
export const SPAWN_ATTR_TABLE_3B3F = 0x3b3f;
/** [code] spawn coord table (0x3b47) */
export const SPAWN_COORD_TABLE_3B47 = 0x3b47;
/** [code] spawn coord table (0x3b57) */
export const SPAWN_COORD_TABLE_3B57 = 0x3b57;
/** [code] hit flash anim (0x3bdd) */
export const HIT_FLASH_ANIM_3BDD = 0x3bdd;
/** [code] anim seq table (0x4076) */
export const ANIM_SEQ_TABLE_4076 = 0x4076;
/** [code] splash anim table (0x40a4) */
export const SPLASH_ANIM_TABLE_40A4 = 0x40a4;
/** [seen] arm anim table (0x41b1) */
export const ARM_ANIM_TABLE = 0x41b1;
/** [code] catch tamper cksum top (0x428b) */
export const CATCH_TAMPER_CKSUM_TOP = 0x428b;
/** [code] hit flash anim (0x433b) */
export const HIT_FLASH_ANIM_433B = 0x433b;
/** [code] hit flash anim (0x4341) */
export const HIT_FLASH_ANIM_4341 = 0x4341;
/** [code] actor speed table (0x55d7) */
export const ACTOR_SPEED_TABLE_55D7 = 0x55d7;
/** [code] actor spawn type table (0x5637) */
export const ACTOR_SPAWN_TYPE_TABLE = 0x5637;
/** [seen] actor anim table (0x5657) */
export const ACTOR_ANIM_TABLE_5657 = 0x5657;
/** [code] spawn timer table odd (0x589b) */
export const SPAWN_TIMER_TABLE_ODD = 0x589b;
/** [seen] spawn timer table even (0x58c0) */
export const SPAWN_TIMER_TABLE_EVEN = 0x58c0;
/** [code] spawn field table odd (0x58e0) */
export const SPAWN_FIELD_TABLE_ODD = 0x58e0;
/** [code] eagle rearm table (0x5922) */
export const EAGLE_REARM_TABLE_5922 = 0x5922;
/** [seen] eagle rearm table (0x5985) */
export const EAGLE_REARM_TABLE_5985 = 0x5985;
/** [code] anim seq (0x5c80) */
export const ANIM_SEQ_5C80 = 0x5c80;
/** [code] anim seq (0x5c89) */
export const ANIM_SEQ_5C89 = 0x5c89;
/** [code] anim seq table (0x5c92) */
export const ANIM_SEQ_TABLE_5C92 = 0x5c92;
/** [code] anim seq (0x5cf9) */
export const ANIM_SEQ_5CF9 = 0x5cf9;
/** [seen] column blit attr dest (0x82a7) */
export const COLUMN_BLIT_ATTR_DEST = 0x82a7;
/** [seen] (MAME: n=335 v0=8b vN=85 -- updated every frame as part of a hot glyph block (a static label would not rewrite 335x)) hud stage label tile (0x8322) */
export const HUD_STAGE_LABEL_TILE = 0x8322;
/** [seen] (MAME: 0x8425 tile code ec->e4, n=469, play) status render vram base (0x8425) */
export const STATUS_RENDER_VRAM_BASE = 0x8425;
/** [seen] (MAME: n=7 v0=22 vN=22, base of the 0x1ea7 field blitted bottom-up (0x855f/0x853f/0x851f/...)) reset attr column (0x855f) */
export const RESET_ATTR_COLUMN = 0x855f;
/** [seen] (MAME: written e4->ec n=56 with its 2x2 neighbors 0x866b=e5->ed,0x868a=e6->ee,0x868b=e7->ef — a 2x2 block of animation frames (e4-e7 -> ec-ef)) anim tile block top (0x866a) */
export const ANIM_TILE_BLOCK_TOP = 0x866a;
/** [seen] column blit tile dest (0x86a7) */
export const COLUMN_BLIT_TILE_DEST = 0x86a7;
/** [seen] (MAME: written e4->ec n=56 with 2x2 neighbors 0x86ab=e5->ed,0x86ca=e6->ee,0x86cb=e7->ef — identical animated 2x2 block) anim tile block bottom (0x86aa) */
export const ANIM_TILE_BLOCK_BOTTOM = 0x86aa;
/** [seen] (MAME: n=8 v0=b7 vN=b7, base cell of the 4x3 block blitted from loc_1ead(hl=0x8722)) hud round tile (0x8722) */
export const HUD_ROUND_TILE = 0x8722;
/** [code] drip ring a (0x8829) */
export const DRIP_RING_A = 0x8829;
/** [seen] enemy scan box table (0x8850) */
export const ENEMY_SCAN_BOX_TABLE = 0x8850;
/** [seen] formation coord slots (0x8888) */
export const FORMATION_COORD_SLOTS = 0x8888;
/** [seen] (MAME: inc n=229 gated on 0x88bd wrap-to-0, v0=03 vN=03) status render phase (0x88bc) */
export const STATUS_RENDER_PHASE = 0x88bc;
/** [seen] (MAME: inc then AND 0x07, n=3748, values cycling 06->02) status render ring (0x88bd) */
export const STATUS_RENDER_RING = 0x88bd;
/** [code] tamper strikes catch (0x89eb) */
export const TAMPER_STRIKES_CATCH = 0x89eb;
/** [code] spawn type cursor (0x8d12) */
export const SPAWN_TYPE_CURSOR = 0x8d12;
/** [seen] (MAME: 0x3a6c loads hl=0x8d42 and increments it on entry (source line 15); MAME write-set shows it bumped n=35 (== play reach) with a monotonic v 01->04, i.e. watched incrementing once per launch.…) spawn counter (0x8d42) */
export const SPAWN_COUNTER = 0x8d42;
/** [seen] eagle step counter (0x8d46) */
export const EAGLE_STEP_COUNTER = 0x8d46;
/** [code] eagle stage timers (0x8d47) */
export const EAGLE_STAGE_TIMERS = 0x8d47;
/** [seen] spawn active flag (0x8d4a) */
export const SPAWN_ACTIVE_FLAG = 0x8d4a;
/** [seen] special actor active flag (0x8d4a) */
export const SPECIAL_ACTOR_ACTIVE_FLAG = 0x8d4a;
/** [code] eagle target column bias (0x8d4c) */
export const EAGLE_TARGET_COLUMN_BIAS = 0x8d4c;
/** [code] spawn column bias (0x8d4c) */
export const SPAWN_COLUMN_BIAS = 0x8d4c;
/** [code] active enemy target pair ptr (0x8d65) */
export const ACTIVE_ENEMY_TARGET_PAIR_PTR = 0x8d65;
/** [code] struck target latch (0x8d65) */
export const STRUCK_TARGET_LATCH = 0x8d65;
/** [code] actor delay counter (0x8d6b) */
export const ACTOR_DELAY_COUNTER = 0x8d6b;
/** [code] spawn step timer (0x8d6b) */
export const SPAWN_STEP_TIMER = 0x8d6b;
/** [seen] (MAME: MAME write-set: n=32, v 01->04 (genuinely changes across 1..4), bumped in lockstep with launches; source reads (0x8d6c)&7 as the rst-0x20 index into attribute tables 0x3b37/0x3b3f (launchProjectileIntoFreeSlot…) spawn attr index (0x8d6c) */
export const SPAWN_ATTR_INDEX = 0x8d6c;
/** [seen] alt target table ptr (0x8d6f) */
export const ALT_TARGET_TABLE_PTR = 0x8d6f;
/** [seen] reset scan latch (0x8e2a) */
export const RESET_SCAN_LATCH = 0x8e2a;
/** [seen] (MAME: set to 1 by spawnTargetActorOnLaunchTrigger at pc=0x211e (n=149, on trigger frames) and cleared to 0 by stepActiveTargetActorRecords at pc=0x2180 (n=5615, ~every frame). Oscillating 0<->1 set-once/clear-each-pass pattern match…) one-shot spawn-arming latch for player-launched target actors: set 1 to gate re-entry, cleared each step pass to re-arm once per launch trigger (was mis-named FORMATION_INIT_LATCH) */
export const TARGET_SPAWN_ARM_LATCH = 0x8f02;
/** [code] formation enable flag (0x8f04) */
export const FORMATION_ENABLE_FLAG = 0x8f04;
/** [code] rope draw complete flag (0x8f04) */
export const ROPE_DRAW_COMPLETE_FLAG = 0x8f04;
/** [code] rope draw extend flag (0x8f05) */
export const ROPE_DRAW_EXTEND_FLAG = 0x8f05;
/** [code] rope draw step timer (0x8f09) */
export const ROPE_DRAW_STEP_TIMER = 0x8f09;
/** [code] rope draw anim phase (0x8f0a) */
export const ROPE_DRAW_ANIM_PHASE = 0x8f0a;
/** [seen] (MAME: stepActiveTargetActorRecords writes it at pc=0x215d, n=17080 (~2 writes/frame), value 0x02->0x01. Matches JS stepActiveTargetActorRecords (store count at line 31, reload count-1 at line 34).) target scan counter (0x8f15) */
export const TARGET_SCAN_COUNTER = 0x8f15;
/** [seen] (MAME: n=1 v0=01 vN=01) rope cell state base (0x8f1c) */
export const ROPE_CELL_STATE_BASE = 0x8f1c;
/** [code] launch seq counter (0x8f49) */
export const LAUNCH_SEQ_COUNTER = 0x8f49;

// role-unknown cells (loc_ placeholders, allowlisted in names-debt.txt; promote to descriptive at grounding)
export const loc_8083 = 0x8083;
export const loc_8343 = 0x8343;
export const loc_8c91 = 0x8c91;
export const loc_8ca9 = 0x8ca9;
export const loc_8d45 = 0x8d45;
export const loc_8d77 = 0x8d77;
/** [seen] (MAME: [code]->[seen]. Loader stores it per-phase at PC 0x2295 (MAME n=200, 00->40); mover advanceTargetActorAlongVelocityElseDespawn reads it at PC 0x2231 and integrates it into the eagle X coordinate 0x8c95/0x8c96 (EAGLE_X, MAME…) object mover X velocity word (0x8f10) */
export const OBJECT_VEL_X = 0x8f10;
/** [seen] (MAME: [code]->[seen]. Loader stores it per-phase at PC 0x22a2 (MAME n=200, 00->c0); mover advanceTargetActorAlongVelocityElseDespawn reads it at PC 0x2255 and integrates it into the eagle Y coordinate 0x8c93/0x8c94 (EAGLE_Y, MAME…) object mover Y velocity word (0x8f12) */
export const OBJECT_VEL_Y = 0x8f12;


// == closure-fan cells [code] (caller/gap routines) ==
/** [code] integrity-guard ROM region summed against its signature (0x0bad) */
export const INTEGRITY_GUARD_REGION_0BAD = 0x0bad;
/** [code] integrity-guard ROM signature (twos-complement check) (0x55b5) */
export const INTEGRITY_GUARD_SIGNATURE_55B5 = 0x55b5;
/** [seen] rope-extend rst-28 inline jump table (2 words) (0x2d7c) */
export const ROPE_EXTEND_DISPATCH_TABLE = 0x2d7c;
/** [code] spawn-kind ROM byte table (rst-20 base), frame-timer spawner (0x5627) */
export const SPAWN_KIND_TABLE_5627 = 0x5627;
/** [code] spawn-kind ROM byte table (rst-20 base), spawn scheduler B (0x5647) */
export const SPAWN_KIND_TABLE_5647 = 0x5647;
/** [code] rotating spawn-sequence cursor (scheduler B) (0x8d13) */
export const SPAWN_SEQUENCE_INDEX_8D13 = 0x8d13;
/** [code] rotating spawn cursor (frame-timer spawner) (0x8d14) */
export const SPAWN_SEQUENCE_INDEX_8D14 = 0x8d14;


// == Batch: leaves-first decompile cells [code] (ungrounded; MAME-grounding pending) ==
// Alias 0x0bb5 (CHECKSUM_ROM_BASE data view / ATTRACT_HANDLER_EPILOGUE_ADDR routine entry) -> understanding pass.

/** [code] display command constant (0x0200) (0x0200) */
export const DISPLAY_CMD_0200 = 0x0200;
/** [code] display-command word base (type 0x03) (0x030f) */
export const OBJECT_ANIM_DISPLAY_CMD_BASE = 0x030f;
/** [code] attract state-4 display command (0x060d) */
export const ATTRACT_S4_DISPLAY_CMD = 0x060d;
/** [code] display command constant (0x068b) (0x068b) */
export const DISPLAY_CMD_068B = 0x068b;
/** [code] display command constant (0x068e) (0x068e) */
export const DISPLAY_CMD_068E = 0x068e;
/** [seen] attract state-4 attribute source (0x07b9) */
export const ATTRACT_S4_ATTRIB_SRC = 0x07b9;
/** [seen] attract state-4 check source run (0x07c9) */
export const ATTRACT_S4_CHECK_SRC = 0x07c9;
/** [seen] rom field-attribute source (0x07d9) */
export const FIELD_ATTRIB_SRC_07D9 = 0x07d9;
/** [seen] copy-protection stall byte (0x07f5) */
export const COPY_PROTECT_STALL_BYTE = 0x07f5;
/** [seen] expected signature top value (0x0838) */
export const SIGNATURE_EXPECTED_TOP = 0x0838;
/** [seen] inline jump-table base for the attract sub-state rst-28 dispatch (0x08a1) */
export const ATTRACT_SUBSTATE_DISPATCH = 0x08a1;
/** [code] rom signature word table (0x0976) */
export const SIGNATURE_WORD_TABLE = 0x0976;
/** [seen] attract state-4 check reference (0x0a65) */
export const ATTRACT_S4_CHECK_REF = 0x0a65;
/** [seen] attract state-4 object coordinates (0x0a76) */
export const ATTRACT_S4_OBJ_COORDS = 0x0a76;
/** [seen] attract state-4 object descriptors (0x0a7e) */
export const ATTRACT_S4_OBJ_DESCRIPTORS = 0x0a7e;
/** [seen] attract state-4 draw script (0x0a87) */
export const ATTRACT_S4_DRAW_SCRIPT = 0x0a87;
/** [code] rom 0x79-byte block compared in the world-3 anti-tamper check (0x0b32) */
export const TAMPER_CHECK_BLOCK_0B32 = 0x0b32;
/** [seen] rom 5-byte guard table, each &0x1f summed by the checksum guard (0x0bb3) */
export const INTEGRITY_GUARD_TABLE_0BB3 = 0x0bb3;
/** [code] shared attract-handler epilogue routine entry (alias of checksum_rom_base; understanding pass to reconcile) (0x0bb5) */
export const ATTRACT_HANDLER_EPILOGUE_ADDR = 0x0bb5;
/** [code] rom signature-check source run summed vs the sig table (0x0bb9) */
export const SIGNATURE_CHECK_SRC = 0x0bb9;
/** [seen] 0x43-terminated rom string, biased -0x88 into the display message buffer (0x183f) */
export const INTRO_MSG_STRING_183F = 0x183f;
/** [code] rom alternate seed table (odd round) (0x1e2c) */
export const WAVE_SEED_TABLE_1E2C = 0x1e2c;
/** [seen] rom per-record {tile,colour} seed table (even/latched wave) (0x1e34) */
export const WAVE_SEED_TABLE_1E34 = 0x1e34;
/** [code] rom 0x10-terminated attribute field copied bottom-up into the reset attr column (0x1ea7) */
export const ROUND_HUD_FIELD_SRC = 0x1ea7;
/** [seen] rom 5-entry stage-index -> column-code lookup table (0x1f87) */
export const STAGE_TAG_COLUMN_TABLE = 0x1f87;
/** [code] rom 2-entry word table, tens bit picks a glyph-block source (0x200d) */
export const ROUND_GLYPH_WORD_TABLE = 0x200d;
/** [seen] rom anim script the shared cursor is seated to (0x26c9) */
export const ANIM_SCRIPT_26C9 = 0x26c9;
/** [code] inline rst-28 jump table for the lead actor's secondary state machine (0x28f1) */
export const ACTOR_SECONDARY_STATE_DISPATCH = 0x28f1;
/** [code] routine entry pushed as the dispatch transfer/return slot (0x2b8d) */
export const SPAWN_FORMATION_EPILOGUE_ADDR = 0x2b8d;
/** [seen] rom word table of rope-extend tile blocks (0x2dee) */
export const ROPE_TILE_BLOCK_TABLE = 0x2dee;
/** [code] rom 2x2 tile source for the rope segment blit (0x2e1a) */
export const ROPE_RETRACT_TILE_SRC = 0x2e1a;
/** [code] inline rst-28 jump table for the rope-cell handlers (0x2e3d) */
export const ROPE_CELL_DISPATCH = 0x2e3d;
/** [code] rom word table of retract-anim pointers (0x2f93) */
export const RETRACT_ANIM_TABLE = 0x2f93;
/** [code] rom object state-8 anim word table (0x3dd3) */
export const OBJECT_STATE8_ANIM_TABLE = 0x3dd3;
/** [code] rom animation-sequence word table indexed by phase (0x3e49) */
export const ANIM_SEQ_TABLE_3E49 = 0x3e49;
/** [code] rom word table of plummet-animation pointers (0x4072) */
export const FALL_ANIM_TABLE = 0x4072;
/** [code] rom two's-complement signature table, 0xff-terminated (0x4283) */
export const SIGNATURE_CHECK_TABLE = 0x4283;
/** [code] rom word table indexed by ((round>>1)-1)&3 -> spawned-slot anim/script pointer (0x432d) */
export const SPAWN_ANIM_WORD_TABLE = 0x432d;
/** [code] rom animation-sequence pointer seated into the source record (0x4347) */
export const SPAWN_ANIM_SEQ = 0x4347;
/** [seen] rom script-row table (0x519a) */
export const SCRIPT_ROW_TABLE = 0x519a;
/** [seen] rom script data table a (0x5264) */
export const SCRIPT_DATA_TABLE_A = 0x5264;
/** [seen] rom script data table b (0x52b0) */
export const SCRIPT_DATA_TABLE_B = 0x52b0;
/** [seen] rom byte table (rst-0x20 lookup) or'd into record field 7 (0x53a6) */
export const SCRIPT_FLAG_TABLE = 0x53a6;
/** [code] rom byte table indexed by the spawn index -> record field +6 (0x55d4) */
export const ACTOR_MOTION_TABLE_55D4 = 0x55d4;
/** [code] rom reload-value table indexed by the spawn-type cursor low nibble (0x55ef) */
export const SPAWN_RELOAD_TABLE = 0x55ef;
/** [code] rom reload-value table indexed by the spawn-cursor low nibble (0x55ff) */
export const SPAWN_INTERVAL_TABLE_55FF = 0x55ff;
/** [code] rom rst-20 byte table of reload values indexed by cursor&0x0f (0x560f) */
export const SPAWN_TIMER_RELOAD_TABLE = 0x560f;
/** [code] rom word table indexed by the spawn index -> anim-script byte to record +0x17 (0x561f) */
export const ACTOR_ANIM_SCRIPT_TABLE_561F = 0x561f;
/** [code] rom verbatim clone of the tamper-check block (0x7071) */
export const TAMPER_CHECK_CLONE_7071 = 0x7071;
/** [code] rom word table of sprite tile bases, indexed by group tile-index (0x70eb) */
export const SPAWN_TILE_TABLE_70EB = 0x70eb;
/** [seen] rom 6-byte table indexed by the variant cursor -> paired record anim-script index +0x17 (0x7618) */
export const WOLF_LAUNCH_VARIANT_TABLE = 0x7618;
/** [seen] rom 3-byte table indexed by min(wave_number,2), reseeds the shared frame-delay timer (0x761e) */
export const LAUNCH_FRAME_DELAY_TABLE = 0x761e;
/** [seen] rom anim-sequence pointer armed when wave_number>=3 (0x76dd) */
export const ANIM_PARAM_76DD = 0x76dd;
/** [code] rom ret opcode reused as the colorram integrity checksum sentinel (0x780e) */
export const COLORRAM_CHECKSUM_SENTINEL = 0x780e;
/** [seen] rom char-data word table, lower 2x2 row (0x7821) */
export const OBJECT_CHAR_TABLE_ROW0 = 0x7821;
/** [seen] rom char-data word table, upper row (0x7841) */
export const OBJECT_CHAR_TABLE_ROW1 = 0x7841;
/** [seen] rom per-spawn-index word table -> record +0x15/+0x16 (0x7869) */
export const SPAWN_WORD_TABLE = 0x7869;
/** [seen] 9-word cumulative-sum table the integrity check compares against (0x7900) */
export const ROM_BLOCK_CHECKSUM_TABLE = 0x7900;
/** [seen] (MAME: n=7 v0=b2, base cell of the 3x3 block from loc_1ead(hl=0x8462)) vram dst for the round 3x3 tile block (0x8462) */
export const ROUND_TILE_DST = 0x8462;
/** [seen] (MAME: n=7 v0=01 vN=01 = round-1 low BCD digit tile) vram tile: round-number low bcd digit (0x847f) */
export const HUD_ROUND_DIGIT_LO = 0x847f;
/** [seen] (MAME: n=7 v0=01 vN=01 = low nibble of round-1 BCD) work cell: low nibble of the round bcd stashed for render (0x8483) */
export const ROUND_BCD_LOW_STASH = 0x8483;
/** [seen] (MAME: n=7 v0=10 vN=10 = blank tile for round-1 zero high nibble) vram tile: round-number high bcd digit (0x10=blank on leading zero) (0x849f) */
export const HUD_ROUND_DIGIT_HI = 0x849f;
/** [seen] (MAME: n=164 v0=36 vN=10 as the retreat walks the strip) tile-vram cursor value (even/latched) (0x84e9) */
export const WAVE_TILE_CURSOR_84E9 = 0x84e9;
/** [guess] tile-vram cursor value published to the tile-anim cursor (odd round) (0x84f6) */
export const WAVE_TILE_CURSOR_84F6 = 0x84f6;
/** [code] base tile cell of the two-column serpentine playfield checksum (0x8548) */
export const PLAYFIELD_CHECKSUM_VRAM_BASE = 0x8548;
/** [seen] attract state-4 vram cursor (0x8648) */
export const ATTRACT_S4_VRAM_CURSOR = 0x8648;
/** [seen] cursor into the wolf launch-variant table (0x8922) */
export const WOLF_LAUNCH_VARIANT_INDEX = 0x8922;
/** [code] anti-tamper strike counter (integrity flag block +2) (0x89e9) */
export const TAMPER_STRIKES_OBJMOVE = 0x89e9;
/** [code] anti-tamper strike counter (object signature), sibling of tamper_strikes_sig (0x8a3a) */
export const TAMPER_STRIKES_OBJSIG = 0x8a3a;
/** [seen] (MAME: dec each entry then reseed to 0x30 on expiry, n=12 v0=01 vN=30) lead actor record frame-delay byte (actor_table+0x11) (0x8a91) */
export const LEAD_ACTOR_FRAME_DELAY = 0x8a91;
/** [code] index into the formation param tables (0x8d01) */
export const FORMATION_SPAWN_INDEX = 0x8d01;
/** [code] per-type spawn countdown, reloaded from the spawn reload table on zero (0x8d04) */
export const SPAWN_COUNTDOWN_A = 0x8d04;
/** [code] per-type spawn countdown (scheduler b), reloaded from the interval table at zero (0x8d05) */
export const SPAWN_INTERVAL_COUNTDOWN = 0x8d05;
/** [code] frame-timer gated spawner countdown, reloaded from the table on expiry (0x8d06) */
export const SPAWN_RELOAD_TIMER = 0x8d06;
/** [guess] second 6-byte formation state row blanked at entry (0x8d11) */
export const FORMATION_STATE_ROW2 = 0x8d11;
/** [code] work-ram landing sound-id latch = (ix+0x17)+1 (0x8d1d) */
export const SOUND_ID_LATCH_8D1D = 0x8d1d;
/** [seen] once-per-level done latch (0x8d56) */
export const LEVEL_TAG_DONE_LATCH = 0x8d56;
/** [guess] spawn sweep countdown paired with the sweep trigger (0x8d5a) */
export const SPAWN_SWEEP_COUNTDOWN = 0x8d5a;
/** [guess] spawn sweep trigger (also cleared during object-slot init) (0x8d5b) */
export const SPAWN_SWEEP_TRIGGER = 0x8d5b;
/** [seen] 16-bit live-script pointer seeded from the script data table (0x8d71) */
export const SCRIPT_DATA_PTR = 0x8d71;
/** [seen] script delay countdown seeded by the script seeder, ticked/reseeded (0x8d73) */
export const SCRIPT_DELAY_TIMER = 0x8d73;
/** [code] matched script-row value byte, indexes the script flag table (0x8d74) */
export const SCRIPT_VALUE_BYTE = 0x8d74;
/** [seen] script down-counter gating attract-substate advance + the 14-row checksum, reloaded to 0x0d (0x8e52) */
export const SCRIPT_STEP_COUNTDOWN = 0x8e52;
/** [seen] (gwtrace pc=0b68 dec (0x8e53) x10, 0x04->0x00 countdown, read by the state-4 column-check gate) attract state-4 column-check tick countdown */
export const SCRIPT_COL_CHECK_TICK = 0x8e53;
/** [seen] 16-bit script read cursor, paired with the script write cursor (0x8e54) */
export const SCRIPT_READ_PTR = 0x8e54;
/** [seen] (MAME: n=36 v0=00 vN=08, cycles 0->8 exactly) rope-extend blit frame index 0..8 (0x8f1b) */
export const ROPE_EXTEND_FRAME_INDEX = 0x8f1b;
/** [code] hud refresh tick (0x8f4d) */
export const HUD_REFRESH_TICK = 0x8f4d;


// == Batch: decode pass #1 cells [code] (role from the frozen oracle; MAME-grounding pending) ==
/** [code] coin-jingle fixed follow-up rst-0x38 command */
export const DISPLAY_CMD_0300 = 0x0300;
/** [code] display/sound command word (0x04:0x00) enqueued via loc_0038 at start-of-life; the 2P path additionally fires 0x0401 */
export const START_OF_LIFE_DISPLAY_CMD = 0x0400;
/** [code] start-of-life display/sound command variant (0x04:0x01) enqueued only on a two-player game (ROM: inc e from 0x0400) */
export const START_OF_LIFE_DISPLAY_CMD_2P = 0x0401;
/** [code] board-intro rst-0x38 display command */
export const DISPLAY_CMD_0601 = 0x0601;
/** [code] display-command word 0x0613 enqueued via loc_0038 when the ascent checksum matches (DISPLAY_CMD_06xx family) */
export const DISPLAY_CMD_0613 = 0x0613;
/** [code] board-intro rst-0x38 display command */
export const DISPLAY_CMD_0616 = 0x0616;
/** [code] board-intro rst-0x38 display command, 1P variant (bonus DSW bit0 clear) */
export const DISPLAY_CMD_0617 = 0x0617;
/** [code] coin-jingle rst-0x38 display command for exactly one credit */
export const DISPLAY_CMD_0618 = 0x0618;
/** [code] coin-jingle rst-0x38 display command for more than one credit */
export const DISPLAY_CMD_0619 = 0x0619;
/** [code] board-intro rst-0x38 display command, 2P variant (bonus DSW bit0 set) */
export const DISPLAY_CMD_0628 = 0x0628;
/** [code] board-intro rst-0x38 display command, bonus DSW bit0 set variant */
export const DISPLAY_CMD_0629 = 0x0629;
/** [code] board-intro rst-0x38 display command, bonus DSW bit0 clear variant */
export const DISPLAY_CMD_062A = 0x062a;
/** [code] display command word (DE) enqueued into the page-0x88 command ring via loc_0038 during idx1 phase setup */
export const PHASE_SETUP_DISPLAY_CMD = 0x0683;
/** [code] original typeAttractTextColumn block (0x0ac8), byte-compared against its clone for tamper detection (TAMPER_CHECK_* family) */
export const TAMPER_CHECK_BLOCK_0AC8 = 0x0ac8;
/** [seen] ROM word table of attract script pointers (0x0bab), indexed by SCRIPT_COL_CHECK_TICK-1 via loc_0c45 */
export const ATTRACT_SCRIPT_PTR_TABLE = 0x0bab;
/** [code] 0xff-terminated ROM reference byte list scanned against the HUD tile strip (stride -0x20) in the epilogue integrity check */
export const EPILOGUE_HUD_SCAN_REF_TABLE = 0x20c2;
/** [code] ROM byte table indexed by ATTRACT_SUBSTATE (rst-0x20 lookup) whose result is cross-checked against the scanned strip cell */
export const EPILOGUE_SUBSTATE_LOOKUP_TABLE = 0x20cb;
/** [seen] ROM display-list graphic-stream pointer; committed to DISPLAY_LIST_SRC_PTR_ALT on the in-play, latch-clear, round==0 branch */
export const DLIST_GFX_ROUND0 = 0x44a9;
/** [code] ROM display-list graphic-stream pointer; committed to DISPLAY_LIST_SRC_PTR_ALT on the in-play, latch-clear, odd-round branch */
export const DLIST_GFX_ROUND_ODD = 0x462c;
/** [code] ROM display-list graphic-stream pointer; committed to DISPLAY_LIST_SRC_PTR_ALT on the shared alternate branch, round bit0 clear */
export const DLIST_GFX_ALT_EVEN = 0x46d6;
/** [code] ROM display-list graphic-stream pointer; committed to DISPLAY_LIST_SRC_PTR_ALT on the shared alternate branch, round bit0 set */
export const DLIST_GFX_ALT_ODD = 0x4872;
/** [code] ROM display-list layout-stream pointer; committed to DISPLAY_LIST_SRC_PTR on the shared alternate branch, round bit0 clear */
export const DLIST_LAYOUT_ALT_EVEN = 0x4a50;
/** [code] ROM display-list layout-stream pointer; committed to DISPLAY_LIST_SRC_PTR on the in-play, latch-clear, odd-round branch */
export const DLIST_LAYOUT_ROUND_ODD = 0x4b30;
/** [seen] ROM display-list layout-stream pointer; committed to DISPLAY_LIST_SRC_PTR on the in-play, latch-clear, round==0 branch */
export const DLIST_LAYOUT_ROUND0 = 0x4b55;
/** [code] ROM display-list layout-stream pointer; committed to DISPLAY_LIST_SRC_PTR on the shared alternate branch, round bit0 set */
export const DLIST_LAYOUT_ALT_ODD = 0x4bf6;
/** [code] ROM display-list graphic-stream pointer; committed to DISPLAY_LIST_SRC_PTR_ALT on the latch-set, round bit1 set branch */
export const DLIST_GFX_LATCH_B1 = 0x4c92;
/** [code] ROM display-list layout-stream pointer; committed to DISPLAY_LIST_SRC_PTR on the latch-set, round bit1 set branch */
export const DLIST_LAYOUT_LATCH_B1 = 0x4dce;
/** [code] ROM display-list graphic-stream pointer; committed to DISPLAY_LIST_SRC_PTR_ALT on the latch-set, round bit1 clear branch */
export const DLIST_GFX_LATCH = 0x4e81;
/** [code] ROM display-list layout-stream pointer; committed to DISPLAY_LIST_SRC_PTR on the latch-set, round bit1 clear branch */
export const DLIST_LAYOUT_LATCH = 0x5039;
/** [code] ROM reference-checksum bytes trailing advanceObjectAscentStep (0x68a3), summed against the tile block during the ascent integrity check */
export const ASCENT_CHECKSUM_REF = 0x68a3;
/** [code] anti-tamper clone of typeAttractTextColumn (0x6df9), byte-compared against the original block (TAMPER_CHECK_* family) */
export const TAMPER_CHECK_CLONE_6DF9 = 0x6df9;
/** [code] ROM word table of level-intro script-timer values, indexed by min(7, ROUND_COUNTER>>2) via loc_0c45 */
export const INTRO_SCRIPT_TIMER_TABLE = 0x70f3;
/** [code] ROM table (0x14 bytes) integrity-checksummed on the 2P credit-consume path */
export const CREDIT_CHECKSUM_TABLE = 0x776b;
/** [seen] base of the vertical tilemap column wiped during the phase-timer teardown; a stride-2 offset by the high-score insert rank (low byte only, page fixed at 0x80) yields the column pointer stored at 0x89fd */
export const WIPE_COLUMN_VRAM_BASE = 0x8045;
/** [code] scratch byte cleared at attract sub-state 0 / play state 0 entry (role unconfirmed -> loc_ name) */
export const loc_8819 = 0x8819;
/** [code] coin-counter 2 queued-pulse count: bumped by the per-frame coin step at 0x5a1f and drained one per completed strobe by the coin-2 pulse generator; twin of COIN1_PULSE_COUNT (0x8824) */
export const COIN2_PULSE_COUNT = 0x8826;
/** [code] coin-counter 2 pulse phase timer (seeded 0x30, drop point 0x18) */
export const COIN2_PULSE_PHASE = 0x8827;
/** [code] variant-C drip debounce ring: one input bit rotated in per frame, acted on at 3-bit phase 1 (sibling of DRIP_RING_A=0x8829) */
export const DRIP_RING_C = 0x882a;
/** [code] cadence ring for the per-frame step at 0x5a1f: rotated left each frame injecting an input-port bit; low 3 bits == 1 triggers the step */
export const DRIP_RING_B = 0x882d;
/** [code] first byte of the 0x5a1f step's pair (0x882e/0x882f; neighbor COINAGE_CONFIG_SLOT2): advanced +0x10 per step, wrapped against the second byte */
export const DRIP_COORD_B = 0x882e;
/** [seen] Launcher/player position coordinate; shifted >>3 (rrca x3 & 0x1f) with the flip-screen flag to derive the target column used to align an enemy shot. NOTE: axis (X vs Y) is unverified in this decode pass — the translated author's comment calls it the 'launcher position / target column'; confirm the axis in MAME during grounding. */
export const PLAYER_X_COORD = 0x8842;
/** [code] RAM counter incremented when the credit-consume integrity checksum folds nonzero */
export const CREDIT_TAMPER_COUNTER = 0x89ea;
/** [code] 16-bit tilemap pointer for the column wipe, built from WIPE_COLUMN_VRAM_BASE; the fill in dispatchRoundEndElseWipeColumn walks it stride +0x20 for 0x1c cells */
export const WIPE_COLUMN_VRAM_PTR = 0x89fd;
/** [code] fill tile value for the column wipe; seeded to 0x07 here, incremented each pass in dispatchRoundEndElseWipeColumn and clamped 0x10->0x06 */
export const WIPE_COLUMN_FILL_TILE = 0x89ff;
/** [code] 12-byte block cleared to 0 (rst 0x10 fill) only on a two-player start-of-life; grounding pending */
export const PLAYER2_START_CLEAR_BLOCK = 0x8e1f;
/** [seen] (gwtrace inc HL=0x8efe x1402, 0x01->0x7a wrapping) counter bumped each time the shared epilogue reaches its HUD-integrity check */
export const ATTRACT_EPILOGUE_TICK = 0x8efe;
/** [code] write-only address that decodes to a watchdog kick (value ignored) */
export const WATCHDOG_KICK = 0xa028;
/** [code] IN0 input hardware read port (start/coin/service buttons); loc_066d samples cpl(this) into INPUT_PORT0 each NMI */
export const IN0_PORT = 0xa080;
/** [code] LS259 latch bit 4 driving the physical coin counter 2 (write_d0: only bit 0 of the value lands) */
export const COIN2_COUNTER_LATCH = 0xa184;
/** [code] ROM source table copied into the high-score name-entry display buffer (0x1754) */
export const HIGH_SCORE_ENTRY_TABLE_SRC = 0x1754;
/** [code] ROM animation-descriptor pointer for the actor drop, seated into the record on arm (0x3bd1) */
export const DROP_ANIM_DESCRIPTOR = 0x3bd1;
/** [seen] address the backward power-on checksum scan begins at, walked down to the sentinel byte (0x64d5) */
export const CHECKSUM_SCAN_START = 0x64d5;
/** [code] packed ROM display-message source table for the attract reset (0x1e4c) */
export const ATTRACT_INIT_MESSAGE_SRC = 0x1e4c;
/** [code] display-command word queued to the rst-0x38 dispatcher on a credit-display refresh (0x0701) */
export const CREDIT_DISPLAY_COMMAND = 0x0701;
/** [code] 16-bit value stamped on the fire phase (0x03a0) */
export const FIRE_PHASE_SEED = 0x03a0;

export const ROUTINES = {
  // --- decode pass: rst-28 spine dispatchers (switch over MAME-confirmed handlers; loc_ names, cert code) ---
  0x7442: { name: "loc_7442", role: "attract/self-test state dispatcher: (0x8921)&3 -> table 0x7448 {0 init/ROM-check, 1 HUD-checksum, 2 gameplay driver}", cert: "code" },
  0x40d0: { name: "loc_40d0", role: "IX-object state dispatcher: inactive/oob guards then (ix+2)&0x1f -> table 0x40e1 (17 handlers)", cert: "code" },
  0x6822: { name: "loc_6822", role: "special-object (0x8b28) record state dispatcher, gated by 0x8afa -> table 0x6834 (3 handlers)", cert: "code" },
  0x71b9: { name: "loc_71b9", role: "bonus/eagle-stage phase dispatcher: (0x8f38) -> table 0x71c1 (3 handlers), then shared epilogue 0x02ef", cert: "code" },
  0x15a1: { name: "loc_15a1", role: "in-play sub-state dispatcher: (0x880a)&0x1f -> table 0x15a8 (19 handlers; idx 15/16/17 beyond frontier)", cert: "seen" },
  // --- decode pass #1 additions (40 leaves/second-entries; loc_ names, cert code) ---
  0x08b3: { name: "resetToAttractScreenStart", role: "attract sub-state 0 handler (attract dispatch target 0)", cert: "seen" },
  0x0b32: { name: "advanceAttractSequenceToPlay", role: "attract sub-state 6 handler", cert: "seen" },
  0x0bb5: { name: "advanceGameStateOnCreditOrStartPress", role: "shared attract/board-handler epilogue", cert: "seen" },
  0x0c2a: { name: "advanceAttractOnStartPress", role: "IN0 start-button poll during attract", cert: "code" },
  0x0c4e: { name: "dispatchBoardBuildSubstate", role: "board-build state dispatcher (NMI epilogue path)", cert: "seen" },
  0x0c5c: { name: "primeTileFillCursorAndAdvanceBoardBuild", role: "board-build state 0", cert: "seen" },
  0x0c77: { name: "fillIntroRowsThenBuildBoardIntro", role: "board-intro state 1: paint two tile-fill runs, count down, then build the intro", cert: "seen" },
  0x0d61: { name: "queueCreditDisplayAndEnterBoardBuild", role: "coin jingle: on a nonzero credit count, queue a credit display command (a distinct", cert: "seen" },
  0x0d78: { name: "startSelectedPlayerGameConsumingCredits", role: "coin/credit post-handler on the IN0 edge bits (INPUT_PORT0)", cert: "seen" },
  0x0da8: { name: "beginTwoPlayerStartOfLife", role: "thin entry that seats HL = the start-of-life state seed (256) and falls through to the", cert: "code" },
  0x0dab: { name: "startNewGamePlay", role: "start-of-life setup for a new game", cert: "seen" },
  0x0de4: { name: "startOnePlayerGameOnCredit", role: "the (0x8810) bit-3 coin/credit branch", cert: "seen" },
  0x0fc1: { name: "queueFixedSoundCommandRun", role: "enqueue the four-tile text sequence 0x29,0x15,0x16,0x17 into the text ring", cert: "code" },
  0x1694: { name: "clearDisplayMsgBufOnRoundInitMatch", role: "compare the terminated pattern against the display message buffer", cert: "seen" },
  0x16b7: { name: "selectRoundDisplayListAndAdvancePhase", role: "idx1 state handler. Decrements the phase timer and returns until it expires; then", cert: "seen" },
  0x1a01: { name: "reseedSpawnCountersAndArmPlayMode", role: "gameplay-state handler. Reseeds the spawn counters, seats the sprite attribute", cert: "code" },
  0x1a64: { name: "advancePhaseGaugeCountdown", role: "gameplay-state entry. While the play-mode latch is set it tails to the gameplay-state", cert: "seen" },
  0x1c03: { name: "advancePlayStateAndStageHighScoreEntryOnTimer", role: "play-state dispatch handler gated on the phase timer", cert: "seen" },
  0x1c66: { name: "dispatchRoundEndElseWipeColumn", role: "round-clear / game-over / player-swap master of the play-state dispatch handler", cert: "seen" },
  0x1cf6: { name: "reseedOtherPlayerForTurn", role: "reseed-the-other-player tail of the play-state dispatch handler", cert: "code" },
  0x1d0d: { name: "stampSecondScrollColumn", role: "stamp the three tiles of the second scroll column, top to bottom", cert: "seen" },
  0x1d15: { name: "clearActorsAndEnterContinueState", role: "full-clear tail of the play-state dispatch handler", cert: "code" },
  0x1d3c: { name: "resetGameToAttractState", role: "cold-teardown tail of the play-state dispatch handler", cert: "seen" },
  0x39af: { name: "advanceEnemyActorMotion", role: "enemy actor state handler (rst-0x28 dispatch target) for the record at IX", cert: "code" },
  0x39ba: { name: "advanceEnemyVerticalAndDispatchByAltitude", role: "advance the enemy actor's vertical position along its velocity, then branch on state", cert: "seen" },
  0x39e0: { name: "fireEnemyShotWhenAlignedWithPlayer", role: "gate the enemy \"fire / drop\" decision on the level counters, then in the shared tail", cert: "seen" },
  0x3a48: { name: "resetActorSubstateAndReloadStateTimer", role: "reset the enemy actor's sub-state and reload its state timer", cert: "code" },
  0x3a51: { name: "armActorDropAnimationNearTop", role: "arm the drop animation when the actor is near the top of its travel", cert: "seen" },
  0x3b87: { name: "advanceTravelingEnemyToArrival", role: "horizontal-travel phase of an enemy actor whose (+8) bit0 is clear", cert: "seen" },
  0x59e8: { name: "serviceCoinCreditAndCountersUnlessFreePlay", role: "credit/coinage-gated update chain", cert: "code" },
  0x5a1f: { name: "accrueCreditsFromCoinSlot2", role: "per-frame step B: rotate the cadence ring, on phase 1 bump the pulse count and feed the accumulate tail", cert: "seen" },
  0x5a56: { name: "accrueCreditFromCoin1Pulse", role: "per-frame step C: rotate one input bit into the ring at DRIP_RING_C and act on phase 1", cert: "seen" },
  0x5a8a: { name: "addFullWrapCreditAmount", role: "full-wrap entry into the shared score-accumulate tail", cert: "code" },
  0x5a8c: { name: "addCreditsAndQueueDisplay", role: "the shared accumulate tail of the three score drips", cert: "seen" },
  0x5a97: { name: "queueCreditDisplayRefresh", role: "queue the step's display command via rst-0x38", cert: "code" },
  0x5ac0: { name: "pulseCoinCounter2Latch", role: "coin-counter 2 pulse generator: turn queued coin pulses into a timed strobe on the", cert: "code" },
  0x6857: { name: "advanceObjectAscentStep", role: "object ascent step. Runs the object animation sequencer, then subtracts (rec+9) from", cert: "seen" },
  0x6da6: { name: "dispatchLevelIntroPhase", role: "level-intro / round-start phase dispatcher (top-level game state 2)", cert: "code" },
  0x6db8: { name: "seatIntroLaunchScriptAndAdvancePhase", role: "level-intro phase 0. Runs the shared per-frame sound run, picks a script-timer word", cert: "code" },
  0x7071: { name: "advanceAttractToBoardBuildIfImageIntact", role: "ANTI-TAMPER CLONE of advanceAttractSequenceToPlay (attract sub-state-6 handler), reached by the state-0", cert: "code" },
  0x0714: { name: "loc_0714", role: "sprite-attribute copy loop. Runs `count` passes. Each pass reads four source bytes, walking the source low byte so it wraps inside its 256-byte page:…", cert: "seen" },
  0x0a25: { name: "loc_0a25", role: "seeds the frame-animation cursor, then tail-hands to the two-slot tile painter, returning its result straight to this routine's own caller", cert: "code" },
  0x0a28: { name: "loc_0a28", role: "advance the 4-phase attract animation and repaint its tile block", cert: "seen" },
  0x0c45: { name: "loc_0c45", role: "little-endian word lookup: return table[index] from a word table", cert: "code" },
  0x0cf8: { name: "loc_0cf8", role: "stamp a two-plane column strip into video RAM", cert: "seen" },
  0x12d0: { name: "loc_12d0", role: "table lookup + object-field compare/dispatch for the record at IX", cert: "code" },
  0x1391: { name: "loc_1391", role: "spawned-flag guard in front of the field-compare dispatch", cert: "code" },
  0x1399: { name: "loc_1399", role: "state dispatch on the actor's sub-state byte (rec+6)", cert: "code" },
  0x1410: { name: "loc_1410", role: "stash the actor's step value, then branch on the stage countdown", cert: "code" },
  0x1c53: { name: "loc_1c53", role: "per-frame object driver, split on frame parity", cert: "code" },
  0x1f40: { name: "loc_1f40", role: "scan a table for a value, then draw the stage header", cert: "code" },
  0x20d4: { name: "loc_20d4", role: "per-frame object-update gate then the fixed helper chain", cert: "seen" },
  0x2101: { name: "runLaunchAndTargetActorPipeline", role: "boot-frontier sub-dispatch. Runs the three frontier sub-passes in order, once per call: the launch-sequence state driver, the one-shot slot-arming…", cert: "seen" },
  0x210b: { name: "spawnTargetActorOnLaunchTrigger", role: "one-shot target-slot spawn, gated by a trigger bit and a once latch", cert: "seen" },
  0x2157: { name: "stepActiveTargetActorRecords", role: "step the two target actor records", cert: "seen" },
  0x21cf: { name: "advanceTargetActorState", role: "per-object state step for the record based at IY", cert: "seen" },
  0x2226: { name: "advanceTargetActorAlongVelocityElseDespawn", role: "advance a two-axis moving object at IY", cert: "seen" },
  0x2282: { name: "loadPhaseMotionParamsAndAdvancePhase", role: "load the current phase's motion params, then step the phase", cert: "seen" },
  0x2329: { name: "movePlayerVerticallyAndTickStatusRender", role: "bidirectional position driver for the actor at IX", cert: "seen" },
  0x236a: { name: "movePlayerDownAndTickStatusRender", role: "descent half of the direction-split actor handler at IX", cert: "seen" },
  0x23a1: { name: "tickStatusRenderRingAndRedrawOnWrap", role: "shared render phase tick. Decrements the mod-8 ring counter; while it stays nonzero the caller just returns and the display holds. On wrap it borrows…", cert: "seen" },
  0x23ad: { name: "wrapRenderPhaseAndPaintTileTriplet", role: "shared render tail. Masks the phase counter at `phasePtr` to 0..3, looks up a tile-block descriptor for that phase, and stamps three 2x2 blocks two…", cert: "seen" },
  0x241e: { name: "advanceLeadActorPrimaryState", role: "per-frame driver for the lead actor group", cert: "seen" },
  0x25a6: { name: "loc_25a6", role: "per-frame lift/marker column driver at the layout pointer", cert: "code" },
  0x2778: { name: "dispatchLaunchState", role: "per-frame driver for the launch-sequence state machine", cert: "seen" },
  0x2901: { name: "loc_2901", role: "lead-actor state-0 step for the record based at IX", cert: "code" },
  0x29a0: { name: "loc_29a0", role: "descent state handler for the actor record at IX", cert: "code" },
  0x2a79: { name: "loc_2a79", role: "actor state-4 handler for the record at IX (dispatch slot 4)", cert: "code" },
  0x2b23: { name: "loc_2b23", role: "phase-timer tick with reset-scan re-entry", cert: "code" },
  0x2b59: { name: "loc_2b59", role: "integrity-strip reset scan. First blanks an eight-tall attribute column (one tile-row up each pass) to the base attribute value. Then checksums a…", cert: "code" },
  0x2b8d: { name: "loc_2b8d", role: "spawn/formation epilogue. Runs only once the lead actor has reached state 3 or more; below that it returns at once. At quorum it services the…", cert: "code" },
  0x2c2c: { name: "loc_2c2c", role: "sweep the 17 hunter records through the per-record state dispatcher", cert: "code" },
  0x2d66: { name: "driveRopeExtendAndRenderCells", role: "even-frame rope driver. Bails while a grab is in progress, or while the wave-arrival counter still sits at its hold value; otherwise runs the two…", cert: "code" },
  0x2d78: { name: "dispatchRopeExtendState", role: "per-frame driver for the rope-extend state machine", cert: "seen" },
  0x2e22: { name: "driveActiveRopeCells", role: "drive every active rope cell through its per-cell handler", cert: "code" },
  0x308b: { name: "loc_308b", role: "the formation manager. Does nothing while disabled. Once the formation is active it dispatches the low two bits of the state through the shared spine…", cert: "code" },
  0x32bd: { name: "loc_32bd", role: "shared teardown epilogue, keyed on the teardown-state byte", cert: "code" },
  0x3377: { name: "dispatchAllEnemyActorStates", role: "per-record state sweep. Walks the 14 enemy actor records in order, running the per-record state dispatcher on each. The record pointer is marshalled…", cert: "seen" },
  0x338a: { name: "dispatchActiveEnemyActorState", role: "low-state per-record dispatcher", cert: "seen" },
  0x357c: { name: "resolveTargetColumnAndArmApproach", role: "target-tile resolver + state step for an actor record at IX", cert: "seen" },
  0x3617: { name: "loc_3617", role: "pre-spawn guard. When B is below 0x20, tail to the frozen pre-spawn gate; otherwise bail. Reached by tail-jump from the target-tile resolver, so both…", cert: "code" },
  0x3625: { name: "loc_3625", role: "a guard on the actor record at IX, reached by a tail-jump from the phase dispatcher", cert: "code" },
  0x362d: { name: "loc_362d", role: "phase dispatch for the actor record at IX, gated by a per-actor delay", cert: "code" },
  0x365d: { name: "loc_365d", role: "pre-spawn gate. When the actor record's arm bit (rec+0x0b bit0) is set, require exactly one enemy-actor record whose +0x02 state byte holds the spawn…", cert: "code" },
  0x3680: { name: "spawnObjectIntoFreeSlot", role: "find a free actor slot in the IY table and spawn into the IX template", cert: "seen" },
  0x3757: { name: "advanceActorXAndDispatchMove", role: "advance an actor's X, then dispatch on the stage countdown", cert: "seen" },
  0x379d: { name: "spawnActorSlotFromTemplate", role: "initialise a new actor slot (at IY) from a template record (at IX)", cert: "seen" },
  0x3a6c: { name: "launchProjectileIntoFreeSlot", role: "launch a projectile into the first free slot of the 3-slot object table", cert: "seen" },
  0x3d99: { name: "armEnemyTurnAnimation", role: "enter the record's turn/select animation state", cert: "seen" },
  0x3f72: { name: "loc_3f72", role: "object state-14 handler. Ticks the record's animation, then counts down its frame timer and returns while it is still running. On expiry it advances the…", cert: "code" },
  0x3f7c: { name: "advanceFallingEnemyAndTallyCatchOnLanding", role: "object state-15 (catch) handler for the record based at IX", cert: "seen" },
  0x40bd: { name: "dispatchFormationObjectStates", role: "run the object-state dispatcher over the four formation records", cert: "code" },
  0x417a: { name: "loc_417a", role: "(re)arm an object record, then fall into its countdown tail", cert: "code" },
  0x53a0: { name: "loc_53a0", role: "spawn-one-actor entry wrapper. Seeds the spawn body's entry register with 0xff, then runs the body. The body always unwinds past this wrapper — its…", cert: "code" },
  0x54f9: { name: "loc_54f9", role: "spawn-slot scan: seed one actor into the first free block", cert: "code" },
  0x5544: { name: "loc_5544", role: "scan an actor-block table and seed the first free slot (spawn scheduler B tail)", cert: "code" },
  0x5594: { name: "loc_5594", role: "scan an actor-block table and seed the first free slot (frame-timer spawner tail)", cert: "code" },
  0x56e8: { name: "loc_56e8", role: "enemy-spawn tick. While the spawn timer is nonzero, decrement it and return. At zero, on an even round hand the spawn decision to the spawn gate;…", cert: "seen" },
  0x57c3: { name: "loc_57c3", role: "the sub-state head: decrement the phase counter and pick a branch", cert: "code" },
  0x57c6: { name: "loc_57c6", role: "eagle sub-state stepper / re-arm", cert: "seen" },
  0x5835: { name: "loc_5835", role: "spawn the singleton actor, or step it if it already exists", cert: "code" },
  0x5871: { name: "loc_5871", role: "actor-spawn gate. Latches the entry value into the speed index, then launches a new actor only when the active count is strictly below the stage…", cert: "seen" },
  0x588e: { name: "loc_588e", role: "initialise a run of sprite blocks", cert: "code" },
  0x5a06: { name: "loc_5a06", role: "per-frame accumulate step A (adds to the running total)", cert: "code" },
  0x5b71: { name: "loc_5b71", role: "fire gate for one actor record (based at IX)", cert: "code" },
  0x5b86: { name: "loc_5b86", role: "sweep the per-record collision check across the six enemy-actor records", cert: "seen" },
  0x5e78: { name: "loc_5e78", role: "gated actor-sweep driver. On an odd round only, hands the actor-record table to the per-slot sweep twice: a phase latch of 0 on the first pass and 1…", cert: "code" },
  0x5e98: { name: "loc_5e98", role: "enter the per-slot actor sweep for one interrupt-parity pair", cert: "code" },
  0x5ebd: { name: "loc_5ebd", role: "one iteration of the actor-sweep loop body", cert: "code" },
  0x5f06: { name: "loc_5f06", role: "tail of the actor sweep loop. Steps the actor pointer one record and the row pointer one row, then continues the sweep while slots remain; once the…", cert: "code" },
  0x5f6a: { name: "loc_5f6a", role: "walk the two actor-record slots through the per-slot handler, once per pass", cert: "seen" },
  0x5fa2: { name: "loc_5fa2", role: "one pass of the six-slot overlap scan: does the record at recPtr overlap the target box? An empty slot (record byte0 == 0) or a non-type-5 record…", cert: "seen" },
  0x6018: { name: "advanceOverlapScanToNextSlot", role: "the advance-and-loop latch of the six-slot overlap scan", cert: "code" },
  0x64e2: { name: "runObjectAndSpawnUpdatePass", role: "the fountain/spawn subtree driver, invoked by the even-frame branch of loc_1c53", cert: "code" },
  0x6e75: { name: "loc_6e75", role: "phase-1 spawner gate. With neither guard flag set, runs the single-object launcher then the per-record driver. A set flag would take a skip-spawn…", cert: "code" },
  0x6e86: { name: "loc_6e86", role: "scripted single-object launcher", cert: "code" },
  0x71c7: { name: "runEagleApproachPhaseFrame", role: "bonus phase-0 body. Step the eagle/arrow approach state machine, then run the shared per-frame object update.", cert: "code" },
  0x72a0: { name: "runWaveLaunchPhaseFrame", role: "bonus phase 1 body: run the shared per-frame update, then the wave-launch driver", cert: "code" },
  0x7621: { name: "advanceAllEnemyActorStates", role: "twin entry to the shared animation-tick walk", cert: "code" },
  0x76ea: { name: "runObjectAndEnemyActorUpdate", role: "a per-frame driver that runs three subsystems in order", cert: "code" },
  0x76f4: { name: "loc_76f4", role: "sweep the per-object state dispatcher over the six object records at OBJECT_STATE_RECORD_BASE (stride 0x18)", cert: "code" },
  0x020f: {
    name: "mainLoop",
    role: "the main-loop state driver: each iteration runs the per-frame worker or dispatches one display-ring handler; as the born-live generator it drains the ring within a frame and yields at the worker/ring-idle vblank boundary",
    cert: "code",
  },
  0x02aa: { name: "paintColumnBodyTiles", role: "stamp a tilemap column's two body tiles (mid + base)", cert: "seen" },
  0x02b1: { name: "blankTileColumn", role: "clear a three-cell tilemap column to the blank tile", cert: "seen" },
  0x02e6: { name: "seedTileFillCursor", role: "arm the row-by-row tile fill: point the write cursor + seed the row count", cert: "seen" },
  0x032a: { name: "copyObjectRecordsToDisplayList", role: "copy four raw bytes of each object record into the sprite display list", cert: "seen" },
  0x0378: { name: "mirrorSpriteListVertically", role: "mirror the sprite display list for a flipped screen", cert: "code" },
  0x03c2: { name: "renderPhaseGauge", role: "render the phase counter as a vertical HUD gauge", cert: "seen" },
  0x0429: { name: "splitBcdByte", role: "split a packed-BCD byte into two digit tiles: store the low nibble at the cursor, advance it, and return the high nibble (Z when zero)", cert: "seen" },
  0x0460: { name: "renderPanelFromTable", role: "paint the status panel from its tile source table", cert: "seen" },
  0x04f2: { name: "selectActivePlayerScoreBuffer", role: "select the active player's 3-byte BCD score-buffer pointer", cert: "code" },
  0x059d: { name: "renderDigitWithBlanking", role: "emit one digit tile with leading-zero blanking and step the cursor", cert: "seen" },
  0x062a: { name: "byteToPackedBcd", role: "convert a binary byte to packed BCD (value mod 100)", cert: "code" },
  0x0644: { name: "flagHighScoreTableCorruptOnChecksumMiss", role: "raise the high-score-table corrupt flag on a checksum miss", cert: "code" },
  0x072d: { name: "loc_072d", role: "attract state-0 handler: blank one tilemap row (early-return until drained), then on a passed boot self-test finish the attract-to-play setup (state advance + attribute flood + three display commands); a failed self-test tails into the main loop", cert: "seen" },
  0x075d: { name: "fillAttributeColumns", role: "flood the colour/attribute map from ATTRIB_MAP_BASE", cert: "seen" },
  0x08e9: { name: "loc_08e9", role: "attract sub-state 1 handler: blank one tick of the tilemap fill, and once it drains run two ROM-table integrity guards around the colour/attribute-map flood, enqueue two display commands, then advance ATTRACT_SUBSTATE to 7", cert: "seen" },
  0x0986: { name: "loc_0986", role: "attract sub-state 3: per-frame countdown gate that on expiry resets board-init RAM, re-arms the tile fill, advances the attract sub-state, and seeds the attract cursor word", cert: "seen" },
  0x09f8: { name: "loc_09f8", role: "step four object records' animations then rebuild the sprite display list", cert: "code" },
  0x0a0c: { name: "seedObjectRecord", role: "seed one object record from a descriptor and coordinate stream", cert: "seen" },
  0x0a40: { name: "paintTileBlock2x2", role: "stamp a 2x2 tile block", cert: "seen" },
  0x0e46: { name: "clearBit2AcrossSixSlots", role: "clear bit 2 across six stride-4 table entries", cert: "code" },
  0x0e8f: { name: "sendSoundCommand", role: "hand a command byte to the audio CPU and strobe its IRQ", cert: "seen" },
  0x0f97: { name: "queueRoundSoundCommandRun", role: "queue the round-derived sound-command run: pick a command byte from ROUND_COUNTER bits 1..2 + base, then tail-append its fixed sound-command run via the sound-command-run appender", cert: "code" },
  0x10c2: { name: "loc_10c2", role: "adjust a counter by A (entry carry = direction), store it, and repaint three stacked-BCD HUD fields, then advance the main-loop sub-state and queue a sound", cert: "code" },
  0x1119: { name: "drawStackedBcdDigits", role: "draw a packed-BCD byte as two stacked digit tiles, tens then units one row up, leading zero blanked", cert: "code" },
  0x1131: { name: "binToPackedBcd", role: "convert a binary count to packed BCD digits plus a hundreds tally", cert: "code" },
  0x1171: { name: "loc_1171", role: "enemy spawn-cadence tick: decrement the spawn timer, else (gated on stage-countdown vs active-count) sweep the 6 enemy records and initialise the first free one, aborting on the seed", cert: "code" },
  0x1383: { name: "loc_1383", role: "B-range guard: B >= 0x20 returns with A=B and no effect; else tail into the child-actor spawn loc_13bc, passing its A result through", cert: "code" },
  0x196e: { name: "loc_196e", role: "gated periodic siren-arm / shared event-countdown driver", cert: "seen" },
  0x19bc: { name: "clearActorArena", role: "zero the actor-record arena at board init", cert: "seen" },
  0x1a47: { name: "saveLiveStateToPlayerBank", role: "copy the live state page into the active player's bank", cert: "code" },
  0x1b43: { name: "loc_1b43", role: "0x15a8-dispatch play-state handler: tick+drain the tilemap clear then re-arm the fill, flood attribute columns, enqueue two display commands, run the shared integrity/timer handler, latch the play sub-state, fold an anti-tamper checksum, and copy a biased ROM string into the message buffer", cert: "seen" },
  0x1b80: { name: "copyBiasedTileString", role: "copy a ROM string into a tile buffer, biasing each byte", cert: "seen" },
  0x1b8c: { name: "loc_1b8c", role: "0x15a8-dispatch play-state handler (sibling of loc_1b43): tick+drain the tilemap clear then flood attribute columns, enqueue two display commands, run the shared integrity/timer handler, and latch the play sub-state index (0x0c) + phase timer (0x60)", cert: "code" },
  0x1bab: { name: "saveLivePageToPlayer0Bank", role: "latch player 1 active and snapshot the live page into player 0's bank", cert: "seen" },
  0x1cec: { name: "paintColumnBodyTilesUp", role: "stamp a column's two body tiles upward", cert: "seen" },
  0x1f8c: { name: "blitGlyphBlock4x3", role: "stamp a 4x3 glyph block into the tilemap", cert: "seen" },
  0x2065: { name: "paintPhaseGauge", role: "paint the vertical phase-gauge HUD tiles", cert: "seen" },
  0x208c: { name: "verifyRomSignature", role: "sample the code region against the reference table; flag a signature mismatch", cert: "code" },
  0x22d0: { name: "foldTargetPresenceBits", role: "rotate-fold the two enemy targets' presence bits into an accumulator", cert: "code" },
  0x23d7: { name: "deriveStackedSpriteYs", role: "write the three stacked sprite Y coordinates of the player actor", cert: "seen" },
  0x23ec: { name: "retreatTileAnimScript", role: "retreat the video-RAM tile strip on even parity ticks", cert: "seen" },
  0x2405: { name: "advanceTileAnimForwardOnOdd", role: "advance the video-RAM tile strip on odd parity ticks", cert: "seen" },
  0x2442: { name: "beginLeadActorLiftOnClear", role: "lead-actor arena state-0 handler: seed+snapshot the record, load the shape table, queue the tile-run sound", cert: "seen" },
  0x2473: { name: "dropLeadActorAfterDelay", role: "0x8a80-actor state-1 handler (dispatch 0x2436[1]): dec frame delay (ix+0x11), ret nz; on expiry reseed to 0x10 + inc state (ix+0x02) if (0x8a39)==0 else store it at (BC) via the mid-instruction overlap; then (ix+0x04)+=0x10, clear (ix+0x1e), load shape table 0x26c1 via loc_250f (pattern A)", cert: "seen" },
  0x2497: { name: "nudgeLeadActorAndAdvanceOnDelay", role: "actor-table (0x8a80) state-2 handler dispatched by advanceLeadActorPrimaryState table[2]: frame-delay countdown, on expiry advance the state, load the shape table via loc_250f, and nudge the primary record base-Y (+4) / secondary (-6)", cert: "seen" },
  0x24b9: { name: "descendLeadActorToLanding", role: "0x8a80-arena actor state-3 handler: alternate-frame sub-counter tick + Y advance toward the floor 0xdc, then pattern-A sound + frame-delay reseed + state advance once the floor is reached", cert: "seen" },
  0x24db: { name: "advanceActorDropStateOnDelay", role: "step a falling actor's record fields once its delay elapses", cert: "seen" },
  0x24fb: { name: "advancePlayStateToPhase7OnActorDelay", role: "actor-table state-5 handler (0x2436[5]): frame-delay countdown, then shape-flag stamp and fall-through into the shape loader", cert: "seen" },
  0x2a01: { name: "loc_2a01", role: "0x8a80 actor state-2 handler: reseat/flip/paint/advance the record, integrity-check the field attribute table (0x20-byte sum==1) — on mismatch tail-jump the loc_2c58 hunter guard (forwarding its caller-skip boolean), else enqueue display command 0x0615 and cap the wave-arrival counter at 8", cert: "code" },
  0x2ab3: { name: "advanceRisingActorStep", role: "step a rising actor one motion increment", cert: "code" },
  0x2ae8: { name: "clearActorArenaAndCounters", role: "zero the actor arena and reset the spawn/wave counters", cert: "code" },
  0x2b9a: { name: "loc_2b9a", role: "formation-spawn tick: ready-sprite helper + spawn-countdown + record-scan dispatch", cert: "code" },
  0x2bb3: { name: "loc_2bb3", role: "formation spawn scan over 0x11 records, launching the first free slot", cert: "code" },
  0x2cb3: { name: "loc_2cb3", role: "hunter dispatch state 1 (rst 0x2c50[1]): animation step + script-cursor walk applying a signed position delta, or the 0x88 animate opcode", cert: "code" },
  0x2f01: { name: "advanceHangingRopeObjectWithGrabCheck", role: "rope-cell timer handler (state 3): grab-test gated; on cell-timer zero re-arms the timer, updates the indexed formation record (dec tile / force pos=0xc0 / inc drop), bumps the cell state, and blits the rope segment", cert: "seen" },
  0x3307: { name: "blitTile3x3Block", role: "stamp a 3x3 tile block into video RAM", cert: "seen" },
  0x3325: { name: "blit2x2TileBlock", role: "copy four source bytes into a 2x2 video-RAM square", cert: "seen" },
  0x33bd: { name: "loc_33bd", role: "enemy-actor state-0 handler: tick the state timer, on expiry advance the frame and either fall into the turn-select tail (loc_33ca) or run the flap-reset arm", cert: "code" },
  0x33ca: { name: "loc_33ca", role: "shared turn-select tail (loc_33bd fall-through + call target): rst-0x20 limit lookup, branch on limit vs target column to seat frame+animation or defer to loc_3473", cert: "code" },
  0x3423: { name: "loc_3423", role: "enemy-actor state-1 entry prologue: step the animation frame, then dispatch the mode byte into loc_34f2/loc_343e or gate on the anim-armed latch and defer to loc_3473", cert: "code" },
  0x343e: { name: "loc_343e", role: "object X-movement handler: advance sub-position/column, and at the turn-column limit arm the turn-around or build+arm the interior sprite band (tails into loc_34b0 / setActorAnimation)", cert: "code" },
  0x3473: { name: "loc_3473", role: "interior-entry arm (mirror of loc_343e's 0x3473 block): gate on the anim-armed latch, step the capped phase, seed the turn-column limit + 2x2 interior sprite band, then fall into the shared movement tail loc_34b0", cert: "code" },
  0x34b0: { name: "loc_34b0", role: "shared enemy-despawn movement tail: blank the sprite band, drop the active-enemy/stage counters, conditionally bump the spawn-phase counter, and render the stage countdown to two HUD digits", cert: "code" },
  0x34c9: { name: "renderStageCountdownDigits", role: "draw the stage-countdown number as two HUD digits", cert: "seen" },
  0x34f2: { name: "loc_34f2", role: "object sub-position movement handler (m.call dispatch target from moveFormationAndSpawnObject): advance (ix+5) by the signed step with borrow into column (ix+6), compare masked column vs turn-column limit, then tail into loc_34b0 / disarm (ix+8) / tail into loc_3473", cert: "code" },
  0x3775: { name: "finishActorOrArmTurnaround", role: "end-of-move dispatch for an actor record: finish-blank the sprite band in phase 5, else arm a turn-around animation", cert: "code" },
  0x381e: { name: "setActorAnimation", role: "point an actor record at an animation sequence and restart it", cert: "seen" },
  0x3c92: { name: "loc_3c92", role: "object state-7 handler: tick animation + frame timer, then scan 4 formation records seating a child into the first free slot", cert: "code" },
  0x3fd5: { name: "advanceFallStep", role: "advance a falling actor one gravity step; carry set while still above the landing row", cert: "seen" },
  0x3fe9: { name: "verifyRomChecksum", role: "sum a ROM block and strike the state-10 tamper counter on deviation", cert: "code" },
  0x403c: { name: "advanceActorAnimFrame", role: "advance an actor's animation stream one frame", cert: "code" },
  0x57b4: { name: "adjustSpawnColumn", role: "shift the spawn-column index by wave progress in the early stages", cert: "code" },
  0x57e5: { name: "stampObjectAndDecCounter", role: "load a control byte, decrement the shared counter, and stamp two fixed state bytes into an object record", cert: "code" },
  0x585b: { name: "verifyTableChecksum", role: "sum a table and raise the ROM-check flag on mismatch", cert: "code" },
  0x5b06: { name: "flagTamperOnRound5ChecksumMiss", role: "bump the tamper freeze tally on the round-5 checksum miss", cert: "code" },
  0x5c75: { name: "storeActorAnimationPointer", role: "install a record's animation-script pointer and reset its frame index", cert: "seen" },
  0x5d1e: { name: "tickActorAnimHold", role: "count a record's animation hold down and step its phase", cert: "seen" },
  0x5d4d: { name: "loc_5d4d", role: "proximity-scan driver: test a fixed source object against 3 target/record pairs (SPRITE_TARGET_SLOTS stride 4 / PROJECTILE_TABLE stride 0x18), aborting the scan on the first hit", cert: "seen" },
  0x5e11: { name: "loc_5e11", role: "B-iteration proximity sweep: runs the grab trigger per target slot, advancing target/record pointers, aborting on a grab hit (caller of the dissolved skip loc_5e1f)", cert: "code" },
  0x5f02: { name: "loc_5f02", role: "enqueue the fixed sound command 0x05 into the sound-command ring (trampoline over the enqueue entry)", cert: "code" },
  0x5f11: { name: "loc_5f11", role: "proximity-collision slot scan: mark a struck slot + interrupt-parity flash cell + hit sound", cert: "code" },
  0x5f53: { name: "precheckCollisionBounds", role: "bias an actor's X and test whether its Y+margin clears the bottom", cert: "code" },
  0x613d: { name: "loc_613d", role: "matched-record handler: retire the IY record on +0 flag bit0 clear, reset it when the round is odd or ACTIVE_OBJECT_TYPE!=3, else scan the sprite object table (0x8b70, stride 0x18, 6 recs) to engage the first record whose +0x14 tag == A; every branch aborts the frame", cert: "code" },
  0x615d: { name: "loc_615d", role: "scan up to B actor records from IX (DE stride) for one whose +0x14 tag == A; engage the first match (engageMatchedSpriteObjectAndResetActor) else reset the actor record (resetActorRecordQueueSoundAndAbortFrame); both paths abort", cert: "code" },
  0x6166: { name: "resetActorRecordQueueSoundAndAbortFrame", role: "reset the IY actor record to its idle opening state, enqueue a fixed sound command by ACTIVE_OBJECT_TYPE, then abort the caller frame (dissolves loc_618a)", cert: "seen" },
  0x6190: { name: "engageMatchedSpriteObjectAndResetActor", role: "mark the matched target record (IX): +8:=0x01, +0xa:=0xd0, then reset the actor record (resetActorRecordQueueSoundAndAbortFrame) and abort", cert: "seen" },
  0x619f: { name: "initActorRecord", role: "stamp the fixed opening state into a fresh actor record", cert: "seen" },
  0x62e6: { name: "loc_62e6", role: "tag-match a record, apply its round-indexed position delta, re-arm it (bit5 + anim pointer 0x634f), then clear the I-parity target record; caller of the dissolved skip loc_6274", cert: "code" },
  0x6381: { name: "loc_6381", role: "seed the proximity scan (coord table 0x887c, record list 0x8be8, 3 slots) and forward loc_638a's skip result", cert: "code" },
  0x6666: { name: "advanceActorGroupRiseAndCycleTiles", role: "rst-0x28 handler (index 2): walk three actor records backward from IX (stride -0x18) running the idle-actor advance advanceActorToTopRowThenRetire on each, then run the countdown-gated blink animation cycleActorGroupSpriteFramesOnTimer over the hunter table (0x8c78)", cert: "code" },
  0x66c5: { name: "updateEnemyActorsAndCycleLaunchFlipAnim", role: "run dispatchEnemyActorState over 3 enemy-actor records (IX, stride 0x18); then unless the lead state byte (0x8ae2) is clear, step the (0x892d) countdown: decrement while live, on expiry reload 0x10, bump the flip toggle (0x892f), and enqueue a flip display command (0x0612 when toggle bit0 set else 0x0692) via loc_0038", cert: "seen" },
  0x66f1: { name: "dispatchEnemyActorState", role: "per-record state dispatcher: routes (ix+2) of four (0..3) to the record's per-frame state handler via tail dispatch", cert: "code" },
  0x6a0f: { name: "loc_6a0f", role: "enemy-spawn sweep driver: gate on the blink phase/countdown, then sweep the 18 enemy records and spawn into the first empty one — one spawn per frame, aborting on that spawn (dissolves loc_6a35 to a boolean)", cert: "code" },
  0x6a7f: { name: "loc_6a7f", role: "per-frame object driver: when blink-phase (0x892b) set, run loc_6a98 over 18 enemy-actor records (0x8ae0, stride 0x18); else at wave index (0x892d)==2, once per pass (latch 0x8f56), checksum the playfield tilemap from 0x8450 (skip col 0x1b, row +0x12, stop h>=0x88; expect 0x29b8) and throw on mismatch", cert: "code" },
  0x6a98: { name: "loc_6a98", role: "per-object state dispatcher: rst-0x28 route (state-1)&3 to loc_6aa8 / reinitRoundArenaAndPlayfieldIfImageIntact", cert: "code" },
  0x6c18: { name: "clearAimIndicatorUnlessProximityHit", role: "proximity-scan driver: walks 3 projectile records testing each against the fixed sprite record, aborts the scan on a hit, else clears the aim indicator bits + hit flag", cert: "seen" },
  0x6edb: { name: "loc_6edb", role: "phase-1 driver: run loc_6f2d over the 14 enemy-actor records (0x8ae0, stride 0x18); when the launch script (0x8f4a) hits 0xff and all 3 projectile slots (0x8bea, stride 0x18) are idle, inc intro phase (0x8f51), queue cmd 0x0635, force phase 4 + queue 0x0610 on 3*(0x8f47)==(0x8f52) else queue 0x0608, set intro delay (0x8f48)=0x40, clear 0x30 bytes at 0x8c90", cert: "code" },
  0x7292: { name: "advanceEaglePhaseAndClearAim", role: "step the eagle's phase and clear its aim flags", cert: "seen" },
  0x7707: { name: "dispatchActiveObjectState", role: "run one active object record's per-frame state handler, selected by (IX+2)&3 of four; inactive records are skipped", cert: "seen" },
  0x7e94: { name: "loc_7e94", role: "the write-anim dispatch redirect (a per-frame pre-pass): gated by the run-once latch (RESET_SCAN_LATCH) and HIGH_SCORE_INSERT_RANK, else selector loc_8e26 picks one of three write-anim handlers, then tail into the start-button poll startGameOnStartButtonPress", cert: "seen" },
  0x7eb2: { name: "loc_7eb2", role: "write-anim handler 0: seed the animation work block (loc_8e2x) with pointers/fields from the config + player-select cells", cert: "code" },
  0x7f0e: { name: "loc_7f0e", role: "write-anim handler 1: count down the 16-bit anim counter (loc_8e2b); on zero tail to loc_7fa8, else step the index and tail to loc_7f5d", cert: "code" },
  0x7f5d: { name: "loc_7f5d", role: "write-anim handler 2: rotate the phase ring (loc_8e29); on phase 1 advance the block pointers, drain the row countdown, and tail to loc_7fa8 when it empties", cert: "code" },
  0x7fa8: { name: "loc_7fa8", role: "write-anim shared tail (reached from loc_7f0e/loc_7f5d): queue a sound (queueSoundCommand00), flood-fill `count` tile/record cells, then reload PHASE_TIMER and set the run-once latch", cert: "code" },
  0x780f: { name: "paintTileBlock2x2Above", role: "stamp a 2x2 tile block anchored one row above", cert: "seen" },
  0x0000: { name: "loc_0000", role: "power-on reset vector: disable the vblank NMI latch, then tail into the boot entry loc_0092", cert: "seen" },
  0x0066: { name: "loc_0066", role: "Z80 NMI vector: jump to the vblank service routine loc_066d", cert: "code" },
  0x066d: { name: "loc_066d", role: "vblank NMI service routine (the sole per-frame heartbeat): masks NMI, rebuilds the scroll columns via loc_0714, shifts the input edge-detect ring, ticks two frame counters, services coins + the sound ring, dispatches on MAIN_GAME_STATE, then latches flip-screen and re-arms NMI", cert: "seen" },
  0x0010: { name: "loc_0010", role: "fill a run of bytes with a constant, advancing the pointer (a zero counter fills 256)", cert: "seen" },
  0x0020: { name: "loc_0020", role: "rst-0x20 byte-table lookup: HL += A then A := (HL)", cert: "code" },
  0x0038: { name: "loc_0038", role: "enqueue a two-byte display command into the page-0x88 display-command ring", cert: "seen" },
  0x02a8: { name: "loc_02a8", role: "stamp a three-tile vertical tilemap column (cap + two body tiles)", cert: "seen" },
  0x02e3: { name: "loc_02e3", role: "arm the row-by-row tile fill from the fixed VRAM start (the reset-to-0x8402 variant)", cert: "code" },
  0x0320: { name: "loc_0320", role: "tick a caller-set frame counter, then run the flip-screen mirror pass when the orientation flag is zero", cert: "seen" },
  0x0343: { name: "loc_0343", role: "build sprite display-list entries from moving-object records, deriving screen coordinates from their sub-pixel position pairs", cert: "seen" },
  0x039b: { name: "loc_039b", role: "paint the count column: fill N tiles then blank the rest of an 8-cell VRAM column, N from the actor-table count clamped to 8", cert: "code" },
  0x0439: { name: "loc_0439", role: "render ten rows of packed-BCD panel digits into video RAM (delegates the per-nibble split)", cert: "seen" },
  0x0552: { name: "loc_0552", role: "reset one of three 3-byte BCD counters and repaint it in its HUD column via the digit painter", cert: "seen" },
  0x056b: { name: "loc_056b", role: "draw one of three packed-BCD counters down a screen column, leading zeros blanked", cert: "code" },
  0x05b2: { name: "loc_05b2", role: "draw a table-selected field of stacked characters bottom-up into video RAM (digit or blank mode per selector bit 7)", cert: "seen" },
  0x0a52: { name: "loc_0a52", role: "paint two 2x2 tile blocks into video RAM from one shared source pattern", cert: "code" },
  0x0e53: { name: "noopStateHandler", role: "phantom no-op (bare ret); display-list dispatch target that returns without drawing", cert: "code" },
  0x0e64: { name: "drainSoundCommandRing", role: "drain one entry from the sound-command ring buffer and dispatch it to the audio CPU (gated by demo-sounds/game-active), then free the slot and advance the head", cert: "seen" },
  0x0ea2: { name: "appendSoundCommandGated", role: "append one byte into the page-0x8a00 sound-command ring (gated on game-active/play-mode), then advance and wrap the ring cursor", cert: "seen" },
  0x0eb3: { name: "enqueueSoundCommandRing", role: "enqueue a command byte into the sound-command ring buffer (advance the write pointer, wrapping 0x5e->0x43)", cert: "seen" },
  0x0f09: { name: "emitPresetSound", role: "emit the preset sound command to the audio CPU", cert: "code" },
  0x13bc: { name: "loc_13bc", role: "find a free sprite-object slot and spawn a child actor into it: bump the anim counter, seed the parent record, tail into the child-spawn init", cert: "code" },
  0x141c: { name: "loc_141c", role: "gate an actor's spawn/queue step on its phase field; below threshold, clear a field and (re)start its animation", cert: "code" },
  0x142c: { name: "loc_142c", role: "spawn/init a child actor record (IY) from parent (IX): fixed slots, biased position copy, round-negated speed-table lookup, velocity mirror, anim vector + timer, tail spawn-sound enqueue", cert: "code" },
  0x1601: { name: "loc_1601", role: "gameplay-state idx0 handler: round init (fill-drain gate, round-init RAM + actor-arena clear, first-entry latch/display-command/attribute flood, then phase-timer seed + saved-bank restore + message-table copy)", cert: "seen" },
  0x18da: { name: "loc_18da", role: "pending bonus-award tally step: reload award queue when empty, else gate on active player's score MSB == queued value, bump saturating gauge, BCD-step the queue, render gauge + append tally sound", cert: "seen" },
  0x191c: { name: "loc_191c", role: "choose the enemy speed/column value for a new target group (gated), commit it to the speed index and clear the aim flags plus two adjacent cells", cert: "code" },
  0x1a85: { name: "loc_1a85", role: "redraw the phase gauge, then set the play sub-state index for the active player", cert: "seen" },
  0x1bcc: { name: "loc_1bcc", role: "player-state bank snapshot + signature-checksum tripwire: copy the live page into player 1's bank, clear the sub-state index, bump the signature tamper counter unless a fixed program block folds to its sentinel", cert: "code" },
  0x1ce7: { name: "loc_1ce7", role: "stamp a three-cell vertical tilemap column: cap tile then the two body tiles one row up each", cert: "code" },
  0x1dd3: { name: "loc_1dd3", role: "paint the playfield colour/attribute map for the current field variant (default two-column job or alternate strip)", cert: "seen" },
  0x1e55: { name: "loc_1e55", role: "per-frame joystick sampler for the player-actor state byte: abort/freeze flags zero it, else store the complemented joystick and rotate its bit4 through a shift latch that gates clearing the state byte's bit4", cert: "seen" },
  0x1ffb: { name: "loc_1ffb", role: "render one of two glyph blocks (selected by B bit5) into the tilemap via blitTile3x3Block", cert: "seen" },
  0x22e6: { name: "advanceActorAnimationFrame", role: "step one actor's animation script, pulling/advancing the shared script cursor when its frame countdown expires", cert: "seen" },
  0x2563: { name: "blitTwoTileAnimFrameOnHoldTimer", role: "frame-gated two-tile animation: hold-countdown timer that on expiry blits two 2x2 tile squares selected by round/phase parity", cert: "seen" },
  0x278f: { name: "armLaunchAndAdvanceToHunterSpawn", role: "launch state machine state 0: arm and gate the arrow/rope launch, advance the state, and blit the launch tile", cert: "seen" },
  0x28c5: { name: "loc_28c5", role: "phantom no-op (bare ret); launch-state-machine idle state and a neighbour's rst-0x10 landing", cert: "code" },
  0x2bd3: { name: "loc_2bd3", role: "paint the ready-sprite 2x2 tile square unless it is already present", cert: "code" },
  0x2c85: { name: "loc_2c85", role: "per-record helper: on state 0x11 advance to 0x12, arm the animation, and seed the script pointer", cert: "code" },
  0x2e45: { name: "tickRopeCellFrameTimer", role: "decrement one of the four rope-cell frame timers selected by IXL&3; leave its address in HL and reached-zero in the Z flag", cert: "seen" },
  0x3266: { name: "loc_3266", role: "hunter-formation dispatch state 2: ROM self-check summing a 0x20-byte block to the 0xdc sentinel (traps on mismatch)", cert: "code" },
  0x3278: { name: "loc_3278", role: "board tile-sum check: once-per-arm, sum the playfield and match it against a ROM table (miss = data-integrity trap)", cert: "code" },
  0x4006: { name: "advanceObjectAnimationFrame", role: "step one object's animation sequence (frame-hold countdown + script walk) for the record at IX", cert: "seen" },
  0x416f: { name: "loc_416f", role: "per-object dwell-then-dispatch step: animate the object, count down its dwell timer, and on expiry tail into the next-state band-blank handler", cert: "code" },
  0x4179: { name: "loc_4179", role: "phantom no-op (bare ret); a call target that returns without doing work", cert: "code" },
  0x418d: { name: "loc_418d", role: "object countdown step: on (ix+0x11) expiry enqueue a display command, reseat (ix+0x11)/(ix+0x13)/(ix+0x02), and tail into the dwell-then-dispatch handler loc_416f", cert: "code" },
  0x423a: { name: "loc_423a", role: "interior-entry arm: clear the turn-column limit and arm the 0x4212 turn animation", cert: "code" },
  0x425c: { name: "loc_425c", role: "arm an actor's turn animation (interior entry): latch the turn-column limit and point the record at the 0x4203 animation script", cert: "code" },
  0x4364: { name: "loc_4364", role: "object state handler: count the (ix+0x11) phase timer down while non-zero; once zero, step the animation, advance a fall step, and blank the actor's sprite band on landing", cert: "code" },
  0x4378: { name: "loc_4378", role: "phantom no-op (bare ret); a called stub with no effect", cert: "code" },
  0x4381: { name: "paintDisplayListRunToVram", role: "display-list interpreter: copy/skip/reload a source stream into video RAM, advancing the chosen dest/src pointer pair", cert: "seen" },
  0x4a0b: { name: "loc_4a0b", role: "draw the round marker: snapshot the spawn-phase count then paint the marker column + 3x3 glyph, gated on the round counter's low bit", cert: "code" },
  0x5a9c: { name: "loc_5a9c", role: "coin-counter 1 pulse generator: strobe the coin-counter latch from the queued pulse count + phase timer", cert: "seen" },
  0x5d0b: { name: "loc_5d0b", role: "tick the animation-hold countdown for each of the six enemy actor-table records", cert: "code" },
  0x64fb: { name: "runActorGroupStateHandler", role: "dispatch the 0x8c78 fountain record's per-frame state handler, selected by state byte (IX+2) of three (0/1/2)", cert: "code" },
  0x6566: { name: "animateActorGroupGrowShrink", role: "per-frame fountain-record animation step gated by the flip countdown; on expiry runs the toggle-selected grow/shrink half over three mirror record banks, rendering the records (shrink) or reseeding timers and running the mirror-bank integrity sweep (grow)", cert: "seen" },
  0x667c: { name: "advanceActorToTopRowThenRetire", role: "advance one actor while its state byte is idle, retiring the record at the top row (0x1d)", cert: "seen" },
  0x66a1: { name: "cycleActorGroupSpriteFramesOnTimer", role: "countdown-gated sprite-table applier: dec the 0x892b countdown (ret while live); on zero reload 0x08, advance the select phase (0x892c), pick a 3-tile source table by the phase's bit0, and apply it to three actor records (stride -0x18) via copyDisplayTilesIntoActorRecords", cert: "seen" },
  0x66fd: { name: "advanceEnemyActorToDescentStateOnDelay", role: "run an actor's shared phase countdown; on expiry advance the phase, record fields, animation and tile id", cert: "seen" },
  0x67df: { name: "reinitRoundArenaAndPlayfieldIfImageIntact", role: "screen re-init behind a colour-map integrity checksum: arm the round flags, clear the timer block + actor arena, paint the playfield square of the blank tile; a checksum miss tails to the per-object frame updater", cert: "seen" },
  0x683a: { name: "loc_683a", role: "advance an object record to its next state: phase bump, field reseed, and animation arm", cert: "seen" },
  0x68ac: { name: "loc_68ac", role: "once-only playfield tile-region tamper checksum and dispatch (returns on match, throws on tamper)", cert: "seen" },
  0x6b13: { name: "blitStackedTwoTileAnimFrameOnHoldTimer", role: "frame-gated two-tile blitter: on hold expiry, reload+advance phase and stamp a phase-selected 2x2 block at two screen positions", cert: "seen" },
  0x6b3b: { name: "loc_6b3b", role: "deferred-object promoter: on countdown fire, promote in-range enemy records into the promoted-object list and queue the promotion's display commands, then rebuild the sprite list", cert: "code" },
  0x6f2d: { name: "loc_6f2d", role: "per-record state dispatch for the enemy-actor table: state 2 -> tickActorHoldThenBlankAndClearWaveLatches hold-tick, states <0x0b -> advanceObjectAnimationFrame mover, states 0x0b/0x0c -> seedEnemyFromDescriptorAndEnterFlight/advanceInFlightEnemyAndLand via the 2-entry table at 0x6f3e", cert: "code" },
  0x6f42: { name: "loc_6f42", role: "level-intro phase 2: advance the intro phase and draw the target-hit tally as two stacked digit pairs", cert: "code" },
  0x7287: { name: "armEagleFinishAtGridEdge", role: "eagle grid-advance guard: return the eagle coordinate until it reaches the grid edge, then arm the done latch and run the phase-reset epilogue", cert: "seen" },
  0x72e1: { name: "seedNextEagleWave", role: "seed the next eagle attack wave: raise the launch flag, advance the wave index, and initialise the per-wave enemy records (or re-arm on the 4th wave)", cert: "seen" },
  0x744e: { name: "seedDisplayListPointersAndVerifyRomSignature", role: "attract/self-test state 0: seed the display-list pointer pairs + sub-phase tick, advance the self-test selector, and run the two-stage program-signature check (abort to reinitRoundArenaAndPlayfieldIfImageIntact on a miss)", cert: "seen" },
  0x7517: { name: "runDisplayListAndAdvanceToGameplay", role: "display/self-test dispatch state 1: run the display-list interpreter, tick a mod-0x1c counter and a one-shot sub-phase, column-sum two video-RAM strips as a HUD integrity check, and advance the selector to state 2 on a clean sum", cert: "seen" },
  0x7625: { name: "advanceFirstGroupEnemyActorStates", role: "twin entry to the shared animation-tick walk: seed the 8-record count and run the walk over the enemy-actor array", cert: "code" },
  0x7627: { name: "advanceEnemyActorStateWalk", role: "shared per-frame animation-tick walk: tick a count of enemy-actor records (stride 0x18) via the per-entry tick, aborting early when a tick signals a phase-transition reseed", cert: "code" },
  0x76af: { name: "blinkTilePairOnCountdown", role: "two-phase blink timer: on countdown expiry toggle the phase and swap a video tile pair", cert: "seen" },
  0x7912: { name: "loc_7912", role: "tick the active player's BCD play-timer (frame sub-counter 0..0x3b/0x3c then BCD seconds/minutes carry)", cert: "seen" },
  0x7e6d: { name: "loc_7e6d", role: "periodic anti-tamper ROM checksum guard; bumps the ROM tamper-strike counter on a signature miss", cert: "code" },
  0x0092: { name: "loc_0092", role: "power-on boot entry: program-memory self-test + full initial RAM/ring/DSW setup, then hand off to the main-loop generator", cert: "seen" },
  0x01ea: { name: "loc_01ea", role: "boot RAM clear: fill both sprite-bank tops with A + blank lower video RAM to tile 0x1e, then cycle-only settle-delay", cert: "seen" },
  0x0254: { name: "loc_0254", role: "per-frame scroll worker dispatched by the main loop: repaint the scroll tile columns, or run the program-signature check when the control byte's low nibble is set", cert: "seen" },
  0x02b9: { name: "loc_02b9", role: "zero the board-init RAM regions (sprite display list + actor/object arena)", cert: "code" },
  0x02c9: { name: "loc_02c9", role: "clear the board-init RAM regions, then blank one tilemap row at the fill cursor and decrement the row counter (Z = drained)", cert: "code" },
  0x02ce: { name: "loc_02ce", role: "row-by-row VRAM tile fill: blank B tiles at the fill cursor (loc_0010), advance one row (+0x20-B), store cursor, dec row counter; Z = drained", cert: "seen" },
  0x02ef: { name: "loc_02ef", role: "per-frame sprite display-list rebuild (4 record groups + arrow Y-tick + flip-mirror tail)", cert: "seen" },
  0x03e9: { name: "loc_03e9", role: "paint the attract HUD/score panels: eleven selector fields, the ten-entry high-score table as stacked BCD digit pairs, then the digit and status panels", cert: "seen" },
  0x0496: { name: "loc_0496", role: "accrue the active player's BCD score and keep the high score in step", cert: "seen" },
  0x05ee: { name: "loc_05ee", role: "draw the credit count as two HUD digit tiles, then run a ROM-checksum anti-tamper tripwire", cert: "seen" },
  0x0e00: { name: "resetActorStateForBoard", role: "reset the actor/sprite state for a new board", cert: "seen" },
  0x0e54: { name: "queueCreditDisplayCommands", role: "queue the primary display command, plus the free-play extra command when the coinage config is the free-play sentinel", cert: "code" },
  0x0ecf: { name: "queueSoundCommand00", role: "sound-command selector 0x00: A=0, tail-enqueue into the sound-command ring (enqueueSoundCommandRing)", cert: "code" },
  0x0ed2: { name: "queueSoundCommand01", role: "queue command 0x01 into the sound-command ring (thin wrapper over appendSoundCommandGated)", cert: "code" },
  0x0ed6: { name: "queueSoundCommand02", role: "enqueue the fixed sound command 0x02 into the sound-command ring", cert: "code" },
  0x0eda: { name: "queueSoundCommands82And03", role: "queue two fixed sound commands into the sound-command ring", cert: "code" },
  0x0ee3: { name: "queueSoundCommand04IfNotBusy", role: "conditional sound-command enqueue: gated on wave-teardown/grab-active, then tail-appends command 0x04 to the page-0x8a command ring", cert: "code" },
  0x0ef1: { name: "queueSoundCommand05", role: "enqueue fixed sound command 0x05 into the sound-command ring (wrapper over enqueueSoundCommandRing)", cert: "code" },
  0x0ef5: { name: "queueSoundCommand06", role: "sound-command stub: append the fixed command byte 0x06 into the page-0x8a sound-command ring via appendSoundCommandGated", cert: "code" },
  0x0ef9: { name: "queueSoundCommand07", role: "append the fixed byte 0x07 into the page-0x8a command ring (load the constant, tail-call the ring appender)", cert: "code" },
  0x0efd: { name: "queueSoundCommand08", role: "command 0x08: append the fixed byte 0x08 into the page-0x8a command ring", cert: "code" },
  0x0f01: { name: "queueSoundCommand09", role: "sound-command selector 0x09: A=9, tail-enqueue into the sound-command ring (enqueueSoundCommandRing)", cert: "code" },
  0x0f05: { name: "queueSoundCommand0A", role: "queue command 0x0a into the sound-command ring (thin wrapper over appendSoundCommandGated)", cert: "code" },
  0x0f0d: { name: "queueSoundCommand0B", role: "append the fixed command byte 0x0b into the page-0x8a command ring", cert: "code" },
  0x0f11: { name: "queueSoundCommand0C", role: "enqueue the fixed command byte 0x0c into the sound-command ring (via the ring-append helper)", cert: "code" },
  0x0f15: { name: "queueSoundCommand0D", role: "append fixed command byte 0x0d to the 0x8a-page sound-command ring (wrapper over appendSoundCommandGated)", cert: "code" },
  0x0f19: { name: "queueSoundCommand0E", role: "command emitter: append the fixed byte 0x0e into the page-0x8a command ring (thin wrapper tail-calling appendSoundCommandGated)", cert: "code" },
  0x0f1d: { name: "queueSoundCommand0F", role: "append the fixed byte 0x0f into the page-0x8a ring via appendSoundCommandGated", cert: "code" },
  0x0f21: { name: "queueSoundCommands95And10", role: "queue two command bytes (0x95 then 0x10) into the sound-command ring", cert: "code" },
  0x0f2b: { name: "queueSoundCommand11", role: "sound-command stub: append the fixed command byte 0x11 into the page-0x8a sound-command ring via appendSoundCommandGated", cert: "code" },
  0x0f30: { name: "queueSoundCommands95And03And11", role: "queue three fixed command bytes (0x95, 0x03, 0x11) into the sound-command ring via the append helper (last is a tail call)", cert: "code" },
  0x0f3f: { name: "queueSoundCommand12", role: "queue the page-0x8a text-ring sound command 0x12", cert: "code" },
  0x0f44: { name: "queueSoundCommand13", role: "queue command byte 0x13 into the sound-command ring", cert: "code" },
  0x0f49: { name: "queueSoundCommand14", role: "queue the fixed command byte 0x14 into the sound-command ring (tail call to the append helper)", cert: "code" },
  0x0f4e: { name: "queueSoundCommands82And95", role: "enqueue two fixed sound commands (0x82, 0x95) into the sound-command ring buffer (last is a tail call)", cert: "code" },
  0x0f58: { name: "queueSoundCommands96And97And18And15", role: "queue four fixed command bytes: 0x96,0x97 into the sound-command ring; 0x18,0x15 into the sound ring", cert: "code" },
  0x0f6c: { name: "queueSoundCommands19And15", role: "enqueue two sound commands (0x19 then 0x15) into the sound-command ring", cert: "code" },
  0x0f76: { name: "queueSirenSoundRun", role: "when the siren gate is clear, append the round-selected siren lead byte plus the completing sound-command run to the command ring; otherwise return", cert: "code" },
  0x0f88: { name: "queueSound82ThenRun1C", role: "sound-command trampoline: emit an lead byte then tail-append a four-byte sound-command run to the page-0x8a command ring", cert: "code" },
  0x0f92: { name: "queueSoundRun1D", role: "queue the phase-exhausted sound-command run (fixed lead byte 0x1d) via the sound-command-run appender", cert: "code" },
  0x0fa2: { name: "queueRoundVariantSoundRun", role: "select 1 of 4 sound-command bytes 0x22..0x25 from the round counter (bits 1-2) and append that sound-command run to the command ring (tail into the run-append helper)", cert: "code" },
  0x0fad: { name: "queueSoundRun26", role: "queue the sound-command run opening with sound-command byte 0x26 (tail into appendSoundCommandRun)", cert: "code" },
  0x0fb2: { name: "queueSoundCommands27And15", role: "enqueue sound commands 0x27 then 0x15 into the sound-command ring", cert: "code" },
  0x0fbc: { name: "queueSoundRun28", role: "enqueue sound bytes 0x28,0x15,0x16,0x17 into the sound-command ring", cert: "code" },
  0x0fc3: { name: "appendSoundCommandRun", role: "append a sound-command run (caller byte + 0x15/0x16/0x17) to the command ring", cert: "code" },
  0x1389: { name: "loc_1389", role: "spawn-step guard: gate the actor spawn/queue step (loc_141c) on bit0 of the record's flag byte (rec+8)", cert: "code" },
  0x19ca: { name: "loc_19ca", role: "periodic warning-siren tick: gated frame countdown that toggles a phase and queues one of two siren display commands", cert: "code" },
  0x1a96: { name: "loc_1a96", role: "phase-exhausted handler: advance the play sub-state, clear round cells, tail to the high-score insert-sort", cert: "seen" },
  0x1ab2: { name: "loc_1ab2", role: "insert the active player's score into the sorted 10-entry high-score table and its parallel play-time / display-tile side-tables (high-score insert-sort)", cert: "code" },
  0x221e: { name: "clearTargetActorRecord", role: "object-clear helper: blank a 0x18-byte record at IY to zero", cert: "code" },
  0x22b1: { name: "advanceActorAnimationsUnlessGrabbing", role: "step the animation script of four actor records unless a rope-grab is in progress", cert: "code" },
  0x250f: { name: "loc_250f", role: "shape-loader prologue: seat record stride 0x18 / count 4, then fall into the tile-copier copyDisplayTilesIntoActorRecords", cert: "code" },
  0x2514: { name: "copyDisplayTilesIntoActorRecords", role: "copy B display tiles into successive actor records (rec+0x0f, HL+1/IX+DE per pass); then OR the terminator strike counter with the board-clear flag and tail to the board/HUD reset when either is set", cert: "seen" },
  0x2527: { name: "resetBoardRamAndReseedSpawnCounters", role: "board/HUD reset: enqueue a display command, conditionally reseed the spawn-phase/rope-draw counters, clear three RAM blocks (loc_0010) and mirror the fill value into five actor/HUD cells", cert: "seen" },
  0x27f3: { name: "spawnEnemyTargetOrAnimateLaunchFlipTile", role: "launch state 1: animate the arrow tile (flip-countdown parity) or seed a new hunter into a free enemy-target record", cert: "seen" },
  0x2856: { name: "spawnHunterIntoTableAndAdvanceLaunch", role: "launch-state-machine state 2: seed a new hunter into the first free 0x8c78-table slot (unless play-mode set), then bump the launch state and either seed the spawn countdown + enqueue a display command or bump a sub-counter", cert: "seen" },
  0x28ad: { name: "advanceLaunchOnDelayAndClearHunterRecord", role: "launch state-3 handler: run the state-3 hold countdown, then advance the launch state and (unless play-mode latched) clear the pointed-to 0x18-byte record via loc_0010", cert: "seen" },
  0x2a32: { name: "loc_2a32", role: "actor state-3 handler: tile-flip + 16-bit position advance by 0x80, milestone display-command enqueues, state advance", cert: "code" },
  0x2bd2: { name: "loc_2bd2", role: "stack-adjust entry (inc sp) that falls into the ready-sprite painter loc_2bd3; memory behaviour equals the painter's", cert: "code" },
  0x2d80: { name: "addRopeSegmentAndAdvanceExtendState", role: "rope-extend driver sub-state 0: add one rope segment", cert: "seen" },
  0x2e52: { name: "computeRopeCellVramColumn", role: "compute the video-RAM column base for a rope cell (IXL&3 ROM-table lookup)", cert: "code" },
  0x2e5e: { name: "spawnHangingRopeObject", role: "rope-cell state 1: on the gated tick, seed a free 0x8c48 spawn-object slot and blit the rope segment tile", cert: "seen" },
  0x2ecb: { name: "advanceHangingRopeObject", role: "rope-cell timer handler: tick the IXL&3 frame timer, return until zero; on zero write a round-derived tile, index the formation table to bump/clear/drop a record's fields, bump (ix+0), and blit the segment's 2x2 tile square", cert: "seen" },
  0x30f1: { name: "loc_30f1", role: "hunter-formation dispatch state 0 (launch): seed four formation-slot records from ROM param table 0x3337, prime the frame-timer block + formation state, blank a 3x3 video block, seat the script pointer, emit a sound command, run the return-scan (loc_323e), then a ROM self-check that wipes work RAM on tamper", cert: "code" },
  0x316e: { name: "loc_316e", role: "lead-hunter swoop step (formation dispatch state 1): script-driven hunter advance, dive-arm / wave-timer re-prime, three display-record stamps, then the 4-slot board-clear scan", cert: "code" },
  0x323e: { name: "loc_323e", role: "scan 4 display-list slots (IX stride 2) running loc_324d on each whose tag byte (IX+1) is 0x8c; loop count from B", cert: "code" },
  0x324d: { name: "loc_324d", role: "per-slot hunter-return tick: gate (ix+0)>=0x40, drop 0x8c-page paced counter by 0x40, on borrow dec paired byte + (board-clear) tail to loc_3278", cert: "code" },
  0x3536: { name: "tickActorHoldThenBlankAndClearWaveLatches", role: "actor frame-hold tick: animate, count the +0x11 hold down, tally + lane/launch latch reset on expiry, blank the sprite band", cert: "seen" },
  0x3553: { name: "blankActorSpriteBand", role: "blank an actor's sprite band: fill 0x17 bytes from IX with zero", cert: "seen" },
  0x361d: { name: "loc_361d", role: "actor end-of-move guard: gate on rec+8 bit0, else tail into the end-of-move dispatch finishActorOrArmTurnaround", cert: "code" },
  0x36de: { name: "mergeActorAttributeByte", role: "build an actor attribute byte (+0x08) via two table lookups with flag/phase/stage adjustments", cert: "seen" },
  0x3865: { name: "advanceActorStateOnTimerWithTamperCheck", role: "actor state handler with embedded tamper check: run the animation player, tick the per-record timer, and on expiry advance state and (in the object-table band with the frame gate clear) fold a ROM checksum, bumping the signature-mismatch flag on deviation", cert: "seen" },
  0x3be3: { name: "advanceEnemyToArrivalAndTallyWave", role: "object state-6 handler: animation-tick, then home/free-run the record's position+row; on arrival bump the wave/enemy tallies, blank the sprite band, and run the latch/counter-gated lane reset + program-memory integrity check (bumps the tamper-strike slot)", cert: "seen" },
  0x3d8f: { name: "blankEnemyBandOnTimerExpiry", role: "object state-10 handler: step the object animation, count down its frame timer (ix+0x11), and on expiry blank the object's sprite band (tail to blankActorSpriteBand)", cert: "seen" },
  0x3e69: { name: "seedEnemyFromDescriptorAndEnterFlight", role: "object state-11 handler: frame-timer countdown, then on expiry seed the object from a 5-byte descriptor (type gated 5..6) and fall through into the state-12 in-flight mover", cert: "seen" },
  0x3e9c: { name: "advanceInFlightEnemyAndLand", role: "object state-12 handler: in-flight mover for a spawned object (waypoint/free modes; lands via loc_381e anim + state flip)", cert: "seen" },
  0x4103: { name: "loc_4103", role: "per-object frame-advance: advanceObjectAnimationFrame animate, (ix+11h) dwell, on expiry bump phase + clear (ix+13h) + frame-zero-crossing signature checksum bumping TAMPER_STRIKES_SIG", cert: "code" },
  0x4350: { name: "loc_4350", role: "object state handler: tick advanceObjectAnimationFrame, count down the (ix+0x11) phase timer, then on lapse step (ix+0x02) and re-arm the turn animation (bit0 of (ix+0x08) selects loc_425c vs loc_423a)", cert: "code" },
  0x52f6: { name: "loc_52f6", role: "gated slot sweep + ROM-checksum tamper tripwire", cert: "seen" },
  0x53b0: { name: "loc_53b0", role: "one-shot gated formation-record spawn/init: fill record fields + derive spawn speed from round counter", cert: "code" },
  0x6505: { name: "spawnActorGroupRecords", role: "rst-0x28 handler index 0: seed the frame-delay/blink-phase cells, seat three object records backward (seatActorRecordAndQueueSpawnDisplay) bumping each phase, then emit the tile-command run queueSound82ThenRun1C", cert: "seen" },
  0x6523: { name: "seatActorRecordAndQueueSpawnDisplay", role: "seat a fresh object record and enqueue its spawn display command(s)", cert: "seen" },
  0x672a: { name: "descendEnemyActorAndSeatSpawnSlot", role: "object descent step: run advanceObjectAnimationFrame, advance the 16-bit sub-position, seat a matching free spawn-object slot when the landing row is reached, then bump state, reload the step to 0x18 and re-arm the animation via setActorAnimation", cert: "seen" },
  0x67a0: { name: "ascendEnemyActorAndLinkedSlotOnTimer", role: "per-object frame update gated by the shared frame-delay timer (animation step + 16-bit position moves + state advance)", cert: "seen" },
  0x68f8: { name: "loc_68f8", role: "per-frame group update: run the four object sub-passes in order, then return", cert: "code" },
  0x6905: { name: "loc_6905", role: "delay-gated enemy-spawn sweep: tick the frame-delay timer; once clear (wave neither full nor at limit), walk the 8 enemy/state record pairs and spawn into the first empty one — one spawn per call (dissolves loc_6931 to a boolean)", cert: "code" },
  0x69ad: { name: "loc_69ad", role: "step eight paired descending-object records through loc_69c6", cert: "code" },
  0x69c6: { name: "loc_69c6", role: "advance a paired ix/iy descending object one step: run the sequencer, lower both 16-bit positions by their delta, then gate/retire on the ix high byte", cert: "code" },
  0x6aa8: { name: "loc_6aa8", role: "state-1 step of a descending object: move it down, then at bottom re-arm the tile-sum latch and advance state", cert: "code" },
  0x6f9d: { name: "loc_6f9d", role: "level-intro phase 4: latch + scale the target-group count, advance the intro phase, reprime the delay, then anti-tamper compare a ROM block against its data copy (match queues sound + display commands; mismatch wipes work RAM)", cert: "code" },
  0x7032: { name: "loc_7032", role: "level-intro phase 5: tick the target group, count the intro delay down to advance the phase, and toggle/queue a display command every 16th frame", cert: "code" },
  0x7059: { name: "loc_7059", role: "phase-5 target-group tick: decrement the counter at HL and queue display command 0x0315", cert: "code" },
  0x705f: { name: "loc_705f", role: "level-intro phase 6 (final): count the intro delay down; on expiry silence sound, clear the hit tally, and set the play sub-state ready (6)", cert: "code" },
  0x71ce: { name: "advanceEagleApproachAndPaintGridMarker", role: "eagle/arrow approach state machine: hold-gate, drive the aim flags and records-arrived sub-phase from the eagle X, and step the grid marker + colour every eighth frame (delegating the grid-edge guard and phase-reset epilogue)", cert: "seen" },
  0x72a7: { name: "driveEagleWavePerFrame", role: "per-frame enemy-wave launch driver: seed the wave when the launch flag is clear, idle-handoff when no records remain, else walk the wave's live records (two per wave index) through the per-record state handler", cert: "code" },
  0x72cf: { name: "dispatchActiveEagleRecordState", role: "per-eagle-record state dispatcher: skip an inactive record, then route the record state (ix+2) to the approach (0), dive/climb (1), or retire (2) handler", cert: "code" },
  0x733c: { name: "advanceEagleToArrivalAndTallyWave", role: "eagle approach state: gate eagle grid col/row vs (ix+6)/(ix+4) window, on hit advance (ix+2), arm anim + set (ix+9), even records bump arrived count + (all arrived) queue the wave display command via rst 0x38", cert: "seen" },
  0x7395: { name: "advanceEagleDiveClimbToRetireAtLimit", role: "eagle-record dive/climb state: run the animation mover (advanceObjectAnimationFrame) then integrate the record's vertical position by its speed, advancing the state byte at the row limit", cert: "seen" },
  0x73ce: { name: "despawnEagleAndSeedHoldOnWaveEmpty", role: "eagle-record state 2 (retire): clear the record and, when the wave empties, seed the inter-wave hold", cert: "seen" },
  0x73e3: { name: "tickEagleInterWaveHoldAndRearmLaunch", role: "eagle inter-wave idle handler: tick the hold timer, or on expiry enqueue the wave display command, reseed the hold, and clear the launch flag", cert: "seen" },
  0x7421: { name: "clearWaveStateAndArenaOnHoldExpiry", role: "bonus-stage teardown (phase 2): clear wave/enemy state and hand back to the attract sub-state", cert: "seen" },
  0x7960: { name: "loc_7960", role: "shared integrity + play-timer nibble-render handler: enqueue a display command, verify a code-block checksum, render the active player's timer BCD as nibble tiles and clear them, then scan a flag block that can divert to a tail checksum", cert: "seen" },
  0x79e9: { name: "loc_79e9", role: "code-region integrity self-check: sum a fixed routine's bytes into a 16-bit checksum and match it against the stored word (trap/divert on mismatch)", cert: "code" },
  0x2a96: { name: "loc_2a96", role: "0x8a80 actor state-5 handler (rst-0x28 dispatch slot 5): 0x20-byte reversed-signature check of the reinitRoundArenaAndPlayfieldIfImageIntact code window (ascending) against the reference block at 0x2b23 (descending) — on a full match reseat frame-hold (ix+0x11)=0x18, set flip bit (ix+0x10 bit7), advance record state (ix+0x02); on any mismatch tail-jump the state-2 handler loc_2a01", cert: "code" },
  0x5df7: { name: "loc_5df7", role: "gate + seed for the proximity sweep: bail if the grab latch is set or formation/teardown state is non-zero, else seed source/target/record pointers + slot count and run the 3-slot sweep (loc_5e11)", cert: "code" },
  0x6368: { name: "resolveProjectileCollisionsBothActorSlots", role: "two-pass projectile-proximity scan driver over the two actor boxes (SPRITE_ACTOR_RECORD_SLOTS +0 / +4), forwarding I=0 then I=4 as the interrupt-parity hit-flag selector; aborts on the first hit", cert: "code" },
  0x602f: { name: "resolveObjectProximityHitsBothSlots", role: "run the per-slot object-proximity scan once for each of the two target slots; a hit inside a pass aborts before the remaining slot", cert: "code" },
  0x60d9: { name: "markHitFlagSeedActorAndScanEnemyRecords", role: "mark the interrupt-parity hit-flag slot (0x8d1c/0x8d1b by `ld a,i`), seed a fresh actor record (initActorRecord, DE=0x0404), then run the enemy-record scan dispatchHitToEnemyRecordElseQueueSound; forwards the scan's false=abort / true=continue boolean", cert: "seen" },
  0x611f: { name: "dispatchHitToEnemyRecordElseQueueSound", role: "enemy-record finder: key = (HL+DE); scan 6 records at 0x8ae0 (stride 0x18) for +0x14 == key; match -> loc_613d (aborts frame, returns false); no match -> enqueue sound (queueSoundCommand05) unless ACTIVE_OBJECT_TYPE==3, then normal return (true)", cert: "code" },
  0x6cab: { name: "acquireTargetLockAndSetAimIndicator", role: "aim-indicator / target-acquisition updater: gates on GAME_ACTIVE_FLAG/GRAB_ACTIVE_FLAG/WAVE_TEARDOWN_STATE, steps driveAimIndicatorHitTimerElseRescan, bails on PROXIMITY_HIT_FLAG, then sets the above/below aim bit via LAUNCH_STATE / existing-lock re-evaluate / closest-in-band 6-block scan (records the 5-byte lock at TARGET_LOCK)", cert: "seen" },
  0x6bee: { name: "driveAimIndicatorHitTimerElseRescan", role: "aim-indicator stepper: mode 0 runs the proximity redraw (clearAimIndicatorUnlessProximityHit); mode 1 sets bit2 / mode>=2 sets bit3 of PLAYER_AIM_FLAGS (clearing the other), then drains AIM_INDICATOR_TIMER, zeroing AIM_INDICATOR_MODE at expiry", cert: "seen" },
  0x6404: { name: "scanActorCollisionsBothSlots", role: "two-pass actor collision driver: guarded by PLAY_MODE_LATCH/ROUND_COUNTER bit0, scans the actor record twice (selector 0 then 4), aborting on a collision (the terminator skip inside the scan unwinds this frame)", cert: "code" },
  0x0899: { name: "dispatchAttractSubstate", role: "attract/demo sequence driver (top-level game state 1)", cert: "seen" },
  0x092c: { name: "paintAttractColorsAndQueueDraws", role: "attract sub-state 2 (dispatched from the attract state table)", cert: "seen" },
  0x099c: { name: "buildAttractSpritesAndPrimeTextScript", role: "attract sub-state 4 handler (ROM 0x099c-0x09f7, dispatch 0x08a1[4])", cert: "seen" },
  0x0ac8: { name: "typeAttractTextColumn", role: "attract sub-state 5 handler (dispatch target 0x08a1[5], ROM 0x0ac8-0x0b25)", cert: "seen" },
  0x1583: { name: "tickHudRefresh", role: "per-frame HUD-refresh tick with a tamper-gated gameplay dispatch (ROM 0x1583-0x159a)", cert: "code" },
  0x159b: { name: "runPlayStateFrame", role: "top-level game state-3 (play) handler (ROM 0x159b; dispatched each frame from the NMI service via table 0x06f0)", cert: "seen" },
  0x15d1: { name: "resetToBoardBuildToContinuePlay", role: "the play dispatcher's post-dispatch continuation (end-of-life housekeeping)", cert: "seen" },
  0x175d: { name: "startRoundAfterIntroDelay", role: "play sub-state idx2 handler", cert: "seen" },
  0x17c1: { name: "spawnEnemyWave", role: "play-state idx3 handler: enemy-wave setup + spawn", cert: "seen" },
  0x18af: { name: "runActiveGameplayFrame", role: "gameplay-state index-4 per-frame coordinator (ROM 0x18af-0x18d9, table 0x15a8[4])", cert: "seen" },
  0x19ee: { name: "stepGameplayFrame", role: "gameplay-state per-frame coordinator", cert: "code" },
  0x1ead: { name: "paintRoundNumberHud", role: "round-number HUD setup, then the per-frame HUD update chain", cert: "seen" },
  0x1f18: { name: "refreshRoundStageHud", role: "per-frame round/stage HUD refresh", cert: "seen" },
  0x1f2f: { name: "drawStageLabelOncePerLevel", role: "stage-label HUD updater, run once per level", cert: "seen" },
  0x2334: { name: "clampActorYAndAdvanceRenderPhase", role: "actor-Y clamp + integrity-flag scan, then a gated phase-advance (ROM 0x2334-0x2369)", cert: "seen" },
  0x28c6: { name: "advanceLeadActorSecondaryState", role: "per-frame driver for the lead actor's secondary state machine", cert: "code" },
  0x2dbc: { name: "advanceRopeExtendAnimation", role: "rope-extend blit driver (ROPE_EXTEND_STATE == 1)", cert: "seen" },
  0x2e36: { name: "dispatchRopeCellState", role: "per-rope-cell dispatcher (ROM 0x2e36-0x2e3c)", cert: "seen" },
  0x2f2f: { name: "retractRopeSegment", role: "rope-cell state-4 handler: retract one rope segment (ROM 0x2f2f; dispatched from dispatchRopeCellState with the cell record in IX)", cert: "seen" },
  0x355b: { name: "advanceActorTowardTargetColumn", role: "actor movement / target-seek AI step for the record at IX. Steps the record's animation, bails to the move+dispatch handler if already latched onto a target, then advances X by the per-record step (a carry bumps the column)", cert: "seen" },
  0x3d18: { name: "armEnemyState8Animation", role: "object state-8 handler (ROM 0x3d18; dispatched with the object record in IX)", cert: "seen" },
  0x3d5c: { name: "advanceEnemyAnimationPhase", role: "object state-9 handler (ROM 0x3d5c-0x3d8e; ROM jump table 0x339b index 9, also fall-through from armEnemyState8Animation)", cert: "seen" },
  0x3f5c: { name: "startEnemyFall", role: "object state handler: begin the fall", cert: "code" },
  0x4137: { name: "descendObjectToLanding", role: "per-object descent step for the record at IX. The animation stepper runs first, then the position (+3) advances by the signed step (+0x0a), borrowing one from the sub-position (+4) when the position is below -(step)", cert: "code" },
  0x4221: { name: "moveFormationAndSpawnObject", role: "per-frame object-state handler for the record at IX (dispatch target): tick the animation, branch on (ix+8) bit0, then arm a turn-animation script or drop into the shared bookkeeping tail", cert: "code" },
  0x511b: { name: "serviceEnemySpawns", role: "per-frame enemy-update dispatcher (ROM 0x511b; called from the idx-4 coordinator)", cert: "seen" },
  0x5146: { name: "runEnemySpawnScriptPasses", role: "per-frame enemy-spawn script pipeline: run the sub-passes in order each frame", cert: "seen" },
  0x5150: { name: "armEnemySpawnScript", role: "advance the attract/board script once its guard clears (ROM 0x5150-0x5199)", cert: "seen" },
  0x5334: { name: "spawnNextScriptedEnemy", role: "lane-sweep script tick gated on SLOT_SWEEP_LATCH: read the live script byte at SCRIPT_DATA_PTR, tick/reseed the delay timer and advance the pointer, then sweep the 6 records at ENEMY_ACTOR_TABLE activating each via activateLaneActorSlot", cert: "seen" },
  0x540d: { name: "spawnEnemyFormation", role: "enemy-formation spawn driver", cert: "seen" },
  0x5433: { name: "initEnemyFormationRecord", role: "initialise one enemy formation record at IX. Bails when the record is already live (either of its first two bytes set)", cert: "code" },
  0x54c5: { name: "spawnFormationEnemyOnInterval", role: "spawn scheduler A. Below round 4 a difficulty gate can veto the tick: round < 2 needs difficulty >= 3, round in {2,3} needs difficulty >= 2; round >= 4 always proceeds", cert: "seen" },
  0x5519: { name: "spawnShotTargetOnInterval", role: "spawn scheduler B (ROM 0x5519-0x5543), falls through into the spawn loop loc_5544", cert: "seen" },
  0x5564: { name: "spawnFormationEnemiesOnTimer", role: "frame-timer gated formation spawner (ROM 0x5564-0x5592)", cert: "seen" },
  0x5ae4: { name: "runActorUpdatePipeline", role: "master per-frame actor updater", cert: "seen" },
  0x5b2c: { name: "fireArmedEnemyProjectilesAndDisarm", role: "end-of-wave object-table cleanup (ROM 0x5b2c-0x5b70)", cert: "seen" },
  0x6df9: { name: "paintAttractColumnWithTamperChecksum", role: "anti-tamper clone of typeAttractTextColumn (attract sub-state 5)", cert: "code" },
  0x6e59: { name: "runLevelIntroPhase1Frame", role: "level-intro phase-1 per-frame body: nine sub-passes in fixed order", cert: "code" },
  0x6f5e: { name: "advanceLevelIntroFromPhase3", role: "level-intro phase-3 timing gate (ROM 0x6f5e-0x6f9c)", cert: "code" },
  0x755d: { name: "updateGameplayFrame", role: "dispatch state 2: the per-frame gameplay driver", cert: "seen" },
  0x756d: { name: "spawnNextEnemyOnDelay", role: "per-frame enemy spawner driver (delay-gated)", cert: "seen" },
  0x771d: { name: "armObjectFromSpawnRing", role: "object-state 0: arm a new object (ROM 0x771d-0x773f, dispatch 0x7715[0])", cert: "seen" },
  0x7740: { name: "moveObject", role: "active-object mover, rst-28 state 1 (ROM 0x7740-0x778f, dispatch 0x7715[1])", cert: "seen" },
  0x7790: { name: "drawObjectStackedTiles", role: "object-draw handler (rst-0x28 state 2, table 0x7715[2]) for the record based at IX. Advances the animation, decrements the frame timer (+0x11) and returns while it runs", cert: "seen" },
  0x77c8: { name: "clearAndReseedObjectSlot", role: "clear an actor slot, then re-seed it behind a colour-RAM integrity check (ROM 0x77c8-0x780e)", cert: "seen" },
  0x7881: { name: "advanceAttractStateIfImageIntact", role: "periodic self-integrity check dispatched over an actor slot", cert: "seen" },
  0x7fd6: { name: "startGameOnStartButtonPress", role: "guarded trigger reached through a jump-table pointer", cert: "seen" },
};
