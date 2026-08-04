// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0cc6 — the shared tail every board-setup arm converges on.
 *
 * The four per-board setup arms — 25m girders, 50m conveyors, 75m elevators and 100m rivets —
 * each leave a register pointing at their own layout table and then jump here. This tail does
 * three things in order:
 *
 *   1. Walk the selected, terminator-ended layout table, drawing every girder/ladder segment
 *      into video RAM and the board-render scratch.
 *   2. On the 100m rivet board only: stamp the eight fixed rivet-decoration cells. The other
 *      three arms enter with a different board, so the gate stays closed for them.
 *   3. Run the board-setup prelude and continuation — the 50m-only tile stamp, then the common
 *      per-board init, object scatter, setup dwell timer, sprite staging and per-board sprite
 *      offset. Its eventual return is this routine's return, so there is no value of its own.
 *
 * Pure glue: it writes no RAM directly; everything observable is done by the three steps it
 * delegates to.
 *
 * LIVE-OUT: memory-only. All three delegates are themselves memory-only, and the setup arm
 * that hands off here consumes no return value.
 */
import { drawBoardLayout } from "./drawBoardLayout.js";
import { stampRivetBoardTiles } from "./stampRivetBoardTiles.js";
import { loc_3fa0 } from "./loc_3fa0.js";
import { BOARD } from "./names.js";

export function loc_0cc6(m) {
  // Walk the selected layout table into video RAM and the render scratch.
  drawBoardLayout(m);

  // 100m rivet board only: stamp the eight fixed rivet-decoration cells.
  if (m.mem.read8(BOARD) === 0x04) {
    stampRivetBoardTiles(m);
  }

  // Tail into the rest of board setup; its eventual return is this routine's return.
  loc_3fa0(m);
}
