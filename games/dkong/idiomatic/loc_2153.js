import { publishBarrelSprite } from "./publishBarrelSprite.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2153 — clear an object record's fractional X/Y remainders and its airborne-frame counter,
 * then hand the record to the shared object-sprite tail.
 * The three fields are the ones the ballistic integrator consumes: +4 and +6 are the fractional low
 * halves of the coordinates whose high bytes are OBJ_X/OBJ_Y, and +20 is the airborne-frame counter
 * that scales gravity. Clearing all three restarts the arc from a whole-pixel position with gravity
 * at its first step. They are a SET, written together from one value; both callers clear the value
 * first, so in practice this is a clear to zero.
 */

const AIRBORNE_FRAMES = 20; // elapsed airborne frames; scales the gravity term
const X_FRAC = 4;
const Y_FRAC = 6;

export function loc_2153(m, cur, stored = m.regs.a, record = m.regs.ix) {
  const { mem8 } = m;

  mem8[record + AIRBORNE_FRAMES] = stored;
  mem8[record + X_FRAC] = stored;
  mem8[record + Y_FRAC] = stored;

  // Shared object-sprite tail, reached by a jump, so its result is this routine's result.
  return publishBarrelSprite(m, cur);
}
