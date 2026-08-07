// SPDX-License-Identifier: GPL-3.0-only
/** loc_0d61 — fix the three things the shared digit painter needs and hand over: the character-plane
 * cell the run of digits starts from, the high end of the three-byte packed-decimal field it walks
 * down, and the colour laid beside every cell it fills. All three are constants chosen here, so
 * whatever a caller was holding is discarded. LIVE-OUT: memory -- the cells the painter fills. */

const FIRST_CELL = 0xa501;
const FIELD_HIGH_END = 0xad38;
const COLOUR = 0x10;
const PAINTER = 0x0d73;

export function loc_0d61(m) {
  const { regs } = m;
  regs.de = FIRST_CELL;
  regs.hl = FIELD_HIGH_END;
  regs.c = COLOUR;
  return m.call(PAINTER);
}
