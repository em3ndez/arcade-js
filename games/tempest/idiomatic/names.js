// SPDX-License-Identifier: GPL-3.0-only
// Tempest idiomatic-layer name registry (cells + ROUTINES override map). loc_<addr> placeholders (names-debt)
// until the understand pass renames + grounds them. Generated from module+test imports and module exports.

export const STACK_SCRATCH = { lo: 0x01e0, hi: 0x0200 };

export const GAME_MODE = 0x0000;  // [seen] Current game-mode/state code that drives the mode dispatch and is armed from the pending mode
export const MODE_DISPATCH_SEL = 0x0001;  // [seen] Pre-doubled selector paired with the mode byte; indexes the main-loop trampoline handler table
export const GAME_MODE_PENDING = 0x0002;  // [seen] Pending game mode promoted into GAME_MODE once the mode-delay timer expires
export const FRAME_COUNTER = 0x0003;  // [seen] Per-update frame counter; its low bits are the animation/even-odd phase read across the draw code
export const MODE_DELAY_TIMER = 0x0004;  // [seen] Delay countdown that gates promotion of the pending mode into the live mode
export const STATUS_FLAGS = 0x0005;  // [seen] Game status flag byte; bit7 = play/active state, other bits gate scoring, sound and draw paths
export const PHASE_COUNTER = 0x0006;  // [seen] Phase/step counter drained by the setup step and clamped to 0x28 for a packed on-screen readout
export const IRQ_SUBTIMER = 0x0007;  // [seen] Software sub-timer incremented each interrupt; its wrap drives the TIMER1_LO/TIMER2_LO carry cascades
export const INPUT_PORT_LATCH = 0x0008;  // [seen] Latched raw input port snapshot whose bits gate the three heartbeat lanes
export const DSW1_SNAPSHOT = 0x0009;  // [seen] Snapshot of option/coinage port DSW1_COINAGE (bit1 toggled), read for configuration and increments
export const DSW2_SNAPSHOT = 0x000a;  // [seen] Snapshot of option port DSW2_OPTIONS, sliced three ways into DIP configuration tables
export const SOUND_STEP_GATE = 0x000c;  // [seen] Flag enabling the periodic sound-register sub-step in the per-frame dispatcher
export const LANE_WRAP_POS = 0x000d;  // [seen] Three-lane wrapped position accumulator (masked to five bits) advanced by the heartbeat
export const LANE_DOWNTIMER = 0x0010;  // [seen] Per-lane down-timer (reloads to 0x78) that drives the heartbeat accumulator step
export const LANE_COUNTER = 0x0013;  // [seen] Three-entry per-lane counter advanced by the heartbeat; its bit7 feeds the coin/LED latch
export const LANE_COUNTER_1 = 0x0014;  // [code] Second entry of the three-lane heartbeat counter (LANE_COUNTER base)
export const LANE_COUNTER_2 = 0x0015;  // [code] Third entry of the three-lane heartbeat counter (LANE_COUNTER base)
export const HEARTBEAT_ACCUM_LO = 0x0016;  // [seen] Low byte of the heartbeat running accumulator advanced with a carry link
export const HEARTBEAT_ACCUM_HI = 0x0017;  // [seen] High byte of the heartbeat running accumulator, later reduced by a table amount
export const HEARTBEAT_ACCUM_OVERFLOW = 0x0018;  // [code] Overflow tally advanced when the heartbeat accumulator subtraction stays non-negative
export const LEVEL_GEOM_LO = 0x0019;  // [seen] Eight-entry working table of the current level's low geometry nibbles (mirrored to colour RAM COLOR_RAM)
export const LEVEL_GEOM_HI = 0x0021;  // [seen] Eight-entry working table of the current level's high geometry nibbles (mirrored to colour RAM COLOR_RAM_8)
export const COLOR_CYCLE_0 = 0x0022;  // [seen] First entry of a three-entry array mirrored into colour RAM COLOR_RAM_9..COLOR_RAM_B
export const COLOR_CYCLE_1 = 0x0023;  // [seen] Second entry of the three-entry array mirrored into colour RAM COLOR_RAM_9..COLOR_RAM_B
export const COLOR_CYCLE_2 = 0x0024;  // [seen] Third entry of the three-entry array mirrored into colour RAM COLOR_RAM_9..COLOR_RAM_B
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
export const MATHBOX_SIGN_X = 0x0033;  // [seen] Sign flag of the horizontal (X) delta fed to the math box, controlling the X offset fold
export const MATHBOX_SIGN_Y = 0x0034;  // [seen] Sign flag of the vertical (Y) delta fed to the math box, controlling the Y offset fold
export const SAVED_INDEX = 0x0035;  // [seen] Scratch that preserves a caller loop/slot index (X or Y) across a subroutine call
export const SAVED_INDEX2 = 0x0036;  // [seen] Second index-save scratch preserving a caller loop/slot index across a call
export const SLOT_LOOP_INDEX = 0x0037;  // [seen] Current slot/column loop index driving the per-slot draw and update walks
export const TABLE_CURSOR = 0x0038;  // [seen] Secondary table/packed-record cursor and working-slot index used by the draw and projection passes
export const loc_39 = 0x0039;
export const WELL_DEPTH_ROW = 0x003a;  // [seen] Depth-row index into the well depth table SLOT_THRESHOLD_TABLE while drawing the playfield well rows
export const WORK_PTR_LO = 0x003b;  // [seen] Low byte of a general working indirect pointer (source/glyph/shape-list/destination pointer)
export const WORK_PTR_HI = 0x003c;  // [seen] High byte of the general working indirect pointer paired with WORK_PTR_LO
export const loc_3d = 0x003d;
export const ACTIVE_SLOT_COUNT = 0x003e;  // [seen] Upper loop bound / active slot-or-channel count used by the per-slot scans
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
export const SLOT_COUNTDOWN_HI = 0x0049;  // [seen] High/paired partner of the SLOT_COUNTDOWN slot countdown, spent together with it
export const INPUT_DEBOUNCED = 0x004d;  // [seen] Debounced held-input byte built from this and last frame's samples
export const INPUT_EDGE_FLAGS = 0x004e;  // [seen] Newly-pressed input edges plus control/gate bits consumed by the frame steppers
export const SPINNER_ACCUM = 0x0050;  // [seen] Accumulated spinner delta (rotary encoder) read as the manual rim-rotation input
export const RIM_ROT_OFFSET = 0x0051;  // [seen] Stored fine rim-rotation offset/velocity folded into the coarse angle each update
export const SPINNER_POT_PREV = 0x0052;  // [seen] Previous inverted spinner pot reading used to form the per-interrupt delta
export const IRQ_HEARTBEAT = 0x0053;  // [seen] Interrupt heartbeat counter; the main loop waits for it to reach nine as its frame boundary
export const DRAW_STYLE = 0x0055;  // [seen] Style/colour selector byte staged for the object-record draw builder
export const PROJ_PT_Y = 0x0056;  // [seen] Vertical (Y) coordinate operand fed to the math-box projection
export const OBJ_DEPTH = 0x0057;  // [seen] Current object/segment depth (Z) value gated and projected by the draw pipeline
export const PROJ_PT_X = 0x0058;  // [seen] Horizontal (X) coordinate operand fed to the math-box projection
export const CLAMP_TALLY = 0x0059;  // [seen] Clamp/run tally counter for the rim-segment and lane-sweep builders
export const RUN_SIZE = 0x005a;  // [seen] Run-size/count field for the rim-segment builder and the style pair
export const DEPTH_LO = 0x005b;  // [seen] Low byte of the 16-bit well-depth / countdown-clock value, also a draw guard flag (bit7)
export const DEPTH_ACCUM_LO = 0x005c;  // [seen] Low byte of a secondary depth accumulator stepped alongside DEPTH_HI
export const DEPTH_TARGET = 0x005d;  // [seen] Target depth reseeded into the position high byte when the depth window collapses
export const PROJ_Y_REF = 0x005e;  // [seen] Vertical (Y) reference/base subtracted from the point Y in the projection
export const DEPTH_HI = 0x005f;  // [seen] High byte of the 16-bit well-depth / countdown-clock and the reference depth for object gating
export const PROJ_X_REF = 0x0060;  // [seen] Horizontal (X) reference/base subtracted from the point X in the projection
export const PROJ_Y_LO = 0x0061;  // [seen] Low byte of the projected vertical (Y) accumulator / working coordinate block
export const PROJ_Y_HI = 0x0062;  // [seen] High byte of the projected vertical (Y) accumulator
export const PROJ_X_LO = 0x0063;  // [seen] Low byte of the projected horizontal (X) accumulator / working coordinate block
export const PROJ_X_HI = 0x0064;  // [seen] High byte of the projected horizontal (X) accumulator
export const PROJ_OFS_Y_LO = 0x0066;  // [seen] Low byte of the vertical (Y) offset folded into the projected Y accumulator
export const PROJ_OFS_Y_HI = 0x0067;  // [seen] High byte of the vertical (Y) projection offset paired with PROJ_OFS_Y_LO
export const PROJ_OFS_X_LO = 0x0068;  // [seen] Low byte of the horizontal (X) offset folded into the projected X accumulator (also a 24-bit total low byte)
export const PROJ_OFS_X_HI = 0x0069;  // [seen] High byte of the horizontal (X) projection offset paired with PROJ_OFS_X_LO
export const PREV_Y_LO = 0x006a;  // [seen] Low byte of the cached previous-point Y, subtracted by stroke-delta drawing
export const PREV_Y_HI = 0x006b;  // [seen] High byte of the cached previous-point Y
export const PREV_X_LO = 0x006c;  // [seen] Low byte of the cached previous-point X, subtracted by stroke-delta drawing
export const PREV_X_HI = 0x006d;  // [seen] High byte of the cached previous-point X
export const VEC_DELTA_Y_LO = 0x006e;  // [seen] Low byte of the sign-extended vertical (Y) delta pair emitted as a vector stroke
export const DRAW_DELTA_A_HI = 0x006f;  // [seen] high byte of the first 16-bit coordinate delta of a vector record
export const DRAW_DELTA_B_LO = 0x0070;  // [seen] low byte of the second 16-bit coordinate delta of a vector record
export const DRAW_DELTA_B_HI = 0x0071;  // [seen] high byte of the second 16-bit coordinate delta of a vector record
export const VG_LAST_STAT = 0x0072;  // [seen] cached last-emitted vector-generator state word, used to skip redundant emits
export const VG_RECORD_HEADER = 0x0073;  // [seen] current vector-record header/opcode nibble byte
export const DRAW_CURSOR_LO = 0x0074;  // [seen] low half of the vector display-list write pointer
export const DRAW_CURSOR_HI = 0x0075;  // [seen] high half of the vector display-list write pointer
export const DRAW_CURSOR_ALT_LO = 0x0076;  // [seen] low half of the alternate vector write pointer swapped with the main cursor
export const DRAW_CURSOR_ALT_HI = 0x0077;  // [seen] high half of the alternate vector write pointer
export const SEG_SPREAD_A_LO = 0x0078;  // [seen] base of the 8-entry low-byte array of interpolated coordinate A along a segment
export const SEG_SPREAD_A_LO_1 = 0x0079;  // [seen] interpolated coordinate-A low byte, index 1 (also holds the clamped signed delta-A seed)
export const SEG_SPREAD_A_LO_2 = 0x007a;  // [seen] interpolated coordinate-A low byte, index 2
export const SEG_SPREAD_A_LO_3 = 0x007b;  // [seen] interpolated coordinate-A low byte, index 3
export const SEG_SPREAD_A_LO_4 = 0x007c;  // [seen] interpolated coordinate-A low byte, index 4
export const SEG_SPREAD_A_LO_5 = 0x007d;  // [seen] interpolated coordinate-A low byte, index 5
export const SEG_SPREAD_A_LO_6 = 0x007e;  // [seen] interpolated coordinate-A low byte, index 6
export const SEG_SPREAD_A_LO_7 = 0x007f;  // [seen] interpolated coordinate-A low byte, index 7
export const SEG_SPREAD_A_HI = 0x0080;  // [seen] base of the 8-entry high-byte array of interpolated coordinate A
export const SEG_SPREAD_A_HI_1 = 0x0081;  // [seen] interpolated coordinate-A high byte, index 1
export const SEG_SPREAD_A_HI_2 = 0x0082;  // [seen] interpolated coordinate-A high byte, index 2 (doubles as the running fraction accumulator)
export const SEG_SPREAD_A_HI_3 = 0x0083;  // [seen] interpolated coordinate-A high byte, index 3
export const SEG_SPREAD_A_HI_4 = 0x0084;  // [seen] interpolated coordinate-A high byte, index 4
export const SEG_SPREAD_A_HI_5 = 0x0085;  // [seen] interpolated coordinate-A high byte, index 5
export const SEG_SPREAD_A_HI_6 = 0x0086;  // [seen] interpolated coordinate-A high byte, index 6
export const SEG_SPREAD_A_HI_7 = 0x0087;  // [seen] interpolated coordinate-A high byte, index 7
export const SEG_SPREAD_B_LO = 0x0088;  // [seen] base of the 8-entry low-byte array of interpolated coordinate B along a segment
export const SEG_SPREAD_B_LO_1 = 0x0089;  // [seen] interpolated coordinate-B low byte, index 1 (also holds the clamped signed delta-B seed)
export const SEG_SPREAD_B_LO_2 = 0x008a;  // [seen] interpolated coordinate-B low byte, index 2
export const SEG_SPREAD_B_LO_3 = 0x008b;  // [seen] interpolated coordinate-B low byte, index 3
export const SEG_SPREAD_B_LO_4 = 0x008c;  // [seen] interpolated coordinate-B low byte, index 4
export const SEG_SPREAD_B_LO_5 = 0x008d;  // [seen] interpolated coordinate-B low byte, index 5
export const SEG_SPREAD_B_LO_6 = 0x008e;  // [seen] interpolated coordinate-B low byte, index 6
export const SEG_SPREAD_B_LO_7 = 0x008f;  // [seen] interpolated coordinate-B low byte, index 7
export const SEG_SPREAD_B_HI = 0x0090;  // [seen] base of the 8-entry high-byte array of interpolated coordinate B
export const SEG_SPREAD_B_HI_1 = 0x0091;  // [seen] interpolated coordinate-B high byte, index 1
export const SEG_SPREAD_B_HI_2 = 0x0092;  // [seen] interpolated coordinate-B high byte, index 2 (doubles as the running fraction accumulator)
export const SEG_SPREAD_B_HI_3 = 0x0093;  // [seen] interpolated coordinate-B high byte, index 3
export const SEG_SPREAD_B_HI_4 = 0x0094;  // [seen] interpolated coordinate-B high byte, index 4
export const SEG_SPREAD_B_HI_5 = 0x0095;  // [seen] interpolated coordinate-B high byte, index 5
export const SEG_SPREAD_B_HI_6 = 0x0096;  // [seen] interpolated coordinate-B high byte, index 6
export const SEG_SPREAD_B_HI_7 = 0x0097;  // [seen] interpolated coordinate-B high byte, index 7
export const DRAW_RECORD_COUNT = 0x0099;  // [seen] countdown of four-byte vector records still to emit in a run
export const SEG_DELTA_A_SIGN = 0x009b;  // [seen] high/sign byte of the first signed segment delta
export const SEG_DELTA_B_SIGN = 0x009d;  // [seen] high/sign byte of the second signed segment delta
export const loc_9e = 0x009e;
export const loc_9f = 0x009f;
export const loc_a0 = 0x00a0;
export const VG_MODE_FLAG = 0x00a1;  // [seen] vector draw mode flag carrying bit 2 of the selected scale value
export const loc_a2 = 0x00a2;
export const ACTIVE_ENEMY_COUNT = 0x00a6;  // [seen] count of live climbing enemies, also indexes the per-wave difficulty table
export const DRAW_CURSOR_OFFSET = 0x00a9;  // [seen] byte offset added to the draw cursor for the current record run
export const DRAW_SRC_PTR_LO = 0x00aa;  // [seen] low half of an indirect source pointer read during draw-record building
export const DRAW_SRC_PTR_HI = 0x00ab;  // [seen] high half of the indirect draw source pointer
export const loc_ac = 0x00ac;
export const loc_ad = 0x00ad;
export const NIBBLE_EMIT_COUNT = 0x00ae;  // [seen] remaining byte count while emitting a run of zero-page bytes as nibbles
export const NIBBLE_EMIT_INDEX = 0x00af;  // [seen] current zero-page source index for the nibble-run emitter
export const DRAW_PATCH_PTR_LO = 0x00b0;  // [seen] low half of a saved record pointer used for a colour-patch second pass
export const DRAW_PATCH_PTR_HI = 0x00b1;  // [seen] high half of the saved colour-patch record pointer
export const VG_SCALE = 0x00b4;  // [seen] selected vector-generator scale byte
export const CHECKSUM_ACC = 0x00b5;  // [seen] rolling checksum accumulator over a fixed ROM table
export const DRAW_RECORD_PTR_LO = 0x00b6;  // [seen] low half of the pointer remembering where a display-list record began
export const DRAW_RECORD_PTR_HI = 0x00b7;  // [seen] high half of the display-list record-start pointer
export const NVRAM_SCAN_PTR_LO = 0x00bd;  // [seen] low half of the pointer walking a region's RAM copy for the EAROM store/verify
export const NVRAM_SCAN_PTR_HI = 0x00be;  // [seen] high half of the EAROM region-copy walk pointer
export const SOUND_SLOT_SENTINEL = 0x00bf;  // [seen] index of the voice slot currently being claimed, holding the 0xff sentinel otherwise
export const SOUND_VOICE_VALUE = 0x00c0;  // [seen] base of the 16-entry per-voice value/pitch table for the sound engine
export const SOUND_VOICE_LEVEL = 0x00d0;  // [seen] base of the 16-entry per-voice level/output table published to POKEY
export const SOUND_FAST_TIMER = 0x00e0;  // [seen] base of the 16-entry per-voice fast (frame-step) timer array
export const SOUND_SLOW_TIMER = 0x00f0;  // [seen] base of the 16-entry per-voice slow (envelope) timer array
export const loc_100 = 0x0100;
export const loc_102 = 0x0102;
export const SPIKE_STEP_LO = 0x0104;  // [seen] low byte of the moving spike's 16-bit per-frame height increment
export const SPIKE_STEP_HI = 0x0105;  // [seen] high byte of the moving spike's 16-bit per-frame height increment
export const SPIKE_ACTIVE_FLAG = 0x0106;  // [seen] moving-spike active/arm flag, active while bit7 set
export const SPIKE_HEIGHT_LO = 0x0107;  // [seen] low byte of the moving spike's 16-bit height (high byte in PLAYER_SHOT_DEPTH)
export const ENEMY_TOTAL_COUNT = 0x0108;  // [seen] total live-enemy count decremented when no per-type count applies
export const ENEMY_TYPE_COUNT = 0x0109;  // [seen] per-type live-enemy count
export const SCRIPT_WALK_CONTINUE = 0x010a;  // [seen] walk-continuation flag that keeps an object's driving script walk alive
export const SCRIPT_CURSOR = 0x010b;  // [seen] rolling cursor naming the current position within the object script table
export const SCRIPT_BRANCH_FLAG = 0x010c;  // [seen] flag recording the outcome of the most recent script test
export const SPAWN_FOUND_FLAG = 0x010d;  // [seen] flag set when the spawn walk found a live or newly-spawned object
export const SPAWN_BUDGET_TIMER = 0x010e;  // [seen] per-frame spawn budget countdown
export const loc_10f = 0x010f;
export const loc_110 = 0x0110;
export const TUBE_GEOM_FLAG = 0x0111;  // [seen] per-level tube-geometry flag; bit7 governs lane-index wrap and nonzero marks a live board
export const TUBE_SHAPE_INDEX = 0x0112;  // [seen] current tube shape/level index used to index the level geometry tables
export const loc_113 = 0x0113;
export const REDRAW_COUNTER = 0x0114;  // [seen] display-change counter bumped when watched state changes; also used as a 0xff dirty flag
export const SPIKE_TABLE_GUARD = 0x0115;  // [seen] Arm/guard flag for the descending spike object; its sign also chooses which rail the spike table snaps to
export const TIMED_OBJECT_COUNT = 0x0116;  // [seen] Live-count / pending flag for the eight-slot timed-object table
export const loc_117 = 0x0117;
export const OBJECT_VELOCITY_HI = 0x0118;  // [seen] High byte of the 16-bit per-frame velocity added to a far-slot object's position
export const SPAWN_TIMER_RELOAD = 0x0119;  // [seen] Reload period written into a source slot's spawn timer after it fires
export const FLYER_SLOT_TOP = 0x011a;  // [seen] Top index for the free-flight destination-slot scan, clamped 0..3 by difficulty
export const PLAYER_SHAPE_SUM = 0x011b;  // [seen] Running checksum of the 40-byte player-Blaster shape block, used as a draw/age gate
export const ENEMY_SLOT_TOP = 0x011c;  // [seen] Top index / count of the parallel per-slot enemy (climber) arrays
export const loc_11f = 0x011f;
export const OBJECT_VELOCITY_LO = 0x0120;  // [seen] Low byte of the 16-bit per-frame velocity added to a far-slot object's position
export const LEVEL_GEOM_SCALE = 0x0121;  // [seen] Per-level tube geometry scale, the signed delta driving the warp/zoom accumulator
export const ZOOM_ACCUM_HI = 0x0122;  // [seen] High byte of the 24-bit warp/zoom position accumulator ZOOM_ACCUM_HI:PROJ_OFS_X_LO:PROJ_OFS_X_HI
export const SPIKED_SEGMENT_COUNT = 0x0123;  // [seen] Tally of occupied/spiked segments around the tube, also carrying a per-frame bit7 flag
export const RIM_COLOR_ANIM = 0x0124;  // [seen] Rim-lane colour-cycle animation counter, seeded on score award and decremented while drawing
export const WAVE_PHASE_LATCH = 0x0125;  // [seen] Wave/level-intro phase latch: set 0xff when the wave block is ready, gates staged sweeps
export const WAVE_PEAK_SEED = 0x0126;  // [seen] Peak-slot seed used to pick the wave start slot
export const DEPTH_CEILING = 0x0127;  // [seen] Ceiling for the player depth window / wave start-depth index
export const LEVEL_LAYOUT_TRIGGER = 0x0133;  // [seen] One-shot level-layout flag gating the initial colour-RAM clear
export const ACTIVE_OBJECT_COUNT = 0x0135;  // [seen] Live count for the near-rim / projectile object bank (SLOT_STATE / loc_2db slots)
export const VECRAM_TAIL_CURSOR_LO = 0x0139;  // [seen] Low byte of the 16-bit vector-RAM tail write cursor
export const VECRAM_TAIL_CURSOR_HI = 0x013a;  // [seen] High byte of the 16-bit vector-RAM tail write cursor
export const OBJECT_ANIM_PHASE = 0x013b;  // [seen] Animation phase index / priority head flag for the animated top-object
export const OBJECT_ANIM_TIMER = 0x013c;  // [seen] Sub-timer / ready flag paired with the object animation phase
export const SPAWN_DEFICIT_C3 = 0x0140;  // [seen] Column-3 entry of the five-column spawn-deficit table
export const LANE_ENEMY_COUNT_0 = 0x0142;  // [seen] Column-0 entry of the per-column active-enemy counter table (0x142..0x146)
export const LANE_ENEMY_COUNT_1 = 0x0143;  // [seen] Column-1 entry of the per-column active-enemy counter table
export const LANE_ENEMY_COUNT_2 = 0x0144;  // [seen] Column-2 entry of the per-column active-enemy counter table
export const LANE_ENEMY_COUNT_3 = 0x0145;  // [seen] Column-3 entry of the per-column active-enemy counter table
export const LANE_ENEMY_COUNT_4 = 0x0146;  // [seen] Column-4 entry of the per-column active-enemy counter table
export const ENEMY_ANIM_DELTA = 0x0147;  // [seen] Signed per-frame step folded into the enemy animation/oscillator accumulator
export const ENEMY_ANIM_ACCUM = 0x0148;  // [seen] Signed enemy animation/oscillator accumulator driving flip and draw style
export const CANDIDATE_LANE_0 = 0x0149;  // [seen] First entry of the four-entry candidate-lane table used to pick a climber's lane
export const loc_14d = 0x014d;
export const loc_14e = 0x014e;
export const BONUS_LIFE_INTERVAL = 0x0156;  // [seen] DIP-selected bonus-life score interval used as the award threshold
export const NEAR_DEPTH_THRESHOLD = 0x0157;  // [seen] Depth threshold below which an enemy counts as near the rim / reverses direction
export const DSW_BONUS_CONFIG = 0x0158;  // [seen] DIP-decoded bonus/award configuration byte seeding the per-slot award counter
export const ENEMY_FIRE_SELECT = 0x0159;  // [seen] Per-enemy fire/aim selector flag (bit6 chooses the segment-step direction)
export const LANE_FILL_INIT = 0x015a;  // [seen] Initial per-lane fill value written across the sixteen-entry lane table at wave setup
export const INITIAL_ACTIVE_COUNT = 0x015b;  // [seen] Initial active-object/slot count for the wave, copied into FIRE_GATE
export const LIST_PTR_HI = 0x015d;  // [seen] Held high-byte source for the list-setup pointer
export const ENEMY_FIRE_THRESHOLD = 0x015f;  // [seen] POKEY-random threshold that gates whether an enemy fires this frame
export const ENEMY_CLIMB_DELTA_LO_0 = 0x0160;  // [seen] Segment-0 low byte of the per-segment enemy climb-speed delta table (0x160..0x164)
export const ENEMY_CLIMB_DELTA_LO_4 = 0x0164;  // [seen] Segment-4 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_0 = 0x0165;  // [seen] Segment-0 high byte of the per-segment enemy climb-speed delta table (0x165..0x169)
export const ENEMY_CLIMB_DELTA_HI_4 = 0x0169;  // [seen] Segment-4 high byte of the per-segment enemy climb-speed delta table
export const DSW_DIFFICULTY = 0x016a;  // [seen] DIP-decoded difficulty/config byte; its low bits drive the enemy-speed rescale
export const MODE_DELAY_GUARD = 0x016b;  // [seen] Guard/flag holding a pending mode transition through a delay
export const DECIMAL_MODE_FLAG = 0x016c;  // [seen] Flag gating decimal (BCD) score arithmetic and a self-check byte
export const LIST_SELECT_FLAGS = 0x016d;  // [seen] Flags byte OR-folded into a list-setup pointer low byte
export const SCORE_DISPLAY_TIMER = 0x016e;  // [seen] Countdown timer ticked while drawing the score / high-score display
export const EAROM_BLANK_FLAG = 0x01c6;  // [seen] High-score EAROM blank flag: when nonzero the write path zeros each source cell (erase a region)
export const EAROM_REGION_PENDING = 0x01c7;  // [seen] High-score EAROM region-pending bits (one per low bit) awaiting service
export const EAROM_REGION_DIR = 0x01c8;  // [seen] High-score EAROM per-region direction bits: set = write out, clear = read back in
export const PENDING_WORK_FLAGS = 0x01c9;  // [seen] Working flags byte: EAROM per-region checksum-fail result bits and geometry-rebuild request bits
export const EAROM_MODE = 0x01ca;  // [seen] High-score EAROM step-machine mode/busy byte (0x80 write, 0x20 read, 0 idle)
export const EAROM_PASS_COUNTER = 0x01cb;  // [seen] High-score EAROM per-region pass counter
export const EAROM_CURSOR = 0x01cc;  // [seen] High-score EAROM RAM cursor stepping through a region's bytes
export const EAROM_LIMIT = 0x01cd;  // [seen] High-score EAROM region end/limit cursor (checksum position)
export const EAROM_REGION_MASK = 0x01ce;  // [seen] Single-region mask isolated from the pending bits for the current EAROM pass
export const EAROM_CHECKSUM_ACC = 0x01cf;  // [seen] Running checksum accumulator for the EAROM region read/write
export const HIGH_LEVEL_MARKER = 0x01ff;  // [seen] Latched high-level marker copied from the level index when the level is deep enough
export const PLAYER_SEGMENT = 0x0200;  // [seen] Player Blaster rim segment (coarse rotation position / current lane)
export const PLAYER_FINE_ANGLE = 0x0201;  // [seen] Player fine rotation offset with bit7 as the rotation/object-pending flag
export const PLAYER_SHOT_DEPTH = 0x0202;  // [seen] Shared depth position of the player shot down the tube (0x10 rim .. 0xf0 far), a collision reference
export const OBJECT_INDEX_TABLE = 0x0203;  // [seen] Per-entry object index / segment nibble in the 64-entry object-record bank (0x203..0x242)
export const OBJECT_AXIS0_FRAC = 0x0223;  // [guess] Axis-0 position-fraction low byte in the free-flight three-axis object integrator
export const OBJECT_RECORD_TABLE = 0x0243;  // [seen] 64-entry object-record table: per-slot growth/spawn timer, also its kind byte and random tag
export const OBJECT_AXIS1_POS = 0x0263;  // [guess] Axis-1 whole-coordinate byte in the free-flight three-axis object integrator
export const ENEMY_SLOT_FLAGS = 0x0283;  // [seen] Per-enemy-slot state byte: nonzero while alive, low 3 bits = lane/segment kind, bit6 = side, bit7 = live
export const ENEMY_SLOT_DIR = 0x028a;  // [seen] Per-enemy-slot direction/state byte: bit7 = climb direction, bit6 = armed, low bits = kind
export const ENEMY_SCRIPT_CURSOR = 0x0291;  // [seen] per-slot saved motion-script cursor for the climbing-enemy slot
export const loc_298 = 0x0298;
export const ENEMY_DEPTH_LO = 0x029f;  // [seen] low byte of a climbing enemy's 16-bit tube-depth coordinate
export const ENEMY_POS2 = 0x02a3;  // [seen] axis-2 integer coordinate of the free-flight spawn integrator
export const ENEMY_TIMER = 0x02a6;  // [seen] per-slot countdown timer for a climbing enemy
export const TARGET_SEG = 0x02ad;  // [seen] per-slot target segment for the lane-spawn object bank
export const loc_2b5 = 0x02b5;
export const ENEMY_SEGMENT = 0x02b9;  // [seen] target segment/lane number of a climbing enemy
export const ENEMY_VEL1_LO = 0x02c3;  // [seen] axis-1 velocity low byte of the free-flight spawn integrator
export const loc_2c8 = 0x02c8;
export const ENEMY_PHASE = 0x02cc;  // [seen] per-slot phase counter / successor-segment heading
export const SLOT_STATE = 0x02d3;  // [seen] per-slot counter/occupied cell for the lane-spawn bank (0 = free)
export const loc_2db = 0x02db;
export const ENEMY_DEPTH = 0x02df;  // [seen] high byte of an enemy's tube depth; nonzero marks the slot live
export const ENEMY_VEL0_LO = 0x02e3;  // [seen] axis-0 velocity low byte of the free-flight spawn integrator
export const loc_2e6 = 0x02e6;
export const HIT_TALLY = 0x02f2;  // [seen] per-slot active flag (0xff) and hit tally for the lane-spawn bank
export const SHAPE_COORD = 0x02fa;  // [seen] per-slot coordinate for the eight-slot shape draw bank
export const SHAPE_ID = 0x0302;  // [seen] per-slot shape id for the eight-slot shape draw bank
export const ENEMY_VEL2_LO = 0x0303;  // [seen] axis-2 velocity low byte of the free-flight spawn integrator
export const SHAPE_ACTIVE = 0x030a;  // [seen] per-slot active flag for the eight-slot shape draw bank (nonzero = drawn)
export const SHAPE_ANIM = 0x0312;  // [seen] per-slot animation/age byte for the shape draw bank
export const COL_VAL_A = 0x031a;  // [seen] per-column geometry value (plane A) built at level setup
export const ENEMY_VEL1_HI = 0x0323;  // [seen] axis-1 velocity high byte of the free-flight spawn integrator
export const COL_SUB_A = 0x032a;  // [seen] per-column geometry sub/second byte paired with COL_VAL_A
export const COL_VAL_B = 0x033a;  // [seen] per-column geometry value (plane B) built at level setup
export const ENEMY_VEL0_HI = 0x0343;  // [seen] axis-0 velocity high byte of the free-flight spawn integrator
export const COL_SUB_B = 0x034a;  // [seen] per-column geometry sub/second byte paired with COL_VAL_B
export const OBJ_DY_HI = 0x035a;  // [seen] per-object Y-delta high byte
export const ENEMY_VEL2_HI = 0x0363;  // [seen] axis-2 velocity high byte of the free-flight spawn integrator
export const OBJ_DY_LO = 0x036a;  // [seen] per-object Y-delta low byte
export const OBJ_DX_HI = 0x037a;  // [seen] per-object X-delta high byte
export const OBJ_DX_LO = 0x038a;  // [seen] per-object X-delta low byte
export const LANE_TARGET_FLAG = 0x039a;  // [seen] per-lane target flag (0xc0/0x80 marks a flagged lane)
export const SWEEP_STAGE = 0x03aa;  // [seen] stage/phase index for the sweep handler
export const FIRE_GATE = 0x03ab;  // [seen] global gate that enables enemy fire
export const LANE_LIMIT = 0x03ac;  // [seen] per-lane limit/threshold used by the hit/award scan
export const loc_3bc = 0x03bc;
export const SEG_BASE_X = 0x03ce;  // [seen] per-segment base X coordinate of the tube geometry
export const SEG_BASE_Y = 0x03de;  // [seen] per-segment base Y coordinate of the tube geometry
export const SEG_DIRECTION = 0x03ee;  // [seen] per-segment ring-direction table
export const loc_3fe = 0x03fe;
export const loc_405 = 0x0405;
export const TIMER2_LO = 0x0409;  // [seen] low byte of a second software timer cascade
export const TIMER2_MID = 0x040a;  // [seen] middle byte of the second software timer cascade
export const TIMER2_HI = 0x040b;  // [seen] high byte of the second software timer cascade
export const COORD_ACC_LO = 0x040c;  // [seen] low byte of a 16-bit coordinate accumulator
export const COORD_ACC_HI = 0x040d;  // [seen] high byte of the 16-bit coordinate accumulator
export const DIGIT_IN_LO = 0x040f;  // [seen] low byte of the digit builder's first input pair
export const DIGIT_IN_HI = 0x0410;  // [seen] high byte of the digit builder's first input pair
export const DIV_QUOTIENT = 0x0412;  // [seen] quotient cell seeded by the digit builder's divide
export const DIV_REMAINDER = 0x0413;  // [seen] remainder cell seeded by the digit builder's divide
export const loc_414 = 0x0414;
export const POINTER_PARITY = 0x0415;  // [seen] per-slot parity flag toggled to double-buffer pointer records
export const LANE_FLAGS = 0x0425;  // [seen] sixteen-entry rim-lane flag/color block
export const SEG_MID_X = 0x0435;  // [seen] per-segment midpoint X (average of adjacent segment bases)
export const SEG_MID_Y = 0x0445;  // [seen] per-segment midpoint Y (average of adjacent segment bases)
export const loc_455 = 0x0455;
export const SORT_PAYLOAD_LO = 0x051e;  // [code] low byte of a per-row payload reordered by the buildSortedSoundRequest bubble sort
export const SORT_PAYLOAD_MID = 0x051f;  // [code] middle byte of the per-row payload reordered by the sort
export const SORT_PAYLOAD_HI = 0x0520;  // [code] high byte of the per-row payload reordered by the sort
export const SLOT_METRIC = 0x0600;  // [seen] per-channel/slot count array
export const loc_601 = 0x0601;
export const ACTIVE_SLOT = 0x0602;  // [seen] current active-slot cursor for the arming driver
export const REQUEST_BITS = 0x0603;  // [seen] packed request word, two bits per slot, drained by the arming driver
export const REARM_COUNTER = 0x0604;  // [seen] step counter that re-arms the driver when it underflows
export const PASS_COUNTER = 0x0605;  // [seen] sort-pass counter / arming countdown
export const SLOT_VALUE = 0x0606;  // [seen] per-slot value block clamped to the 0x1a rail
export const loc_61b = 0x061b;
export const SORT_KEY_LO = 0x061e;  // [code] low byte of the per-row sort key
export const SORT_KEY_MID = 0x061f;  // [code] middle byte of the per-row sort key
export const SORT_KEY_HI = 0x0620;  // [code] high byte of the per-row sort key
export const GLYPH_PARAM_X = 0x0706;  // [seen] per-slot glyph draw parameter (plane X)
export const GLYPH_PARAM_Y = 0x0707;  // [seen] per-slot glyph draw parameter (plane Y)
export const GLYPH_PARAM_Z = 0x0708;  // [seen] per-slot glyph draw parameter (plane Z)
export const loc_71b = 0x071b;
export const loc_71c = 0x071c;
export const loc_71d = 0x071d;
export const INPUT_SNAPSHOT_HI = 0x071e;  // [seen] change-detection latch of (DSW2_SNAPSHOT & 0xf8)
export const INPUT_SNAPSHOT_LO = 0x071f;  // [seen] change-detection latch of (DSW_DIFFICULTY & 0x03)
export const loc_720 = 0x0720;
export const COLOR_RAM = 0x0800;  // [seen] base of the 16-entry color RAM (0x0800-0x080F, write-only)
export const COLOR_RAM_8 = 0x0808;  // [seen] color RAM entry 0x08, latched from a level-dependent palette byte
export const COLOR_RAM_9 = 0x0809;  // [seen] color RAM entry 0x09
export const COLOR_RAM_A = 0x080a;  // [seen] color RAM entry 0x0A
export const COLOR_RAM_B = 0x080b;  // [seen] color RAM entry 0x0B
export const IN0_PORT = 0x0c00;  // [seen] IN0 hardware input port (coin/tilt/self-test/diag/AVG-done/3kHz)
export const DSW1_COINAGE = 0x0d00;  // [seen] coinage DIP-switch input port
export const DSW2_OPTIONS = 0x0e00;  // [seen] lives/bonus/language DIP-switch input port
export const VEC_LIST_HEADER_LO = 0x2000;  // [seen] low byte of the AVG display-list header word at vector-RAM start
export const VEC_LIST_HEADER_HI = 0x2001;  // [seen] high byte of the AVG display-list header word
export const VEC_GLYPH_BUFFER = 0x2f60;  // [seen] vector-RAM buffer where per-frame glyph/stroke words are assembled
export const VEC_SNAPSHOT_MIRROR_A = 0x2fa6;  // [seen] vector-RAM cell mirroring the snapshot byte
export const VEC_SNAPSHOT_MIRROR_B = 0x2fa8;  // [seen] second vector-RAM cell mirroring the snapshot byte
export const VEC_LIST_JMP_LO = 0x2ffc;  // [seen] low byte of the display-list tail jump vector
export const VEC_LIST_JMP_HI = 0x2ffd;  // [seen] high byte of the display-list tail jump (|0x70 AVG JMPL opcode)
export const VEC_LIST_HALT = 0x2fff;  // [seen] display-list terminator byte (0xc0 AVG halt)
export const NIBBLE_GLYPH_TABLE = 0x31e4;  // [seen] vector-ROM stroke-word table indexed by nibble (digit/hex glyphs)
export const NIBBLE_GLYPH_TABLE_HI = 0x31e5;  // [seen] high-byte companion of the nibble glyph-word table
export const CHAR_GLYPH_TABLE = 0x31fa;  // [seen] vector-ROM glyph-word table indexed by character code
export const BAR_GLYPH_LOW = 0x3284;  // [seen] vector-ROM glyph byte used when row <= threshold
export const BAR_GLYPH_HIGH = 0x3286;  // [seen] vector-ROM glyph byte used when row > threshold
export const BLANK_SLOT_VEC_LO = 0x3db2;  // [seen] low byte of the blank vector word for an inactive enemy slot
export const BLANK_SLOT_VEC_HI = 0x3db3;  // [seen] high byte of the blank vector word for an inactive enemy slot
export const COIN_FLIP_LATCH = 0x4000;  // [seen] coin-counter + AVG flip_x/flip_y control output latch
export const AVG_RESET_STROBE = 0x5800;  // [seen] AVG reset strobe
export const EAROM_DATA = 0x6000;  // [seen] EAROM data window (cursor-indexed) for NVRAM settings/high-scores
export const MATHBOX_STATUS = 0x6040;  // [seen] math-box busy status read (bit7=busy) / EAROM control on write
export const EAROM_READ = 0x6050;  // [seen] EAROM read-back port
export const MATHBOX_RESULT_LO = 0x6060;  // [seen] math-box 16-bit result low byte
export const MATHBOX_RESULT_HI = 0x6070;  // [seen] math-box 16-bit result high byte
export const MATHBOX_LD_R0_LO = 0x6080;  // [seen] math-box port: load R0 low byte (go_w opcode 0x00)
export const MATHBOX_LD_R0_HI = 0x6081;  // [seen] math-box port: load R0 high byte (opcode 0x01)
export const MATHBOX_LD_R1_HI = 0x6083;  // [seen] math-box port: load R1 high byte (opcode 0x03)
export const MATHBOX_LD_R2_LO = 0x6084;  // [seen] math-box port: load R2 low byte (opcode 0x04)
export const MATHBOX_LD_R2_HI = 0x6085;  // [seen] math-box port: load R2 high byte (opcode 0x05)
export const MATHBOX_LD_R3_LO = 0x6086;  // [seen] math-box port: load R3 low byte (opcode 0x06)
export const MATHBOX_LD_R3_HI = 0x6087;  // [seen] math-box port: load R3 high byte (opcode 0x07)
export const MATHBOX_LD_R4_HI = 0x6089;  // [seen] math-box port: load R4 high byte (opcode 0x09)
export const MATHBOX_LD_R6_COUNT = 0x608c;  // [seen] math-box port: load R6 whole (divide/loop step count, opcode 0x0c)
export const MATHBOX_LD_RA_LO = 0x608d;  // [seen] math-box port: load Ra low byte (opcode 0x0d)
export const MATHBOX_LD_RA_HI = 0x608e;  // [seen] math-box port: load Ra high byte / operand (opcode 0x0e)
export const MATHBOX_LD_RB_LO = 0x608f;  // [seen] math-box port: load Rb low byte / operand (opcode 0x0f)
export const MATHBOX_LD_RB_HI = 0x6090;  // [seen] math-box port: load Rb high byte (opcode 0x10)
export const MATHBOX_DIVIDE = 0x6094;  // [seen] math-box compute trigger: divide {Rb:Ra}/R7 (opcode 0x14)
export const MATHBOX_LD_R7_LO = 0x6095;  // [seen] math-box port: load R7 low byte (divisor / delta low, opcode 0x15)
export const MATHBOX_LD_R7_HI = 0x6096;  // [seen] math-box port: load R7 high byte (divisor / delta high, opcode 0x16)
export const POKEY1_AUDF1 = 0x60c0;  // [seen] POKEY1 audio-frequency register voice 1 (write) / pot0 (read)
export const POKEY1_AUDC1 = 0x60c1;  // [seen] POKEY1 audio-control register voice 1
export const POKEY1_AUDF2 = 0x60c2;  // [seen] POKEY1 audio-frequency register voice 2
export const POKEY1_AUDC2 = 0x60c3;  // [seen] POKEY1 audio-control register voice 2
export const POKEY1_AUDCTL = 0x60c8;  // [seen] POKEY1 control register (write) / ALLPOT option switches (read)
export const POKEY1_RANDOM = 0x60ca;  // [seen] POKEY1 random-number register (primary RNG source)
export const POKEY1_POTGO = 0x60cb;  // [seen] POKEY1 pot-scan-start register (offset 0x0b)
export const POKEY1_SKCTL = 0x60cf;  // [seen] POKEY1 serial/control (SKCTL) register
export const POKEY2_AUDF1 = 0x60d0;  // [seen] POKEY2 audio-frequency register voice 1 base (write) / pot0 (read)
export const POKEY2_AUDC1 = 0x60d1;  // [seen] POKEY2 audio-control register voice 1
export const POKEY2_AUDCTL = 0x60d8;  // [seen] POKEY2 control register (write) / ALLPOT (read)
export const POKEY2_RANDOM = 0x60da;  // [seen] POKEY2 random-number register (secondary RNG source)
export const POKEY2_POTGO = 0x60db;  // [seen] POKEY2 pot-scan pulse register (offset 0x0b, discarded by the board)
export const POKEY2_SKCTL = 0x60df;  // [seen] POKEY2 serial/control (SKCTL) register
export const LED_FLIP_LATCH = 0x60e0;  // [seen] player-LED + screen-flip output latch
export const POINTER_TABLE_LO = 0x91c6;  // [seen] low-byte half of an in-page pointer lookup table
export const POINTER_TABLE_HI = 0x91c7;  // [seen] high-byte half of an in-page pointer lookup table
export const SLOT_THRESHOLD_TABLE = 0x91fe;  // [seen] ROM threshold table scanned downward to pick a start slot
export const LIST_PTR_TABLE_HI = 0x9afd;  // [seen] high-byte table of ROM list pointers
export const LIST_PTR_TABLE_LO = 0x9b02;  // [seen] low-byte table of ROM list pointers
export const LIST_PTR_TABLE_LO1 = 0x9b03;  // [seen] entry 1 of the list-pointer low-byte table
export const MOTION_SCRIPT_TABLE = 0xa0f7;  // [seen] object motion-script byte table
export const MOTION_SCRIPT_GOTO = 0xa0f8;  // [seen] motion-script table read at cursor+1 for the goto/state-step target
export const SPAWN_RATE_TABLE = 0xa304;  // [seen] per-source spawn-probability threshold compared against a POKEY random draw
export const TIMED_OBJ_LIMIT_TABLE = 0xa448;  // [seen] per-type counter limit for timed-object slots
export const TIMED_OBJ_STEP_TABLE = 0xa44e;  // [seen] per-type counter increment step for timed-object slots
export const VELOCITY_DECAY_STEP = 0xa788;  // [seen] fixed increment applied per velocity-decay step
export const DRAW_SLOT_TABLE = 0xa8b0;  // [seen] 4-entry ROM table of object-slot ids selected by DSW1_SNAPSHOT & 0x03
export const GLYPH_PTR_TABLE = 0xa97d;  // [seen] ROM table seeding the glyph pointer, indexed by y
export const SELFCHECK_XOR_BYTES = 0xaace;  // [seen] 11 ROM bytes XOR-folded into the self-check byte
export const OVERLAY_VEC_WORD_B = 0xaaf3;  // [seen] byte of the base-overlay final coordinate word
export const OVERLAY_VEC_WORD_A = 0xaaf4;  // [seen] byte of the base-overlay final coordinate word
export const TEXT_BUFFER_TEMPLATE = 0xac08;  // [seen] ROM template block copied into the text buffer SLOT_VALUE
export const COUNT_GLYPH_COORD_TABLE = 0xaf6f;  // [seen] ROM table of coordinate bytes for the counter digit draw
export const WELL_SEGMENT_COORD_TABLE = 0xb096;  // [seen] ROM table of rim-segment coordinate bytes for the well draw
export const RIM_SEGMENT_ARG_TABLE = 0xb09b;  // [seen] ROM table of per-rim-segment draw args (8 segments)
export const WELL_VERTEX_TABLE = 0xb0a3;  // [seen] ROM table of well-draw vertex bytes read in i / i+1 pairs
export const RIM_LANE_SLOT_TABLE_A = 0xb476;  // [seen] ROM lane-slot id table for the rim-lane paint
export const RIM_LANE_SLOT_TABLE_B = 0xb487;  // [seen] second ROM lane-slot id table for the rim-lane paint
export const SEG_SHAPE_BY_STYLE = 0xb60b;  // [seen] Per-style segment-shape selector byte read into the tube-rim segment builder
export const JUMP_MODE_SHAPE = 0xb61e;  // [seen] Shape byte chosen by a slot's two-bit jump/mode field for the enemy emitter
export const VERTEX_Y_OFS_BY_PHASE = 0xb687;  // [seen] Per-phase signed Y offset added to a slot's base vertex Y when building its screen point
export const VERTEX_X_OFS_BY_PHASE = 0xb68b;  // [seen] Per-phase signed X offset added to a slot's base vertex X when building its screen point
export const SEG_STYLE_TABLE = 0xb755;  // [seen] Segment-style byte selected by a windowed ENEMY_ANIM_ACCUM value for the rim-segment builder
export const ENEMY_SHAPE_BASE = 0xb7e5;  // [seen] Per-shape base offset added to a computed table index when drawing an enemy shape record
export const ANIM_PHASE_DURATION = 0xb82a;  // [seen] Per-phase frame-count reload for the animated shape sub-timer
export const ANIM_PHASE_CODE = 0xb83d;  // [seen] Per-phase code byte gating the animated-shape phase handler
export const LANE_VERTEX_X = 0xb97c;  // [seen] ROM per-lane tube vertex X-coordinate table copied into the working lane table SEG_BASE_X
export const LANE_VERTEX_Y = 0xba7c;  // [seen] ROM per-lane tube vertex Y-coordinate table copied into the working lane table SEG_BASE_Y
export const LANE_RING_DIR = 0xbb7c;  // [seen] ROM per-lane ring/heading seed table copied into the working table SEG_DIRECTION
export const SHAPE_INDEX_TABLE = 0xbc7c;  // [seen] ROM table mapping a byte's low-nibble remainder to the level shape/geometry index
export const LEVEL_TUBE_DEPTH = 0xbc8c;  // [seen] Per-shape ROM level parameter seeding the tube depth/span cells
export const LEVEL_PARAM_LOC60 = 0xbc9c;  // [seen] Per-shape ROM level parameter loaded into geometry cell PROJ_X_REF
export const LEVEL_OFFSET_LO = 0xbcac;  // [seen] Per-shape ROM level offset-pair low byte (into PROJ_OFS_X_LO)
export const LEVEL_OFFSET_HI = 0xbcbc;  // [seen] Per-shape ROM level offset-pair high byte (into PROJ_OFS_X_HI)
export const LEVEL_GATE_FLAG = 0xbccc;  // [seen] Per-shape ROM level flag seeding the level gate cell TUBE_GEOM_FLAG
export const STYLE_TABLE_59 = 0xbcdc;  // [seen] Per-shape style byte loaded into the draw style cell CLAMP_TALLY
export const STYLE_TABLE_5A = 0xbcec;  // [seen] Per-shape style byte loaded into the draw style cell RUN_SIZE
export const SEG_RECORD_COUNT = 0xbfb6;  // [seen] Per-corner count of four-byte vector records emitted for a rim segment
export const SEG_PACK_CURSOR = 0xbfc4;  // [seen] Per-corner starting cursor into the packed segment tables
export const SEG_PACKED_BYTE = 0xbfd2;  // [seen] Packed corner byte (encoding yLo/xHi offsets) for each rim-segment record
export const SEG_HEADER_BYTE = 0xbfd3;  // [seen] Header byte for each emitted rim-segment vector record (1 remapped to 0xc0)
export const LEVEL_LAYOUT_PACKED = 0xc1fd;  // [seen] Packed ROM level-layout table unpacked into the working nibble tables and their display mirrors
export const OUTLINE_HEADER = 0xc22d;  // [seen] ROM header word emitted at the start of a level outline draw
export const ENEMY_LIST_HEADER = 0xc669;  // [seen] Fixed four-byte header copied ahead of every per-slot enemy display-list record
export const SCORE_VALUE_LO = 0xcaf1;  // [seen] Per-type BCD score-award low byte added into the score triplet
export const SCORE_VALUE_HI = 0xcaf9;  // [seen] Per-type BCD score-award high byte added into the score triplet
export const SOUND_VOICE_TABLE = 0xcb01;  // [seen] Sound-definition table: one row per sound id giving a value byte for each of the sixteen voice slots
export const VOICE_ENV_FRAME_A = 0xcbcb;  // [seen] Voice envelope frame-walk table (low-bit path) stepped until a non-zero frame
export const VOICE_ENV_FASTTIMER = 0xcbcc;  // [seen] Voice envelope fast-timer reload value (low-bit path)
export const VOICE_ENV_LEVEL = 0xcbcd;  // [seen] Voice envelope level/output byte folded into the slot POKEY level (low-bit path)
export const VOICE_ENV_FRAME_B = 0xcbce;  // [seen] Voice envelope frame-walk companion table (low-bit path)
export const VOICE_ENV_FRAME_A_HI = 0xcccb;  // [code] Voice envelope frame-walk table for the high-bit frame path
export const VOICE_ENV_FASTTIMER_HI = 0xcccc;  // [code] Voice envelope fast-timer reload for the high-bit frame path
export const VOICE_ENV_LEVEL_HI = 0xcccd;  // [code] Voice envelope level/output byte for the high-bit frame path
export const VOICE_ENV_FRAME_B_HI = 0xccce;  // [code] Voice envelope frame-walk companion table for the high-bit frame path
export const MARKERROW_HEAD_OFS = 0xcdde;  // [seen] Per-row buffer offset for a marker-row's header byte in the text vector buffer
export const MARKERROW_GLYPH_OFS = 0xcde0;  // [seen] Per-row buffer offset for a marker-row's glyph entries in the text vector buffer
export const MARKERROW_PTR_OFS = 0xcde2;  // [seen] Per-row buffer offset seeding the glyph-pointer hand-off for a marker row
export const GLYPH_LIST_BUF_OFS = 0xcde4;  // [seen] Fixed vector-buffer start offset for the overlay glyph run
export const MIRROR_COPY_BUF_OFS = 0xcde5;  // [seen] Fixed vector-buffer start offset for the three-entry mirror copy
export const VECTOR_TEMPLATE_BLOCK = 0xcde6;  // [seen] ROM template block of vector-record bytes copied verbatim into vector RAM page 0x2f
export const TEMPLATE_COPY_LEN = 0xce66;  // [seen] Copy-length selector (indexed by a flag) for the vector template block copy
export const DRAW_PTR_TABLE_A = 0xce68;  // [seen] Interleaved 16-bit draw-layer pointer table (primary) into vector-RAM structures
export const ALT_DRAW_PTR_SET_LO = 0xce6e;  // [seen] Alternate draw pointer low byte selected when the layer flag is non-zero
export const ALT_DRAW_PTR_SET_HI = 0xce6f;  // [seen] Alternate draw pointer high byte selected when the layer flag is non-zero
export const DRAW_PTR_TABLE_B = 0xce7a;  // [seen] Interleaved 16-bit draw-layer pointer table (alternate) into vector-RAM structures
export const ALT_DRAW_PTR_CLR_LO = 0xce86;  // [seen] Alternate draw pointer low byte selected when the layer flag is zero
export const ALT_DRAW_PTR_CLR_HI = 0xce87;  // [seen] Alternate draw pointer high byte selected when the layer flag is zero
export const DRAW_BASE_PTR_LO = 0xce8c;  // [seen] Per-slot base draw-pointer low byte seated before the parity-selected write
export const DRAW_BASE_PTR_HI = 0xce8d;  // [seen] Per-slot base draw-pointer high byte seated before the parity-selected write
export const DRAW_PTR_EVEN_LO = 0xce9e;  // [seen] Draw-list pointer word low byte written on the parity-clear (even) pass
export const DRAW_PTR_EVEN_HI = 0xce9f;  // [seen] Draw-list pointer word high byte written on the parity-clear (even) pass
export const DRAW_PTR_ODD_LO = 0xceb0;  // [seen] Draw-list pointer word low byte written on the parity-set (odd) pass
export const DRAW_PTR_ODD_HI = 0xceb1;  // [seen] Draw-list pointer word high byte written on the parity-set (odd) pass
export const VECHEAD0_FRAME = 0xcec2;  // [seen] First display-list head word constant latched at vector RAM 0x2000 by the frame builder
export const VECHEAD1_FRAME = 0xcec3;  // [seen] Second display-list head word constant latched at vector RAM 0x2001 by the frame builder
export const VECHEAD0_PLAY = 0xcec4;  // [seen] First display-list head word constant latched at 0x2000 on the play/dispatch path (and the mid-frame change checkpoint source)
export const VECHEAD0_LEVEL = 0xcec6;  // [seen] First display-list head word constant latched at 0x2000 by the level-layout builder (and the settled-frame checkpoint)
export const VECHEAD1_LEVEL = 0xcec7;  // [seen] Second display-list head word constant latched at 0x2001 by the level-layout builder
export const OBJ_TEMPLATE_WORD_LO = 0xcec8;  // [seen] Object/enemy vector template-word low-byte table indexed to pick an entry glyph word
export const OBJ_TEMPLATE_WORD_HI = 0xcec9;  // [seen] Object/enemy vector template-word high-byte table paired with OBJ_TEMPLATE_WORD_LO
export const ACCUM_REDUCE_TABLE = 0xcfd9;  // [seen] Reduction-amount lookup subtracted from the high accumulator during the lane sweep
export const SCALE_KEY_TABLE = 0xd121;  // [seen] ROM scale-key byte split into two scale factors for the record draw
export const HEADER_COLOR_SEED = 0xd122;  // [seen] Per-index ROM header/colour seed byte loaded into the record's header cell
export const VECLIST_CKSUM_SRC = 0xd575;  // [seen] 17-byte ROM table folded into the checksum byte that gates the vector end-of-list
export const DIP_CONFIG_A = 0xd6b3;  // [seen] DIP-decoded configuration byte (into loc_ac) selected by a two-bit option-switch field
export const DIP_CONFIG_B = 0xd6b4;  // [seen] DIP-decoded configuration byte (into loc_ad) selected by a two-bit option-switch field
export const DIP_BONUS_INTERVAL = 0xd6f7;  // [seen] DIP-decoded bonus/award threshold value (into BONUS_LIFE_INTERVAL) selected by DSW bits 5-3
export const DIP_PARAM_158 = 0xd6ff;  // [seen] DIP-decoded configuration value loaded into DSW_BONUS_CONFIG, selected by DSW bits 7-6
export const ATTRACT_SND_SLOTA = 0xdbd5;  // [seen] Attract/idle POKEY sequencer table selecting the slot to clear each phase
export const ATTRACT_SND_SLOTB = 0xdbd6;  // [seen] Attract/idle POKEY sequencer table selecting the slot to write each phase
export const POTMARK_WORD_INDEX = 0xdce1;  // [seen] Coordinate-word table index selected per pot-readout slot in the spinner/pot draw
export const EAROM_REGION_START = 0xdddd;  // [seen] Per-region starting cursor for an EAROM read/write pass
export const EAROM_REGION_LIMIT = 0xddde;  // [seen] Per-region ending limit for an EAROM read/write pass
export const EAROM_REGION_PTR_LO = 0xdde3;  // [seen] Per-region low byte of the zero-page pointer to the EAROM region's RAM copy
export const EAROM_REGION_PTR_HI = 0xdde4;  // [seen] Per-region high byte of the zero-page pointer to the EAROM region's RAM copy
export const ATTRACT_SND_VALUE = 0xdfdc;  // [seen] Attract/idle POKEY sequencer table giving the value byte written to the sound register
export const COLOR_PAIR_LO = 0xdfe4;  // [seen] Colour-pair low byte selected by SPINNER_ACCUM for the final colour-pair emit
export const COLOR_PAIR_HI = 0xdfe8;  // [seen] Colour-pair high byte selected by SPINNER_ACCUM for the final colour-pair emit

export const INPUT_CUR = 0x4c;  // [seen] Current-frame raw coin/switch input sample used for edge detection
export const INPUT_PREV = 0x004f;  // [seen] Previous-frame held-input snapshot used to detect rising edges
export const HIT_DISTANCE_THRESHOLD = 0xa7;  // [seen] proximity threshold for a near-slot collision test
export const loc_b3 = 0xb3;
export const COLUMN_SPAWN_CAP = 0x0129;  // [seen] Per-column maximum enemy count (5-entry table 0x129..0x12d) used to cap spawning
export const COLUMN_ENEMY_TARGET = 0x012e;  // [seen] Per-column target enemy count (base of a 5-entry table), source of the spawn deficit
export const SPAWN_DEFICIT_C0 = 0x013d;  // [seen] Column-0 entry of the five-column spawn-deficit table (0x13d..0x141)
export const SPAWN_DEFICIT_C2 = 0x013f;  // [seen] Column-2 entry of the five-column spawn-deficit table
export const CANDIDATE_LANE_1 = 0x014a;  // [seen] Second entry of the four-entry candidate-lane table
export const SPIKE_LANE_MASK_ACC = 0x014f;  // [seen] Working bit-mask accumulator of lanes with a mid-growth spike during the timer scan
export const SPIKE_LANE_MASK_OUT = 0x0150;  // [seen] Published copy of the spike-lane occupancy bit-mask after the timer scan
export const ENEMY_BAND_THRESHOLD_0 = 0x0151;  // [seen] Band-0 entry of the far-slot proximity/retire threshold table (0x151..0x155)
export const ENEMY_BAND_THRESHOLD_1 = 0x0152;  // [seen] Band-1 entry of the far-slot proximity/retire threshold table
export const ENEMY_BAND_THRESHOLD_2 = 0x0153;  // [seen] Band-2 entry of the far-slot proximity/retire threshold table
export const ENEMY_BAND_THRESHOLD_3 = 0x0154;  // [seen] Band-3 entry of the far-slot proximity/retire threshold table
export const ENEMY_BAND_THRESHOLD_4 = 0x0155;  // [seen] Band-4 entry of the far-slot proximity/retire threshold table
export const COORD_DISPATCH_SEL = 0x015e;  // [seen] Even selector byte halved to dispatch a coordinate/step helper
export const ENEMY_CLIMB_DELTA_LO_1 = 0x0161;  // [seen] Segment-1 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_LO_2 = 0x0162;  // [seen] Segment-2 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_LO_3 = 0x0163;  // [seen] Segment-3 low byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_1 = 0x0166;  // [seen] Segment-1 high byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_2 = 0x0167;  // [seen] Segment-2 high byte of the per-segment enemy climb-speed delta table
export const ENEMY_CLIMB_DELTA_HI_3 = 0x0168;  // [seen] Segment-3 high byte of the per-segment enemy climb-speed delta table
export const OBJECT_BAND = 0x027f;  // [code] Per-object attribute folded to a 3-bit band selecting the proximity/retire threshold
export const loc_2c0 = 0x02c0;
export const VEC_COORD1_LO = 0x3f16;  // [seen] low-byte vector-ROM coordinate-word table (draw set 1)
export const VEC_COORD1_HI = 0x3f17;  // [seen] high-byte vector-ROM coordinate-word table (draw set 1)
export const VEC_COORD2_LO = 0x3f1e;  // [seen] low-byte vector-ROM coordinate-word table (draw set 2)
export const VEC_COORD2_HI = 0x3f1f;  // [seen] high-byte vector-ROM coordinate-word table (draw set 2)
export const TIMER1_LO = 0x0406;  // [seen] low byte of a software timer cascade ticked by the periodic interrupt
export const TIMER1_MID = 0x0407;  // [seen] middle byte of the first software timer cascade
export const TIMER1_HI = 0x0408;  // [seen] high byte of the first software timer cascade
export const AVG_GO_STROBE = 0x4800;  // [seen] AVG start (go) strobe
export const WATCHDOG_CLEAR = 0x5000;  // [seen] watchdog-clear + IRQ-acknowledge strobe
export const POKEY1_AUDF3 = 0x60c4;  // [seen] POKEY1 audio-frequency register voice 3
export const POKEY1_AUDC3 = 0x60c5;  // [seen] POKEY1 audio-control register voice 3
export const STATE_RESEED_RECORD_TABLE = 0x9604;  // [seen] 4-byte-record ROM table of src/dst pointers for the state re-seed copy
export const DISPATCH_PTR_LO_TABLE = 0x969d;  // [seen] low-pointer-byte table for a computed-jump handler dispatch
export const LANE_SCORE_INDEX_TABLE = 0xa3c5;  // [seen] ROM table mapping a lane to its score-award index
export const ATTRACT_TIMER_LIMIT_TABLE = 0xa883;  // [seen] per-stage attract-timer limit indexed by SWEEP_STAGE
export const SLOT_BIT_MASK = 0xca38;  // [seen] Bit-mask lookup keyed by a slot's 4-bit tag, folded into the per-slot presence mask
export const VECHEAD1_PLAY = 0xcec5;  // [seen] Second display-list head word constant latched at 0x2001 on the play/dispatch path
export const IRQ_STATE_CODE = 0xd7dd;  // [seen] Interrupt-handler state-code dispatch table selected by the current game phase
export const DIAG_MASK_TABLE = 0xd8b6;  // [seen] Mask table AND-compared against a status cell in the diagnostic/service draw
export const DIAG_VALUE_LO = 0xd8ba;  // [seen] Diagnostic-display value selected by the low DSW nibble of DSW1_SNAPSHOT
export const DIAG_VALUE_HI = 0xd8c2;  // [seen] Diagnostic-display value selected by the high bits of DSW1_SNAPSHOT
export const SELFTEST_COLOR_TABLE = 0xdaf9;  // [seen] Eight-byte ROM colour table copied into colour RAM during the self-test session

export const ROUTINES = {
  0x9677: { name: "dispatchRangeValueBySelector", role: "[seen] resolve the range-bracketed list value: read the even selector byte 0x15e, halve it, and tail-call the matching 0x96xx coordinate helper (loc_96c4/96b7/96ab/96e2/96db/9700), returning its byte to loc_92c5's table walk.", cert: "seen" },
  0x9683: { name: "dispatchCursorAdvanceBySelector", role: "[seen] advance the source-list cursor: use selector 0x15e to pick a cursor-advance helper (advanceListCursorByTwo/96cb/96c7) and tail-call it, pre-seating A to the selected pointer's low byte for the Y-only handlers.", cert: "seen" },
  0x9a87: { name: "dispatchListSetupByColumn", role: "[seen] route to the list-setup entry for column X: copy X into the dispatch index and enter the computed jump dispatchCoordListSetup, tail-returning the selected entry's result to placeSpawnListForColumnDeficit.", cert: "seen" },
  0xa309: { name: "spawnLaneEnemyAndAward", role: "[code] spawn the lane enemy in slot X and award: mark slot active (0x2f2,x=0xff), seed 0x2d from the (Y-4)-indexed geometry byte 0x2b9, clamp POKEY random 0x60da low 3 bits to under 3 (else 0), run the insert/retire chain insertObjectFromSlotDepth+retireEnemyAndSpawnSplit with clamp+2, then award via addBcdScoreAndAwardAtThreshold indexed by clamp+5.", cert: "code" },
  0xa398: { name: "respawnEnemyAndAward", role: "[seen] retire enemy slot Y and spawn its replacement, then award: seed 0x2d from 0x2b9,y (decremented into the low nibble when descriptor 0x283,y has both top bits set), run insertObjectFromSlotDepth+retireEnemyAndSpawnSplit, then tail-delegate a score award (addBcdScoreAndAwardAtThreshold) selected by the re-read slot's lane through the loc_a3c5 table.", cert: "seen" },
  0xda62: { name: "runSelfTestLoop", role: "[code] run the self-test session: seed the state machine (armEaromReadback), forward a pending request (queueEaromEraseAllRegions), copy the 8-byte colour table loc_daf9 into colour RAM at 0x800, idle coin/flip 0x4000; then each pass strobe watchdog 0x5000/display-reset 0x5800, sample option switches 0x60c8 and diagnostics 0xc00, build/show a frame via dispatchDrawHandler/emitHeaderedBodyRecord, call stepEaromTransfer every fourth frame, until the self-test switch (0xc00 bit4) is released.", cert: "seen" },
  0xd93f: { name: "bootMachineFromReset", role: "[seen] power-on RESET entry (a generator): wipe the two mapped RAM windows (2KB from 0x00, 4KB from 0x2000), seed the control block (0x1=0, 0x60e0=0, 0x60cf=7, 0x60df=7, and the 0x60c0/0x60d0 runs zeroed), then fork on self-test switch 0xc00 bit4 -- released seeds 0xb4=0x10, runs the device-init chain and becomes the main loop; held spins the operator diagnostic.", cert: "seen" },
  0x92c5: { name: "reseedStateTables", role: "[seen] re-seed game state: build search key loc_2b from loc_9f (or a POKEY-random masked value via loc_60da when >=98, then +1), walk the 4-byte record table at loc_9604 from record 111 down to 3 loading source ptr loc_2c/loc_2d and dest ptr loc_3b/loc_3c per record, scan each source list (via dispatchRangeValueBySelector/dispatchCursorAdvanceBySelector) for the range bracketing the key and store the resolved byte through the dest ptr, rescale loc_160/loc_15b per loc_16a&3, fold loc_163/loc_120/loc_160 through partitionByteToFineCoarseSeed, then seed many loc_01xx cells plus loc_155/loc_161/loc_166/loc_149/loc_14a.", cert: "seen" },
  0x99a5: { name: "placeSpawnListForColumnDeficit", role: "[seen] top up per-column enemy quotas: build the five-column deficit table 0x13d[0..4] from 0x12e minus 0x142 (clamped >=0), deduct 2 per active lane (0x2df set, 0x28a&3 nonzero, lane3->col5), cap each at (0x11c+1)-sum(0x142), seed 0x61, then per nonzero-column count invoke the list-setup dispatcher (dispatchListSetupByColumn) to place a spawn list; every exhausted path clears the request flag 0x29.", cert: "seen" },
  0xa38e: { name: "activateSlotAndRespawn", role: "[seen] activate enemy slot X (0x2f2,x=0xff), step the lane index back by four, then tail-delegate the retire/spawn/award for that stepped-back slot to respawnEnemyAndAward.", cert: "seen" },
  0xa888: { name: "sweepLaneSlotsForRespawn", role: "[code] on the timed phase (phase cell 0x125 >= 3 and even) sweep 0x2df,y downward from y=0x11c for the first nonzero slot: on a hit clear the low two bits of 0x28a,y and tail-delegate to respawnEnemyAndAward, on no hit reset 0x125 to 0.", cert: "seen" },
  0xda0a: { name: "checksumRomAndSettleEntropy", role: "[code] power-on ROM checksum + entropy settle: walk 12 banks of 8 pages, XOR every byte into a per-bank checksum seeded with the bank index (strobing watchdog 0x5000 per page), land the 12 checksums from 0x7d; if bank 0's checksum is nonzero arm the error tone (0x60c4/0x60c5); then settle each entropy register (0x60ca->0x7a, 0x60da->0x7b) storing only when six re-reads match, and continue into runSelfTestLoop.", cert: "seen" },
  0x9009: { name: "runWaveInit", role: "[seen] initialize wave state: run the four setup passes loc_92c5, loc_9234, resetWorkingRamForStateEntry, loc_a831 in order, then seed 0x5b=0xfa and clear 0x106, 0x5f, 0x1.", cert: "seen" },
  0x9025: { name: "runLevelInit", role: "[seen] level-entry init: run loc_921b then loc_92c5, then tail-delegate to the main init resetWorkingRamForStateEntry. No own memory write.", cert: "seen" },
  0x90c4: { name: "selectWaveStartSlot", role: "[seen] choose the wave's start slot: scan threshold table 0x91fe downward for the highest slot at or below seed 0x126, clamp up against a floor derived from wave state (0x16a/0x71d/0x9), publish the floor in 0x29 and the start index in 0x127, then fall into reseedWaveWorkingSet.", cert: "seen" },
  0x9923: { name: "spawnEnemyOnTimerExpiry", role: "[seen] spawn on slot-timer expiry for slot X: raise spawn request 0x29=0xf0, latch 0x203,x into 0x2a, save X in 0x35, run the placement pass placeSpawnListForColumnDeficit; if the request survives and spawnClimberInFreeSlot allocates a free slot, drop 0x3ab and clear the slot timer 0x243,x, else flag 0x2f=0xff and re-arm 0x243,x.", cert: "seen" },
  0xa463: { name: "resolveSlotProximityInteractions", role: "[seen] resolve slot X's proximity interactions: store threshold A in 0x2e, scan 0x2db slots y=10..0 forming delta=|entry-threshold|; near slots (y<4) under 0x a7 with a matching 0x2b5/0x2ad pair retire via retireSpawnedObject; far slots (y>=4) fold 0x27f,y to a 3-bit band, test delta against 0x151,band, then dispatch spawnLaneEnemyAndAward (band 4) or activateSlotAndRespawn (other bands); after the scan, if 0x2f2,x==0xff tear down the slot (clear 0x2d3,x/0x2f2,x, drop live count 0x135).", cert: "seen" },
  0xa83a: { name: "stepAttractEnemySweepTimer", role: "[seen] step the attract-mode phase timer (only while 0x5 bit7 set): with 0x125 running advance it and at the 0x3aa-indexed limit (table loc_a883) restart it and run the sweep sweepLaneSlotsForRespawn; with 0x125 idle, arm the next stage (bump 0x3aa, seed 0x125=1) when 0x201 is clear and 0x4e bit3 is set; every path clears bit7 of 0x4e.", cert: "seen" },
  0xd8ca: { name: "playPowerOnTone", role: "[code] power-on tone-and-delay entry: store the passed byte at loc_79 then drive POKEY chip-0 through a descending run of tone bursts (writing loc_60c1/loc_60c0/loc_60e0 and strobing output latch loc_5000 while draining fixed counts), before tail-delegating to the checksum/self-test checksumRomAndSettleEntropy.", cert: "code" },
  0x98a2: { name: "tickSpawnSlotTimers", role: "[seen] age the 64-entry per-slot spawn-timer table loc_243 (slot 63..0): freeze ageing when the gate loc_2f has bit7 set (raised when loc_108+loc_109 overshoots loc_11c or loc_125 is set), decrement each active timer, fire the expiry handler spawnEnemyOnTimerExpiry when it reaches 0, accumulate a per-slot bit mask (via loc_203/loc_ca38) into loc_14f and copy it out to loc_150.", cert: "seen" },
  0xa23f: { name: "spawnEntityIntoFreeSlot", role: "[seen] spawn a new entity into a free slot: bail if 0x201 negative; form a gate (0x4d&0x10 when 0x5 negative, else 0x29 from 0x106 plus one per live 0x2db slot whose 0x2b5 sits within 1 of 0x200); on a nonzero gate scan 0x2d3 (x=7..0) for the first zero slot, seed it across 0x2d3/0x2ad/0x2c0/0x2f2 from 0x202/0x200/0x201/0, bump live count 0x135, and fire requestEnemySpawnSound + resolveSlotProximityInteractions.", cert: "seen" },
  0xa454: { name: "scanAllSlotsForProximity", role: "[seen] drive the proximity pass across the live set: scan slots x=7..0 and, for each nonzero 0x2d3 entry, invoke resolveSlotProximityInteractions with that entry as the threshold and x as the slot index.", cert: "seen" },
  0xc90c: { name: "resetLevelPlayfieldSlots", role: "[seen] reset the per-slot playfield state: run setup passes rebuildControlBlocksIfRequested/buildLevelLayout (and clearChannelStagingBlock when 0x5 negative), clear 0x49, walk every slot from 0x3e down to 0 seeding 0x48,slot from 0x158 and 0x46,slot=0xff, clear 0x3f and 0x115, reload 0x3d from 0x3e, then tail-delegate to selectWaveStartSlot.", cert: "seen" },
  0xc940: { name: "setupLevelTimers", role: "[seen] set up the level: seed sizing/timer cells loc_1=0, loc_00=30, loc_2=30, and when the level id loc_3f differs from last-seen loc_3d latch loc_3d and (with loc_5 negative) install the new-level timers loc_1=14/loc_00=10/loc_4=40or80 (by loc_117) via swapParallelTables, then run selectProjectionScale, index loc_46 by loc_3d into loc_9f, run runLevelInit and tail-delegate to the readout reset resetBothPokeyChips.", cert: "seen" },
  0xc98c: { name: "bumpLevelEnemyQuota", role: "[seen] ramp the per-level enemy quota: while the loc_46-slot indexed by level loc_3d is below 0x62, bump that slot and the working copy loc_9f together, seed loc_00=0x18, and when the loc_102-slot is nonzero run the handler chain (seatInPagePointer, addBcdScoreAndAwardAtThreshold, requestScoreAwardSound), then tail-delegate to init runWaveInit.", cert: "seen" },
  0x9729: { name: "runFrameStateUpdaters", role: "[seen] run the per-frame state updaters: clear bit7 of 0x123, run loc_9749, loc_97f8, loc_a416, loc_a23f, loc_a18f in order, then run the extra updater loc_a504 only when 0x201 is negative.", cert: "seen" },
  0x9108: { name: "selectWaveStartSlot", entry: "reseedWaveWorkingSet", role: "[seen] reseed the wave working set: latch 0x3d from 0x3f (running swapParallelTables when nonzero), seed 0x7c/0x5b/0x200/0x51/0x7b/0x605, and on the 0x5 sign flag prime the intro cells (0x605/0x111/0x00/0x1/0x9f via unpackLevelNibbleTables), write 0x4, then fall into tickWaveSpawnCadence.", cert: "seen" },
  0x9149: { name: "selectWaveStartSlot", entry: "tickWaveSpawnCadence", role: "[seen] tick the wave spawn cadence: decrement frame counter 0x605, on underflow BCD-count-down the phase 0x4 and reload; when the 0x4e phase gate passes, release one entry (index 0x91fe, seed 0x102/0x46/0x9f, run the spawn chain unpackLevelNibbleTables/reseedStateTables/seedPerLaneSpikeArray/clearReadyLatchPair/clearByte50), then trim 0x4e to its low 3 bits.", cert: "seen" },
  0xd8cd: { name: "playPowerOnTone", entry: "runPowerOnToneBursts", role: "[code] second entry of the power-on tone driver (same file as playPowerOnTone): store `count` at loc_79, derive the pass total from a ((a>>2)<<1, +1 when count's low nibble is zero), then loop the descending POKEY tone bursts (loc_60c1/loc_60c0/loc_60e0, watchdog strobe loc_5000) switching to the low tone on the last pass, and tail-delegate to checksumRomAndSettleEntropy.", cert: "code" },
  0xd92f: { name: "foldToneTableByte", role: "[code] fold one table byte (read through the zero-page pointer at loc_0, indexed by the incoming cursor y) into the running byte a by XOR, then continue into the tone-burst count path seedToneBurstCount with that result.", cert: "code" },
  0xd931: { name: "seedToneBurstCount", role: "[code] carry the incoming byte through as the tone-burst count and derive the pass-seed from loc_1 (values >=0x20 fold down by 0x18, then masked to five bits), handing both to the power-on tone burst runPowerOnToneBursts.", cert: "code" },
  0x902b: { name: "resetWorkingRamForStateEntry", role: "[code] master state-entry sweep: run the six reset/seed leaves back to back (loc_928f, loc_926f, loc_9246, loc_929f, loc_92ad, loc_c16e), then arm loc_124 and loc_148 to 0xff and clear loc_123.", cert: "seen" },
  0x904b: { name: "autoAdvanceRimRotation", role: "[seen] feed the rim-rotation update from a fixed-stride position accumulator: set floor loc_202=0x10, sign-extend delta loc_121 across loc_29/2a/2b (asr twice), fold into the 24-bit total loc_122/68/69, step the 16-bit position loc_5f/loc_5b by stride 0x18 (arm loc_115 at loc_5b>=0xfc), and on a collapsed high difference against loc_5d rebuild the seeds, set mode loc_0 (0x04/0x08 by loc_5 sign) and clear loc_102[loc_3d]; marks loc_114=0xff and continues into rotateBlasterAroundRim.", cert: "seen" },
  0x91b5: { name: "seatInPagePointer", role: "[seen] seat the in-page working pointer 0x2a/0x2b: double the selector into a word index, clear paired flag byte 0x29, and copy the little-endian pointer from ROM table 0x91c6/0x91c7 at that index.", cert: "seen" },
  0x921b: { name: "seedFrameControlTimers", role: "[seen] init seeder: write fixed startup constants loc_200=0x0e, loc_51=0xf0, loc_106=0x00, loc_201=0x0f and loc_202=0x10 (the frame-control byte loc_201 and counter loc_202 later drive ageShotsAndAdvanceFrameClock).", cert: "seen" },
  0x9234: { name: "seedPerLaneSpikeArray", role: "[seen] init seeder: copy header byte loc_15b into loc_3ab, then fill the sixteen per-lane cells loc_3ac..loc_3ac+0x0f with the byte read from loc_15a.", cert: "seen" },
  0x9246: { name: "seedSlotRandomTags", role: "[seen] assign a fresh random tag to each active climber slot: zero the 64-byte tag table loc_243+0..0x3f, then for each slot from loc_3ab-1 down write a 4-bit POKEY-random loc_60ca&0x0f into loc_203,x and pack the slot index with it into loc_243,x=(x<<4)|nibble, substituting 0x0f when the packed tag would be zero.", cert: "seen" },
  0x926f: { name: "clearShotTableAndStateFlags", role: "[seen] reset leaf: blank the seven shot-depth cells loc_2df..loc_2df+6 top-down, then clear seven scattered state flags loc_108, loc_109, loc_145, loc_142, loc_144, loc_143 and loc_146.", cert: "seen" },
  0x928f: { name: "clearActiveShots", role: "[code] reset the shot bank: zero the 12-byte depth array loc_2d3 (0x0b..0) and both count cells loc_135 and loc_a6 to baseline.", cert: "seen" },
  0x929f: { name: "clearEightByteTableAndFlag", role: "[seen] reset leaf: blank the eight-byte table loc_30a..loc_30a+7 top-down, then clear the trailing flag byte loc_116.", cert: "seen" },
  0x92ad: { name: "clearByte50", role: "[seen] minimal reset leaf: clear the single state cell loc_50 (a cell that ranges 0x00..0xde in play) to zero and return.", cert: "seen" },
  0x92b2: { name: "swapParallelTables", role: "[code] swap the two parallel 18-entry tables loc_3aa and loc_3bc slot-for-slot (index 0x11 down to 0), so each table ends holding what its sibling held.", cert: "code" },
  0x93e0: { name: "partitionByteToFineCoarseSeed", role: "[seen] split one input byte into three derived live-outs: fold its top three bits (MSB first) into the low bits of a 0xff seed, stash that seed in scratch loc_29, and return A=input shifted left 3, X=((seed^0xff)+0x0d)>>1 (coarse index), Y=seed; used by reseedStateTables to fan loc_163/loc_120/loc_160 out into their satellite cells.", cert: "seen" },
  0x96ab: { name: "fetchCoordListEntryByCounter", role: "[seen] fetch a coordinate-list entry by re-indexing: stash Y at 0x29, form the index value ((0x2b-1)&0x0f)+1, subtract the list byte two entries back (pointer+(Y-2)), add back the saved Y, re-index the pointer by the result, and load and return that entry.", cert: "seen" },
  0x96b7: { name: "fetchCoordListEntryByCounter", entry: "fetchCoordListEntryByIndex", role: "[code] sibling of 0x96ab that uses the raw index 0x2b (not the counter-wrapped value): stash Y at 0x29, subtract the list byte two entries back, add back saved Y, re-index the pointer, and load and return that entry.", cert: "seen" },
  0x96c4: { name: "fetchCoordListEntryByCounter", entry: "readCoordListEntry", role: "[code] the bare coordinate-list read: return the byte at pointer 0x2c offset by Y, with no index arithmetic.", cert: "seen" },
  0x96c7: { name: "advanceCursorPastPackedRecord", role: "[code] cursor-skip helper: advance the list cursor Y by a fixed run to step over a packed record without reading it -- the first entry moves Y forward by three (bumps by one then falls into the second entry), the second entry by two; register only, writes no memory", cert: "seen" },
  0x96c8: { name: "advanceCursorPastPackedRecord", entry: "advanceListCursorByTwo", role: "[code] step the list cursor forward past a two-byte record without reading it: return Y+2 (register only).", cert: "seen" },
  0x96cb: { name: "advanceCoordListByEntryStride", role: "[seen] walk the packed coordinate list through 0x2c/0x2d: read the entry at Y and its predecessor at Y-1, store their difference (cur-prev) at 0x29 as the step delta, and advance Y by that delta plus two.", cert: "seen" },
  0x96db: { name: "resolveCoordListEntryToAbsolute", role: "[code] resolve one list entry to an absolute coordinate: read the byte at pointer 0x2c offset by Y and add the base value in 0x160, returning the 8-bit sum in A.", cert: "seen" },
  0x96e2: { name: "sumCoordListEntryRun", role: "[code] fold a run of coordinate-list entries: use 0x96f4 as a repeat count, load the first entry at pointer 0x2c offset Y, then add that many further consecutive entries into a single wrapped one-byte total.", cert: "seen" },
  0x96f4: { name: "computeCoordListBackDelta", role: "[code] compute the coordinate-list index delta: record Y at 0x29 and return (0x2b minus the list byte two slots back at pointer+(Y-2)) & 0xff; a leaf whose result is consumed downstream.", cert: "seen" },
  0x9700: { name: "computeCoordListBackDelta", entry: "selectListEntryByDeltaParity", role: "[code] pick one source-list entry: run computeCoordListBackDelta to form base 0x2b minus the table byte two slots back, advance cursor Y by the low bit of that delta, and return the entry at (mem16[0x2c]+Y).", cert: "seen" },
  0x9749: { name: "rotateBlasterAroundRim", role: "[code] advance the rim rotation/spinner state: skip while fine-angle flag loc_201 bit7 set; take the delta from manual reading loc_50 (clamped to band [0xe1,0x1f], then consumed) when loc_5 bit7 is set else the auto-aim from aimSpinnerAtNearestEnemy; fold it into work cells loc_2b/loc_2c, and on a live level (loc_111!=0) cap loc_2c to 0xef and saturate toward the stored sign on a sign flip; the high nibble becomes coarse angle loc_2a, ring sound cueRimRotationSound on a changed coarse angle, then commit loc_200/loc_201/loc_51.", cert: "seen" },
  0x970b: { name: "runPerFrameUpdates", role: "[seen] run the nine per-frame update passes in fixed order (loc_9749, loc_a23f, loc_a83a, loc_98a2, loc_9b1e, loc_a18f, loc_a2a6, loc_a454, loc_a416) then tail-delegate to loc_a504; makes no own role-defining write.", cert: "seen" },
  0x97c5: { name: "aimSpinnerAtNearestEnemy", role: "[seen] scan the depth table loc_2df over count loc_11c for the smallest nonzero entry (value in loc_29, index in loc_2a); with a candidate take the signed segment delta of loc_2b9[idx] against player segment loc_200 (signedSegmentDelta) and return an auto-aim spinner code -- 0x00 aligned, 0x09 one side, 0xf7 the other -- consumed by rotateBlasterAroundRim.", cert: "seen" },
  0x97f8: { name: "advanceMovingSpike", role: "[code] step the moving spike each frame while loc_201 bit7 is clear and arm flag loc_106 bit7 is set: cue a start sound at trigger height loc_202==0x10, advance 16-bit height loc_107/loc_202 by loc_104/loc_105 (park loc_202=0xff, request mode loc_0=0x0e, cue end sound on ceiling overflow), rebuild the spike table (rebuildSpikeTable) past 0x50, rederive the per-frame delta from loc_9f, then scan loc_3ac for the player-segment lane loc_200 and register a collision (cueSpikeCollisionSound/insertObjectHeadTag7/clearActiveShots, clear loc_115).", cert: "seen" },
  0x994d: { name: "spawnClimberInFreeSlot", role: "[seen] spawn a new climber into a free slot: scan the free-slot index down from loc_11c skipping slots whose depth loc_2df,y is nonzero, and on a free slot seed depth loc_2df,y from loc_29, target segment loc_2b9,y from loc_2a (POKEY-random even loc_60ca&0x0e when loc_2a==0x0f and loc_111 bit7 set), successor loc_2cc,y, timer loc_2a6,y=0, flags loc_28a,y from loc_2c, coord-high loc_291,y from loc_2d, lane byte loc_283,y from loc_2b; bump active count loc_108 and per-lane counter loc_142,lane, report 0x10 (0x00 when no slot free).", cert: "seen" },
  0x9a88: { name: "dispatchCoordListSetup", role: "[seen] route by the incoming value to one of five coordinate-list setup entries (0x9a9d, 0x9aa9, 0x9abb, 0x9ab7, 0x9ab3), passing the slot index X through, each of which front-loads a specific index/low-byte then falls into the shared 0x9aee/0x9af1 seating.", cert: "seen" },
  0x9a9d: { name: "seatDemoCoordListPointer", role: "[code] seat the index-0 coordinate list: take the low pointer byte from fixed table byte 0x9b02, mark index 0 at 0x2b, take the high pointer from held source cell 0x15d into 0x2d, reload A from 0x29.", cert: "seen" },
  0x9ab7: { name: "seatDemoCoordListPointer", entry: "seatCoordListPointerAtIndex3", role: "[code] preset the selecting index to 3 and run the shared 0x9aee seating, parking the coordinate-list pointer 0x2c/0x2d from ROM tables 0x9b02[3]/0x9afd[3].", cert: "seen" },
  0x9abb: { name: "selectClimberSpawnLane", role: "[seen] pick the lane a new climber will use: from a POKEY-random start (0x60ca&3) walk the four-entry lane table 0x149 with a four-step countdown in 0x2b, skipping lanes whose occupancy cell 0x13c is empty; on a hit set 0x2c to the chosen lane|0x40, seat the list-high byte 0x9afd[2] into 0x2d, index 0x02 into 0x2b, and report 0x29 (report 0x00 on underflow).", cert: "seen" },
  0x9aee: { name: "seatCoordListPointer", role: "[seen] aim the coordinate-list pointer at a packed vector list: read the low byte from ROM table 0x9b02+Y into 0x2c and the high byte from 0x9afd+Y into 0x2d, remember the selecting index at 0x2b, and reload A from holding cell 0x29.", cert: "seen" },
  0x9af1: { name: "seatCoordListPointer", entry: "seatCoordListPointerWithLowByte", role: "[seen] seat the coordinate-list pointer entered one step in: store the caller-supplied low byte straight into 0x2c, pull the high byte from ROM table 0x9afd+Y into 0x2d, stash index at 0x2b, reload A from 0x29.", cert: "seen" },
  0x9af6: { name: "seatCoordListPointer", entry: "seatCoordListPointerWithHighByte", role: "[seen] seat the coordinate-list pointer at its deepest entry: caller already parked the low byte at 0x2c, so take the high byte straight from A into 0x2d, stash index at 0x2b, reload A from 0x29.", cert: "seen" },
  0x9b07: { name: "setupEnemyCoordList", role: "[seen] set up the coordinate/shape list for the packed index in loc_2b (saving/restoring the caller index in loc_36): when the held count loc_29 >= 0x20 select a list-setup entry through dispatcher dispatchCoordListSetup, otherwise seat the pointer pair directly at that index via seatCoordListPointer.", cert: "seen" },
  0x9b98: { name: "dispatchSlotMotionHandler", role: "[seen] route to one of twenty per-slot motion/steering/coordinate handlers (loc_9bca..loc_9c3b, incl. the steering step loc_9cb6) by the pre-doubled table offset in the incoming value, passing slot x through and threading the offset as the object-insert seed for the collision handlers.", cert: "seen" },
  0x9b1e: { name: "runObjectMotionScripts", role: "[code] the per-frame motion-script walker: when loc_201>=0, walk slots loc_37=loc_11c down to 0 and for each nonzero loc_2df,x run its script from cursor loc_291,x, dispatching each script byte at loc_a0f7[loc_10b] to a motion opcode handler until the continuation flag loc_10a clears, then store the cursor back to loc_291,x; finally signed-accumulate loc_147 into loc_148, fire the cd06/cd02 sound cues on a sign flip, and negate loc_147 to reverse sweep when loc_148 leaves the [0x0f,0xc0] band", cert: "seen" },
  0x9bca: { name: "endObjectMotionScript", role: "[seen] housekeeping leaf: clear the walk-continuation flag by writing loc_10a=0, ending the walker's inner loop over this object's script entries", cert: "seen" },
  0x9cb6: { name: "steerSlotCoordinate", role: "[code] step slot x's coordinate keyed on loc_28a,x bit7 (sub-step via reverseEnemyLaneDepth flipping direction at the loc_157 threshold when loc_3ab is set, else add-step via advanceEnemyLaneDepth), and on the common tail -- loc_148 bit7 clear AND loc_2df,x < loc_157 AND loc_200==loc_2b9,x AND loc_201==loc_2cc,x -- seed a fresh object for that slot via insertObjectHeadTag7 with the stepped Y.", cert: "seen" },
  0x9bcf: { name: "noopDispatchStub", role: "[code] no-op leaf that returns immediately, occupying a slot in a computed-dispatch set so selecting it falls straight back to the caller.", cert: "seen" },
  0x9bd0: { name: "writeScriptConstantToSlot", role: "[seen] immediate store opcode: advance the script cursor loc_10b by one (wrapping to a byte) and copy the script byte it now points at, loc_a0f7[loc_10b], verbatim into the acting object's cell loc_298,x", cert: "seen" },
  0x9bdd: { name: "writeScriptVariableToSlot", role: "[seen] indirect store opcode: advance the script cursor loc_10b by one, treat the fetched script byte loc_a0f7[loc_10b] as a zero-page address, and copy the live variable at loc_00+ptr into the acting object's cell loc_298,x", cert: "seen" },
  0x9bee: { name: "skipScriptOperandWhenFlagClear", role: "[seen] conditional-skip opcode: if the branch flag loc_10c is nonzero do nothing, otherwise advance the script cursor loc_10b by two to step past a two-byte operand", cert: "seen" },
  0x9bfa: { name: "jumpScriptCursorWhenFlagClear", role: "[seen] conditional-jump opcode: advance the script cursor loc_10b by one, then only while the branch flag loc_10c is zero replace the cursor entirely with the operand target loc_a0f7[loc_10b], reloading the script position", cert: "seen" },
  0x9c0c: { name: "holdSlotPoseUntilTimerExpires", role: "[seen] dwell opcode: decrement the acting slot's timer loc_298,x; while it stays nonzero delegate to the loc_a0f8-driven goto (followScriptGoto) so the object keeps cycling its current state, and only when the timer hits zero bump the shared cursor loc_10b to release the script to the next instruction", cert: "seen" },
  0x9c17: { name: "followScriptGoto", role: "[seen] unconditional-goto opcode: use the current cursor loc_10b to index the parallel table loc_a0f8 and write loc_a0f8[loc_10b] back as the new cursor, following the chained operand", cert: "seen" },
  0x9c21: { name: "setFlagIfSlotPastSegmentBound", role: "[code] boundary-test opcode: read the slot's segment loc_2b9,x, look up its boundary in loc_3ac (a zero entry reads as the maximum 0xff), and set the branch flag loc_10c to 1 when the boundary is at or beyond the slot's depth loc_2df,x, else 0", cert: "seen" },
  0x9c3b: { name: "setFlagFromPhaseAccumulatorSign", role: "[code] phase-probe opcode: form ((loc_147<<2)+loc_148) & loc_148 & 0x80, XOR against 0x80, and store to the branch flag loc_10c so it becomes 0x00 when that high bit is set and 0x80 when clear", cert: "seen" },
  0x9c4f: { name: "toggleEnemyTurnSide", role: "[seen] toggle bit6 (the turn/rotation side flag) of the slot's flag cell loc_283,x in place and return the new value.", cert: "seen" },
  0x9c58: { name: "stepEnemyDepthInLaneDirection", role: "[seen] step slot x's 16-bit tube depth (low loc_29f,x / high loc_2df,x) by the per-segment delta from the loc_160/loc_165 table indexed by the segment (loc_283,x & 7), routing to the add path advanceEnemyLaneDepth when loc_28a,x bit7 is clear or the subtract path reverseEnemyLaneDepth when set.", cert: "seen" },
  0x9c63: { name: "stepEnemyDepthInLaneDirection", entry: "advanceEnemyLaneDepth", role: "[seen] add-direction depth step: loc_29f,x += loc_160,seg (16-bit) into loc_2df,x, then on the new high byte settle the slot via settleEnemyAtTargetDepth (hi <= floor loc_202), finish with the new high as exit value (hi >= 0x20), or retire/replace the slot via retireEnemyAndSpawnSplit when hi < 0x20 with an armed gate (loc_28a,x & 3).", cert: "seen" },
  0x9c99: { name: "stepEnemyDepthInLaneDirection", entry: "reverseEnemyLaneDepth", role: "[code] subtract-direction depth step: loc_29f,x -= loc_160,seg (16-bit, with borrow) into loc_2df,x, flooring the high byte to 0xf2 when it underflows past 0xf0; returns the new (or floored) high byte.", cert: "seen" },
  0x9d06: { name: "settleEnemyAtTargetDepth", role: "[seen] settle slot x at the target depth: stash floor loc_202 into loc_2df,x, then by kind -- a kind-1 slot (loc_283,x&7==1) with loc_3ab!=0 flips bit7 of loc_28a,x; a negative slot bumps its stashed depth; else drop count loc_108, and when per-type count loc_109==1 scan slots 6..0 for a matching-depth neighbour (index into loc_38) and copy its inverted bit6 into loc_283,x, otherwise re-aim via faceEnemyTowardPlayerSegment, finally marking loc_10b=0x41 and bumping loc_109.", cert: "seen" },
  0x9d67: { name: "faceEnemyTowardPlayerSegment", role: "[code] aim slot x's turn side toward the player: take the signed segment delta of loc_2b9,x against player segment loc_200 via signedSegmentDelta, then clear bit6 of loc_283,x when the delta is negative (bit7 set) and set it otherwise.", cert: "seen" },
  0x9d82: { name: "animateFlipperTurn", role: "[seen] step the flipper's turn animation for slot x: advance phase counter loc_2cc,x by loc_283,x bit6 (keep nibble, force bit7); when state loc_283,x&7 != 4 re-aim (lookupRingHeading of loc_283,x^0x40 vs loc_2b9,x) and on a phase match drop bit7 and reseed the phase/lane loc_2b9,x; when state==4 at a step boundary rotate loc_2b9,x, reseed phase to 0x20, flip loc_28a,x bit7 and (loc_3ab==0) kick flipEnemyLaneTowardTarget when depth loc_2df,x==floor loc_202; every exit copies loc_283,x bit7 into shared flag loc_10c.", cert: "seen" },
  0x9e2f: { name: "spawnType5OnCoordMatch", role: "[code] spawn a type-5 object when a live slot (loc_283,x bit7 clear) has its coordinate pair loc_2b9,x/loc_2cc,x matching the current target pair loc_200/loc_201.", cert: "seen" },
  0x9e48: { name: "fireHitOnPlayerCollision", role: "[code] fire the player-collision hit when a slot's depth loc_2df,x matches loc_202 and its segment loc_2b9,x matches loc_200.", cert: "seen" },
  0x9e5c: { name: "stepClimberSegmentGuarded", role: "[seen] step a climber's segment with the flip guard: run the depth-gated bit6 keeper first, then fall into the shared segment-step body for slot x.", cert: "seen" },
  0x9e5f: { name: "stepClimberSegmentAndHeading", role: "[seen] step a climber one segment and set its next heading: force bit7 on loc_283,x (mark live) and branch on its low-3-bit segment -- for the seam segment 4 step depth loc_2b9,x down one mod16 and store 0x87 (bit6 set) or store 0x81 (bit6 clear); for any other segment step depth up one mod16 (bit6 set) then store the ring-lookup heading into loc_2cc,x.", cert: "seen" },
  0x9eab: { name: "keepClimberFlipBitByDepth", role: "[code] keep the climber's flip bit (bit6 of loc_283,x) in step with its segment depth loc_2b9,x while gate loc_111 is on: when bit6 is set clear it once depth reaches 0x0e; when bit6 is clear set it only while depth is 0.", cert: "seen" },
  0x9ed7: { name: "lookupRingHeading", role: "[code] look up a climber heading from the ring-direction table loc_3ee,y with bit7 forced on; when the caller's bit6 is set take the half-turn first -- index y=(y-1)&0x0f, value (loc_3ee,y+8)&0x0f.", cert: "seen" },
  0x9ef1: { name: "advanceEnemyPursuit", role: "[code] per-slot pursuit mover: when loc_28a,x bit7 is set re-seek the subtract way (reverseEnemyLaneDepth with delta index 0x04) and dispatch on the returned high (maybeFireEnemyStep fire step for hi<0x80, else flipEnemyLaneRandomSide/flipEnemyLaneTowardTarget by loc_159 bit6); when clear advance the 16-bit depth (loc_29f,x += loc_164; loc_2df,x += loc_169) clamped to floor loc_202, producing a fire carry only when loc_3ab!=0 and (loc_9f>=0x11 or hi>=0x20), then run maybeFireEnemyStep or pick flipEnemyLaneTowardTarget/flipEnemyLaneRandomSide by loc_159 sign.", cert: "code" },
  0x9f5f: { name: "maybeFireEnemyStep", role: "[code] per-slot fire gate: run a step only when the slot's fire bit loc_2df,x & 0x20 is set and a fresh POKEY draw loc_60da >= threshold loc_15f; then route to flipEnemyLaneRandomSide when loc_159 bit6 is clear or the slot index is even, otherwise flipEnemyLaneTowardTarget.", cert: "code" },
  0x9f81: { name: "flipEnemyLaneTowardTarget", role: "[code] flip-step entry that re-derives slot x's turn side toward its target (faceEnemyTowardPlayerSegment) then toggles bit6 of loc_283,x (toggleEnemyTurnSide), then runs the shared tail: on a live board (loc_111!=0) flip bit6 by ring depth via loc_2b9,x, mark loc_10b=0x66, and continue into stepClimberSegmentAndHeading -- the flipper's lane-to-adjacent-lane hop.", cert: "code" },
  0x9f8a: { name: "flipEnemyLaneTowardTarget", entry: "flipEnemyLaneRandomSide", role: "[code] flip-step entry that reseeds slot x's turn side from a random bit (loc_60ca & 0x40) into bit6 of loc_283,x, then runs the shared tail: on a live board (loc_111!=0) flip bit6 again by ring depth (loc_2b9,x==0 when bit6 set, >=0x0f when clear), mark loc_10b=0x66, and continue into stepClimberSegmentAndHeading.", cert: "code" },
  0x9fc4: { name: "advanceClimberTrackingColumnMin", role: "[seen] advance climber slot x toward the rim while tracking each column's shallowest occupant: raise loc_10c, seed empty column loc_3ac,col to 0xf1, record a fresh minimum for the column (tagging loc_39a,col=0x80), clamp a too-shallow depth loc_2df,x (set bit7 of loc_28a,x, depth->0x20), or past the far limit call the deepest-column aim, repark depth at 0xf0 and (only when loc_3ab==0) rewrite flag loc_28a,x and lane loc_283,x.", cert: "seen" },
  0xa028: { name: "aimClimberAtDeepestColumn", role: "[code] aim a climber slot at the deepest tube column: scan the 16-column depth table loc_3ac from a POKEY2-random start loc_60da&0x0f (empty column counts as maximal 0xff, last column skipped while loc_111 nonzero) keeping the max in loc_2d and its column in loc_29, then set the slot's target segment loc_2b9,x to the winner, successor loc_2cc,x=(winner+1)&0x0f, and clear bit7 of loc_28a,x.", cert: "seen" },
  0xa06f: { name: "retireEnemyAndSpawnSplit", role: "[seen] retire the enemy in slot y and optionally split it: clear loc_2df,y, drop per-type loc_109 (when depth==loc_202 and lane loc_283,y&7 != 4) or total loc_108, drop per-lane loc_142; then when the replacement gate loc_28a,y&3 is armed, seat draw cells loc_2b/loc_2a, build the coordinate list via setupEnemyCoordList, seed loc_10b/loc_10a, spawn a replacement via spawnClimberInFreeSlot, and if it took, spawn a mirrored second one.", cert: "seen" },
  0xa18f: { name: "stepActiveShots", role: "[seen] advance every active shot slot (0x0b..0): slots >=8 integrate a 16-bit velocity loc_2e6,x/loc_2d3,x by loc_120/loc_118 and retire (drop loc_a6, finalize via primeTopObjectOnTargetMatch, clear loc_2d3,x) when the new high falls below the floor loc_202; slots <8 step counter loc_2d3,x by 0x09 (less 4 when loc_2f2,x is flagged), resolve via advanceShotAndScoreLaneHit, and clear (drop loc_135) at the far limit >=0xf0.", cert: "seen" },
  0xa1e4: { name: "primeTopObjectOnTargetMatch", role: "[code] prime the top-priority object only when the live byte loc_200 matches slot x's target loc_2ad,x and ready flag loc_201 bit7 is clear -- run the prime and latch loc_201=0x81.", cert: "seen" },
  0xa1fa: { name: "advanceShotAndScoreLaneHit", role: "[code] advance shot slot x's counter loc_2d3,x toward the per-lane target-depth loc_3ac,y (y=loc_2ad,x); on reaching it shrink/clear loc_3ac,y, bump the hit tally loc_2f2,x, flag the target loc_39a,y=0xc0, chime (requestSegmentHitSound) and award (addBcdScoreAndAwardAtThreshold), returning the live slot; a second hit spends the shot (clear loc_2d3,x, drop the shot count loc_135).", cert: "seen" },
  0xa2a6: { name: "spawnClimbersFromSourceSlots", role: "[seen] spawn climbers from the seven source slots each frame: skip while loc_201 bit7 set; for each armed slot (loc_28a,x bit6) with depth loc_2df,x>=0x30 whose timer loc_2a6,x underflows and whose POKEY roll loc_60ca beats the per-wave gate loc_a304[loc_a6], copy depth/segment/successor into the first empty destination loc_2db,y, reseed the timer from loc_119, cue the sound, and bump live count loc_a6.", cert: "seen" },
  0xa33a: { name: "insertType5AndDrainPending", role: "[seen] insert a type-5 object through the shared tail, then step the pending counter loc_201 down one.", cert: "seen" },
  0xa343: { name: "insertObjectHeadTag9", role: "[code] insert a type-1 object after stamping head flag loc_13b with 0x09.", cert: "seen" },
  0xa347: { name: "insertObjectHeadTag9", entry: "insertObjectHeadTag7", role: "[code] insert a type-1 object after stamping head flag loc_13b with 0x07.", cert: "seen" },
  0xa34b: { name: "primeTopPriorityObject", role: "[code] prime a fresh top-priority object: stamp head flag loc_13b=0xff and run the type-1 insert.", cert: "seen" },
  0xa34d: { name: "primeTopPriorityObject", entry: "insertType1WithHeadFlag", role: "[seen] insert a type-1 object after stamping the head flag loc_13b with the caller's value, then run the shared insert tail.", cert: "seen" },
  0xa352: { name: "primeTopPriorityObject", entry: "insertObjectAndSignalReady", role: "[seen] insert an object and signal the spawn ready (shared insert tail): seat the type byte loc_2c, copy source loc_29 from loc_202 and target loc_2d from loc_200, fire the sound gate, insert into the 8-slot table, then raise ready flags loc_201=0x81 and loc_13c=0x01.", cert: "seen" },
  0xa36f: { name: "retireSpawnedObject", role: "[seen] retire the object in slot Y: cue the sound, stage source loc_29 from loc_2db,y and target loc_2d from loc_2b5,y, re-insert a zeroed object, clear the slot loc_2db,y, drop live count loc_a6, and flag lane X spent with loc_2f2,x=0xff.", cert: "seen" },
  0xa3ca: { name: "insertObjectFromSlotDepth", role: "[seen] insert an object seeded from a slot's depth: cue the sound, copy the y-indexed depth loc_2df,y into loc_29, then insert a fresh object into the table.", cert: "seen" },
  0xa3d4: { name: "insertTimedObjectOfType", role: "[code] insert a timed object of a given type: stash A into the type scratch loc_2c, then insert into the 8-slot table.", cert: "seen" },
  0xa3d6: { name: "insertTimedObject", role: "[seen] insert a timed object into the 8-slot table: reuse the first empty slot (loc_30a,i==0) or evict the slot holding the largest counter loc_312,i (dropping loc_116 by one), then fill counter loc_312=0, type loc_302 from loc_2c, presence loc_30a from loc_29, lane loc_2fa from loc_2d, and bump loc_116.", cert: "seen" },
  0xa416: { name: "ageTimedObjects", role: "[seen] age the timed-object table: if pending flag loc_116 is zero do nothing, else clear it and advance each live slot's counter loc_312,i by the per-type step loc_a44e[type], freeing a slot that reaches its per-type limit loc_a448[type] (loc_30a,i=0) and re-raising loc_116 for any slot still short.", cert: "seen" },
  0xa504: { name: "ageShotsAndAdvanceFrameClock", role: "[seen] per-frame ager keyed on the sign of loc_201: the positive arm bumps timer cell loc_00+loc_40 behind a gate and conditionally re-inits shot state via initWaveStateCountingSpikes/clearActiveShots; the negative arm ages every live shot in loc_2df from index loc_11c down by +0x0f (snapping >=0xf0 to 0), steps loc_202 or the loc_5f/loc_5b countdown clock, and on proceed writes loc_00=0x06, runs clearActiveShots, and folds loc_108+loc_109+loc_3ab into loc_3ab clamped to 0x3f.", cert: "seen" },
  0xa5cb: { name: "initWaveStateCountingSpikes", role: "[seen] wave-state init: reset the batch loc_0=0x20, loc_104=0, loc_107=0, loc_5c=0, loc_123=0, loc_105=0x02 and OR bit7 into loc_106, tally into loc_123 how many of the sixteen loc_3ac lane cells are nonzero, and if that tally is nonzero with level loc_9f<0x07 overwrite the intro block (loc_4=0x1e, loc_0=0x0a, loc_2=0x20, loc_123=0x80), finally latching loc_125=0xff ready.", cert: "seen" },
  0xa618: { name: "stepEnemyFleetAndSpawn", role: "[code] drive one frame of the enemy bank: seed frame-active flag loc_10d from spawn budget loc_10e, walk slots 0x0f..0, integrate+decay each live slot (loc_283,x!=0) via the flight steps and refill each free slot from the budget, tick loc_10e on even frames (loc_3 bit0 clear), settle loc_37=0xff, and raise mode-request loc_0=0x12 when nothing was live or spawned.", cert: "seen" },
  0xa65b: { name: "spawnEnemyInSlot", role: "[code] spawn an enemy into free slot x: mark loc_263,x/loc_283,x/loc_2a3,x = 0x80, seed three velocity/coordinate pairs from POKEY draws loc_60da/loc_60ca (raw into loc_2c3/2e3/303,x, signed nudge from drawSignedVelocityNudge into loc_323/343/363,x, forcing the middle nudge non-positive), then cue the spawn sound gateSound1f.", cert: "seen" },
  0xa69b: { name: "drawSignedVelocityNudge", role: "[code] produce a signed random velocity nudge: take a 3-bit magnitude (loc_60da & 0x07, 0..7) and negate it when the caller's incoming value has bit0 set, yielding a signed step in [-7,+7] consumed by spawnEnemyInSlot as a whole-velocity seed.", cert: "seen" },
  0xa6a9: { name: "advanceEnemyFreeFlight", role: "[code] integrate slot x's three free-flight axes: fold each low velocity (loc_2e3/2c3/303,x) into its fraction (loc_223/203/243,x) and add carry+signed whole (loc_343/323/363,x) into a whole coordinate, committing loc_263,x and loc_2a3,x and loc_283,x, but forcing loc_283,x to 0 (retiring the slot) if any axis crosses the tube ring [0x10,0xf0).", cert: "seen" },
  0xa721: { name: "decayEnemyFreeFlightVelocity", role: "[code] decay slot x's free-flight velocities: seed saturation counter loc_29=0xfd, step each velocity pair (loc_2c3/323, loc_2e3/343, loc_303/363,x) one increment toward zero via stepVelocityTowardZero, and clear the slot's whole coordinate loc_283,x only when all three axes saturate in the same frame.", cert: "seen" },
  0xa75d: { name: "stepVelocityTowardZero", role: "[code] step one signed 16-bit velocity (whole:low) one fixed increment loc_a788 (0x20) toward zero (add when whole negative, subtract otherwise), snapping low loc_2a=0 and bumping saturation counter loc_29 on crossing zero; returns the stepped [low,whole].", cert: "seen" },
  0xa789: { name: "resetPerSlotStateTable", role: "[code] slot-arm init leaf: zero the sixteen-byte per-slot state/flags table loc_283..loc_283+0x0f, then re-seed scalars loc_10e=0x20, loc_10d=0x20, loc_1=0x04, loc_68=0 and loc_69=0.", cert: "seen" },
  0xa7a6: { name: "signedSegmentDelta", role: "[seen] shared signed segment-distance helper: compute A minus Y, stash it in loc_2a, then keep the full byte when loc_111 bit7 is set, else mask to the low nibble and sign-extend bit3 into a signed byte.", cert: "seen" },
  0xa7bd: { name: "rebuildSpikeTable", role: "[code] rebuild the spike table: zero the 8-byte array loc_3fe (7..0), stamp its last slot loc_405=0xf0, and arm the remap reference loc_115=0xff.", cert: "seen" },
  0xa7d2: { name: "stepSpikeTableCollapse", role: "[seen] remap the 8-entry spike table loc_3fe against reference loc_115: entries >=0x17 shrink by 7, smaller nonzero entries snap to a rail (0xf0/0) by loc_115's sign, a zero entry adopts a neighbour's rail; OR-fold results into loc_29, set loc_37=0xff, and clear loc_115 when the whole table has collapsed to zero. No-op while loc_115 is zero.", cert: "seen" },
  0xa831: { name: "clearReadyLatchPair", role: "[seen] reset leaf: clear the pair loc_3aa and loc_125 together, where loc_125 is the block-ready latch set to 0xff elsewhere.", cert: "seen" },
  0xa8b4: { name: "buildTextOverlayList", role: "[seen] compose the per-frame text/marker overlay into buffer 0x2f60: mirror control 0x72, refresh the header (emitColorStatIfChanged), and when 0x5 bit7 is clear pick a marker slot, draw it (drawSlotShapeRecord/emitFixedVectorWord) and duplicate a glyph snapshot into 0x2fa6/0x2fa8; emit glyph strings via buildMarkerRowVectorList/buildTextBufferDigitString; off the safe mode (0x0!=0x04) rebuild checksum 0x16c and a 3-entry mirror; then emit the framing word (emitCoordinateVectorWord) and, in the active phase, the indexed slot pair (0x102) and two trailing markers.", cert: "seen" },
  0xa8e7: { name: "composeFrameDisplayList", role: "[seen] compose one frame's full display list: draw the base overlay (drawOverlayFrame), emit the base list (buildMarkerRowVectorList) and — when the flag source is live (loc_3e while loc_5 bit7 set, else loc_43|loc_44|loc_45) — a second list; unless loc_00==0x04 rebuild the self-check byte loc_16c by XOR-folding 0xa7 over eleven bytes at loc_aace and rebuild the strided mirror loc_2f60 from loc_61b through loc_31fa; emit framing word emitCoordinateVectorWord, draw slot 0x36 when loc_123 bit7 set, and when loc_00==0x18 with loc_5 bit7 set draw slots 0x30 (+numeric run) / 0x3a / 0x38.", cert: "seen" },
  0xa97f: { name: "buildMarkerRowVectorList", role: "[seen] Lays a header byte at loc_2f60 (zeroed only when row index y equals the marker loc_3d with loc_5 bit7 set), fills seven glyph entries from loc_3284/loc_3286, and unless state 4 away from the marker seeds the glyph pointer loc_3b/loc_3c and hands off to the digit-string builder.", cert: "seen" },
  0xa9d7: { name: "buildTextBufferDigitString", role: "[seen] Walks three source bytes backward (pointer loc_3b/loc_3c) emitting each byte's high then low nibble into the text buffer, threading carry so only the final low nibble on the last pass sees it cleared.", cert: "seen" },
  0xa9fc: { name: "writeNibbleGlyphToTextBuffer", role: "[seen] Maps A's low nibble to a stroke byte from ROM table loc_31e4, stores it at the text-buffer cursor loc_2f60+x, and advances x by two.", cert: "seen" },
  0xaa13: { name: "stageTextLineWithCount", role: "[code] stage a text line into the vector text buffer at 0x2f60: pick a string index in loc_3e (forced to 0x01 when loc_5 bit7 is clear and any of loc_43/loc_44/loc_45 is set), seat the write cursor loc_74/loc_75 at 0x2f60, copy loc_ce66[index]+1 stroke bytes from ROM loc_cde6 into it, and on the loc_5 bit7 path also emit the BCD of (loc_9f+1) at 0x2fa6 before restoring the cursor low byte and terminating the record via emitRecordBodyC0.", cert: "seen" },
  0xaa5a: { name: "drawFrameWithSlot08", role: "[code] compose a frame led by slot 0x08: draw slot 0x08 (drawSlotShapeRecord) then chain prepCountThenComposeFrame (the count prep followed by the per-frame composition loc_a8e7).", cert: "seen" },
  0xaa62: { name: "drawFrameWithSlot00", role: "[code] compose a frame led by slot 0x00: prime slot 0x00 with header 0x30 (drawSlotShapeWithHeader), run the shared count prep (drawSlotThenDigitRun), then dispatch the per-frame composition loc_a8e7.", cert: "seen" },
  0xaa69: { name: "prepCountThenComposeFrame", role: "[code] run the shared count prep (drawSlotThenDigitRun: slot 0x02 + digit run) then dispatch the per-frame composition loc_a8e7.", cert: "seen" },
  0xaa6f: { name: "composeFrameThenDrawSlot06", role: "[code] run the alternate per-frame composition loc_a8b4, then prime slot 0x06 through the shared entry drawSlotShapeWithHeader (header 0x00).", cert: "seen" },
  0xaa79: { name: "drawFrameWithSlot32", role: "[code] compose a frame led by slot 0x32: draw slot 0x32 (drawSlotShapeWithHeader, header 0x00), add a second draw of slot 0x22 (header 0xe0) only while status nibble loc_3&0x1f < 0x10, then finish with the alternate per-frame composition loc_a8b4.", cert: "seen" },
  0xaa92: { name: "drawSlotThenDigitRun", role: "[code] draw fixed slot 0x02 (drawSlotShapeRecord) then hand off to emitCountDigitRun to lay down the numeric run.", cert: "seen" },
  0xaa97: { name: "emitCountDigitRun", role: "[code] publish a zero scale header (emitScaleWordIfChanged with 0x00) then emit the one-byte digit run for the slot named by loc_3d via loc_aa9e, drawing the count as nibble digits.", cert: "seen" },
  0xaa9e: { name: "emitSlotIndexDigit", role: "[code] Increments the slot index, publishes it into loc_61, and emits that single byte as a digit run.", cert: "seen" },
  0xaaa8: { name: "drawOverlayFrame", role: "[seen] the recurring per-frame overlay driver: draw the phase-selected slot from ROM table loc_a8b0[loc_9&0x03], tick timer loc_16e down, draw either alternate slot 0x32 (when loc_a bit0 set and loc_3 bit5 clear) or defer to computeDisplayListChecksum, always redraw marker slot 0x2c and slot 0x2e, clamp loc_6 to ceiling 0x28 and emit it via emitByteAsBcdDigits, and when loc_17 is nonzero post a final coordinate word (emitCoordinateVectorWord from loc_aaf4/loc_aaf3).", cert: "seen" },
  0xaaf5: { name: "packBinaryToBcd", role: "[code] Converts the binary byte in A to packed BCD by double-dabble and writes the packed digits into loc_29 and loc_2c.", cert: "seen" },
  0xab0d: { name: "emitFixedVectorWord", role: "[code] emit one fixed vector word (bytes 0x20, 0x80) through the draw cursor 0x74 and step past it (via loc_df57).", cert: "seen" },
  0xab14: { name: "drawSlotShapeRecord", role: "[seen] draw slot x's object record into the display list at cursor (loc_74): latch slot into loc_35, take the colour/header seed from ROM loc_d122+x into loc_2b, load the slot's shape-list pointer from (loc_ac)+x into loc_3b/loc_3c (snapshotting cursor into loc_b6/loc_b7 for marker slot 0x2c), position via loc_2a, split scale key loc_d121+loc_35 into emitColorStatIfChanged/emitScaleWordIfChanged, then walk the shape list copying point pairs from loc_31e4/loc_31e5 into (loc_74) until a high-bit terminator and close with advanceDisplayCursor.", cert: "seen" },
  0xab17: { name: "drawSlotShapeWithHeader", role: "[seen] draw slot x's object record like drawSlotShapeRecord but take the loc_2b colour/header seed from the argument a instead of ROM loc_d122: latch loc_35=x, loc_2b=a, load shape-list pointer (loc_ac)+x, set scale from loc_d121, expand the shape list of point pairs (loc_31e4/loc_31e5) into (loc_74) and close with advanceDisplayCursor.", cert: "seen" },
  0xab3b: { name: "expandShapeListToVectors", role: "[seen] the shared tail all three builders converge on: with loc_2a/loc_2b/loc_35 pre-seeded, clear loc_73, set loc_72=0x01, emit the intensity header (emitBlankVectorWordTag70) and beam-position record (emitScaledCoordinateRecord), reload the shape-list pointer from (loc_ac)+loc_35, split scale key loc_d121+loc_35 into emitColorStatIfChanged/emitScaleWordIfChanged, then walk the list copying point pairs from loc_31e4/loc_31e5 into (loc_74) until a high-bit terminator and close with advanceDisplayCursor.", cert: "seen" },
  0xab98: { name: "drawShapeListAtPosition", role: "[code] thin front over the shared builder: seat loc_35=x (slot), loc_2a=a (position seed), and a zero colour header loc_2b=0x00, then fall into expandShapeListToVectors to emit the slot's vector run.", cert: "seen" },
  0xaba2: { name: "rebuildControlBlocksIfRequested", role: "[code] guarded front for the rebuilder: refresh via loc_ac20, and if loc_1c9's low two request bits are clear take the no-op tail loc_ac07, otherwise run the rebuild path loc_abac.", cert: "seen" },
  0xabac: { name: "rebuildControlBlocksFromTemplate", role: "[code] control-block rebuilder: refresh via requestRebuildIfSwitchesChanged, write loc_100=0x08, raise the requests via raiseRebuildRequestBits when (loc_71b|loc_71c|loc_71d) are idle, then keyed on loc_1c9's low two bits copy template loc_ac08 into loc_606 (top 0x17 if bit0 else 0x0e) and fill loc_706 with 0x01 (top 0x17 if bit1 else 0x0e), latch loc_71e=(loc_a&0xf8)/loc_71f=(loc_16a&0x03) when any request bit was set, and clear the two request bits (loc_1c9 &= 0xfc).", cert: "seen" },
  0xac07: { name: "noRebuildRequestReturn", role: "[code] no-op return tail taken by rebuildControlBlocksIfRequested when no rebuild request bit is set in loc_1c9; does nothing and returns.", cert: "seen" },
  0xac20: { name: "requestRebuildIfSwitchesChanged", role: "[code] refresh the live option/switch snapshot via decodeOptionSwitches, then compare (loc_a & 0xf8) to cached loc_71e and (loc_16a & 0x03) to cached loc_71f: a match takes the no-op tail switchesUnchangedReturn, a mismatch calls raiseRebuildRequestBits to raise the pending-rebuild request bits.", cert: "seen" },
  0xac36: { name: "raiseRebuildRequestBits", role: "[seen] set both low request bits by OR-ing 0x03 into the pending-rebuild flags cell loc_1c9 and return the merged value.", cert: "seen" },
  0xac3e: { name: "switchesUnchangedReturn", role: "[code] shared no-op return tail taken by requestRebuildIfSwitchesChanged when the option/switch snapshot still matches the cached targets; does nothing and returns.", cert: "seen" },
  0xac3f: { name: "buildSortedSoundRequest", role: "[seen] build a sound draw request: clear bit6 of loc_5, pre-clear the staging block via clearChannelStagingBlock when loc_9&0x43==0x40, zero total loc_601; for each of the two channels (0 or 3 by loc_3e) seat the key triple loc_2c/loc_2d/loc_2e from loc_42/loc_41/loc_40 and bubble-sort the row triples loc_620/loc_61f/loc_61e (with payload loc_51e/loc_51f/loc_520) into lexicographic order, counting settle passes in loc_605 stored to loc_600,channel; then nudge loc_601, derive the packed request byte loc_603 from loc_3d, and hand off to the request walker armRequestedSoundSlot.", cert: "seen" },
  0xad22: { name: "armRequestedSoundSlot", role: "[seen] walk the packed request word loc_603 two bits at a time: on an empty word write idle status loc_0=0x14 and return; else take the low two bits as slot index loc_3d, consume them, read loc_600+index, skip slots whose byte is 0 or >=9, and for a live slot form loc_602 = ((3*byte) ^ 0xff) - 0xe5, call selectProjectionScale, seed loc_605=0x60/loc_4e=0/loc_50=0/loc_604=2, run the per-slot reset resetPerSlotStateTable, write armed status loc_0=0x24 and return.", cert: "seen" },
  0xad6e: { name: "tickActiveSoundSlot", role: "[code] per-frame tick of the active slot: set loc_1=0x06; while the low 5 bits of loc_3 are clear run countdown loc_605 down and on zero write loc_00=0x14 and return; otherwise clamp the active slot value loc_606,slot via foldStepIntoFraction (negative->0x1a, >=0x1b->0), gate on bits 3-4 of loc_4e (clearing them plus bit7), and when gated step cursor loc_602 and counter loc_604 -- on underflow re-arm (requestWriteLowRegions when loc_600,loc_3d < 4, then armRequestedSoundSlot), else clear the retired slot loc_606,slot-1.", cert: "seen" },
  0xadce: { name: "foldStepIntoFraction", role: "[code] fold the signed sub-step loc_50 (times 8) into the fraction cell loc_51, add the fold carry plus loc_50's sign-extension into A, and clear loc_50; returns the updated whole byte in A.", cert: "seen" },
  0xadea: { name: "drawScoreDeltaPanel", role: "[code] draw a fixed frame (loc_ab17/loc_ab14 chain), tick the countdown loc_16e down by one, then hand the score delta loc_602-loc_604 to the glyph-row builder drawHighlightedGlyphRowList.", cert: "seen" },
  0xae1c: { name: "seedRngAndDrawCounterPanel", role: "[seen] fold two POKEY random samples loc_60ca/loc_60da into scratch loc_29 and stored nibble loc_11f, draw the counters via drawCounterPair, then draw the highlighted glyph-row list via drawHighlightedGlyphRowList(0xff).", cert: "seen" },
  0xae4e: { name: "drawHighlightedGlyphRowList", role: "[seen] draw a descending run of glyph rows: prime the pen (loc_b0dd(0x01)), set column loc_2c=0x28 and row index loc_37=0x15, and each pass step loc_2c back 0x0a, position (loc_df75), select tag 0x00 when the row loc_37 equals the argument loc_63 else 0x07 (loc_b0d1), draw the glyph body (loc_dfb1/loc_b56a/loc_aef8), re-seat loc_56/loc_57/loc_58 from loc_706/loc_707/loc_708, and drop loc_37 by 3.", cert: "seen" },
  0xaeca: { name: "computeDisplayListChecksum", role: "[seen] publish the object-list gate checksum and optionally draw a flag record: when loc_156 is nonzero seat it into loc_58, open a record (drawSlotShapeRecord 0x34) and emit a cleared coordinate pair (loc_56=loc_57=0x00, emitNibbleDigitRun); always fold the seventeen bytes at loc_d575 (indices 0x10..0) into an accumulator seeded 0x85 with carry and store the result to loc_b5 (the end-of-list gate buildObjectDisplayList reads).", cert: "seen" },
  0xaef8: { name: "drawThreeCharGlyphString", role: "[seen] render three characters into the display list: walk three codes from the text buffer 0x606 (position at 0x38, count at 0x39), clamp each code to 0x1a (0x1e+ folds to 0x1a), double it to index glyph word table 0x31fa, copy each 2-byte glyph word to the cursor 0x74, then advance the cursor past everything written.", cert: "seen" },
  0xaf26: { name: "drawCounterPair", role: "[seen] when either counter byte loc_600/loc_601 is nonzero, draw a shared header (loc_ab14(0x12), emitCappedCount(0x63)) and both counter slots via drawCounterSlot(0x00) and drawCounterSlot(0x01); otherwise return through the bare tail loc_af6e.", cert: "seen" },
  0xaf3f: { name: "drawCounterSlot", role: "[seen] draw one counter slot x: return when count loc_600+x is zero, else record the slot in loc_2e, position it at loc_af6f+loc_2e (loc_df75), and emit the capped count (emitCappedCount, loc_b56a, loc_ab98, loc_aa9e).", cert: "seen" },
  0xaf6e: { name: "sharedReturnTail", role: "[code] no-op leaf: return immediately; the shared RTS tail that drawCounterPair falls through to when both counters loc_600/loc_601 are zero.", cert: "seen" },
  0xaf71: { name: "emitCappedCount", role: "[code] clamp the incoming byte to a max of 0x63 (99), then pack-and-emit it via loc_af77.", cert: "seen" },
  0xaf77: { name: "emitByteAsBcdDigits", role: "[code] Packs the incoming byte to BCD (into loc_29) then emits that single zeropage byte as its two decimal nibbles.", cert: "seen" },
  0xaf81: { name: "drawTubeWell", role: "[seen] draw the whole playfield well: refresh gates (selectProjectionScale), tick loc_16e, draw the eight rim segments walking loc_37 7->0 (drawSlotShapeRecord(loc_b09b+loc_37)), nudge the depth window pair loc_7b/loc_7c one step toward target loc_200 (bounded by ceiling loc_127), draw five depth rows deepest-first from loc_91fe+loc_3a (skipping rows >=0x63; emitTableValueDigitRun/drawTubeShapeOutline), and close with a framing draw and a four-entry trailer walk over loc_b0a3.", cert: "seen" },
  0xb0ab: { name: "nudgeBlasterRimPosition", role: "[code] nudge the blaster's rim position loc_200 by its signed sub-step (via foldStepIntoFraction), clamp into [0, ceiling loc_127] (a negative result floors to 0, an over-ceiling result pins to loc_127), write it back to loc_200, and return it in both A and Y.", cert: "seen" },
  0xb0c6: { name: "emitTableValueDigitRun", role: "[code] Seats a table pointer by index (via loc_91b5) then emits the three-byte zeropage run at loc_29 as nibble digits.", cert: "seen" },
  0xb0d1: { name: "emitColorStatIfChanged", role: "[seen] emit a colour/intensity stat word (emitTaggedVectorWord with 0x08 and y) into the display list only when it changes: return if loc_9e already equals y, otherwise latch loc_9e=y and emit — the coarse (high-nibble) scale/colour attribute for the current slot.", cert: "seen" },
  0xb0dd: { name: "emitScaleWordIfChanged", role: "[seen] emit a scale word (emitBlankVectorWordTag70 with a) into the display list only when it changes: return if a already equals loc_72, otherwise latch loc_72=a and emit — the fine (low-nibble) scale attribute for the current slot.", cert: "seen" },
  0xb0e7: { name: "seedModeParamsWithBounds", role: "[seen] alternate state-entry seeder: write loc_0=0x0a, loc_2=0x00, loc_4=0xdf, loc_1=0x12, loc_14e=0x19 and loc_14d=0x18 into the config block plus the two bound cells.", cert: "seen" },
  0xb102: { name: "advanceSpreadingSpanAnimation", role: "[code] redraw the paired-cursor span via emitSegmentedSpanBetweenCursors(0x34,0xaa) then spread the two cursors apart one frame: wrap the far cursor loc_14e up by 0x14 while below 0xa0, and once it clears 0x50 step the near cursor loc_14d up by 0x08, pinning it at 0xa0 and latching phase byte loc_1=0x14 when near reaches far.", cert: "seen" },
  0xb131: { name: "advancePinchingSpanAnimation", role: "[code] redraw the paired-cursor span via emitSegmentedSpanBetweenCursors(0x3f,0x4e) then squeeze the two cursors together one frame: decrement the near cursor loc_14d while at/above 0x30 (bail if it wraps to >=0x80) and pull the far cursor loc_14e down by one but never below the near cursor.", cert: "seen" },
  0xb15a: { name: "emitSegmentedSpanBetweenCursors", role: "[code] emit a segmented vector run spanning the near-to-far cursor pair: stash A/X into loc_57/loc_56, seed loc_37 from the near cursor loc_14d, decrement loc_16e, and for each step (cursor +=2 until it reaches the far cursor loc_14e) lay a header word (emitVectorWordTag70), a position-derived marker (emitTaggedVectorWord 0x68 with segment (cur>>3)&7, 7->3, 0 at the start) and the stashed coordinate pair (emitCoordinateVectorWord), then two fixed trailer words (drawSlotShapeWithHeader 0xd0,0x2c and emitCoordinateVectorWord 0x3f,0xf2).", cert: "seen" },
  0xb230: { name: "drawFrame", role: "[seen] draw one whole frame: route each drawing subsystem in a fixed layer order (ids 0x07,0x04,0x03,0x06,0x05,0x00,0x01,0x08), bracketing each with cursor-setup loc_b2be and teardown loc_b2fe; inside the player layer (0x00), when 0x5 bit7 is clear, sum a 40-byte block reached via pointer 0xb6/0xb7 into status cell 0x11b, then zero change-counter 0x114 and latch ROM constants 0xcec2/0xcec3 into head words 0x2000/0x2001.", cert: "seen" },
  0xb1b6: { name: "buildFrameVectors", role: "[seen] per-frame vector housekeeping: clear frame work cells (resetMathboxInputs), early-return when guard cells 0x2000==0xcec6 && 0x133==0 say the frame is settled; when mode cell 0x1==0 hand the whole draw to the frame builder drawFrame; otherwise publish the active pointer, run the computed-jump trampoline dispatchDisplayModeHandler, fold a 40-byte block under 0xb6 into checksum 0x455 (unless emitFrameLink reports a change), then emit the trailing header and latch 0xcec4/0xcec5 into display words 0x2000/0x2001.", cert: "seen" },
  0xb20d: { name: "dispatchDisplayModeHandler", role: "[seen] computed-jump trampoline turned on by the vector housekeeping: the pre-doubled selector in mode cell 0x1 picks one of twelve display-mode targets (drawFrame, loc_d804, loc_b8ba, ...) from the word table and runs it, dissolved here into a direct TABLE[0x1>>1] select.", cert: "seen" },
  0xb2be: { name: "seatDrawCursor", role: "[seen] seat the indirect draw cursor 0x74/0x75 for a layer: at stride 2*index pick the 16-bit pointer from table 0xce68 (when per-index flag 0x415+index is nonzero) else 0xce7a, publish it into 0x74/0x75, then clear status cell 0xa9.", cert: "seen" },
  0xb2de: { name: "seatAltDrawPointer", role: "[seen] seat the alternate draw pointer 0x3b/0x3c: at stride 2*index pick from table 0xce7a (when flag 0x415+index nonzero) else 0xce68 (table sense reversed vs seatDrawCursor), publish it into 0x3b/0x3c, then clear status cell 0xa9.", cert: "seen" },
  0xb2fe: { name: "closeLayerPointer", role: "[seen] close a layer: emit a header record (emitRecordBodyC0), seat base pointer from 0xce8c/0xce8d at stride 2*slot, toggle the layer's parity flag 0x415+slot, and write the ($3b) pointer target with the word chosen by parity — 0xceb0/0xceb1 when set, else 0xce9e/0xce9f.", cert: "seen" },
  0xb332: { name: "emitFrameLink", role: "[seen] emit a frame-link record with a mid-frame-change guard: if source 0xcec4 differs from checkpoint 0x2000, latch it into 0x2000 and return carry set (caller redoes the frame); else copy a word from 0xce9e (offset 8 when 0x415 nonzero, else 2) through cursor 0x74, clear 0x16e, reload cursor 0x74/0x75 from 0xce68 at that offset, and return carry clear.", cert: "seen" },
  0xb367: { name: "paintRimLanes", role: "[seen] rebuild the sixteen-entry lane-flag block 0x425 from the active enemy tables (depth 0x2df, lane 0x283, near/far segments 0x2cc/0x2b9) and paint the rim lanes: an optional pre-pass seats pointers (seatDrawCursor/initAndDrawRimDepthCounters/closeLayerPointer on 0x114), a first pass writes each column's colour value through the ($3b) list, and a second pass ORs colour bits (0x00 or 0xc0) into the ($b0) list.", cert: "seen" },
  0xb498: { name: "buildObjectDisplayList", role: "[seen] build a vector display list for up to 0x12 active objects (kind from tag table 0x243, coords via 0x203 into the four coord banks 0x35a/0x36a/0x37a/0x38a): emit a rotated header code, screen-relative coordinate words and their negated shadow words per object through cursor 0x74/0x75, flushing the cursor when the byte offset saturates, then close with a trailing header (emitBlankVectorWordTag70).", cert: "seen" },
  0xb56a: { name: "emitBlankValueRecord", role: "[seen] Stores 0, 0, 0, A into the four bytes at the working pointer loc_74/loc_75 and advances the cursor by four.", cert: "seen" },
  0xb586: { name: "drawScoreStatusList", role: "[seen] build the score/status vector run: raise rebuild flag 0x9e=0x01, read gate 0x202 and bail if 0 or >=0xf0, else latch it into 0x57 and 0x2f and — unless marker 0x201 holds 0x81 — kick the run builder drawTubeRimSegmentFromCorner with corner index 0x200 and size ((0x51>>1)&7)+1.", cert: "seen" },
  0xb5ad: { name: "drawStyledSlotList", role: "[seen] draw a per-slot vector record for seven slots (0x37 from 6 down) when guard 0x106 bit7 is clear: for each non-empty control 0x2df+x cache it in 0x57, split paired byte 0x283+x into style nibble 0x55=(paired&0x18)>>3 and a doubled selector (paired&7)<<1, and dispatch the style's draw handler via dispatchSlotDrawHandler carrying slot index x.", cert: "seen" },
  0xb5d7: { name: "dispatchSlotDrawHandler", role: "[seen] computed jump: select one of five slot-draw handlers [loc_b5eb,loc_b71b,loc_b60f,loc_b622,loc_b69b] by A>>1 and tail-return its result, carrying the slot index x.", cert: "seen" },
  0xb5eb: { name: "drawSlotRimSegment", role: "[seen] draw the rim segment for slot x: set run count loc_9e=0x03, and on a negative slot byte loc_283+x prep a coordinate (buildSlotScreenPoint) and build at corner 0 (emitTubeRimSegmentVectors(0)), else build at the slot's own corner loc_2b9+x with a header picked from loc_b60b by style loc_55.", cert: "seen" },
  0xb60f: { name: "emitJumpModeSlot", role: "[code] Pairs a jump-mode byte from table loc_b61e (indexed by loc_28a+x & 0x03) with slot target loc_2b9+x and emits via bcfd.", cert: "seen" },
  0xb622: { name: "emitAnimatedPhaseSlot", role: "[code] Pairs slot target loc_2b9+x with a four-phase animation offset (((loc_3 & 0x03)<<1)+0x12) and emits via bcfd.", cert: "seen" },
  0xb634: { name: "buildSlotScreenPoint", role: "[seen] build slot x's screen point: index base coords loc_3ce/loc_3de by the slot's segment loc_2b9,x into loc_56/loc_58, offset each by the signed animation delta loc_b68b/loc_b687 at phase loc_2cc,x&0x0f (0x80-biased saturating add) into loc_2e (X)/loc_30 (Y), copy loc_57 to loc_2f, and load the style pair loc_bcdc/loc_bcec at loc_112 into loc_59/loc_5a.", cert: "seen" },
  0xb69b: { name: "emitInterpolatedSlotVector", role: "[code] Builds slot x's screen position from loc_2df+x and segment base loc_3ce/loc_3de (segment loc_2b9+x), interpolating toward the next segment via b6fa when loc_2cc+x is negative, then folds deltas (c098), lays the header (c765), appends the pair (bd3e), and emits a frame-phased template word from loc_cec8/loc_cec9.", cert: "seen" },
  0xb6fa: { name: "scaleByPhaseFraction", role: "[code] Scales a value by slot x's low-three-bit phase fraction (loc_2cc+x & 0x07 into loc_2c) via three LSB-first conditional-add rounds with sign-preserving right shifts.", cert: "code" },
  0xb71b: { name: "drawStyledSlotRimSegment", role: "[code] draw the rim segment for slot x with an animation style: latch loc_9e from loc_148's sign (0x04 if negative else 0x00) and a style byte loc_29 from loc_b755 indexed by ((loc_148+0x40)&0xff)>>4 (clamped to 0 when >=5), then split on loc_283+x's sign into buildSlotScreenPoint+emitTubeRimSegmentVectors(loc_29) or drawTubeRimSegmentFromCorner(loc_29,loc_2b9+x).", cert: "seen" },
  0xb75b: { name: "drawSlotShapeList", role: "[seen] emit a shape vector for each of twelve slots (index 0x37 from 0x0b down): for each non-empty entry 0x2d3+x seat the shape in 0x57/0x2f, read target 0x2ad+x, and emit via seatShapeParamsAndEmit (near value 0x08 for x<8, phase-derived for far slots); afterward latch a per-level segment colour (0x04/0x0b/0x0c by stage 0x135) into colour RAM 0x808.", cert: "seen" },
  0xb79a: { name: "drawEnemyShapeList", role: "[seen] emit one shape record per active enemy slot (0x37 from 7 down): clear 0x9e, and for each non-empty 0x30a+slot seat 0x57 and 0x29(=0x2fa+slot); shape 1 draws specially via animateShapeOneVector, else compute a shape word from 0x312+slot and 0xb7e5+shape and emit via seatShapeParamsAndEmit; finally latch 0x9f into 0x1ff when 0x720 nonzero and 0x9f>=0x0d.", cert: "seen" },
  0xb7eb: { name: "animateShapeOneVector", role: "[code] advance and emit the shape-1 enemy animation: refresh axis params loc_56/loc_58 from loc_435/loc_445 at loc_29, run frame updaters (projectPointThroughMathbox, layHeaderAndBuildRecord), tick sub-timer loc_13c and on wrap advance phase loc_13b and reload loc_13c from loc_b82a+loc_13b, run phase handler dispatchDrawSetup when loc_b83d+loc_13b<0x80, then emit the phase's vector-pair word from loc_cec8/loc_cec9 at ((loc_13b<<1)+0x28)&0xff.", cert: "seen" },
  0xb84e: { name: "dispatchDrawSetup", role: "[code] computed-jump dispatcher: caller's Y is a byte offset (0,2,4,6) selecting one of four draw-setup targets loc_b85f/loc_b875/loc_b888/loc_b896, and it tail-returns that routine's result.", cert: "seen" },
  0xb85f: { name: "seedTripleArrays", role: "[code] seed the paired three-entry arrays 0x22-0x24 and 0x809-0x80b with the fixed values 0x00, 0x04, 0x0c.", cert: "seen" },
  0xb875: { name: "rotateTripleArray", role: "[code] rotate the three-entry array 0x22-0x24 down by one, threading the wrapped value, and mirror each new entry into paired array 0x809-0x80b.", cert: "seen" },
  0xb888: { name: "resetVectorTailCursor", role: "[code] rebuild the packed-nibble table via unpackLevelNibbleTables, then seat the vector-list tail cursor 0x139=0x7f and 0x13a=0x04.", cert: "seen" },
  0xb896: { name: "emitVectorTailRecord", role: "[code] emit a vector-RAM tail record from cursor 0x139/0x13a — low byte to 0x2ffc, high byte tagged 0x70 to 0x2ffd, 0xc0 terminator to 0x2fff — then step the cursor down by 0x20 with a 16-bit borrow into 0x13a and mask the low byte to 0x7f.", cert: "seen" },
  0xb8ba: { name: "drawMovingObjectSlots", role: "[code] draw the 16-slot moving-object cascade into the display list: reset accumulators (loc_6a-loc_6d, loc_202, loc_68/loc_69) with loc_5f=0xe0/loc_5b=0xff, cache the base draw-struct pointer from selectPointerPair into loc_76/loc_77, lay an opening coord (emitCoordinateVectorWord), then count loc_37 from 0x0f down and for each active slot (loc_283+x nonzero) load loc_57/loc_56/loc_58 from loc_283/loc_263/loc_2a3+x, integrate deltas (projectPointThroughMathbox), emit the record body (emitCoordDeltaRecord, emitBlankValueRecord, emitObjectPositionVector) with pointer-swap shadow passes (swapDrawPointers), and set the slot phase into loc_9e; closes by swapping pointers back and finishing the base list (emitBlankVectorWordTag70, emitRecordBodyC0).", cert: "seen" },
  0xb944: { name: "swapDrawPointers", role: "[code] swap the two 16-bit draw pointers 0x74/0x75 and 0x76/0x77 so the shared cursor addresses the other structure.", cert: "seen" },
  0xb955: { name: "returnConstantTwo", role: "[code] register-only leaf that always returns the constant pair A=0x02, Y=0x00 and touches no memory.", cert: "code" },
  0xb967: { name: "selectPointerPair", role: "[code] select a pointer pair by flag 0x415: zero picks 0xce87/0xce86, nonzero picks 0xce6f/0xce6e; returns the pair as (A,X).", cert: "seen" },
  0xbcfd: { name: "seatShapeParamsAndEmit", role: "[seen] Stashes the value byte into loc_55 and loads loc_435+y/loc_445+y into loc_56/loc_58, then emits the coloured shape vector (bd09).", cert: "seen" },
  0xbd09: { name: "emitColoredShapeVector", role: "[seen] Folds deltas (c098), lays the header (c765), appends the pair (bd3e), clamps a colour/intensity nibble from loc_78 (XOR 0x07, doubled, floored to 0x0a, high nibble) OR'd with 0x60, and emits a template word keyed by loc_55.", cert: "seen" },
  0xbd3e: { name: "appendNormalizedMantissaExponent", role: "[seen] Appends a (mantissa, exponent) pair for loc_57: trivial (1,0) when loc_57<0x10, else drives the math box on loc_57-loc_5f/loc_5b and normalizes loc_79 into shift count loc_78; writes the pair (exponent tagged 0x70) at cursor loc_a9.", cert: "seen" },
  0xbda0: { name: "drawTubeRimSegmentFromCorner", role: "[seen] draw one tube-rim segment: fetch the source corner (loc_3ce+y/loc_3de+y into loc_56/loc_58, loc_2f from loc_57) and the next corner ((y+1)&0x0f) into loc_2e/loc_30, seed run counters loc_59=0 and loc_5a=4, then fall into emitTubeRimSegmentVectors to emit the segment's four-byte vector records.", cert: "seen" },
  0xbdcb: { name: "drawTubeRimSegmentFromCorner", entry: "emitTubeRimSegmentVectors", role: "[seen] emit the tube-rim segment's vector records: gate (unless loc_5b bit7, return when loc_57<loc_5f), read record count loc_99 and cursor loc_38 from loc_bfb6/loc_bfc4, project both endpoints through the math box (projectPointThroughMathbox), form two clamped signed deltas (loc_79/loc_9b, loc_89/loc_9d), expand the fivefold spread, then write loc_99 four-byte records into (loc_74)+loc_a9 and close with advanceDisplayCursor.", cert: "seen" },
  0xc098: { name: "projectPointThroughMathbox", role: "[seen] Projects one tube-space point into a screen-coordinate pair: forms clamped signed deltas from loc_57/loc_5f/loc_5b/loc_58/loc_60/loc_56/loc_5e into the math box, then folds offset pairs loc_68/loc_69 and loc_66/loc_67 into accumulators loc_63/64 and loc_61/62 with saturation.", cert: "seen" },
  0xc16e: { name: "buildLevelLayout", role: "[seen] build the current level's full layout: prime working flags (0x5e=0x80, 0x114=0xff), build the tube lane coordinates via buildTubeLaneCoords, clear 0x5800 only when mode trigger 0x133 was already zero then force 0x133=0, mirror header bytes 0xcec6/0xcec7 into display registers 0x2000/0x2001, and inline the 0xc1fd nibble unpack into 0x19/0x800 and 0x21/0x808.", cert: "seen" },
  0xc196: { name: "unpackLevelNibbleTables", role: "[seen] expand the packed ROM level table 0xc1fd into the working nibble tables: mask selector 0x9f with 0x70 clamped to 0x5f, form read index (sel>>1)|0x07, and for y=7..0 write each packed byte's low nibble into 0x19+y and display mirror 0x800+y and its high nibble into 0x21+y and mirror 0x808+y.", cert: "seen" },
  0xc1c3: { name: "resetMathboxInputs", role: "[seen] clear the working state before a tube-projection run: zero the zero-page scratch cells 0x78/0x80/0x81/0x88/0x90/0x91 and the math-coprocessor input block 0x6080/0x6081/0x6083/0x6084/0x6085/0x6086/0x6087/0x6089/0x608d/0x608e/0x608f/0x6090, then write 0x0f into the control latch 0x608c to arm the coprocessor.", cert: "seen" },
  0xc235: { name: "buildTubeLaneCoords", role: "[seen] lay out the current level's tube: reduce table byte 0x46+0x3d through resolveShapeTableIndex to get shape row y (0x112), derive span cells (negated 0xbc8c+y into 0x5f/0x5d, 0x10-neg into 0xa0, 0x5b=0xff, 0x60=0xbc9c+y, 0x111=0xbccc+y), copy or shift-right the offset pair 0x68/0x69 (scale into 0x121) by mode 0x2, clear 0x66/0x67/0x10f/0x110 and set 0x113=0x2c, then seed the per-lane vertex arrays 0x3ce/0x3de/0x3ee from ROM vertex tables 0xb97c/0xba7c/0xbb7c (clearing 0x31a/0x33a/0x39a) and fill midpoint arrays 0x435/0x445 by rounding-averaging adjacent lanes.", cert: "seen" },
  0xc2e8: { name: "resolveShapeTableIndex", role: "[seen] reduce an input byte into the level/shape table index: values >= 0x62 are swapped for the POKEY random byte 0x60ca AND 0x5f, the value is split into quotient (>>4) and remainder (&0x0f), the remainder indexes ROM table 0xbc7c whose entry is stored to shape-index cell 0x112 and returned packed into the high nibble with the low nibble forced to 0x0f (quotient/remainder in X/Y).", cert: "seen" },
  0xc30d: { name: "initAndDrawRimDepthCounters", role: "[seen] first-time rim-counter setup: when loc_110==0 seed loc_110/loc_10f through the projection integrator projectAllLanesThroughMathbox (nudging the low counter via snapCoordUpToReference when it lags at index 0x0f), always emit a header (emitBlankVectorWordTag70, loc_9e=0x06), return unless both counters live and loc_113!=0, then clear the record slots two-at-a-time via drawFramedCounterSlot and draw each counter's record set with drawGatedRecordLoop.", cert: "seen" },
  0xc36e: { name: "drawGatedRecordLoop", role: "[seen] Returns when gate A is nonzero; else seats loc_61-64 from loc_32a/loc_31a/loc_34a/loc_33a at loc_37, emits the header (c772), and draws one record per pass over 0x0f passes (0x0e when loc_111 is set), bumping the index by 0x10 on low-nibble wrap.", cert: "seen" },
  0xc3ba: { name: "emitCoordDeltaRecord", role: "[seen] Forms two 16-bit differences of loc_61/loc_63 minus previous loc_6a/loc_6c into delta slots loc_6e-loc_71, emits the record, latches current into loc_6a-loc_6d, and sets loc_73=0xc0.", cert: "seen" },
  0xc3ee: { name: "drawFramedCounterSlot", role: "[seen] draw a framed counter element in two passes: emit slot loc_37 with colour loc_73 live (loc_c43c/loc_c423), step loc_37 back one and re-emit uncoloured, restore the colour and close the frame (loc_c3ba); return the stepped-back index.", cert: "seen" },
  0xc423: { name: "emitProjectedSlotRecord", role: "[seen] Copies slot loc_37's projected-delta cells loc_32a/loc_31a/loc_34a/loc_33a into loc_61-loc_64 and emits the delta record.", cert: "seen" },
  0xc43c: { name: "loadSlotCoordBlock", role: "[seen] Reads slot index loc_37 and copies that column of loc_36a/loc_35a/loc_38a/loc_37a into the working coord block loc_61-loc_64.", cert: "seen" },
  0xc453: { name: "snapCoordUpToReference", role: "[seen] When guard loc_5b is clear and loc_57 sits under 0x0c above reference loc_5f, raises loc_57 to loc_5f+0x0f, capped at ceiling 0xf0.", cert: "seen" },
  0xc473: { name: "projectAllLanesThroughMathbox", role: "[seen] project the sixteen tube lanes: from loc_57=A and out index loc_38=x, run 16 passes loading each column's base coords from loc_3ce/loc_3de into loc_56/loc_58, drive projectPointThroughMathbox, clamp both signed high-byte results into [-4..+3] (0xfc..0x03) writing value/sign into loc_31a/loc_32a and loc_33a/loc_34a at loc_38, tally each clamp in loc_59, and return the clamp count.", cert: "seen" },
  0xc4e1: { name: "drawTubeShapeOutline", role: "[seen] draw a sixteen-segment tube-shape outline: reduce the input byte via resolveShapeTableIndex (reduced->loc_36, quotient->loc_35), emit a framing record, pick a header from loc_c22d by loc_35&0x07 into loc_9e, seat the first vertex from loc_b97c/loc_ba7c (biased 0x80, seed rolled back 0x0f when loc_bccc+loc_112 is zero), then walk 16 steps emitting each signed vertex delta from loc_b97c/loc_ba7c.", cert: "seen" },
  0xc54d: { name: "drawTimedObjectList", role: "[seen] draw eight slots from table 0x3fe while guard 0x115 is set (forcing 0x5f=0xe8, 0x5b=0xff, 0xa0=0x28): per non-empty entry seat 0x57 with 0x56=0x58=0x80, pick a colour mode into 0x9e (slot&7 with 7->4 when 0x9f>=5, else 6), emit via emitTaggedVectorWord, set style 0x55=((slot&3)<<1)+0x0a, and draw via emitColoredShapeVector; restore the forced cells; tail increments 0x200+0x40 when 0x11f set and 0x42>=0x15.", cert: "seen" },
  0xc5c2: { name: "buildEnemyDisplayList", role: "[seen] rebuild the per-frame enemy display list over up to sixteen slots (0x37 from 0x0f, 0x0e when 0x111 set): early-out on gates 0x110/0x5b/0x5f, then per slot copy the fixed 4-byte header 0xc669 through cursor 0x74 at offset 0xa9 and append either a computed midpoint pair (emitSlotMidpointVertex + emitEnemySlotEntry) when 0x114 set, or a straight/sign-fixed coordinate block read from ($aa); restores the saved cursor 0xaa/0xab and flushes via advanceDisplayCursor.", cert: "seen" },
  0xc66d: { name: "emitSlotMidpointVertex", role: "[seen] Round-up averages tube slot loc_38's two coord pairs (loc_36a/loc_35a, loc_38a/loc_37a) with its wrap neighbour (loc_38+1 & 0x0f) into loc_61-loc_64 and appends four midpoint bytes (high bytes masked 0x1f) to the display list at loc_a9.", cert: "seen" },
  0xc6c7: { name: "emitEnemySlotEntry", role: "[seen] Emits one enemy-slot vector entry keyed by kind byte loc_3ac+loc_38: four blank+0x71 pairs when inactive, else seats loc_57/loc_56/loc_58, clamps depth via c453, runs c098/c73c, and appends a random (loc_60ca-selected) or fixed marker word per loc_39a bit6.", cert: "seen" },
  0xc73c: { name: "emitDeltaVectorPair", role: "[seen] Emits two 16-bit differences (loc_63:64 minus loc_6c:6d, then loc_61:62 minus loc_6a:6b) as vector words, high bytes masked to five bits and the second OR'd with opcode 0xa0, advancing cursor loc_a9 by four.", cert: "seen" },
  0xc765: { name: "layHeaderAndBuildRecord", role: "[code] Writes the fixed header word 0x00/0x71 at the draw cursor start (loc_74/loc_75) then resumes the shared vector-record builder from cursor slot 2.", cert: "seen" },
  0xc772: { name: "emitObjectPositionVector", role: "[seen] emit an object's position vector: from cursor offset 0, write the {0x40,0x80} header, an X word from zero-page pair 0x2/0x3 indexed by X and a Y word from pair 0x00/0x1 (each high byte masked to 5 bits), caching the raw bytes as the previous point (X low/high at 0x6c/0x6d, Y low/high at 0x6a/0x6b), then advance the cursor 0x74/0x75 past the six emitted bytes.", cert: "seen" },
  0xc774: { name: "emitObjectPositionVector", entry: "emitObjectPositionRecord", role: "[code] emit a six-byte object position record into the vector list at write cursor loc_74/loc_75 offset Y: a fixed header (0x40,0x80) then the object's X pair (loc_2+x low, loc_3+x high masked to 5 bits) and Y pair (loc_00+x low, loc_1+x high masked to 5 bits), caching the raw bytes into loc_6c/loc_6d/loc_6a/loc_6b, then advancing the cursor past the bytes via advanceDisplayCursor (entry emitObjectPositionVector starts the offset at 0).", cert: "seen" },
  0xc7bd: { name: "dispatchFramePhaseHandler", role: "[seen] DSW-gated per-frame handler dispatch: do nothing when the coinage dip (0xd00 & 0x83) reads 0x82; otherwise run a pre-pass (loc_a7d2), set bit7 of 0x4e, and select one of eighteen per-frame handlers by the byte offset in 0x00 (index offset>>1 into a 19-entry table whose one slot is unused).", cert: "seen" },
  0xc7a0: { name: "runMainFrameLoop", role: "[seen] the main frame loop (a generator): after a one-time board-init pass (resetBothPokeyChips) and seeding 0x00=0, free-run forever -- each pass yields until the interrupt counter 0x53 reaches 9, clears it, and runs the three per-update passes dispatchFramePhaseHandler, seedFramePhaseAndTick, buildFrameVectors (~26.5Hz).", cert: "seen" },
  0xc800: { name: "commitPendingModeAfterDelay", role: "[seen] while the guard loc_3 & loc_16b is set do nothing; otherwise run delay counter loc_4 down and, on the frame it reaches zero, load the live mode loc_0 from the pending mode loc_2 and clear the guard loc_16b; every path tail-delegates the spinner update rotateBlasterAroundRim.", cert: "seen" },
  0xc81b: { name: "advanceLevelCounter", role: "[code] from the 2-bit gate loc_4e&0x60 (then cleared) and a >=2 test on counter loc_6 derive a step 0..2 and drain loc_6; when the gate is clear optionally seed intro cells (loc_1/loc_4/loc_0/loc_2, gated by loc_50 and loc_5 bit7); when the step is nonzero set loc_5|=0xc0, zero loc_16/loc_18/loc_0, bump the 16-bit tally loc_40c,x/loc_40d,x, and advance the level cell loc_100 by step+1 clamped to 0x63.", cert: "seen" },
  0xc891: { name: "seedFramePhaseAndTick", role: "[seen] per-frame mode/timing driver: from coin input 0xc00, mode flag 0x5 and phase counters 0xa/0x6, seed the phase/speed cells 0x00/0x1/0xa2 (running the setup step advanceLevelCounter on the appropriate phase), then a common tail advances the frame counter 0x3, fires the EAROM step stepEaromTransfer on odd frames and the sound-register step requestActiveSoundCue when 0xc is live, and trims bit7 of 0x4e.", cert: "seen" },
  0xc97b: { name: "seedModeParamsMinimal", role: "[seen] alternate state-entry seeder: write the four config cells loc_2=0x04, loc_1=0x00, loc_0=0x0a and loc_4=0x14.", cert: "seen" },
  0xc9af: { name: "tickEnemyPacingCountdown", role: "[seen] clear loc_4, decrement the active slot's countdown loc_48[loc_3d]; when the loc_48/loc_49 pair is fully spent finalize via reloadPacingFromPeakSlot, otherwise (flag loc_1=0x0c and loc_4=0x28 if this tick hit zero) toggle loc_3f to pick the next non-empty slot, arm its timer loc_2 (0x1c when loc_46[x]+1 wraps, else 0x02), and request mode loc_0=0x0a.", cert: "seen" },
  0xc9f1: { name: "reloadPacingFromPeakSlot", role: "[seen] scan the zero-page window loc_46[loc_3e..0] for its maximum, store it decremented-once (when nonzero) into loc_126, and set the mode-request cell loc_0 to 0x14 (or 0x10 when the status byte loc_5 is negative).", cert: "seen" },
  0xca18: { name: "seedModeParamsFromMaskedFlags", role: "[seen] alternate state-entry seeder: mask loc_5 to its low six bits (clearing the top two flag bits), then write loc_3e=0x00, loc_2=0x1a, loc_0=0x0a, loc_4=0xa0, loc_16b=0x01 and loc_1=0x0a.", cert: "seen" },
  0xca48: { name: "selectProjectionScale", role: "[seen] choose the projection scale and mode bit from gates loc_117/loc_3d: default value 0x00/scale 0x10, but when both gates are nonzero value 0x04/scale 0x08; copy bit2 of the value into flag loc_a1 (preserving the rest) and store the scale into loc_b4.", cert: "seen" },
  0xca62: { name: "clearChannelStagingBlock", role: "[seen] zero the six-byte working block loc_40..loc_45 (a pre-clear used before that block is staged with fresh channel entries).", cert: "seen" },
  0xca6c: { name: "addBcdScoreAndAwardAtThreshold", role: "[seen] add a three-byte BCD amount into the score triplet at loc_40/loc_41/loc_42 (offset 0 when loc_3d==0 else 3) using fixed table bytes loc_caf1+x/loc_caf9+x when index x<0x08 else the live operand triplet loc_29/loc_2a/loc_2b, then range-check against threshold loc_156; on qualifying, if the per-slot counter loc_48+loc_3d is under 0x06 bump it, fire sound 0x4f via requestSoundIfEnabled and set loc_124=0x20; gated off unless loc_5 bit7 is set.", cert: "seen" },
  0xccb0: { name: "gateSound5f", role: "[code] cue the fixed sound id 0x5f through the sound gate, carrying the caller's X/Y.", cert: "seen" },
  0xccb5: { name: "cueRimRotationSound", role: "[code] load fixed sound id 0x0f and pass it through the sound gate loc_ccc3 (keeping caller X/Y); rung by loc_9749 when the coarse rim angle changes, i.e. the spinner-rotation sound cue.", cert: "seen" },
  0xccb9: { name: "requestScoreAwardSound", role: "[code] one-line cue: request fixed sound id 0x4f through the enable gate loc_ccc3; caller loc_c98c fires it on the bonus/level-advance handler chain, and the same id 0x4f is fired by the score-award path loc_ca6c, so it voices a score/bonus award.", cert: "seen" },
  0xccbd: { name: "gateSound8f", role: "[code] cue the fixed sound id 0x8f through the sound gate, carrying the caller's X/Y.", cert: "seen" },
  0xccc1: { name: "gateSound1f", role: "[code] cue the fixed sound id 0x1f through the sound gate, carrying the caller's X/Y.", cert: "seen" },
  0xccc3: { name: "requestSoundIfEnabled", role: "[code] sound enable gate: only when bit7 of the enable flag loc_5 is set, forward the sound id in A (with X/Y) to the loader loadSoundVoiceSlots; with sound disabled it returns making no write.", cert: "seen" },
  0xccc7: { name: "loadSoundVoiceSlots", role: "[seen] sound loader: stash caller X/Y into loc_31/loc_32, read the sound's row of bytes from loc_cb01 by descending id, and for each nonzero table byte claim its slot -- mark slot in loc_bf, write the byte to loc_c0,x, set fast/slow flags loc_e0,x and loc_f0,x to 1, then restore the 0xff sentinel to loc_bf.", cert: "seen" },
  0xccea: { name: "requestEnemySpawnSound", role: "[code] one-line cue: request fixed sound id 0x2f through the enable gate loc_ccc3, forwarding slot index X; its sole caller is the enemy spawner loc_a23f, so it voices a new enemy entering the tube.", cert: "seen" },
  0xccee: { name: "cueMovingSpikeStartSound", role: "[code] register the fixed sound id 0x6f through the sound-enable gate loc_ccc3 -- the moving spike's start cue, fired by loc_97f8 at trigger height loc_202==0x10.", cert: "seen" },
  0xccf2: { name: "cueMovingSpikeEndSound", role: "[code] register the fixed sound id 0x7f through the sound-enable gate loc_ccc3 -- the moving spike's end cue, fired by loc_97f8 when the height overflows the ceiling.", cert: "seen" },
  0xccf6: { name: "requestSegmentHitSound", role: "[code] one-line cue: request fixed sound id 0x9f through the enable gate loc_ccc3, forwarding X/Y; its sole caller is the per-slot hit/award routine loc_a1fa, so it chimes when a segment/enemy is hit.", cert: "seen" },
  0xccfa: { name: "requestActiveSoundCue", role: "[code] request fixed sound id 0xaf by jumping straight into the loader loc_ccc7, bypassing the enable gate; the frame dispatcher loc_c891 calls it every frame while loc_c is live, so it (re)voices the currently-active held cue regardless of the loc_5 enable flag.", cert: "seen" },
  0xccfe: { name: "requestLevelIntroSound", role: "[code] one-line cue: request fixed sound id 0xbf through the enable gate loc_ccc3; its sole caller loc_90c4 fires it at phase 3 of the start-slot pick / wave working-set reseed, so it voices the level-intro / skill-step start.", cert: "seen" },
  0xcd02: { name: "requestMotionFlipSound", role: "[code] one-line cue: request fixed sound id 0x3f through the enable gate loc_ccc3, threading X; its sole caller loc_9b1e fires it as a correction when the per-slot motion accumulator loc_148 sign-flips, so it voices an enemy direction reversal on the rim.", cert: "seen" },
  0xcd06: { name: "cueSpikeCollisionSound", role: "[code] register the fixed sound id 0xcf through the sound-enable gate loc_ccc3, threading X/Y -- the spike-collision cue fired by loc_97f8 when the spike reaches the player segment.", cert: "seen" },
  0xcd0a: { name: "stepSoundVoices", role: "[seen] per-frame voice engine: scan 16 slots 0x0f..0, skip idle slots (loc_c0,x==0) and the reserved slot loc_bf; decrement fast timer loc_e0,x then slow timer loc_f0,x, step the slot through the loc_cbcc/loc_cccc animation tables (single step, or walk to a nonzero frame when both expire), fold the result into level byte loc_d0,x (odd slots keep the prior high nibble), and publish loc_d0,x to POKEY audio register loc_60c0+x for slots<8 or loc_60c8+x for the upper slots.", cert: "seen" },
  0xcd95: { name: "resetBothPokeyChips", role: "[seen] dual-POKEY reset: zero both serial-control regs loc_60cf/loc_60df and the scratch flag loc_720, poll random regs loc_60ca/loc_60da across five iterations latching the first sample into loc_720 the moment either changes, set both serial-control regs to 7, clear both chips' eight audio regs loc_60c0..7/loc_60d0..7 and the software arrays loc_c0,x/loc_d0,x, then zero both control regs loc_60c8/loc_60d8.", cert: "seen" },
  0xcf24: { name: "tickHeartbeatCounters", role: "[seen] on every interrupt advance the three timebase counter lanes gated by loc_8: step each enabled lane's wrapped position loc_d/loc_e/loc_f (masked to 0x1f, wrapping the 0x20 boundary), run its down-timer loc_10,x (reload 0x78 on zero), fold a small per-lane increment into the running accumulator pair loc_16/loc_17 and bump counter loc_13,x; then subtract a loc_cfd9-table amount from loc_16 (advancing overflow tally loc_18), nudge loc_6, store loc_17, and run two clamp passes over the loc_13 triple.", cert: "seen" },
  0xd6bb: { name: "decodeOptionSwitches", role: "[seen] decode the option (DIP) switch ports into game config: read port loc_e00 into loc_a, index loc_d6f7 by bits 5-3 into loc_156, loc_d6ff by bits 7-6 into loc_158, and the a0&0x06 field into loc_d6b3/loc_d6b4 -> loc_ac/loc_ad; store the other port loc_d00 (bit1 toggled) into loc_9, and fold loc_ad through assemblePotStatusByte recording the merge in loc_16a.", cert: "seen" },
  0xd704: { name: "serviceHeartbeatInterrupt", irq: true, role: "[seen] the ~246Hz timer interrupt handler (heartbeat): kick the watchdog (0x5000), advance the spinner-pot frame counter 0x50/0x52 (mirror 0x60db), fold coin/switch inputs through 0x4c-0x4f, drive the coin/LED latch 0x4000, pick a state code from the 0xd7dd table into 0xa1/0x60e0 by game phase, run the per-tick updaters tickHeartbeatCounters/stepSoundVoices, tick the software timer cascades (0x53, 0x7, 0x406/0x409 chains), pulse the vector generator on AVG-done, and latch the raw input port into 0x8.", cert: "seen" },
  0xd7e1: { name: "armModeAndRebuildIfEnabled", role: "[code] arm mode bytes loc_5=0x00 and loc_1=0x02, then rebuild only while idle and enabled: bail if loc_1ca is nonzero (busy) or bit4 of option port loc_c00 is clear (disabled), write loc_0=0x00, and run rebuildControlBlocksFromTemplate only when loc_1c9's low two bits show a pending request.", cert: "seen" },
  0xd8a9: { name: "emitScaledByteDigit", role: "[code] Stashes A into loc_29, scales the two coordinates (y, x), and emits that one stashed byte as a single-entry digit run.", cert: "seen" },
  0xd804: { name: "buildVectorItemList", role: "[code] a trampoline target that assembles the frame's vector item list into display RAM: four setup passes, a header pair, a marker emitted 0x158 times (dec-counted via 0x37), then table-indexed coordinate records selected by state cells 0x16a/0x200/0x4d and the 0xd8b6/0xd8ba/0xd8c2 tables, with a mask-table gated branch (eraseEaromLowRegions/queueEaromRegionErase).", cert: "seen" },
  0xdb0f: { name: "dispatchDrawHandler", role: "[seen] draw-handler dispatch on the display-finalize/self-test path: byte offset in 0x00 (0,2,..,12) selects one of seven per-frame draw handlers (loc_db5a, loc_dbf7, ...) at offset>>1; an out-of-range offset (>=0x0e) is clamped to 0x02 and the clamp persisted to 0x00, then tail-returns the handler's result.", cert: "seen" },
  0xdb22: { name: "initVectorDisplayRegisters", role: "[code] reset the $60xx vector-display register bank (zero 0x60e0/0x6080/0x60c0/0x60d0/0x6000/0x6040, four settling reads, then raise 0x60e0 to 0x08), march a single set bit across the 32 slots at 0x6080, and emit one framing word via emitCoordinateVectorWord(0x34,0xa6).", cert: "seen" },
  0xdb5a: { name: "beginEaromSequenceIfIdle", role: "[code] When guards loc_1ca and loc_1c7 are both clear, runs the EAROM seeder (de11) and stamps loc_7c=loc_1c9 and loc_0=0x02.", cert: "code" },
  0xdb6f: { name: "emitHalvedCountHeaderAndClearVectorSlots", role: "[code] emit a header from the halved slot count via emitTaggedVectorWord(0x68, 0x50>>1), then run loc_db88(0x33,0x4e) to emit its header and blank the four even slots of 0x60c1 and 0x60d1.", cert: "code" },
  0xdb7e: { name: "emitPrimedHeaderAndClearVectorSlots", role: "[code] front onto emitVectorHeaderAndClearSlots with the fixed header pair (0x32,0xb6): emit that header word then blank the four even slots of 0x60c1 and 0x60d1.", cert: "code" },
  0xdb84: { name: "emitFixedHeaderAndClearVectorSlots", role: "[seen] emit a fixed framing word via emitCoordinateVectorWord(0x33,0x0a), then blank the four even-indexed slots of output tables 0x60c1 and 0x60d1.", cert: "seen" },
  0xdb88: { name: "emitVectorHeaderAndClearSlots", role: "[code] emit a caller-supplied header word via emitCoordinateVectorWord(a,x), then blank the four even-indexed slots of output tables 0x60c1 and 0x60d1.", cert: "seen" },
  0xdb9a: { name: "stepVectorPhaseAnimation", role: "[code] advance phase counter 0x39 (only while frame gate 0x3 & 0x3f is clear), index three parallel ROM rows (loc_dbd5/loc_dbd6/loc_dfdc) by 0x39 & 0x07 to seed output cells (clear 0x60c1+slotA, write ROM value into 0x60c0+slotB and 0xa8 into 0x60c1+slotB), then emit three words via emitCoordinateVectorWord(0x34,0x56)/emitVectorWordTag70(0x01, 0x3 & 0x7f)/emitCoordinateVectorWord(0x34,0xaa).", cert: "seen" },
  0xdbe0: { name: "assemblePotStatusByte", role: "[code] Assembles a pot-status byte from the low three bits of loc_60d8 (mirrored into loc_37 and loc_60cb) merged with one relocated bit lifted from loc_60c8.", cert: "seen" },
  0xdce6: { name: "runMathboxDivide", role: "[code] Primes the math-coprocessor operand/count registers loc_608c-loc_6096 from A and X, kicks its divide, spins a 16-step window on loc_6040 for the first ready result, and returns the loc_6060/loc_6070 low/high pair.", cert: "seen" },
  0xdbf7: { name: "emitReadoutVectorList", role: "[seen] per-frame vector-list emit (handler index 1 of dispatchDrawHandler): when the 16-bit counter 0x2e/0x2f is nonzero, seed the POKEY operand cells and run the math-coprocessor scan (runMathboxDivide) to decide 0x78=0xff and the POKEY status byte; advance the 15-bit counter 0x2e/0x2f; build the POKEY work word from 0x4d/0x4e; fire the readout draws; conditionally emit the 0x52-bit marker; walk the 0x7d (x=11..0) and 0x78 (x=4..0) emit tables; then tail-delegate the 0x50-indexed colour pair to the colour-pair emitter emitKeyedScaledCoordinateRecord.", cert: "seen" },
  0xdd0d: { name: "buildPotReadoutVectorList", role: "[code] Builds a diagnostic readout vector list: a fixed header word (loc_df53), a zero word (emitBlankVectorWordTag70), then eight-digit runs keyed by DIP ports loc_d00/loc_e00 and a pot-status byte.", cert: "code" },
  0xdd27: { name: "emitByteBitsAsDigitsFixed", role: "[code] Fixed-position front feeding the coordinate deltas 0xd0/0xf8 into the eight-bit byte-digit emit, displaying the byte in y.", cert: "code" },
  0xdd29: { name: "emitByteBitsAsDigitsAtF8", role: "[code] Fixed-position front feeding coordinate x = 0xf8 into the eight-bit byte-digit emit.", cert: "code" },
  0xdd2b: { name: "emitByteBitsAsDigits", role: "[code] Stashes the byte y into loc_35, scales the two coordinates, then shifts loc_35 out MSB-first emitting each of its eight bits as one vector digit.", cert: "seen" },
  0xdd41: { name: "buildLargeDecimalNumber", role: "[code] Doubles-and-adds two little-endian input pairs into the math-box operands loc_6095/loc_6096 (floored to one), seeds a divide, emits a header, then makes repeated passes of binary-to-BCD double-dabble over the three-byte source at loc_3b/loc_3c emitting each pass's digits with a scaled coordinate record.", cert: "seen" },
  0xdde9: { name: "queueEaromRegionErase", role: "[code] queue a blanked write (erase) of the single region on bit 0x04 by feeding mask 0x04 into the blank-mode merge loc_ddf3 (which forces blank-flag 0x1c6=0xff then ORs the mask into 0x1c7/0x1c8).", cert: "code" },
  0xdded: { name: "eraseEaromLowRegions", role: "[seen] Branch-only trampoline requesting a blanked EAROM write of the two low regions via ddf3 with mask 0x03; downstream loc_1c7/loc_1c8 observed changing.", cert: "seen" },
  0xddf1: { name: "queueEaromEraseAllRegions", role: "[seen] queue a blanked write (erase) of all three EAROM regions: stamp 0xff into blank-flag 0x1c6 and OR mask 0x07 into region-pending 0x1c7 and direction 0x1c8.", cert: "seen" },
  0xddf3: { name: "requestEaromBlankWrite", role: "[code] Forces the EAROM index byte to 0xff (blank mode) then merges the caller's mask, requesting a blanked write of those regions.", cert: "code" },
  0xddf7: { name: "requestWriteLowRegions", role: "[code] request a (non-blanked) EAROM write of the two low NVRAM regions: pass the fixed mask 0x03 to the shared zeroed-index merge tail loc_ddfd, which ORs the mask into the region-pending loc_1c7 and direction loc_1c8 cells with a cleared blank-index loc_1c6.", cert: "seen" },
  0xddfb: { name: "queueEaromRegionSave", role: "[seen] queue a plain (non-blanked) EAROM save of the region on bit 0x04: store index 0x00 into blank-flag 0x1c6 and OR mask 0x04 into region-pending 0x1c7 and direction 0x1c8.", cert: "seen" },
  0xddfd: { name: "queueEaromRegionSave", entry: "queueEaromRequestAtIndexZero", role: "[code] queue an EAROM (high-score NVRAM) request at cell index 0: store 0x00 into the target-index cell loc_1c6 and OR the caller's mask A into both request-flag cells loc_1c7 and loc_1c8 (shared tail queueEaromRequest); entry queueEaromRegionSave presets mask 0x04.", cert: "seen" },
  0xddff: { name: "queueEaromRegionSave", entry: "queueEaromRequest", role: "[code] queue an EAROM (high-score NVRAM) request: store Y into the target-index cell loc_1c6 and OR the request mask A into both request-flag cells loc_1c7 and loc_1c8.", cert: "seen" },
  0xde11: { name: "armEaromReadback", role: "[seen] Sets EAROM mode byte loc_1c7=0x07 and clears loc_1c8=0x00, then drives the step machine to arm a read-back of all regions.", cert: "seen" },
  0xde1b: { name: "stepEaromTransfer", role: "[seen] drain one entry of the queued EAROM save/read: when mode 0x1ca is idle and pending 0x1c7 is set, isolate one region bit into 0x1ce, seed cursor 0x1cc/limit 0x1cd and row pointer 0xbd/0xbe from packed ROM rows (loc_dddd/ddde/dde3/dde4) and arm 0x1ca write(0x80)/read(0x20) per 0x1c8; each pass folds the RAM/read-back byte into checksum 0x1cf, moves it through the 0x6000 data window with the 0x6040/0x6050 handshake, at the limit writes/compares the checksum (recording failures into 0x1c9), and clocks 0x6040 to signal re-enter or stop.", cert: "seen" },
  0xdf09: { name: "emitRecordBodyC0", role: "[code] Stores the fixed body byte 0xc0 at the draw cursor origin loc_74 and runs the shared record-tail emit.", cert: "seen" },
  0xdf0d: { name: "emitHeaderedBodyRecord", role: "[code] build a two-byte-header record: emit the {0x40,0x80} header via 0x74, then store the fixed body byte 0x20 at the cursor origin and run the shared record tail.", cert: "seen" },
  0xdf12: { name: "emitHeaderedBodyRecord", entry: "emitRecordBodyByte", role: "[code] store one body byte (A) at the display cursor origin (0x74)+0 and continue into the shared record tail (0xdfac).", cert: "seen" },
  0xdf19: { name: "emitStrokeWordFromNibble", role: "[seen] emit a stroke-table word: form a word index from A's low nibble (0 when carry set and nibble is zero, else nibble+1), double it, copy the two bytes of table 0x31e4[index] into the display list at cursor 0x74, and advance two.", cert: "seen" },
  0xdf1f: { name: "emitStrokeWordFromNibblePlusOne", role: "[seen] thin index wrapper: form the stroke-table index (A&0x0f)+1 and share the 0x31e4 copy-and-advance emit tail, laying that word into the display list at cursor 0x74.", cert: "seen" },
  0xdf24: { name: "emitStrokeWordFromNibblePlusOne", entry: "emitStrokeWordByIndex", role: "[code] emit one glyph/stroke vector word by table index A: copy the two bytes of ROM stroke-table loc_31e4 entry (loc_31e4 + (A<<1)) into the vector list at write cursor mem16[loc_74] and step the cursor past them via advanceDisplayCursor (entry emitStrokeWordFromNibblePlusOne first maps a low nibble to index (nibble&0x0f)+1).", cert: "seen" },
  0xdf39: { name: "emitCoordinateVectorWord", role: "[code] Emits a coordinate vector word: high byte is a's upper nibble tagged 0xa0, low byte is x shifted right with a's carry rotated into bit7, written through loc_74 then advanced (or, on cursor wrap, tailing emitTaggedVectorWord with key loc_73).", cert: "seen" },
  0xdf4a: { name: "emitVectorWordTag60FromKey", role: "[code] Emits a vector word tagged 0x60 using the key byte loc_73 as its data byte through the draw cursor loc_74.", cert: "seen" },
  0xdf4c: { name: "emitTaggedVectorWord", role: "[code] emit one vector word through cursor 0x74: first byte the Y payload, second byte the A payload tagged with header bits 0x60 (via loc_df57).", cert: "seen" },
  0xdf53: { name: "emitVectorHeaderWord", role: "[seen] emit the fixed {0x40,0x80} vector header word at the cursor 0x74 (0x40 then 0x80 into display RAM) and advance the cursor two.", cert: "seen" },
  0xdf57: { name: "emitVectorHeaderWord", entry: "emitVectorWord", role: "[seen] lay one vector word into the display list: store A at cursor (0x74)+0 and X at +1, then advance the cursor two via 0x74/0x75.", cert: "seen" },
  0xdf59: { name: "emitVectorWordAtOffset", role: "[seen] indexed word emit: store A at cursor 0x74 offset Y and X at Y+1, then advance the cursor past them by (Y+1)+1.", cert: "seen" },
  0xdf5f: { name: "advanceDisplayCursor", role: "[seen] advance the 16-bit display cursor 0x74/0x75 by Y+1 (carry forced set), storing the new low byte at 0x74 and bumping high byte 0x75 on overflow; returns the new low byte in A.", cert: "seen" },
  0xdf6a: { name: "emitBlankVectorWordTag70", role: "[code] Emits a 0x70-tagged vector word with a zero data byte through the draw cursor loc_74.", cert: "seen" },
  0xdf6c: { name: "emitVectorWordTag70", role: "[code] Emits one vector word through the draw cursor loc_74 -- first byte the y payload, second byte the a payload OR 0x70 -- then advances.", cert: "seen" },
  0xdf73: { name: "emitKeyedScaledCoordinateRecord", role: "[code] Stashes the index byte into the key cell loc_73, then scales the two coordinates and emits the scaled coordinate record.", cert: "seen" },
  0xdf75: { name: "emitScaledCoordinateRecord", role: "[seen] Widens two input values by four with sign extension into the delta pairs loc_6e/loc_6f and loc_70/loc_71, then emits the coordinate record they anchor.", cert: "seen" },
  0xdf92: { name: "emitCoordinateRecord", role: "[seen] Emits a four-byte coordinate record from the zeropage slots off x -- loc_2+x, loc_3+x masked 0x1f, loc_0+x, and a key-folded 5-bit loc_1+x -- through the draw cursor loc_74.", cert: "seen" },
  0xdfac: { name: "emitCoordinateRecord", entry: "emitRecordTailByte", role: "[code] Stores one final record byte at the next draw-cursor slot loc_74 and either advances the cursor or, on wrap to zero, runs the terminating nibble run.", cert: "seen" },
  0xdfb1: { name: "emitNibbleDigitRun", role: "[seen] Emits a run of y zeropage bytes from the top index a+y-1 downward, each byte as its high then low nibble via the glyph-word lookup, chaining carry so only the final low nibble sees carry cleared as the terminator.", cert: "seen" },
};
