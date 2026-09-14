// SPDX-License-Identifier: GPL-3.0-only
import { seatInPagePointer } from "./seatInPagePointer.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

// Select a pointer from the table by index, then emit a three-byte zeropage run as nibbles.
export function loc_b0c6(m, x = m.regs.x) {
  seatInPagePointer(m, x);
  emitNibbleDigitRun(m, 0x29, 0x03);
}
