// SPDX-License-Identifier: GPL-3.0-only
import { seedTileFillCursor } from "./seedTileFillCursor.js";
import { PLAYFIELD_TILE_BASE } from "./names.js";
/**
 * armTileFillFromPlayfieldBase — arm the row-by-row tile fill from the fixed VRAM start, delegating to the shared
 * arming routine. LIVE-OUT: A = 0x20 (the seeded row count) for the caller; the fill pointer + counter.
 */
export function armTileFillFromPlayfieldBase(m) {
  return seedTileFillCursor(m, PLAYFIELD_TILE_BASE);
}
