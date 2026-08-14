// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c4a — stamp tile E into the intro digit page at row (D - C); a zero offset (C == 0) draws nothing.
 * LIVE-OUT: memory-only.
 */
export function loc_0c4a(m) {
  const { regs, mem8 } = m;
  if (regs.c === 0) return;
  const row = (regs.d - regs.c) & 0xff;
  mem8[(regs.h << 8) | row] = regs.e;
}
