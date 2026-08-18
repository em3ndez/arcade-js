// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearAltSlotGates — cold-start new-game init, part two. Zeroes the player-2 slot byte and the
 * five alternate-bank home-bay occupancy gates, then falls into the shared cold-start mid-entry.
 * The player-2 continue path also lands here. LIVE-OUT: memory-only.
 */
import { PLAYER2_SLOT, HOME_BAY1_OCCUPANCY_ALT } from "./names.js";
import { coldStartClearPlayRamAndSetMode } from "./coldStartClearPlayRamAndSetMode.js";
import { u16 } from "../../../core/int.js";

export function coldStartClearAltSlotGates(m) {
  const { mem8 } = m;

  mem8[PLAYER2_SLOT] = 0;
  for (let i = 0; i < 5; i++) mem8[u16(HOME_BAY1_OCCUPANCY_ALT + i)] = 0;
  return coldStartClearPlayRamAndSetMode(m);
}
