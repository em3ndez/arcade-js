// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_91, loc_92, loc_f5, loc_f7,
  loc_ac, loc_aa, loc_a8, loc_ad, loc_ab, loc_a9, loc_04, loc_03, loc_02, loc_89,
} from "./names.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";

/**
 * plotByte — bridge one coordinate byte (plus the group's leading-zero carry mark) into the
 * two-digit plotter, returning the plotter's exit carry.
 *
 * Why this thin wrapper exists: in the original the "middle" plots re-read the exit carry the
 * previous plot left on the flag bridge. Now that `plotByteAsTwoDigits` exposes that exit carry as
 * its return value, the chain can thread it directly as an ordinary boolean carry-in instead of
 * routing it through the seam's flag bridge — so `carryIn` is the previous digit-group's carry-out,
 * passed by value.
 */
function plotByte(m, byte, carryIn) {
  return plotByteAsTwoDigits(m, byte, carryIn);
}

/**
 * plotObjectCoordinates -- print an object's coordinate bytes as on-screen decimal digits [code].
 *
 * Role in the machine: called each frame from the render tail to draw the live object's position
 * readout. An object's coordinate is stored across several bytes; this walks those bytes most- to
 * least-significant, printing each as a two-digit pair so the coordinate reads as a decimal number.
 *
 * Cursor + flip masks: before each group it seeds the 16-bit draw cursor low/high (`loc_91`/`loc_92`,
 * 0x0091/0x0092) by XORing fixed screen offsets against the orientation "flip" bytes `loc_f5`/`loc_f7`
 * -- the game can mirror the display, and folding the flip bytes in here places each digit group at
 * the correct screen cell for the current orientation.
 *
 * Leading-zero carry: each group starts its first byte with carry TRUE (blank leading zeros), threads
 * the resulting carry into the middle byte, and clears carry (FALSE) for the last byte so the least
 * significant digit always shows even when zero.
 *
 * Grounding: [code]. Live-out: returns the final tail plot's exit carry, read by nobody.
 */
export function plotObjectCoordinates(m) {
  // First (high) coordinate group: seat the cursor from the flip bytes, then plot the three bytes
  // high->low. First byte blanks leading zeros (carry true); middle inherits the carry-out; last
  // byte is forced visible (carry false).
  m.mem8[loc_91] = 0x1f ^ m.mem8[loc_f5];
  m.mem8[loc_92] = 0x04 ^ m.mem8[loc_f7];
  const carry = plotByte(m, m.mem8[loc_ac], true);
  plotByte(m, m.mem8[loc_aa], carry);
  plotByte(m, m.mem8[loc_a8], false);

  // Optional middle coordinate group, drawn only when `loc_89` (0x0089) is not 1 -- that cell gates
  // whether this object shows a second coordinate line. Re-seats the cursor (note the high byte uses
  // 0x07 here, a different screen row) and repeats the same blank/inherit/force pattern on the a9/ab/ad
  // byte triple.
  if (m.mem8[loc_89] !== 1) {
    m.mem8[loc_92] = 0x07 ^ m.mem8[loc_f7];
    m.mem8[loc_91] = 0x1f ^ m.mem8[loc_f5];
    const carry2 = plotByte(m, m.mem8[loc_ad], true);
    plotByte(m, m.mem8[loc_ab], carry2);
    plotByte(m, m.mem8[loc_a9], false);
  }

  // Final (low) coordinate group at yet another cursor position (high-byte 0x05, low offset 0x9f).
  // Two bytes are threaded here (04 then 03) before the tail byte.
  m.mem8[loc_91] = 0x9f ^ m.mem8[loc_f5];
  m.mem8[loc_92] = 0x05 ^ m.mem8[loc_f7];
  const carry3 = plotByte(m, m.mem8[loc_04], true);
  plotByte(m, m.mem8[loc_03], carry3);

  // Tail plot with carry cleared; its exit carry is read by nobody, so a direct call is safe.
  return plotByteAsTwoDigits(m, m.mem8[loc_02], false);
}
