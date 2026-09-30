// SPDX-License-Identifier: GPL-3.0-only
/** displaceByThreeQuarters — move a coordinate by three quarters of a displacement, so whatever it carries
 * trails whatever moves by the whole of it. The coordinate is a whole part above a fraction and
 * adds as one number, so the fraction carries into the whole and the pair wraps together.
 *
 * ROM 0x303E-0x304C (frozen lift translated/loc_303e.js). Grounding: [seen].
 *
 * Role in the machine: one of three parallax fractions of the world scroll. Its sole caller is
 * driftAtThreeQuartersWorldScroll, a wrapper byte-identical to the half and five-quarter ones
 * except for which of these it calls, and differing from driftWithWorldScroll only in applying a
 * fraction. The scroll cells, the object and every memory write belong to that caller; this
 * routine reads no scroll cell, touches no object and writes no memory (names.js "why").
 *
 * Parameters: `displacement` is the scroll word the caller loaded (ROM HL); `coordinate` is the
 * object's 16-bit whole-and-fraction coordinate (ROM DE).
 *
 * LIVE-OUT: the moved coordinate, returned and also left standing for the caller to read. */

import { u16 } from "../../../core/int.js";

export function displaceByThreeQuarters(m, displacement = m.regs.hl, coordinate = m.regs.de) {
  /* Three quarters as the whole minus a rounded-down quarter (ROM: copy HL to BC, `sra b / rr c`
   * twice, `and a` to clear the carry, `sbc hl,bc`), then add the coordinate (`add hl,de`),
   * modulo 2^16. */
  const shortened = displacement - signedQuarter(displacement);
  const moved = u16(coordinate + shortened);
  return (m.regs.hl = moved); // HL is the load-bearing register-out for the frozen dispatch AND the idiomatic return
}

/** A quarter of a displacement that may run either way, rounded toward the negative. */
// Sign-extend the 16-bit word (<< 16) and shift right arithmetically two more places -- two rounds
// of `sra b / rr c`.
function signedQuarter(displacement) {
  return (displacement << 16) >> 18;
}
