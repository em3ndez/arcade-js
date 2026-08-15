// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitRiverLaneArrivals — per-vblank river-lane arrival setup: commit arrivals lane by lane.
 *
 * Points the cursors at the frog X/Y cells, then for each of the four ride lanes: if the lane's
 * direction flag is set, tail to that lane's commit handler; otherwise clear the lane's mirror flag.
 * LIVE-OUT: memory-only.
 */
import {
  FROG_X, FROG_Y,
  RIVER_LANE0_DIR, loc_8249, RIVER_LANE2_DIR, loc_824b,
  RIVER_LANE0_ARRIVAL, loc_824d, RIVER_LANE2_ARRIVAL, RIVER_LANE3_ARRIVAL,
} from "./names.js";

const LANE0_COMMIT = 0x1bba;
const LANE1_COMMIT = 0x1c0d;
const LANE2_COMMIT = 0x1c76;
const LANE3_COMMIT = 0x1cd5;

export function commitRiverLaneArrivals(m) {
  const { regs, mem8 } = m;
  regs.hl = FROG_X;
  regs.de = FROG_Y;

  regs.a = mem8[RIVER_LANE0_DIR];
  if (regs.a !== 0) return m.call(LANE0_COMMIT);
  mem8[RIVER_LANE0_ARRIVAL] = 0;

  regs.a = mem8[loc_8249];
  if (regs.a !== 0) return m.call(LANE1_COMMIT);
  mem8[loc_824d] = 0;

  regs.a = mem8[RIVER_LANE2_DIR];
  if (regs.a !== 0) return m.call(LANE2_COMMIT);
  mem8[RIVER_LANE2_ARRIVAL] = 0;

  regs.a = mem8[loc_824b];
  if (regs.a !== 0) return m.call(LANE3_COMMIT);
  mem8[RIVER_LANE3_ARRIVAL] = 0;
}
