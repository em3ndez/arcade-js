// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20e1 — send an object off to the right at one pixel per frame, then hand its record to the
 * shared launch tail.
 * The two bytes are the record's 16-bit horizontal velocity in 1/256-pixel units, whole pixels
 * first then the fraction, so 1 and 0 is +1.0 px/frame. The whole-pixel byte carries the sign;
 * positive is rightward. NOT CLAIMED: why an object is sent right rather than left.
 */

// The record's 16-bit horizontal velocity: whole pixels first, then the 1/256-pixel fraction.
import { u16 } from "../../../core/int.js";
import { loc_20c3 } from "./loc_20c3.js";

const VELOCITY_X_WHOLE = 0x10;
const VELOCITY_X_FRACTION = 0x11;
// This arm's value: one whole pixel per frame, no fraction, positive (rightward).
const RIGHTWARD_ONE_PIXEL_WHOLE = 1;
const RIGHTWARD_ONE_PIXEL_FRACTION = 0;

export function loc_20e1(m, record = m.regs.ix) {
  const { mem8 } = m;
  const at = (offset) => u16(record + offset);

  mem8[at(VELOCITY_X_WHOLE)] = RIGHTWARD_ONE_PIXEL_WHOLE;
  mem8[at(VELOCITY_X_FRACTION)] = RIGHTWARD_ONE_PIXEL_FRACTION;

  // On into the shared tail, which rebuilds the vertical half of the launch from the same record.
  return loc_20c3(m);
}
