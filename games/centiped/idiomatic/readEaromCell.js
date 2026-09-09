// SPDX-License-Identifier: GPL-3.0-only
import { loc_1600, loc_1680, loc_1700 } from "./names.js";

/**
 * readEaromCell — read one byte of the ER2055 high-score NVRAM at index X, returning it in A.
 * Latch the address to X, pulse the control register so the falling clock edge latches
 * cells[X] into the data-out register, read it back, then release the control lines.
 */
export function readEaromCell(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_1600 + x] = a;       // latch address = X (data = A, overwritten by the read)
  mem8[loc_1680] = 0x08;        // C1 read mode, CLK low
  mem8[loc_1680] = 0x09;        // CLK high
  mem8[loc_1680] = 0x08;        // CLK falling edge -> latch cells[X] into data-out
  const out = mem8[loc_1700 + x]; // read the latched byte
  mem8[loc_1680] = 0x00;        // release chip-select / clock
  return (m.regs.a = out);      // live-out: caller uses A (the fetched cell)
}
