// SPDX-License-Identifier: GPL-3.0-only
// Input-scan step: if either input port has bit 2 or 3 set, seed the control byte, then continue the scan
// by delegating (a fall-through) to the input-flag/column-draw link.
import { loc_41df } from "./names.js";
import { armInputFlagAndDrawInputColumns } from "./armInputFlagAndDrawInputColumns.js";

const SCAN_BITS = 0x0c;   // bits 2-3 of the folded input ports
const CONTROL_SEED = 6;

export function requestSound6AndContinueInputScan(m, in0 = m.regs.b, in1 = m.regs.c) {
  const { mem8 } = m;

  if ((in0 | in1) & SCAN_BITS) mem8[loc_41df] = CONTROL_SEED;
  return armInputFlagAndDrawInputColumns(m, in0, in1);
}
