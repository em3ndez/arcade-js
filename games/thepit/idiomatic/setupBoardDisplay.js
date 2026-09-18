// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupBoardDisplay — record the board-mode byte and rebuild the whole screen for it.
 *
 * The shared body of the three display-setup doors. Each door picks a different board-mode byte
 * (the 0xC0 / 0x90 / 0x00 variants, and the 0xA0 / 0xE0 the round setup and player teardown hand
 * in) and drops into here. This routine records that byte at BOARD_MODE and rebuilds the entire
 * screen for it: it clears every sprite and un-scrolls every column, wipes the tilemap to the
 * background tile, floods the colour RAM so the field takes one flat colour, and blanks the
 * sprite-staging block. The byte does double duty — later code reads it as the board-mode selector,
 * and this same pass floods it as the screen-wide colour, before the setup draws the new contents.
 */
import { BOARD_MODE } from "./names.js";
import { clearSpriteAndAttributeRam } from "./clearSpriteAndAttributeRam.js";
import { fillVideoRam } from "./fillVideoRam.js";
import { fillColorRam } from "./fillColorRam.js";
import { clearSpriteStagingBuffer } from "./clearSpriteStagingBuffer.js";

export function setupBoardDisplay(m, boardMode = m.regs.a) {
  const { mem8 } = m;

  // Record the board-mode byte, read later as the mode selector and here as the fill colour.
  mem8[BOARD_MODE] = boardMode;

  // Rebuild the whole screen: clear sprites and un-scroll columns, wipe the tilemap to the
  // background tile, flood the colour RAM, then blank the sprite-staging block.
  clearSpriteAndAttributeRam(m);
  fillVideoRam(m);
  fillColorRam(m);
  clearSpriteStagingBuffer(m);
}
