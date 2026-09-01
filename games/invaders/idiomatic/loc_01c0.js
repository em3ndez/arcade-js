// SPDX-License-Identifier: GPL-3.0-only
import { loc_2100 } from "./names.js";
import { markAllAliensAlive } from "./markAllAliensAlive.js";

// Seat the alien-status table base, then mark every alien alive.
export function loc_01c0(m) {
  markAllAliensAlive(m, loc_2100);
}
