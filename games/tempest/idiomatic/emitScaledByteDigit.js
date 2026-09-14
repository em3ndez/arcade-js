// SPDX-License-Identifier: GPL-3.0-only
import { loc_29 } from "./names.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

// Stash the accumulator, scale the two coordinates into the vector work pair, then
// emit that one stashed byte as a single-entry vector run.
export function emitScaledByteDigit(m, a = m.regs.a, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_29] = a;
  emitScaledCoordinateRecord(m, y, x);
  emitNibbleDigitRun(m, loc_29, 0x01);
}
