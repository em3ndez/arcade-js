// SPDX-License-Identifier: GPL-3.0-only
import { resolvePlayerShotHit } from "./resolvePlayerShotHit.js";
import { reverseFleetAtEdge } from "./reverseFleetAtEdge.js";

// Run the state-2 handler, then tail into the fleet edge/direction update.
// Live-out: RAM only; the callers ignore the result.
export function resolveShotAndFleetEdge(m) {
  resolvePlayerShotHit(m);
  return reverseFleetAtEdge(m);
}
