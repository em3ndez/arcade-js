// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0cc6 — the shared tail every board-setup arm converges on: walk the selected layout table
 * into video RAM, stamp the eight rivet-decoration cells on the 100m board only, then run the
 * rest of board setup. Pure glue — writes no RAM directly.
 *
 * LIVE-OUT: memory-only, all via the delegates.
 */
import { drawBoardLayout } from "./drawBoardLayout.js";
import { stampRivetBoardTiles } from "./stampRivetBoardTiles.js";
import { loc_3fa0 } from "./loc_3fa0.js";
import { BOARD } from "./names.js";

export function loc_0cc6(m) {
  drawBoardLayout(m);
  if (m.mem8[BOARD] === 0x04) {
    stampRivetBoardTiles(m);
  }
  loc_3fa0(m);
}
