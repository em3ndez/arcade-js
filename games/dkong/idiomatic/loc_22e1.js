// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22e1 — pick an object's velocity magnitude by level, then commit it.
 *
 * The level-based arm of the object-velocity setup. When the mode flag selects this arm, the
 * magnitude is chosen purely from the current LEVEL: level 1 and level 2 each get their own
 * byte, and every later level shares one. The chosen byte then falls straight into the shared
 * store tail, which commits it as the object record's magnitude field (+0x11) and derives a
 * sign field (+0x10) from its low bit. All three bytes are odd, so this arm's sign field is
 * always 0x00.
 *
 * The sibling arm picks the magnitude from the random-number generator instead; both converge
 * on that same store tail. objRecord is the record pointer the caller supplies.
 *
 * LIVE-OUT: memory-only — the record's sign and magnitude fields, written by the store tail.
 */

import { LEVEL } from "./names.js";
import { loc_22f9 } from "./loc_22f9.js";

// The object-velocity magnitude this arm commits, chosen by level. Kept hex — these are
// opaque data bytes, not arithmetic. All three are odd (low bit set), so the store tail's
// low-bit sign test yields 0x00 for every level on this arm.
const LEVEL1_MAGNITUDE = 0x01;
const LEVEL2_MAGNITUDE = 0xb1;
const HIGHER_LEVEL_MAGNITUDE = 0xe9;

/**
 * @param {object} m          the machine.
 * @param {number} objRecord  base pointer of the object record to write (the caller's live-in).
 * @returns {*}               whatever the store tail returns; the caller discards it.
 */
export function loc_22e1(m, objRecord) {
  const level = m.mem.read8(LEVEL);
  const magnitude =
    level === 1 ? LEVEL1_MAGNITUDE :
    level === 2 ? LEVEL2_MAGNITUDE :
    HIGHER_LEVEL_MAGNITUDE;
  return loc_22f9(m, objRecord, magnitude);
}
