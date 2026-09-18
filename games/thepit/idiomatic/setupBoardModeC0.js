// SPDX-License-Identifier: GPL-3.0-only
/**
 * setupBoardModeC0 — pick the 0xC0 board-mode byte and run the shared display-setup body.
 *
 * One of three sibling doors, each choosing a board-mode byte (0xC0, 0x90, or 0) for the
 * same setup body: it stows the byte at BOARD_MODE and rebuilds the screen, flat-filling
 * colour memory with this very byte, so the byte is both a mode selector later code reads
 * and the screen-wide fill colour painted here.
 */
import { setupBoardDisplay } from "./setupBoardDisplay.js";

export function setupBoardModeC0(m) {
  // The body's return unwinds to our caller, so hand its result straight back.
  return setupBoardDisplay(m, 0xc0);
}
