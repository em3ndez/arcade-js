// SPDX-License-Identifier: GPL-3.0-only
/**
 * blankScreen — the mode-0 door into the shared display-setup body.
 *
 * One of three sibling entries that each pick a board-mode byte and run the same screen-rebuild
 * body with it: this door picks 0, the others 0x90 and 0xC0. So it is exactly "run the shared
 * board-display rebuild with board-mode 0" — which stows the byte at BOARD_MODE and blanks the
 * whole screen (clears every sprite, wipes the tilemap, floods colour memory with the byte, wipes
 * the sprite-staging block). With board-mode 0 the field is flat colour 0, and the body's tail is
 * this routine's exit, returned straight through.
 */

import { setupBoardDisplay } from "./setupBoardDisplay.js";

export function blankScreen(m) {
  return setupBoardDisplay(m, 0);
}
