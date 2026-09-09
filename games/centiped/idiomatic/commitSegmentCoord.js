// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_64 } from "./names.js";
import { advanceSegmentCoordAndArm } from "./advanceSegmentCoordAndArm.js";

/**
 * commitSegmentCoord — write the freshly computed coordinate for segment X into its $64+X field,
 * then hand off to the next step handler. The store is the whole body; the tail transfer keeps the
 * segment walk going. [code]
 */
export function commitSegmentCoord(m, x = m.regs.x, a = m.regs.a) {
  m.mem8[u8(loc_64 + x)] = a;
  return advanceSegmentCoordAndArm(m, x);
}
