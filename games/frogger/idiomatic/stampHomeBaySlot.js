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
  loc_825e, loc_825f, loc_8260, loc_8261, loc_8262,
  loc_8263, loc_8264, loc_8265, loc_8266, loc_8267,
  loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864,
} from "./names.js";

const PLAYER_ONE = 1;
const HOME_TILE = 16;
const ROW_STRIDE = 32;

// selector value 1..5 -> [VRAM base, player-1 occupancy cell, player-2 occupancy cell]
const SLOTS = {
  1: [loc_ab64, loc_825e, loc_8263],
  2: [loc_aaa4, loc_825f, loc_8264],
  3: [loc_a9e4, loc_8260, loc_8265],
  4: [loc_a924, loc_8261, loc_8266],
  5: [loc_a864, loc_8262, loc_8267],
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
