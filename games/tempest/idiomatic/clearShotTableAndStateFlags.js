// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_DEPTH, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, LANE_ENEMY_COUNT_3, LANE_ENEMY_COUNT_0, LANE_ENEMY_COUNT_2, LANE_ENEMY_COUNT_1, LANE_ENEMY_COUNT_4 } from "./names.js";

/**
 * clearShotTableAndStateFlags — reset leaf: blank the seven-cell depth table plus seven scattered
 * state/count flags. ROM 0x926f.
 *
 * Role in the machine: this leaf wipes a block of per-slot depth state (loc_2df..loc_2df+6, seven entries)
 * together with seven scattered bookkeeping cells that track enemy population across the tube — the total
 * and type counts (loc_108/loc_109) and the five per-lane enemy counts (loc_145/loc_142/loc_144/loc_143/
 * loc_146). Clearing all of them returns the enemy/depth accounting to empty so a fresh wave starts with no
 * carried-over occupants.
 *
 * Behavior: a top-down loop over the seven depth cells (index x from 6 down to 0) storing 0x00 into each,
 * followed by seven unconditional stores of 0x00 into the scattered flag cells. The flags are not
 * contiguous, so they are written one at a time rather than in a loop. No branches beyond the array loop,
 * no reads.
 *
 * Live-out: loc_2df..loc_2df+6, loc_108, loc_109, loc_145, loc_142, loc_144, loc_143, loc_146 all = 0.
 * Nothing else touched. Grounding: [seen].
 */
export function clearShotTableAndStateFlags(m) {
  const { mem8 } = m;
  // Clear the seven-cell depth table loc_2df..loc_2df+6 top-down.
  for (let x = 0x06; x >= 0; x--) mem8[u16(ENEMY_DEPTH + x)] = 0x00;
  // Clear the seven scattered count/flag cells: total + type counts, then the five per-lane counts.
  mem8[ENEMY_TOTAL_COUNT] = 0x00;
  mem8[ENEMY_TYPE_COUNT] = 0x00;
  mem8[LANE_ENEMY_COUNT_3] = 0x00;
  mem8[LANE_ENEMY_COUNT_0] = 0x00;
  mem8[LANE_ENEMY_COUNT_2] = 0x00;
  mem8[LANE_ENEMY_COUNT_1] = 0x00;
  mem8[LANE_ENEMY_COUNT_4] = 0x00;
}
