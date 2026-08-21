// SPDX-License-Identifier: GPL-3.0-only
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { READY_SPRITE_TILE_VRAM, READY_SPRITE_SRC } from "./names.js";
/**
 * loc_2bd3 — paint the ready-sprite tile. Unless the anchor cell already holds the painted
 * marker, stamp the ready-sprite source block as a 2x2 square there.
 *
 * LIVE-OUT: none — memory only (four video cells).
 */

const PAINTED_MARKER = 0xba; // top-left tile once the square is already present

export function loc_2bd3(m) {
  const { mem8 } = m;

  if (mem8[READY_SPRITE_TILE_VRAM] === PAINTED_MARKER) return; // already painted
  blit2x2TileBlock(m, READY_SPRITE_TILE_VRAM, READY_SPRITE_SRC);
}
