// SPDX-License-Identifier: GPL-3.0-only
// Centipede idiomatic-layer name registry. The frozen oracle in ../translated/ is the source of truth;
// this gives the idiomatic layer symbols for RAM cells + the ROUTINES map dispatched over the translated
// fallback (resolveAllIdiomatic). Tags: [seen] MAME-confirmed, [code] read from translated behaviour,
// [guess] unknown. loc_ cells are placeholders (names-debt.txt); the understand half renames + grounds them.

// Return-stack scratch: 6502 page-1 stack, SP inits 0xfd, measured deepest 0xef over driven play; a small
// margin below. Excluded from the equivalence diff.
export const STACK_SCRATCH = { lo: 0x01e0, hi: 0x0200 };

export const loc_00 = 0x0000;
export const loc_01 = 0x0001;
export const loc_02 = 0x0002;
export const loc_03 = 0x0003;
export const loc_04 = 0x0004;
export const loc_17 = 0x0017;
export const loc_1a = 0x001a;
export const loc_1b = 0x001b;
export const loc_1c = 0x001c;
export const TILEMAP_PTR_LO = 0x0032; // [seen] 16-bit working tile/screen pointer (lo 0x32 / hi 0x33) through which advanceHeadOrientatio
export const TILEMAP_PTR_HI = 0x0033; // [seen] Tile-map cell pointer, high byte. resolveTileCellAtXY seeds 0x01 then rol's the column's t
export const loc_34 = 0x0034;
export const loc_35 = 0x0035;
export const loc_3f = 0x003f;
export const loc_40 = 0x0040;
export const loc_41 = 0x0041;
export const loc_42 = 0x0042;
export const loc_43 = 0x0043;
export const loc_44 = 0x0044;
export const HEAD_VELOCITY_SEED = 0x0050; // [code] Head velocity SEED: steerHeadAndSeedVelocity writes a random small magnitude (2 when
export const loc_51 = 0x0051;
export const loc_53 = 0x0053;
export const loc_54 = 0x0054;
export const loc_5f = 0x005f;
export const loc_60 = 0x0060;
export const loc_61 = 0x0061;
export const loc_62 = 0x0062;
export const loc_63 = 0x0063;
export const loc_64 = 0x0064;
export const loc_6f = 0x006f;
export const loc_70 = 0x0070;
export const loc_71 = 0x0071;
export const loc_72 = 0x0072;
export const loc_73 = 0x0073;
export const loc_74 = 0x0074;
export const loc_80 = 0x0080;
export const OBJECT_Y_STEER = 0x0081; // [seen] Steered object's vertical (Y) steer delta: loc_71 is stepped by +/- loc_81 (sign from
export const loc_83 = 0x0083;
export const MOVE_SUBSTEP_ACCUM_A = 0x0084; // [seen] Sub-step (fractional) accumulator for the $63-axis coordinate integrator: loc_2ace ac
export const MOVE_SUBSTEP_ACCUM_B = 0x0085; // [code] Sub-step (fractional) accumulator for the $73-axis coordinate integrator: loc_2aeb ac
export const loc_86 = 0x0086;
export const loc_87 = 0x0087;
export const loc_88 = 0x0088;
export const loc_89 = 0x0089;
export const loc_8a = 0x008a;
export const loc_8b = 0x008b;
export const loc_8c = 0x008c;
export const loc_8d = 0x008d;
export const loc_8e = 0x008e;
export const loc_8f = 0x008f;
export const loc_90 = 0x0090;
export const loc_91 = 0x0091;
export const loc_92 = 0x0092;
export const loc_93 = 0x0093;
export const loc_94 = 0x0094;
export const loc_97 = 0x0097;
export const SHADOW_TILE_LOW_NIBBLE = 0x0098; // [seen] Transient low-nibble of the tile/attribute source (loc_34+x) captured during the per-
export const SHADOW_SIGN_LATCH = 0x0099; // [seen] Sign-bit latch of loc_44+x held during shadow build, XORed into the shadow sub-value
export const loc_9a = 0x009a;
export const loc_9b = 0x009b;
export const loc_9c = 0x009c;
export const loc_9d = 0x009d;
export const loc_9e = 0x009e;
export const loc_9f = 0x009f;
export const SPAWN_TIMER = 0x00a0; // [seen] spawnActorOnTimer's own periodic countdown timer: decremented each enabled frame and, on r
export const loc_a1 = 0x00a1;
export const loc_a2 = 0x00a2;
export const loc_a3 = 0x00a3;
export const loc_a4 = 0x00a4;
export const loc_a5 = 0x00a5;
export const loc_a6 = 0x00a6;
export const loc_a7 = 0x00a7;
export const loc_a8 = 0x00a8;
export const loc_a9 = 0x00a9;
export const loc_aa = 0x00aa;
export const loc_ab = 0x00ab;
export const loc_ac = 0x00ac;
export const loc_ad = 0x00ad;
export const loc_ae = 0x00ae;
export const loc_af = 0x00af;
export const loc_b0 = 0x00b0;
export const loc_b1 = 0x00b1;
export const loc_b2 = 0x00b2;
export const SFX_TIMER_CH2 = 0x00b3; // [seen] SFX countdown timer feeding POKEY ch2 (AUDF2/AUDC2)
export const SFX_TIMER_CH3 = 0x00b4; // [seen] SFX countdown timer feeding POKEY ch3 (AUDF3/AUDC3, fixed AUDC3=0x64)
export const SFX_TIMER_CH4 = 0x00b5; // [seen] Companion timer cell re-armed to 0x14 by tickColumnCountdown; consumed (counted down) by a
export const SFX_TIMER_CH2_PRIORITY = 0x00b6; // [code] Pitched pre-empt timer for POKEY ch2 (takes AUDF2 before the collision decision)
export const SFX_TIMER_CH1_PRIORITY = 0x00b7; // [seen] ch1 priority SFX timer: armed to 0x13 by armSlotState, decremented by the ch1 voice updater
export const loc_b8 = 0x00b8;
export const loc_b9 = 0x00b9;
export const TRACKBALL_LAST_DELTA = 0x00ba; // [seen] Per-axis last-committed signed trackball delta (hysteresis reference, array 0xba/0xbc
export const loc_bb = 0x00bb;
export const loc_bd = 0x00bd;
export const OBJECT_X_DRIFT_STASH = 0x00be; // [seen] Saved copy of the horizontal drift OBJECT_X_DRIFT (loc_51) while it is paused: advanc
export const loc_bf = 0x00bf;
export const loc_c0 = 0x00c0;
export const loc_c1 = 0x00c1;
export const loc_c2 = 0x00c2;
export const loc_c5 = 0x00c5;
export const loc_c8 = 0x00c8;
export const SEGMENT_MOVE_ACCUM_B = 0x00c9; // [seen] Second parallel segment-movement accumulator, advanced by delta+1 alongside 0xca on each c
export const SEGMENT_MOVE_ACCUM = 0x00ca; // [seen] Shared segment-movement accumulator. Each firing column folds delta+1 into it; on the last
export const SEGMENT_ROW_CROSS_COUNT = 0x00cb; // [code] Row-crossing counter: bumped once when the accumulator clears the threshold, and a second
export const SEGMENT_COL_LIFE_TIMER = 0x00cc; // [seen] Per-column life countdown (array 0xcc,0xcd,0xce). Reloaded to 0x78, decremented each pass;
export const SEGMENT_COL_BODY = 0x00cf; // [seen] Per-column centipede body/step cell (array 0xcf,0xd0,0xd1 for cols 0..2). Holds the low-5-
export const SEGMENT_RELOAD_TIMER = 0x00d2; // [code] Shared reload timer: reloaded to 0xf0 unless IN1 bit4 is set; while nonzero it decrements
export const loc_d3 = 0x00d3;
export const SEGMENT_MOVE_FRAME_COUNTER = 0x00d4; // [seen] Free-running movement frame counter: stepPhasedCountersAndWrapCells increments it eve
export const loc_d5 = 0x00d5;
export const loc_d6 = 0x00d6;
export const loc_d7 = 0x00d7;
export const FIELD_SCAN_PTR_LO = 0x00da; // [seen] Low byte of the 16-bit playfield cell-stream scan pointer walked forward by scanForRa
export const FIELD_SCAN_PTR_HI = 0x00db; // [seen] High byte of the 16-bit playfield cell-stream scan pointer (paired with loc_da); incr
export const loc_dc = 0x00dc;
export const loc_dd = 0x00dd;
export const loc_de = 0x00de;
export const loc_df = 0x00df;
export const loc_e0 = 0x00e0;
export const loc_e1 = 0x00e1;
export const loc_e2 = 0x00e2;
export const loc_e3 = 0x00e3;
export const loc_e4 = 0x00e4;
export const loc_e5 = 0x00e5;
export const loc_e6 = 0x00e6;
export const loc_e7 = 0x00e7;
export const loc_e8 = 0x00e8;
export const loc_e9 = 0x00e9;
export const loc_ea = 0x00ea;
export const loc_eb = 0x00eb;
export const loc_ec = 0x00ec;
export const loc_ed = 0x00ed;
export const loc_ee = 0x00ee;
export const loc_ef = 0x00ef;
export const loc_f0 = 0x00f0;
export const loc_f1 = 0x00f1;
export const loc_f2 = 0x00f2;
export const loc_f3 = 0x00f3;
export const loc_f4 = 0x00f4;
export const loc_f5 = 0x00f5;
export const loc_f6 = 0x00f6;
export const loc_f7 = 0x00f7;
export const loc_f8 = 0x00f8;
export const loc_f9 = 0x00f9;
export const loc_fa = 0x00fa;
export const loc_fb = 0x00fb;
export const loc_fc = 0x00fc;
export const CONFIG_DIP_BYTE = 0x00fd; // [seen] Mode/control byte whose bits 5-4 select a ROM table variant in readFdBitsTableByte.
export const loc_fe = 0x00fe;
export const loc_ff = 0x00ff;
export const loc_0100 = 0x0100;
export const loc_0104 = 0x0104;
export const HIGH_SCORE_TABLE = 0x0178; // [seen] High-score table RAM mirror base — first byte of the 64-byte EAROM-backed high-score block
export const loc_017a = 0x017a;
export const loc_0181 = 0x0181;
export const HIGH_SCORE_CONFIG_BYTE = 0x018a; // [seen] Config-byte snapshot stored inside the hi-score table (table+0x12); validate compares/reco
export const loc_018b = 0x018b;
export const loc_018c = 0x018c;
export const loc_018d = 0x018d;
export const loc_018e = 0x018e;
export const loc_018f = 0x018f;
export const loc_0190 = 0x0190;
export const loc_0191 = 0x0191;
export const HIGH_SCORE_CHECKSUM = 0x01b5; // [seen] High-score table integrity checksum byte (last used byte of the hs block; foldHighScoreChe
export const TRACKBALL_AXIS0_STEP_STATE = 0x01b8; // [code] Per-axis (axis 0) trackball step-state carried between IRQ frames and fed to stepAxis
export const TRACKBALL_AXIS1_STEP_STATE = 0x01b9; // [code] Per-axis (axis 1) trackball step-state, companion to loc_01b8
export const loc_0400 = 0x0400;
export const loc_0500 = 0x0500;
export const loc_0589 = 0x0589;
export const loc_05a9 = 0x05a9;
export const loc_05c9 = 0x05c9;
export const loc_0600 = 0x0600;
export const loc_0700 = 0x0700;
export const SPRITE_SHADOW_CODE = 0x07c0; // [seen] Per-object sprite-shadow picture/tile code row (16 slots, 0x07c0+x), block-copied to
export const SPRITE_SHADOW_HPOS = 0x07d0; // [seen] Per-object sprite-shadow coordinate row derived from loc_54+x (+sign of loc_44+x)
export const SPRITE_SHADOW_VPOS = 0x07e0; // [seen] Per-object sprite-shadow coordinate row copied straight from object field loc_64+x
export const SPRITE_SHADOW_ATTR = 0x07f0; // [seen] Per-object sprite-shadow attribute row (color/size), attr | 0x39, floored for low slo

// Palette RAM (0x1400-0x140F, centiped_paletteram_w; the video layer reads it, so it is NOT in
// dumpState/the RAM diff). loc_2656 fans a 3-byte ROM record into two palette triples. [code]
// placeholders -- cellRenames proposes descriptive names for the LEAD to apply.
export const PALETTE_COLOR_04 = 0x1404; // [code] Playfield color RAM cell. resetPlayfieldAndSeedMushrooms writes the fixed 0x0f palette val
export const PALETTE_COLOR_05 = 0x1405; // [code] Palette RAM colour byte (video palette region 0x1400-0x140f). Entry of triple A (0x1405-0x
export const PALETTE_COLOR_06 = 0x1406; // [code] Palette RAM colour byte. Entry of triple A, receives record byte b2.
export const PALETTE_COLOR_07 = 0x1407; // [code] Palette RAM colour byte. Entry of triple A, receives record byte b1.
export const PALETTE_COLOR_0D = 0x140d; // [code] Palette RAM colour byte. Entry of triple B (0x140d-0x140f), receives record byte b1.
export const PALETTE_COLOR_0E = 0x140e; // [code] Palette RAM colour byte. Entry of triple B, receives record byte b2.
export const PALETTE_COLOR_0F = 0x140f; // [code] Palette RAM colour byte. Entry of triple B, receives record byte b0.

// ROM data table at 0x2676: 3-byte palette-color records, indexed by X in loc_2656. [code]
export const PALETTE_RECORD_TABLE = 0x2676;

// POKEY RANDOM register (0x100A): a poly-counter RNG read (boards/centiped/memory.js read8 ->
// io.pokeyRandom). loc_28bf reads it to seed the mushroom-grid pointer $8d/$8e. The value is
// clock-dependent (poly phase = m.cycles delta), so the clock-free idiomatic layer can only reproduce
// it when the poly counter is held at origin (pokeyC0 === null -> t[0]); see equivalence-28bf.test.js.
// Propose rename POKEY_RANDOM. [code]
export const POKEY_RANDOM = 0x100a; // [seen] POKEY RANDOM register (read-only hardware RNG). rebuildSegmentSpriteTables and resetPlayfi

// Hardware-port placeholders (added for the 0x2509/0x252a decompile batch). Board decode
// (boards/centiped/memory.js): 0x1C00-0x1C07 is the LS259 outlatch (write_d7); index 7 -> Q7 ->
// flip_screen_w, so a write of A stores bit7 of A to the flip-screen latch. Propose rename FLIP_SCREEN_LATCH.
export const FLIP_SCREEN = 0x1c07; // [code] Hardware flip-screen output latch (driven by bit7 of the broadcast value).
// 0x2400 sits in ROM read-space (0x2001-0x3FFF); memory.js write8 IGNORES the store ("e.g. reset's sta $2400").
// A dead/no-op write the ROM performs; kept so the idiomatic layer mirrors the oracle's write exactly. [code]
export const loc_2400 = 0x2400;

// POKEY audio registers (0x1000-0x1007), the four sound channels' freq/control pairs (standard POKEY
// AUDF/AUDC layout). Memory-mapped: boards/centiped/memory.js routes writes to io.pokeyWrite (the audio
// sink), so they are NOT in dumpState/the RAM diff. Written by updateSoundChannels (0x3068). [code]
// placeholders -- cellRenames proposes POKEY_AUDF1/AUDC1..AUDF4/AUDC4 for the LEAD to apply.
export const AUDF1 = 0x1000; // [seen] POKEY channel-1 frequency register
export const AUDC1 = 0x1001; // [seen] POKEY channel-1 control/volume register
export const AUDF2 = 0x1002; // [seen] POKEY channel-2 frequency register
export const AUDC2 = 0x1003; // [code] POKEY channel-2 control/volume register
export const AUDF3 = 0x1004; // [seen] POKEY channel-3 frequency register
export const AUDC3 = 0x1005; // [code] POKEY channel-3 control/volume register
export const AUDF4 = 0x1006; // [seen] POKEY channel-4 frequency register
export const AUDC4 = 0x1007; // [code] POKEY channel-4 control/volume register

// Sound-engine ROM data tables (added for the 0x3068 decompile batch). Per-effect waveform/frequency
// byte tables in program ROM, indexed by the effect timers $b2-$b8; updateSoundChannels copies one byte
// per frame into the POKEY register named in each comment. [code] placeholders -- roles are which POKEY
// register they feed; cellRenames proposes descriptive names for the LEAD to apply.
export const loc_3148 = 0x3148; // -> AUDF1 (via $b2 and $b7 timers)
export const loc_315b = 0x315b; // -> AUDC1 (via $b2 and $b7 timers)
export const loc_316e = 0x316e; // -> AUDF2 (via $b3 timer)
export const loc_3175 = 0x3175; // -> AUDC2 (via $b3 timer)
export const loc_317c = 0x317c; // -> AUDF3 (via $b4 timer)
export const loc_3187 = 0x3187; // -> AUDF4 (via $b5 timer)
export const loc_319b = 0x319b; // -> AUDC4 (via $b5 timer)
export const loc_31af = 0x31af; // -> AUDF2 (via $b6 timer)
export const loc_31c0 = 0x31c0; // -> AUDF2 (via $b8 sweep)

// I/O ports + ROM data-table bases referenced by batch-1 modules. [code] placeholders (loc_ pending
// the understanding pass, which names/grounds them under two-blind-deriver convergence).
export const IN1 = 0x0c01; // [seen] Hardware input port IN1. advanceSegmentColumns reads per-column control bits (bit5 col0, b
export const EAROM_DATA_WINDOW = 0x1600; // [seen] EAROM (ER2055 high-score NVRAM) address-latch / data window base; readEaromCell writes $16
export const EAROM_CONTROL = 0x1680; // [seen] EAROM control register; readEaromCell pulses 0x08/0x09/0x08/0x00 to clock the ER2055 (C1 r
export const EAROM_DATA_OUT = 0x1700; // [code] EAROM data-out window; readEaromCell reads $1700+X to get the latched cell byte after the
export const loc_21bf = 0x21bf; // ROM table read by readFdBitsTableByte [code]
export const SEGMENT_ROW_THRESHOLD_TABLE = 0x3413; // [seen] ROM table of per-row (Y) accumulator thresholds, indexed by SEGMENT_ROW_PHASE>>5 in the la
export const loc_346d = 0x346d; // ROM row-descriptor pointer table read by writePointerTableRow [code]
export const HIGH_SCORE_INIT_TABLE = 0x3a69; // ROM high-score init table read by validateOrResetHighScores [seen]

export const DSW2 = 0x0801; // [seen] I/O port or ROM table (batch-2 decompile placeholder)
export const IN0 = 0x0c00; // [seen] I/O port or ROM table (batch-2 decompile placeholder)
export const AUDCTL = 0x1008; // [seen] I/O port or ROM table (batch-2 decompile placeholder)
export const SKCTL = 0x100f; // [seen] I/O port or ROM table (batch-2 decompile placeholder)
export const IRQ_ACK = 0x1800; // [seen] I/O port or ROM table (batch-2 decompile placeholder)
export const loc_1c00 = 0x1c00; // [code] I/O port or ROM table (batch-2 decompile placeholder)
export const loc_1c02 = 0x1c02; // [code] I/O port or ROM table (batch-2 decompile placeholder)
export const loc_1c03 = 0x1c03; // [seen] I/O port or ROM table (batch-2 decompile placeholder)
export const loc_1c04 = 0x1c04; // [code] I/O port or ROM table (batch-2 decompile placeholder)
export const loc_2003 = 0x2003; // [seen] I/O port or ROM table (batch-2 decompile placeholder)
export const loc_2120 = 0x2120; // [code] I/O port or ROM table (batch-2 decompile placeholder)
export const loc_21c0 = 0x21c0; // [code] I/O port or ROM table (batch-2 decompile placeholder)

export const DSW1 = 0x0800; // [seen] I/O port / ROM (batch-3 placeholder)
export const IN2 = 0x0c02; // [seen] I/O port / ROM (batch-3 placeholder)
export const IN3 = 0x0c03; // [seen] I/O port / ROM (batch-3 placeholder)
export const loc_140c = 0x140c; // [code] I/O port / ROM (batch-3 placeholder)
export const WATCHDOG = 0x2000; // [seen] I/O port / ROM (batch-3 placeholder)
export const loc_3fd8 = 0x3fd8; // [code] I/O port / ROM (batch-3 placeholder)

// Routine override map: addr -> { name, entry? }. Empty until the decompile batches land idiomatic modules;
// resolveAllIdiomatic walks this, so an unlisted routine runs as the frozen oracle fallback.
export const ROUTINES = {
  0x20e8: { name: "seedWaveState" },
  0x21b3: { name: "readFdBitsTableByte" },
  0x21c7: { name: "seedSegmentSpawnState" },
  0x22fa: { name: "tickColumnCountdown" },
  0x2310: { name: "loadObjectTileInputs" },
  0x231f: { name: "rebuildSegmentSpriteTables" },
  0x2509: { name: "broadcastByteToStateBlock" },
  0x252a: { name: "seedStateBlockConstants" },
  0x2656: { name: "loadPaletteRecordPair" },
  0x26a0: { name: "copyZpStateToSnapshot" },
  0x26b8: { name: "drawGridSideBorders" },
  0x26fd: { name: "serviceTimerBank" },
  0x28bf: { name: "resetPlayfieldAndSeedMushrooms" },
  0x2932: { name: "seedPlayerShotStartCells" },
  0x2acd: { name: "returnImmediately" },
  0x2b79: { name: "loc_2b79" },
  0x2b86: { name: "loc_2b79", entry: "loc_2b86" }, // second entry: the $43-mask gate tail
  0x2b91: { name: "maybeDecrementTableEntry" },
  0x2ba8: { name: "stampEmptyTileCell" },
  0x2bd9: { name: "spawnActorOnTimer" },
  0x2c2b: { name: "resolveTileCellAtXY" },
  0x2c6b: { name: "detectColumnCollision" },
  0x2cc2: { name: "armSlotState" },
  0x2cea: { name: "enterArmBlockUnlessValueHigh" },
  0x2e94: { name: "advanceHeadOrientation", entry: "guardHeadOrientationWrap" },
  0x2e9d: { name: "advanceHeadOrientation", entry: "advanceHeadOrientationAndStampTile" },
  0x2ec5: { name: "returnNoop" },
  0x3068: { name: "updateSoundChannels" },
  0x31d5: { name: "transposeScreenBitmap" },
  0x3226: { name: "clampAndHalveSignedDelta" },
  0x3360: { name: "advanceSegmentColumns" },
  0x341b: { name: "stepPhasedCountersAndWrapCells" },
  0x37d5: { name: "writePointerTableRow" },
  0x3801: { name: "writePointerTableRow", entry: "rewritePointerTableRowFromStart" },
  0x382b: { name: "foldSignedMagnitude" },
  0x382d: { name: "negateA" },
  0x3833: { name: "plotZpTableByteAtCursor" },
  0x3836: { name: "writeMaskedByteAndAdvancePointer" },
  0x385c: { name: "plotNormalizedCharCode" },
  0x39ea: { name: "stepAxisBySelectorBits" },
  0x3a08: { name: "foldHighScoreChecksum" },
  0x3a1d: { name: "validateOrResetHighScores" },
  0x3a99: { name: "loadHighScoreTableFromEarom" },
  0x3aa7: { name: "readEaromCell" },
  0x3ac0: { name: "tickEaromWriteback" },
  0x335e: { name: "advanceAllSegmentColumns" },
  0x3825: { name: "redrawPointerTableRowUnblanked" },
  0x384f: { name: "plotByteAsTwoDigits" },
  0x2b24: { name: "clampCoordToBand" },
  0x2b60: { name: "routeByCoordDelta" },
  0x2c96: { name: "armSlotWhenObjectInRange" },
  0x3037: { name: "loc_3037" },
  0x303e: { name: "loc_303e" },
  0x3046: { name: "loc_3046" },
  0x2872: { name: "initRoundState" },
  0x2ace: { name: "loc_2ace" },
  0x2aeb: { name: "loc_2aeb" },
  0x23da: { name: "advanceDeathRespawnSequence" },
  0x24f8: { name: "decrementSlotAndRedrawBorders" },
  0x24ff: { name: "reseedSegmentSpawnState" },
  0x2059: { name: "loc_2059" },
  0x20b8: { name: "stampGridCellAtObject" },
  0x2119: { name: "loc_2119" },
  0x2cef: { name: "scanForRangedCellAndSeed" },
  0x2d5c: { name: "plotRecordFieldColumns" },
  0x2dae: { name: "decrementActiveObjectDelay" },
  0x2db6: { name: "advancePathAccumulator" },
  0x2e0b: { name: "steerHeadAndSeedVelocity" },
  0x2e8c: { name: "storeHeadVelocity" },
  0x3049: { name: "tickSpawnCadence" },
  0x323e: { name: "buildSortedObjectTable" },
  0x32fe: { name: "plotObjectCoordinates" },
  0x2505: { name: "loc_2505" },
  0x2561: { name: "loc_2561" },
  0x2741: { name: "loc_2741" },
  0x2195: { name: "plotConfigTableRow" },
  0x2202: { name: "advanceColumnHeadingState" },
  0x2280: { name: "steerObjectRowTarget" },
  0x3871: { name: "serviceFrameIrq", irq: true }, // 32V interrupt handler: self-manages its stack (push a/x/y
  // + rti), so it is dispatched RAW past the withOmittedRet return-seam, which would mis-read its +3 SP move.
  0x3907: { name: "serviceFrameIrq", entry: "buildObjectShadowEntry" },
  0x3956: { name: "storeSpriteShadowEntry" },
  0x396d: { name: "accumulateTrackballAndReturnFromIrq" },
  0x2951: { name: "beginCentipedeSegmentSweep" },
  0x2962: { name: "moveCentipedeSegment" },
  0x2a90: { name: "commitSegmentCoord" },
  0x2a92: { name: "advanceSegmentCoordAndArm" },
  0x2aa6: { name: "reverseSegmentDeltaAndStepCoord" },
  0x2ac7: { name: "advanceSegmentLoopIndex" },
  0x2ec6: { name: "stepHeadSegment" },
  0x2f4f: { name: "routeSegmentByRange" },
  0x3031: { name: "advanceSegmentSlotLoop" },
  0x200e: { name: "loc_200e" }, // game-entry generator (yield* into the main-loop spine)
  0x2015: { name: "mainLoop" },  // per-frame main-loop generator (vblank yield = clock-free frame boundary)
  0x3b04: { name: "coldBootReset" },
  0x3c97: { name: "loc_3c97" },
  0x3d57: { name: "loc_3d57" },
  0x3fd6: { name: "loc_3fd6" },
  0x3ff6: { name: "spinToSelfHalt" },
};
