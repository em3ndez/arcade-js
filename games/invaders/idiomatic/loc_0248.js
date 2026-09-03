// SPDX-License-Identifier: GPL-3.0-only
import { loc_024b } from "./loc_024b.js";
import { GAME_OBJECT_TABLE } from "./names.js";

// Seat the vblank object-table base, then walk it.
export function loc_0248(m) {
  return loc_024b(m, GAME_OBJECT_TABLE);
}
