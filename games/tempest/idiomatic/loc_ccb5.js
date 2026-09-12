// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Load a fixed sound id and pass it through the sound gate, keeping caller X/Y.
export function loc_ccb5(m, x = m.regs.x, y = m.regs.y) {
  return loc_ccc3(m, 0x0f, x, y);
}
