// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_COUNT } from "./names.js";

/**
 * fleetStepSize — pick the fleet's horizontal step count for the current alien population.
 *
 * WHAT IT IS
 *   Returns B = 3 when exactly one alien is left, otherwise B = 2. ALIEN_COUNT (0x2082) is the live
 *   count of aliens still on the board (kept up to date by countLiveAliens). The step size is the
 *   number of columns the fleet advances per march tick, so the fleet moves faster once only the last
 *   alien remains — the classic "final alien sprints" behaviour.
 *
 * ROLE IN THE MACHINE
 *   Called from the fleet edge/direction-reversal step reverseFleetAtEdge (0x1597): when the fleet
 *   hits an edge it flips direction and republishes the step count (via this routine) into loc_2008,
 *   which the march then applies. Reads only ALIEN_COUNT (0x2082).
 *
 * ROM 0x18f1.  Grounding: [seen] (ALIEN_COUNT is [seen]).
 *
 * LIVE-OUT: B = the step size (2 or 3), also the returned value. The seam completes the ret.
 */
export function fleetStepSize(m) {
  // One alien left (ALIEN_COUNT == 1) -> step 3 (the last alien speeds up); any other count -> step 2.
  return (m.regs.b = m.mem8[ALIEN_COUNT] === 1 ? 3 : 2);
}
