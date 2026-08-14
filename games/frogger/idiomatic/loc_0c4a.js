// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c4a — store byte E into RAM page H at row (D - C); C == 0 stores nothing. The sole caller passes
 * H=0x80, so this writes WORK RAM, not a tilemap tile (grounded).
 * LIVE-OUT: memory-only.
 */
export function loc_0c4a(m) {
  const { regs, mem8 } = m;
  if (regs.c === 0) return;
  const row = (regs.d - regs.c) & 0xff;
  mem8[(regs.h << 8) | row] = regs.e;
}
