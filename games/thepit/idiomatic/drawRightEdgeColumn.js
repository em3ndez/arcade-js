// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawRightEdgeColumn — draw the rightmost playfield column: a 28-tile strip from work RAM up
 * video column 31, a base colour, then three 3-cell colour accents.
 *
 * The tilemap is 32 cells wide, so "up one cell in a column" steps back 32. A 28-byte tile strip
 * staged in work RAM is copied up column 31 (rows 2..29) — built in RAM, so unlike the fixed
 * left-edge column its picture is dynamic — then the whole column gets a base colour of 2, and
 * three 3-cell bands accent it (colour 6 low, 4 in the middle, 7 higher, 7 rows apart). It loads
 * its own inputs and writes only video + colour RAM (plus the colour scratch the fill caches). The
 * name stays neutral — the mirror of the left-edge stamper, but which feature the right column
 * represents is not confidently pinned.
 */

import { fillColourColumnAt } from "./fillColourColumnAt.js";

export function drawRightEdgeColumn(m) {
  const { mem8 } = m;

  // One tilemap row is 32 cells, so "up one cell in a column" steps back 32.
  const ROW = 32;

  // Copy the 28-byte tile strip from work RAM up video column 31, bottom cell to top.
  let source = 0x8282;
  let cell = 0x93bf;
  for (let i = 0; i < 28; i++) {
    mem8[cell] = mem8[source];
    source += 1;
    cell -= ROW;
  }

  // Base-colour the whole column: stamp colour 2 down colour column 31.
  fillColourColumnAt(m, 31, 2);

  // Three 3-cell accent bands (rows 26..28, 17..19, 8..10), each painted upward from its bottom cell.
  paintColourBand(mem8, 0x8b9f, 6);
  paintColourBand(mem8, 0x8a7f, 4);
  paintColourBand(mem8, 0x895f, 7);
}

/** Write `colour` into three colour cells starting at `bottom` and stepping upward one row at a time. */
function paintColourBand(mem8, bottom, colour) {
  let cell = bottom;
  for (let i = 0; i < 3; i++) {
    mem8[cell] = colour;
    cell -= 32; // step up one row = one cell up the column
  }
}
