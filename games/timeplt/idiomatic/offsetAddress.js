// SPDX-License-Identifier: GPL-3.0-only
/** offsetAddress — move an address forward by an unsigned byte offset and hand back where it
 * landed. The offset is a plain byte, never a signed displacement, so the address only ever
 * advances, wrapping at sixteen bits. LIVE-OUT: the moved address, returned and left standing
 * for the caller to read through. No memory is read or written, and no table or entry width is claimed. */

import { u16 } from "../../../core/int.js";

export function offsetAddress(m, base = m.regs.hl, offset = m.regs.a) {
  const { regs } = m;
  const moved = u16(base + offset);
  return (regs.hl = moved);
}
