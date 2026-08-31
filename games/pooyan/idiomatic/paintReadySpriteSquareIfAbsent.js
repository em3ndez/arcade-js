// SPDX-License-Identifier: GPL-3.0-only
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { READY_SPRITE_TILE_VRAM, READY_SPRITE_SRC } from "./names.js";
/**
 * paintReadySpriteSquareIfAbsent — paint the ready-sprite indicator, but only if it is not already on screen.
 *
 * ROM 0x2bd3-0x2be0. Grounding: [seen].
 *
 * WHAT IT IS: an idempotent little painter for one fixed on-screen marker — the "ready-sprite" square.
 * Video RAM is a grid of 8x8 character cells, and this marker occupies a 2x2 block of them anchored at
 * READY_SPRITE_TILE_VRAM (0x87bb, the top-left cell of the square). The source artwork for the square is a
 * fixed four-byte block of tile codes in ROM at READY_SPRITE_SRC (0x2be1), one byte per cell of the 2x2.
 *
 * ROLE IN THE MACHINE: several callers reach this point every time they want the ready-sprite square shown,
 * without knowing or caring whether an earlier pass already drew it. Rather than blindly re-stamping
 * the four cells each frame, the routine first checks whether the square is already present and does nothing
 * if so — so repeatedly asking for the marker costs one memory read once it is up. The four cells are left
 * standing; some later screen-clear elsewhere is what takes the marker back down.
 *
 * HOW "ALREADY PRESENT" IS DETECTED: when the square has been painted, its top-left cell (0x87bb) holds the
 * tile code 0xba. That single tile value doubles as a "square is here" sentinel: if the anchor cell reads
 * 0xba the whole block is assumed intact, so the paint is skipped. Any other value means the marker is not
 * currently drawn and the block is stamped.
 *
 * A NEAR-LEAF: its only lasting effect is those four video-RAM cells; it calls out only to the shared 2x2
 * block-stamp primitive to do the actual copy.
 *
 * LIVE-OUT: none — memory only (four video cells).
 */

// Tile code that sits in the anchor cell (0x87bb) whenever the ready-sprite square is currently painted.
// It is both the top-left tile of the artwork and the sentinel this routine tests to detect "already drawn".
const PAINTED_MARKER = 0xba; // top-left tile once the square is already present

export function paintReadySpriteSquareIfAbsent(m) {
  const { mem8 } = m;

  // Presence check: peek at the anchor cell of the square in video RAM (READY_SPRITE_TILE_VRAM, 0x87bb).
  // If it already holds the painted marker (0xba) the whole 2x2 block is assumed to be up, so there is
  // nothing to do and the routine returns without touching video RAM — this is what makes repeated calls cheap.
  if (mem8[READY_SPRITE_TILE_VRAM] === PAINTED_MARKER) return; // already painted
  // The marker is not on screen: stamp it. Copy the four-byte ROM source block (READY_SPRITE_SRC, 0x2be1)
  // into the 2x2 square anchored at READY_SPRITE_TILE_VRAM (0x87bb). The stamp writes 0xba into the anchor
  // cell as the top-left tile, which is exactly the sentinel the presence check above will find next time.
  blit2x2TileBlock(m, READY_SPRITE_TILE_VRAM, READY_SPRITE_SRC);
}
