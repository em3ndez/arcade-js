// SPDX-License-Identifier: GPL-3.0-only
/** dispatchCollisionPassByEra — dispatch one round's collision pass by era, then by frame parity: era 4 and era 1 each
 * take a dedicated tail, every other era splits on the low bit of the frame tick. LIVE-OUT: memory. */

import { dispatchEra4CollisionByFrameParity } from "./dispatchEra4CollisionByFrameParity.js";
import { splitCollisionWorkByFrameParity } from "./splitCollisionWorkByFrameParity.js";
import { dispatchShotSweepByMotherShipArmed } from "./dispatchShotSweepByMotherShipArmed.js";
import { runAllCollisionSweepsThisFrame } from "./runAllCollisionSweepsThisFrame.js";
import { ERA_INDEX, FRAME_TICK } from "./names.js";

export function dispatchCollisionPassByEra(m) {
  const { mem8 } = m;
  const era = mem8[ERA_INDEX];
  if (era === 4) return dispatchEra4CollisionByFrameParity(m);
  if (era === 1) return splitCollisionWorkByFrameParity(m);
  if (mem8[FRAME_TICK] & 0x01) return dispatchShotSweepByMotherShipArmed(m);
  return runAllCollisionSweepsThisFrame(m);
}
