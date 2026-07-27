// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4b44 — the mode-0 door into the shared display-setup body.  ROM 0x4b44.
 *
 * One of three sibling entries that each pick a board-mode / entry-select byte and
 * run the same screen-rebuild body with it: this door picks 0, the others 0x90 and
 * 0xC0. So this routine is exactly "run the shared board-display rebuild with
 * board-mode 0" — which stows the byte at BOARD_MODE and blanks the whole screen
 * (clears every sprite, wipes the tilemap, floods colour RAM with the board-mode
 * byte, wipes the sprite-staging block). With board-mode 0 the field is flat colour 0.
 *
 * Reached from cold-boot init and from each round/board setup. The name stays neutral
 * for the same reason its sibling loc_4b3c does: the rebuild it runs is clear, but
 * which game situation the mode-0 door corresponds to (versus its 0x90 / 0xC0
 * siblings) is not confirmed to the naming bar, so it earns no specific name yet.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b44.test.js.
 * GATE:     memory-only (RAM diff outside the dead stack scratch below the entry
 *           stack pointer); real captured dispatches — fires during cold-boot init
 *           (loc_01a4) and round setup, plus a crafted dirty-screen check that proves
 *           the rebuild actually runs. Teeth: the shared body handed the wrong
 *           board-mode byte (caught at BOARD_MODE and the colour RAM it floods) + a
 *           skipped staging wipe on a dirtied block (caught at 0x8200).
 * LIVE-OUT: memory-only — BOARD_MODE plus every cell the shared body writes (cleared
 *           sprite/attribute RAM, filled tilemap and colour RAM, wiped staging block).
 *           No register or flag is live out; the shared body's tail is this routine's
 *           exit, returned straight through.
 * NAMES:    none read here — the mode-0 byte is a literal; setupBoardDisplay names the
 *           BOARD_MODE cell and its regions.
 */

import { setupBoardDisplay } from "./setupBoardDisplay.js";

export function loc_4b44(m) {
  // The mode-0 door: run the shared board-display rebuild with board-mode 0. Its tail
  // is this routine's exit, so hand its result straight back.
  return setupBoardDisplay(m, 0);
}
