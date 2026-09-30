// SPDX-License-Identifier: GPL-3.0-only
/** displaceByFiveQuarters — move a coordinate by a displacement and a further quarter of it, so whatever it
 * carries leads whatever moves by the whole of it. The coordinate is a whole part above a
 * fraction and adds as one number, so the fraction carries into the whole and the pair wraps
 * together.
 *
 * ROM 0x2E31-0x2E3D (frozen lift translated/loc_2e31.js). Grounding: [seen].
 *
 * Role in the machine: one of three parallax fractions of the world scroll. Its sole caller is
 * driftAtFiveQuartersWorldScroll, a wrapper byte-identical to the half and three-quarter ones
 * except for which of these it calls, and differing from driftWithWorldScroll only in applying a
 * fraction. The scroll cells, the object and every memory write belong to that caller; this
 * routine reads no scroll cell, touches no object and writes no memory (names.js "why").
 *
 * Parameters: `displacement` is the scroll word the caller loaded (ROM HL); `coordinate` is the
 * object's 16-bit whole-and-fraction coordinate (ROM DE).
 *
 * LIVE-OUT: the moved coordinate, returned and also left standing for the caller. */

import { u16 } from "../../../core/int.js";

export function displaceByFiveQuarters(m, displacement = m.regs.hl, coordinate = m.regs.de) {
  /* displacement + displacement/4 (ROM: copy HL to BC, `sra b / rr c` twice, `add hl,bc`), then
   * add the coordinate (`add hl,de`), all modulo 2^16 as in the 16-bit register. */
  const lengthened = displacement + signedQuarter(displacement);
  const moved = u16(coordinate + lengthened);
  // The result goes back in HL, where the caller reads it, and is also returned.
  return (m.regs.hl = moved);
}

/** A quarter of a displacement that may run either way, rounded toward the negative. */
// The 16-bit word is sign-extended (<< 16) and shifted right arithmetically by two more places,
// exactly what two rounds of `sra b / rr c` do to BC: the quarter rounds down, not toward zero.
function signedQuarter(displacement) {
  return (displacement << 16) >> 18;
}
