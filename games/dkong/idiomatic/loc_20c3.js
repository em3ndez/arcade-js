// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20c3 — turn an object's vertical arc around at a quarter of the speed it arrived with, restart
 * the arc from a whole-pixel position, and hand the record to the shared object-sprite tail. The
 * integrator moves the object by (16·frames + 8 − launchSpeed) per frame, so a reversal folds the
 * elapsed frames back in as 16·frames − launchSpeed with the frame count restarted from zero.
 *
 * LIVE-OUT: memory (the five record bytes), the tail's result forwarded unchanged, and the damped
 * speed mirrored into the register pair (no reader for the mirror is known).
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";
import { loc_2407 } from "./loc_2407.js";

const LAUNCH_VY_HI = 0x12; //     upper half of the speed the vertical arc started with
const LAUNCH_VY_LO = 0x13; //     lower half of it
const AIRBORNE_FRAMES = 0x14; //  frames elapsed on this arc; scales the gravity term
const X_FRAC = 0x04; //           fractional low half of the horizontal coordinate
const Y_FRAC = 0x06; //           fractional low half of the vertical coordinate

export function loc_20c3(m, record = m.regs.ix) {
  const { regs, mem8 } = m;

  const reflected = loc_2407(m);

  // A quarter of the reflection is the new launch speed; the shift drops the low two bits and does
  // not preserve sign.
  const damped = reflected >>> 2;

  mem8[record + LAUNCH_VY_HI] = damped >> 8;
  mem8[record + LAUNCH_VY_LO] = damped;

  mem8[record + AIRBORNE_FRAMES] = 0;
  mem8[record + X_FRAC] = 0;
  mem8[record + Y_FRAC] = 0;

  regs.hl = damped; // mirrored where the tail parks it; kept because the hardware leaves it, no known consumer

  return publishBarrelSprite(m);
}
