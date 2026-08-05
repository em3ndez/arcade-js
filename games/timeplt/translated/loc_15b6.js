// SPDX-License-Identifier: GPL-3.0-only

// loc_15b6  (ROM 0x15b6-0x15c1, Time Pilot)
export function loc_15b6(m) {
  const { regs, mem } = m;

  regs.hl = 0xaa41;
  m.step(0x15b9, 10); // 15b6  ld hl,0xaa41
  regs.b = 0x18;
  m.step(0x15bb, 7); // 15b9  ld b,0x18
  regs.xor(regs.a);
  m.step(0x15bc, 4); // 15bb  xor a -- the fill value

  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x15bd, 7); // 15bc  ld (hl),a

    regs.l = regs.inc8(regs.l);
    m.step(0x15be, 4); // 15bd  inc l -- low byte only

    regs.l = regs.inc8(regs.l);
    m.step(0x15bf, 4); // 15be  inc l

    if (regs.djnz() !== 0) {
      m.step(0x15bc, 13); // djnz taken
    } else {
      m.step(0x15c1, 8); // djnz not taken
      break;
    }
  }

  m.ret(); // 15c1  ret
}
