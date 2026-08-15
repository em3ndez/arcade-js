// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0ba0 — print one packed-BCD byte as two tilemap digits (high nibble, then low).
 * LIVE-OUT: memory + HL (the destination stepped up two rows for the caller's next byte).
 */
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function loc_0ba0(m) {
  const { regs } = m;
  const packed = regs.a;

  regs.a = packed >> 4;
  writeScoreDigitStepUp(m);

  regs.a = packed;
  return writeScoreDigitStepUp(m);
}
