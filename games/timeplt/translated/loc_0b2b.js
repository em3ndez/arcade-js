// SPDX-License-Identifier: GPL-3.0-only

// loc_0b2b  (ROM 0x0B2B–0x0B38)
export function loc_0b2b(m) {
  const { regs, mem } = m;

  regs.hl = 0xaa41;
  m.step(0x0b2e, 10); // ld hl,0xaa41
  regs.de = 0x0002;
  m.step(0x0b31, 10); // ld de,0x0002
  regs.b = 0x04;
  m.step(0x0b33, 7); // ld b,0x04
  regs.xor(regs.a);
  m.step(0x0b34, 4); // xor a

  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x0b35, 7); // ld (hl),a
    regs.addHl(regs.de);
    m.step(0x0b36, 11); // add hl,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0b34 : 0x0b38, regs.b !== 0 ? 13 : 8); // djnz 0x0b34
  } while (regs.b !== 0);

  m.ret(10); // ret (0x0B38)
}
