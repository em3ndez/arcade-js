// SPDX-License-Identifier: GPL-3.0-only
import { drawOrSaveShields } from "./drawOrSaveShields.js";
import { loc_2142 } from "./names.js";

// Save or restore the shields against their backup buffer, driven by A as the save/restore mode.
export function loc_021b(m, a = m.regs.a) {
  return drawOrSaveShields(m, a, loc_2142);
}
