// SPDX-License-Identifier: GPL-3.0-only
/** displaceByHalf — move a coordinate by half a displacement, so whatever it carries keeps only half
 * the pace of whatever moves by the whole of it. The coordinate is a whole part above a fraction
 * and adds as one number, so the fraction carries into the whole and the pair wraps together.
 *
 * ROM 0x304D-0x3057 (frozen lift translated/loc_304d.js). Grounding: [seen].
 *
 * Role in the machine: one of three parallax fractions of the world scroll. Its sole caller is
 * driftAtHalfWorldScroll, a wrapper byte-identical to the five-quarter and three-quarter ones
 * except for which of these it calls, and differing from driftWithWorldScroll only in applying a
 * fraction. The scroll cells, the object and every memory write belong to that caller; this
 * routine reads no scroll cell, touches no object and writes no memory (names.js "why").
 *
 * Parameters: `displacement` is the scroll word the caller loaded (ROM HL); `coordinate` is the
 * object's 16-bit whole-and-fraction coordinate (ROM DE).
 *
 * LIVE-OUT: the moved coordinate, returned and also left standing for the caller to read. */

import { u16 } from "../../../core/int.js";

export function displaceByHalf(m, displacement = m.regs.hl, coordinate = m.regs.de) {
  /* The ROM does not shift the displacement down to a half directly: it takes a rounded-down half
   * (copy HL to BC, `sra b / rr c`) and SUBTRACTS it from the whole (`and a` clears the carry so
   * `sbc hl,bc` is a plain subtract). What remains is the other half, which for an odd
   * displacement is the half rounded UP (e.g. 3 -> 2, -3 -> -1). The coordinate is then added (`add hl,de`), modulo 2^16. */
  const shortened = displacement - signedHalf(displacement);
  return (m.regs.hl = u16(coordinate + shortened));
}

/** Half a displacement that may run either way, rounded toward the negative. */
// Sign-extend the 16-bit word (<< 16) and shift right arithmetically one more place -- one round
// of `sra b / rr c`.
function signedHalf(displacement) {
  return (displacement << 16) >> 17;
}
