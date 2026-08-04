// SPDX-License-Identifier: GPL-3.0-only
/**
 * setup50mConveyorBoard — board setup for 50m, the conveyor board.
 *
 * Board setup branches one arm per board; this is the 50m one. Each arm makes its board's few
 * fixed choices and then hands off to the shared draw-and-finish tail. In order:
 *
 *   1. Select the 50m colour/palette bank, which is bank 1: set the two hardware palette-bank
 *      output latches to 1 and 0. The display reads that 2-bit bank number to pick its colour set
 *      for the board. They are output latches, not work RAM, so they carry no shared name.
 *   2. Select the 50m background tune. The boards take consecutive tune slots and 50m takes the
 *      middle one, 0x09.
 *   3. Point at the 50m conveyor layout table and run the shared tail, which walks that table
 *      into video RAM and finishes board setup. The table address reaches the tail in a register,
 *      so it is set LAST, right before the call, to survive into it.
 *
 * The tail's eventual return is this routine's return, and nothing consumes a value from it.
 *
 * LIVE-OUT: memory — the selected tune, the whole board the tail draws and the render scratch it
 * uses, and the setup continuation the tail arms — plus the palette-bank output latch, which is a
 * display-read hardware register rather than memory.
 */

import { loc_0cc6 } from "./loc_0cc6.js";
import { SND_BGM } from "./names.js";

// The two hardware palette-bank output latches, one per bit of the 2-bit bank number the display
// reads to pick its colour set. Output latches, not work RAM, so they carry no shared name.
const PALETTE_BANK_BIT0 = 0x7d86;
const PALETTE_BANK_BIT1 = 0x7d87;

export function setup50mConveyorBoard(m) {
  const { regs, mem } = m;

  // Select the 50m colour/palette bank = 1 (bit0 set, bit1 clear).
  mem.write8(PALETTE_BANK_BIT0, 0x01);
  mem.write8(PALETTE_BANK_BIT1, 0x00);

  // 50m background tune (25m=0x08, 50m=0x09, 75m=0x0A).
  mem.write8(SND_BGM, 0x09);

  // Select the 50m conveyor layout table and run the shared draw/setup tail. The table address
  // reaches the tail in a register, so it is set last, right before the call.
  regs.de = 0x3b5d;
  loc_0cc6(m);
}
