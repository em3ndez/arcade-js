// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { INTRO_PHASE_INDEX, HIT_TALLY, HUD_INTRO_DIGITS_BASE } from "./names.js";
/**
 * advanceIntroPhaseAndDrawHitTally — level-intro phase 2: advance the intro phase, then draw the target-hit tally as two
 * stacked digit pairs — the packed-BCD tally at the HUD base and its BCD double two rows up.
 * LIVE-OUT: memory only — the advanced phase byte and the four painted digit tiles; the digit
 * routine's register outputs (HL/E/BC) end set but no caller consumes them.
 */

const ROW_STRIDE_UP = -0x20;

/** Double a packed-BCD byte, keeping the low two decimal digits (an add-then-daa in decimal). */
function doubleBcd(packed) {
  const value = (packed >> 4) * 10 + (packed & 0x0f);
  const doubled = (value * 2) % 100;
  return (Math.floor(doubled / 10) << 4) | (doubled % 10);
}

export function advanceIntroPhaseAndDrawHitTally(m) {
  const { mem8 } = m;

  mem8[INTRO_PHASE_INDEX] = mem8[INTRO_PHASE_INDEX] + 1;
  const tally = mem8[HIT_TALLY];
  const packed = tally === 0 ? 0 : binToPackedBcd(m, tally).a;

  const first = drawStackedBcdDigits(m, HUD_INTRO_DIGITS_BASE, packed);
  const dst2 = u16(first.next + 2 * ROW_STRIDE_UP);
  drawStackedBcdDigits(m, dst2, doubleBcd(packed));
}
