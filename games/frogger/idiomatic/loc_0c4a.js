// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c4a — store byte E into RAM page H at row (D - C); C == 0 stores nothing. The sole caller passes
 * H=0x80, so this writes WORK RAM, not a tilemap tile (grounded).
 * LIVE-OUT: memory-only.
 */
export function loc_0c4a(m, c = m.regs.c, d = m.regs.d, h = m.regs.h, e = m.regs.e) {
  const { mem8 } = m;
  if (c === 0) return;
  const row = (d - c) & 0xff;
  mem8[(h << 8) | row] = e;
}
