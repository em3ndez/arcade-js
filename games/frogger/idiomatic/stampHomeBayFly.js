// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBayFly — stamp the fly bonus creature into a home bay.
 *
 * For home slot 1..5 (from the slot cursor), when that bay's occupancy flag is clear, stamp the 2x2
 * fly bonus creature tiles into the bay's video-RAM base; the active-player cell selects the occupancy bank.
 * LIVE-OUT: memory-only.
 */
import {
  HOME_BAY_SLOT_CURSOR, PENDING_HOME_BAY_SLOT, ACTIVE_PLAYER,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT,
} from "./names.js";

const HOME_BAY = [HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM];
const FLAGS_PRIMARY = [HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY];
const FLAGS_ALT = [HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT];

const FIRST_SLOT = 1;
const LAST_SLOT = 5;
const ROW_STRIDE = 32;
const TILE_TL = 44;
const TILE_TR = 45;
const TILE_BL = 46;
const TILE_BR = 47;

export function stampHomeBayFly(m) {
  const { mem8 } = m;
  const slot = mem8[HOME_BAY_SLOT_CURSOR];
  mem8[PENDING_HOME_BAY_SLOT] = slot; // publish the slot cursor

  if (slot < FIRST_SLOT || slot > LAST_SLOT) return;
  const i = slot - 1;

  const flag = mem8[ACTIVE_PLAYER] === 1 ? FLAGS_PRIMARY[i] : FLAGS_ALT[i];
  if (mem8[flag] !== 0) return; // bay occupied -> skip

  let p = HOME_BAY[i];
  mem8[p] = TILE_TL;
  mem8[(p + 1)] = TILE_TR;
  p = p + ROW_STRIDE;
  mem8[p] = TILE_BL;
  mem8[(p + 1)] = TILE_BR;
}
