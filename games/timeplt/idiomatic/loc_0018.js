// SPDX-License-Identifier: GPL-3.0-only
/** loc_0018 — move an address forward by an unsigned byte offset and hand back where it
 * landed. The offset is a plain byte, never a signed displacement, so the address only ever
 * advances, wrapping at sixteen bits. LIVE-OUT: the moved address, returned and left standing
 * for the caller to read through; and its low half, echoed back into the byte the offset came
 * in on. No memory is read or written, and no table or entry width is claimed. */

import { u8, u16 } from "../../../core/int.js";

export function loc_0018(m) {
  const { regs } = m;
  const base = regs.hl;
  const offset = regs.a;
  const moved = u16(base + offset);
  regs.hl = moved;
  regs.a = u8(moved);
  return moved;
}
