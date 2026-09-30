// SPDX-License-Identifier: GPL-3.0-only
/** fetchWideTableWord — fetch the two-byte entry sitting at a given index of a table and hand it back as
 * the routine's one result. The index is scaled by the entry width before it is added to the
 * base, and the sum wraps inside the address space. Nothing is written.
 * LIVE-OUT: the fetched value alone; the base and the index are left where they were.
 *
 * ROM 0x018C-0x0199 (lift: translated/loc_018c.js). Grounding: [seen].
 *
 * Role in the machine: the word-table lookup behind the caption and text painters (drawTextRunByIndex,
 * eraseTextRunByIndex, the drawCaption* family) and fireAndSweepPlayerShots. What separates it
 * from its narrow sibling fetchTableWord (0x0010) is that the doubling of the index CARRIES into
 * the high byte (`add a,a / jr nc / inc h`), so a table of more than 128 entries still resolves —
 * a distinction no current call site exercises, which is why the name has to carry it.
 *
 * `table` carries the table's address (the ROM's HL) and `index` the entry number (the ROM's A).
 */

import { u16 } from "../../../core/int.js";

// Each entry is one little-endian word (the ROM reads `ld e,(hl) / inc hl / ld d,(hl)`).
const ENTRY_WIDTH = 2;

export function fetchWideTableWord(m, table = m.regs.hl, index = m.regs.a) {
  // Double the index with its carry kept, add the base with 16-bit wrap, and read the word there.
  // The ROM hands it back in DE (low byte E, high byte D); this form returns it and sets DE.
  return (m.regs.de = m.mem16[u16(table + ENTRY_WIDTH * index)]);
}
