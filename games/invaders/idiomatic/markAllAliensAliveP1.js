// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_FIELD_P1 } from "./names.js";
import { markAllAliensAlive } from "./markAllAliensAlive.js";

// Seat the alien-status table base, then mark every alien alive.
export function markAllAliensAliveP1(m) {
  markAllAliensAlive(m, ALIEN_FIELD_P1);
}
