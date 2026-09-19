// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3445 — advance one object's table-driven position walk, or finalize it at the
 * end of the table. The shared tail of two object-animation walkers.
 *
 * On an ordinary entry the table byte becomes the object's Y and the saved table
 * pointer steps forward one byte. On the terminator the walk finishes: state bytes
 * are cleared, the final X/Y are latched, and the pointer is rewound to zero so the
 * next pass starts fresh.
 *
 * LIVE-OUT: memory-only.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y, OBJ_STATE, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI } from "./names.js";

const TABLE_TERMINATOR = 0xaa;

const FINAL_X = 0x0e;
const FINAL_Y = 0x0f;
const WALK_FLAG_A = 0x13;
const WALK_FLAG_B = 0x18;
const WALK_FLAG_C = 0x1c;

export function loc_3445(m, ix = m.regs.ix, hl = m.regs.hl) {
  const { regs, mem8 } = m;

  const base = ix;
  const field = (off) => u16(base + off);

  const entry = mem8[hl];

  if (entry === TABLE_TERMINATOR) {
    mem8[field(WALK_FLAG_A)] = 0;
    mem8[field(WALK_FLAG_B)] = 0;
    mem8[field(OBJ_STATE)] = 0;
    mem8[field(WALK_FLAG_C)] = 0;
    mem8[field(FINAL_X)] = mem8[field(OBJ_X)];
    mem8[field(FINAL_Y)] = mem8[field(OBJ_Y)];
    mem8[field(OBJ_WALK_PTR_LO)] = 0;
    mem8[field(OBJ_WALK_PTR_HI)] = 0;
    return;
  }

  mem8[field(OBJ_Y)] = entry;

  const next = u16(hl + 1);
  mem8[field(OBJ_WALK_PTR_LO)] = next;
  mem8[field(OBJ_WALK_PTR_HI)] = next >> 8;
}
