// SPDX-License-Identifier: GPL-3.0-only
import { startSound } from "./startSound.js";
import { loc_097c } from "./loc_097c.js";
import { GAME_IN_PROGRESS, SCORE_ADD_PENDING, SCORE_ADD_VALUE, SCORE_ADD_VALUE_HI, loc_2062 } from "./names.js";

// When the trigger flag is set, sound the cue, index the table by the passed count, and stamp the looked-up byte with its markers; always hand back the record pointer.
export function loc_0a5f(m, b = m.regs.b) {
  if (m.mem8[GAME_IN_PROGRESS]) {
    startSound(m, 0x08);
    m.mem8[SCORE_ADD_VALUE] = m.mem8[loc_097c(m, b)];
    m.mem8[SCORE_ADD_PENDING] = 0x01;
    m.mem8[SCORE_ADD_VALUE_HI] = 0x00;
  }
  return (m.regs.hl = loc_2062);
}
