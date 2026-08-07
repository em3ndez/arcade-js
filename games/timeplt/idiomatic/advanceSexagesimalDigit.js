// SPDX-License-Identifier: GPL-3.0-only
/** advanceSexagesimalDigit — step one packed-decimal byte on by one and roll it over at sixty. The stepped byte
 * is written back first and only then tested, so a byte that lands at sixty or beyond is stored
 * twice: once stepped, once as zero. The decimal correction is the hardware's own, which is why a
 * byte that was never valid packed decimal still comes out exactly where the hardware would put
 * it rather than somewhere a tidier rule would. LIVE-OUT: the byte; and whether it rolled over —
 * returned, and mirrored into carry as its OPPOSITE, since carry standing for "it did not" is
 * what a caller chaining the next digit pair branches on. */

import { u8 } from "../../../core/int.js";
import { F_C } from "../../../core/cpu/z80.js";

const ROLLS_OVER_AT = 0x60;
const LOW_DIGIT = 0x0f;
const HIGHEST = 0x99;
const DIGIT_CARRY = 6;
const TENS_CARRY = 0x60;

/** Add one, then apply the decimal adjust exactly as the hardware does after that add. */
function stepPackedDecimal(value) {
  const sum = u8(value + 1);
  let correction = 0;
  if ((value & LOW_DIGIT) === LOW_DIGIT || (sum & LOW_DIGIT) > 9) correction += DIGIT_CARRY;
  if (value === 255 || sum > HIGHEST) correction += TENS_CARRY;
  return u8(sum + correction);
}

export function advanceSexagesimalDigit(m, cell = m.regs.hl) {
  const { mem8, regs } = m;
  const stepped = stepPackedDecimal(mem8[cell]);
  mem8[cell] = stepped;

  const rolledOver = stepped >= ROLLS_OVER_AT;
  if (rolledOver) mem8[cell] = 0;
  regs.f = (regs.f & ~F_C) | (rolledOver ? 0 : F_C);
  return rolledOver;
}
