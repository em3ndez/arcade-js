// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0534 — zero the player-1 slot byte + the five occupancy gates, then enter the shared
 * cold-start init. LIVE-OUT: memory-only.
 */
import { loc_825c, loc_825e } from "./names.js";

const COLD_START = 0x0567;

export function loc_0534(m) {
  const { mem8 } = m;

  mem8[loc_825c] = 0;
  for (let i = 0; i < 5; i++) mem8[loc_825e + i] = 0;

  return m.call(COLD_START);
}
