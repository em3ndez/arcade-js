// SPDX-License-Identifier: GPL-3.0-only

// loc_2755  (ROM 0x2755-0x2770, Time Pilot)
export function loc_2755(m) {
  const { regs, mem } = m;

  regs.ix = 0xaa80;
  m.step(0x2759, 14); // 2755  ld ix,0xaa80

  regs.hl = 0x276e;
  m.step(0x275c, 10); // 2759  ld hl,0x276e -- never read again

  regs.a = mem.read8(0x0861); // ROM
  m.step(0x275f, 13); // 275c  ld a,(0x0861)
  regs.e = regs.a;
  m.step(0x2760, 4); // 275f  ld e,a

  regs.a = mem.read8(0x5c01); // ROM
  m.step(0x2763, 13); // 2760  ld a,(0x5c01)
  regs.d = regs.a;
  m.step(0x2764, 4); // 2763  ld d,a -- DE is now the record stride

  regs.b = 0x06;
  m.step(0x2766, 7); // 2764  ld b,0x06

  for (;;) {
    mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
    m.step(0x2769, 19); // 2766  ld (ix+0x00),a

    mem.write8((regs.ix + 0x04) & 0xffff, regs.a);
    m.step(0x276c, 19); // 2769  ld (ix+0x04),a

    regs.addIx(regs.de);
    m.step(0x276e, 15); // 276c  add ix,de

    if (regs.djnz() !== 0) {
      m.step(0x2766, 13); // djnz taken
    } else {
      m.step(0x2770, 8); // djnz not taken
      break;
    }
  }

  m.ret(); // 2770  ret
}
