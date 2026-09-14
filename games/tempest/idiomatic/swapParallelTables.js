// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SWEEP_STAGE, loc_3bc } from "./names.js";

// Swap two parallel 18-entry tables slot-for-slot: each slot ends up holding
// what its sibling slot held.
export function swapParallelTables(m) {
  const { mem8 } = m;
  for (let x = 0x11; x >= 0; x--) {
    const lo = mem8[u16(SWEEP_STAGE + x)];
    const hi = mem8[u16(loc_3bc + x)];
    mem8[u16(loc_3bc + x)] = lo;
    mem8[u16(SWEEP_STAGE + x)] = hi;
  }
  return;
}
