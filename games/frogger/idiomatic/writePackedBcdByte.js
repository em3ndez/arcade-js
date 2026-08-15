// SPDX-License-Identifier: GPL-3.0-only
/**
 * writePackedBcdByte — print one packed-BCD byte as two tilemap digits (high nibble, then low).
 * LIVE-OUT: memory + HL (the destination stepped up two rows for the caller's next byte).
 */
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function writePackedBcdByte(m) {
  const { regs } = m;
  const packed = regs.a;

  regs.a = packed >> 4;
  writeScoreDigitStepUp(m);

  regs.a = packed;
  return writeScoreDigitStepUp(m);
}
