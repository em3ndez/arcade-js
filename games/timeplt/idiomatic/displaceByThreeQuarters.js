// SPDX-License-Identifier: GPL-3.0-only
/** displaceByThreeQuarters — move a coordinate by three quarters of a displacement, so whatever it carries
 * trails whatever moves by the whole of it. The coordinate is a whole part above a fraction and
 * adds as one number, so the fraction carries into the whole and the pair wraps together.
 * LIVE-OUT: the moved coordinate, returned and also left standing for the caller to read. */

import { u16 } from "../../../core/int.js";

export function displaceByThreeQuarters(m, displacement = m.regs.hl, coordinate = m.regs.de) {
  const shortened = displacement - signedQuarter(displacement);
  const moved = u16(coordinate + shortened);
  m.regs.hl = moved;
  return moved;
}

/** A quarter of a displacement that may run either way, rounded toward the negative. */
function signedQuarter(displacement) {
  return (displacement << 16) >> 18;
}
