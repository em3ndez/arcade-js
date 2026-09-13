// SPDX-License-Identifier: GPL-3.0-only
import { SCRIPT_CURSOR, MOTION_SCRIPT_TABLE, loc_298 } from "./names.js";
import { u16 } from "../../../core/int.js";

// Advance the rolling cursor by one, then copy the cursor-selected table byte into this object's slot.
export function loc_9bd0(m, x = m.regs.x) {
  const { mem8 } = m;
  const index = (mem8[SCRIPT_CURSOR] + 1) & 0xff;
  mem8[SCRIPT_CURSOR] = index;
  mem8[u16(loc_298 + x)] = mem8[u16(MOTION_SCRIPT_TABLE + index)];
}
