// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_266f  (ROM 0x266F–0x2676) — sub_262f Y<0xC0 pre-check: if bit7(0x62A3) -> tail; else (0x62A3)=0xFF.
 */
export function loc_266f(m) {
  const { regs, mem } = m;
  regs.bit(7, mem.read8(regs.hl));
  m.step(0x2671, 12); // bit 7,(hl)
  if (regs.fNZ) { m.step(0x264c, 10); return m.call(0x264c); }
  m.step(0x2674, 10);
  mem.write8(regs.hl, 0xff);
  m.step(0x2676, 10);
  m.step(0x264c, 10); // jp 0x264c
  return m.call(0x264c);
}
