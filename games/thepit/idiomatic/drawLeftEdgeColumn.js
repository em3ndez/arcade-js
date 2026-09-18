import { LEFT_EDGE_COLOUR2_LOWER_RUN_BOTTOM, LEFT_EDGE_COLOUR3_RUN_BOTTOM, LEFT_EDGE_COLUMN_BOTTOM, LEFT_EDGE_COLOUR2_UPPER_RUN_BOTTOM } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawLeftEdgeColumn — stamp the fixed playfield left-edge column: a 32-tile picture strip up
 * video column 0, then three fixed colour runs that tint it.
 *
 * The tilemap is 32 cells wide, so one screen row is 32 bytes and stepping "up a column" steps
 * back one row. This paints the first tilemap column (offset 0 in every row, all 32 rows) plus its
 * colour attributes: a 32-byte picture strip is copied up video column 0 to give the column its
 * fixed tile image, then three colour runs tint it — colour 2 for two 9-cell runs and colour 3 for
 * a 10-cell run, each painted upward from its own starting cell. Writes only video + colour RAM,
 * reads only the picture strip, loads its own source/destinations/counts/colours (no live-in
 * register), and leaves nothing downstream reads.
 */
export function drawLeftEdgeColumn(m) {
  const { mem8 } = m;

  // One tilemap row is 32 bytes, so "up one cell in a column" steps back 32.
  const ROW = 32;

  // Copy the 32-byte picture strip up video column 0, bottom cell to top.
  let source = 0x4aab;
  let cell = LEFT_EDGE_COLUMN_BOTTOM;
  for (let i = 0; i < 32; i++) {
    mem8[cell] = mem8[source];
    source += 1;
    cell -= ROW;
  }

  // Tint that column: two 9-cell runs of colour 2, then a 10-cell run of colour 3,
  // each painted upward from its own top cell.
  paintColourRun(mem8, LEFT_EDGE_COLOUR2_LOWER_RUN_BOTTOM, 9, 2);
  paintColourRun(mem8, LEFT_EDGE_COLOUR2_UPPER_RUN_BOTTOM, 9, 2);
  paintColourRun(mem8, LEFT_EDGE_COLOUR3_RUN_BOTTOM, 10, 3);
}

/** Write `colour` into `count` colour cells starting at `top` and stepping upward one cell at a time. */
function paintColourRun(mem8, top, count, colour) {
  let cell = top;
  for (let i = 0; i < count; i++) {
    mem8[cell] = colour;
    cell -= 32; // step up one row (one column cell)
  }
}
