// SPDX-License-Identifier: GPL-3.0-only
import { loc_3775 } from "./loc_3775.js";
/**
 * loc_361d — actor end-of-move guard. Tests bit 0 of the record's flag byte (rec+8): when it is
 * clear the routine returns with no effect; when it is set it hands the same record to the
 * end-of-move dispatch, whose result becomes this routine's result.
 *
 * LIVE-OUT: none — the subtree caller reloads A and reads no register back. IX passes straight through.
 */

const REC_FLAG_BYTE = 0x08; // rec+8: bit 0 gates the end-of-move dispatch
const FLAG_DISPATCH = 0x01; // bit 0 of the flag byte

export function loc_361d(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if ((mem8[rec + REC_FLAG_BYTE] & FLAG_DISPATCH) === 0) return; // bit 0 clear: no effect
  return loc_3775(m, rec); // bit 0 set: hand off to the end-of-move dispatch
}
