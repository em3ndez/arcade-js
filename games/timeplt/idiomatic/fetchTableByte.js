// SPDX-License-Identifier: GPL-3.0-only
/** fetchTableByte — index a byte table: step the table pointer on by the index and hand back
 * the byte it lands on. LIVE-OUT: that byte, returned. Nothing is written —
 * the one cell read is the one the pointer and index select, and the sum wraps at 16 bits.
 * The index is a plain byte offset; no entry width or record layout is claimed.
 *
 * ROM 0x0008-0x000E (lift: translated/loc_0008.js) — the `rst 0x08` restart vector, so a caller
 * reaches it with a one-byte instruction. Grounding: [seen].
 *
 * Role in the machine: the byte member of the "fetch what an index selects" family (siblings
 * fetchTableWord 0x0010 and fetchWideTableWord 0x018C). It is the game's general lookup — digit
 * glyphs, headings, shapes, per-era tables and more all go through it. Most callers use the
 * returned byte at once, which is why the fetch is the product. (The ROM also leaves the table
 * pointer, HL, sitting on the entry; only a few callers read on through it.)
 *
 * `tableBase` carries the table's address (the ROM's HL) and `index` the byte offset (the ROM's A).
 */

import { u16 } from "../../../core/int.js";

export function fetchTableByte(m, tableBase = m.regs.hl, index = m.regs.a) {
  const { mem8 } = m;
  // ROM: `add a,l / ld l,a / jr nc / inc h` — add the index into the low byte and carry into
  // the high byte, i.e. a full 16-bit add of an unsigned byte.
  const entry = u16(tableBase + index);
  // ROM: `ld a,(hl)` — the byte is handed back in A.
  return (m.regs.a = mem8[entry]);
}
