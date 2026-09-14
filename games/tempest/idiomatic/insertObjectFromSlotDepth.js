// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, ENEMY_DEPTH } from "./names.js";
import { loc_ccc1 } from "./loc_ccc1.js";
import { insertTimedObjectOfType } from "./insertTimedObjectOfType.js";

// Ring the fixed sound cue, copy the y-indexed table byte into the scratch field,
// then insert a fresh object into the slot table.
export function insertObjectFromSlotDepth(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  loc_ccc1(m, x, y);
  mem8[loc_29] = mem8[u16(ENEMY_DEPTH + y)];
  return insertTimedObjectOfType(m, a, x, y);
}
