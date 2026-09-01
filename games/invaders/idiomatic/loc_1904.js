// SPDX-License-Identifier: GPL-3.0-only
import { markAllAliensAlive } from "./markAllAliensAlive.js";
import { loc_2200 } from "./names.js";

// Mark every alien alive in the second alien array. Live-out: memory; the seam completes the ret.
export function loc_1904(m) {
  markAllAliensAlive(m, loc_2200);
}
