// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBayFly — stamp the fly bonus creature into a home bay.
 *
 * For home slot 1..5 (from the slot cursor), when that bay's occupancy flag is clear, stamp the 2x2
 * fly bonus creature tiles into the bay's video-RAM base; the active-player cell selects the occupancy bank.
 * LIVE-OUT: memory-only.
 */
import {
  loc_8123, loc_8121, ACTIVE_PLAYER,
  loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864,
  loc_825e, loc_825f, loc_8260, loc_8261, loc_8262,
  loc_8263, loc_8264, loc_8265, loc_8266, loc_8267,
} from "./names.js";

const HOME_BAY = [loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864];
const FLAGS_PRIMARY = [loc_825e, loc_825f, loc_8260, loc_8261, loc_8262];
const FLAGS_ALT = [loc_8263, loc_8264, loc_8265, loc_8266, loc_8267];

const FIRST_SLOT = 1;
const LAST_SLOT = 5;
const ROW_STRIDE = 32;
const TILE_TL = 44;
const TILE_TR = 45;
const TILE_BL = 46;
const TILE_BR = 47;

export function stampHomeBayFly(m) {
  const { mem8 } = m;
  const slot = mem8[loc_8123];
  mem8[loc_8121] = slot; // publish the slot cursor

  if (slot < FIRST_SLOT || slot > LAST_SLOT) return;
  const i = slot - 1;

  const flag = mem8[ACTIVE_PLAYER] === 1 ? FLAGS_PRIMARY[i] : FLAGS_ALT[i];
  if (mem8[flag] !== 0) return; // bay occupied -> skip

  let p = HOME_BAY[i];
  mem8[p] = TILE_TL;
  mem8[(p + 1) & 0xffff] = TILE_TR;
  p = (p + ROW_STRIDE) & 0xffff;
  mem8[p] = TILE_BL;
  mem8[(p + 1) & 0xffff] = TILE_BR;
}
