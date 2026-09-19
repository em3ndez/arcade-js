// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_342c — start or resume one object's scripted position walk, advance its X one step, then
 * hand to the shared table-walk tail. A zero saved pointer means a fresh start: aim at the path
 * table's beginning and stamp the starting X; non-zero resumes. Either way X advances one step,
 * then the resolved pointer and record go to the tail (which supplies Y from the table).
 *
 * LIVE-OUT: memory-only.
 */

import { u16 } from "../../../core/int.js";
import {
  OBJ_WALK_PTR_HI,
  OBJ_WALK_PTR_LO,
  OBJ_X,
  WALK_PATH_TABLE_342C,
} from "./names.js";
import { loc_3445 } from "./loc_3445.js";

const X_SEED = 38;

export function loc_342c(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const base = ix;
  const field = (off) => u16(base + off);

  const saved = mem8[field(OBJ_WALK_PTR_LO)] | (mem8[field(OBJ_WALK_PTR_HI)] << 8);

  let ptr;
  if (saved !== 0) {
    ptr = saved;
  } else {
    ptr = WALK_PATH_TABLE_342C;
    mem8[field(OBJ_X)] = X_SEED;
  }

  mem8[field(OBJ_X)] = mem8[field(OBJ_X)] + 1;

  loc_3445(m, ix, ptr);
}
