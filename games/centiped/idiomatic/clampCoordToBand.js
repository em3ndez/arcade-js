// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { routeByCoordDelta } from "./routeByCoordDelta.js";
import { loc_63, loc_73, loc_86, loc_8b } from "./names.js";

/**
 * clampCoordToBand -- advance the $73 coordinate by delta A (+ carry-in) and clamp the
 * sum into the valid band, unless the destination tile cell is already occupied (then
 * $73 is left as it was). The band keeps the value out of the two dead zones: results
 * fold to 0x08 / 0x30 / 0xc8 / 0xf0 at the edges, and pass through inside [0x08,0x31)
 * and [0xc8,0xf1). Seeds $8b = $63 for the cell probe. When the sign cell $86 is
 * non-negative it hands off to the follow-up stage; otherwise it returns. [code]
 */
export function clampCoordToBand(m, a = m.regs.a, carryIn = m.regs.fC) {
  const { mem8 } = m;
  const sum = u8(a + mem8[loc_73] + (carryIn ? 1 : 0));
  mem8[loc_8b] = mem8[loc_63]; // seed the row scratch for the cell probe (Y = 0)
  const cell = resolveTileCellAtXY(m, sum, 0)[0];
  // Occupied destination leaves $73 untouched; an empty cell writes the clamped sum.
  if (cell === 0) {
    let clamped;
    if (sum < 0x08) clamped = 0x08;
    else if (sum >= 0xf1) clamped = 0xf0;
    else if (sum < 0x80) clamped = sum < 0x31 ? sum : 0x30;
    else clamped = sum >= 0xc8 ? sum : 0xc8;
    mem8[loc_73] = clamped;
  }
  if ((mem8[loc_86] & 0x80) === 0) return routeByCoordDelta(m); // sign cell non-negative -> follow-up stage
}
