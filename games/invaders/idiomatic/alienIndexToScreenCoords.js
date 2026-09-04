// SPDX-License-Identifier: GPL-3.0-only
import { loc_2009, loc_200a } from "./names.js";

/**
 * alienIndexToScreenCoords -- turn a flat alien index (0..54) into a screen-coordinate pair.
 *
 * WHAT IT IS
 *   The alien field is a 5-row by 11-column rack, and the game stores only ONE reference corner for the
 *   whole fleet rather than a coordinate per alien. This routine reconstructs an individual alien's
 *   position on demand: given its flat index in L, it divides the index by 11 (the row width) to recover
 *   the alien's row and column, and adds 0x10 (sixteen pixels) of offset per grid step onto the reference
 *   corner in each axis. So an alien's coordinate is "reference corner + 16px per grid step".
 *
 * ROLE IN THE MACHINE
 *   The reference-corner pair is read from loc_2009 and loc_200a (the fleet anchor that
 *   loadReferenceAlienState refreshes each pass; these cells keep loc_ placeholder names -- their exact
 *   X-vs-Y axis convention is not yet pinned down). The march selector pickNextMarchingAlien calls this
 *   to resolve the next alien to paint into ALIEN_DRAW_ADDR, and the alien-shot spawn path
 *   (findLiveAlienInColumn -> here) uses it to place a shot at a live alien. Because the reference corner
 *   is nudged every pass, shifting that one pair slides the entire fleet in lockstep -- that is the march.
 *
 * ROM 0x017a.  Grounding: [seen].
 *
 * LIVE-OUT: L = the first coordinate (reference-corner byte from loc_2009 stepped by 0x10 per whole row),
 * C = the second coordinate (loc_200a stepped by 0x10 per leftover column), D = the whole-row (quotient)
 * count. The input index arrives in L and is consumed; L is overwritten by the result.
 */
export function alienIndexToScreenCoords(m, l = m.regs.l) {
  // Seed the two working coordinates from the fleet's reference corner: B (here `b`) from loc_2009 and
  // C from loc_200a. Everything below adds grid offsets onto these two seeds. D counts whole rows.
  let b = m.mem8[loc_2009];
  let c = m.mem8[loc_200a];
  let d = 0;
  let a = l;
  // Integer-divide the index by the row width 0x0b (11) the 8080 way: subtract 0x0b repeatedly while the
  // result stays non-negative (its high bit clear). Each whole row consumed steps the first coordinate
  // forward 0x10 (sixteen pixels, one grid step) and bumps the row counter D. When A drops below 0x0b the
  // subtraction would go negative (high bit set) and the loop stops, leaving A as the leftover column.
  while (((a - 0x0b) & 0x80) === 0) { a = (a - 0x0b) & 0xff; b = (b + 0x10) & 0xff; d = (d + 1) & 0xff; }
  // The remainder A is the alien's column within its row: step the second coordinate 0x10 per column so
  // the two coordinates together locate this exact alien relative to the reference corner.
  while (a !== 0) { c = (c + 0x10) & 0xff; a = (a - 1) & 0xff; }
  // Publish the resolved pair back into the register file: L (row-axis coord), C (column-axis coord), D
  // (row count). The array return mirrors those three writes for callers that read them directly.
  return [m.regs.l = b, m.regs.c = c, m.regs.d = d];
}
