// SPDX-License-Identifier: GPL-3.0-only
import { insertTimedObject } from "./insertTimedObject.js";
import { COORD_LIST_PTR_LO } from "./names.js";

// Stash A into the scratch field, then insert a new object into the 8-slot table.
export function insertTimedObjectOfType(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = a;
  return insertTimedObject(m, x, y);
}
