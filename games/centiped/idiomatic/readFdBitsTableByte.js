// SPDX-License-Identifier: GPL-3.0-only
import { loc_fd, loc_21bf } from "./names.js";

/**
 * readFdBitsTableByte — pick a table byte using bits 5-4 of a control cell.
 * Shifts those two bits down to an even index {0,2,4,6}, returns that table byte
 * in A and the index in Y (the caller reuses the index for a parallel table). [code]
 */
export function readFdBitsTableByte(m) {
  const { mem8 } = m;
  // Bits 5-4 of $fd shifted to an even index 0/2/4/6.
  const idx = (mem8[loc_fd] & 0x30) >> 3;
  const value = mem8[loc_21bf + idx];
  // Y carries the index (the caller reuses it for a parallel table); A carries the byte.
  return (m.regs.y = idx), (m.regs.a = value);
}
