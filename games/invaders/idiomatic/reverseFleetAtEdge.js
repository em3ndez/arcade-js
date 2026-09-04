// SPDX-License-Identifier: GPL-3.0-only
import { fleetReachedEdge } from "./fleetReachedEdge.js";
import { fleetStepSize } from "./fleetStepSize.js";
import { FLEET_MOVE_DIR, FLEET_STEP_DY, loc_2008, FLEET_DROP_DELTA, FLEET_LEFT_EDGE_VRAM, FLEET_RIGHT_EDGE_VRAM } from "./names.js";

/**
 * reverseFleetAtEdge — turn the fleet around and drop it a row when it hits a screen edge.
 *
 * WHAT IT IS
 *   The classic Space Invaders edge behavior. The fleet sweeps horizontally; when its leading edge
 *   reaches a screen boundary this flips the sweep direction, republishes the new horizontal step, and
 *   arms a one-row vertical drop for the next sweep. If the fleet has not reached the edge it leaves
 *   all state untouched.
 *
 * ROLE IN THE MACHINE
 *   FLEET_MOVE_DIR (0x200d) is the heading. Nonzero means sweeping left, so it scans the left-edge
 *   VRAM column FLEET_LEFT_EDGE_VRAM (0x2524); zero means sweeping right, so it scans the right-edge
 *   column FLEET_RIGHT_EDGE_VRAM (0x3ea4). fleetReachedEdge reports (by carry) whether any alien pixel
 *   has reached that column. On a hit it flips FLEET_MOVE_DIR, writes the new horizontal step into the
 *   working count loc_2008 (a positive step from fleetStepSize when turning to move right, or 0xfe = -2
 *   pixels when turning to move left), and copies the row-drop FLEET_DROP_DELTA (0x200e) into the drop
 *   cell FLEET_STEP_DY (0x2007), which the next sweep adds into the fleet's reference Y.
 *
 * ROM 0x1597-...  Grounding: [seen].
 *
 * LIVE-OUT: RAM only (FLEET_MOVE_DIR / loc_2008 / FLEET_STEP_DY); the caller ignores the result.
 */
export function reverseFleetAtEdge(m) {
  let dir, step;
  // Sweeping left (FLEET_MOVE_DIR nonzero): test the left edge. If not reached, leave everything as is.
  if (m.mem8[FLEET_MOVE_DIR] !== 0) {
    if (!fleetReachedEdge(m, FLEET_LEFT_EDGE_VRAM)) return;
    // Reached the left edge: turn to move right with a positive step (2, or 3 when one alien remains),
    // and clear the heading.
    step = fleetStepSize(m);
    dir = 0x00;
  } else {
    // Sweeping right (FLEET_MOVE_DIR zero): test the right edge. If not reached, leave everything as is.
    if (!fleetReachedEdge(m, FLEET_RIGHT_EDGE_VRAM)) return;
    // Reached the right edge: turn to move left with step 0xfe (-2 pixels) and set the heading.
    step = 0xfe;
    dir = 0x01;
  }
  // Publish the new heading and horizontal step...
  m.mem8[FLEET_MOVE_DIR] = dir;
  m.mem8[loc_2008] = step;
  // ...and arm the one-row descent by mirroring the drop delta into the per-sweep drop cell.
  m.mem8[FLEET_STEP_DY] = m.mem8[FLEET_DROP_DELTA];
}
