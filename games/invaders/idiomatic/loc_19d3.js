// SPDX-License-Identifier: GPL-3.0-only
import { GAME_ACTIVE } from "./names.js";

// Store the accumulator into its work-RAM cell (a shared tail). Live-out: memory; the seam completes the ret.
export function loc_19d3(m, a = m.regs.a) {
  m.mem8[GAME_ACTIVE] = a;
}
