// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedMountainErosion — seed the mountain-erosion write pointer (MOUNTAIN_ERODE_PTR) and its
 * level-scaled countdown (MOUNTAIN_ERODE_TIMER = STEP_TIMER_BASE minus four per unit of LEVEL,
 * wrapping in a byte, so erosion runs faster every level), then conditionally cue a sound and —
 * only while the head cell still holds its 0xfe marker — stamp a two-tile cap into the tilemap.
 * Runs during boot / attract setup; the tile-code bytes are opaque graphics indices, kept as hex.
 */
import { requestSound21 } from "./requestSound21.js";

import {
  LEVEL,
  MOUNTAIN_ERODE_PTR,
  MOUNTAIN_ERODE_SOUND_MARKER_TILE,
  MOUNTAIN_ERODE_TIMER,
  STEP_TIMER_BASE,
  loc_90c4,
  loc_90e4,
} from "./names.js";
export function seedMountainErosion(m) {
  const { mem8, mem16 } = m;

  // 1. Seed the tilemap write pointer for later tilemap walks.
  mem16[MOUNTAIN_ERODE_PTR] = 0x9104;

  // 2. Countdown = gameplay parameter minus four per unit of the counter (wraps in a byte).
  mem8[MOUNTAIN_ERODE_TIMER] = mem8[STEP_TIMER_BASE] - 4 * mem8[LEVEL];

  // 3. Cue a sound when the marker cell holds the trigger tile.
  if (mem8[MOUNTAIN_ERODE_SOUND_MARKER_TILE] === 0x32) requestSound21(m);

  // 4. Stamp the two-tile cap only while the head cell still holds its 0xfe marker.
  if (mem8[loc_90e4] !== 0xfe) return;
  mem8[loc_90e4] = 0xae; // head cell
  mem8[loc_90c4] = 0xac; // the cell one row (32 columns) above it
}
