// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3fa0 — board-setup prelude: stamp the 50m-only tiles, then run the
 * board-setup continuation.  ROM 0x3fa0.
 *
 * A thin glue node in the board-setup dispatch chain. Every board's setup pass
 * converges on loc_0cc6, which hands control here, and here does exactly two
 * things in order:
 *
 *   1. stamp50mBoardTiles — a per-board applicability gate that, only on the 50m
 *      conveyor board, stamps a fixed four-cell tile motif into video RAM. On any
 *      other board the gate is closed and it writes nothing, but control still
 *      falls through to step 2 either way.
 *   2. loc_0d5f — the board-setup continuation: the common per-board init, the
 *      object-record scatter, the setup dwell timer + sub-state advance, the
 *      sprite-object staging, and the per-board sprite offset.
 *
 * Both jobs live entirely in memory; whoever set up this board consumes nothing
 * loc_3fa0 leaves behind, so it reads no input and produces no live value.
 *
 * NAME. Kept as loc_3fa0, not promoted: it is glue that delegates to two already
 * named callees (a gated tile stamp, then the continuation) with no single earned
 * verb of its own — the continuation it hands off to is itself kept neutral for the
 * same reason.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3fa0.test.js.
 * GATE:     crafted-entry — the single real board-1 dispatch attract produces (25m
 *           is the only board attract sets up) validates the glue with the 50m gate
 *           CLOSED; the gate-OPEN arm and the other continuation arms are reached by
 *           an identical-both-sides BOARD poke (2/3/4) on that real entry. Fresh
 *           clone per case (both callees write RAM and the continuation has state).
 *           Teeth: skipping the tile stamp (caught on the 50m board) and skipping
 *           the continuation (caught at the setup timer).
 * LIVE-OUT: memory-only. Reached by a tail hand-off from loc_0cc6, whose caller
 *           consumes no return value; both callees are themselves memory-only, so
 *           nothing register/flag-shaped is live out of loc_3fa0.
 * NAMES:    none of its own — it references no RAM address directly; the memory it
 *           touches is named inside the two callees it delegates to.
 */
import { stamp50mBoardTiles } from "./stamp50mBoardTiles.js"; // ROM 0x3fa6
import { loc_0d5f } from "./loc_0d5f.js"; // ROM 0x0d5f

export function loc_3fa0(m) {
  // 50m board only: stamp the fixed tile motif (no-op and falls through elsewhere).
  stamp50mBoardTiles(m);

  // Then the board-setup continuation for this board.
  loc_0d5f(m);
}
