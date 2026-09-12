// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_9e, loc_148, loc_283, loc_2b9, loc_b755 } from "./names.js";
import { loc_b634 } from "./loc_b634.js";
import { loc_bda0, loc_bdcb } from "./loc_bda0.js";

// Latch a run flag from a control cell's sign and a table-picked style byte (indexed by
// that cell's clamped high nibble), then split on the slot's sign to build the segment.
export function loc_b71b(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_9e] = (mem8[loc_148] & 0x80) ? 0x04 : 0x00;
  let idx = ((mem8[loc_148] + 0x40) & 0xff) >> 4;
  if (idx >= 0x05) idx = 0x00;
  mem8[loc_29] = mem8[u16(loc_b755 + idx)];
  if (mem8[u16(loc_283 + x)] & 0x80) {
    loc_b634(m, x);
    loc_bdcb(m, mem8[loc_29]);
    return;
  }
  const corner = mem8[u16(loc_2b9 + x)];
  loc_bda0(m, mem8[loc_29], corner);
}
