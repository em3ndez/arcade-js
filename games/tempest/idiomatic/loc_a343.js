// SPDX-License-Identifier: GPL-3.0-only
import { insertType1WithHeadFlag } from "./primeTopPriorityObject.js";

// Two seed entries: stamp the head flag with a per-entry tag, then run the shared insert.
export function loc_a343(m, x = m.regs.x, y = m.regs.y) {
  return insertType1WithHeadFlag(m, 0x09, x, y);
}

export function loc_a347(m, x = m.regs.x, y = m.regs.y) {
  return insertType1WithHeadFlag(m, 0x07, x, y);
}
