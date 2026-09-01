// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";

// Fill a run of rows with the byte, stepping one column right (+0x20) each pass -- a horizontal run; leave the pointer past the end.
export function fillScreenRow(m, value = m.regs.a, rows = m.regs.b, addr = m.regs.hl) {
  do {
    m.mem8[addr] = value;
    addr = u16(addr + 0x20);
    rows = u8(rows - 1);
  } while (rows !== 0);
  return (m.regs.hl = addr);
}
