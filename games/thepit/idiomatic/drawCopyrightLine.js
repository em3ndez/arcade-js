// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCopyrightLine — paint one 32-tile screen column, then colour it.
 *
 * Part of the boot screen-drawing family (siblings drawLeftEdgeColumn / drawBestScoresTodayLabel /
 * drawRightEdgeColumn, each drawing a different column). This member lays a fixed 32-tile column
 * into video RAM from a tile strip, bottom cell upward, then hands off to fillColourColumnAt to
 * fill the matching colour-RAM column, once while the screen is built. The name is neutral: which
 * on-screen column this one is stays unconfirmed and every value is hardwired.
 */

import { fillColourColumnAt } from "./fillColourColumnAt.js";
import { BOOT_TEXT_COLUMN25_BOTTOM, BOOT_TEXT_COLUMN25_TILE_STRIP } from "./names.js";

export function drawCopyrightLine(m) {
  const { mem8 } = m;

  // A fixed 32-tile strip laid into video RAM from the BOTTOM cell upward — one text
  // row (32 cells) higher per tile, so the strip reads bottom-to-top.
  const COLUMN_BOTTOM = BOOT_TEXT_COLUMN25_BOTTOM;
  const ROW = 32;
  for (let i = 0; i < 32; i++) {
    mem8[COLUMN_BOTTOM - i * ROW] = mem8[BOOT_TEXT_COLUMN25_TILE_STRIP + i];
  }

  // Colour the same column via the shared fill; its return lands in our caller (a tail hand-off).
  return fillColourColumnAt(m, 25, 2);
}
