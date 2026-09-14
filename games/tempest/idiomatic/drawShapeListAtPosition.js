// SPDX-License-Identifier: GPL-3.0-only
import { SAVED_INDEX, loc_2a, loc_2b } from "./names.js";
import { expandShapeListToVectors } from "./expandShapeListToVectors.js";

// Seat the two scratch inputs and clear the flag byte, then run the shared record builder.
export function drawShapeListAtPosition(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  mem8[SAVED_INDEX] = x;
  mem8[loc_2a] = a;
  mem8[loc_2b] = 0x00;
  return expandShapeListToVectors(m);
}
