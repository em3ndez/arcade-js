// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22f6 — give an object a randomly-sized velocity.
 *
 * The chance arm of the object-velocity setup: it takes the current value of the game's rolling
 * RANDOM byte as the speed magnitude and hands it straight to the shared commit step, which stores
 * that byte as the record's magnitude field (+0x11) and its parity as the record's sign field
 * (+0x10). The sibling arms pick the magnitude from the level or from the difficulty curve; this
 * one is pure chance, and choosing the source byte is all it does.
 *
 * LIVE-OUT: whatever the commit step returns.
 */
import { RANDOM } from "./names.js";
import { loc_22f9 } from "./loc_22f9.js";

/**
 * @param {object} m          the machine.
 * @param {number} objRecord  base pointer of the object record to write; it arrives in the
 *                            machine's index register and is passed through untouched.
 * @returns {*}               whatever the commit step returns; the caller discards it.
 */
export function loc_22f6(m, objRecord) {
  return loc_22f9(m, objRecord, m.mem.read8(RANDOM));
}
