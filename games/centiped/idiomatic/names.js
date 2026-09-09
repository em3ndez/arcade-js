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
export const loc_32 = 0x0032;
export const loc_33 = 0x0033;
export const loc_34 = 0x0034;
export const loc_35 = 0x0035;
export const loc_3f = 0x003f;
export const loc_40 = 0x0040;
export const loc_41 = 0x0041;
export const loc_42 = 0x0042;
export const loc_43 = 0x0043;
export const loc_44 = 0x0044;
export const loc_50 = 0x0050;
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
export const loc_81 = 0x0081;
export const loc_83 = 0x0083;
export const loc_84 = 0x0084;
export const loc_85 = 0x0085;
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
export const loc_98 = 0x0098;
export const loc_99 = 0x0099;
export const loc_9a = 0x009a;
export const loc_9b = 0x009b;
export const loc_9c = 0x009c;
export const loc_9d = 0x009d;
export const loc_9e = 0x009e;
export const loc_9f = 0x009f;
export const loc_a0 = 0x00a0;
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
export const loc_b3 = 0x00b3;
export const loc_b4 = 0x00b4;
export const loc_b5 = 0x00b5;
export const loc_b6 = 0x00b6;
export const loc_b7 = 0x00b7;
export const loc_b8 = 0x00b8;
export const loc_b9 = 0x00b9;
export const loc_ba = 0x00ba;
export const loc_bb = 0x00bb;
export const loc_bd = 0x00bd;
export const loc_be = 0x00be;
export const loc_bf = 0x00bf;
export const loc_c0 = 0x00c0;
export const loc_c1 = 0x00c1;
export const loc_c2 = 0x00c2;
export const loc_c5 = 0x00c5;
export const loc_c8 = 0x00c8;
export const loc_c9 = 0x00c9;
export const loc_ca = 0x00ca;
export const loc_cb = 0x00cb;
export const loc_cc = 0x00cc;
export const loc_cf = 0x00cf;
export const loc_d2 = 0x00d2;
export const loc_d3 = 0x00d3;
export const loc_d4 = 0x00d4;
export const loc_d5 = 0x00d5;
export const loc_d6 = 0x00d6;
export const loc_d7 = 0x00d7;
export const loc_da = 0x00da;
export const loc_db = 0x00db;
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
export const loc_fd = 0x00fd;
export const loc_fe = 0x00fe;
export const loc_ff = 0x00ff;
export const loc_0100 = 0x0100;
export const loc_0104 = 0x0104;
export const loc_0178 = 0x0178;
export const loc_017a = 0x017a;
export const loc_0181 = 0x0181;
export const loc_018a = 0x018a;
export const loc_018b = 0x018b;
export const loc_018c = 0x018c;
export const loc_018d = 0x018d;
export const loc_018e = 0x018e;
export const loc_018f = 0x018f;
export const loc_0190 = 0x0190;
export const loc_0191 = 0x0191;
export const loc_01b5 = 0x01b5;
export const loc_01b8 = 0x01b8;
export const loc_01b9 = 0x01b9;
export const loc_0400 = 0x0400;
export const loc_0500 = 0x0500;
export const loc_0589 = 0x0589;
export const loc_05a9 = 0x05a9;
export const loc_05c9 = 0x05c9;
export const loc_0600 = 0x0600;
export const loc_0700 = 0x0700;
export const loc_07c0 = 0x07c0;
export const loc_07d0 = 0x07d0;
export const loc_07e0 = 0x07e0;
export const loc_07f0 = 0x07f0;

// Palette RAM (0x1400-0x140F, centiped_paletteram_w; the video layer reads it, so it is NOT in
// dumpState/the RAM diff). loc_2656 fans a 3-byte ROM record into two palette triples. [code]
// placeholders -- cellRenames proposes descriptive names for the LEAD to apply.
export const loc_1404 = 0x1404; // loc_28bf writes 0x0f here at board reset (a fixed palette color). [code]
export const loc_1405 = 0x1405;
export const loc_1406 = 0x1406;
export const loc_1407 = 0x1407;
export const loc_140d = 0x140d;
export const loc_140e = 0x140e;
export const loc_140f = 0x140f;

// ROM data table at 0x2676: 3-byte palette-color records, indexed by X in loc_2656. [code]
export const PALETTE_RECORD_TABLE = 0x2676;

// POKEY RANDOM register (0x100A): a poly-counter RNG read (boards/centiped/memory.js read8 ->
// io.pokeyRandom). loc_28bf reads it to seed the mushroom-grid pointer $8d/$8e. The value is
// clock-dependent (poly phase = m.cycles delta), so the clock-free idiomatic layer can only reproduce
// it when the poly counter is held at origin (pokeyC0 === null -> t[0]); see equivalence-28bf.test.js.
// Propose rename POKEY_RANDOM. [code]
export const loc_100a = 0x100a;

// Hardware-port placeholders (added for the 0x2509/0x252a decompile batch). Board decode
// (boards/centiped/memory.js): 0x1C00-0x1C07 is the LS259 outlatch (write_d7); index 7 -> Q7 ->
// flip_screen_w, so a write of A stores bit7 of A to the flip-screen latch. Propose rename FLIP_SCREEN_LATCH.
export const loc_1c07 = 0x1c07;
// 0x2400 sits in ROM read-space (0x2001-0x3FFF); memory.js write8 IGNORES the store ("e.g. reset's sta $2400").
// A dead/no-op write the ROM performs; kept so the idiomatic layer mirrors the oracle's write exactly. [code]
export const loc_2400 = 0x2400;

// POKEY audio registers (0x1000-0x1007), the four sound channels' freq/control pairs (standard POKEY
// AUDF/AUDC layout). Memory-mapped: boards/centiped/memory.js routes writes to io.pokeyWrite (the audio
// sink), so they are NOT in dumpState/the RAM diff. Written by updateSoundChannels (0x3068). [code]
// placeholders -- cellRenames proposes POKEY_AUDF1/AUDC1..AUDF4/AUDC4 for the LEAD to apply.
export const loc_1000 = 0x1000; // AUDF1 (ch1 frequency)
export const loc_1001 = 0x1001; // AUDC1 (ch1 control/volume)
export const loc_1002 = 0x1002; // AUDF2 (ch2 frequency)
export const loc_1003 = 0x1003; // AUDC2 (ch2 control/volume)
export const loc_1004 = 0x1004; // AUDF3 (ch3 frequency)
export const loc_1005 = 0x1005; // AUDC3 (ch3 control/volume)
export const loc_1006 = 0x1006; // AUDF4 (ch4 frequency)
export const loc_1007 = 0x1007; // AUDC4 (ch4 control/volume)

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
export const loc_0c01 = 0x0c01; // input port read by advanceSegmentColumns [code]
export const loc_1600 = 0x1600; // EAROM data window base (read/write) [code]
export const loc_1680 = 0x1680; // EAROM control/second window [code]
export const loc_1700 = 0x1700; // EAROM control latch [code]
export const loc_21bf = 0x21bf; // ROM table read by readFdBitsTableByte [code]
export const loc_3413 = 0x3413; // ROM table (column-advance thresholds) read by advanceSegmentColumns [code]
export const loc_346d = 0x346d; // ROM row-descriptor pointer table read by writePointerTableRow [code]
export const loc_3a69 = 0x3a69; // ROM high-score init table read by validateOrResetHighScores [code]

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
};
