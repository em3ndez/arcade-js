// SPDX-License-Identifier: GPL-3.0-only
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";
import { seedWaveState } from "./seedWaveState.js";
import { loc_2505 } from "./loc_2505.js";

/**
 * reseedSegmentSpawnState -- reseed the segment spawn cells and the wave-start state, then fall through
 * into the segment sprite-table rebuild. A straight-line reinitialize with no branches. [code]
 */
export function reseedSegmentSpawnState(m) {
  seedSegmentSpawnState(m);
  seedWaveState(m);
  return loc_2505(m); // fall through into the segment sprite-table rebuild spine
}
