// SPDX-License-Identifier: GPL-3.0-only
import { loc_60, loc_8b } from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { advanceHeadOrientationAndStampTile } from "./advanceHeadOrientation.js";

/**
 * storeHeadVelocity -- commit the head's new velocity into $60/$8b, then continue by its zero-ness:
 * a nonzero velocity advances the head orientation, a zero velocity reseeds the wave. The caller
 * hands the velocity in A and its zero flag; the fall-through the source keeps here is unreachable
 * (the two branches are exhaustive on that flag). [code]
 */
export function storeHeadVelocity(m, a = m.regs.a, zero = m.regs.fZ) {
  m.mem8[loc_60] = a;
  m.mem8[loc_8b] = a;
  if (!zero) return advanceHeadOrientationAndStampTile(m);
  return seedWaveState(m);
}
