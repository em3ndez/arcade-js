// SPDX-License-Identifier: GPL-3.0-only
import { loc_5 } from "./names.js";
import { loc_ccc7 } from "./loc_ccc7.js";

// Sound gate: register the sound in A only when the enable flag's high bit is set.
export function loc_ccc3(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  if ((mem8[loc_5] & 0x80) === 0) return;
  loc_ccc7(m, a, x, y);
}
