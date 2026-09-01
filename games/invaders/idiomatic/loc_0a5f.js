// SPDX-License-Identifier: GPL-3.0-only
import { startSound } from "./startSound.js";
import { loc_097c } from "./loc_097c.js";
import { loc_20ef, loc_20f1, loc_20f2, loc_20f3, loc_2062 } from "./names.js";

// When the trigger flag is set, sound the cue, index the table by the passed count, and stamp the looked-up byte with its markers; always hand back the record pointer.
export function loc_0a5f(m, b = m.regs.b) {
  if (m.mem8[loc_20ef]) {
    startSound(m, 0x08);
    m.mem8[loc_20f2] = m.mem8[loc_097c(m, b)];
    m.mem8[loc_20f1] = 0x01;
    m.mem8[loc_20f3] = 0x00;
  }
  return (m.regs.hl = loc_2062);
}
