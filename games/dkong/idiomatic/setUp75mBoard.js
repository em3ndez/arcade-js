// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUp75mBoard — the 75m (board 3, elevators) board-setup arm.  ROM 0x0CF2.
 *
 * One of the four per-board setup arms the board-build dispatch (loc_0c92) branches
 * to on BOARD (0x6227): loc_0cd4 is 25m, setup50mConveyorBoard is 50m, this is 75m, and the
 * loc_0cb6 fall-through is 100m. Each arm makes its board's three fixed choices and
 * then hands off to the shared draw tail loc_0cc6. This arm does, in order:
 *
 *   1. stamp75mBoardTiles — plant the elevator board's fixed decorative tile motifs
 *      into the background tilemap (the extra step the 25m/50m arms don't have; the
 *      elevator board carries baked-in decoration those flat boards do not).
 *   2. Select the 75m background tune. The three arms write consecutive tune slots to
 *      SND_BGM: 0x08 (25m), 0x09 (50m), 0x0A here (75m).
 *   3. Point at the 75m elevator layout table (ROM 0x3BE5) and run the shared tail
 *      loc_0cc6, which walks that table into video RAM and finishes board setup. The
 *      table address is handed to the tail through DE (a live-in loc_0cc6 -> loc_0da7
 *      reads), so it is set LAST, right before the call, to survive into it.
 *
 * The tail's eventual return is this routine's return; loc_0c92 (its caller) consumes
 * no value from it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0cf2.test.js.
 * GATE:     crafted-entry — 75m-only (BOARD == 3), so it never dispatches in a plain
 *           25m attract run. Validated on the REAL dispatch forced by an
 *           identical-both-sides board-3 setup poke (GAME_STATE=3, GAME_SUBSTATE=0x0A
 *           board-setup, SUBSTATE_TIMER=1, BOARD=3), oracle vs idiomatic on fresh clones,
 *           compared on RAM − STACK_SCRATCH. Teeth over the arm's three jobs: a wrong
 *           music tune (caught at SND_BGM), a wrong layout pointer so the tail draws a
 *           different board (caught in the drawn tilemap — proves the DE marshalling is
 *           load-bearing), and a dropped tile stamp (caught at the elevator motif cells).
 * LIVE-OUT: memory-only — SND_BGM = 0x0A, the 68 elevator-motif tilemap bytes, and the
 *           whole board the tail draws (VRAM tiles + the SEG_* render scratch, via
 *           loc_0cc6 -> loc_0da7) plus the setup continuation. DE is set as a live-IN
 *           handed to the tail, not a live-out of this arm; A/HL/B and all flags are dead
 *           (the caller loc_0c92 reads no return). SP/pc are the dropped stack model —
 *           the oracle's push16/call/ret becomes the JS call stack.
 * NAMES:    SND_BGM (0x6089) from ram.js — the background-tune slot. Callees
 *           stamp75mBoardTiles (ROM 0x0D27) and loc_0cc6 (ROM 0x0CC6) are imported and
 *           called directly. 0x3BE5 is a ROM layout-table pointer (not work RAM), kept hex.
 *           (The SEG_* board-render scratch is touched only transitively, inside the tail.)
 */

import { stamp75mBoardTiles } from "./stamp75mBoardTiles.js"; // ROM 0x0D27 — elevator-board tile motifs
import { loc_0cc6 } from "./loc_0cc6.js"; // ROM 0x0CC6 — shared draw + setup tail
import { SND_BGM } from "./ram.js"; // 0x6089 — background-tune slot

export function setUp75mBoard(m) {
  const { regs, mem } = m;

  // Plant the elevator board's fixed decorative tile motifs.
  stamp75mBoardTiles(m);

  // 75m background tune (25m=0x08, 50m=0x09, 75m=0x0A).
  mem.write8(SND_BGM, 0x0a);

  // Select the 75m elevator layout table and run the shared draw/setup tail. The table
  // address reaches the tail through DE (loc_0cc6 -> loc_0da7 walks the DE-selected
  // table), so it is set last, right before the call.
  regs.de = 0x3be5;
  loc_0cc6(m);
}
