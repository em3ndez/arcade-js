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
/** [code] (both goldens: a P1-held 1P game (holds 0) plus one scratch 0x1f write at f319 = leftover A from loc_075d's fill loop stored by loc_0c45, NOT a player value; the bit0=1->P2 switch is never observed) active-player select; bit0=0 -> P1 banks (score 0x88a2/counter 0x88a4), 1 -> P2 (0x88a5/0x88a7) */
export const ACTIVE_PLAYER = 0x880d;
/** [code] (static 0 in both goldens (no 2P game played) -> unobservable/code; loc_0dab sets 1 on 2P start (hi byte of 0x0100), loc_7fd6 picks player bank when nonzero) nonzero for a 2-player game; gates per-player bank selection (with 0x880d) and the 2P start event */
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
/** [code] (static 0 in both goldens (slowest tier); role code-confident from loc_142c/379d speed-table index (0x148e/0x38a5) + loc_191c escalating write) Enemy speed/difficulty index, read clamped <8 to index velocity tables (negated per 0x8907 bit0); escalates with wave/round */
export const SPEED_INDEX = 0x8900;
/** [seen] (gameplay 0x20 then slow decrement 32->..->25 = per-stage countdown) counts down from 0x20 over a stage; near 0 gates actor AI; init value selects the stage label */
export const STAGE_COUNTDOWN = 0x8901;
/** [code] (static 0 in both goldens; role code-confident from loc_196e mode-select (<5/==5) + loc_2527 reseed at 7, cleared by loc_2ae8) Per-round phase/step counter (cycles to 7) selecting spawn/fire mode branches; snapshotted into 0x8d43/0x8934 */
export const SPAWN_PHASE_COUNTER = 0x8902;
/** [seen] (play: counts up 0..6 per stage then resets at transition = a per-stage arrival/wave counter (loc_3be3 bump, loc_2a01 cap, loc_2d80 rope bound)) Per-stage counter bumped on enemy arrival (caps 9->8); bounds the rope-segment count (0x8931 <= this-2), parity picks spawn variant */
export const WAVE_ARRIVAL_COUNTER = 0x8903;
/** [seen] (attract+play: 0/1 flag, 1 while a round runs, resets at stage/life transitions (loc_175d/1798 set, loc_1dd3/16b7 read)) In-progress flag for the active round; set to 1 at level start, keys render/state decision trees */
export const ROUND_IN_PROGRESS = 0x8904;
/** [code] (static 0 in both goldens (round 0); role code-confident from loc_1f2f/1ead BCD round render + widespread bit0 variant gates) Round counter; +1 BCD-rendered as the HUD round number; bit0 selects stage-type/facing variant, low bits index difficulty tables */
export const ROUND_COUNTER = 0x8907;
/** [seen] (play: 3->2->1->0 then reset to 3; exhaustion runs loc_1a96 (phase transition, not death) rendered by loc_03c2 = a phase gauge) Phase counter drained per phase, drawn as a 5-cell vertical HUD gauge; on reaching 0 it triggers phase-exhausted (clears rope) */
export const GAUGE_PHASE_COUNTER = 0x8908;
/** [seen] (both goldens: byte0 cycles 0/1/2 = the 0x88b7-wrap display one-shot (loc_175d/7517 inc/test/clear); the pointer-table role (loc_308b/30f1 register 4 formation slots, stride 2) is unobserved -- no formation spawned in 180s) display sub-phase one-shot (byte0, fired on the 0x88b7 mod-0x1c wrap); byte0 also the base of the 4-slot enemy-formation pointer table (stride 2) */
export const FORMATION_SLOT_TABLE = 0x8920;
/** [seen] (play: up-counter 0..4, resets to 0 at phase exhaustion (f3778); static 0 in attract (no rope); loc_2d80 steps it, loc_2f2f retracts) Count of extended rope segments; stepped up to 0x8903-2; drives per-segment retract anim and the attribute byte */
export const ROPE_SEGMENT_COUNT = 0x8931;
/** [code] (static 0 in both goldens (mirror of 0x8902) -> code) rope/lift segment draw count (snapshot of 0x8902 phase, reseeds to 4 at 7); sets rope sprite rows */
export const ROPE_DRAW_COUNT = 0x8934;
/** [code] (Static 0 both goldens (no player-swap in 1P golden; byte0=colour seed 0). Code: loc_1a47/loc_1601 ldir 0x8900<->0x8940 per 0x880d, loc_0e00 seeds colour+X.) Base of player-0's 0x3f-byte saved actor/state block, swapped with live page 0x8900; byte0=sprite colour */
export const PLAYER0_STATE_BANK = 0x8940;
/** [seen] (Gameplay golden: 0->3 (seed=default 3 lives) then 3->2->1->0 drain per death, then ->3 for next game. Decisive lives countdown; overturns A's 'active flag' guess. Seeded 0x8807 in loc_0e00 (bank +8).) Player-0 remaining lives, seeded from lives DSW 0x8807; decrements on death, gates player-switch/game-over */
export const PLAYER0_LIVES = 0x8948;
/** [code] (Static 0 both goldens (P1 bank untouched in 1P golden). Code: loc_1a47/loc_1bcc ldir 0x8900->0x8980 for player 1 per 0x880d, loc_0e00 seeds colour+X.) Base of player-1's 0x3f-byte saved actor/state block, swapped with live page 0x8900; byte0=sprite colour */
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
/** [code] (static 0 in BOTH goldens (no formation spawned in the 180s windows); loc_40bd sweeps 4 records stride 0x18, loc_53b0 inits slot 0) Base of the 4-slot formation object table (stride 0x18); one-shot spawn/init, swept per-record */
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
/** [code] (static 0 in both goldens (no turn armed in captures) — code-confident from loc_343e/34f2 compare vs (ix+6)&0x1f and loc_425c arm, ungrounded) Tile-column threshold at which a moving object starts its turn animation; anim-arm routines set it to 0 or 0xff */
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
/** [code] (static 0 in both goldens (formation never triggered in captures) — code-confident from loc_308b, ungrounded) Enemy-formation launch state; 0 while gathering launch-ready slots, set 1 when full then dispatched (&3)-1 into launch handlers */
export const FORMATION_STATE = 0x8f08;
/** [seen] (attract+play: toggles 0<->1 (f1805 0->1) — binary latch, confirms arm-flag role (loc_278f gate)) Arrow/rope launch arm latch: nonzero blocks re-arming launch flag 0x8f3f, seeded from 0x8d7a; cleared with 0x8d75 at wave end */
export const LAUNCH_ARM_LATCH = 0x8f20;
/** [code] (static 0 in both goldens (teardown not triggered) — code-confident from loc_32bd; A/B roles identical, name differs only) Enemy-formation teardown dispatch state: state1 tears down wave, state2 walks boss down; nonzero gates new grabs/launch as busy */
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
/** [code] (static 0 in BOTH goldens (group inactive at capture) -- role code-confident: loc_17c1 seeds, loc_6f9d/6edb consume) Targets in the current group; scaled x5 into HUD 0x8634 and 3x compared to hit tally 0x8f52 for end-level bonus */
export const TARGET_GROUP_COUNT = 0x8f47;
/** [seen] (attract+play: low byte steps +2 across 0x26..0x30 then resets = checksum-ptr walk (loc_0b32/6df9 r/w 16-bit); 0x8f51 intro machine idle so delay-timer use unobserved) Dual-use: intro-phase delay timer (0x40/0x60/0x80, counts down) & anti-tamper column-checksum pointer */
export const INTRO_DELAY_CKSUM_WORD = 0x8f48;
/** [code] (static 0 in BOTH goldens (launcher idle) -- role code-confident: loc_6e86/6db8 script ptr, loc_1d6e/1a01 byte timer(=0x40)) Dual-use: 0xff-terminated object launch/dive-script pointer & 8-bit countdown firing at 0x40 in the launch path */
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
/** [code] (loc_04f2 selects this vs P2_SCORE_BCD off ACTIVE_PLAYER) player-1 live 3-byte BCD score buffer (0x88a2..0x88a4) */
export const P1_SCORE_BCD = 0x88a2;
/** [code] (loc_04f2 P2 bank) player-2 live 3-byte BCD score buffer (0x88a5..0x88a7) */
export const P2_SCORE_BCD = 0x88a5;
/** [code] (loc_585b sets 1 on a checksum mismatch; MULTIPLEXED -- loc_24fb writes 0x07 as a state index, loc_5a56 reads it as a coord low byte by COINAGE_CONFIG) eagle-spawn ROM-checksum mismatch flag */
export const TAMPER_ROM_CHECK_FLAG = 0x882b;
/** [code] (loc_0460 paints PANEL_VRAM_DEST from here) 30-byte status-panel tile source table (10 rows x 3 cells), work RAM */
export const PANEL_TILE_SOURCE = 0x8e00;
/** [code] (loc_0460 destination) VRAM base of the status panel painted from PANEL_TILE_SOURCE */
export const PANEL_VRAM_DEST = 0x8567;
/** [code] (loc_03c2/loc_2065 draw upward, stride -0x20, filled 0xb0 / blank 0x10) bottom cell of the 5-cell vertical phase-gauge HUD */
export const PHASE_GAUGE_BASE_TILE = 0x863f;
/** [code] (loc_34c9 draws the 2-cell stage number; tens tile derives at +0x20) units tile of the stage-countdown HUD number */
export const HUD_STAGE_DIGIT_LO = 0x8743;
/** [code] (loc_3fe9 state-10 integrity guard bumps it on a checksum bit-pattern failure; adjacent TAMPER_STRIKES_SIG) anti-tamper strike counter for the state-10 ROM checksum */
export const TAMPER_STRIKES_STATE10 = 0x8a39;
/** [code] (loc_208c sets 1 on a signature mismatch) work-RAM ROM-signature mismatch flag */
export const SIGNATURE_MISMATCH_FLAG = 0x8ef0;
/** [code] (loc_2405 advance/even, loc_23ec retreat; inc per frame, bit0 gates which pass runs on TILE_ANIM_CURSOR) per-frame tile-animation parity counter */
export const TILE_ANIM_PARITY = 0x8f37;
/** [code] (loc_0e8f writes the command byte here for the audio CPU) sound-command latch to the audio CPU */
export const SOUND_COMMAND_LATCH = 0xa100;
/** [code] (loc_0e8f pulses b1 high, 6x nop, low after a command) audio-IRQ strobe latch (mainlatch b1) */
export const AUDIO_IRQ_LATCH = 0xa181;
/** [code] (loc_208c samples every 8th byte from here) ROM base of the sampled code region for the signature guard */
export const SIGNATURE_SAMPLE_BASE = 0x066d;
/** [code] (loc_208c compares the sample against this) 16-byte expected-signature reference table in ROM */
export const SIGNATURE_REFERENCE_TABLE = 0x20aa;
/** [code] (loc_3fe9 sums the 16-byte block descending from here) top of the ROM block checked by the state-10 integrity guard */
export const ROM_CHECKSUM_TOP = 0x7780;
/** [code] (loc_0644 header byte must be 0xc8; bytes0..3 summed, (sum-carry) must equal 0x59) ROM base of the 4-byte high-score-table checksum block */
export const HISCORE_CHECKSUM_BASE = 0x778a;
/** [code] (loc_0644 sets 1 on a bad header or wrong checksum) work-RAM high-score-table corruption flag */
export const HISCORE_TABLE_CORRUPT_FLAG = 0x8df8;
/** [code] (loc_075d floods 31 columns x 30 rows, stride 0x20 from here) base of the tile-attribute/colour map on the 0x8000 video page */
export const ATTRIB_MAP_BASE = 0x8040;

// Stack-scratch window [lo, hi): the emulated Z80 stack lives just below its 0x9000 init (SP inits
// to 0x9000 at loc_0092; measured min SP 0x8fd0 over the boot). Equivalence tests exclude it -- a
// routine's transient stack writes are not game state.
export const STACK_SCRATCH = { lo: 0x8fc0, hi: 0x9000 };

// == Routine dispatch map (idiomatic overrides layered over the translated oracle) ==
// mainLoop runs as the born-live generator on runIdiomaticGame, yielding once per iteration at the
// vblank boundary; the frozen boot chain's tail call into the main loop returns this generator, which
// the engine drives frame by frame. The memory-only leaves below are wired as direct overrides (their
// only live-out is memory; any residual register the oracle leaves is reloaded by every caller). The
// register/flag-live-out leaves and the jump-table dispatchers stay UNWIRED
// (tools/registry-coverage.config.mjs) pending the return-assignment bridge unit.
export const ROUTINES = {
  0x020f: {
    name: "mainLoop",
    role: "the main-loop state driver: each iteration runs the per-frame worker or dispatches one attract-ring handler; as the born-live generator it yields at the vblank boundary",
    cert: "code",
  },
  0x02aa: { name: "paintColumnBodyTiles", role: "stamp a tilemap column's two body tiles (mid + base)", cert: "code" },
  0x0378: { name: "mirrorSpriteListVertically", role: "mirror the sprite display list for a flipped screen", cert: "code" },
  0x03c2: { name: "renderPhaseGauge", role: "render the phase counter as a vertical HUD gauge", cert: "code" },
  0x0460: { name: "renderPanelFromTable", role: "paint the status panel from its tile source table", cert: "code" },
  0x0644: { name: "flagHighScoreTableCorruptOnChecksumMiss", role: "raise the high-score-table corrupt flag on a checksum miss", cert: "code" },
  0x075d: { name: "fillAttributeColumns", role: "flood the colour/attribute map from ATTRIB_MAP_BASE", cert: "code" },
  0x0a40: { name: "paintTileBlock2x2", role: "stamp a 2x2 tile block", cert: "code" },
  0x0e46: { name: "clearBit2AcrossSixSlots", role: "clear bit 2 across six stride-4 table entries", cert: "code" },
  0x0e8f: { name: "sendSoundCommand", role: "hand a command byte to the audio CPU and strobe its IRQ", cert: "code" },
  0x19bc: { name: "clearActorArena", role: "zero the actor-record arena at board init", cert: "code" },
  0x1a47: { name: "saveLiveStateToPlayerBank", role: "copy the live state page into the active player's bank", cert: "code" },
  0x1b80: { name: "copyBiasedTileString", role: "copy a ROM string into a tile buffer, biasing each byte", cert: "code" },
  0x1bab: { name: "saveLivePageToPlayer0Bank", role: "latch player 1 active and snapshot the live page into player 0's bank", cert: "code" },
  0x1cec: { name: "paintColumnBodyTilesUp", role: "stamp a column's two body tiles upward", cert: "code" },
  0x1f8c: { name: "blitGlyphBlock4x3", role: "stamp a 4x3 glyph block into the tilemap", cert: "code" },
  0x2065: { name: "paintPhaseGauge", role: "paint the vertical phase-gauge HUD tiles", cert: "code" },
  0x208c: { name: "verifyRomSignature", role: "sample the code region against the reference table; flag a signature mismatch", cert: "code" },
  0x23d7: { name: "deriveStackedSpriteYs", role: "write the three stacked sprite Y coordinates of the player actor", cert: "code" },
  0x23ec: { name: "retreatTileAnimScript", role: "retreat the video-RAM tile strip on even parity ticks", cert: "code" },
  0x2405: { name: "advanceTileAnimForwardOnOdd", role: "advance the video-RAM tile strip on odd parity ticks", cert: "code" },
  0x24db: { name: "advanceActorDropStateOnDelay", role: "step a falling actor's record fields once its delay elapses", cert: "code" },
  0x2ab3: { name: "advanceRisingActorStep", role: "step a rising actor one motion increment", cert: "code" },
  0x2ae8: { name: "clearActorArenaAndCounters", role: "zero the actor arena and reset the spawn/wave counters", cert: "code" },
  0x34c9: { name: "renderStageCountdownDigits", role: "draw the stage-countdown number as two HUD digits", cert: "code" },
  0x381e: { name: "setActorAnimation", role: "point an actor record at an animation sequence and restart it", cert: "code" },
  0x3fe9: { name: "verifyRomChecksum", role: "sum a ROM block and strike the state-10 tamper counter on deviation", cert: "code" },
  0x403c: { name: "advanceActorAnimFrame", role: "advance an actor's animation stream one frame", cert: "code" },
  0x585b: { name: "verifyTableChecksum", role: "sum a table and raise the ROM-check flag on mismatch", cert: "code" },
  0x5b06: { name: "flagTamperOnRound5ChecksumMiss", role: "bump the tamper freeze tally on the round-5 checksum miss", cert: "code" },
  0x5c75: { name: "storeActorAnimationPointer", role: "install a record's animation-script pointer and reset its frame index", cert: "code" },
  0x5d1e: { name: "tickActorAnimHold", role: "count a record's animation hold down and step its phase", cert: "code" },
  0x7292: { name: "advanceEaglePhaseAndClearAim", role: "step the eagle's phase and clear its aim flags", cert: "code" },
  0x780f: { name: "paintTileBlock2x2Above", role: "stamp a 2x2 tile block anchored one row above", cert: "code" },
};
