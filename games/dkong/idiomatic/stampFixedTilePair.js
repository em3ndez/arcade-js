// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampFixedTilePair — paint a fixed two-tile glyph into the tilemap, unconditionally.
 *
 * LIVE-OUT: memory-only — exactly those two tilemap cells.
 */
import { FIXED_DECOR_TILE_HI, loc_748f } from "./names.js";

export function stampFixedTilePair(m) {
  const { mem8 } = m;
  mem8[FIXED_DECOR_TILE_HI] = 0x9f;
  mem8[loc_748f] = 0x9e;
}
