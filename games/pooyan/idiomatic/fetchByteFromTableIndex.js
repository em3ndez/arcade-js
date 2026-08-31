// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * fetchByteFromTableIndex — indexed byte-table lookup: add a byte index to a 16-bit table base and read the
 * byte living there.
 * ROM 0x0020. Grounding: [seen].
 *
 * The machine's byte-table fetch primitive, sitting at the Z80 restart vector 0x20 so any caller
 * can reach it with a single one-byte instruction. A caller seats a table's base address and an
 * unsigned byte index; this routine forms base+index and returns the byte stored there. It is
 * the standard way the engine turns a small number into a table entry — for example the coinage
 * lookups that translate a coin-slot setting into a credit amount (see ROM 0x0092).
 *
 * The index is added as a full 16-bit displacement onto the base (the hardware does it low-byte
 * first with carry into the high byte), so a base near the top of a page still lands on the right
 * entry when the index carries. Only the low 8 bits of the index participate — it is a byte index.
 *
 * A pure leaf: one memory read, no writes, no calls.
 *
 * LIVE-OUT: the fetched byte, and the pointer left at the computed table entry (base+index).
 * Callers read the byte back as the lookup result; the advanced pointer is also left available
 * for a caller that wants to keep reading forward from the entry.
 */
export function fetchByteFromTableIndex(m, base = m.regs.hl, index = m.regs.a) {
  const { mem8 } = m;

  // Form the entry address: base + byte index, taken 16-bit so an index that carries into the
  // high byte still addresses the correct table slot.
  const ptr = u16(base + index);

  // Return the byte at the entry and leave the pointer parked on that entry for the caller.
  return [ (m.regs.a = mem8[ptr]), (m.regs.hl = ptr) ];
}
