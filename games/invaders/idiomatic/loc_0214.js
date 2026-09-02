// SPDX-License-Identifier: GPL-3.0-only
import { drawOrSaveShields } from "./drawOrSaveShields.js";
import { loc_2242 } from "./names.js";

// Seat the player-2 shield source/dest base, then save-or-draw the four shield blocks under the caller's mode flag.
export function loc_0214(m, a = m.regs.a) {
  drawOrSaveShields(m, a, loc_2242);
}
