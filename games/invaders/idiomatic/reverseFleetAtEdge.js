// SPDX-License-Identifier: GPL-3.0-only
import { fleetReachedEdge } from "./fleetReachedEdge.js";
import { fleetStepSize } from "./fleetStepSize.js";
import { FLEET_MOVE_DIR, FLEET_STEP_DY, loc_2008, FLEET_DROP_DELTA, FLEET_LEFT_EDGE_VRAM, FLEET_RIGHT_EDGE_VRAM } from "./names.js";

// Fleet edge / direction reversal: scan the edge column selected by FLEET_MOVE_DIR; if the fleet has
// reached it, flip the direction and republish the derived step-count and mirror cells, else leave
// state untouched. Live-out: RAM only (the caller ignores the result).
export function reverseFleetAtEdge(m) {
  let dir, step;
  if (m.mem8[FLEET_MOVE_DIR] !== 0) {
    if (!fleetReachedEdge(m, FLEET_LEFT_EDGE_VRAM)) return;
    step = fleetStepSize(m);
    dir = 0x00;
  } else {
    if (!fleetReachedEdge(m, FLEET_RIGHT_EDGE_VRAM)) return;
    step = 0xfe;
    dir = 0x01;
  }
  m.mem8[FLEET_MOVE_DIR] = dir;
  m.mem8[loc_2008] = step;
  m.mem8[FLEET_STEP_DY] = m.mem8[FLEET_DROP_DELTA];
}
