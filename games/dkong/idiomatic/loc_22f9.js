// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22f9 — commit a value and its low-bit-derived sign into two object-record fields.  ROM 0x22F9.
 *
 * The store tail of the object setup routine sub_22cb (ROM 0x22CB, "OBJECT VELOCITY INIT"):
 * the difficulty/mode dispatch above it picks a single byte, and this leaf writes it into the
 * object record the caller has aimed at as two adjacent fields:
 *
 *   record +0x11  <-  value            (stored verbatim — the magnitude field)
 *   record +0x10  <-  (value & 1) - 1  (0x00 when value is odd, 0xFF when even — a sign field)
 *
 * The +0x10 field is a signed direction byte: 0x00 for one direction, 0xFF (i.e. -1
 * sign-extended into a byte) for the other, chosen purely by the low bit of the value. The byte
 * store turns the -1 into 0xFF, so no explicit width fixup is needed.
 *
 * [guess] the pair reads as an object's per-frame velocity — magnitude at +0x11, direction sign
 * at +0x10 — matching sub_22cb's role. But the two record fields are unnamed engine scratch and
 * the velocity reading is not corroborated to the naming bar, so the neutral loc_ name is kept
 * (same call the sibling object-record dispatcher endKongWalkAndAdvanceInterlude made).
 *
 * A LEAF: writes the two fields and returns; calls nothing and returns nothing a caller consumes
 * — the sole caller (loc_2146) overwrites the returned value with a fresh record read before
 * using it, so the routine's whole effect is those two bytes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22f9.test.js.
 * GATE:     exhaustive over the value input — all 256 values, at several real object-record
 *           pointers — because both written fields are pure functions of the value; the multiple
 *           pointers prove the fields are addressed relative to the record, not at a fixed spot.
 *           Plus real captured 0x22F9 dispatches from an attract run. Teeth: a dropped-sign twin,
 *           a swapped-field twin, and a fixed-address twin.
 * LIVE-OUT: memory-only (record +0x10 and +0x11). The oracle's residual register state and its
 *           terminal return are dead — the caller reloads before reading, so nothing downstream
 *           observes them.
 * NAMES:    none imported. objRecord (the object-record pointer) and value (the dispatched byte)
 *           are honest inputs; +0x10 / +0x11 are unnamed object-record field offsets (no names.js
 *           name — reported for the lead to name later).
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
