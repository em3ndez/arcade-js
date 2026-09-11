// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";

// Advance the list cursor Y by a fixed run to skip a packed record without
// reading it: the first entry steps forward by three (delegating to the
// second with Y already bumped by one), the second by two. Register only.
export function loc_96c7(m, y = m.regs.y) {
  return loc_96c8(m, u8(y + 1));
}

export function loc_96c8(m, y = m.regs.y) {
  return (m.regs.y = u8(y + 2));
}
