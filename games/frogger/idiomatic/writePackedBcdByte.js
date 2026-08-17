// SPDX-License-Identifier: GPL-3.0-only
/**
 * writePackedBcdByte — print one packed-BCD byte as two tilemap digits (high nibble, then low).
 * LIVE-OUT: memory + HL (the destination stepped up two rows for the caller's next byte).
 */
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function writePackedBcdByte(m, packed = m.regs.a) {
  writeScoreDigitStepUp(m, packed >> 4);
  return writeScoreDigitStepUp(m, packed);
}
