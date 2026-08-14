// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23fa — stamp a lane's scroll marker into video RAM.
 *
 * Mirror the scroll timer, then for lane 1..5 stamp a 2x2 tile marker into that lane's home cell
 * when the lane has no object present; the count cell selects which flag bank is read.
 * LIVE-OUT: memory-only.
 */
import {
  loc_8123, loc_8121, loc_83fd,
  loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864,
  loc_825e, loc_825f, loc_8260, loc_8261, loc_8262,
  loc_8263, loc_8264, loc_8265, loc_8266, loc_8267,
} from "./names.js";

const LANE_HOME = [loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864];
const FLAGS_PRIMARY = [loc_825e, loc_825f, loc_8260, loc_8261, loc_8262];
const FLAGS_ALT = [loc_8263, loc_8264, loc_8265, loc_8266, loc_8267];

const FIRST_LANE = 1;
const LAST_LANE = 5;
const ROW_STRIDE = 32;
const TILE_TL = 44;
const TILE_TR = 45;
const TILE_BL = 46;
const TILE_BR = 47;

export function loc_23fa(m) {
  const { mem8 } = m;
  const lane = mem8[loc_8123];
  mem8[loc_8121] = lane; // mirror the scroll timer

  if (lane < FIRST_LANE || lane > LAST_LANE) return;
  const i = lane - 1;

  const flag = mem8[loc_83fd] === 1 ? FLAGS_PRIMARY[i] : FLAGS_ALT[i];
  if (mem8[flag] !== 0) return; // lane object present -> no marker

  let p = LANE_HOME[i];
  mem8[p] = TILE_TL;
  mem8[(p + 1) & 0xffff] = TILE_TR;
  p = (p + ROW_STRIDE) & 0xffff;
  mem8[p] = TILE_BL;
  mem8[(p + 1) & 0xffff] = TILE_BR;
}
