// SPDX-License-Identifier: GPL-3.0-only
// Continues the input scan: fold the two input-port bytes handed in and, when their shared bit 4 is set,
// raise the companion control byte, then delegate to the input-text/screen-fill init (a fall-through).
import { loc_41cc } from "./names.js";
import { drawInputTextColumnsAndSeedScreenFill } from "./drawInputTextColumnsAndSeedScreenFill.js";

const START_BIT = 0x10; // bit 4 of the folded input ports

export function armInputFlagAndDrawInputColumns(m, in0 = m.regs.b, in1 = m.regs.c) {
  const { mem8 } = m;

  if ((in0 | in1) & START_BIT) mem8[loc_41cc] = 1;
  return drawInputTextColumnsAndSeedScreenFill(m);
}
