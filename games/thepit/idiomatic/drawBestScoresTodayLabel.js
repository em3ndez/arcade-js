// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawBestScoresTodayLabel — stamp a fixed edge column, then hand off to the colour fill to tint it.
 *
 * The tilemap is 32 cells wide, so one screen row is 32 bytes and stepping "up a column" means
 * stepping back one row. This copies a 32-byte picture strip up a single video column (top cell
 * first, walking upward), giving that column its fixed tile image, then hands the matching colour
 * column to the shared colour-column fill — 28 cells of colour 1 at offset 30 — so the two land from
 * one call. It is the sibling of drawLeftEdgeColumn, drawing the neighbouring edge column with the
 * identical copy loop; the fill ends by returning straight to this routine's caller.
 */
import { fillColourColumnAt } from "./fillColourColumnAt.js";

export function drawBestScoresTodayLabel(m) {
  const { mem8 } = m;

  // One tilemap row is 32 bytes, so "up one cell in a column" steps back 32.
  const ROW = 32;

  // Copy the 32-byte picture strip up the video column, top cell first.
  let source = 0x4acb;
  let cell = 0x93fe;
  for (let i = 0; i < 32; i++) {
    mem8[cell] = mem8[source];
    source += 1;
    cell -= ROW;
  }

  // Tail hand-off to the shared colour-column fill; its return goes straight to our caller.
  return fillColourColumnAt(m, 30, 1); // columnOffset 30, colour 1
}
