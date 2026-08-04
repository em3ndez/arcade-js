// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22e1 — pick an object's velocity magnitude by level, then commit it.  ROM 0x22E1.
 *
 * The level-based arm of the object-velocity setup (sub_22cb, ROM 0x22CB). When the mode
 * flag selects this arm, the magnitude is chosen purely from the current LEVEL: level 1 and
 * level 2 each get their own byte, and every later level shares one. The chosen byte then
 * falls straight into loc_22f9, which commits it as the object record's magnitude field
 * (+0x11) and derives a sign field (+0x10) from its low bit. All three bytes are odd, so
 * this arm's sign field is always 0x00.
 *
 * The sibling arm loc_22f6 picks the magnitude from the RNG instead; both converge on the
 * same loc_22f9 store tail. objRecord is the record pointer the caller (sub_22cb) supplies.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22e1.test.js.
 * GATE:     exhaustive over the LEVEL input — all 256 values, at several real object-record
 *           pointers — because the whole effect is a pure function of LEVEL and the record
 *           pointer (both swept). Plus real captured 0x22E1 dispatches from an attract run
 *           (0 in plain attract is honest — the arm runs only once a board loads objects).
 *           Teeth: a constant-magnitude twin, an off-by-one level twin, a wrong-source twin
 *           (reads a neighbour cell, not LEVEL), and a fixed-address twin.
 * LIVE-OUT: memory-only (record +0x10 and +0x11, written by loc_22f9). The oracle's residual
 *           register state and its tail return are dead — the caller discards the result.
 * NAMES:    LEVEL (0x6229) from names.js. The three magnitude bytes are opaque ROM data (kept
 *           hex, named locally). record +0x10 / +0x11 are unnamed object-record field offsets
 *           written inside loc_22f9 (no names.js name — reported for the lead to name later).
 */

import { LEVEL } from "./names.js";
import { loc_22f9 } from "./loc_22f9.js";

// The object-velocity magnitude this arm feeds to loc_22f9, chosen by level. Kept hex — these
// are opaque ROM data bytes, not arithmetic. All three are odd (low bit set), so loc_22f9's
// low-bit sign test yields 0x00 for every level on this arm.
const LEVEL1_MAGNITUDE = 0x01;
const LEVEL2_MAGNITUDE = 0xb1;
const HIGHER_LEVEL_MAGNITUDE = 0xe9;

/**
 * @param {object} m          the machine.
 * @param {number} objRecord  base pointer of the object record to write (the caller's live-in).
 * @returns {*}               whatever loc_22f9 returns (the caller, sub_22cb, discards it).
 */
export function loc_22e1(m, objRecord) {
  const level = m.mem.read8(LEVEL);
  const magnitude =
    level === 1 ? LEVEL1_MAGNITUDE :
    level === 2 ? LEVEL2_MAGNITUDE :
    HIGHER_LEVEL_MAGNITUDE;
  return loc_22f9(m, objRecord, magnitude);
}
