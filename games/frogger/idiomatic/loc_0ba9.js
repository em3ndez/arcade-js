// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0ba9 — write one BCD digit into the score tilemap and step up one row.
 * Stores the digit's low nibble at the caller's pointer, then moves the pointer up one 32-cell row.
 * LIVE-OUT: memory, plus the stepped-up write pointer read back by the caller.
 */
const LOW_NIBBLE = 0x0f;
const ROW_UP = 32;

export function loc_0ba9(m, digit = m.regs.a, ptr = m.regs.hl) {
  const { mem8 } = m;
  mem8[ptr] = digit & LOW_NIBBLE;
  m.regs.hl = (ptr - ROW_UP) & 0xffff;
}
