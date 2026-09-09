// SPDX-License-Identifier: GPL-3.0-only
import { loc_2b79 } from "./loc_2b79.js";
import { tickSpawnCadence } from "./tickSpawnCadence.js";

/**
 * loc_3046 — run the zero-page state fixup, then fall through to the tail routine. [code]
 */
export function loc_3046(m) {
  loc_2b79(m); // zero-page state fixup
  return tickSpawnCadence(m); // fall through
}
