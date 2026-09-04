// SPDX-License-Identifier: GPL-3.0-only
import { resolveSpriteScreenAddr } from "./resolveSpriteScreenAddr.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";

/**
 * drawSaucerSprite — paint the flying-saucer sprite at its current position.
 *
 * WHAT IT IS
 *   Resolves the saucer sprite record to a screen address and graphics pointer, then byte-aligned
 *   blits the sprite's column into video RAM.
 *
 * ROLE IN THE MACHINE
 *   The saucer's sprite state lives in the record at loc_2087. resolveSpriteScreenAddr (0x0742) loads
 *   that five-byte descriptor and runs coordToScreenAddr, leaving HL = screen address and DE = gfx
 *   pointer; drawSpriteColumn (0x1439) then copies the graphic's bytes into adjacent screen columns.
 *   Unlike the alien/player shots this is a plain (non-shifted, non-collision) column blit — the saucer
 *   is drawn on a byte boundary. Used by the saucer handler to repaint the mystery ship each frame.
 *
 * ROM 0x073c.  Grounding: [seen].
 *
 * LIVE-OUT: HL (advanced one blit past, from drawSpriteColumn).
 */
export function drawSaucerSprite(m) {
  // Decode the saucer sprite record at loc_2087 into a screen address (HL) and gfx pointer (DE).
  resolveSpriteScreenAddr(m);
  // Copy the sprite's bytes down into adjacent screen columns (stride 0x20 per byte).
  return drawSpriteColumn(m);
}
