// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearPlayerOneHomeBayGates — zero the player-1 slot byte + the five primary occupancy gates, then tail
 * directly into the shared cold-start mid-entry (coldStartClearPlayRamAndSetMode), skipping the player-2
 * alt-gate clears. LIVE-OUT: memory-only.
 */
import { PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY } from "./names.js";
import { coldStartClearPlayRamAndSetMode } from "./coldStartClearPlayRamAndSetMode.js";

export function clearPlayerOneHomeBayGates(m) {
  const { mem8 } = m;

  mem8[PLAYER1_SLOT] = 0;
  for (let i = 0; i < 5; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;

  return coldStartClearPlayRamAndSetMode(m);
}
