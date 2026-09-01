// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders idiomatic-layer name registry. The frozen oracle in ../translated/ is the source of
// truth; this gives the idiomatic layer symbols for work-RAM cells + the ROUTINES map dispatched over
// the translated fallback (resolveAllIdiomatic). Tags: [seen] MAME-confirmed, [code] read from the
// translated behaviour, [guess] role unknown. loc_ cells are placeholders (understand half renames).

// Return-stack scratch (SP inits 0x2400, grows down; measured deepest 0x23e0). Excluded from the diff.
export const STACK_SCRATCH = { lo: 0x23e0, hi: 0x2400 };

export const loc_0600 = 0x0600;
export const loc_1da0 = 0x1da0;
export const loc_2009 = 0x2009;
export const loc_200a = 0x200a;
export const loc_2048 = 0x2048;
export const loc_2067 = 0x2067;
export const loc_207e = 0x207e;
export const loc_2082 = 0x2082;
export const loc_2083 = 0x2083;
export const loc_2091 = 0x2091;
export const loc_2094 = 0x2094;
export const loc_2098 = 0x2098;
export const loc_20c1 = 0x20c1;
export const loc_20e7 = 0x20e7;
export const loc_20e9 = 0x20e9;
export const loc_20f8 = 0x20f8;
export const loc_20fc = 0x20fc;
export const loc_2400 = 0x2400;
export const loc_2402 = 0x2402;
export const loc_4000 = 0x4000;

export const ROUTINES = {
  0x1982: { name: "loc_1982", role: "store A -> loc_20c1", cert: "code" },
  0x013b: { name: "loc_013b", role: "bump sprite pointer to 2nd bank (DE += 0x30)", cert: "code" },
  0x017a: { name: "loc_017a", role: "resolve L over 0x0b into (L,C,D) using the B,C pair at loc_2009/loc_200a", cert: "code" },
  0x01c3: { name: "loc_01c3", role: "HL-relative fill of 0x37 bytes with 0x01", cert: "code" },
  0x01d9: { name: "loc_01d9", role: "record accumulate: [HL+2]+=C, [HL+3]+=[HL+1]; return 2nd total in A", cert: "code" },
  0x067e: { name: "loc_067e", role: "store HL (16-bit) -> loc_2048", cert: "code" },
  0x0886: { name: "loc_0886", role: "build HL = (loc_2067 << 8) | 0xfc", cert: "code" },
  0x08d1: { name: "loc_08d1", role: "A = (port2 & 3) + 3", cert: "code" },
  0x08d8: { name: "loc_08d8", role: "if loc_2082 < 9: loc_207e = 0xfb", cert: "code" },
  0x0913: { name: "loc_0913", role: "gate on loc_2009<0x78, decrement 16-bit timer loc_2091, reload 0x0600 + set flag loc_2083 on wrap", cert: "code" },
  0x097c: { name: "loc_097c", role: "HL = loc_1da0 + clamp-index of A (offset 0 if A<2, 1 if 2<=A<4, 2 if A>=4)", cert: "code" },
  0x09ca: { name: "loc_09ca", role: "HL = bit0 of loc_2067 ? loc_20f8 : loc_20fc (active player's data pointer)", cert: "code" },
  0x09d6: { name: "loc_09d6", role: "clear the play-field framebuffer", cert: "code" },
  0x1439: { name: "loc_1439", role: "copy B bytes into a vertical screen column (live-out HL = HL + 0x20*B)", cert: "code" },
  0x147c: { name: "loc_147c", role: "block-copy a B-row x C-col rectangle from a screen-shaped source into a byte stream (live-out DE, HL)", cert: "code" },
  0x14cc: { name: "loc_14cc", role: "fill B rows with A down from HL, stride 0x20; leave HL one stride past the last cell", cert: "code" },
  0x1581: { name: "loc_1581", role: "compute record pointer HL from index B, offset C, and the record-page cell", cert: "code" },
  0x1590: { name: "loc_1590", role: "normalize A up in 0x10 steps until non-negative, counting the steps in C", cert: "code" },
  0x1611: { name: "loc_1611", role: "HL := page byte (mem[loc_2067]) << 8", cert: "code" },
  0x176d: { name: "loc_176d", role: "OUT 5 := mem[loc_2098] & 0x30 (sound-off helper)", cert: "code" },
  0x1770: { name: "loc_1770", role: "mask A to the two sound-select bits, OUT sound port 5", cert: "code" },
  0x17c0: { name: "loc_17c0", role: "read the player-selected input port into A", cert: "code" },
  0x18e7: { name: "loc_18e7", role: "HL := 0x20e7 + bit0 of (0x2067)", cert: "code" },
  0x18f1: { name: "loc_18f1", role: "B := 2, or 3 when (0x2082) == 1", cert: "code" },
  0x18fa: { name: "loc_18fa", role: "(0x2094) |= B, mirror to sound port, A := result", cert: "code" },
  0x1910: { name: "loc_1910", role: "HL := loc_20e7 + (bit0 of loc_2067 clear ? 1 : 0)", cert: "code" },
  0x19d3: { name: "loc_19d3", role: "store A -> loc_20e9 (shared tail)", cert: "code" },
  0x19dc: { name: "loc_19dc", role: "loc_2094 &= B, mirror to sound port 3, A := result", cert: "code" },
  0x1a32: { name: "loc_1a32", role: "block-copy B bytes (DE)->(HL), both advancing", cert: "code" },
  0x1a3b: { name: "loc_1a3b", role: "read 5-byte descriptor at (HL) -> DE/A/C/B, then HL=C:A", cert: "code" },
  0x1a47: { name: "loc_1a47", role: "HL := (HL >> 3) with H forced into the 0x2000-0x3fff video-RAM page", cert: "code" },
  0x1a5c: { name: "loc_1a5c", role: "zero video RAM 0x2400..0x3fff", cert: "code" },
  0x1a69: { name: "loc_1a69", role: "OR-merge C source bytes into each of B rows (rows 0x20 apart); advance HL and DE", cert: "code" },
};
