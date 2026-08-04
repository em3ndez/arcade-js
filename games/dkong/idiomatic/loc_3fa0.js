// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3fa0 — board-setup prelude: stamp the 50m-only tiles, then run the
 * board-setup continuation.
 *
 * A thin glue node in the board-setup chain. Every board's setup pass converges on
 * the step above this one, which hands control here, and here does exactly two
 * things in order:
 *
 *   1. A per-board applicability gate that, only on the 50m conveyor board, stamps a
 *      fixed four-cell tile motif into video RAM. On every other board the gate is
 *      closed and it writes nothing, but control falls through to step 2 either way.
 *   2. The board-setup continuation: the common per-board init, the object-record
 *      scatter, the setup dwell timer and sub-state advance, the sprite-object
 *      staging, and the per-board sprite offset.
 *
 * Both jobs live entirely in memory; whoever set up this board consumes nothing this
 * routine leaves behind, so it reads no input and produces no live value.
 *
 * LIVE-OUT: memory-only, and every byte of it is written inside the two steps above —
 * this routine names no memory cell of its own.
 */
import { stamp50mBoardTiles } from "./stamp50mBoardTiles.js";
import { loc_0d5f } from "./loc_0d5f.js";

export function loc_3fa0(m) {
  // 50m board only: stamp the fixed tile motif (no-op and falls through elsewhere).
  stamp50mBoardTiles(m);

  // Then the board-setup continuation for this board.
  loc_0d5f(m);
}
