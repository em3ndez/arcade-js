// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3fa0 — board-setup prelude: stamp the 50m-only tiles, then run the board-setup continuation.
 *
 * A thin glue node every board's setup pass converges on. Step 1 is a per-board gate that stamps a
 * fixed four-cell tile motif into video RAM only on the 50m conveyor board (a no-op that falls
 * through elsewhere); step 2 is the shared board-setup continuation. Both jobs live entirely in
 * memory, and nothing consumes what this routine leaves behind.
 */
import { stamp50mBoardTiles } from "./stamp50mBoardTiles.js";
import { loc_0d5f } from "./loc_0d5f.js";

export function loc_3fa0(m) {
  stamp50mBoardTiles(m);

  loc_0d5f(m);
}
