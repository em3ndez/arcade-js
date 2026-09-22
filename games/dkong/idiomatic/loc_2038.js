// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2038 — start one object record falling, then hand on to the shared sprite tail.
 *
 * Writes seven bytes of one object-array record (the sweep keeps its base in the index
 * register), then falls into the shared object-sprite tail. It is a LAUNCH, not visible in
 * the stores: the motion step reads these fields to step a ballistic arc, so blanking the
 * counters and stamping a velocity initialises one. A signed -16 makes the gravity and
 * velocity terms push the position the SAME way from frame one, so the arc never turns over;
 * the selector's cleared bits pick the ballistic (falling) arm.
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";

// Record fields. None has a shared registry name; offsets this high are in-record only.
const ARM_SELECT = 2;
const X_FRACTION = 4;
const Y_FRACTION = 6;
const SUBSTATE = 14;
const INITIAL_VY_HI = 18;
const INITIAL_VY_LO = 19;
const AIRBORNE_FRAMES = 20;

const INITIAL_VY = -16; // signed 16-bit, 1/256-pixel units
const FALLING_ARM = 8;

// resetValue: blanked into the four counter/fraction fields (0 in play). record: a bridge param
// the shared tail also reads via m.regs.ix — leave it defaulted or the hand-off desyncs.
export function loc_2038(m, resetValue = m.regs.a, record = m.regs.ix) {
  const { mem8 } = m;

  // Launch downhill: with this velocity negative the motion never turns over.
  mem8[record + INITIAL_VY_HI] = INITIAL_VY >> 8;
  mem8[record + INITIAL_VY_LO] = INITIAL_VY;

  mem8[record + AIRBORNE_FRAMES] = resetValue;
  mem8[record + SUBSTATE] = resetValue;
  mem8[record + X_FRACTION] = resetValue;
  mem8[record + Y_FRACTION] = resetValue;

  mem8[record + ARM_SELECT] = FALLING_ARM;

  return publishBarrelSprite(m);
}
