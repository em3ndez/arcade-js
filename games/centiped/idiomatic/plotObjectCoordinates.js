// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_91, loc_92, loc_f5, loc_f7,
  loc_ac, loc_aa, loc_a8, loc_ad, loc_ab, loc_a9, loc_04, loc_03, loc_02, loc_89,
} from "./names.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";

/**
 * Bridge one byte (and the group's carry mark) into the two-digit plotter, returning the plotter's exit
 * carry. The null-carry (middle) plots re-read the exit carry the previous plot leaves; now that the
 * plotter exposes that exit carry as its return, the chain threads it directly (a boolean carry-in) instead
 * of through the seam's flag bridge.
 */
function plotByte(m, byte, carryIn) {
  return plotByteAsTwoDigits(m, byte, carryIn);
}

/**
 * plotObjectCoordinates -- prints an object's coordinate bytes as decimal digits [code].
 *
 * Seeds the cursor and its flip masks, then feeds each coordinate byte (a high pair, an
 * optional middle pair, then the low pair) to the two-digit plotter, marking the first and
 * last digit of each pair through the carry bridge. Tail-dispatches the final byte.
 */
export function plotObjectCoordinates(m) {
  m.mem8[loc_91] = 0x1f ^ m.mem8[loc_f5];
  m.mem8[loc_92] = 0x04 ^ m.mem8[loc_f7];
  const carry = plotByte(m, m.mem8[loc_ac], true);
  plotByte(m, m.mem8[loc_aa], carry);
  plotByte(m, m.mem8[loc_a8], false);

  if (m.mem8[loc_89] !== 1) {
    m.mem8[loc_92] = 0x07 ^ m.mem8[loc_f7];
    m.mem8[loc_91] = 0x1f ^ m.mem8[loc_f5];
    const carry2 = plotByte(m, m.mem8[loc_ad], true);
    plotByte(m, m.mem8[loc_ab], carry2);
    plotByte(m, m.mem8[loc_a9], false);
  }

  m.mem8[loc_91] = 0x9f ^ m.mem8[loc_f5];
  m.mem8[loc_92] = 0x05 ^ m.mem8[loc_f7];
  const carry3 = plotByte(m, m.mem8[loc_04], true);
  plotByte(m, m.mem8[loc_03], carry3);

  // Tail plot with carry cleared; its exit carry is read by nobody, so a direct call is safe.
  return plotByteAsTwoDigits(m, m.mem8[loc_02], false);
}
