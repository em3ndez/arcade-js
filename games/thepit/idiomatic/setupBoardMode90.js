// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupBoardMode90 — stow the 0x90 board-mode byte, then rebuild the screen for that board. The
 * 0x90 door of a three-way setup fan-in: three sibling entries pick a different board-mode byte
 * (this one 0x90, the others 0x00 and 0xC0) and run one shared display-setup body. It stows the byte
 * at BOARD_MODE and rebuilds the screen — clear sprites/scroll, repaint the tilemap, flat-fill the
 * colour RAM with this same byte, wipe the staging block — so the byte is both a board-mode selector and the fill colour.
 */
import { BOARD_MODE } from "./names.js";
import { clearSpriteAndAttributeRam } from "./clearSpriteAndAttributeRam.js";
import { fillVideoRam } from "./fillVideoRam.js";
import { fillColorRam } from "./fillColorRam.js";
import { clearSpriteStagingBuffer } from "./clearSpriteStagingBuffer.js";

export function setupBoardMode90(m) {
  const { mem8 } = m;

  // This door's board mode: 0x90 (siblings pick 0x00 and 0xC0). It selects the board variant later code reads, and is reused below as the screen-wide fill colour.
  mem8[BOARD_MODE] = 0x90;

  // Rebuild the screen for the new board; the sprite/attribute clear carries this routine's single return to its caller.
  clearSpriteAndAttributeRam(m); // blank the sprites + per-column scroll
  fillVideoRam(m); // repaint every tilemap cell to the background tile
  fillColorRam(m); // flat-fill colour RAM with the board-mode byte (0x90)
  clearSpriteStagingBuffer(m); // wipe the sprite-record staging block
}
