// SPDX-License-Identifier: GPL-3.0-only

// loc_08ae  (ROM 0x08AE-0x08B3)
export function loc_08ae(m) {
  const { regs } = m;

  regs.hl = 0x335e;
  m.step(0x08b1, 10); // ld hl,0x335e
  regs.b = 0x1e;
  m.step(0x08b3, 7); // ld b,0x1e

  m.ret(10); // 08b3
}
