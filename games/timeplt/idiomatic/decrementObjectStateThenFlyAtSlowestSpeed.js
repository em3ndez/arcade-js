// SPDX-License-Identifier: GPL-3.0-only
/**
 * decrementObjectStateThenFlyAtSlowestSpeed — count an object's state byte down by one and let it fly on
 * a single step at the slowest of the velocity-table speeds.
 *
 * ROM 0x2BB4-0x2BB9 (`dec (ix+0x00)`, then a tail jump to 0x5840). Grounding: [seen] (names.js ROUTINES 0x2BB4).
 *
 * ROLE IN THE MACHINE. Every object slot's first byte is its state byte: 0x00 free, 0xFF live, 0xF0 just
 * hit, and a countdown below that (names.js MOTHER_SHIP_STATE [seen], "same alphabet as every other slot").
 * This routine is one tick of that countdown for an object that is neither free, live nor held — it is
 * reached from stepDyingObjectState and moveObjectByStateByteThenRunAppearance, the per-object state steps,
 * both of which pass it the object they are stepping.
 *
 * The countdown wraps at a byte and nothing here tests it: reaching zero is the caller's business, and the
 * flight step happens either way.
 *
 * `object` is the object's record (the ROM's IX); `sprite` its sprite entry (the ROM's IY), passed on to the
 * flight step.
 *
 * LIVE-OUT: memory-only.
 */

import { flyAtSlowestSpeed } from "./flyAtSlowestSpeed.js";
import { u8 } from "../../../core/int.js";

/** The state byte is the record's first byte (ROM `(ix+0x00)`). */
const STATE = 0;

export function decrementObjectStateThenFlyAtSlowestSpeed(m, object = m.regs.ix, sprite = m.regs.iy) {
  const { mem8 } = m;
  // One tick of the countdown, wrapping below zero, then one step of flight at the slowest speed.
  mem8[object + STATE] = u8(mem8[object + STATE] - 1);
  flyAtSlowestSpeed(m, object, sprite);
}
