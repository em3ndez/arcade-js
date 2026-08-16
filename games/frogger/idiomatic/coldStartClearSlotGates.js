// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearSlotGates — cold-start new-game init, part one. Zeroes the player-1 slot byte and the
 * five primary-bank home-bay occupancy gates, then falls into the shared cold-start mid-entry.
 * LIVE-OUT: memory-only.
 */
import { PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY } from "./names.js";

const COLD_START_MID = 0x0557; // shared cold-start mid-entry (still served by the frozen layer)

export function coldStartClearSlotGates(m) {
  const { mem8 } = m;

  mem8[PLAYER1_SLOT] = 0;
  for (let i = 0; i < 5; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;
  return m.call(COLD_START_MID);
}
