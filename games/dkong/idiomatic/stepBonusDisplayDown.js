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

import { bcdSubByte } from "../../../core/bcd.js";
import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED } from "./names.js";
import { renderBonusDisplay } from "./renderBonusDisplay.js";

export function stepBonusDisplayDown(m, aIn = m.regs.a) {
  const { mem8 } = m;

  // Latch the bottomed-out marker on the plain (pre-adjust) subtract reaching zero (held 01).
  if (((aIn - 1) & 0xff) === 0) {
    mem8[BONUS_DISPLAY_ZEROED] = 0x01;
  }

  // Packed-BCD decrement (dec then daa, borrow clear): 00 wraps to 99.
  const value = bcdSubByte(aIn, 1).value;
  mem8[BONUS_DISPLAY] = value;
  return (m.regs.a = value, renderBonusDisplay(m, value));
}
