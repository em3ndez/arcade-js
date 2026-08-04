// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUp75mBoard — the 75m (elevators) board-setup arm.
 *
 * One of the four per-board setup arms the board build branches to on BOARD. Each arm makes
 * its board's three fixed choices and then hands off to the shared draw tail. This arm does,
 * in order:
 *
 *   1. Plant the elevator board's fixed decorative tile motifs into the background tilemap —
 *      the extra step the flat 25m and 50m boards do not have.
 *   2. Select the 75m background tune. The four arms write consecutive tune slots; this one
 *      is the third.
 *   3. Point at the 75m elevator layout table and run the shared draw/setup tail, which walks
 *      that table into video RAM and finishes board setup. The table address is handed to the
 *      tail in a register, so it is set LAST, right before the call, to survive into it.
 *
 * The tail's eventual return is this routine's return; its caller consumes no value from it.
 *
 * LIVE-OUT: memory-only — the background-tune slot, the elevator-motif tilemap bytes, and the
 * whole board the tail draws along with the rest of the setup continuation.
 */

import { stamp75mBoardTiles } from "./stamp75mBoardTiles.js";
import { loc_0cc6 } from "./loc_0cc6.js";
import { SND_BGM } from "./names.js";

export function setUp75mBoard(m) {
  const { regs, mem } = m;

  // Plant the elevator board's fixed decorative tile motifs.
  stamp75mBoardTiles(m);

  // The 75m background tune — the third of the four consecutive per-board slots.
  mem.write8(SND_BGM, 0x0a);

  // Select the 75m elevator layout table and run the shared draw/setup tail. The table
  // address reaches the tail in a register, so it is set last, right before the call.
  regs.de = 0x3be5;
  loc_0cc6(m);
}
