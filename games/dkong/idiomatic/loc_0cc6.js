// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0cc6 — the shared tail every board-setup dispatch arm converges on.  ROM 0x0cc6.
 *
 * The four board-setup arms (loc_0cd4 25m girders, loc_0cdf 50m conveyors,
 * loc_0cf2 75m elevators, and the loc_0cb6 fall-through 100m rivets) each leave DE
 * pointing at their own ROM layout table and then jump here. This tail does three
 * things in order:
 *
 *   1. loc_0da7 — walk the DE-selected, 0xAA-terminated layout table, drawing every
 *      girder/ladder segment into video RAM (and the 0x63ab.. render scratch).
 *   2. On the 100m rivet board ONLY (BOARD == 4): stampRivetBoardTiles, which block-
 *      stamps the eight fixed rivet-decoration cells. The other three arms enter with
 *      BOARD in {1,2,3}, so the gate stays closed for them.
 *   3. loc_3fa0 — the board-setup prelude+continuation (the ROM's `jp 0x3fa0` tail):
 *      the 50m-only tile stamp, then the common per-board init, object scatter, setup
 *      dwell timer, sprite staging, and per-board sprite offset. Its eventual `ret`
 *      returns to loc_0cc6's caller, so this routine has no return value of its own.
 *
 * Pure glue — it writes no RAM directly; everything observable is done by the three
 * callees it delegates to. Kept as loc_0cc6, not promoted, for the same reason as its
 * sibling loc_3fa0: it converges four arms onto three already-named callees with no
 * single earned verb of its own.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0cc6.test.js.
 * GATE:     crafted-entry — attract builds 25m only, so it dispatches loc_0cc6 with
 *           BOARD == 1 (rivet gate CLOSED, real record walk covers every 25m segment).
 *           The gate-OPEN arm and the 50m/75m continuation arms are reached by a
 *           Karl-sanctioned BOARD poke (2/3/4) applied identically on both sides of
 *           that real entry. Fresh clone per case (all three callees write RAM and the
 *           continuation carries state). Teeth: dropping the layout walk (caught in the
 *           drawn tilemap), the wrong rivet gate in either direction (rivet cell on the
 *           board where it must/must-not fire), and dropping the continuation (setup
 *           timer left unarmed).
 * LIVE-OUT: memory-only. Reached by a tail hand-off from the setup arms whose caller
 *           consumes no return value; all three callees are themselves memory-only, so
 *           nothing register/flag-shaped is live out. SP/pc are the dropped stack model
 *           (the oracle's push/call/ret becomes the JS call stack).
 * NAMES:    BOARD (0x6227) from ram.js — the rivet-gate selector. The layout table
 *           (DE, live-in), the rivet cells, and all continuation state are named inside
 *           the callees this delegates to.
 */
import { loc_0da7 } from "./loc_0da7.js"; // ROM 0x0da7 — walk + draw the layout table
import { stampRivetBoardTiles } from "./stampRivetBoardTiles.js"; // ROM 0x0d00 — 100m rivet decoration
import { loc_3fa0 } from "./loc_3fa0.js"; // ROM 0x3fa0 — board-setup prelude + continuation
import { BOARD } from "./ram.js";

export function loc_0cc6(m) {
  // Walk the DE-selected layout table into VRAM / the render scratch.
  loc_0da7(m);

  // 100m rivet board (BOARD == 4) only: stamp the eight fixed rivet-decoration cells.
  if (m.mem.read8(BOARD) === 0x04) {
    stampRivetBoardTiles(m);
  }

  // Tail into the rest of board setup; its eventual return is loc_0cc6's return.
  loc_3fa0(m);
}
