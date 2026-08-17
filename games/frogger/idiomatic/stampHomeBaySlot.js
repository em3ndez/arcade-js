// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBaySlot — stamp a frog-home slot's 2x2 tile block, then clear the pending-slot selector.
 *
 * A per-player occupancy cell gates the stamp; the selector pair is cleared afterward unless
 * the hold flag is set.
 * LIVE-OUT: memory-only.
 */
import {
  ACTIVE_PLAYER, PENDING_HOME_BAY_SLOT, HOME_BAY_SLOT_CURSOR_MIRROR, HOLD_FLAG,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
} from "./names.js";

const PLAYER_ONE = 1;
const HOME_TILE = 16;
const ROW_STRIDE = 32;

// selector value 1..5 -> [VRAM base, player-1 occupancy cell, player-2 occupancy cell]
const SLOTS = {
  1: [HOME_SLOT1_VRAM, HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY1_OCCUPANCY_ALT],
  2: [HOME_SLOT2_VRAM, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_ALT],
  3: [HOME_SLOT3_VRAM, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_ALT],
  4: [HOME_SLOT4_VRAM, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_ALT],
  5: [HOME_SLOT5_VRAM, HOME_BAY5_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_ALT],
};

export function stampHomeBaySlot(m) {
  const { mem8 } = m;
  const slot = SLOTS[mem8[PENDING_HOME_BAY_SLOT]];
  if (!slot) return; // selector out of 1..5 -> nothing to stamp

  const [base, p1Cell, p2Cell] = slot;
  const occupancy = mem8[ACTIVE_PLAYER] === PLAYER_ONE ? p1Cell : p2Cell;
  if (mem8[occupancy] !== 0) return; // slot already filled -> leave it

  mem8[base] = HOME_TILE;
  mem8[(base + 1)] = HOME_TILE;
  mem8[(base + ROW_STRIDE)] = HOME_TILE;
  mem8[(base + ROW_STRIDE + 1)] = HOME_TILE;

  if (mem8[HOLD_FLAG] !== 0) return; // held -> keep the selector pending
  mem8[PENDING_HOME_BAY_SLOT] = 0;
  mem8[HOME_BAY_SLOT_CURSOR_MIRROR] = 0;
}
