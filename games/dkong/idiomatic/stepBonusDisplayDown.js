// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBonusDisplayDown — step the two-digit packed-BCD bonus readout down by one: subtract one,
 * latch the "reached zero" marker if it held 01, decimal-adjust back into valid BCD (00 wraps to
 * 99), store, and hand the value to the shared two-digit field renderer. Steps the readout byte
 * only, not the bonus quantity.
 *
 * LIVE-OUT: memory-only — the readout byte, the bottomed-out latch, and whatever the render tail
 * writes.
 */

import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED } from "./names.js";
import { renderBonusDisplay } from "./renderBonusDisplay.js";

export function stepBonusDisplayDown(m) {
  const { regs, mem8 } = m;

  regs.sub(0x01);

  if (regs.a === 0) {
    mem8[BONUS_DISPLAY_ZEROED] = 0x01;
  }

  // daa reads the flags the sub left; only the plain store may sit between them.
  regs.daa();

  mem8[BONUS_DISPLAY] = regs.a;
  renderBonusDisplay(m);
}
