// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeScoreDigitStepUp — write one BCD digit into the score tilemap and step up one row.
 * Stores the digit's low nibble at the caller's pointer, then moves the pointer up one 32-cell row.
 * LIVE-OUT: memory, plus the stepped-up write pointer read back by the caller.
 */
import { u16 } from "../../../core/int.js";

const LOW_NIBBLE = 0x0f;
const ROW_UP = 32;

export function writeScoreDigitStepUp(m, digit = m.regs.a, ptr = m.regs.hl) {
  const { mem8 } = m;
  mem8[ptr] = digit & LOW_NIBBLE;
  return (m.regs.hl = u16(ptr - ROW_UP));
}
