// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * Table-index fetch: read the byte at a 16-bit table base plus a byte index.
 *
 * Adds the index to the base and reads the byte living there, leaving the advanced pointer
 * behind. This is the byte-table lookup helper: a caller seats a table base and a byte
 * index, then reads the fetched byte back.
 *
 * LIVE-OUT: the fetched byte (its callers read the byte back) and the advanced pointer
 * base+index, both written to their registers so a register-dispatched caller can read them.
 */
export function loc_0020(m, base = m.regs.hl, index = m.regs.a) {
  const { mem8 } = m;
  const ptr = u16(base + index);
  return [ (m.regs.a = mem8[ptr]), (m.regs.hl = ptr) ];
}
