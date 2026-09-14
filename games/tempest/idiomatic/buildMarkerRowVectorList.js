// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_2b, loc_3d, STATUS_FLAGS, MARKERROW_HEAD_OFS, VEC_GLYPH_BUFFER, MARKERROW_GLYPH_OFS, SLOT_COUNTDOWN, TABLE_CURSOR,
  BAR_GLYPH_LOW, BAR_GLYPH_HIGH, GAME_MODE, MARKERROW_PTR_OFS, GLYPH_PTR_TABLE, WORK_PTR_LO, WORK_PTR_HI,
} from "./names.js";
import { buildTextBufferDigitString } from "./buildTextBufferDigitString.js";

/**
 * buildMarkerRowVectorList -- lay one text/marker row into the 0x2f60 vector buffer. ROM 0xa97f.
 *
 * Role in the machine: Tempest's between-life and score overlays are drawn as a vector display
 * list. This routine composes a single row of that list for row index y: a header/framing word,
 * seven glyph slots (the "bar" of tick marks that shows lives, credits, or a countdown), and then a
 * hand-off that renders a numeric digit string for the row. It is one of the row emitters called by
 * the frame overlay composer (buildTextOverlayList / composeFrameDisplayList).
 *
 * Behavior: it stashes y in loc_2b as a scratch copy, then builds the row head byte in a -- normally
 * the caller's value OR'd with the 0x70 vector tag, but forced to just the bare tag (a=0) when this
 * row is the currently selected marker (y == loc_3d) and the marker-active bit (STATUS_FLAGS bit7) is
 * set, which blanks the head so the highlight can overdraw it. The head lands at MARKERROW_HEAD_OFS[y]
 * inside VEC_GLYPH_BUFFER. It then reads the row's tick count from SLOT_COUNTDOWN[y] into the cursor
 * cell TABLE_CURSOR, docking it by one when this is the marker row so the selected entry shows one
 * fewer filled tick. The loop fills seven glyph entries from MARKERROW_GLYPH_OFS[y] onward: rows within
 * the count get the filled glyph BAR_GLYPH_LOW, rows past it get the empty glyph BAR_GLYPH_HIGH, each
 * written two bytes apart (glyph + implicit tag). Finally, unless the game is in mode 4 on a non-marker
 * row (an early-out that skips the number on inactive rows), it seeds the digit-string source pointer
 * WORK_PTR_LO/HI from GLYPH_PTR_TABLE[y] (high byte 0) and tail-calls buildTextBufferDigitString with
 * the buffer cursor from MARKERROW_PTR_OFS[y].
 *
 * Live-out: the VEC_GLYPH_BUFFER row (head + seven glyph slots), TABLE_CURSOR (row tick count), loc_2b
 * (y scratch), WORK_PTR_LO/HI (digit source pointer), and whatever the digit-string builder emits.
 *
 * Grounding: [seen].
 */
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
