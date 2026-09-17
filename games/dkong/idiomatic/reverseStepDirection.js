// SPDX-License-Identifier: GPL-3.0-only
/**
 * reverseStepDirection — flip the sign of the one-byte signed step at the caller's pointer.
 * Bit 7 is the direction; magnitude is reset to 2, and only the resulting sign is read downstream.
 *
 * LIVE-OUT: memory-only — the one byte at the caller's pointer.
 */
export function reverseStepDirection(m) {
  const { regs, mem8 } = m;
  const v = mem8[regs.hl];
  mem8[regs.hl] = (v & 0x80) ? 0x02 : 0xfe; // bit 7 set -> +2, else -2
}
