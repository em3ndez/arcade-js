// SPDX-License-Identifier: GPL-3.0-only
/**
 * setup25mGirderBoard — build the 25m girder board: select its layout, start its
 * background tune, then run the shared board-setup tail.
 *
 * One of four sibling arms the in-game board-setup dispatcher selects on the board
 * type; this is the 25m (girder) arm. It does two things and then converges on the
 * tail all four arms share:
 *
 *   1. Point the layout selector at the 25m girder layout — the list of girder and
 *      ladder segments the shared tail walks to draw the board.
 *   2. Queue the 25m background tune for the sound driver to start.
 *
 * The shared tail draws the selected layout into the playfield and finishes board
 * setup; its return is this routine's return, and nothing runs after it.
 *
 * LIVE-OUT: memory-only. The layout selector is a value handed ON to the tail through
 * the machine's register image, where the tail's record walk reads it — not something
 * this routine leaves behind for its own caller.
 */

import { loc_0cc6 } from "./loc_0cc6.js";
import { SND_BGM } from "./names.js";

// The 25m girder layout: a sentinel-terminated list of girder/ladder segment records
// that the shared board-setup tail walks into the playfield.
const LAYOUT_TABLE_25M = 0x3ae4;

export function setup25mGirderBoard(m) {
  const { regs, mem } = m;

  // Select the 25m girder layout for the shared tail to walk. The tail reads this
  // pointer out of the register image, so hand it over there.
  regs.de = LAYOUT_TABLE_25M;

  // Queue the 25m background tune for the sound driver.
  mem.write8(SND_BGM, 8);

  // Hand off to the shared board-setup tail; its return is this routine's return.
  loc_0cc6(m);
}
