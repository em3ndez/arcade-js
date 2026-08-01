// SPDX-License-Identifier: GPL-3.0-only
/**
 * setup50mConveyorBoard — the 50m (board 2, conveyors) board-setup arm.  ROM 0x0CDF.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): 50m = conveyors / "pie factory"
 * (mechanisms.md); the board-setup arms pick consecutive SND_BGM 0x08/0x09/0x0A and the ROM
 * layout tables (0x3B5D 50m). This arm writes SND_BGM = 0x09 and DE = 0x3B5D, then tails the
 * shared draw tail — an exact match to the 50m board.
 *
 * One of the four per-board setup arms the board-build dispatch (loc_0c92) branches
 * to on BOARD (0x6227): setup25mGirderBoard is 25m, this is 50m, loc_0cf2 is 75m, and the
 * loc_0cb6 fall-through is 100m. Each arm makes its board's fixed choices and then
 * hands off to the shared draw tail loc_0cc6. This arm does, in order:
 *
 *   1. Select the 50m colour/palette bank = 1: set the two hardware palette-bank
 *      output latches to bits 01 (bit0 = 1, bit1 = 0). The display reads the 2-bit
 *      bank to pick its colour set for the board. These are output latches in the
 *      0x7Dxx hardware region, not work RAM, so they carry no ram.js name.
 *   2. Select the 50m background tune. The three arms write consecutive tune slots to
 *      SND_BGM: 0x08 (25m), 0x09 here (50m), 0x0A (75m).
 *   3. Point at the 50m conveyor layout table (ROM 0x3B5D) and run the shared tail
 *      loc_0cc6, which walks that table into video RAM and finishes board setup. The
 *      table address is handed to the tail through DE (a live-in loc_0cc6 -> drawBoardLayout
 *      reads), so it is set LAST, right before the call, to survive into it.
 *
 * The tail's eventual return is this routine's return; loc_0c92 (its caller) consumes
 * no value from it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0cdf.test.js.
 * GATE:     crafted-entry — 50m-only (BOARD == 2), so it never dispatches in a plain
 *           25m attract run. Validated on the REAL dispatch forced by an
 *           identical-both-sides board-2 setup poke (GAME_STATE=3, GAME_SUBSTATE=0x0A
 *           board-setup, SUBSTATE_TIMER=1, BOARD=2), oracle vs idiomatic on fresh
 *           clones, compared on RAM − STACK_SCRATCH AND the palette-bank latch (io
 *           state, outside dumpState). Teeth over the arm's three jobs: a wrong music
 *           tune (caught at SND_BGM), a wrong palette bank (caught at the io palette-
 *           bank latch), and a wrong layout pointer so the tail draws a different board
 *           (caught in the drawn tilemap — proves the DE marshalling is load-bearing).
 * LIVE-OUT: memory-only for the RAM contract — SND_BGM = 0x09, the whole board the tail
 *           draws (VRAM tiles + the SEG_* render scratch, via loc_0cc6 -> drawBoardLayout) plus
 *           the setup continuation; and the palette-bank output latch (a display-read
 *           hardware register, not in dumpState). DE is set as a live-IN handed to the
 *           tail, not a live-out of this arm; A/HL and all flags are dead (loc_0c92 reads
 *           no return). SP/pc are the dropped stack model — the oracle's push16/call/ret
 *           becomes the JS call stack.
 * NAMES:    SND_BGM (0x6089) from ram.js — the background-tune slot. Callee loc_0cc6
 *           (ROM 0x0CC6) is imported and called directly. 0x7d86/0x7d87 are hardware
 *           palette-bank latches (0x7Dxx output region, not work RAM) and 0x3B5D is a
 *           ROM layout-table pointer — both kept hex. (The SEG_* board-render scratch is
 *           touched only transitively, inside the tail.)
 */

import { loc_0cc6 } from "./loc_0cc6.js"; // ROM 0x0CC6 — shared draw + setup tail
import { SND_BGM } from "./ram.js"; // 0x6089 — background-tune slot

// Hardware palette-bank output latches (0x7Dxx region, ls259.6h): 0x7d86 is bank bit0,
// 0x7d87 is bank bit1. The display reads the 2-bit bank to pick its colour set. Not
// work RAM, so no ram.js name.
const PALETTE_BANK_BIT0 = 0x7d86;
const PALETTE_BANK_BIT1 = 0x7d87;

export function setup50mConveyorBoard(m) {
  const { regs, mem } = m;

  // Select the 50m colour/palette bank = 1 (bit0 set, bit1 clear).
  mem.write8(PALETTE_BANK_BIT0, 0x01);
  mem.write8(PALETTE_BANK_BIT1, 0x00);

  // 50m background tune (25m=0x08, 50m=0x09, 75m=0x0A).
  mem.write8(SND_BGM, 0x09);

  // Select the 50m conveyor layout table and run the shared draw/setup tail. The table
  // address reaches the tail through DE (loc_0cc6 -> drawBoardLayout walks the DE-selected
  // table), so it is set last, right before the call.
  regs.de = 0x3b5d;
  loc_0cc6(m);
}
