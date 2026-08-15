// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBaySlot — stamp a frog-home slot's 2x2 tile block, then clear the pending-slot selector.
 *
 * A per-player occupancy cell gates the stamp; the selector pair is cleared afterward unless
 * the hold flag is set.
 * LIVE-OUT: memory-only.
 */
import {
  ACTIVE_PLAYER, loc_8121, loc_8120, HOLD_FLAG,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  loc_8263, loc_8264, loc_8265, loc_8266, loc_8267,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
} from "./names.js";

const PLAYER_ONE = 1;
const HOME_TILE = 16;
const ROW_STRIDE = 32;

// selector value 1..5 -> [VRAM base, player-1 occupancy cell, player-2 occupancy cell]
const SLOTS = {
  1: [HOME_SLOT1_VRAM, HOME_BAY1_OCCUPANCY_PRIMARY, loc_8263],
  2: [HOME_SLOT2_VRAM, HOME_BAY2_OCCUPANCY_PRIMARY, loc_8264],
  3: [HOME_SLOT3_VRAM, HOME_BAY3_OCCUPANCY_PRIMARY, loc_8265],
  4: [HOME_SLOT4_VRAM, HOME_BAY4_OCCUPANCY_PRIMARY, loc_8266],
  5: [HOME_SLOT5_VRAM, HOME_BAY5_OCCUPANCY_PRIMARY, loc_8267],
};

export function stampHomeBaySlot(m) {
  const { mem8 } = m;
  const slot = SLOTS[mem8[loc_8121]];
  if (!slot) return; // selector out of 1..5 -> nothing to stamp

  const [base, p1Cell, p2Cell] = slot;
  const occupancy = mem8[ACTIVE_PLAYER] === PLAYER_ONE ? p1Cell : p2Cell;
  if (mem8[occupancy] !== 0) return; // slot already filled -> leave it

  mem8[base] = HOME_TILE;
  mem8[(base + 1) & 0xffff] = HOME_TILE;
  mem8[(base + ROW_STRIDE) & 0xffff] = HOME_TILE;
  mem8[(base + ROW_STRIDE + 1) & 0xffff] = HOME_TILE;

  if (mem8[HOLD_FLAG] !== 0) return; // held -> keep the selector pending
  mem8[loc_8121] = 0;
  mem8[loc_8120] = 0;
}
