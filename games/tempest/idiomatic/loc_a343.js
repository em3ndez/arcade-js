// SPDX-License-Identifier: GPL-3.0-only
import { loc_a34d } from "./loc_a34b.js";

// Two seed entries: stamp the head flag with a per-entry tag, then run the shared insert.
export function loc_a343(m, x = m.regs.x, y = m.regs.y) {
  return loc_a34d(m, 0x09, x, y);
}

export function loc_a347(m, x = m.regs.x, y = m.regs.y) {
  return loc_a34d(m, 0x07, x, y);
}
