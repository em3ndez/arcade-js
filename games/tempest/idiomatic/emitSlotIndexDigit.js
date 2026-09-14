// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { PROJ_Y_LO } from "./names.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

// Advance the slot index, publish it through the pointer byte, then emit that
// one-byte run.
export function emitSlotIndexDigit(m, x = m.regs.x) {
  const { mem8 } = m;
  x = u8(x + 1);
  mem8[PROJ_Y_LO] = x;
  return emitNibbleDigitRun(m, 0x61, 0x01);
}
