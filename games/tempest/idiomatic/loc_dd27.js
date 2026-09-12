// SPDX-License-Identifier: GPL-3.0-only
import { loc_dd29 } from "./loc_dd29.js";

// Emit the digit run with a fixed value byte.
export function loc_dd27(m, y = m.regs.y) {
  return loc_dd29(m, y, 0xd0);
}
