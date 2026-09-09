// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_c0, loc_c1, loc_c2, loc_fb, loc_fc, loc_89, loc_01, loc_b9,
  loc_018b, loc_018c, loc_018d, loc_018e, loc_018f, loc_0190, loc_0191,
  loc_02, loc_03, loc_04, loc_a8, loc_aa, loc_ac,
  loc_17, loc_1a, loc_1b, loc_1c, loc_8d, loc_8e,
} from "./names.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";

/**
 * bcdAdd — one NMOS 6502 decimal-mode (SED) byte add: `a + v + carryIn` computed in packed BCD,
 * returning `[sum, carryOut]`.
 *
 * Why it is here: the rate accumulators below tick up as human-readable decimal counters, and the
 * original ROM does that with the 6502 in decimal mode. This reproduces the exact NMOS decimal ADC:
 * add the low nibbles, apply the +6 correction when the low nibble exceeds 9 (carrying 0x10 up), add
 * the high nibbles, then apply the +0x60 correction when the high result reaches 0xa0. The carry-out
 * is the true >= 0x100 overflow, matching the hardware C flag so multi-byte decimal counters chain
 * correctly.
 */
function bcdAdd(a, v, carryIn) {
  // Low nibble first, including the incoming carry. If it lands above 9 it is not a valid BCD digit,
  // so add 6 to fold it back into 0..9 and push a 0x10 into the high-nibble column.
  let low = (a & 0x0f) + (v & 0x0f) + carryIn;
  if (low > 9) low = ((low + 6) & 0x0f) + 0x10;
  // High nibbles plus whatever the low column carried up. If that reaches 0xa0 the high digit is
  // invalid too, so add 0x60 to correct it (which is also what pushes the >= 0x100 decimal carry-out).
  let sum = (a & 0xf0) + (v & 0xf0) + low;
  if (sum >= 0xa0) sum += 0x60;
  return [sum & 0xff, sum >= 0x100 ? 1 : 0];
}

/**
 * buildSortedObjectTable -- advance the decimal rate accumulators, then insert the active objects
 * into the key-sorted slot table [code].
 *
 * Role in the machine: called on the wave-restart / respawn path, this both (a) ticks the running
 * decimal counters that pace the wave and (b) rebuilds the sorted object table that
 * `plotRecordFieldColumns` later draws. The table is a set of three-byte records based at `loc_02`
 * (field planes loc_02/loc_03/loc_04), kept sorted by a 24-bit key so the display shows objects in
 * key order.
 *
 * Two rate accumulators tick up in packed BCD: the wider one at `loc_018e`..`loc_0191` advances by
 * the `loc_fb`/`loc_fc` delta, and ONLY when it does not carry out of its top does the narrower one
 * at `loc_018b`..`loc_018d` advance by the `loc_89` rate -- so the wide accumulator's overflow gates
 * its partner. Then each of the two active objects (x = 1, 0) is compared by its 24-bit key against
 * every three-byte slot; the first slot whose key is SMALLER takes the object, with the records above
 * the insertion point shifted up to make room. A trailing clamp bounds the high-water slot `loc_c2`,
 * and when both high-water marks stay negative the whole grid is redrawn.
 *
 * Grounding: [code]; the `POKEY`-adjacent cells are covered in mechanisms.md's object-table section.
 * Live-out: none returned; effect is the mutated table plus a possible full redraw.
 */
export function buildSortedObjectTable(m) {
  // Seed the two high-water / insertion-tracking marks to 0xff (negative sign bit set = "nothing
  // inserted yet"). insertSlot lowers loc_c1 as objects land; loc_c2 is the clamped high-water slot.
  m.mem8[loc_c1] = 0xff;
  m.mem8[loc_c2] = 0xff;

  // Advance the WIDE four-byte decimal accumulator (018e low .. 0191 high) by the loc_fb/loc_fc
  // delta, carrying through each byte. The top byte's add is computed separately so its carry-out
  // can gate the partner accumulator below.
  let carry;
  [m.mem8[loc_018e], carry] = bcdAdd(m.mem8[loc_018e], m.mem8[loc_fb], 0);
  [m.mem8[loc_018f], carry] = bcdAdd(m.mem8[loc_018f], m.mem8[loc_fc], carry);
  [m.mem8[loc_0190], carry] = bcdAdd(m.mem8[loc_0190], 0, carry);
  const [top, topCarry] = bcdAdd(m.mem8[loc_0191], 0, carry);
  // Only commit the top byte and tick the NARROW accumulator when the wide one did NOT overflow its
  // top -- the overflow is the gate that holds the partner back for a cycle.
  if (!topCarry) {
    m.mem8[loc_0191] = top;
    let rateCarry;
    [m.mem8[loc_018b], rateCarry] = bcdAdd(m.mem8[loc_018b], m.mem8[loc_89], 0);
    [m.mem8[loc_018c], rateCarry] = bcdAdd(m.mem8[loc_018c], 0, rateCarry);
    [m.mem8[loc_018d], rateCarry] = bcdAdd(m.mem8[loc_018d], 0, rateCarry);
  }

  // Insertion pass over the two active objects, high index first (x = 1 then 0). Each object's sort
  // key is a 24-bit value assembled little-endian from its three parallel field cells (a8/aa/ac +x).
  for (let x = 1; x >= 0; x--) {
    const objKey = m.mem8[(loc_a8 + x) & 0xff]
      | (m.mem8[(loc_aa + x) & 0xff] << 8)
      | (m.mem8[(loc_ac + x) & 0xff] << 16);
    // Scan the eight three-byte slot records (y steps by 3 up to 0x18), building each slot's 24-bit
    // key the same way. The FIRST slot whose key is smaller than the object's is the sorted
    // insertion point: open it and stop scanning this object.
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

  // Trailing high-water clamp: while loc_c2 is non-negative and still at or above loc_c1, step it up
  // by one record (3). The original compare left carry set, so the ROM's adc carries the extra +1 in
  // -- reproduced here by the plain +3. Cap it at 0xff once it reaches the 0x18 end of the table.
  let mark = m.mem8[loc_c2];
  if (!(mark & 0x80) && mark >= m.mem8[loc_c1]) {
    mark = (mark + 3) & 0xff; // the compare set carry, so the add carries in
    m.mem8[loc_c2] = mark >= 0x18 ? 0xff : mark;
  }

  // Reset the spawn-column counter, then: when BOTH high-water marks are still negative (nothing was
  // inserted this pass), clear the redraw latch loc_01 and repaint the whole sorted grid.
  m.mem8[loc_c0] = 0x00;
  if ((m.mem8[loc_c2] & m.mem8[loc_c1]) & 0x80) {
    m.mem8[loc_01] = 0x00;
    plotRecordFieldColumns(m);
  }
}

/**
 * insertSlot — open slot `y` for object `x`, shifting every record above the insertion point up by
 * one three-byte record so the freed slot can hold the new object in sorted order.
 *
 * It stashes the object index and target slot into the work cells `loc_8d`/`loc_8e`, records the new
 * insertion point for this object in the `loc_c1+x` high-water mark, then walks the table from the
 * top (index 0x17) down to the target, copying each three-byte record up and copying the PARALLEL
 * glyph block (`loc_17`/`loc_1a`) in lockstep so numbers and glyphs stay aligned. The vacated head
 * record is seeded to `01 00 00`, and finally the object's three key bytes (from the a8/aa/ac field
 * planes) are written into the freed slot. [code]
 */
function insertSlot(m, x, y) {
  // Park the object index and target slot in the work cells the copy loop and tail read back.
  m.mem8[loc_8d] = x;
  m.mem8[loc_8e] = y;
  m.mem8[(loc_c1 + x) & 0xff] = y;

  // Shift records up: from the top of the table (0x17) down to (but not including) the target slot,
  // copy each record's key byte up by three and the parallel glyph byte (loc_17 source -> loc_1a
  // dest) up by one, opening a three-byte hole at the insertion point.
  let i = 0x17;
  do {
    m.mem8[(loc_1a + i) & 0xff] = m.mem8[(loc_17 + i) & 0xff];
    m.mem8[(loc_02 + i) & 0xff] = m.mem8[loc_02 + i - 3];
    i = (i - 1) & 0xff;
  } while (i !== m.mem8[loc_8e]);

  // Seed the just-vacated glyph head to the default "01 00 00" record and clear the b9 flag.
  m.mem8[(loc_1a + i) & 0xff] = 0x01;
  m.mem8[(loc_1b + i) & 0xff] = 0x00;
  m.mem8[(loc_1c + i) & 0xff] = 0x00;
  m.mem8[loc_b9] = 0x00;

  // Drop the object's three key bytes (its ac/aa/a8 field triple) into the freed slot, then set the
  // redraw latch loc_01 to 0xf0 to mark the table dirty for the display pass.
  const obj = m.mem8[loc_8d];
  m.mem8[loc_04 + y] = m.mem8[(loc_ac + obj) & 0xff];
  m.mem8[loc_03 + y] = m.mem8[(loc_aa + obj) & 0xff];
  m.mem8[loc_02 + y] = m.mem8[(loc_a8 + obj) & 0xff];
  m.mem8[loc_01] = 0xf0;
}
