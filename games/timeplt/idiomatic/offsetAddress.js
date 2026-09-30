// SPDX-License-Identifier: GPL-3.0-only
/** offsetAddress — move an address forward by an unsigned byte offset and hand back where it
 * landed. The offset is a plain byte, never a signed displacement, so the address only ever
 * advances, wrapping at sixteen bits. LIVE-OUT: the moved address, returned and left standing
 * for the caller to read through. No memory is read or written, and no table or entry width is claimed.
 *
 * ROM: 0x0018, the RST 0x18 restart vector, so a caller reaches it with a one-byte instruction.
 * Tag [seen] (names.js). Role in the machine: the arithmetic half of
 * an indexed table fetch. A caller such as the routine at 0x20AF hands it a table base and an
 * index and then does its own read, and fetchTableWord uses it as the first half of a word
 * fetch, so this routine stops at the addition and never reads the table itself.
 *
 * Parameters: `base` is the table or record address (the ROM's HL), `offset` the byte index
 * (the ROM's A). The ROM also leaves the new low half in A (names.js: "echoing the low half of
 * the result back"); this form hands back the whole moved address instead. */

import { u16 } from "../../../core/int.js";

export function offsetAddress(m, base = m.regs.hl, offset = m.regs.a) {
  const { regs } = m;
  // The ROM adds the byte to the low half (add a,l / ld l,a) and bumps the high half only on a
  // carry (ret nc / inc h) — together an unsigned 16-bit add, so the result wraps at 0xFFFF.
  const moved = u16(base + offset);
  // Left in HL as well as returned: callers read straight through the moved address.
  return (regs.hl = moved);
}
