// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22f6 — set an object's velocity from the RNG.  ROM 0x22F6.
 *
 * The chance-based arm of the object-velocity setup: it takes the current RANDOM byte as the
 * velocity magnitude and falls straight into loc_22f9, which commits that byte as the record's
 * magnitude field (+0x11) and its parity as a sign field (+0x10). The sibling arms pick the
 * magnitude a different way (level-based / difficulty-scaled); this one is pure chance. It is a
 * one-line tail into loc_22f9 — no work of its own beyond choosing the source byte.
 *
 * Faithful to translated/loc_22f6.js. objRecord is the register live-in (IX) that the
 * still-translated caller (sub_22cb) supplies; the value comes from RANDOM.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22f6.test.js.
 */
import { RANDOM } from "./names.js";
import { loc_22f9 } from "./loc_22f9.js";

/**
 * @param {object} m          the machine.
 * @param {number} objRecord  base pointer of the object record to write (IX live-in).
 * @returns {*}               whatever loc_22f9 returns (the caller, sub_22cb, discards it).
 */
export function loc_22f6(m, objRecord) {
  return loc_22f9(m, objRecord, m.mem.read8(RANDOM));
}
