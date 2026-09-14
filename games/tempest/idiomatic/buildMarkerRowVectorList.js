// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_2b, loc_3d, STATUS_FLAGS, MARKERROW_HEAD_OFS, VEC_GLYPH_BUFFER, MARKERROW_GLYPH_OFS, SLOT_COUNTDOWN, TABLE_CURSOR,
  BAR_GLYPH_LOW, BAR_GLYPH_HIGH, GAME_MODE, MARKERROW_PTR_OFS, GLYPH_PTR_TABLE, WORK_PTR_LO, WORK_PTR_HI,
} from "./names.js";
import { buildTextBufferDigitString } from "./buildTextBufferDigitString.js";

// Build a 7-entry vector list from base indices keyed by y, seed the
// glyph pointer, then hand off to the nibble emitter.
export function buildMarkerRowVectorList(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2b] = y;

  // Head value: zeroed only when y hits the marker and $05's top bit is set.
  if (y === mem8[loc_3d] && (mem8[STATUS_FLAGS] & 0x80) !== 0) a = 0x00;
  a |= 0x70;

  let x = mem8[u16(MARKERROW_HEAD_OFS + y)];
  mem8[u16(VEC_GLYPH_BUFFER + x)] = a;
  x = mem8[u16(MARKERROW_GLYPH_OFS + y)];

  // Row count from the count cell; one short when at the marker index.
  let count = mem8[u16(SLOT_COUNTDOWN + y)];
  mem8[TABLE_CURSOR] = count;
  if (count !== 0 && y === mem8[loc_3d]) mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] - 1);

  for (let row = 1; ; ) {
    // Rows past the count use the alternate glyph.
    const glyph = row > mem8[TABLE_CURSOR] ? mem8[BAR_GLYPH_HIGH] : mem8[BAR_GLYPH_LOW];
    mem8[u16(VEC_GLYPH_BUFFER + x)] = glyph;
    x = u8(x + 2);
    row = u8(row + 1);
    if (row >= 7) break;
  }

  const yr = mem8[loc_2b];
  // Early out on state 4 away from the marker: no glyph pointer, no emit.
  if (mem8[GAME_MODE] === 4 && yr !== mem8[loc_3d]) return;

  x = mem8[u16(MARKERROW_PTR_OFS + yr)];
  mem8[WORK_PTR_LO] = mem8[u16(GLYPH_PTR_TABLE + yr)];
  mem8[WORK_PTR_HI] = 0x00;
  return buildTextBufferDigitString(m, x);
}
