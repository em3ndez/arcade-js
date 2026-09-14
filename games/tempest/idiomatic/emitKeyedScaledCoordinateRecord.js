// SPDX-License-Identifier: GPL-3.0-only
import { VG_RECORD_HEADER } from "./names.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";

// Stash the index byte, then scale the two coordinates into the vector work pair.
export function emitKeyedScaledCoordinateRecord(m, y = m.regs.y, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[VG_RECORD_HEADER] = y;
  return emitScaledCoordinateRecord(m, a, x);
}
