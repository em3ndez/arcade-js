// SPDX-License-Identifier: GPL-3.0-only

// loc_291e  (ROM 0x291E-0x2926)
export function loc_291e(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.add(mem.read8(regs.hl));
    m.step(0x291f, 7); // add a,(hl)
    regs.exDeHl();
    m.step(0x2920, 4); // ex de,hl
    regs.c = mem.read8(regs.hl);
    m.step(0x2921, 7); // ld c,(hl) -- the byte at the other pointer
    regs.exDeHl();
    m.step(0x2922, 4); // ex de,hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2923, 6); // inc hl
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x2924, 6); // inc de
    if (regs.djnz() !== 0) {
      m.step(0x291e, 13); // djnz taken
      continue;
    }
    m.step(0x2926, 8); // djnz not taken
    break;
  }

  m.ret(10); // 2926
}
