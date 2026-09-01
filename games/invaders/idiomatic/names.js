// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders idiomatic-layer name registry. The frozen oracle in ../translated/ is the source of
// truth; this gives the idiomatic layer symbols for work-RAM cells + the ROUTINES map dispatched over
// the translated fallback (resolveAllIdiomatic). Tags: [seen] MAME-confirmed, [code] read from the
// translated behaviour, [guess] role unknown. loc_ cells are placeholders (understand half renames).

// Return-stack scratch (SP inits 0x2400, grows down; measured deepest 0x23e0). Excluded from the diff.
export const STACK_SCRATCH = { lo: 0x23e0, hi: 0x2400 };

export const TIMER_RELOAD = 0x0600;  // [code]
export const loc_1da0 = 0x1da0;
export const loc_2009 = 0x2009;
export const loc_200a = 0x200a;
export const loc_2048 = 0x2048;
export const ACTIVE_PLAYER_PAGE = 0x2067;  // [code]
export const loc_207e = 0x207e;
export const ALIEN_COUNT = 0x2082;  // [seen]
export const loc_2083 = 0x2083;
export const loc_2091 = 0x2091;
export const SOUND_PORT3_SHADOW = 0x2094;  // [seen]
export const SOUND_PORT5_SHADOW = 0x2098;  // [seen]
export const TASK_FLAGS = 0x20c1;  // [code]
export const loc_20e7 = 0x20e7;
export const GAME_ACTIVE = 0x20e9;  // [seen]
export const PLAYER1_OBJ_DESC = 0x20f8;  // [code]
export const PLAYER2_OBJ_DESC = 0x20fc;  // [code]
export const VIDEO_RAM_BASE = 0x2400;  // [seen]
export const PLAYFIELD_VRAM_BASE = 0x2402;  // [seen]
export const VIDEO_RAM_END = 0x4000;  // [seen]
export const DRAW_BLOCK_STRIDE = 0x02e0;
export const loc_1a11 = 0x1a11;
export const loc_1a21 = 0x1a21;
export const loc_1aa1 = 0x1aa1;
export const loc_1b00 = 0x1b00;
export const loc_1b83 = 0x1b83;
export const loc_1cb8 = 0x1cb8;
export const loc_1d20 = 0x1d20;
export const loc_1e00 = 0x1e00;
export const loc_2000 = 0x2000;
export const loc_2002 = 0x2002;
export const loc_2008 = 0x2008;
export const loc_200b = 0x200b;
export const loc_200d = 0x200d;
export const loc_2010 = 0x2010;
export const loc_2011 = 0x2011;
export const loc_2015 = 0x2015;
export const loc_201d = 0x201d;
export const loc_2025 = 0x2025;
export const loc_2027 = 0x2027;
export const loc_202d = 0x202d;
export const loc_2062 = 0x2062;
export const loc_2068 = 0x2068;
export const loc_206b = 0x206b;
export const loc_2073 = 0x2073;
export const loc_207f = 0x207f;
export const loc_2081 = 0x2081;
export const loc_2087 = 0x2087;
export const loc_2095 = 0x2095;
export const loc_2096 = 0x2096;
export const loc_2097 = 0x2097;
export const loc_2099 = 0x2099;
export const loc_209b = 0x209b;
export const loc_20c2 = 0x20c2;
export const loc_20cf = 0x20cf;
export const loc_20ed = 0x20ed;
export const loc_20ef = 0x20ef;
export const loc_20f1 = 0x20f1;
export const loc_20f2 = 0x20f2;
export const loc_20f3 = 0x20f3;
export const loc_2100 = 0x2100;
export const loc_2200 = 0x2200;
export const loc_2806 = 0x2806;

export const ROUTINES = {
  0x00b1: { name: "loc_00b1", role: "load active record's 16-bit pointer via activeFieldRecordPointer, mirror to loc_2009 and loc_200b, derive count byte at ", cert: "code" },
  0x01c0: { name: "loc_01c0", role: "seat the alien-status table base loc_2100, then markAllAliensAlive (fill 0x37 bytes with 0x01)", cert: "code" },
  0x01cf: { name: "loc_01cf", role: "seat A=0x01/B=0xe0/HL=play-field base and fill via fillScreenRow; live-out HL (end pointer)", cert: "code" },
  0x01e6: { name: "loc_01e6", role: "boot-init: block-copy the caller's B bytes from ROM template loc_1b00 into work-RAM base loc_2000 via blockCopy", cert: "code" },
  0x01f8: { name: "loc_01f8", role: "replicate the 0x2c-byte ROM source block (loc_1d20) into four consecutive destination slots from HL; live-out HL (end po", cert: "code" },
  0x021e: { name: "loc_021e", role: "shared draw body: store the mode flag at loc_2081, then run four passes of a 22x2 block down the screen from loc_2806 (c", cert: "code" },
  0x0430: { name: "loc_0430", role: "seat HL at the object move-record base (loc_2027) and read its 5-byte sprite descriptor into DE/A/C/B, repointing HL at ", cert: "code" },
  0x0550: { name: "loc_0550", role: "stash A -> loc_207f, then blockCopy 0x0b bytes (DE)->loc_2073 (object strip prime)", cert: "code" },
  0x055b: { name: "loc_055b", role: "blockCopy 0x0b bytes loc_2073->(HL) (object strip restore, twin of loc_0550)", cert: "code" },
  0x0707: { name: "loc_0707", role: "clear low sound-latch bit: SOUND_PORT3_SHADOW &= 0xfe via loc_19dc; value-out A", cert: "code" },
  0x0742: { name: "loc_0742", role: "load sprite descriptor at loc_2087, fold its pointer into a screen address (HL); DE/B/C = descriptor", cert: "code" },
  0x075f: { name: "loc_075f", role: "block-copy B bytes from ROM table loc_1b83 into (HL) (init object record)", cert: "code" },
  0x0878: { name: "loc_0878", role: "B := [loc_2008], DE := [loc_2009] word, then HL := active player record pointer", cert: "code" },
  0x08ff: { name: "loc_08ff", role: "resolve sprite id A to its 8-byte source at loc_1e00+8*A, latch the shift count to port 6, and blit 8 columns via drawSp", cert: "code" },
  0x092e: { name: "loc_092e", role: "read the status byte at the top of the active player's record page ((page<<8)|0xff); live-out HL, A", cert: "code" },
  0x0a5f: { name: "loc_0a5f", role: "if [loc_20ef]!=0: startSound(0x08), index the 3-entry table via loc_097c(B), stamp loc_20f2=table byte / loc_20f1=0x01 /", cert: "code" },
  0x0ae2: { name: "loc_0ae2", role: "copy the 12-byte block from (DE) into loc_20c2 (dissolved tail-call to blockCopy)", cert: "code" },
  0x1474: { name: "loc_1474", role: "OUT port 2 := L&7 (MB14241 shift offset), then HL := coordToScreenAddr(HL)", cert: "code" },
  0x14cb: { name: "loc_14cb", role: "zero A then fill B screen rows from HL with 0 (dissolved fall-through to fillScreenRow)", cert: "code" },
  0x154a: { name: "loc_154a", role: "clear prize-active flag loc_2002, then loc_19dc(0xf7) masks bit 3 off SOUND_PORT3_SHADOW and mirrors to sound port 3; va", cert: "code" },
  0x1554: { name: "loc_1554", role: "count in C the 0x10 steps that lift A to/above threshold H (CMP H drives it), pre-normalizing a negative A via loc_1590 ", cert: "code" },
  0x15f3: { name: "loc_15f3", role: "count live cells across the active player's 0x37-byte alien field into ALIEN_COUNT; set loc_206b at exactly one survivor", cert: "code" },
  0x1618: { name: "loc_1618", role: "gated pre-round advance: bail unless armed (loc_2015==0xff) and loc_2010/loc_2011/loc_2025 clear, then step the march po", cert: "code" },
  0x170e: { name: "loc_170e", role: "resolve alien-march rate: key = [recordPtr+1]; scan the 4-entry threshold table loc_1cb8 for the first entry >= key; sto", cert: "code" },
  0x172c: { name: "loc_172c", role: "mode-gated sound step: loc_2025!=0 -> startSound(0x02), else loc_19dc(0xfd)", cert: "code" },
  0x1740: { name: "loc_1740", role: "shot-sound step: tick loc_209b burst timer (loc_176d at zero), bail unless loc_2068 set; tick loc_2096, emit SOUND_PORT5", cert: "code" },
  0x1775: { name: "loc_1775", role: "sound-pitch step: on the loc_2095 trigger, pick the fleet-rate byte for ALIEN_COUNT from the loc_1a11/loc_1a21 tables in", cert: "code" },
  0x1844: { name: "loc_1844", role: "draw a 16-row sprite column (row count forced to 0x10), preserving BC; live-out HL", cert: "code" },
  0x1904: { name: "loc_1904", role: "mark all aliens alive in the array based at 0x2200 (HL-relative 0x37-byte 0x01 fill)", cert: "code" },
  0x1988: { name: "loc_1988", role: "clear the play-field framebuffer", cert: "code" },
  0x19d1: { name: "loc_19d1", role: "store 1 -> GAME_ACTIVE (A:=1 then shared tail loc_19d3; mark game active)", cert: "code" },
  0x19d7: { name: "loc_19d7", role: "store 0 -> GAME_ACTIVE (xra a then shared tail loc_19d3; clear game-active flag)", cert: "code" },
  0x1982: { name: "loc_1982", role: "store A -> TASK_FLAGS", cert: "seen" },
  0x013b: { name: "selectAlternateSpriteFrame", role: "bump sprite pointer to 2nd bank (DE += 0x30)", cert: "code" },
  0x017a: { name: "alienIndexToScreenCoords", role: "resolve L over 0x0b into (L,C,D) using the B,C pair at loc_2009/loc_200a", cert: "code" },
  0x01c3: { name: "markAllAliensAlive", role: "HL-relative fill of 0x37 bytes with 0x01", cert: "seen" },
  0x01d9: { name: "advanceRecordTotals", role: "record accumulate: [HL+2]+=C, [HL+3]+=[HL+1]; return 2nd total in A", cert: "seen" },
  0x067e: { name: "loc_067e", role: "store HL (16-bit) -> loc_2048", cert: "code" },
  0x0886: { name: "activeFieldRecordPointer", role: "build HL = (ACTIVE_PLAYER_PAGE << 8) | 0xfc", cert: "code" },
  0x08d1: { name: "readStartingShips", role: "A = (port2 & 3) + 3", cert: "code" },
  0x08d8: { name: "loc_08d8", role: "if ALIEN_COUNT < 9: loc_207e = 0xfb", cert: "code" },
  0x0913: { name: "loc_0913", role: "gate on loc_2009<0x78, decrement 16-bit timer loc_2091, reload 0x0600 + set flag loc_2083 on wrap", cert: "code" },
  0x097c: { name: "loc_097c", role: "HL = loc_1da0 + clamp-index of A (offset 0 if A<2, 1 if 2<=A<4, 2 if A>=4)", cert: "code" },
  0x09ca: { name: "currentPlayerRecordPtr", role: "HL = bit0 of ACTIVE_PLAYER_PAGE ? PLAYER1_OBJ_DESC : PLAYER2_OBJ_DESC (active player's data pointer)", cert: "code" },
  0x09d6: { name: "clearPlayfield", role: "clear the play-field framebuffer", cert: "seen" },
  0x1439: { name: "drawSpriteColumn", role: "copy B bytes into B adjacent screen columns (stride 0x20 right per byte); live-out HL = HL + 0x20*B", cert: "seen" },
  0x147c: { name: "captureScreenRect", role: "block-copy a B-column x C-byte screen rectangle into a byte stream; live-out DE, HL", cert: "code" },
  0x14cc: { name: "fillScreenRow", role: "fill B columns with A stepping 0x20 right from HL (a horizontal band); leave HL one stride past", cert: "seen" },
  0x1581: { name: "loc_1581", role: "compute record pointer HL from index B, offset C, and the record-page cell", cert: "code" },
  0x1590: { name: "loc_1590", role: "normalize A up in 0x10 steps until non-negative, counting the steps in C", cert: "code" },
  0x1611: { name: "activePlayerPageBase", role: "HL := page byte (mem[ACTIVE_PLAYER_PAGE]) << 8", cert: "code" },
  0x176d: { name: "loc_176d", role: "OUT 5 := mem[SOUND_PORT5_SHADOW] & 0x30 (sound-off helper)", cert: "code" },
  0x1770: { name: "latchSoundPort5", role: "mask A to the two sound-select bits, OUT sound port 5", cert: "code" },
  0x17c0: { name: "readActivePlayerInput", role: "read the player-selected input port into A", cert: "code" },
  0x18e7: { name: "loc_18e7", role: "HL := 0x20e7 + bit0 of (0x2067)", cert: "code" },
  0x18f1: { name: "loc_18f1", role: "B := 2, or 3 when (0x2082) == 1", cert: "code" },
  0x18fa: { name: "startSound", role: "(0x2094) |= B, mirror to sound port, A := result", cert: "seen" },
  0x1910: { name: "loc_1910", role: "HL := loc_20e7 + (bit0 of ACTIVE_PLAYER_PAGE clear ? 1 : 0)", cert: "code" },
  0x19d3: { name: "loc_19d3", role: "store A -> GAME_ACTIVE (shared tail)", cert: "seen" },
  0x19dc: { name: "loc_19dc", role: "SOUND_PORT3_SHADOW &= B, mirror to sound port 3, A := result", cert: "seen" },
  0x1a32: { name: "blockCopy", role: "block-copy B bytes (DE)->(HL), both advancing", cert: "seen" },
  0x1a3b: { name: "loadSpriteDescriptor", role: "read 5-byte descriptor at (HL) -> DE/A/C/B, then HL=C:A", cert: "code" },
  0x1a47: { name: "coordToScreenAddr", role: "HL := (HL >> 3) with H forced into the 0x2000-0x3fff video-RAM page", cert: "seen" },
  0x1a5c: { name: "clearScreen", role: "zero video RAM 0x2400..0x3fff", cert: "seen" },
  0x1a69: { name: "orBlitBitmap", role: "OR-merge C source bytes down each of B columns (columns 0x20 apart); advance HL and DE", cert: "seen" },
};
