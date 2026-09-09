// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_c0, loc_c1, loc_c2, loc_fb, loc_fc, loc_89, loc_01, loc_b9,
  loc_018b, loc_018c, loc_018d, loc_018e, loc_018f, loc_0190, loc_0191,
  loc_02, loc_03, loc_04, loc_a8, loc_aa, loc_ac,
  loc_17, loc_1a, loc_1b, loc_1c, loc_8d, loc_8e,
} from "./names.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";

/** One NMOS decimal-mode byte add; returns [sum, carryOut]. */
function bcdAdd(a, v, carryIn) {
  let low = (a & 0x0f) + (v & 0x0f) + carryIn;
  if (low > 9) low = ((low + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + low;
  if (sum >= 0xa0) sum += 0x60;
  return [sum & 0xff, sum >= 0x100 ? 1 : 0];
}

/**
 * buildSortedObjectTable -- advances the rate accumulators, then inserts objects into the
 * key-sorted slot table [code].
 *
 * The two multi-byte rate accumulators tick up in decimal; the wider one skips its partner on
 * overflow. Then each of the two active objects is compared, by a 24-bit key, against every
 * three-byte slot record; the first slot whose key is smaller takes the object, records above
 * the insertion point shifting up to make room. A trailing clamp bounds the high-water slot and
 * rebuilds the row when both marks stay negative.
 */
export function buildSortedObjectTable(m) {
  m.mem8[loc_c1] = 0xff;
  m.mem8[loc_c2] = 0xff;

  let carry;
  [m.mem8[loc_018e], carry] = bcdAdd(m.mem8[loc_018e], m.mem8[loc_fb], 0);
  [m.mem8[loc_018f], carry] = bcdAdd(m.mem8[loc_018f], m.mem8[loc_fc], carry);
  [m.mem8[loc_0190], carry] = bcdAdd(m.mem8[loc_0190], 0, carry);
  const [top, topCarry] = bcdAdd(m.mem8[loc_0191], 0, carry);
  if (!topCarry) {
    m.mem8[loc_0191] = top;
    let rateCarry;
    [m.mem8[loc_018b], rateCarry] = bcdAdd(m.mem8[loc_018b], m.mem8[loc_89], 0);
    [m.mem8[loc_018c], rateCarry] = bcdAdd(m.mem8[loc_018c], 0, rateCarry);
    [m.mem8[loc_018d], rateCarry] = bcdAdd(m.mem8[loc_018d], 0, rateCarry);
  }

  for (let x = 1; x >= 0; x--) {
    const objKey = m.mem8[(loc_a8 + x) & 0xff]
      | (m.mem8[(loc_aa + x) & 0xff] << 8)
      | (m.mem8[(loc_ac + x) & 0xff] << 16);
    for (let y = 0; y < 0x18; y += 3) {
      const slotKey = m.mem8[loc_02 + y]
        | (m.mem8[loc_03 + y] << 8)
        | (m.mem8[loc_04 + y] << 16);
      if (slotKey < objKey) {
        insertSlot(m, x, y);
        break;
      }
    }
  }

  let mark = m.mem8[loc_c2];
  if (!(mark & 0x80) && mark >= m.mem8[loc_c1]) {
    mark = (mark + 3) & 0xff; // the compare set carry, so the add carries in
    m.mem8[loc_c2] = mark >= 0x18 ? 0xff : mark;
  }

  m.mem8[loc_c0] = 0x00;
  if ((m.mem8[loc_c2] & m.mem8[loc_c1]) & 0x80) {
    m.mem8[loc_01] = 0x00;
    plotRecordFieldColumns(m);
  }
}

/** Open slot y for object x, shifting the records above it up by one three-byte record. */
function insertSlot(m, x, y) {
  m.mem8[loc_8d] = x;
  m.mem8[loc_8e] = y;
  m.mem8[(loc_c1 + x) & 0xff] = y;

  let i = 0x17;
  do {
    m.mem8[(loc_1a + i) & 0xff] = m.mem8[(loc_17 + i) & 0xff];
    m.mem8[(loc_02 + i) & 0xff] = m.mem8[loc_02 + i - 3];
    i = (i - 1) & 0xff;
  } while (i !== m.mem8[loc_8e]);

  m.mem8[(loc_1a + i) & 0xff] = 0x01;
  m.mem8[(loc_1b + i) & 0xff] = 0x00;
  m.mem8[(loc_1c + i) & 0xff] = 0x00;
  m.mem8[loc_b9] = 0x00;

  const obj = m.mem8[loc_8d];
  m.mem8[loc_04 + y] = m.mem8[(loc_ac + obj) & 0xff];
  m.mem8[loc_03 + y] = m.mem8[(loc_aa + obj) & 0xff];
  m.mem8[loc_02 + y] = m.mem8[(loc_a8 + obj) & 0xff];
  m.mem8[loc_01] = 0xf0;
}
