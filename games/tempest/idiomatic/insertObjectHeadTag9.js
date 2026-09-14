// SPDX-License-Identifier: GPL-3.0-only
import { insertType1WithHeadFlag } from "./primeTopPriorityObject.js";

// Two seed entries: stamp the head flag with a per-entry tag, then run the shared insert.
export function insertObjectHeadTag9(m, x = m.regs.x, y = m.regs.y) {
  return insertType1WithHeadFlag(m, 0x09, x, y);
}

export function insertObjectHeadTag7(m, x = m.regs.x, y = m.regs.y) {
  return insertType1WithHeadFlag(m, 0x07, x, y);
}
