// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_342c — start or resume one object's scripted position walk, advance its X one step, then
 * hand to the shared table-walk tail. A zero saved pointer means a fresh start: aim at the path
 * table's beginning and stamp the starting X; non-zero resumes. Either way X advances one step,
 * then the resolved pointer and record go to the tail (which supplies Y from the table).
 *
 * LIVE-OUT: memory-only.
 */

import { OBJ_X, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI } from "./names.js";
import { loc_3445 } from "./loc_3445.js";

const TABLE_START = 0x3a8c;
const X_SEED = 38;

export function loc_342c(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const base = ix;
  const field = (off) => (base + off) & 0xffff;

  const saved = mem8[field(OBJ_WALK_PTR_LO)] | (mem8[field(OBJ_WALK_PTR_HI)] << 8);

  let ptr;
  if (saved !== 0) {
    ptr = saved;
  } else {
    ptr = TABLE_START;
    mem8[field(OBJ_X)] = X_SEED;
  }

  mem8[field(OBJ_X)] = mem8[field(OBJ_X)] + 1;

  loc_3445(m, ix, ptr);
}
