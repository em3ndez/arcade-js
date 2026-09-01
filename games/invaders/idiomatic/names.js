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

export const ROUTINES = {
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
