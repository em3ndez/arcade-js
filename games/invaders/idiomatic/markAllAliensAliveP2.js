// SPDX-License-Identifier: GPL-3.0-only
import { markAllAliensAlive } from "./markAllAliensAlive.js";
import { ALIEN_FIELD_P2 } from "./names.js";

// Mark every alien alive in the second alien array. Live-out: memory; the seam completes the ret.
export function markAllAliensAliveP2(m) {
  markAllAliensAlive(m, ALIEN_FIELD_P2);
}
