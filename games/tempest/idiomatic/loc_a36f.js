// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2d, loc_a6, loc_2db, loc_2b5, loc_2f2 } from "./names.js";
import { loc_ccc1 } from "./loc_ccc1.js";
import { loc_a3d4 } from "./loc_a3d4.js";

// Retire the object in slot Y: fire the sound gate, stage its source and target, re-insert
// a zeroed object, clear the slot, drop the live count, and flag lane X spent.
export function loc_a36f(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  loc_ccc1(m, x, y);
  mem8[loc_29] = mem8[u16(loc_2db + y)];
  mem8[loc_2d] = mem8[u16(loc_2b5 + y)];
  loc_a3d4(m, 0x00, x, y);
  mem8[u16(loc_2db + y)] = 0x00;
  mem8[loc_a6]--;
  mem8[u16(loc_2f2 + x)] = 0xff;
}
