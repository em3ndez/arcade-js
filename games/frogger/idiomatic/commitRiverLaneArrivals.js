// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitRiverLaneArrivals — per-vblank river-lane arrival setup: commit arrivals lane by lane.
 *
 * Points the cursors at the frog X/Y cells, then for each of the four ride lanes: if the lane's
 * direction flag is set, hand off to that lane's commit handler; otherwise clear the lane's mirror flag.
 * LIVE-OUT: memory-only.
 */
import {
  FROG_X, FROG_Y,
  RIVER_LANE0_DIR, RIVER_LANE1_DIR, RIVER_LANE2_DIR, RIVER_LANE3_DIR,
  RIVER_LANE0_ARRIVAL, RIVER_LANE1_ARRIVAL, RIVER_LANE2_ARRIVAL, RIVER_LANE3_ARRIVAL,
} from "./names.js";
import {
  commitRiverLane0Arrival, commitRiverLane1Arrival,
  commitRiverLane2Arrival, commitRiverLane3Arrival,
} from "./rideRiverLaneAndCommitArrival.js";

export function commitRiverLaneArrivals(m) {
  const { regs, mem8 } = m;
  regs.hl = FROG_X;
  regs.de = FROG_Y;

  regs.a = mem8[RIVER_LANE0_DIR];
  if (regs.a !== 0) return commitRiverLane0Arrival(m);
  mem8[RIVER_LANE0_ARRIVAL] = 0;

  regs.a = mem8[RIVER_LANE1_DIR];
  if (regs.a !== 0) return commitRiverLane1Arrival(m);
  mem8[RIVER_LANE1_ARRIVAL] = 0;

  regs.a = mem8[RIVER_LANE2_DIR];
  if (regs.a !== 0) return commitRiverLane2Arrival(m);
  mem8[RIVER_LANE2_ARRIVAL] = 0;

  regs.a = mem8[RIVER_LANE3_DIR];
  if (regs.a !== 0) return commitRiverLane3Arrival(m);
  mem8[RIVER_LANE3_ARRIVAL] = 0;
}
