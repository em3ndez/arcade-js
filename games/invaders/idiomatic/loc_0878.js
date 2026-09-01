// SPDX-License-Identifier: GPL-3.0-only
import { activeFieldRecordPointer } from "./activeFieldRecordPointer.js";
import { loc_2008, loc_2009 } from "./names.js";

// Seat the record count and its source pointer, then build the active player's record pointer.
export function loc_0878(m) {
  const b = m.mem8[loc_2008];
  const de = m.mem16[loc_2009];
  return [activeFieldRecordPointer(m), m.regs.b = b, m.regs.de = de];
}
