// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCreditLineInAttract — repaint the "CREDIT nn" line, but only during attract (bit 0 of
 * ATTRACT set); a credited game in progress leaves the line untouched.
 *
 * LIVE-OUT: memory-only — the credit line's video cells, written inside the painter.
 */

import { ATTRACT } from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";

export function drawCreditLineInAttract(m) {
  const { mem8 } = m;

  if ((mem8[ATTRACT] & 0x01) === 0) return;

  drawCreditDisplay(m);
}
