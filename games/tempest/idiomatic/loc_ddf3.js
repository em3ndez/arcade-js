// SPDX-License-Identifier: GPL-3.0-only
import { loc_ddff } from "./loc_ddfb.js";

// Force the index byte to 0xff, then run the shared mask-merge with the live-in mask.
export function loc_ddf3(m, a = m.regs.a) {
  loc_ddff(m, a, 0xff);
}
