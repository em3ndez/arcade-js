// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearPlayerOneHomeBayGates — zero the player-1 slot byte + the five occupancy gates, then enter the shared
 * cold-start init. LIVE-OUT: memory-only.
 */
import { PLAYER1_SLOT, HOME_BAY1_OCCUPANCY_PRIMARY } from "./names.js";

const COLD_START = 0x0567;

export function clearPlayerOneHomeBayGates(m) {
  const { mem8 } = m;

  mem8[PLAYER1_SLOT] = 0;
  for (let i = 0; i < 5; i++) mem8[HOME_BAY1_OCCUPANCY_PRIMARY + i] = 0;

  return m.call(COLD_START);
}
