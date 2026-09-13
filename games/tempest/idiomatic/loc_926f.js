// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_DEPTH, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, LANE_ENEMY_COUNT_3, LANE_ENEMY_COUNT_0, LANE_ENEMY_COUNT_2, LANE_ENEMY_COUNT_1, LANE_ENEMY_COUNT_4 } from "./names.js";

// Reset leaf: zero a 7-byte block and seven scattered flag cells to their baseline.
export function loc_926f(m) {
  const { mem8 } = m;
  // Clear the 7-byte array.
  for (let x = 0x06; x >= 0; x--) mem8[u16(ENEMY_DEPTH + x)] = 0x00;
  // Clear the seven associated flag cells.
  mem8[ENEMY_TOTAL_COUNT] = 0x00;
  mem8[ENEMY_TYPE_COUNT] = 0x00;
  mem8[LANE_ENEMY_COUNT_3] = 0x00;
  mem8[LANE_ENEMY_COUNT_0] = 0x00;
  mem8[LANE_ENEMY_COUNT_2] = 0x00;
  mem8[LANE_ENEMY_COUNT_1] = 0x00;
  mem8[LANE_ENEMY_COUNT_4] = 0x00;
}
