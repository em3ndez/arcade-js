// SPDX-License-Identifier: GPL-3.0-only
/** loc_29f7 — steer one live slot toward its aim heading, then fly it a step. When the slot's probe
 * cell sits within a fixed window of either reference point, the turn runs with the shared rate index
 * forced to zero and then reseated to four; otherwise it runs at the standing index. The step then
 * alternates a double- and a single-velocity mover on bit 1 of the frame tick. LIVE-OUT: memory. */

import { steerTowardAimHeading } from "./steerTowardAimHeading.js";
import { loc_58aa } from "./loc_58aa.js";
import { loc_5860 } from "./loc_5860.js";
import { ERA_INDEX, FRAME_TICK } from "./names.js";
import { u8 } from "../../../core/int.js";

const PROBE = 49;
const HALF_WINDOW = 72;
const WINDOW = 144;
const REFERENCES = [120, 132];
const RATE_INDEX_WHILE_TURNING = 0;
const RATE_INDEX_RESEATED = 4;

const withinWindow = (probe) =>
  REFERENCES.some((ref) => u8(ref - probe + HALF_WINDOW) < WINDOW);

export function loc_29f7(m) {
  const { mem8 } = m;
  if (withinWindow(mem8[m.regs.iy + PROBE])) {
    mem8[ERA_INDEX] = RATE_INDEX_WHILE_TURNING;
    steerTowardAimHeading(m);
    mem8[ERA_INDEX] = RATE_INDEX_RESEATED;
  } else {
    steerTowardAimHeading(m);
  }
  return ((mem8[FRAME_TICK] >> 1) & 1) === 0 ? loc_58aa(m) : loc_5860(m);
}
