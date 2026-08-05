// SPDX-License-Identifier: GPL-3.0-only

// loc_526a  (ROM 0x526A–0x5276)
export function loc_526a(m) {
  const { regs, mem } = m;

  regs.hl = 0xae84;
  m.step(0x526d, 10); // ld hl,0xae84
  mem.write16(0xae80, regs.hl);
  m.step(0x5270, 16); // ld (0xae80),hl
  regs.hl = 0xae04;
  m.step(0x5273, 10); // ld hl,0xae04
  mem.write16(0xae00, regs.hl);
  m.step(0x5276, 16); // ld (0xae00),hl

  m.ret(10); // ret (0x5276)
}
