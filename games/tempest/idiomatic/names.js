// SPDX-License-Identifier: GPL-3.0-only
// Tempest idiomatic-layer name registry (cells + ROUTINES override map). loc_<addr> placeholders (names-debt)
// until the understand pass renames + grounds them. Generated from module+test imports and module exports.

export const STACK_SCRATCH = { lo: 0x01e0, hi: 0x0200 };

export const GAME_MODE = 0x0000;  // [seen] Current game-mode/state code that drives the mode dispatch and is armed from the pending mode
export const MODE_DISPATCH_SEL = 0x0001;  // [seen] Pre-doubled selector paired with the mode byte; indexes the main-loop trampoline handler table
export const GAME_MODE_PENDING = 0x0002;  // [seen] Pending game mode promoted into GAME_MODE once the mode-delay timer expires
export const FRAME_COUNTER = 0x0003;  // [seen] Per-update frame counter; its low bits are the animation/even-odd phase read across the draw code
export const MODE_DELAY_TIMER = 0x0004;  // [code] Delay countdown that gates promotion of the pending mode into the live mode
export const STATUS_FLAGS = 0x0005;  // [code] Game status flag byte; bit7 = play/active state, other bits gate scoring, sound and draw paths
export const PHASE_COUNTER = 0x0006;  // [code] Phase/step counter drained by the setup step and clamped to 0x28 for a packed on-screen readout
export const IRQ_SUBTIMER = 0x0007;  // [code] Software sub-timer incremented each interrupt; its wrap drives the TIMER1_LO/TIMER2_LO carry cascades
export const INPUT_PORT_LATCH = 0x0008;  // [code] Latched raw input port snapshot whose bits gate the three heartbeat lanes
export const DSW1_SNAPSHOT = 0x0009;  // [code] Snapshot of option/coinage port DSW1_COINAGE (bit1 toggled), read for configuration and increments
export const DSW2_SNAPSHOT = 0x000a;  // [code] Snapshot of option port DSW2_OPTIONS, sliced three ways into DIP configuration tables
export const SOUND_STEP_GATE = 0x000c;  // [code] Flag enabling the periodic sound-register sub-step in the per-frame dispatcher
export const LANE_WRAP_POS = 0x000d;  // [code] Three-lane wrapped position accumulator (masked to five bits) advanced by the heartbeat
export const LANE_DOWNTIMER = 0x0010;  // [code] Per-lane down-timer (reloads to 0x78) that drives the heartbeat accumulator step
export const LANE_COUNTER = 0x0013;  // [code] Three-entry per-lane counter advanced by the heartbeat; its bit7 feeds the coin/LED latch
export const LANE_COUNTER_1 = 0x0014;  // [code] Second entry of the three-lane heartbeat counter (LANE_COUNTER base)
export const LANE_COUNTER_2 = 0x0015;  // [code] Third entry of the three-lane heartbeat counter (LANE_COUNTER base)
export const HEARTBEAT_ACCUM_LO = 0x0016;  // [code] Low byte of the heartbeat running accumulator advanced with a carry link
export const HEARTBEAT_ACCUM_HI = 0x0017;  // [code] High byte of the heartbeat running accumulator, later reduced by a table amount
export const HEARTBEAT_ACCUM_OVERFLOW = 0x0018;  // [code] Overflow tally advanced when the heartbeat accumulator subtraction stays non-negative
export const LEVEL_GEOM_LO = 0x0019;  // [code] Eight-entry working table of the current level's low geometry nibbles (mirrored to colour RAM COLOR_RAM)
export const LEVEL_GEOM_HI = 0x0021;  // [code] Eight-entry working table of the current level's high geometry nibbles (mirrored to colour RAM COLOR_RAM_8)
export const COLOR_CYCLE_0 = 0x0022;  // [code] First entry of a three-entry array mirrored into colour RAM COLOR_RAM_9..COLOR_RAM_B
export const COLOR_CYCLE_1 = 0x0023;  // [code] Second entry of the three-entry array mirrored into colour RAM COLOR_RAM_9..COLOR_RAM_B
export const COLOR_CYCLE_2 = 0x0024;  // [code] Third entry of the three-entry array mirrored into colour RAM COLOR_RAM_9..COLOR_RAM_B
export const loc_29 = 0x0029;
export const loc_2a = 0x002a;
export const loc_2b = 0x002b;
export const COORD_LIST_PTR_LO = 0x002c;  // [seen] Low byte of the current coordinate-list / working indirect pointer pair
export const COORD_LIST_PTR_HI = 0x002d;  // [seen] High byte of the current coordinate-list / working indirect pointer pair
export const loc_2e = 0x002e;
export const loc_2f = 0x002f;
export const loc_30 = 0x0030;
export const loc_31 = 0x0031;
export const loc_32 = 0x0032;
export const MATHBOX_SIGN_X = 0x0033;  // [code] Sign flag of the horizontal (X) delta fed to the math box, controlling the X offset fold
export const MATHBOX_SIGN_Y = 0x0034;  // [code] Sign flag of the vertical (Y) delta fed to the math box, controlling the Y offset fold
export const SAVED_INDEX = 0x0035;  // [seen] Scratch that preserves a caller loop/slot index (X or Y) across a subroutine call
export const SAVED_INDEX2 = 0x0036;  // [code] Second index-save scratch preserving a caller loop/slot index across a call
export const SLOT_LOOP_INDEX = 0x0037;  // [seen] Current slot/column loop index driving the per-slot draw and update walks
export const TABLE_CURSOR = 0x0038;  // [seen] Secondary table/packed-record cursor and working-slot index used by the draw and projection passes
export const loc_39 = 0x0039;
export const WELL_DEPTH_ROW = 0x003a;  // [code] Depth-row index into the well depth table SLOT_THRESHOLD_TABLE while drawing the playfield well rows
export const WORK_PTR_LO = 0x003b;  // [code] Low byte of a general working indirect pointer (source/glyph/shape-list/destination pointer)
export const WORK_PTR_HI = 0x003c;  // [code] High byte of the general working indirect pointer paired with WORK_PTR_LO
export const loc_3d = 0x003d;
export const ACTIVE_SLOT_COUNT = 0x003e;  // [code] Upper loop bound / active slot-or-channel count used by the per-slot scans
export const LEVEL_ID = 0x003f;  // [seen] Current/target level id compared against the last-seen level to trigger level setup
export const loc_40 = 0x0040;
export const loc_41 = 0x0041;
export const loc_42 = 0x0042;
export const loc_43 = 0x0043;
export const loc_44 = 0x0044;
export const loc_45 = 0x0045;
export const PLAYER_LEVEL_TBL = 0x0046;  // [seen] Per-slot table of level/progress values indexed by loc_3d; feeds the level cell loc_9f
export const loc_47 = 0x0047;
export const SLOT_COUNTDOWN = 0x0048;  // [seen] Per-slot countdown/counter table indexed by loc_3d, decremented by the pacing tick
export const SLOT_COUNTDOWN_HI = 0x0049;  // [code] High/paired partner of the SLOT_COUNTDOWN slot countdown, spent together with it
export const INPUT_DEBOUNCED = 0x004d;  // [code] Debounced held-input byte built from this and last frame's samples
export const INPUT_EDGE_FLAGS = 0x004e;  // [seen] Newly-pressed input edges plus control/gate bits consumed by the frame steppers
export const SPINNER_ACCUM = 0x0050;  // [seen] Accumulated spinner delta (rotary encoder) read as the manual rim-rotation input
export const RIM_ROT_OFFSET = 0x0051;  // [code] Stored fine rim-rotation offset/velocity folded into the coarse angle each update
export const SPINNER_POT_PREV = 0x0052;  // [code] Previous inverted spinner pot reading used to form the per-interrupt delta
export const IRQ_HEARTBEAT = 0x0053;  // [seen] Interrupt heartbeat counter; the main loop waits for it to reach nine as its frame boundary
export const DRAW_STYLE = 0x0055;  // [code] Style/colour selector byte staged for the object-record draw builder
export const PROJ_PT_Y = 0x0056;  // [code] Vertical (Y) coordinate operand fed to the math-box projection
export const OBJ_DEPTH = 0x0057;  // [code] Current object/segment depth (Z) value gated and projected by the draw pipeline
export const PROJ_PT_X = 0x0058;  // [code] Horizontal (X) coordinate operand fed to the math-box projection
export const CLAMP_TALLY = 0x0059;  // [code] Clamp/run tally counter for the rim-segment and lane-sweep builders
export const RUN_SIZE = 0x005a;  // [code] Run-size/count field for the rim-segment builder and the style pair
export const DEPTH_LO = 0x005b;  // [seen] Low byte of the 16-bit well-depth / countdown-clock value, also a draw guard flag (bit7)
export const DEPTH_ACCUM_LO = 0x005c;  // [code] Low byte of a secondary depth accumulator stepped alongside DEPTH_HI
export const DEPTH_TARGET = 0x005d;  // [code] Target depth reseeded into the position high byte when the depth window collapses
export const PROJ_Y_REF = 0x005e;  // [code] Vertical (Y) reference/base subtracted from the point Y in the projection
export const DEPTH_HI = 0x005f;  // [seen] High byte of the 16-bit well-depth / countdown-clock and the reference depth for object gating
export const PROJ_X_REF = 0x0060;  // [code] Horizontal (X) reference/base subtracted from the point X in the projection
export const PROJ_Y_LO = 0x0061;  // [code] Low byte of the projected vertical (Y) accumulator / working coordinate block
export const PROJ_Y_HI = 0x0062;  // [code] High byte of the projected vertical (Y) accumulator
export const PROJ_X_LO = 0x0063;  // [code] Low byte of the projected horizontal (X) accumulator / working coordinate block
export const PROJ_X_HI = 0x0064;  // [code] High byte of the projected horizontal (X) accumulator
export const PROJ_OFS_Y_LO = 0x0066;  // [code] Low byte of the vertical (Y) offset folded into the projected Y accumulator
export const PROJ_OFS_Y_HI = 0x0067;  // [code] High byte of the vertical (Y) projection offset paired with PROJ_OFS_Y_LO
export const PROJ_OFS_X_LO = 0x0068;  // [code] Low byte of the horizontal (X) offset folded into the projected X accumulator (also a 24-bit total low byte)
export const PROJ_OFS_X_HI = 0x0069;  // [code] High byte of the horizontal (X) projection offset paired with PROJ_OFS_X_LO
export const PREV_Y_LO = 0x006a;  // [code] Low byte of the cached previous-point Y, subtracted by stroke-delta drawing
export const PREV_Y_HI = 0x006b;  // [code] High byte of the cached previous-point Y
export const PREV_X_LO = 0x006c;  // [code] Low byte of the cached previous-point X, subtracted by stroke-delta drawing
export const PREV_X_HI = 0x006d;  // [code] High byte of the cached previous-point X
export const VEC_DELTA_Y_LO = 0x006e;  // [code] Low byte of the sign-extended vertical (Y) delta pair emitted as a vector stroke
export const DRAW_DELTA_A_HI = 0x006f;  // [code] high byte of the first 16-bit coordinate delta of a vector record
export const DRAW_DELTA_B_LO = 0x0070;  // [code] low byte of the second 16-bit coordinate delta of a vector record
export const DRAW_DELTA_B_HI = 0x0071;  // [code] high byte of the second 16-bit coordinate delta of a vector record
export const VG_LAST_STAT = 0x0072;  // [code] cached last-emitted vector-generator state word, used to skip redundant emits
export const VG_RECORD_HEADER = 0x0073;  // [code] current vector-record header/opcode nibble byte
export const DRAW_CURSOR_LO = 0x0074;  // [seen] low half of the vector display-list write pointer
export const DRAW_CURSOR_HI = 0x0075;  // [seen] high half of the vector display-list write pointer
export const DRAW_CURSOR_ALT_LO = 0x0076;  // [code] low half of the alternate vector write pointer swapped with the main cursor
export const DRAW_CURSOR_ALT_HI = 0x0077;  // [code] high half of the alternate vector write pointer
export const SEG_SPREAD_A_LO = 0x0078;  // [code] base of the 8-entry low-byte array of interpolated coordinate A along a segment
export const SEG_SPREAD_A_LO_1 = 0x0079;  // [code] interpolated coordinate-A low byte, index 1 (also holds the clamped signed delta-A seed)
export const SEG_SPREAD_A_LO_2 = 0x007a;  // [code] interpolated coordinate-A low byte, index 2
export const SEG_SPREAD_A_LO_3 = 0x007b;  // [code] interpolated coordinate-A low byte, index 3
export const SEG_SPREAD_A_LO_4 = 0x007c;  // [code] interpolated coordinate-A low byte, index 4
export const SEG_SPREAD_A_LO_5 = 0x007d;  // [code] interpolated coordinate-A low byte, index 5
export const SEG_SPREAD_A_LO_6 = 0x007e;  // [code] interpolated coordinate-A low byte, index 6
export const SEG_SPREAD_A_LO_7 = 0x007f;  // [code] interpolated coordinate-A low byte, index 7
export const SEG_SPREAD_A_HI = 0x0080;  // [code] base of the 8-entry high-byte array of interpolated coordinate A
export const SEG_SPREAD_A_HI_1 = 0x0081;  // [code] interpolated coordinate-A high byte, index 1
export const SEG_SPREAD_A_HI_2 = 0x0082;  // [code] interpolated coordinate-A high byte, index 2 (doubles as the running fraction accumulator)
export const SEG_SPREAD_A_HI_3 = 0x0083;  // [code] interpolated coordinate-A high byte, index 3
export const SEG_SPREAD_A_HI_4 = 0x0084;  // [code] interpolated coordinate-A high byte, index 4
export const SEG_SPREAD_A_HI_5 = 0x0085;  // [code] interpolated coordinate-A high byte, index 5
export const SEG_SPREAD_A_HI_6 = 0x0086;  // [code] interpolated coordinate-A high byte, index 6
export const SEG_SPREAD_A_HI_7 = 0x0087;  // [code] interpolated coordinate-A high byte, index 7
export const SEG_SPREAD_B_LO = 0x0088;  // [code] base of the 8-entry low-byte array of interpolated coordinate B along a segment
export const SEG_SPREAD_B_LO_1 = 0x0089;  // [code] interpolated coordinate-B low byte, index 1 (also holds the clamped signed delta-B seed)
export const SEG_SPREAD_B_LO_2 = 0x008a;  // [code] interpolated coordinate-B low byte, index 2
export const SEG_SPREAD_B_LO_3 = 0x008b;  // [code] interpolated coordinate-B low byte, index 3
export const SEG_SPREAD_B_LO_4 = 0x008c;  // [code] interpolated coordinate-B low byte, index 4
export const SEG_SPREAD_B_LO_5 = 0x008d;  // [code] interpolated coordinate-B low byte, index 5
export const SEG_SPREAD_B_LO_6 = 0x008e;  // [code] interpolated coordinate-B low byte, index 6
export const SEG_SPREAD_B_LO_7 = 0x008f;  // [code] interpolated coordinate-B low byte, index 7
export const SEG_SPREAD_B_HI = 0x0090;  // [code] base of the 8-entry high-byte array of interpolated coordinate B
export const SEG_SPREAD_B_HI_1 = 0x0091;  // [code] interpolated coordinate-B high byte, index 1
export const SEG_SPREAD_B_HI_2 = 0x0092;  // [code] interpolated coordinate-B high byte, index 2 (doubles as the running fraction accumulator)
export const SEG_SPREAD_B_HI_3 = 0x0093;  // [code] interpolated coordinate-B high byte, index 3
export const SEG_SPREAD_B_HI_4 = 0x0094;  // [code] interpolated coordinate-B high byte, index 4
export const SEG_SPREAD_B_HI_5 = 0x0095;  // [code] interpolated coordinate-B high byte, index 5
export const SEG_SPREAD_B_HI_6 = 0x0096;  // [code] interpolated coordinate-B high byte, index 6
export const SEG_SPREAD_B_HI_7 = 0x0097;  // [code] interpolated coordinate-B high byte, index 7
export const DRAW_RECORD_COUNT = 0x0099;  // [code] countdown of four-byte vector records still to emit in a run
export const SEG_DELTA_A_SIGN = 0x009b;  // [code] high/sign byte of the first signed segment delta
export const SEG_DELTA_B_SIGN = 0x009d;  // [code] high/sign byte of the second signed segment delta
export const loc_9e = 0x009e;
export const loc_9f = 0x009f;
export const loc_a0 = 0x00a0;
export const VG_MODE_FLAG = 0x00a1;  // [code] vector draw mode flag carrying bit 2 of the selected scale value
export const loc_a2 = 0x00a2;
export const ACTIVE_ENEMY_COUNT = 0x00a6;  // [code] count of live climbing enemies, also indexes the per-wave difficulty table
export const DRAW_CURSOR_OFFSET = 0x00a9;  // [code] byte offset added to the draw cursor for the current record run
export const DRAW_SRC_PTR_LO = 0x00aa;  // [code] low half of an indirect source pointer read during draw-record building
export const DRAW_SRC_PTR_HI = 0x00ab;  // [code] high half of the indirect draw source pointer
export const loc_ac = 0x00ac;
export const loc_ad = 0x00ad;
export const NIBBLE_EMIT_COUNT = 0x00ae;  // [code] remaining byte count while emitting a run of zero-page bytes as nibbles
export const NIBBLE_EMIT_INDEX = 0x00af;  // [code] current zero-page source index for the nibble-run emitter
export const DRAW_PATCH_PTR_LO = 0x00b0;  // [code] low half of a saved record pointer used for a colour-patch second pass
export const DRAW_PATCH_PTR_HI = 0x00b1;  // [code] high half of the saved colour-patch record pointer
export const VG_SCALE = 0x00b4;  // [code] selected vector-generator scale byte
export const CHECKSUM_ACC = 0x00b5;  // [code] rolling checksum accumulator over a fixed ROM table
export const DRAW_RECORD_PTR_LO = 0x00b6;  // [code] low half of the pointer remembering where a display-list record began
export const DRAW_RECORD_PTR_HI = 0x00b7;  // [code] high half of the display-list record-start pointer
export const NVRAM_SCAN_PTR_LO = 0x00bd;  // [code] low half of the pointer walking a region's RAM copy for the EAROM store/verify
export const NVRAM_SCAN_PTR_HI = 0x00be;  // [code] high half of the EAROM region-copy walk pointer
export const SOUND_SLOT_SENTINEL = 0x00bf;  // [code] index of the voice slot currently being claimed, holding the 0xff sentinel otherwise
export const SOUND_VOICE_VALUE = 0x00c0;  // [seen] base of the 16-entry per-voice value/pitch table for the sound engine
export const SOUND_VOICE_LEVEL = 0x00d0;  // [seen] base of the 16-entry per-voice level/output table published to POKEY
export const SOUND_FAST_TIMER = 0x00e0;  // [code] base of the 16-entry per-voice fast (frame-step) timer array
export const SOUND_SLOW_TIMER = 0x00f0;  // [code] base of the 16-entry per-voice slow (envelope) timer array
export const loc_100 = 0x0100;
export const loc_102 = 0x0102;
export const SPIKE_STEP_LO = 0x0104;  // [code] low byte of the moving spike's 16-bit per-frame height increment
export const SPIKE_STEP_HI = 0x0105;  // [code] high byte of the moving spike's 16-bit per-frame height increment
export const SPIKE_ACTIVE_FLAG = 0x0106;  // [code] moving-spike active/arm flag, active while bit7 set
export const SPIKE_HEIGHT_LO = 0x0107;  // [code] low byte of the moving spike's 16-bit height (high byte in PLAYER_SHOT_DEPTH)
export const ENEMY_TOTAL_COUNT = 0x0108;  // [code] total live-enemy count decremented when no per-type count applies
export const ENEMY_TYPE_COUNT = 0x0109;  // [code] per-type live-enemy count
export const SCRIPT_WALK_CONTINUE = 0x010a;  // [seen] walk-continuation flag that keeps an object's driving script walk alive
export const SCRIPT_CURSOR = 0x010b;  // [seen] rolling cursor naming the current position within the object script table
export const SCRIPT_BRANCH_FLAG = 0x010c;  // [code] flag recording the outcome of the most recent script test
export const SPAWN_FOUND_FLAG = 0x010d;  // [code] flag set when the spawn walk found a live or newly-spawned object
export const SPAWN_BUDGET_TIMER = 0x010e;  // [code] per-frame spawn budget countdown
export const loc_10f = 0x010f;
export const loc_110 = 0x0110;
export const TUBE_GEOM_FLAG = 0x0111;  // [code] per-level tube-geometry flag; bit7 governs lane-index wrap and nonzero marks a live board
export const TUBE_SHAPE_INDEX = 0x0112;  // [code] current tube shape/level index used to index the level geometry tables
export const loc_113 = 0x0113;
export const REDRAW_COUNTER = 0x0114;  // [code] display-change counter bumped when watched state changes; also used as a 0xff dirty flag
export const SPIKE_TABLE_GUARD = 0x0115;  // [seen] Arm/guard flag for the descending spike object; its sign also chooses which rail the spike table snaps to
export const TIMED_OBJECT_COUNT = 0x0116;  // [seen] Live-count / pending flag for the eight-slot timed-object table
export const loc_117 = 0x0117;
export const OBJECT_VELOCITY_HI = 0x0118;  // [code] High byte of the 16-bit per-frame velocity added to a far-slot object's position
export const SPAWN_TIMER_RELOAD = 0x0119;  // [code] Reload period written into a source slot's spawn timer after it fires
export const FLYER_SLOT_TOP = 0x011a;  // [code] Top index for the free-flight destination-slot scan, clamped 0..3 by difficulty
export const PLAYER_SHAPE_SUM = 0x011b;  // [code] Running checksum of the 40-byte player-Blaster shape block, used as a draw/age gate
export const ENEMY_SLOT_TOP = 0x011c;  // [code] Top index / count of the parallel per-slot enemy (climber) arrays
export const loc_11f = 0x011f;
export const OBJECT_VELOCITY_LO = 0x0120;  // [code] Low byte of the 16-bit per-frame velocity added to a far-slot object's position
export const LEVEL_GEOM_SCALE = 0x0121;  // [code] Per-level tube geometry scale, the signed delta driving the warp/zoom accumulator
export const ZOOM_ACCUM_HI = 0x0122;  // [code] High byte of the 24-bit warp/zoom position accumulator ZOOM_ACCUM_HI:PROJ_OFS_X_LO:PROJ_OFS_X_HI
export const SPIKED_SEGMENT_COUNT = 0x0123;  // [code] Tally of occupied/spiked segments around the tube, also carrying a per-frame bit7 flag
export const RIM_COLOR_ANIM = 0x0124;  // [code] Rim-lane colour-cycle animation counter, seeded on score award and decremented while drawing
export const WAVE_PHASE_LATCH = 0x0125;  // [seen] Wave/level-intro phase latch: set 0xff when the wave block is ready, gates staged sweeps
export const WAVE_PEAK_SEED = 0x0126;  // [code] Peak-slot seed used to pick the wave start slot
export const DEPTH_CEILING = 0x0127;  // [code] Ceiling for the player depth window / wave start-depth index
export const LEVEL_LAYOUT_TRIGGER = 0x0133;  // [code] One-shot level-layout flag gating the initial colour-RAM clear
export const ACTIVE_OBJECT_COUNT = 0x0135;  // [code] Live count for the near-rim / projectile object bank (SLOT_STATE / loc_2db slots)
export const VECRAM_TAIL_CURSOR_LO = 0x0139;  // [code] Low byte of the 16-bit vector-RAM tail write cursor
export const VECRAM_TAIL_CURSOR_HI = 0x013a;  // [code] High byte of the 16-bit vector-RAM tail write cursor
export const OBJECT_ANIM_PHASE = 0x013b;  // [code] Animation phase index / priority head flag for the animated top-object
export const OBJECT_ANIM_TIMER = 0x013c;  // [code] Sub-timer / ready flag paired with the object animation phase
export const SPAWN_DEFICIT_C3 = 0x0140;  // [code] Column-3 entry of the five-column spawn-deficit table
export const LANE_ENEMY_COUNT_0 = 0x0142;  // [code] Column-0 entry of the per-column active-enemy counter table (0x142..0x146)
export const LANE_ENEMY_COUNT_1 = 0x0143;  // [code] Column-1 entry of the per-column active-enemy counter table
export const LANE_ENEMY_COUNT_2 = 0x0144;  // [code] Column-2 entry of the per-column active-enemy counter table
export const LANE_ENEMY_COUNT_3 = 0x0145;  // [code] Column-3 entry of the per-column active-enemy counter table
export const LANE_ENEMY_COUNT_4 = 0x0146;  // [code] Column-4 entry of the per-column active-enemy counter table
export const ENEMY_ANIM_DELTA = 0x0147;  // [code] Signed per-frame step folded into the enemy animation/oscillator accumulator
export const ENEMY_ANIM_ACCUM = 0x0148;  // [code] Signed enemy animation/oscillator accumulator driving flip and draw style
export const CANDIDATE_LANE_0 = 0x0149;  // [code] First entry of the four-entry candidate-lane table used to pick a climber's lane
export const loc_14d = 0x014d;
export const loc_14e = 0x014e;
export const BONUS_LIFE_INTERVAL = 0x0156;  // [seen] DIP-selected bonus-life score interval used as the award threshold
export const NEAR_DEPTH_THRESHOLD = 0x0157;  // [code] Depth threshold below which an enemy counts as near the rim / reverses direction
export const DSW_BONUS_CONFIG = 0x0158;  // [seen] DIP-decoded bonus/award configuration byte seeding the per-slot award counter
export const ENEMY_FIRE_SELECT = 0x0159;  // [code] Per-enemy fire/aim selector flag (bit6 chooses the segment-step direction)
export const LANE_FILL_INIT = 0x015a;  // [code] Initial per-lane fill value written across the sixteen-entry lane table at wave setup
export const INITIAL_ACTIVE_COUNT = 0x015b;  // [code] Initial active-object/slot count for the wave, copied into FIRE_GATE
export const LIST_PTR_HI = 0x015d;  // [code] Held high-byte source for the list-setup pointer
export const ENEMY_FIRE_THRESHOLD = 0x015f;  // [code] POKEY-random threshold that gates whether an enemy fires this frame
export const ENEMY_CLIMB_DELTA_LO_0 = 0x0160;  // [code] Segment-0 low byte of the per-segment enemy climb-speed delta table (0x160..0x164)
export const ENEMY_CLIMB_DELTA_LO_4 = 0x0164;  // [code] Segment-4 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_0 = 0x0165;  // [code] Segment-0 high byte of the per-segment enemy climb-speed delta table (0x165..0x169)
export const ENEMY_CLIMB_DELTA_HI_4 = 0x0169;  // [code] Segment-4 high byte of the per-segment enemy climb-speed delta table
export const DSW_DIFFICULTY = 0x016a;  // [seen] DIP-decoded difficulty/config byte; its low bits drive the enemy-speed rescale
export const MODE_DELAY_GUARD = 0x016b;  // [code] Guard/flag holding a pending mode transition through a delay
export const DECIMAL_MODE_FLAG = 0x016c;  // [code] Flag gating decimal (BCD) score arithmetic and a self-check byte
export const LIST_SELECT_FLAGS = 0x016d;  // [code] Flags byte OR-folded into a list-setup pointer low byte
export const SCORE_DISPLAY_TIMER = 0x016e;  // [code] Countdown timer ticked while drawing the score / high-score display
export const EAROM_BLANK_FLAG = 0x01c6;  // [seen] High-score EAROM blank flag: when nonzero the write path zeros each source cell (erase a region)
export const EAROM_REGION_PENDING = 0x01c7;  // [seen] High-score EAROM region-pending bits (one per low bit) awaiting service
export const EAROM_REGION_DIR = 0x01c8;  // [seen] High-score EAROM per-region direction bits: set = write out, clear = read back in
export const PENDING_WORK_FLAGS = 0x01c9;  // [code] Working flags byte: EAROM per-region checksum-fail result bits and geometry-rebuild request bits
export const EAROM_MODE = 0x01ca;  // [seen] High-score EAROM step-machine mode/busy byte (0x80 write, 0x20 read, 0 idle)
export const EAROM_PASS_COUNTER = 0x01cb;  // [seen] High-score EAROM per-region pass counter
export const EAROM_CURSOR = 0x01cc;  // [seen] High-score EAROM RAM cursor stepping through a region's bytes
export const EAROM_LIMIT = 0x01cd;  // [seen] High-score EAROM region end/limit cursor (checksum position)
export const EAROM_REGION_MASK = 0x01ce;  // [seen] Single-region mask isolated from the pending bits for the current EAROM pass
export const EAROM_CHECKSUM_ACC = 0x01cf;  // [seen] Running checksum accumulator for the EAROM region read/write
export const HIGH_LEVEL_MARKER = 0x01ff;  // [code] Latched high-level marker copied from the level index when the level is deep enough
export const PLAYER_SEGMENT = 0x0200;  // [seen] Player Blaster rim segment (coarse rotation position / current lane)
export const PLAYER_FINE_ANGLE = 0x0201;  // [seen] Player fine rotation offset with bit7 as the rotation/object-pending flag
export const PLAYER_SHOT_DEPTH = 0x0202;  // [seen] Shared depth position of the player shot down the tube (0x10 rim .. 0xf0 far), a collision reference
export const OBJECT_INDEX_TABLE = 0x0203;  // [code] Per-entry object index / segment nibble in the 64-entry object-record bank (0x203..0x242)
export const OBJECT_AXIS0_FRAC = 0x0223;  // [guess] Axis-0 position-fraction low byte in the free-flight three-axis object integrator
export const OBJECT_RECORD_TABLE = 0x0243;  // [code] 64-entry object-record table: per-slot growth/spawn timer, also its kind byte and random tag
export const OBJECT_AXIS1_POS = 0x0263;  // [guess] Axis-1 whole-coordinate byte in the free-flight three-axis object integrator
export const ENEMY_SLOT_FLAGS = 0x0283;  // [seen] Per-enemy-slot state byte: nonzero while alive, low 3 bits = lane/segment kind, bit6 = side, bit7 = live
export const ENEMY_SLOT_DIR = 0x028a;  // [seen] Per-enemy-slot direction/state byte: bit7 = climb direction, bit6 = armed, low bits = kind
export const ENEMY_SCRIPT_CURSOR = 0x0291;  // [seen] per-slot saved motion-script cursor for the climbing-enemy slot
export const loc_298 = 0x0298;
export const ENEMY_DEPTH_LO = 0x029f;  // [code] low byte of a climbing enemy's 16-bit tube-depth coordinate
export const ENEMY_POS2 = 0x02a3;  // [code] axis-2 integer coordinate of the free-flight spawn integrator
export const ENEMY_TIMER = 0x02a6;  // [code] per-slot countdown timer for a climbing enemy
export const TARGET_SEG = 0x02ad;  // [seen] per-slot target segment for the lane-spawn object bank
export const loc_2b5 = 0x02b5;
export const ENEMY_SEGMENT = 0x02b9;  // [code] target segment/lane number of a climbing enemy
export const ENEMY_VEL1_LO = 0x02c3;  // [code] axis-1 velocity low byte of the free-flight spawn integrator
export const loc_2c8 = 0x02c8;
export const ENEMY_PHASE = 0x02cc;  // [code] per-slot phase counter / successor-segment heading
export const SLOT_STATE = 0x02d3;  // [seen] per-slot counter/occupied cell for the lane-spawn bank (0 = free)
export const loc_2db = 0x02db;
export const ENEMY_DEPTH = 0x02df;  // [code] high byte of an enemy's tube depth; nonzero marks the slot live
export const ENEMY_VEL0_LO = 0x02e3;  // [code] axis-0 velocity low byte of the free-flight spawn integrator
export const loc_2e6 = 0x02e6;
export const HIT_TALLY = 0x02f2;  // [seen] per-slot active flag (0xff) and hit tally for the lane-spawn bank
export const SHAPE_COORD = 0x02fa;  // [code] per-slot coordinate for the eight-slot shape draw bank
export const SHAPE_ID = 0x0302;  // [code] per-slot shape id for the eight-slot shape draw bank
export const ENEMY_VEL2_LO = 0x0303;  // [code] axis-2 velocity low byte of the free-flight spawn integrator
export const SHAPE_ACTIVE = 0x030a;  // [code] per-slot active flag for the eight-slot shape draw bank (nonzero = drawn)
export const SHAPE_ANIM = 0x0312;  // [code] per-slot animation/age byte for the shape draw bank
export const COL_VAL_A = 0x031a;  // [code] per-column geometry value (plane A) built at level setup
export const ENEMY_VEL1_HI = 0x0323;  // [code] axis-1 velocity high byte of the free-flight spawn integrator
export const COL_SUB_A = 0x032a;  // [code] per-column geometry sub/second byte paired with COL_VAL_A
export const COL_VAL_B = 0x033a;  // [code] per-column geometry value (plane B) built at level setup
export const ENEMY_VEL0_HI = 0x0343;  // [code] axis-0 velocity high byte of the free-flight spawn integrator
export const COL_SUB_B = 0x034a;  // [code] per-column geometry sub/second byte paired with COL_VAL_B
export const OBJ_DY_HI = 0x035a;  // [code] per-object Y-delta high byte
export const ENEMY_VEL2_HI = 0x0363;  // [code] axis-2 velocity high byte of the free-flight spawn integrator
export const OBJ_DY_LO = 0x036a;  // [code] per-object Y-delta low byte
export const OBJ_DX_HI = 0x037a;  // [code] per-object X-delta high byte
export const OBJ_DX_LO = 0x038a;  // [code] per-object X-delta low byte
export const LANE_TARGET_FLAG = 0x039a;  // [code] per-lane target flag (0xc0/0x80 marks a flagged lane)
export const SWEEP_STAGE = 0x03aa;  // [code] stage/phase index for the sweep handler
export const FIRE_GATE = 0x03ab;  // [code] global gate that enables enemy fire
export const LANE_LIMIT = 0x03ac;  // [code] per-lane limit/threshold used by the hit/award scan
export const loc_3bc = 0x03bc;
export const SEG_BASE_X = 0x03ce;  // [code] per-segment base X coordinate of the tube geometry
export const SEG_BASE_Y = 0x03de;  // [code] per-segment base Y coordinate of the tube geometry
export const SEG_DIRECTION = 0x03ee;  // [code] per-segment ring-direction table
export const loc_3fe = 0x03fe;
export const loc_405 = 0x0405;
export const TIMER2_LO = 0x0409;  // [code] low byte of a second software timer cascade
export const TIMER2_MID = 0x040a;  // [code] middle byte of the second software timer cascade
export const TIMER2_HI = 0x040b;  // [code] high byte of the second software timer cascade
export const COORD_ACC_LO = 0x040c;  // [code] low byte of a 16-bit coordinate accumulator
export const COORD_ACC_HI = 0x040d;  // [code] high byte of the 16-bit coordinate accumulator
export const DIGIT_IN_LO = 0x040f;  // [code] low byte of the digit builder's first input pair
export const DIGIT_IN_HI = 0x0410;  // [code] high byte of the digit builder's first input pair
export const DIV_QUOTIENT = 0x0412;  // [code] quotient cell seeded by the digit builder's divide
export const DIV_REMAINDER = 0x0413;  // [code] remainder cell seeded by the digit builder's divide
export const loc_414 = 0x0414;
export const POINTER_PARITY = 0x0415;  // [code] per-slot parity flag toggled to double-buffer pointer records
export const LANE_FLAGS = 0x0425;  // [code] sixteen-entry rim-lane flag/color block
export const SEG_MID_X = 0x0435;  // [code] per-segment midpoint X (average of adjacent segment bases)
export const SEG_MID_Y = 0x0445;  // [code] per-segment midpoint Y (average of adjacent segment bases)
export const loc_455 = 0x0455;
export const SORT_PAYLOAD_LO = 0x051e;  // [code] low byte of a per-row payload reordered by the loc_ac3f bubble sort
export const SORT_PAYLOAD_MID = 0x051f;  // [code] middle byte of the per-row payload reordered by the sort
export const SORT_PAYLOAD_HI = 0x0520;  // [code] high byte of the per-row payload reordered by the sort
export const SLOT_METRIC = 0x0600;  // [code] per-channel/slot count array
export const loc_601 = 0x0601;
export const ACTIVE_SLOT = 0x0602;  // [code] current active-slot cursor for the arming driver
export const REQUEST_BITS = 0x0603;  // [code] packed request word, two bits per slot, drained by the arming driver
export const REARM_COUNTER = 0x0604;  // [code] step counter that re-arms the driver when it underflows
export const PASS_COUNTER = 0x0605;  // [code] sort-pass counter / arming countdown
export const SLOT_VALUE = 0x0606;  // [code] per-slot value block clamped to the 0x1a rail
export const loc_61b = 0x061b;
export const SORT_KEY_LO = 0x061e;  // [code] low byte of the per-row sort key
export const SORT_KEY_MID = 0x061f;  // [code] middle byte of the per-row sort key
export const SORT_KEY_HI = 0x0620;  // [code] high byte of the per-row sort key
export const GLYPH_PARAM_X = 0x0706;  // [code] per-slot glyph draw parameter (plane X)
export const GLYPH_PARAM_Y = 0x0707;  // [code] per-slot glyph draw parameter (plane Y)
export const GLYPH_PARAM_Z = 0x0708;  // [code] per-slot glyph draw parameter (plane Z)
export const loc_71b = 0x071b;
export const loc_71c = 0x071c;
export const loc_71d = 0x071d;
export const INPUT_SNAPSHOT_HI = 0x071e;  // [code] change-detection latch of (DSW2_SNAPSHOT & 0xf8)
export const INPUT_SNAPSHOT_LO = 0x071f;  // [code] change-detection latch of (DSW_DIFFICULTY & 0x03)
export const loc_720 = 0x0720;
export const COLOR_RAM = 0x0800;  // [seen] base of the 16-entry color RAM (0x0800-0x080F, write-only)
export const COLOR_RAM_8 = 0x0808;  // [seen] color RAM entry 0x08, latched from a level-dependent palette byte
export const COLOR_RAM_9 = 0x0809;  // [seen] color RAM entry 0x09
export const COLOR_RAM_A = 0x080a;  // [seen] color RAM entry 0x0A
export const COLOR_RAM_B = 0x080b;  // [seen] color RAM entry 0x0B
export const IN0_PORT = 0x0c00;  // [seen] IN0 hardware input port (coin/tilt/self-test/diag/AVG-done/3kHz)
export const DSW1_COINAGE = 0x0d00;  // [code] coinage DIP-switch input port
export const DSW2_OPTIONS = 0x0e00;  // [code] lives/bonus/language DIP-switch input port
export const VEC_LIST_HEADER_LO = 0x2000;  // [seen] low byte of the AVG display-list header word at vector-RAM start
export const VEC_LIST_HEADER_HI = 0x2001;  // [seen] high byte of the AVG display-list header word
export const VEC_GLYPH_BUFFER = 0x2f60;  // [seen] vector-RAM buffer where per-frame glyph/stroke words are assembled
export const VEC_SNAPSHOT_MIRROR_A = 0x2fa6;  // [code] vector-RAM cell mirroring the snapshot byte
export const VEC_SNAPSHOT_MIRROR_B = 0x2fa8;  // [code] second vector-RAM cell mirroring the snapshot byte
export const VEC_LIST_JMP_LO = 0x2ffc;  // [code] low byte of the display-list tail jump vector
export const VEC_LIST_JMP_HI = 0x2ffd;  // [code] high byte of the display-list tail jump (|0x70 AVG JMPL opcode)
export const VEC_LIST_HALT = 0x2fff;  // [code] display-list terminator byte (0xc0 AVG halt)
export const NIBBLE_GLYPH_TABLE = 0x31e4;  // [seen] vector-ROM stroke-word table indexed by nibble (digit/hex glyphs)
export const NIBBLE_GLYPH_TABLE_HI = 0x31e5;  // [code] high-byte companion of the nibble glyph-word table
export const CHAR_GLYPH_TABLE = 0x31fa;  // [seen] vector-ROM glyph-word table indexed by character code
export const BAR_GLYPH_LOW = 0x3284;  // [code] vector-ROM glyph byte used when row <= threshold
export const BAR_GLYPH_HIGH = 0x3286;  // [code] vector-ROM glyph byte used when row > threshold
export const BLANK_SLOT_VEC_LO = 0x3db2;  // [seen] low byte of the blank vector word for an inactive enemy slot
export const BLANK_SLOT_VEC_HI = 0x3db3;  // [seen] high byte of the blank vector word for an inactive enemy slot
export const COIN_FLIP_LATCH = 0x4000;  // [code] coin-counter + AVG flip_x/flip_y control output latch
export const AVG_RESET_STROBE = 0x5800;  // [seen] AVG reset strobe
export const EAROM_DATA = 0x6000;  // [code] EAROM data window (cursor-indexed) for NVRAM settings/high-scores
export const MATHBOX_STATUS = 0x6040;  // [seen] math-box busy status read (bit7=busy) / EAROM control on write
export const EAROM_READ = 0x6050;  // [code] EAROM read-back port
export const MATHBOX_RESULT_LO = 0x6060;  // [seen] math-box 16-bit result low byte
export const MATHBOX_RESULT_HI = 0x6070;  // [seen] math-box 16-bit result high byte
export const MATHBOX_LD_R0_LO = 0x6080;  // [code] math-box port: load R0 low byte (go_w opcode 0x00)
export const MATHBOX_LD_R0_HI = 0x6081;  // [code] math-box port: load R0 high byte (opcode 0x01)
export const MATHBOX_LD_R1_HI = 0x6083;  // [code] math-box port: load R1 high byte (opcode 0x03)
export const MATHBOX_LD_R2_LO = 0x6084;  // [code] math-box port: load R2 low byte (opcode 0x04)
export const MATHBOX_LD_R2_HI = 0x6085;  // [code] math-box port: load R2 high byte (opcode 0x05)
export const MATHBOX_LD_R3_LO = 0x6086;  // [code] math-box port: load R3 low byte (opcode 0x06)
export const MATHBOX_LD_R3_HI = 0x6087;  // [code] math-box port: load R3 high byte (opcode 0x07)
export const MATHBOX_LD_R4_HI = 0x6089;  // [code] math-box port: load R4 high byte (opcode 0x09)
export const MATHBOX_LD_R6_COUNT = 0x608c;  // [seen] math-box port: load R6 whole (divide/loop step count, opcode 0x0c)
export const MATHBOX_LD_RA_LO = 0x608d;  // [code] math-box port: load Ra low byte (opcode 0x0d)
export const MATHBOX_LD_RA_HI = 0x608e;  // [seen] math-box port: load Ra high byte / operand (opcode 0x0e)
export const MATHBOX_LD_RB_LO = 0x608f;  // [code] math-box port: load Rb low byte / operand (opcode 0x0f)
export const MATHBOX_LD_RB_HI = 0x6090;  // [code] math-box port: load Rb high byte (opcode 0x10)
export const MATHBOX_DIVIDE = 0x6094;  // [seen] math-box compute trigger: divide {Rb:Ra}/R7 (opcode 0x14)
export const MATHBOX_LD_R7_LO = 0x6095;  // [code] math-box port: load R7 low byte (divisor / delta low, opcode 0x15)
export const MATHBOX_LD_R7_HI = 0x6096;  // [code] math-box port: load R7 high byte (divisor / delta high, opcode 0x16)
export const POKEY1_AUDF1 = 0x60c0;  // [seen] POKEY1 audio-frequency register voice 1 (write) / pot0 (read)
export const POKEY1_AUDC1 = 0x60c1;  // [code] POKEY1 audio-control register voice 1
export const POKEY1_AUDF2 = 0x60c2;  // [code] POKEY1 audio-frequency register voice 2
export const POKEY1_AUDC2 = 0x60c3;  // [code] POKEY1 audio-control register voice 2
export const POKEY1_AUDCTL = 0x60c8;  // [seen] POKEY1 control register (write) / ALLPOT option switches (read)
export const POKEY1_RANDOM = 0x60ca;  // [seen] POKEY1 random-number register (primary RNG source)
export const POKEY1_POTGO = 0x60cb;  // [code] POKEY1 pot-scan-start register (offset 0x0b)
export const POKEY1_SKCTL = 0x60cf;  // [seen] POKEY1 serial/control (SKCTL) register
export const POKEY2_AUDF1 = 0x60d0;  // [seen] POKEY2 audio-frequency register voice 1 base (write) / pot0 (read)
export const POKEY2_AUDC1 = 0x60d1;  // [code] POKEY2 audio-control register voice 1
export const POKEY2_AUDCTL = 0x60d8;  // [seen] POKEY2 control register (write) / ALLPOT (read)
export const POKEY2_RANDOM = 0x60da;  // [seen] POKEY2 random-number register (secondary RNG source)
export const POKEY2_POTGO = 0x60db;  // [code] POKEY2 pot-scan pulse register (offset 0x0b, discarded by the board)
export const POKEY2_SKCTL = 0x60df;  // [seen] POKEY2 serial/control (SKCTL) register
export const LED_FLIP_LATCH = 0x60e0;  // [code] player-LED + screen-flip output latch
export const POINTER_TABLE_LO = 0x91c6;  // [code] low-byte half of an in-page pointer lookup table
export const POINTER_TABLE_HI = 0x91c7;  // [code] high-byte half of an in-page pointer lookup table
export const SLOT_THRESHOLD_TABLE = 0x91fe;  // [code] ROM threshold table scanned downward to pick a start slot
export const LIST_PTR_TABLE_HI = 0x9afd;  // [seen] high-byte table of ROM list pointers
export const LIST_PTR_TABLE_LO = 0x9b02;  // [seen] low-byte table of ROM list pointers
export const LIST_PTR_TABLE_LO1 = 0x9b03;  // [seen] entry 1 of the list-pointer low-byte table
export const MOTION_SCRIPT_TABLE = 0xa0f7;  // [seen] object motion-script byte table
export const MOTION_SCRIPT_GOTO = 0xa0f8;  // [seen] motion-script table read at cursor+1 for the goto/state-step target
export const SPAWN_RATE_TABLE = 0xa304;  // [seen] per-source spawn-probability threshold compared against a POKEY random draw
export const TIMED_OBJ_LIMIT_TABLE = 0xa448;  // [code] per-type counter limit for timed-object slots
export const TIMED_OBJ_STEP_TABLE = 0xa44e;  // [code] per-type counter increment step for timed-object slots
export const VELOCITY_DECAY_STEP = 0xa788;  // [code] fixed increment applied per velocity-decay step
export const DRAW_SLOT_TABLE = 0xa8b0;  // [code] 4-entry ROM table of object-slot ids selected by DSW1_SNAPSHOT & 0x03
export const GLYPH_PTR_TABLE = 0xa97d;  // [code] ROM table seeding the glyph pointer, indexed by y
export const SELFCHECK_XOR_BYTES = 0xaace;  // [code] 11 ROM bytes XOR-folded into the self-check byte
export const OVERLAY_VEC_WORD_B = 0xaaf3;  // [code] byte of the base-overlay final coordinate word
export const OVERLAY_VEC_WORD_A = 0xaaf4;  // [code] byte of the base-overlay final coordinate word
export const TEXT_BUFFER_TEMPLATE = 0xac08;  // [code] ROM template block copied into the text buffer SLOT_VALUE
export const COUNT_GLYPH_COORD_TABLE = 0xaf6f;  // [seen] ROM table of coordinate bytes for the counter digit draw
export const WELL_SEGMENT_COORD_TABLE = 0xb096;  // [seen] ROM table of rim-segment coordinate bytes for the well draw
export const RIM_SEGMENT_ARG_TABLE = 0xb09b;  // [seen] ROM table of per-rim-segment draw args (8 segments)
export const WELL_VERTEX_TABLE = 0xb0a3;  // [seen] ROM table of well-draw vertex bytes read in i / i+1 pairs
export const RIM_LANE_SLOT_TABLE_A = 0xb476;  // [seen] ROM lane-slot id table for the rim-lane paint
export const RIM_LANE_SLOT_TABLE_B = 0xb487;  // [seen] second ROM lane-slot id table for the rim-lane paint
export const SEG_SHAPE_BY_STYLE = 0xb60b;  // [code] Per-style segment-shape selector byte read into the tube-rim segment builder
export const JUMP_MODE_SHAPE = 0xb61e;  // [code] Shape byte chosen by a slot's two-bit jump/mode field for the enemy emitter
export const VERTEX_Y_OFS_BY_PHASE = 0xb687;  // [code] Per-phase signed Y offset added to a slot's base vertex Y when building its screen point
export const VERTEX_X_OFS_BY_PHASE = 0xb68b;  // [code] Per-phase signed X offset added to a slot's base vertex X when building its screen point
export const SEG_STYLE_TABLE = 0xb755;  // [code] Segment-style byte selected by a windowed ENEMY_ANIM_ACCUM value for the rim-segment builder
export const ENEMY_SHAPE_BASE = 0xb7e5;  // [code] Per-shape base offset added to a computed table index when drawing an enemy shape record
export const ANIM_PHASE_DURATION = 0xb82a;  // [code] Per-phase frame-count reload for the animated shape sub-timer
export const ANIM_PHASE_CODE = 0xb83d;  // [code] Per-phase code byte gating the animated-shape phase handler
export const LANE_VERTEX_X = 0xb97c;  // [code] ROM per-lane tube vertex X-coordinate table copied into the working lane table SEG_BASE_X
export const LANE_VERTEX_Y = 0xba7c;  // [code] ROM per-lane tube vertex Y-coordinate table copied into the working lane table SEG_BASE_Y
export const LANE_RING_DIR = 0xbb7c;  // [code] ROM per-lane ring/heading seed table copied into the working table SEG_DIRECTION
export const SHAPE_INDEX_TABLE = 0xbc7c;  // [code] ROM table mapping a byte's low-nibble remainder to the level shape/geometry index
export const LEVEL_TUBE_DEPTH = 0xbc8c;  // [code] Per-shape ROM level parameter seeding the tube depth/span cells
export const LEVEL_PARAM_LOC60 = 0xbc9c;  // [code] Per-shape ROM level parameter loaded into geometry cell PROJ_X_REF
export const LEVEL_OFFSET_LO = 0xbcac;  // [code] Per-shape ROM level offset-pair low byte (into PROJ_OFS_X_LO)
export const LEVEL_OFFSET_HI = 0xbcbc;  // [code] Per-shape ROM level offset-pair high byte (into PROJ_OFS_X_HI)
export const LEVEL_GATE_FLAG = 0xbccc;  // [code] Per-shape ROM level flag seeding the level gate cell TUBE_GEOM_FLAG
export const STYLE_TABLE_59 = 0xbcdc;  // [code] Per-shape style byte loaded into the draw style cell CLAMP_TALLY
export const STYLE_TABLE_5A = 0xbcec;  // [code] Per-shape style byte loaded into the draw style cell RUN_SIZE
export const SEG_RECORD_COUNT = 0xbfb6;  // [code] Per-corner count of four-byte vector records emitted for a rim segment
export const SEG_PACK_CURSOR = 0xbfc4;  // [code] Per-corner starting cursor into the packed segment tables
export const SEG_PACKED_BYTE = 0xbfd2;  // [code] Packed corner byte (encoding yLo/xHi offsets) for each rim-segment record
export const SEG_HEADER_BYTE = 0xbfd3;  // [code] Header byte for each emitted rim-segment vector record (1 remapped to 0xc0)
export const LEVEL_LAYOUT_PACKED = 0xc1fd;  // [code] Packed ROM level-layout table unpacked into the working nibble tables and their display mirrors
export const OUTLINE_HEADER = 0xc22d;  // [code] ROM header word emitted at the start of a level outline draw
export const ENEMY_LIST_HEADER = 0xc669;  // [code] Fixed four-byte header copied ahead of every per-slot enemy display-list record
export const SCORE_VALUE_LO = 0xcaf1;  // [code] Per-type BCD score-award low byte added into the score triplet
export const SCORE_VALUE_HI = 0xcaf9;  // [code] Per-type BCD score-award high byte added into the score triplet
export const SOUND_VOICE_TABLE = 0xcb01;  // [code] Sound-definition table: one row per sound id giving a value byte for each of the sixteen voice slots
export const VOICE_ENV_FRAME_A = 0xcbcb;  // [code] Voice envelope frame-walk table (low-bit path) stepped until a non-zero frame
export const VOICE_ENV_FASTTIMER = 0xcbcc;  // [code] Voice envelope fast-timer reload value (low-bit path)
export const VOICE_ENV_LEVEL = 0xcbcd;  // [code] Voice envelope level/output byte folded into the slot POKEY level (low-bit path)
export const VOICE_ENV_FRAME_B = 0xcbce;  // [code] Voice envelope frame-walk companion table (low-bit path)
export const VOICE_ENV_FRAME_A_HI = 0xcccb;  // [code] Voice envelope frame-walk table for the high-bit frame path
export const VOICE_ENV_FASTTIMER_HI = 0xcccc;  // [code] Voice envelope fast-timer reload for the high-bit frame path
export const VOICE_ENV_LEVEL_HI = 0xcccd;  // [code] Voice envelope level/output byte for the high-bit frame path
export const VOICE_ENV_FRAME_B_HI = 0xccce;  // [code] Voice envelope frame-walk companion table for the high-bit frame path
export const MARKERROW_HEAD_OFS = 0xcdde;  // [code] Per-row buffer offset for a marker-row's header byte in the text vector buffer
export const MARKERROW_GLYPH_OFS = 0xcde0;  // [code] Per-row buffer offset for a marker-row's glyph entries in the text vector buffer
export const MARKERROW_PTR_OFS = 0xcde2;  // [code] Per-row buffer offset seeding the glyph-pointer hand-off for a marker row
export const GLYPH_LIST_BUF_OFS = 0xcde4;  // [code] Fixed vector-buffer start offset for the overlay glyph run
export const MIRROR_COPY_BUF_OFS = 0xcde5;  // [code] Fixed vector-buffer start offset for the three-entry mirror copy
export const VECTOR_TEMPLATE_BLOCK = 0xcde6;  // [code] ROM template block of vector-record bytes copied verbatim into vector RAM page 0x2f
export const TEMPLATE_COPY_LEN = 0xce66;  // [code] Copy-length selector (indexed by a flag) for the vector template block copy
export const DRAW_PTR_TABLE_A = 0xce68;  // [code] Interleaved 16-bit draw-layer pointer table (primary) into vector-RAM structures
export const ALT_DRAW_PTR_SET_LO = 0xce6e;  // [code] Alternate draw pointer low byte selected when the layer flag is non-zero
export const ALT_DRAW_PTR_SET_HI = 0xce6f;  // [code] Alternate draw pointer high byte selected when the layer flag is non-zero
export const DRAW_PTR_TABLE_B = 0xce7a;  // [code] Interleaved 16-bit draw-layer pointer table (alternate) into vector-RAM structures
export const ALT_DRAW_PTR_CLR_LO = 0xce86;  // [code] Alternate draw pointer low byte selected when the layer flag is zero
export const ALT_DRAW_PTR_CLR_HI = 0xce87;  // [code] Alternate draw pointer high byte selected when the layer flag is zero
export const DRAW_BASE_PTR_LO = 0xce8c;  // [code] Per-slot base draw-pointer low byte seated before the parity-selected write
export const DRAW_BASE_PTR_HI = 0xce8d;  // [code] Per-slot base draw-pointer high byte seated before the parity-selected write
export const DRAW_PTR_EVEN_LO = 0xce9e;  // [code] Draw-list pointer word low byte written on the parity-clear (even) pass
export const DRAW_PTR_EVEN_HI = 0xce9f;  // [code] Draw-list pointer word high byte written on the parity-clear (even) pass
export const DRAW_PTR_ODD_LO = 0xceb0;  // [code] Draw-list pointer word low byte written on the parity-set (odd) pass
export const DRAW_PTR_ODD_HI = 0xceb1;  // [code] Draw-list pointer word high byte written on the parity-set (odd) pass
export const VECHEAD0_FRAME = 0xcec2;  // [code] First display-list head word constant latched at vector RAM 0x2000 by the frame builder
export const VECHEAD1_FRAME = 0xcec3;  // [code] Second display-list head word constant latched at vector RAM 0x2001 by the frame builder
export const VECHEAD0_PLAY = 0xcec4;  // [code] First display-list head word constant latched at 0x2000 on the play/dispatch path (and the mid-frame change checkpoint source)
export const VECHEAD0_LEVEL = 0xcec6;  // [code] First display-list head word constant latched at 0x2000 by the level-layout builder (and the settled-frame checkpoint)
export const VECHEAD1_LEVEL = 0xcec7;  // [code] Second display-list head word constant latched at 0x2001 by the level-layout builder
export const OBJ_TEMPLATE_WORD_LO = 0xcec8;  // [code] Object/enemy vector template-word low-byte table indexed to pick an entry glyph word
export const OBJ_TEMPLATE_WORD_HI = 0xcec9;  // [code] Object/enemy vector template-word high-byte table paired with OBJ_TEMPLATE_WORD_LO
export const ACCUM_REDUCE_TABLE = 0xcfd9;  // [code] Reduction-amount lookup subtracted from the high accumulator during the lane sweep
export const SCALE_KEY_TABLE = 0xd121;  // [code] ROM scale-key byte split into two scale factors for the record draw
export const HEADER_COLOR_SEED = 0xd122;  // [code] Per-index ROM header/colour seed byte loaded into the record's header cell
export const VECLIST_CKSUM_SRC = 0xd575;  // [code] 17-byte ROM table folded into the checksum byte that gates the vector end-of-list
export const DIP_CONFIG_A = 0xd6b3;  // [code] DIP-decoded configuration byte (into loc_ac) selected by a two-bit option-switch field
export const DIP_CONFIG_B = 0xd6b4;  // [code] DIP-decoded configuration byte (into loc_ad) selected by a two-bit option-switch field
export const DIP_BONUS_INTERVAL = 0xd6f7;  // [code] DIP-decoded bonus/award threshold value (into BONUS_LIFE_INTERVAL) selected by DSW bits 5-3
export const DIP_PARAM_158 = 0xd6ff;  // [code] DIP-decoded configuration value loaded into DSW_BONUS_CONFIG, selected by DSW bits 7-6
export const ATTRACT_SND_SLOTA = 0xdbd5;  // [code] Attract/idle POKEY sequencer table selecting the slot to clear each phase
export const ATTRACT_SND_SLOTB = 0xdbd6;  // [code] Attract/idle POKEY sequencer table selecting the slot to write each phase
export const POTMARK_WORD_INDEX = 0xdce1;  // [code] Coordinate-word table index selected per pot-readout slot in the spinner/pot draw
export const EAROM_REGION_START = 0xdddd;  // [code] Per-region starting cursor for an EAROM read/write pass
export const EAROM_REGION_LIMIT = 0xddde;  // [code] Per-region ending limit for an EAROM read/write pass
export const EAROM_REGION_PTR_LO = 0xdde3;  // [code] Per-region low byte of the zero-page pointer to the EAROM region's RAM copy
export const EAROM_REGION_PTR_HI = 0xdde4;  // [code] Per-region high byte of the zero-page pointer to the EAROM region's RAM copy
export const ATTRACT_SND_VALUE = 0xdfdc;  // [code] Attract/idle POKEY sequencer table giving the value byte written to the sound register
export const COLOR_PAIR_LO = 0xdfe4;  // [code] Colour-pair low byte selected by SPINNER_ACCUM for the final colour-pair emit
export const COLOR_PAIR_HI = 0xdfe8;  // [code] Colour-pair high byte selected by SPINNER_ACCUM for the final colour-pair emit

export const INPUT_CUR = 0x4c;  // [code] Current-frame raw coin/switch input sample used for edge detection
export const INPUT_PREV = 0x004f;  // [code] Previous-frame held-input snapshot used to detect rising edges
export const HIT_DISTANCE_THRESHOLD = 0xa7;  // [code] proximity threshold for a near-slot collision test
export const loc_b3 = 0xb3;
export const COLUMN_SPAWN_CAP = 0x0129;  // [code] Per-column maximum enemy count (5-entry table 0x129..0x12d) used to cap spawning
export const COLUMN_ENEMY_TARGET = 0x012e;  // [code] Per-column target enemy count (base of a 5-entry table), source of the spawn deficit
export const SPAWN_DEFICIT_C0 = 0x013d;  // [code] Column-0 entry of the five-column spawn-deficit table (0x13d..0x141)
export const SPAWN_DEFICIT_C2 = 0x013f;  // [code] Column-2 entry of the five-column spawn-deficit table
export const CANDIDATE_LANE_1 = 0x014a;  // [code] Second entry of the four-entry candidate-lane table
export const SPIKE_LANE_MASK_ACC = 0x014f;  // [code] Working bit-mask accumulator of lanes with a mid-growth spike during the timer scan
export const SPIKE_LANE_MASK_OUT = 0x0150;  // [code] Published copy of the spike-lane occupancy bit-mask after the timer scan
export const ENEMY_BAND_THRESHOLD_0 = 0x0151;  // [code] Band-0 entry of the far-slot proximity/retire threshold table (0x151..0x155)
export const ENEMY_BAND_THRESHOLD_1 = 0x0152;  // [code] Band-1 entry of the far-slot proximity/retire threshold table
export const ENEMY_BAND_THRESHOLD_2 = 0x0153;  // [code] Band-2 entry of the far-slot proximity/retire threshold table
export const ENEMY_BAND_THRESHOLD_3 = 0x0154;  // [code] Band-3 entry of the far-slot proximity/retire threshold table
export const ENEMY_BAND_THRESHOLD_4 = 0x0155;  // [code] Band-4 entry of the far-slot proximity/retire threshold table
export const COORD_DISPATCH_SEL = 0x015e;  // [code] Even selector byte halved to dispatch a coordinate/step helper
export const ENEMY_CLIMB_DELTA_LO_1 = 0x0161;  // [code] Segment-1 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_LO_2 = 0x0162;  // [code] Segment-2 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_LO_3 = 0x0163;  // [code] Segment-3 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_1 = 0x0166;  // [code] Segment-1 high byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_2 = 0x0167;  // [code] Segment-2 high byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_3 = 0x0168;  // [code] Segment-3 high byte of the per-segment enemy climb-speed delta table
export const OBJECT_BAND = 0x027f;  // [code] Per-object attribute folded to a 3-bit band selecting the proximity/retire threshold
export const loc_2c0 = 0x02c0;
export const VEC_COORD1_LO = 0x3f16;  // [code] low-byte vector-ROM coordinate-word table (draw set 1)
export const VEC_COORD1_HI = 0x3f17;  // [code] high-byte vector-ROM coordinate-word table (draw set 1)
export const VEC_COORD2_LO = 0x3f1e;  // [code] low-byte vector-ROM coordinate-word table (draw set 2)
export const VEC_COORD2_HI = 0x3f1f;  // [code] high-byte vector-ROM coordinate-word table (draw set 2)
export const TIMER1_LO = 0x0406;  // [code] low byte of a software timer cascade ticked by the periodic interrupt
export const TIMER1_MID = 0x0407;  // [code] middle byte of the first software timer cascade
export const TIMER1_HI = 0x0408;  // [code] high byte of the first software timer cascade
export const AVG_GO_STROBE = 0x4800;  // [code] AVG start (go) strobe
export const WATCHDOG_CLEAR = 0x5000;  // [code] watchdog-clear + IRQ-acknowledge strobe
export const POKEY1_AUDF3 = 0x60c4;  // [code] POKEY1 audio-frequency register voice 3
export const POKEY1_AUDC3 = 0x60c5;  // [code] POKEY1 audio-control register voice 3
export const STATE_RESEED_RECORD_TABLE = 0x9604;  // [code] 4-byte-record ROM table of src/dst pointers for the state re-seed copy
export const DISPATCH_PTR_LO_TABLE = 0x969d;  // [code] low-pointer-byte table for a computed-jump handler dispatch
export const LANE_SCORE_INDEX_TABLE = 0xa3c5;  // [code] ROM table mapping a lane to its score-award index
export const ATTRACT_TIMER_LIMIT_TABLE = 0xa883;  // [code] per-stage attract-timer limit indexed by SWEEP_STAGE
export const SLOT_BIT_MASK = 0xca38;  // [code] Bit-mask lookup keyed by a slot's 4-bit tag, folded into the per-slot presence mask
export const VECHEAD1_PLAY = 0xcec5;  // [code] Second display-list head word constant latched at 0x2001 on the play/dispatch path
export const IRQ_STATE_CODE = 0xd7dd;  // [code] Interrupt-handler state-code dispatch table selected by the current game phase
export const DIAG_MASK_TABLE = 0xd8b6;  // [code] Mask table AND-compared against a status cell in the diagnostic/service draw
export const DIAG_VALUE_LO = 0xd8ba;  // [code] Diagnostic-display value selected by the low DSW nibble of DSW1_SNAPSHOT
export const DIAG_VALUE_HI = 0xd8c2;  // [code] Diagnostic-display value selected by the high bits of DSW1_SNAPSHOT
export const SELFTEST_COLOR_TABLE = 0xdaf9;  // [code] Eight-byte ROM colour table copied into colour RAM during the self-test session

export const ROUTINES = {
  0x9677: { name: "loc_9677" },
  0x9683: { name: "loc_9683" },
  0x9a87: { name: "loc_9a87" },
  0xa309: { name: "loc_a309" },
  0xa398: { name: "loc_a398" },
  0xda62: { name: "loc_da62" },
  0xd93f: { name: "loc_d93f" },
  0x92c5: { name: "loc_92c5" },
  0x99a5: { name: "loc_99a5" },
  0xa38e: { name: "loc_a38e" },
  0xa888: { name: "loc_a888" },
  0xda0a: { name: "loc_da0a" },
  0x9009: { name: "loc_9009" },
  0x9025: { name: "loc_9025" },
  0x90c4: { name: "loc_90c4" },
  0x9923: { name: "loc_9923" },
  0xa463: { name: "loc_a463" },
  0xa83a: { name: "loc_a83a" },
  0xd8ca: { name: "loc_d8ca" },
  0x98a2: { name: "loc_98a2" },
  0xa23f: { name: "loc_a23f" },
  0xa454: { name: "loc_a454" },
  0xc90c: { name: "loc_c90c" },
  0xc940: { name: "loc_c940" },
  0xc98c: { name: "loc_c98c" },
  0x9729: { name: "loc_9729" },
  0x9108: { name: "loc_90c4", entry: "loc_9108" },
  0x9149: { name: "loc_90c4", entry: "loc_9149" },
  0xd8cd: { name: "loc_d8ca", entry: "loc_d8cd" },
  0xd92f: { name: "loc_d92f" },
  0xd931: { name: "loc_d931" },

  0x902b: { name: "loc_902b" },
  0x904b: { name: "loc_904b" },
  0x91b5: { name: "loc_91b5" },
  0x921b: { name: "loc_921b" },
  0x9234: { name: "loc_9234" },
  0x9246: { name: "loc_9246" },
  0x926f: { name: "loc_926f" },
  0x928f: { name: "loc_928f" },
  0x929f: { name: "loc_929f" },
  0x92ad: { name: "loc_92ad" },
  0x92b2: { name: "loc_92b2" },
  0x93e0: { name: "loc_93e0" },
  0x96ab: { name: "loc_96ab" },
  0x96b7: { name: "loc_96ab", entry: "loc_96b7" },
  0x96c4: { name: "loc_96ab", entry: "loc_96c4" },
  0x96c7: { name: "loc_96c7" },
  0x96c8: { name: "loc_96c7", entry: "loc_96c8" },
  0x96cb: { name: "loc_96cb" },
  0x96db: { name: "loc_96db" },
  0x96e2: { name: "loc_96e2" },
  0x96f4: { name: "loc_96f4" },
  0x9700: { name: "loc_96f4", entry: "loc_9700" },
  0x9749: { name: "loc_9749" },
  0x970b: { name: "loc_970b" },
  0x97c5: { name: "loc_97c5" },
  0x97f8: { name: "loc_97f8" },
  0x994d: { name: "loc_994d" },
  0x9a88: { name: "loc_9a88" },
  0x9a9d: { name: "loc_9a9d" },
  0x9ab7: { name: "loc_9a9d", entry: "loc_9ab7" },
  0x9abb: { name: "loc_9abb" },
  0x9aee: { name: "loc_9aee" },
  0x9af1: { name: "loc_9aee", entry: "loc_9af1" },
  0x9af6: { name: "loc_9aee", entry: "loc_9af6" },
  0x9b07: { name: "loc_9b07" },
  0x9b98: { name: "loc_9b98" },
  0x9b1e: { name: "loc_9b1e" },
  0x9bca: { name: "loc_9bca" },
  0x9cb6: { name: "loc_9cb6" },
  0x9bcf: { name: "loc_9bcf" },
  0x9bd0: { name: "loc_9bd0" },
  0x9bdd: { name: "loc_9bdd" },
  0x9bee: { name: "loc_9bee" },
  0x9bfa: { name: "loc_9bfa" },
  0x9c0c: { name: "loc_9c0c" },
  0x9c17: { name: "loc_9c17" },
  0x9c21: { name: "loc_9c21" },
  0x9c3b: { name: "loc_9c3b" },
  0x9c4f: { name: "loc_9c4f" },
  0x9c58: { name: "loc_9c58" },
  0x9c63: { name: "loc_9c58", entry: "loc_9c63" },
  0x9c99: { name: "loc_9c58", entry: "loc_9c99" },
  0x9d06: { name: "loc_9d06" },
  0x9d67: { name: "loc_9d67" },
  0x9d82: { name: "loc_9d82" },
  0x9e2f: { name: "loc_9e2f" },
  0x9e48: { name: "loc_9e48" },
  0x9e5c: { name: "loc_9e5c" },
  0x9e5f: { name: "loc_9e5f" },
  0x9eab: { name: "loc_9eab" },
  0x9ed7: { name: "loc_9ed7" },
  0x9ef1: { name: "loc_9ef1" },
  0x9f5f: { name: "loc_9f5f" },
  0x9f81: { name: "loc_9f81" },
  0x9f8a: { name: "loc_9f81", entry: "loc_9f8a" },
  0x9fc4: { name: "loc_9fc4" },
  0xa028: { name: "loc_a028" },
  0xa06f: { name: "loc_a06f" },
  0xa18f: { name: "loc_a18f" },
  0xa1e4: { name: "loc_a1e4" },
  0xa1fa: { name: "loc_a1fa" },
  0xa2a6: { name: "loc_a2a6" },
  0xa33a: { name: "loc_a33a" },
  0xa343: { name: "loc_a343" },
  0xa347: { name: "loc_a343", entry: "loc_a347" },
  0xa34b: { name: "loc_a34b" },
  0xa34d: { name: "loc_a34b", entry: "loc_a34d" },
  0xa352: { name: "loc_a34b", entry: "loc_a352" },
  0xa36f: { name: "loc_a36f" },
  0xa3ca: { name: "loc_a3ca" },
  0xa3d4: { name: "loc_a3d4" },
  0xa3d6: { name: "loc_a3d6" },
  0xa416: { name: "loc_a416" },
  0xa504: { name: "loc_a504" },
  0xa5cb: { name: "loc_a5cb" },
  0xa618: { name: "loc_a618" },
  0xa65b: { name: "loc_a65b" },
  0xa69b: { name: "loc_a69b" },
  0xa6a9: { name: "loc_a6a9" },
  0xa721: { name: "loc_a721" },
  0xa75d: { name: "loc_a75d" },
  0xa789: { name: "loc_a789" },
  0xa7a6: { name: "loc_a7a6" },
  0xa7bd: { name: "loc_a7bd" },
  0xa7d2: { name: "loc_a7d2" },
  0xa831: { name: "loc_a831" },
  0xa8b4: { name: "loc_a8b4" },
  0xa8e7: { name: "loc_a8e7" },
  0xa97f: { name: "loc_a97f" },
  0xa9d7: { name: "loc_a9d7" },
  0xa9fc: { name: "loc_a9fc" },
  0xaa13: { name: "loc_aa13" },
  0xaa5a: { name: "loc_aa5a" },
  0xaa62: { name: "loc_aa62" },
  0xaa69: { name: "loc_aa69" },
  0xaa6f: { name: "loc_aa6f" },
  0xaa79: { name: "loc_aa79" },
  0xaa92: { name: "loc_aa92" },
  0xaa97: { name: "loc_aa97" },
  0xaa9e: { name: "loc_aa9e" },
  0xaaa8: { name: "loc_aaa8" },
  0xaaf5: { name: "loc_aaf5" },
  0xab0d: { name: "loc_ab0d" },
  0xab14: { name: "loc_ab14" },
  0xab17: { name: "loc_ab17" },
  0xab3b: { name: "loc_ab3b" },
  0xab98: { name: "loc_ab98" },
  0xaba2: { name: "loc_aba2" },
  0xabac: { name: "loc_abac" },
  0xac07: { name: "loc_ac07" },
  0xac20: { name: "loc_ac20" },
  0xac36: { name: "loc_ac36" },
  0xac3e: { name: "loc_ac3e" },
  0xac3f: { name: "loc_ac3f" },
  0xad22: { name: "loc_ad22" },
  0xad6e: { name: "loc_ad6e" },
  0xadce: { name: "loc_adce" },
  0xadea: { name: "loc_adea" },
  0xae1c: { name: "loc_ae1c" },
  0xae4e: { name: "loc_ae4e" },
  0xaeca: { name: "loc_aeca" },
  0xaef8: { name: "loc_aef8" },
  0xaf26: { name: "loc_af26" },
  0xaf3f: { name: "loc_af3f" },
  0xaf6e: { name: "loc_af6e" },
  0xaf71: { name: "loc_af71" },
  0xaf77: { name: "loc_af77" },
  0xaf81: { name: "loc_af81" },
  0xb0ab: { name: "loc_b0ab" },
  0xb0c6: { name: "loc_b0c6" },
  0xb0d1: { name: "loc_b0d1" },
  0xb0dd: { name: "loc_b0dd" },
  0xb0e7: { name: "loc_b0e7" },
  0xb102: { name: "loc_b102" },
  0xb131: { name: "loc_b131" },
  0xb15a: { name: "loc_b15a" },
  0xb230: { name: "loc_b230" },
  0xb1b6: { name: "loc_b1b6" },
  0xb20d: { name: "loc_b20d" },
  0xb2be: { name: "loc_b2be" },
  0xb2de: { name: "loc_b2de" },
  0xb2fe: { name: "loc_b2fe" },
  0xb332: { name: "loc_b332" },
  0xb367: { name: "loc_b367" },
  0xb498: { name: "loc_b498" },
  0xb56a: { name: "loc_b56a" },
  0xb586: { name: "loc_b586" },
  0xb5ad: { name: "loc_b5ad" },
  0xb5d7: { name: "loc_b5d7" },
  0xb5eb: { name: "loc_b5eb" },
  0xb60f: { name: "loc_b60f" },
  0xb622: { name: "loc_b622" },
  0xb634: { name: "loc_b634" },
  0xb69b: { name: "loc_b69b" },
  0xb6fa: { name: "loc_b6fa" },
  0xb71b: { name: "loc_b71b" },
  0xb75b: { name: "loc_b75b" },
  0xb79a: { name: "loc_b79a" },
  0xb7eb: { name: "loc_b7eb" },
  0xb84e: { name: "loc_b84e" },
  0xb85f: { name: "loc_b85f" },
  0xb875: { name: "loc_b875" },
  0xb888: { name: "loc_b888" },
  0xb896: { name: "loc_b896" },
  0xb8ba: { name: "loc_b8ba" },
  0xb944: { name: "loc_b944" },
  0xb955: { name: "loc_b955" },
  0xb967: { name: "loc_b967" },
  0xbcfd: { name: "loc_bcfd" },
  0xbd09: { name: "loc_bd09" },
  0xbd3e: { name: "loc_bd3e" },
  0xbda0: { name: "loc_bda0" },
  0xbdcb: { name: "loc_bda0", entry: "loc_bdcb" },
  0xc098: { name: "loc_c098" },
  0xc16e: { name: "loc_c16e" },
  0xc196: { name: "loc_c196" },
  0xc1c3: { name: "loc_c1c3" },
  0xc235: { name: "loc_c235" },
  0xc2e8: { name: "loc_c2e8" },
  0xc30d: { name: "loc_c30d" },
  0xc36e: { name: "loc_c36e" },
  0xc3ba: { name: "loc_c3ba" },
  0xc3ee: { name: "loc_c3ee" },
  0xc423: { name: "loc_c423" },
  0xc43c: { name: "loc_c43c" },
  0xc453: { name: "loc_c453" },
  0xc473: { name: "loc_c473" },
  0xc4e1: { name: "loc_c4e1" },
  0xc54d: { name: "loc_c54d" },
  0xc5c2: { name: "loc_c5c2" },
  0xc66d: { name: "loc_c66d" },
  0xc6c7: { name: "loc_c6c7" },
  0xc73c: { name: "loc_c73c" },
  0xc765: { name: "loc_c765" },
  0xc772: { name: "loc_c772" },
  0xc774: { name: "loc_c772", entry: "loc_c774" },
  0xc7bd: { name: "loc_c7bd" },
  0xc7a0: { name: "loc_c7a0" },
  0xc800: { name: "loc_c800" },
  0xc81b: { name: "loc_c81b" },
  0xc891: { name: "loc_c891" },
  0xc97b: { name: "loc_c97b" },
  0xc9af: { name: "loc_c9af" },
  0xc9f1: { name: "loc_c9f1" },
  0xca18: { name: "loc_ca18" },
  0xca48: { name: "loc_ca48" },
  0xca62: { name: "loc_ca62" },
  0xca6c: { name: "loc_ca6c" },
  0xccb0: { name: "loc_ccb0" },
  0xccb5: { name: "loc_ccb5" },
  0xccb9: { name: "loc_ccb9" },
  0xccbd: { name: "loc_ccbd" },
  0xccc1: { name: "loc_ccc1" },
  0xccc3: { name: "loc_ccc3" },
  0xccc7: { name: "loc_ccc7" },
  0xccea: { name: "loc_ccea" },
  0xccee: { name: "loc_ccee" },
  0xccf2: { name: "loc_ccf2" },
  0xccf6: { name: "loc_ccf6" },
  0xccfa: { name: "loc_ccfa" },
  0xccfe: { name: "loc_ccfe" },
  0xcd02: { name: "loc_cd02" },
  0xcd06: { name: "loc_cd06" },
  0xcd0a: { name: "loc_cd0a" },
  0xcd95: { name: "loc_cd95" },
  0xcf24: { name: "loc_cf24" },
  0xd6bb: { name: "loc_d6bb" },
  0xd704: { name: "loc_d704", irq: true }, // the ~246Hz interrupt handler: dispatched RAW (no seam ret)
  0xd7e1: { name: "loc_d7e1" },
  0xd8a9: { name: "loc_d8a9" },
  0xd804: { name: "loc_d804" },
  0xdb0f: { name: "loc_db0f" },
  0xdb22: { name: "loc_db22" },
  0xdb5a: { name: "loc_db5a" },
  0xdb6f: { name: "loc_db6f" },
  0xdb7e: { name: "loc_db7e" },
  0xdb84: { name: "loc_db84" },
  0xdb88: { name: "loc_db88" },
  0xdb9a: { name: "loc_db9a" },
  0xdbe0: { name: "loc_dbe0" },
  0xdce6: { name: "loc_dce6" },
  0xdbf7: { name: "loc_dbf7" },
  0xdd0d: { name: "loc_dd0d" },
  0xdd27: { name: "loc_dd27" },
  0xdd29: { name: "loc_dd29" },
  0xdd2b: { name: "loc_dd2b" },
  0xdd41: { name: "loc_dd41" },
  0xdde9: { name: "loc_dde9" },
  0xdded: { name: "loc_dded" },
  0xddf1: { name: "loc_ddf1" },
  0xddf3: { name: "loc_ddf3" },
  0xddf7: { name: "loc_ddf7" },
  0xddfb: { name: "loc_ddfb" },
  0xddfd: { name: "loc_ddfb", entry: "loc_ddfd" },
  0xddff: { name: "loc_ddfb", entry: "loc_ddff" },
  0xde11: { name: "loc_de11" },
  0xde1b: { name: "loc_de1b" },
  0xdf09: { name: "loc_df09" },
  0xdf0d: { name: "loc_df0d" },
  0xdf12: { name: "loc_df0d", entry: "loc_df12" },
  0xdf19: { name: "loc_df19" },
  0xdf1f: { name: "loc_df1f" },
  0xdf24: { name: "loc_df1f", entry: "loc_df24" },
  0xdf39: { name: "loc_df39" },
  0xdf4a: { name: "loc_df4a" },
  0xdf4c: { name: "loc_df4c" },
  0xdf53: { name: "loc_df53" },
  0xdf57: { name: "loc_df53", entry: "loc_df57" },
  0xdf59: { name: "loc_df59" },
  0xdf5f: { name: "loc_df5f" },
  0xdf6a: { name: "loc_df6a" },
  0xdf6c: { name: "loc_df6c" },
  0xdf73: { name: "loc_df73" },
  0xdf75: { name: "loc_df75" },
  0xdf92: { name: "loc_df92" },
  0xdfac: { name: "loc_df92", entry: "loc_dfac" },
  0xdfb1: { name: "loc_dfb1" },
};
