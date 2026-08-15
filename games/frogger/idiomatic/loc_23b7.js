// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23b7 — per-vblank river-lane arrival setup: commit arrivals lane by lane.
 *
 * Points the cursors at the frog X/Y cells, then for each of the four ride lanes: if the lane's
 * direction flag is set, tail to that lane's commit handler; otherwise clear the lane's mirror flag.
 * LIVE-OUT: memory-only.
 */
import {
  loc_8044, loc_8047,
  loc_8248, loc_8249, loc_824a, loc_824b,
  loc_824c, loc_824d, loc_824e, loc_824f,
} from "./names.js";

const FROG_X = loc_8044;
const FROG_Y = loc_8047;
const LANE0_COMMIT = 0x1bba;
const LANE1_COMMIT = 0x1c0d;
const LANE2_COMMIT = 0x1c76;
const LANE3_COMMIT = 0x1cd5;

export function loc_23b7(m) {
  const { regs, mem8 } = m;
  regs.hl = FROG_X;
  regs.de = FROG_Y;

  regs.a = mem8[loc_8248];
  if (regs.a !== 0) return m.call(LANE0_COMMIT);
  mem8[loc_824c] = 0;

  regs.a = mem8[loc_8249];
  if (regs.a !== 0) return m.call(LANE1_COMMIT);
  mem8[loc_824d] = 0;

  regs.a = mem8[loc_824a];
  if (regs.a !== 0) return m.call(LANE2_COMMIT);
  mem8[loc_824e] = 0;

  regs.a = mem8[loc_824b];
  if (regs.a !== 0) return m.call(LANE3_COMMIT);
  mem8[loc_824f] = 0;
}
