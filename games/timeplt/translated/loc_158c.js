// SPDX-License-Identifier: GPL-3.0-only

// loc_158c  (ROM 0x158C-0x15B4)
export function loc_158c(m) {
  const { regs, mem } = m;

  regs.de = 0xa400;
  m.step(0x158f, 10); // 158c  ld de,0xa400
  regs.hl = 0xa451;
  m.step(0x1592, 10); // 158f  ld hl,0xa451
  regs.bc = 0x0020;
  m.step(0x1595, 10); // 1592  ld bc,0x0020
  regs.exx();
  m.step(0x1596, 4); // 1595  exx -- to the counter set
  regs.b = 0x1c;
  m.step(0x1598, 7); // 1596  ld b,0x1c

  do {
    regs.exx();
    m.step(0x1599, 4); // 1598  exx -- to the working set
    regs.a = mem.read8(regs.hl);
    m.step(0x159a, 7); // 1599  ld a,(hl)
    mem.write8(regs.de, regs.a);
    m.step(0x159b, 7); // 159a  ld (de),a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x159c, 6); // 159b  inc de
    regs.addHl(regs.bc);
    m.step(0x159d, 11); // 159c  add hl,bc -- one row
    regs.exx();
    m.step(0x159e, 4); // 159d  exx -- back to the counter set
    regs.djnz(); // no flags
    m.step(regs.b !== 0 ? 0x1598 : 0x15a0, regs.b !== 0 ? 13 : 8); // 159e  djnz 0x1598
  } while (regs.b !== 0);

  regs.exx();
  m.step(0x15a1, 4); // 15a0  exx -- to the working set for good
  regs.hl = 0xa5f0;
  m.step(0x15a4, 10); // 15a1  ld hl,0xa5f0
  regs.a = mem.read8(regs.hl);
  m.step(0x15a5, 7); // 15a4  ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x15a6, 7); // 15a5  ld (de),a
  regs.addHl(regs.bc);
  m.step(0x15a7, 11); // 15a6  add hl,bc
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x15a8, 6); // 15a7  inc de
  regs.a = mem.read8(regs.hl);
  m.step(0x15a9, 7); // 15a8  ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x15aa, 7); // 15a9  ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x15ab, 6); // 15aa  inc de
  regs.hl = 0xa5f2;
  m.step(0x15ae, 10); // 15ab  ld hl,0xa5f2
  regs.a = mem.read8(regs.hl);
  m.step(0x15af, 7); // 15ae  ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x15b0, 7); // 15af  ld (de),a
  regs.addHl(regs.bc);
  m.step(0x15b1, 11); // 15b0  add hl,bc
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x15b2, 6); // 15b1  inc de
  regs.a = mem.read8(regs.hl);
  m.step(0x15b3, 7); // 15b2  ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x15b4, 7); // 15b3  ld (de),a

  m.ret(10); // 15b4  ret
}
