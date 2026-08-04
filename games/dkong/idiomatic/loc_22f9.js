// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22f9 — commit a value and its low-bit-derived sign into two object-record fields.
 *
 * The store tail of the object setup path: a difficulty/mode dispatch above it picks a
 * single byte, and this leaf writes that byte into the object record the caller has
 * aimed at, as two adjacent fields:
 *
 *   record +0x11  <-  value            (stored verbatim — the magnitude field)
 *   record +0x10  <-  (value & 1) - 1  (0x00 when value is odd, 0xFF when even — a sign field)
 *
 * The +0x10 field is a signed direction byte: 0x00 for one direction, 0xFF (i.e. -1
 * sign-extended into a byte) for the other, chosen purely by the low bit of the value.
 * The byte store turns the -1 into 0xFF, so no explicit width fixup is needed.
 *
 * [guess] the pair reads as an object's per-frame velocity — magnitude at +0x11,
 * direction sign at +0x10. Both record fields are unnamed engine scratch and the
 * velocity reading is not corroborated to the naming bar, so nothing beyond the store
 * itself is asserted.
 *
 * A LEAF: writes the two fields and returns; calls nothing and returns nothing a caller
 * consumes — the caller re-reads the record before using it, so the routine's whole
 * effect is those two bytes.
 *
 * LIVE-OUT: memory-only (record +0x10 and +0x11).
 */

/**
 * @param {object} m          the machine (uses m.mem only).
 * @param {number} objRecord  base pointer of the object record to write.
 * @param {number} value      the dispatched byte: its magnitude, and its low bit, are stored.
 * @returns {void}
 */
export function loc_22f9(m, objRecord, value) {
  const { mem } = m;

  // Magnitude field: the value stored verbatim.
  mem.write8((objRecord + 0x11) & 0xffff, value);

  // Direction sign field: 0x00 when the value's low bit is set, 0xFF (a -1 sign byte) when it is
  // clear. The byte store truncates the -1 to 0xFF.
  mem.write8((objRecord + 0x10) & 0xffff, (value & 1) - 1);
}
