// SPDX-License-Identifier: GPL-3.0-only
// Select a 2x2 tile block by the signed selector in B: non-negative -> look the block up in the block
// table by that index; negative -> stamp a fixed fallback block at the pending destination pointer.
import { drawIndexedTileBlock } from "./drawIndexedTileBlock.js";
import { drawTileBlock2x2AtDe } from "./drawTileBlock2x2AtDe.js";

const FALLBACK_TILE = 0xa4; // block-base tile stamped when the selector is negative

export function drawSelectedTileBlockOrFallback(m, selector = m.regs.b) {
  if ((selector & 0x80) === 0) return drawIndexedTileBlock(m, selector);
  return drawTileBlock2x2AtDe(m, FALLBACK_TILE);
}
