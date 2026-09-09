// SPDX-License-Identifier: GPL-3.0-only
import { loc_2b79 } from "./loc_2b79.js";
import { tickSpawnCadence } from "./tickSpawnCadence.js";

/**
 * loc_3046 (ROM 0x3046) -- the tail of the path-accumulator fall-through chain (reached from loc_303e).
 * It runs the shared zero-page state fixup (loc_2b79: re-derives the $72/$62 shadow copies and arms the
 * $43-mode $42 gate), then hands off to the per-slot spawn-cadence tick that steps the segment-spawn
 * rhythm. So one entry near the top of this chain advances the path AND resets the fixup + spawn state
 * around it in a single fall-through pass. Live-out: whatever loc_2b79 + tickSpawnCadence leave. [code]
 */
export function loc_3046(m) {
  // Re-derive the paired zero-page shadow cells so they match the just-updated coordinates.
  loc_2b79(m); // zero-page state fixup
  // Fall through into the spawn-cadence tick that paces when the next segment spawns.
  return tickSpawnCadence(m); // fall through
}
