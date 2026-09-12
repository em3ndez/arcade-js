// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2c, loc_2d, loc_13b, loc_13c, loc_200, loc_201, loc_202 } from "./names.js";
import { loc_ccb0 } from "./loc_ccb0.js";
import { loc_a3d6 } from "./loc_a3d6.js";

// Prime a fresh top-priority object: seed its flag, source and target cells, fire the
// sound gate, insert it into the 8-slot table, then raise the ready flags.
export function loc_a34b(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_13b] = 0xff;
  mem8[loc_2c] = 0x01;
  mem8[loc_29] = mem8[loc_202];
  mem8[loc_2d] = mem8[loc_200];
  loc_ccb0(m, x, y);
  loc_a3d6(m, x, y);
  mem8[loc_201] = 0x81;
  mem8[loc_13c] = 0x01;
}
