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
/** [code] (both goldens static 0 (DSW1 bit3=0 default) -> unobservable/code; loc_0092 boot cpl's the DSW1 port then decodes ~(bit3) here, loc_18da picks award queue 5/3 & step 8/7 off it) DSW1 bit3 (complemented, boot-only): selects bonus/extra-life award schedule -- queue reload 5/3, BCD step 8/7 */
export const BONUS_AWARD_DSW = 0x8800;
/** [seen] (gameplay golden: coin at f302 -> 0->1, 1P start at f362 -> 1->0 (credit added then consumed); static 0 in attract = credit counter, REFUTES A's score-drip) BCD credit counter (max 0x63): coin +1, 1P start consumes 1, 2P start consumes 2; drawn as 2 HUD digits */
export const CREDIT_COUNT = 0x8802;
/** [seen] (attract cycles 0/1/3, gameplay 0->1->2->3 (distinct=4) discrete states; loc_066d indexes table 0x06f0 on (0x8805)) top-level NMI state selector dispatched via table 0x06f0 (072d/0899/0c4e/159b/0e53): attract/intro/play */
export const MAIN_GAME_STATE = 0x8805;
/** [seen] (gameplay: 0->1 at f362 (game start, coincides 0x8805->3), 1->0 at f4324 (game over); static 0 in attract) in-play gate: set 1 at start-of-life, cleared 0 at game-over; gameplay handlers ret early when 0 */
export const GAME_ACTIVE_FLAG = 0x8806;
/** [seen] (gameplay distinct=256, wraps 0->255, 530 transitions = a per-frame countdown timer reloading/wrapping; loc_16b7 'dec (0x8808)... ret nz') per-frame phase countdown decremented by state handlers, reloaded (e.g. 0x60) to time phase transitions */
export const PHASE_TIMER = 0x8808;
/** [seen] (both goldens: 0->32 then decrement 32..0 per frame, repeated (420/468 trans); loc_02e6 seeds 0x20, loc_02ce/loc_0c77 walk down) down-counter (seeded 0x20) for the row-by-row VRAM tile fill; zero ends the fill and advances state */
export const FILL_ROW_COUNTER = 0x8809;
/** [seen] (steps discrete phase values 1/2/3/4/7/10/13/18 (gameplay distinct=12); loc_15a1 dispatches (0x880a)&0x1f via table 0x15a8) in-play sub-state index (&0x1f) dispatched via table 0x15a8; stepped through round/intro phases */
export const PLAY_STATE_INDEX = 0x880a;
/** [seen] (low byte steps +32 (0,32,64,..,224,0) with 465 transitions; loc_02e6 stores HL, loc_02ce fills B tiles then adds 0x20-B) 16-bit VRAM write cursor for the row-by-row tile fill, advanced +0x20 per row (paired with 0x8809) */
export const TILE_FILL_PTR = 0x880b;
/** [seen] (MAME 2P golden: toggles P1<->P2 exactly on swaps -- 0->1 at P1 death f2854, 1->0 at P2 death f7129; the f319 scratch 0x1f is loc_075d's leftover stored by loc_0c45, not a player value) active-player select; bit0=0 -> P1 banks (score 0x88a2/counter 0x88a4), 1 -> P2 (0x88a5/0x88a7) */
export const ACTIVE_PLAYER = 0x880d;
/** [seen] (MAME 2P golden: 0->1 at 2P start f402, holds 1; static 0 in the 1P golden = positive control; loc_0dab sets 1 on 2P start, loc_7fd6 picks player bank when nonzero) nonzero for a 2-player game; gates per-player bank selection (with 0x880d) and the 2P start event */
export const TWO_PLAYER_FLAG = 0x880e;
/** [seen] (gameplay: bit0=1 at f302 (coin), bit3(val 8) at f362 (1P start); loc_066d writes cpl(IN0 @a080) here each NMI) inverted IN0 sample (head of 0x8810-0x8812 edge-detect ring): coin bit0, 1P-start bit3, 2P-start bit4 */
export const INPUT_PORT0 = 0x8810;
/** [code] (static 0 in BOTH goldens (ROM intact) -> code; only bumped by checksum guards (loc_1b43 !=0x7c, loc_5594 signature), aborts actors (loc_241e), traps spawn (loc_6e75) -- REFUTES B's round-active (would go nonzero during a round)) anti-tamper miss tally bumped by ROM/signature checksum guards; nonzero freezes spawns, aborts actor updates, skips HUD setup */
export const TAMPER_FREEZE_FLAG = 0x881e;
/** [seen] (both goldens: 0->1 at f32 (boot init to normal orientation), held; loc_066d epilogue copies (0x881f)->0xa187 b7, loc_0320 gates mirror pass when ==0) screen orientation flag copied to flipscreen latch 0xa187 b7 each NMI; 1=normal (upright), gates the vertical-mirror pass */
export const FLIP_SCREEN_FLAG = 0x881f;
/** [code] (static 0 in both goldens (difficulty 0) -> unobservable/code; loc_0092 boot cpl's the DSW1 port then writes (~DSW1>>4)&0x07 (only writer), loc_54c5/loc_5519/loc_39fb threshold spawns on it) 3-bit difficulty (DSW1 bits4-6, complemented, boot-only); scales enemy spawn schedules and tier/threshold tables */
export const DIFFICULTY_DSW = 0x8820;
/** [seen] (both goldens: 0->1 at f32 (boot seeds coinage=1c/1c via table 0x0053, 0x882f gets hi nibble); loc_59e8/loc_15d1/loc_0e54 test ==0x0f free play (A's slot-B label unverified)) coin-slot coinage nibble from DSW0 low nibble via table 0x0053; 0x0f = free play; read by credit logic */
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
/** [seen] (MAME round-advance capture: cycles per-round 0->1 f1291, 1->2 f7618, 2->3 f7750; static 0 without a round poke; loc_196e mode-select, loc_2527 reseed at 7) Per-round phase/step counter (cycles to 7) selecting spawn/fire mode branches; snapshotted into 0x8d43/0x8934 */
export const SPAWN_PHASE_COUNTER = 0x8902;
/** [seen] (play: counts up 0..6 per stage then resets at transition = a per-stage arrival/wave counter (loc_3be3 bump, loc_2a01 cap, loc_2d80 rope bound)) Per-stage counter bumped on enemy arrival (caps 9->8); bounds the rope-segment count (0x8931 <= this-2), parity picks spawn variant */
export const WAVE_ARRIVAL_COUNTER = 0x8903;
/** [seen] (attract+play: 0/1 flag, 1 while a round runs, resets at stage/life transitions (loc_175d/1798 set, loc_1dd3/16b7 read)) In-progress flag for the active round; set to 1 at level start, keys render/state decision trees */
export const ROUND_IN_PROGRESS = 0x8904;
/** [seen] (MAME round-advance capture: increments per stage transition -- natural 2->3 f2059, 3->4 f2431 beyond the poked value; bit1 gates target-group fan-out, bit0 the rope path; loc_1f2f/1ead BCD render) Round counter; +1 BCD-rendered as the HUD round number; bit0 selects stage-type/facing variant, low bits index difficulty tables */
export const ROUND_COUNTER = 0x8907;
/** [seen] (play: 3->2->1->0 then reset to 3; exhaustion runs loc_1a96 (phase transition, not death) rendered by loc_03c2 = a phase gauge) Phase counter drained per phase, drawn as a 5-cell vertical HUD gauge; on reaching 0 it triggers phase-exhausted (clears rope) */
export const GAUGE_PHASE_COUNTER = 0x8908;
/** [seen] (both goldens: byte0 cycles 0/1/2 = the 0x88b7-wrap display one-shot (loc_175d/7517 inc/test/clear); the pointer-table role (loc_308b/30f1 register 4 formation slots, stride 2) is unobserved -- no formation spawned in 180s) display sub-phase one-shot (byte0, fired on the 0x88b7 mod-0x1c wrap); byte0 also the base of the 4-slot enemy-formation pointer table (stride 2) */
export const FORMATION_SLOT_TABLE = 0x8920;
/** [seen] (play: up-counter 0..4, resets to 0 at phase exhaustion (f3778); static 0 in attract (no rope); loc_2d80 steps it, loc_2f2f retracts) Count of extended rope segments; stepped up to 0x8903-2; drives per-segment retract anim and the attribute byte */
export const ROPE_SEGMENT_COUNT = 0x8931;
/** [seen] (MAME round-advance capture: mirrors 0x8902 one frame later -- 0->1 f1292 vs 0x8902 f1291, 1->2 f7623) rope/lift segment draw count (snapshot of 0x8902 phase, reseeds to 4 at 7); sets rope sprite rows */
export const ROPE_DRAW_COUNT = 0x8934;
/** [seen] (MAME 2P golden: block saved on P1 death f2854 -- byte1 0x8941 0x20->0x1a via saveLivePageToPlayer0Bank; base byte0=colour stays 0 (source 0x8820=0) so grounded at BLOCK level. loc_1a47/loc_1601 ldir 0x8900<->0x8940 per 0x880d) Base of player-0's 0x3f-byte saved actor/state block, swapped with live page 0x8900; byte0=sprite colour */
export const PLAYER0_STATE_BANK = 0x8940;
/** [seen] (Gameplay golden: 0->3 (seed=default 3 lives) then 3->2->1->0 drain per death, then ->3 for next game. Decisive lives countdown; overturns A's 'active flag' guess. Seeded 0x8807 in loc_0e00 (bank +8).) Player-0 remaining lives, seeded from lives DSW 0x8807; decrements on death, gates player-switch/game-over */
export const PLAYER0_LIVES = 0x8948;
/** [seen] (MAME 2P golden: block saved on P2 death f7129 -- byte1 0x8981 0x20->0x0f; base byte0=colour stays 0 (source 0x8820=0) so grounded at BLOCK level. loc_1a47/loc_1bcc ldir 0x8900->0x8980 per 0x880d) Base of player-1's 0x3f-byte saved actor/state block, swapped with live page 0x8900; byte0=sprite colour */
export const PLAYER1_STATE_BANK = 0x8980;
/** [seen] (Both goldens: 0->3 (seed=lives DSW), gameplay 3->0->3 reset pattern parallel to 0x8948. Value 3 = default lives; loc_7e6d gates integrity on >=4 (only under 4/5-life DSW). Overturns A's 'active flag'.) Player-1 remaining lives, seeded from lives DSW 0x8807; gates player-switch and an integrity check (>=4) */
export const PLAYER1_LIVES = 0x8988;
/** [code] (Static 0 both goldens (no board completed in capture). Code: loc_0bb5 arms it on enemy-scan/table-lookup mismatch; loc_324d tail-jumps to board-clear loc_3278 when set; loc_1e55 freezes object update. A/B synonyms (stage-transition vs board-clear).) When set, freezes per-frame object updates and diverts handlers to the board-clear/level-intro path */
export const BOARD_CLEAR_FLAG = 0x89e5;
/** [code] (static 0 (ROM intact) -> code) anti-tamper strike counter bumped when the 0x64be ROM checksum misses its sentinel */
export const TAMPER_STRIKES_ROM = 0x89ef;
/** [seen] (Both goldens: toggles 0<->0x0a (tile code written then cleared). Code: loc_1601/loc_17c1/loc_1b80/loc_1d0d copy ROM strings/tables in; loc_1694 matches 0xff-pattern @0x16ae and rst-0x10 clears the 7 cells.) Base of a 7-cell tile message buffer; ROM strings copied in, pattern-matched for completion, then cleared */
export const DISPLAY_MSG_BUF = 0x89f0;
/** [code] (Static 0 both goldens (top-score MSB stays 0 in short capture). Code: loc_0092 seeds 10x(0,0,1) at 0x8a00-0x8a1d, loc_1ab2 insert-sorts, loc_03e9 splits bytes into BCD nibbles for display.) Base of the sorted 10-entry x 3-byte BCD high-score table; insert-sorted on game over, rendered on HUD */
export const HIGH_SCORE_TABLE = 0x8a00;
/** [code] (static 0 (ROM intact) -> code) anti-tamper strike counter bumped when the 0x5328/0x557f signature checksums miss their sentinel */
export const TAMPER_STRIKES_SIG = 0x8a38;
/** [seen] (Both goldens: 256 distinct, ~10.8k transitions, decrements 255->254->253... one per frame. Free-running down-counter. Code: loc_066d NMI dec (0x8a5f); loc_2e5e gates on &3; loc_7e6d/loc_3865/loc_4103 run only when ==0.) Free-running counter decremented every vblank NMI; low bits phase animation, zero-crossing gates integrity checks */
export const FRAME_COUNTER = 0x8a5f;
/** [seen] (Both goldens: slot-0 field0 toggles 0<->1 exactly when the player becomes active (gameplay f1090, same frame 0x8a84 starts moving). Code: loc_19bc/loc_2ae8 zero-fill 0x8a80..; loc_22b1 walks stride 0x18; dozens of state handlers dispatch over it.) Base of the 0x18-stride actor record array (zero-filled at board init); slot 0 is the player/lead actor */
export const ACTOR_TABLE = 0x8a80;
/** [seen] (Both goldens: steps 0->1->2->3->4->5->0 in ~16-frame intervals, matching the 6-entry dispatch table (loc_241e reads (ix+2)&7 -> 0x2442..0x24fb; loc_2901 inc's it). Overturns B's ACTOR_COUNT (misreads the cp-3 spawn gate as a population count).) Lead-actor (slot 0) state/phase index driving the 6-way dispatch table; also gates spawn/formation at >=3 */
export const LEAD_ACTOR_STATE = 0x8a82;
/** [seen] (Both goldens: smoothly varies 0..225 (elevator motion; attract decrements, gameplay increments). loc_23d7 derives THREE stacked sprite Y bytes from (ix+4)=0x8a84 -> vertical axis; loc_1e55 writes joystick to slot-0 -> it is the player. Corrects both derivers' 'X' axis to Y.) Player-actor (slot 0) vertical position; sprite Ys derived from it, enemy AI targets it to arm dives */
export const PLAYER_Y = 0x8a84;
/** [code] (Static 0 both goldens (indicator phase not reached; input path gated). Code: loc_1e55 complements joystick into (ix+7)=0x8a87; loc_6cab/loc_6bee/loc_6c3f/loc_71ce set bit2=on-target/above, bit3=below.) Player-actor state byte: low bits = joystick input, bits 2/3 = aim above/on-target/below indicator */
export const PLAYER_AIM_FLAGS = 0x8a87;
/** [seen] (byte0 toggles 0/1, 30 transitions = live record-active flag) enemy actor record sub-array (stride 0x18) at +0x60 in the 0x8a80 arena; byte0 = record-active */
export const ENEMY_ACTOR_TABLE = 0x8ae0;
/** [seen] (attract+play: byte0 toggles 0/1 (38/30 transitions) = slot-active flag; loc_13bc scans 5 slots stride 0x18 for a free one) Base of the secondary 5-slot object/sprite record pool (stride 0x18); slot free when byte0/1 bit0 clear */
export const SPRITE_OBJECT_TABLE = 0x8b70;
/** [seen] (attract+play: byte0 toggles 0/1 (50/38 transitions); loc_3a6c allocates a free slot (bumps 0x8d42) and writes byte0=1) Base of the 3-slot projectile/object record table (stride 0x18); launch marks byte0=1 active */
export const PROJECTILE_TABLE = 0x8be8;
/** [seen] (MAME round-advance capture: byte0 record-active toggles 0<->1, 35 transitions from f1863, only under a round-gated formation; loc_40bd sweeps 4 records stride 0x18) Base of the 4-slot formation object table (stride 0x18); one-shot spawn/init, swept per-record */
export const FORMATION_TABLE = 0x8c30;
/** [seen] (gameplay: byte0 takes {0,1,7} matching loc_2e5e writing (iy+0)=0x07 to a free slot; loc_6435 collision-scans B=3; attract static 0) Base of the 3-slot spawned-object table (stride 0x18) hit-tested vs shots; free slot seeded with state 0x07 */
export const SPAWN_OBJECT_TABLE = 0x8c48;
/** [seen] (attract+play: byte0 cycles 0..3 = presence bits (loc_5b99 tests iy+0 bit0/bit1); loc_5f83 selects 0x8c90 when I==0) Slot 0 (I=0) of the 2-entry I-parity enemy/target actor-record pair; byte0 low bits = presence/state */
export const ENEMY_TARGET_REC0 = 0x8c90;
/** [seen] (attract+play: byte0 cycles 0..2 = presence bits of slot 1; loc_5f83 selects 0x8ca8 when I!=0 (0x8ca8=0x8c90+0x18)) Slot 1 (I!=0) of the 2-entry I-parity enemy/target actor-record pair (0x8c90+0x18); byte0 low bits = presence/state */
export const ENEMY_TARGET_REC1 = 0x8ca8;
/** [seen] (attract+play: reloads 0x80/0x20 and drains 128->127->...->0 (3734/2647 transitions) = countdown; loc_1171 dec-while-nonzero, loc_119a reseeds) Spawn-cadence countdown; decremented each tick, at 0 gates the 0x8ae0 spawn sweep then reseeded */
export const ENEMY_SPAWN_TIMER = 0x8d07;
/** [seen] (attract+play: 0/1 one-frame pulses (set on hit, cleared next frame) = a FLAG; BOTH this and 0x8d1c fire in the 1P golden, so the selector is the I-parity/0x8848 slot index, NOT the player) Hit flag for the I=0 slot (pairs 0x8c90): set 1 on a collision; loc_21cf clears it and tears the struck object down */
export const OBJ_HIT_FLAG_I0 = 0x8d1b;
/** [seen] (attract+play: 0/1 one-frame pulses = flag; selected when I!=0 in loc_6435/loc_638a/loc_60d9; fires in the 1P golden = an I-parity slot index, not player 1) Hit flag for the I!=0 slot (pairs 0x8ca8, partner of 0x8d1b): set 1 on a collision, cleared on teardown by loc_21cf */
export const OBJ_HIT_FLAG_I1 = 0x8d1c;
/** [seen] (attract: 0->1 at f1448 held to f5798 then 0 (only 3 transitions) = long-held latch; loc_196e sets it on 0x8d22 expiry, loc_0cf8/32bd clear it) One-shot latch set when the 0x8d22 periodic-event timer expires (fires loc_0f76); cleared on wave teardown */
export const WAVE_EVENT_LATCH = 0x8d21;
/** [code] (static 0 in BOTH goldens (no formation-spawn cycle observed in 180s); loc_2b9a decs while nonzero, on expiry sets IX=0x8c60/DE=0xffe8) Formation-spawn countdown (seeded from level 0x8903); returns while nonzero, at 0 runs the 0x8c60 spawn loop */
export const FORMATION_SPAWN_TIMER = 0x8d30;
/** [seen] (attract: 0->1 at f4466 held ~147f to f4613 then 0 (4 transitions) = event latch; loc_305f sets 0x8d32=1 on catch, loc_196e/others gate on ==0) Rope-grab in-progress latch; set 1 when a grab fires, gates/aborts spawn & event routines while nonzero */
export const GRAB_ACTIVE_FLAG = 0x8d32;
/** [seen] (play: ramps 0..5 then resets 0 per wave (gated 0x8901/cap6); attract: ramps 0..32 (anim); loc_34b0 dec on despawn, loc_0a28 uses &0x03 as 4-phase anim) Active enemy count: inc on spawn, dec on despawn, gated vs threshold 0x8901/cap 6; low 2 bits = anim phase */
export const ACTIVE_ENEMY_COUNT = 0x8d40;
/** [seen] (attract: counts down 10->1 reloading 0x0a each frame (loc_0a28); play: increments 0..5; loc_13bc bumps skipping 0, loc_357c/loc_12d0 index by &7/&0x0f) Global anim frame counter; reseeded to 0x0a, bumped skipping 0 as sprite id, indexes tile cols by &7/&0x0f */
export const ANIM_FRAME_COUNTER = 0x8d41;
/** [seen] (attract: 4 distinct 0..3 incl 3 (f1469 0->2); play: 0..3 — cycles discrete object-type values, confirms type/mode byte) Latched type byte of the active hit record (0x8c90/0x8ca8, I-parity); type 0 skips, ==3 selects the main hit path */
export const ACTIVE_OBJECT_TYPE = 0x8d44;
/** [seen] (MAME round-advance capture: takes {0, 8, 0xff} -- 0->8 f1291, 8->0xff f1863 = threshold then interior-entry; loc_343e/34f2 compare vs (ix+6)&0x1f, loc_425c arm) Tile-column threshold at which a moving object starts its turn animation; anim-arm routines set it to 0 or 0xff */
export const TURN_COLUMN_LIMIT = 0x8d4b;
/** [seen] (attract+play: values {0,16,24,32} latched then cleared to 0 (few transitions) — discrete guard thresholds, confirms guard role) Threshold the phase counter (0x8901) must reach before the attract/board script advances; latched to it, nonzero=busy */
export const SCRIPT_ADVANCE_GUARD = 0x8d6d;
/** [seen] (gameplay 5->4->..->0 repeated (32 transitions) = countdown) counts down (from the 0x8d79 lane count) while a lane-spawn sequence runs; suppresses enemy fire; cleared at wave end */
export const LANE_SPAWN_COUNTDOWN = 0x8d75;
/** [seen] (attract+play: ramps up 0->5 then drains 5->0 — activate/consume counter, confirms lane count) Count of activated lane actors: inc on activate (loc_5374), dec on slot init (loc_3680); ==0 selects primary target table */
export const ACTIVE_LANE_COUNT = 0x8d79;
/** [seen] (attract+play: ramps 0->5 then resets to 0 at board-script re-arm (loc_5150) — confirms per-spawn tally) Per-slot spawn tally bumped each actor-slot init; indexes the alternate target-column/anim source (with 0x8d6f); cleared on script re-arm */
export const SLOT_SPAWN_INDEX = 0x8d7b;
/** [seen] (play: monotone 0->1->2->3->4 then reset (f3261+); attract static 0 — confirms progress/arrival counter (loc_3be3 inc, loc_39e0/57b4 gate)) Arrival/progress counter bumped on each object arrival; ramps enemy fire aggressiveness and gates late-wave phases */
export const WAVE_PROGRESS_COUNTER = 0x8d7d;
/** [seen] (attract+play: 256 distinct, sawtooth 255->254->...->0 (f795 0->255) — classic per-frame countdown timer) Per-frame countdown for the attract/intro text-draw script; on expiry advances the script step and pulls the next byte */
export const SCRIPT_FRAME_TIMER = 0x8e50;
/** [seen] (attract+play: 9 distinct 0..8 cycling (f99 0->1) — discrete state selector, confirms sub-state (loc_0899 dispatch)) Attract/demo sequence sub-state selector; indexes dispatch table 0x08a1; handlers inc/set it to advance phases */
export const ATTRACT_SUBSTATE = 0x8e51;
/** [seen] (attract+play: low byte steps down by 0x20 per pass (72->40->8->232->200...) — confirms row-stride VRAM cursor) 16-bit VRAM write pointer for the attract/text-draw script; bytes emitted through it, backed up one row (0x20) each pass */
export const SCRIPT_WRITE_PTR = 0x8e56;
/** [seen] (attract+play: cursor cycles 213->228->243->reset (238+/376 transitions) — moving script cursor, confirms role (loc_22e6)) 16-bit cursor into the shared per-actor animation script; advanced past 3-byte {tile,colour,delay} entries; 0xff lead = control marker */
export const ANIM_SCRIPT_CURSOR = 0x8f00;
/** [seen] (MAME formation capture: cycles 0->1->2->3->0, 100 transitions from f1101 = gather->full->dispatch->reset, exactly as noted; loc_308b) Enemy-formation launch state; 0 while gathering launch-ready slots, set 1 when full then dispatched (&3)-1 into launch handlers */
export const FORMATION_STATE = 0x8f08;
/** [seen] (attract+play: toggles 0<->1 (f1805 0->1) — binary latch, confirms arm-flag role (loc_278f gate)) Arrow/rope launch arm latch: nonzero blocks re-arming launch flag 0x8f3f, seeded from 0x8d7a; cleared with 0x8d75 at wave end */
export const LAUNCH_ARM_LATCH = 0x8f20;
/** [seen] (MAME formation capture: cycles 0->2->3->0, 75 transitions from f1157, in lockstep with the formation; loc_32bd) Enemy-formation teardown dispatch state: state1 tears down wave, state2 walks boss down; nonzero gates new grabs/launch as busy */
export const WAVE_TEARDOWN_STATE = 0x8f24;
/** [seen] (attract+play: cycles 0->1->2->3->4->0 (f1448) — confirms 5-state launch state machine (loc_2778 dispatch)) State selector for the arrow/rope launch state machine; per-frame driver dispatches (&7) into handlers 0..4 */
export const LAUNCH_STATE = 0x8f30;
/** [seen] (attract+play: 48->47->...->0 one step/frame (range 0..48, reseed to 0x30) = drains toward 0 = hold countdown) Inter-wave hold countdown; drains to 0 per frame to gate the next attack wave, reseeded 0x18/0x20/0x30 */
export const WAVE_HOLD_TIMER = 0x8f36;
/** [seen] (gameplay sub-phase progress counter vs 0x8f3d) count of records arrived in the current attack wave; compared to wave count 0x8f3d */
export const WAVE_RECORDS_ARRIVED = 0x8f39;
/** [seen] (attract+play: monotonic 0->1->2->3->4->0 (range 0..4) = wave counter incrementing then wrapping) Current attack-wave index; bumped per wave (wraps after 4th), scales record counts and wave sounds */
export const WAVE_INDEX = 0x8f3d;
/** [seen] (attract+play: toggles 0<->1 (range 0..1, 33/27 trans) = flag arming (loc_278f=1) then clearing (loc_0e00/2226)) One-shot arm flag for the arrow/formation launch; set when preconditions hold, cleared at init and when object spent */
export const LAUNCH_ARMED_FLAG = 0x8f3f;
/** [seen] (attract+play: low byte cycles many pointer values (232/265 trans) = loc_4381 write pointer advancing then stored back) Destination pointer for the display-list interpreter, paired with source 0x8f45; advanced during the copy */
export const DISPLAY_LIST_DST_PTR = 0x8f43;
/** [seen] (attract+play: low byte sweeps 0..255 (44/69 distinct) = loc_4381 read pointer advancing through layout data then stored back) Source/layout read pointer for the display-list interpreter, paired with dest 0x8f43; advanced during the copy */
export const DISPLAY_LIST_SRC_PTR = 0x8f45;
/** [seen] (MAME target-group capture: 0->5 at f1090 when block-C fans out (0x880a 3->0x0f), value 5 = round-2 clamp 5..8, recycles per stage; written only when 0x8907 bit1 set; loc_17c1 seeds) Targets in the current group; scaled x5 into HUD 0x8634 and 3x compared to hit tally 0x8f52 for end-level bonus */
export const TARGET_GROUP_COUNT = 0x8f47;
/** [seen] (attract+play: low byte steps +2 across 0x26..0x30 then resets = checksum-ptr walk (loc_0b32/6df9 r/w 16-bit); 0x8f51 intro machine idle so delay-timer use unobserved) Dual-use: intro-phase delay timer (0x40/0x60/0x80, counts down) & anti-tamper column-checksum pointer */
export const INTRO_DELAY_CKSUM_WORD = 0x8f48;
/** [seen] (MAME formation capture: toggles 0<->1, 50 transitions from f1157, in lockstep with the launch path; the 0x40-countdown sub-role is [code], not distinctly observed; loc_6e86/6db8 script ptr) Dual-use: 0xff-terminated object launch/dive-script pointer & 8-bit countdown firing at 0x40 in the launch path */
export const LAUNCH_SCRIPT_PTR = 0x8f4a;
/** [code] (static 0 across BOTH goldens (incl. attract) -> refutes A attract-flag; only writes set 1 (loc_1a01) & 2 (loc_1d6e) -> refutes B P1/P2 index; a mode/state latch) Multi-valued play-state latch (0/1/2): set by gameplay handler / post-countdown; gates alternate update paths + table select */
export const PLAY_MODE_LATCH = 0x8f50;
/** [code] (static 0 in BOTH goldens (intro machine idle at capture) -- role code-confident: loc_6da6 rst-0x28 dispatch, handlers advance it) Level-intro phase selector (0..6); dispatched through the 0x6daa jump table, advanced by each phase handler */
export const INTRO_PHASE_INDEX = 0x8f51;
/** [code] (static 0 in BOTH goldens -- role code-confident: loc_6435 inc per hit, loc_6edb/6f42 consume for bonus, loc_2527/705f clear) Running tally of target hits; bumped per collision, compared vs group count 0x8f47 for end-level bonus, cleared on reset */
export const HIT_TALLY = 0x8f52;
/** [seen] (attract+play: toggles 0<->96 (0x60) exactly matching the >=0x60 latch threshold in loc_71ce = captures/clears the enemy X) Latched enemy screen-X; captured when the enemy X>=0x60, drives its animation-flag bits, cleared at phase reset */
export const LATCHED_ENEMY_X = 0x8f5b;
/** [code] (static 0 in BOTH goldens (band-build path not sampled) -- role code-confident: loc_343e/3473 gate+set=1, loc_2527/25a6 clear) One-shot latch: interior/rope sprite band has been built; gates re-setup, cleared on board reset and at rope terminal */
export const ANIM_ARMED_LATCH = 0x8f63;

// == Batch-2 decompile cells (role from the frozen oracle; [code] -- MAME-grounding pending) ==
/** [seen] (MAME 2P golden: buffer accumulates during P1's turn only -- mid byte 0x88a3 0->0x14 while ACTIVE_PLAYER=0, frozen after the swap; base 0x88a2 low BCD pair stays 0 (scores x100) so grounded at BUFFER level; loc_04f2 selects this vs P2_SCORE_BCD off ACTIVE_PLAYER) player-1 live 3-byte BCD score buffer (0x88a2..0x88a4) */
export const P1_SCORE_BCD = 0x88a2;
/** [seen] (MAME 2P golden: buffer accumulates during P2's turn only -- mid byte 0x88a6 0->0x78 while ACTIVE_PLAYER=1, frozen otherwise; base 0x88a5 low BCD pair stays 0 (scores x100) so grounded at BUFFER level; loc_04f2 P2 bank) player-2 live 3-byte BCD score buffer (0x88a5..0x88a7) */
export const P2_SCORE_BCD = 0x88a5;
/** [code] (loc_585b sets 1 on a checksum mismatch; MULTIPLEXED -- loc_24fb writes 0x07 as a state index, loc_5a56 reads it as a coord low byte by COINAGE_CONFIG) eagle-spawn ROM-checksum mismatch flag */
export const TAMPER_ROM_CHECK_FLAG = 0x882b;
/** [code] (loc_0460 paints PANEL_VRAM_DEST from here) 30-byte status-panel tile source table (10 rows x 3 cells), work RAM */
export const PANEL_TILE_SOURCE = 0x8e00;
/** [seen] (MAME gameplay golden: status-panel tiles painted here in play; loc_0460 destination) VRAM base of the status panel painted from PANEL_TILE_SOURCE */
export const PANEL_VRAM_DEST = 0x8567;
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
/** [code] ROM base of the 23-byte block rolling-summed downward by the slot-sweep checksum (the block is code inside another routine, read as data) */
export const SLOT_SWEEP_CKSUM_BASE = 0x0bf3;
/** [code] base of a code region read as data for this handler's entry integrity checksum (0x5b bytes summed, followed by its 4 guard bytes) */
export const INTEGRITY_CHECKSUM_CODE_BLOCK = 0x2901;
/** [code] ROM 4-byte table: rope-cell index (IXL&3) -> video-RAM column low byte (paired with page 0x84 to form the column base) */
export const ROPE_CELL_COLUMN_TABLE = 0x2db8;
/** [code] ROM byte table indexed by the adjusted attribute value; OR-ed into an actor attribute byte (+0x08) */
export const ACTOR_ATTR_MERGE_TABLE = 0x3727;
/** [code] ROM byte table indexed by 2*DIFFICULTY_DSW + clamped ROUND_COUNTER; supplies the base value for an actor attribute byte (+0x08) */
export const ACTOR_ATTR_BASE_TABLE = 0x3737;
/** [code] ROM 4-frame animation table (sibling of ANIM_TABLE_3829) armed into the descending object's record by the descent step */
export const ANIM_TABLE_3838 = 0x3838;
/** [code] animation-sequence pointer armed into even eagle records (IXL bit3 clear) */
export const EAGLE_EVEN_RECORD_ANIM = 0x4086;
/** [code] ROM animation-sequence descriptor armed via setActorAnimation when a spawned object lands/settles (also installed by the rope-grab path) */
export const LANDING_ANIM_SEQ_40B4 = 0x40b4;
/** [code] top of the ROM block loc_3865 sums backward (to the 0x1a terminator) for its tamper check; a ROM address, not a RAM cell */
export const ACTOR_TAMPER_CKSUM_TOP = 0x4282;
/** [code] ROM byte table indexed by the clamped spawn speed index; result stored at 0x8d5d */
export const SPAWN_SPEED_TABLE = 0x5407;
/** [code] fixed 56-byte block whose folded low-nibble sum is the object-frame anti-tamper sentinel (running low byte 0x67 with exactly one carry) */
export const TAMPER_NIBBLE_SUM_BLOCK = 0x557f;
/** [code] ROM byte table; the spawn reads entry [1] into the formation record's +0x09 field (its two's-complement negation into +0x0a) */
export const SPAWN_FIELD_TABLE = 0x5902;
/** [code] top of the 31-byte program block summed downward by the credit-draw anti-tamper tripwire (clean-image sum sentinel 0x8c) */
export const HUD_GUARD_CKSUM_TOP = 0x64c8;
/** [code] code base whose bytes loc_79e9 sums (forward to the terminating ret) as an integrity self-check */
export const SELFCHECK_ROUTINE_BASE_ADDR = 0x68ac;
/** [code] animation-sequence pointer armed into odd eagle records (IXL bit3 set) */
export const EAGLE_ODD_RECORD_ANIM = 0x7403;
/** [code] 2 guard bytes (0x7a0b/0x7a0c) the tail integrity checksum's 16-bit sum is verified against */
export const TAIL_CHECKSUM_GUARD = 0x7a0b;
/** [code] start of the boot-blanked video-RAM tile region (video base 0x8400 + 0x40); 0x3c0 tiles through 0x87ff set to erase tile 0x1e */
export const VIDEO_RAM_BLANK_START = 0x8440;
/** [code] video-RAM column base where the 10-entry high-score table is drawn (stacked BCD nibble tiles) */
export const HIGH_SCORE_TABLE_VRAM = 0x85c7;
/** [code] video-RAM base cell of the play-timer digit column; minutes/seconds nibble tiles are written here and up the column (stride -0x20) */
export const PLAY_TIMER_DIGIT_VRAM = 0x862d;
/** [code] video-RAM units-digit tile cell of the 2-digit credit HUD counter */
export const CREDIT_HUD_UNITS_VRAM = 0x869f;
/** [code] video-RAM tens-digit tile cell of the 2-digit credit HUD counter (written only when the tens nibble is nonzero) */
export const CREDIT_HUD_TENS_VRAM = 0x86bf;
/** [code] video-RAM base of the second 3-tile scroll column the per-frame worker stamps (via loc_02a8) and conditionally blanks, stride one tilemap row up */
export const WORKER_COLUMN_VRAM = 0x8740;
/** [code] video-RAM base (bottom origin) of the eagle grid-marker cell region; row (up) and column (right) offsets index from here */
export const EAGLE_GRID_VRAM_BASE = 0x87e0;
/** [code] cabinet lives-count byte (from the lives DSW), seeded into both players' lives at board reset */
export const LIVES_DSW = 0x8807;
/** [code] per-frame worker control byte (one below SPRITE_DISPLAY_LIST): low nibble != 0 gates the program-signature check, bit 4 gates the final scroll-column blank */
export const WORKER_CONTROL_BYTE = 0x883f;
/** [code] 3-byte BCD per-frame score increment added to the active player's score when the award index is 0 */
export const PER_FRAME_SCORE_INCREMENT = 0x88ab;
/** [code] shared per-frame delay/timer counter; decremented while nonzero to gate several object-update sweeps (loc_67a0/6905/756d/6523), reseeded by their handlers */
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
/** [code] base of the 6-slot hunter record table (0x18 stride, scanned DOWNWARD) seeded by launch state 2 */
export const HUNTER_TABLE_BASE = 0x8c78;
/** [code] eagle live Y coordinate; >>3 +4 is its grid row, matched within a 5-row window of the record's target row (ix+4) */
export const EAGLE_Y_COORD = 0x8c94;
/** [code] eagle live X coordinate; >>3 is its grid column, matched against the record's target column (ix+6) or that minus one */
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
/** [code] once-only latch for the gated slot-sweep checksum guard; 0 = pending, set to the free-slot count once the sweep runs */
export const SLOT_SWEEP_LATCH = 0x8d6e;
export const loc_8f0e = 0x8f0e;
export const loc_8f0f = 0x8f0f;
/** [code] rope-extend sub-state selector (0/1) dispatched by the rope state handler; this routine is its state-0 handler and advances it */
export const ROPE_EXTEND_STATE = 0x8f14;
/** [code] rope-extend sub-timer, reloaded to 0x10 when a segment is added (timer role inferred from the reload, not grounded) */
export const ROPE_EXTEND_TIMER = 0x8f16;
/** [code] rope-extend segment index: gates the extend (below 4), indexes the video-column table and the per-segment cell timer */
export const ROPE_EXTEND_INDEX = 0x8f18;
/** [code] 16-bit video-RAM column base (page 0x84) for the current rope segment, looked up from the column table */
export const ROPE_COLUMN_VRAM_PTR = 0x8f19;
/** [code] work-RAM word holding the pointer to the most-recently-seeded hunter record */
export const HUNTER_RECORD_PTR = 0x8f32;
/** [code] spawn countdown seeded 0x20 by launch state 2 on the non-flip path */
export const HUNTER_SPAWN_COUNTDOWN = 0x8f34;
/** [code] eagle grid-advance frame tick; low 3 bits gate the every-eighth-frame grid marker step */
export const EAGLE_GRID_STEP_TICK = 0x8f3b;
/** [code] run-once latch for the playfield tilemap-sum integrity check (loc_6a7f sums once and sets 1); cleared/re-armed to 0 when the state-1 descending object reaches the bottom */
export const TILE_SUM_ONCE_LATCH = 0x8f56;
/** [code] sub-counter bumped by launch state 2 on the flip path */
export const HUNTER_SPAWN_SUBCOUNTER = 0x8f5d;
/** [code] flip flag: when set, launch state 2 bumps a sub-counter instead of enqueuing the spawn display command */
export const HUNTER_SPAWN_FLIP_FLAG = 0x8f61;
/** [code] sprite bank 0 fill start (bank base 0x9000 + 0x10); boot clears 0x30 bytes here */
export const SPRITE0_CLEAR_BASE = 0x9010;
/** [code] sprite bank 1 fill start (bank base 0x9400 + 0x10); boot clears 0x30 bytes here */
export const SPRITE1_CLEAR_BASE = 0x9410;
/** [code] ROM base of the 0x20-byte block summed by the hunter-formation state-2 integrity guard (valid-ROM sum sentinel 0xdc) */
export const FORMATION_GUARD_BASE = 0x0799;
/** [code] ROM colour/attribute column source table for the default field job, selected when the round counter's low bit is set */
export const FIELD_ATTRIB_SRC_A = 0x0839;
/** [code] ROM colour/attribute column source table for the alternate field strip job */
export const FIELD_ATTRIB_SRC_C = 0x0859;
/** [code] ROM colour/attribute column source table for the default field job, selected when the round counter's low bit is clear */
export const FIELD_ATTRIB_SRC_B = 0x0879;
/** [code] four-byte source/pattern table (in ROM) read by the 2x2 tile-block copier */
export const TILE_BLOCK_2X2_SRC = 0x0a72;
/** [code] fixed 3x3 glyph tile source selected when the selector register B's bit5 is clear */
export const GLYPH_TILES_A = 0x203b;
/** [code] fixed 3x3 glyph tile source selected when the selector register B's bit5 is set */
export const GLYPH_TILES_B = 0x2050;
/** [code] base animation-script address reloaded into the script cursor on a control-marker full reset */
export const ANIM_SCRIPT_RESET_PTR = 0x26e7;
/** [code] base of four 4-byte 2x2 tile source blocks (stride 4) for the two-tile animator */
export const TWOTILE_SRC_TABLE = 0x2744;
/** [code] ROM source tiles for the round-marker 3x3 glyph block (blitTile3x3Block src) */
export const MARKER_GLYPH_SRC = 0x2754;
/** [code] 4-byte 2x2 tile source block for the ready-sprite square */
export const READY_SPRITE_SRC = 0x2be1;
/** [code] ROM animation-sequence descriptor stored into a record's anim field (ix+0x0c/0x0d) by setActorAnimation */
export const RECORD_ANIM_SEQ_2CA7 = 0x2ca7;
/** [code] ROM script/table pointer seeded little-endian into a record's +0x16/+0x17 script field */
export const RECORD_SCRIPT_2D00 = 0x2d00;
/** [code] ROM 4-byte 2x2 tile-block source blitted by the launch state machine (loc_27f3 uses this or 0x2d55) */
export const LAUNCH_TILE_SRC = 0x2d51;
/** [code] ROM animation-sequence table (4-frame attr/tile/colour loop) an actor record is pointed at */
export const ANIM_TABLE_3829 = 0x3829;
/** [code] turn-animation script table (4-byte-per-frame {attr,tile,colour} loop, sibling of loc_4221's scripts) armed into an actor record by loc_425c; specific animation not grounded */
export const ANIM_SCRIPT_4203 = 0x4203;
/** [code] ROM animation-script table armed via setActorAnimation on the interior-entry turn path (mirror of loc_4221) */
export const ANIM_SCRIPT_4212 = 0x4212;
/** [code] base of the 14-byte program block loc_1bcc folds (each byte masked to 5 bits) into the signature sentinel; the block is actually code inside loc_52f6's range, read as data (a self-checksum) */
export const TAMPER_CHECKSUM_CODE_BASE = 0x5328;
/** [code] top of the ROM block summed downward (to the 0x34 sentinel) by the loc_7e6d anti-tamper guard; also routine entry loc_64be, hence the _ADDR suffix */
export const TAMPER_CKSUM_TOP_ADDR = 0x64be;
/** [code] ROM table of expected tile-region checksum values (low-byte sum / wrap-count pairs) for the tamper guard */
export const TILE_CHECKSUM_TABLE = 0x68eb;
/** [code] ROM animation parameter block armed via setActorAnimation when an object advances to its next state */
export const ANIM_PARAM_68EF = 0x68ef;
/** [code] ROM 4-byte-per-record eagle-wave parameter table (record fields +6/+0x10/+4/+0x0f) */
export const EAGLE_WAVE_PARAM_TABLE = 0x7409;
/** [code] two 2-byte blink tile pairs in ROM ({0x3f,0x46} at +0, {0x46,0x3f} at +2) */
export const BLINK_TILE_PAIRS = 0x76e6;
/** [code] ROM pointer table of field-record lists, indexed by the field-render selector */
export const FIELD_RECORD_PTR_TABLE = 0x7a0d;
/** [code] 0x8000-page tilemap destination cell where loc_1ffb stamps the selected 3x3 glyph block (in the 0x8000-0x83ff colour/attribute region per the memory map) */
export const GLYPH_BLOCK_DEST = 0x8062;
/** [code] colour/attribute-map base for the alternate field job's 16-row vertical strip */
export const FIELD_C_ATTRIB_DEST = 0x811c;
/** [code] video-RAM anchor for the second 2x2 tile block stamped by loc_0a52 (specific graphic ungrounded) */
export const VRAM_TILE_BLOCK_DEST_B = 0x826a;
/** [code] video-RAM anchor for the first 2x2 tile block stamped by loc_0a52 (specific graphic ungrounded) */
export const VRAM_TILE_BLOCK_DEST_A = 0x82aa;
/** [code] base of the playfield tilemap tile region in video RAM (checksum/fill scan start) */
export const PLAYFIELD_TILE_BASE = 0x8402;
/** [code] video-RAM base of the 10-row packed-BCD digit panel */
export const PANEL_DIGIT_VRAM_DEST = 0x8467;
/** [code] first video cell of the blinking tile pair (second cell at +0x40) */
export const BLINK_TILE_CELL_0 = 0x8471;
/** [code] VRAM base of an 8-cell vertical tile column: top N cells filled (0x0c), the rest blanked (0x10), N derived from the actor-table count */
export const COUNT_COLUMN_VRAM = 0x8482;
/** [code] VRAM anchor for the arrow/launch 2x2 tile blit (shared with loc_27f3) */
export const LAUNCH_TILE_VRAM = 0x84a7;
/** [code] video-RAM anchor for the two-tile blit; the second block is stamped two rows above */
export const BLIT_SCREEN_ANCHOR = 0x84b4;
/** [code] video-RAM 2x2-blit anchor of the two-tile animator when round bit0 is clear */
export const TWOTILE_ANIM_VRAM_ALT = 0x84bb;
/** [code] top cap cell of the 3-tile video-RAM column stamped by loc_1ce7 (cap 0x02, then mid/base upward) */
export const COLUMN_CAP_VRAM = 0x84e0;
/** [code] status-panel VRAM tile cell lit (0x6f here / 0x10 in loc_27f3) when the launch fires while the game is idle */
export const LAUNCH_HUD_TILE = 0x8508;
/** [code] video-RAM column base where player-2's score digits are drawn */
export const P2_SCORE_VRAM = 0x8521;
/** [code] video-RAM base cell for the level-intro digit pair (tally at the base, its BCD double two rows up) */
export const HUD_INTRO_DIGITS_BASE = 0x8634;
/** [code] video-RAM column base where the top/high-score digits are drawn */
export const HIGH_SCORE_VRAM = 0x8641;
/** [code] video-RAM top-left cell of the round-marker column (offsets -0x20/+0x20/-0x41 give the count>0 saved ptr, count-0 saved ptr, and count-0 glyph anchor) */
export const MARKER_VRAM_BASE = 0x86c3;
/** [code] video-RAM column base where player-1's score digits are drawn (cursor walks up one row per digit) */
export const P1_SCORE_VRAM = 0x8781;
/** [code] video-RAM 2x2-blit anchor (round-bit0-set anchor of the two-tile animator; also the ready-sprite indicator tile used by loc_2bd3) */
export const READY_SPRITE_TILE_VRAM = 0x87bb;
/** [code] DSW1 bit7 complemented (boot-only; decoded in loc_0092): demo/attract sounds enable; bit0 gates queued sound dispatch when the game is idle */
export const DEMO_SOUNDS_DSW = 0x8821;
/** [code] coin-counter 1 queued-pulse count (decremented one per completed strobe) */
export const COIN1_PULSE_COUNT = 0x8824;
/** [code] coin-counter 1 pulse phase timer (seeded 0x30, drop point 0x18) */
export const COIN1_PULSE_PHASE = 0x8825;
/** [code] low-byte write pointer into the display-command ring (page 0x88), advanced by two per enqueue and clamped up to 0xc0 */
export const DISPLAY_CMD_RING_WRITE_PTR = 0x88a0;
/** [code] LSB of the 3-byte BCD high-score counter (0x88a8..0x88aa, MSB at 0x88aa) */
export const HIGH_SCORE_BCD = 0x88a8;
/** [code] alternate destination pointer for the display-list interpreter (used when FORMATION_SLOT_TABLE != 0), paired with 0x88ba */
export const DISPLAY_LIST_DST_PTR_ALT = 0x88b8;
/** [code] alternate source/layout read pointer for the display-list interpreter (used when FORMATION_SLOT_TABLE != 0), paired with 0x88b8 */
export const DISPLAY_LIST_SRC_PTR_ALT = 0x88ba;
export const loc_8905 = 0x8905;
export const loc_8906 = 0x8906;
/** [code] blink-timer countdown (reload 0x16); decremented per tick, on 0 toggles the phase */
export const BLINK_COUNTDOWN = 0x892a;
/** [code] blink phase byte; toggled on countdown expiry, its parity selects the tile pair */
export const BLINK_PHASE = 0x892b;
/** [code] shared per-frame phase/animation countdown reloaded to 0x12 (also used by loc_27f3/loc_7638) */
export const SHARED_PHASE_COUNTDOWN = 0x892e;
/** [code] frame countdown reseeded to 8 by this handler and decremented by loc_27f3; on reaching 0 it drives the 0x892e tile-flip bit */
export const LAUNCH_FLIP_COUNTDOWN = 0x892f;
/** [code] boolean gate flag enabling the shared actor phase countdown (written by loc_6566) */
export const SHARED_PHASE_GATE = 0x8930;
/** [code] work-RAM word holding the saved round-marker layout pointer */
export const MARKER_LAYOUT_PTR = 0x8932;
/** [code] work-RAM source table (ten 3-byte rows) rendered as packed-BCD digit pairs into the digit panel */
export const PANEL_DIGIT_SOURCE_TABLE = 0x89c0;
/** [code] gate byte for the player-0/1 BCD play-timer; nonzero suppresses the per-frame tick */
export const PLAY_TIMER_GATE_P1 = 0x89e1;
/** [code] gate byte for the player-1/2 BCD play-timer; nonzero suppresses the tick */
export const PLAY_TIMER_GATE_P2 = 0x89e2;
/** [code] anti-tamper flag (set by the loc_08b3 guard, cleared at reset by loc_2527); ORed with BOARD_CLEAR_FLAG to freeze the per-frame object update */
export const TAMPER_OBJECT_FREEZE_FLAG = 0x89fb;
/** [code] player-0/1 BCD play-timer bank: base byte = per-frame sub-counter (rolls at 0x3b/0x3c), +1/+2 = BCD seconds/minutes digits */
export const PLAY_TIMER_BCD_P1 = 0x8a30;
/** [code] player-1/2 BCD play-timer bank (frame sub-counter + BCD seconds/minutes) */
export const PLAY_TIMER_BCD_P2 = 0x8a33;
/** [code] sound-command ring buffer write/tail pointer (0x43..0x5e, wraps); loc_0eb3 stores into the slot it points at */
export const SOUND_RING_WRITE_PTR = 0x8a40;
/** [code] sound-command ring buffer read/head index (0x43..0x5e, wraps); the slot it points at is consumed then freed */
export const SOUND_RING_READ_PTR = 0x8a41;
/** [code] actor-record Y of the arrow/launch object (slot 2, ix+4); launch state machine gates on it (>=0x3c here, >=0x34 in state 1) */
export const ARROW_Y = 0x8ab4;
/** [code] gate byte: when zero, loc_6822 skips the 0x8b28 enemy-record state dispatch */
export const ENEMY_REC_DISPATCH_GATE = 0x8afa;
/** [code] base of the 6-slot per-frame object-state record array (stride 0x18, spans into PROJECTILE_TABLE at 0x8be8) swept by loc_76f4 via dispatchActiveObjectState */
export const OBJECT_STATE_RECORD_BASE = 0x8ba0;
/** [code] byte pending append into the page-0x8a00 text ring (stashed across the append gate) */
export const TEXT_RING_PENDING_BYTE = 0x8d20;
/** [code] work-RAM snapshot of the spawn-phase counter (written alongside ROPE_DRAW_COUNT) */
export const SPAWN_PHASE_SNAPSHOT = 0x8d43;
/** [code] value copied into the launch-arm latch (0x8f20) when nonzero; producer not in the decompiled set */
export const LAUNCH_ARM_LATCH_SEED = 0x8d7a;
/** [code] shift latch: loc_1e55 rotates the complemented joystick's bit4 into bit0 each frame; its low 3 bits decide whether the aim bit4 is cleared (also touched by loc_6cab) */
export const INPUT_ROTATE_LATCH = 0x8f03;
/** [code] two-tile animation hold countdown (reload 0x0c); decremented per frame, on 0 advances the phase */
export const TWOTILE_ANIM_HOLD = 0x8f06;
/** [code] two-tile animation phase byte; incremented on hold expiry, its parity selects the source block */
export const TWOTILE_ANIM_PHASE = 0x8f07;
/** [code] base of four per-cell frame timers (stride 2) for the rope-cell state handlers */
export const ROPE_CELL_TIMERS = 0x8f28;
/** [code] eagle-wave outer-phase counter; cleared when a wave seeds (alongside WAVE_RECORDS_ARRIVED 0x8f39), incremented on the 4th-wave re-arm */
export const WAVE_OUTER_PHASE = 0x8f38;
/** [code] eagle-wave launch flag; set 1 when a wave is seeded, loc_72a7 gates its driver on it being nonzero */
export const WAVE_LAUNCH_FLAG = 0x8f3a;
/** [code] eagle-wave record count = 2*WAVE_INDEX; loc_72a7 walks this many records of the 0x8ae0 table */
export const WAVE_RECORD_COUNT = 0x8f3c;
/** [code] eagle grid-advance done latch: set 1 when the eagle reaches the grid edge (>=0xd0); diverts the approach machine to its reset epilogue */
export const EAGLE_FINISH_FLAG = 0x8f3e;
/** [code] once-only latch gating the playfield tile-region tamper checksum (loc_68ac/loc_3278) */
export const TILE_CHECKSUM_LATCH = 0x8f55;
/** [code] state/flag ORed with WAVE_TEARDOWN_STATE (0x8f24) to gate/abort the player-object update; base of a 4-byte block cleared at reset by loc_2527 (role partially understood) */
export const SECONDARY_TEARDOWN_FLAG = 0x8f57;
/** [code] player-1 controls hardware input port (IN1), active-low; used in upright orientation */
export const IN1_PORT = 0xa0a0;
/** [code] player-2 controls hardware input port (IN2), active-low; used when the screen is flipped (cocktail) */
export const IN2_PORT = 0xa0c0;
/** [code] LS259 latch bit 3 driving the physical coin counter 1 (write_d0: only bit 0 of the value lands) */
export const COIN1_COUNTER_LATCH = 0xa183;

// Stack-scratch window [lo, hi): the emulated Z80 stack lives just below its 0x9000 init (SP inits
// to 0x9000 at loc_0092; measured min SP 0x8fd0 over the boot). Equivalence tests exclude it -- a
// routine's transient stack writes are not game state.
export const STACK_SCRATCH = { lo: 0x8fc0, hi: 0x9000 };

// == Routine dispatch map (idiomatic overrides layered over the translated oracle) ==
// mainLoop runs as the born-live generator on runIdiomaticGame, yielding at the per-frame worker
// (ring-idle) iteration -- the vblank boundary -- and draining the display command ring within the frame
// (as MAME does per vblank); the frozen boot chain's tail call into the main loop returns this generator,
// which the engine drives frame by frame. The leaves below are wired as direct overrides: the memory-only ones
// return their result, and the register/flag-live-out ones set it through the return-assignment bridge
// (return (m.regs.X = v)) so the frozen caller reads it back out of the register. Only the jump-table
// dispatchers stay UNWIRED (tools/registry-coverage.config.mjs).
export const ROUTINES = {
  0x020f: {
    name: "mainLoop",
    role: "the main-loop state driver: each iteration runs the per-frame worker or dispatches one display-ring handler; as the born-live generator it drains the ring within a frame and yields at the worker/ring-idle vblank boundary",
    cert: "code",
  },
  0x02aa: { name: "paintColumnBodyTiles", role: "stamp a tilemap column's two body tiles (mid + base)", cert: "code" },
  0x02b1: { name: "blankTileColumn", role: "clear a three-cell tilemap column to the blank tile", cert: "code" },
  0x02e6: { name: "seedTileFillCursor", role: "arm the row-by-row tile fill: point the write cursor + seed the row count", cert: "code" },
  0x032a: { name: "copyObjectRecordsToDisplayList", role: "copy four raw bytes of each object record into the sprite display list", cert: "code" },
  0x0378: { name: "mirrorSpriteListVertically", role: "mirror the sprite display list for a flipped screen", cert: "code" },
  0x03c2: { name: "renderPhaseGauge", role: "render the phase counter as a vertical HUD gauge", cert: "code" },
  0x0429: { name: "splitBcdByte", role: "split a packed-BCD byte into two digit tiles: store the low nibble at the cursor, advance it, and return the high nibble (Z when zero)", cert: "code" },
  0x0460: { name: "renderPanelFromTable", role: "paint the status panel from its tile source table", cert: "code" },
  0x04f2: { name: "selectActivePlayerScoreBuffer", role: "select the active player's 3-byte BCD score-buffer pointer", cert: "code" },
  0x059d: { name: "renderDigitWithBlanking", role: "emit one digit tile with leading-zero blanking and step the cursor", cert: "code" },
  0x062a: { name: "byteToPackedBcd", role: "convert a binary byte to packed BCD (value mod 100)", cert: "code" },
  0x0644: { name: "flagHighScoreTableCorruptOnChecksumMiss", role: "raise the high-score-table corrupt flag on a checksum miss", cert: "code" },
  0x075d: { name: "fillAttributeColumns", role: "flood the colour/attribute map from ATTRIB_MAP_BASE", cert: "code" },
  0x0a0c: { name: "seedObjectRecord", role: "seed one object record from a descriptor and coordinate stream", cert: "code" },
  0x0a40: { name: "paintTileBlock2x2", role: "stamp a 2x2 tile block", cert: "code" },
  0x0e46: { name: "clearBit2AcrossSixSlots", role: "clear bit 2 across six stride-4 table entries", cert: "code" },
  0x0e8f: { name: "sendSoundCommand", role: "hand a command byte to the audio CPU and strobe its IRQ", cert: "code" },
  0x1119: { name: "drawStackedBcdDigits", role: "draw a packed-BCD byte as two stacked digit tiles, tens then units one row up, leading zero blanked", cert: "code" },
  0x1131: { name: "binToPackedBcd", role: "convert a binary count to packed BCD digits plus a hundreds tally", cert: "code" },
  0x19bc: { name: "clearActorArena", role: "zero the actor-record arena at board init", cert: "code" },
  0x1a47: { name: "saveLiveStateToPlayerBank", role: "copy the live state page into the active player's bank", cert: "code" },
  0x1b80: { name: "copyBiasedTileString", role: "copy a ROM string into a tile buffer, biasing each byte", cert: "code" },
  0x1bab: { name: "saveLivePageToPlayer0Bank", role: "latch player 1 active and snapshot the live page into player 0's bank", cert: "code" },
  0x1cec: { name: "paintColumnBodyTilesUp", role: "stamp a column's two body tiles upward", cert: "code" },
  0x1f8c: { name: "blitGlyphBlock4x3", role: "stamp a 4x3 glyph block into the tilemap", cert: "code" },
  0x2065: { name: "paintPhaseGauge", role: "paint the vertical phase-gauge HUD tiles", cert: "code" },
  0x208c: { name: "verifyRomSignature", role: "sample the code region against the reference table; flag a signature mismatch", cert: "code" },
  0x22d0: { name: "foldTargetPresenceBits", role: "rotate-fold the two enemy targets' presence bits into an accumulator", cert: "code" },
  0x23d7: { name: "deriveStackedSpriteYs", role: "write the three stacked sprite Y coordinates of the player actor", cert: "code" },
  0x23ec: { name: "retreatTileAnimScript", role: "retreat the video-RAM tile strip on even parity ticks", cert: "code" },
  0x2405: { name: "advanceTileAnimForwardOnOdd", role: "advance the video-RAM tile strip on odd parity ticks", cert: "code" },
  0x24db: { name: "advanceActorDropStateOnDelay", role: "step a falling actor's record fields once its delay elapses", cert: "code" },
  0x2ab3: { name: "advanceRisingActorStep", role: "step a rising actor one motion increment", cert: "code" },
  0x2ae8: { name: "clearActorArenaAndCounters", role: "zero the actor arena and reset the spawn/wave counters", cert: "code" },
  0x3307: { name: "blitTile3x3Block", role: "stamp a 3x3 tile block into video RAM", cert: "code" },
  0x3325: { name: "blit2x2TileBlock", role: "copy four source bytes into a 2x2 video-RAM square", cert: "code" },
  0x34c9: { name: "renderStageCountdownDigits", role: "draw the stage-countdown number as two HUD digits", cert: "code" },
  0x381e: { name: "setActorAnimation", role: "point an actor record at an animation sequence and restart it", cert: "code" },
  0x3fd5: { name: "advanceFallStep", role: "advance a falling actor one gravity step; carry set while still above the landing row", cert: "code" },
  0x3fe9: { name: "verifyRomChecksum", role: "sum a ROM block and strike the state-10 tamper counter on deviation", cert: "code" },
  0x403c: { name: "advanceActorAnimFrame", role: "advance an actor's animation stream one frame", cert: "code" },
  0x57b4: { name: "adjustSpawnColumn", role: "shift the spawn-column index by wave progress in the early stages", cert: "code" },
  0x57e5: { name: "stampObjectAndDecCounter", role: "load a control byte, decrement the shared counter, and stamp two fixed state bytes into an object record", cert: "code" },
  0x585b: { name: "verifyTableChecksum", role: "sum a table and raise the ROM-check flag on mismatch", cert: "code" },
  0x5b06: { name: "flagTamperOnRound5ChecksumMiss", role: "bump the tamper freeze tally on the round-5 checksum miss", cert: "code" },
  0x5c75: { name: "storeActorAnimationPointer", role: "install a record's animation-script pointer and reset its frame index", cert: "code" },
  0x5d1e: { name: "tickActorAnimHold", role: "count a record's animation hold down and step its phase", cert: "code" },
  0x5f53: { name: "precheckCollisionBounds", role: "bias an actor's X and test whether its Y+margin clears the bottom", cert: "code" },
  0x619f: { name: "initActorRecord", role: "stamp the fixed opening state into a fresh actor record", cert: "code" },
  0x7292: { name: "advanceEaglePhaseAndClearAim", role: "step the eagle's phase and clear its aim flags", cert: "code" },
  0x7707: { name: "dispatchActiveObjectState", role: "run one active object record's per-frame state handler, selected by (IX+2)&3 of four; inactive records are skipped", cert: "code" },
  0x780f: { name: "paintTileBlock2x2Above", role: "stamp a 2x2 tile block anchored one row above", cert: "code" },
  0x0010: { name: "loc_0010", role: "fill a run of bytes with a constant, advancing the pointer (a zero counter fills 256)", cert: "code" },
  0x0020: { name: "loc_0020", role: "rst-0x20 byte-table lookup: HL += A then A := (HL)", cert: "code" },
  0x0038: { name: "loc_0038", role: "enqueue a two-byte display command into the page-0x88 display-command ring", cert: "code" },
  0x02a8: { name: "loc_02a8", role: "stamp a three-tile vertical tilemap column (cap + two body tiles)", cert: "code" },
  0x02e3: { name: "loc_02e3", role: "arm the row-by-row tile fill from the fixed VRAM start (the reset-to-0x8402 variant)", cert: "code" },
  0x0320: { name: "loc_0320", role: "tick a caller-set frame counter, then run the flip-screen mirror pass when the orientation flag is zero", cert: "code" },
  0x0343: { name: "loc_0343", role: "build sprite display-list entries from moving-object records, deriving screen coordinates from their sub-pixel position pairs", cert: "code" },
  0x039b: { name: "loc_039b", role: "paint the count column: fill N tiles then blank the rest of an 8-cell VRAM column, N from the actor-table count clamped to 8", cert: "code" },
  0x0439: { name: "loc_0439", role: "render ten rows of packed-BCD panel digits into video RAM (delegates the per-nibble split)", cert: "code" },
  0x0552: { name: "loc_0552", role: "reset one of three 3-byte BCD counters and repaint it in its HUD column via the digit painter", cert: "code" },
  0x056b: { name: "loc_056b", role: "draw one of three packed-BCD counters down a screen column, leading zeros blanked", cert: "code" },
  0x05b2: { name: "loc_05b2", role: "draw a table-selected field of stacked characters bottom-up into video RAM (digit or blank mode per selector bit 7)", cert: "code" },
  0x0a52: { name: "loc_0a52", role: "paint two 2x2 tile blocks into video RAM from one shared source pattern", cert: "code" },
  0x0e53: { name: "loc_0e53", role: "phantom no-op (bare ret); display-list dispatch target that returns without drawing", cert: "code" },
  0x0e64: { name: "loc_0e64", role: "drain one entry from the sound-command ring buffer and dispatch it to the audio CPU (gated by demo-sounds/game-active), then free the slot and advance the head", cert: "code" },
  0x0ea2: { name: "loc_0ea2", role: "append one byte into the page-0x8a00 text ring (gated on game-active/play-mode), then advance and wrap the ring cursor", cert: "code" },
  0x0eb3: { name: "loc_0eb3", role: "enqueue a command byte into the sound-command ring buffer (advance the write pointer, wrapping 0x5e->0x43)", cert: "code" },
  0x0f09: { name: "loc_0f09", role: "emit the preset sound command to the audio CPU", cert: "code" },
  0x141c: { name: "loc_141c", role: "gate an actor's spawn/queue step on its phase field; below threshold, clear a field and (re)start its animation", cert: "code" },
  0x191c: { name: "loc_191c", role: "choose the enemy speed/column value for a new target group (gated), commit it to the speed index and clear the aim flags plus two adjacent cells", cert: "code" },
  0x1a85: { name: "loc_1a85", role: "redraw the phase gauge, then set the play sub-state index for the active player", cert: "code" },
  0x1bcc: { name: "loc_1bcc", role: "player-state bank snapshot + signature-checksum tripwire: copy the live page into player 1's bank, clear the sub-state index, bump the signature tamper counter unless a fixed program block folds to its sentinel", cert: "code" },
  0x1ce7: { name: "loc_1ce7", role: "stamp a three-cell vertical tilemap column: cap tile then the two body tiles one row up each", cert: "code" },
  0x1dd3: { name: "loc_1dd3", role: "paint the playfield colour/attribute map for the current field variant (default two-column job or alternate strip)", cert: "code" },
  0x1e55: { name: "loc_1e55", role: "per-frame joystick sampler for the player-actor state byte: abort/freeze flags zero it, else store the complemented joystick and rotate its bit4 through a shift latch that gates clearing the state byte's bit4", cert: "code" },
  0x1ffb: { name: "loc_1ffb", role: "render one of two glyph blocks (selected by B bit5) into the tilemap via blitTile3x3Block", cert: "code" },
  0x22e6: { name: "loc_22e6", role: "step one actor's animation script, pulling/advancing the shared script cursor when its frame countdown expires", cert: "code" },
  0x2563: { name: "loc_2563", role: "frame-gated two-tile animation: hold-countdown timer that on expiry blits two 2x2 tile squares selected by round/phase parity", cert: "code" },
  0x278f: { name: "loc_278f", role: "launch state machine state 0: arm and gate the arrow/rope launch, advance the state, and blit the launch tile", cert: "code" },
  0x28c5: { name: "loc_28c5", role: "phantom no-op (bare ret); launch-state-machine idle state and a neighbour's rst-0x10 landing", cert: "code" },
  0x2bd3: { name: "loc_2bd3", role: "paint the ready-sprite 2x2 tile square unless it is already present", cert: "code" },
  0x2c85: { name: "loc_2c85", role: "per-record helper: on state 0x11 advance to 0x12, arm the animation, and seed the script pointer", cert: "code" },
  0x2e45: { name: "loc_2e45", role: "decrement one of the four rope-cell frame timers selected by IXL&3; leave its address in HL and reached-zero in the Z flag", cert: "code" },
  0x3266: { name: "loc_3266", role: "hunter-formation dispatch state 2: ROM self-check summing a 0x20-byte block to the 0xdc sentinel (traps on mismatch)", cert: "code" },
  0x3278: { name: "loc_3278", role: "board tile-sum check: once-per-arm, sum the playfield and match it against a ROM table (miss = data-integrity trap)", cert: "code" },
  0x4006: { name: "loc_4006", role: "step one object's animation sequence (frame-hold countdown + script walk) for the record at IX", cert: "code" },
  0x4179: { name: "loc_4179", role: "phantom no-op (bare ret); a call target that returns without doing work", cert: "code" },
  0x423a: { name: "loc_423a", role: "interior-entry arm: clear the turn-column limit and arm the 0x4212 turn animation", cert: "code" },
  0x425c: { name: "loc_425c", role: "arm an actor's turn animation (interior entry): latch the turn-column limit and point the record at the 0x4203 animation script", cert: "code" },
  0x4378: { name: "loc_4378", role: "phantom no-op (bare ret); a called stub with no effect", cert: "code" },
  0x4381: { name: "loc_4381", role: "display-list interpreter: copy/skip/reload a source stream into video RAM, advancing the chosen dest/src pointer pair", cert: "code" },
  0x4a0b: { name: "loc_4a0b", role: "draw the round marker: snapshot the spawn-phase count then paint the marker column + 3x3 glyph, gated on the round counter's low bit", cert: "code" },
  0x5a9c: { name: "loc_5a9c", role: "coin-counter 1 pulse generator: strobe the coin-counter latch from the queued pulse count + phase timer", cert: "code" },
  0x5d0b: { name: "loc_5d0b", role: "tick the animation-hold countdown for each of the six enemy actor-table records", cert: "code" },
  0x64fb: { name: "loc_64fb", role: "dispatch the 0x8c78 fountain record's per-frame state handler, selected by state byte (IX+2) of three (0/1/2)", cert: "code" },
  0x667c: { name: "loc_667c", role: "advance one actor while its state byte is idle, retiring the record at the top row (0x1d)", cert: "code" },
  0x66fd: { name: "loc_66fd", role: "run an actor's shared phase countdown; on expiry advance the phase, record fields, animation and tile id", cert: "code" },
  0x683a: { name: "loc_683a", role: "advance an object record to its next state: phase bump, field reseed, and animation arm", cert: "code" },
  0x68ac: { name: "loc_68ac", role: "once-only playfield tile-region tamper checksum and dispatch (returns on match, throws on tamper)", cert: "code" },
  0x6b13: { name: "loc_6b13", role: "frame-gated two-tile blitter: on hold expiry, reload+advance phase and stamp a phase-selected 2x2 block at two screen positions", cert: "code" },
  0x6f42: { name: "loc_6f42", role: "level-intro phase 2: advance the intro phase and draw the target-hit tally as two stacked digit pairs", cert: "code" },
  0x7287: { name: "loc_7287", role: "eagle grid-advance guard: return the eagle coordinate until it reaches the grid edge, then arm the done latch and run the phase-reset epilogue", cert: "code" },
  0x72e1: { name: "loc_72e1", role: "seed the next eagle attack wave: raise the launch flag, advance the wave index, and initialise the per-wave enemy records (or re-arm on the 4th wave)", cert: "code" },
  0x76af: { name: "loc_76af", role: "two-phase blink timer: on countdown expiry toggle the phase and swap a video tile pair", cert: "code" },
  0x7912: { name: "loc_7912", role: "tick the active player's BCD play-timer (frame sub-counter 0..0x3b/0x3c then BCD seconds/minutes carry)", cert: "code" },
  0x7e6d: { name: "loc_7e6d", role: "periodic anti-tamper ROM checksum guard; bumps the ROM tamper-strike counter on a signature miss", cert: "code" },
  0x01ea: { name: "loc_01ea", role: "boot RAM clear: fill both sprite-bank tops with A + blank lower video RAM to tile 0x1e, then cycle-only settle-delay", cert: "code" },
  0x0254: { name: "loc_0254", role: "per-frame scroll worker dispatched by the main loop: repaint the scroll tile columns, or run the program-signature check when the control byte's low nibble is set", cert: "code" },
  0x02b9: { name: "loc_02b9", role: "zero the board-init RAM regions (sprite display list + actor/object arena)", cert: "code" },
  0x02ce: { name: "loc_02ce", role: "row-by-row VRAM tile fill: blank B tiles at the fill cursor (loc_0010), advance one row (+0x20-B), store cursor, dec row counter; Z = drained", cert: "code" },
  0x02ef: { name: "loc_02ef", role: "per-frame sprite display-list rebuild (4 record groups + arrow Y-tick + flip-mirror tail)", cert: "code" },
  0x03e9: { name: "loc_03e9", role: "paint the attract HUD/score panels: eleven selector fields, the ten-entry high-score table as stacked BCD digit pairs, then the digit and status panels", cert: "code" },
  0x0496: { name: "loc_0496", role: "accrue the active player's BCD score and keep the high score in step", cert: "code" },
  0x05ee: { name: "loc_05ee", role: "draw the credit count as two HUD digit tiles, then run a ROM-checksum anti-tamper tripwire", cert: "code" },
  0x0e00: { name: "loc_0e00", role: "reset the actor/sprite state for a new board", cert: "code" },
  0x0e54: { name: "loc_0e54", role: "queue the primary display command, plus the free-play extra command when the coinage config is the free-play sentinel", cert: "code" },
  0x0ecf: { name: "loc_0ecf", role: "sound-command selector 0x00: A=0, tail-enqueue into the sound-command ring (loc_0eb3)", cert: "code" },
  0x0ed2: { name: "loc_0ed2", role: "queue command 0x01 into the command ring (thin wrapper over loc_0ea2)", cert: "code" },
  0x0ed6: { name: "loc_0ed6", role: "enqueue the fixed sound command 0x02 into the sound-command ring", cert: "code" },
  0x0eda: { name: "loc_0eda", role: "queue two fixed sound commands into the sound-command ring", cert: "code" },
  0x0ee3: { name: "loc_0ee3", role: "conditional sound-command enqueue: gated on wave-teardown/grab-active, then tail-appends command 0x04 to the page-0x8a command ring", cert: "code" },
  0x0ef1: { name: "loc_0ef1", role: "enqueue fixed sound command 0x05 into the sound-command ring (wrapper over loc_0eb3)", cert: "code" },
  0x0ef5: { name: "loc_0ef5", role: "sound-command stub: append the fixed command byte 0x06 into the page-0x8a text/command ring via loc_0ea2", cert: "code" },
  0x0ef9: { name: "loc_0ef9", role: "append the fixed byte 0x07 into the page-0x8a command ring (load the constant, tail-call the ring appender)", cert: "code" },
  0x0efd: { name: "loc_0efd", role: "command 0x08: append the fixed byte 0x08 into the page-0x8a command ring", cert: "code" },
  0x0f01: { name: "loc_0f01", role: "sound-command selector 0x09: A=9, tail-enqueue into the sound-command ring (loc_0eb3)", cert: "code" },
  0x0f05: { name: "loc_0f05", role: "queue command 0x0a into the command ring (thin wrapper over loc_0ea2)", cert: "code" },
  0x0f0d: { name: "loc_0f0d", role: "append the fixed command byte 0x0b into the page-0x8a command ring", cert: "code" },
  0x0f11: { name: "loc_0f11", role: "enqueue the fixed command byte 0x0c into the command ring (via the ring-append helper)", cert: "code" },
  0x0f15: { name: "loc_0f15", role: "append fixed command byte 0x0d to the 0x8a-page text ring (wrapper over loc_0ea2)", cert: "code" },
  0x0f19: { name: "loc_0f19", role: "command emitter: append the fixed byte 0x0e into the page-0x8a command ring (thin wrapper tail-calling loc_0ea2)", cert: "code" },
  0x0f1d: { name: "loc_0f1d", role: "append the fixed byte 0x0f into the page-0x8a ring via loc_0ea2", cert: "code" },
  0x0f21: { name: "loc_0f21", role: "queue two command bytes (0x95 then 0x10) into the command ring", cert: "code" },
  0x0f2b: { name: "loc_0f2b", role: "sound-command stub: append the fixed command byte 0x11 into the page-0x8a text/command ring via loc_0ea2", cert: "code" },
  0x0f30: { name: "loc_0f30", role: "queue three fixed command bytes (0x95, 0x03, 0x11) into the text-command ring via the append helper (last is a tail call)", cert: "code" },
  0x0f3f: { name: "loc_0f3f", role: "queue the page-0x8a text-ring sound command 0x12", cert: "code" },
  0x0f44: { name: "loc_0f44", role: "queue command byte 0x13 into the command ring", cert: "code" },
  0x0f49: { name: "loc_0f49", role: "queue the fixed command byte 0x14 into the text-command ring (tail call to the append helper)", cert: "code" },
  0x0f4e: { name: "loc_0f4e", role: "enqueue two fixed sound commands (0x82, 0x95) into the sound-command ring buffer (last is a tail call)", cert: "code" },
  0x0f58: { name: "loc_0f58", role: "queue four fixed command bytes: 0x96,0x97 into the text/command ring; 0x18,0x15 into the sound ring", cert: "code" },
  0x0f6c: { name: "loc_0f6c", role: "enqueue two sound commands (0x19 then 0x15) into the sound-command ring", cert: "code" },
  0x0fb2: { name: "loc_0fb2", role: "enqueue sound commands 0x27 then 0x15 into the sound-command ring", cert: "code" },
  0x0fbc: { name: "loc_0fbc", role: "enqueue text tiles 0x28,0x15,0x16,0x17 into the text ring", cert: "code" },
  0x0fc3: { name: "loc_0fc3", role: "append a 4-tile run (caller byte + 0x15/0x16/0x17) to the command ring", cert: "code" },
  0x1389: { name: "loc_1389", role: "spawn-step guard: gate the actor spawn/queue step (loc_141c) on bit0 of the record's flag byte (rec+8)", cert: "code" },
  0x19ca: { name: "loc_19ca", role: "periodic warning-siren tick: gated frame countdown that toggles a phase and queues one of two siren display commands", cert: "code" },
  0x1ab2: { name: "loc_1ab2", role: "insert the active player's score into the sorted 10-entry high-score table and its parallel play-time / display-tile side-tables (high-score insert-sort)", cert: "code" },
  0x221e: { name: "loc_221e", role: "object-clear helper: blank a 0x18-byte record at IY to zero", cert: "code" },
  0x22b1: { name: "loc_22b1", role: "step the animation script of four actor records unless a rope-grab is in progress", cert: "code" },
  0x2527: { name: "loc_2527", role: "board/HUD reset: enqueue a display command, conditionally reseed the spawn-phase/rope-draw counters, clear three RAM blocks (loc_0010) and mirror the fill value into five actor/HUD cells", cert: "code" },
  0x2856: { name: "loc_2856", role: "launch-state-machine state 2: seed a new hunter into the first free 0x8c78-table slot (unless play-mode set), then bump the launch state and either seed the spawn countdown + enqueue a display command or bump a sub-counter", cert: "code" },
  0x28ad: { name: "loc_28ad", role: "launch state-3 handler: run the state-3 hold countdown, then advance the launch state and (unless play-mode latched) clear the pointed-to 0x18-byte record via loc_0010", cert: "code" },
  0x2a32: { name: "loc_2a32", role: "actor state-3 handler: tile-flip + 16-bit position advance by 0x80, milestone display-command enqueues, state advance", cert: "code" },
  0x2bd2: { name: "loc_2bd2", role: "stack-adjust entry (inc sp) that falls into the ready-sprite painter loc_2bd3; memory behaviour equals the painter's", cert: "code" },
  0x2d80: { name: "loc_2d80", role: "rope-extend driver sub-state 0: add one rope segment", cert: "code" },
  0x2e52: { name: "loc_2e52", role: "compute the video-RAM column base for a rope cell (IXL&3 ROM-table lookup)", cert: "code" },
  0x324d: { name: "loc_324d", role: "per-slot hunter-return tick: gate (ix+0)>=0x40, drop 0x8c-page paced counter by 0x40, on borrow dec paired byte + (board-clear) tail to loc_3278", cert: "code" },
  0x3553: { name: "loc_3553", role: "blank an actor's sprite band: fill 0x17 bytes from IX with zero", cert: "code" },
  0x36de: { name: "loc_36de", role: "build an actor attribute byte (+0x08) via two table lookups with flag/phase/stage adjustments", cert: "code" },
  0x3865: { name: "loc_3865", role: "actor state handler with embedded tamper check: run the animation player, tick the per-record timer, and on expiry advance state and (in the object-table band with the frame gate clear) fold a ROM checksum, bumping the signature-mismatch flag on deviation", cert: "code" },
  0x3e9c: { name: "loc_3e9c", role: "object state-6 handler: in-flight mover for a spawned object (waypoint/free modes; lands via loc_381e anim + state flip)", cert: "code" },
  0x4103: { name: "loc_4103", role: "per-object frame-advance: loc_4006 animate, (ix+11h) dwell, on expiry bump phase + clear (ix+13h) + frame-zero-crossing signature checksum bumping TAMPER_STRIKES_SIG", cert: "code" },
  0x4350: { name: "loc_4350", role: "object state handler: tick loc_4006, count down the (ix+0x11) phase timer, then on lapse step (ix+0x02) and re-arm the turn animation (bit0 of (ix+0x08) selects loc_425c vs loc_423a)", cert: "code" },
  0x52f6: { name: "loc_52f6", role: "gated slot sweep + ROM-checksum tamper tripwire", cert: "code" },
  0x53b0: { name: "loc_53b0", role: "one-shot gated formation-record spawn/init: fill record fields + derive spawn speed from round counter", cert: "code" },
  0x6523: { name: "loc_6523", role: "seat a fresh object record and enqueue its spawn display command(s)", cert: "code" },
  0x672a: { name: "loc_672a", role: "object descent step: run loc_4006, advance the 16-bit sub-position, seat a matching free spawn-object slot when the landing row is reached, then bump state, reload the step to 0x18 and re-arm the animation via setActorAnimation", cert: "code" },
  0x67a0: { name: "loc_67a0", role: "per-object frame update gated by the shared frame-delay timer (animation step + 16-bit position moves + state advance)", cert: "code" },
  0x69c6: { name: "loc_69c6", role: "advance a paired ix/iy descending object one step: run the sequencer, lower both 16-bit positions by their delta, then gate/retire on the ix high byte", cert: "code" },
  0x6aa8: { name: "loc_6aa8", role: "state-1 step of a descending object: move it down, then at bottom re-arm the tile-sum latch and advance state", cert: "code" },
  0x7059: { name: "loc_7059", role: "phase-5 target-group tick: decrement the counter at HL and queue display command 0x0315", cert: "code" },
  0x71ce: { name: "loc_71ce", role: "eagle/arrow approach state machine: hold-gate, drive the aim flags and records-arrived sub-phase from the eagle X, and step the grid marker + colour every eighth frame (delegating the grid-edge guard and phase-reset epilogue)", cert: "code" },
  0x733c: { name: "loc_733c", role: "eagle approach state: gate eagle grid col/row vs (ix+6)/(ix+4) window, on hit advance (ix+2), arm anim + set (ix+9), even records bump arrived count + (all arrived) queue wave sound via rst 0x38", cert: "code" },
  0x7395: { name: "loc_7395", role: "eagle-record dive/climb state: run the animation mover (loc_4006) then integrate the record's vertical position by its speed, advancing the state byte at the row limit", cert: "code" },
  0x73ce: { name: "loc_73ce", role: "eagle-record state 2 (retire): clear the record and, when the wave empties, seed the inter-wave hold", cert: "code" },
  0x73e3: { name: "loc_73e3", role: "eagle inter-wave idle handler: tick the hold timer, or on expiry enqueue the wave sound, reseed the hold, and clear the launch flag", cert: "code" },
  0x7421: { name: "loc_7421", role: "bonus-stage teardown (phase 2): clear wave/enemy state and hand back to the attract sub-state", cert: "code" },
  0x7960: { name: "loc_7960", role: "shared integrity + play-timer nibble-render handler: enqueue a display command, verify a code-block checksum, render the active player's timer BCD as nibble tiles and clear them, then scan a flag block that can divert to a tail checksum", cert: "code" },
  0x79e9: { name: "loc_79e9", role: "code-region integrity self-check: sum a fixed routine's bytes into a 16-bit checksum and match it against the stored word (trap/divert on mismatch)", cert: "code" },
};
