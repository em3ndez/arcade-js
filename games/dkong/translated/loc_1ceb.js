// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1ceb  (ROM 0x1CEB–0x1CF1) — dec (0x620f) jump-phase, tail-jump 0x1da6.
 */
export function loc_1ceb(m) {
  const { regs, mem } = m;
  regs.hl = 0x620f;
  m.step(0x1cee, 10); // ld hl,0x620f
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x1cef, 11); // dec (hl)
  m.step(0x1da6, 10); // jp 0x1da6
  return m.call(0x1da6);
}
