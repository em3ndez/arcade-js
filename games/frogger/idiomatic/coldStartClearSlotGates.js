// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearSlotGates — cold-start new-game init, part one. Zeroes the player-1 slot byte and the
 * five primary-bank home-bay occupancy gates, then falls into cold-start init part two
 * (coldStartClearAltSlotGates), which in turn tails into the shared cold-start mid-entry.
 * LIVE-OUT: memory-only.
 */
import { PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY } from "./names.js";
import { coldStartClearAltSlotGates } from "./coldStartClearAltSlotGates.js";

export function coldStartClearSlotGates(m) {
  const { mem8 } = m;

  mem8[PLAYER1_SLOT] = 0;
  for (let i = 0; i < 5; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;
  return coldStartClearAltSlotGates(m);
}
