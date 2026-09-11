// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_298, loc_10b } from "./names.js";
import { loc_9c17 } from "./loc_9c17.js";

// Count slot x's timer down; while it stays nonzero run the table-driven state step,
// otherwise bump the shared counter.
export function loc_9c0c(m, x = m.regs.x) {
  const { mem8 } = m;
  const e = u16(loc_298 + x);
  mem8[e]--;
  if (mem8[e] !== 0) {
    loc_9c17(m);
    return;
  }
  mem8[loc_10b]++;
}
