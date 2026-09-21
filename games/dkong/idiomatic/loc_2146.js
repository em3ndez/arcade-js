// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2146 — object re-launch arm taken while the object's Y is still above the 0xE0 line.
 * Seeds the object's two step fields (by mode and difficulty), snapshots its current Y into
 * record byte +0x19 as a height reference read back elsewhere in this cluster, and enters the
 * shared zero-fill tail with the result register cleared. The leading subtract call writes no
 * memory and its result is not read back here.
 *
 * LIVE-OUT: memory-only, plus the propagated return value. The cleared register is live — the
 * tail stores it into three record fields.
 */

import { loc_2407 } from "./loc_2407.js";
import { loc_22cb } from "./loc_22cb.js";
import { OBJ_Y } from "./names.js";

const OBJ_Y_SNAPSHOT = 0x19;

export function loc_2146(m, record = m.regs.ix) {
  const { regs, mem8 } = m;

  loc_2407(m);
  loc_22cb(m);

  mem8[record + OBJ_Y_SNAPSHOT] = mem8[record + OBJ_Y];

  return (regs.a = 0, m.call(0x2153));
}
