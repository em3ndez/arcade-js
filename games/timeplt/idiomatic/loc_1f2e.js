// SPDX-License-Identifier: GPL-3.0-only
/** loc_1f2e — sixteen direction-table bytes decoded as instructions: fold B into A, take two early
 * returns on the result, else AND B in and fall out of the table into the heading snap. LIVE-OUT: memory. */

import { loc_1f99 } from "./loc_1f99.js";
import { snapHeadingOntoTheTurnTarget } from "./snapHeadingOntoTheTurnTarget.js";

export function loc_1f2e(m) {
  const { regs } = m;

  regs.add(regs.b);
  if (regs.fNZ) return m.ret();
  if (regs.fPO) return m.ret();

  regs.and(regs.b);
  if (regs.fNZ) return loc_1f99(m);

  return snapHeadingOntoTheTurnTarget(m);
}
