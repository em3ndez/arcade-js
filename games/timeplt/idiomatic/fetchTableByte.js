// SPDX-License-Identifier: GPL-3.0-only
/** fetchTableByte — index a byte table: step the table pointer on by the index and hand back
 * the byte it lands on. LIVE-OUT: that byte, returned; and the pointer, left standing at the
 * entry rather than back at the base, so a caller can walk on from it. Nothing is written —
 * the one cell read is the one the pointer and index select, and the sum wraps at 16 bits.
 * The index is a plain byte offset; no entry width or record layout is claimed. */

import { u16 } from "../../../core/int.js";

export function fetchTableByte(m, tableBase = m.regs.hl, index = m.regs.a) {
  const { mem8 } = m;
  const entry = u16(tableBase + index);
  return (m.regs.hl = entry, m.regs.a = mem8[entry]);
}
