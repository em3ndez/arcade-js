// SPDX-License-Identifier: GPL-3.0-only

// loc_1563  (ROM 0x1563-0x158B)
export function loc_1563(m) {
  const { regs, mem } = m;

  regs.de = 0xa400;
  m.step(0x1566, 10); // 1563  ld de,0xa400
  regs.hl = 0xa451;
  m.step(0x1569, 10); // 1566  ld hl,0xa451
  regs.bc = 0x0020;
  m.step(0x156c, 10); // 1569  ld bc,0x0020
  regs.exx();
  m.step(0x156d, 4); // 156c  exx -- to the counter set
  regs.b = 0x1c;
  m.step(0x156f, 7); // 156d  ld b,0x1c

  do {
    regs.exx();
    m.step(0x1570, 4); // 156f  exx -- to the working set
    regs.a = mem.read8(regs.de);
    m.step(0x1571, 7); // 1570  ld a,(de)
    mem.write8(regs.hl, regs.a);
    m.step(0x1572, 7); // 1571  ld (hl),a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x1573, 6); // 1572  inc de
    regs.addHl(regs.bc);
    m.step(0x1574, 11); // 1573  add hl,bc -- one row
    regs.exx();
    m.step(0x1575, 4); // 1574  exx -- back to the counter set
    regs.djnz(); // no flags
    m.step(regs.b !== 0 ? 0x156f : 0x1577, regs.b !== 0 ? 13 : 8); // 1575  djnz 0x156f
  } while (regs.b !== 0);

  regs.exx();
  m.step(0x1578, 4); // 1577  exx -- to the working set for good
  regs.hl = 0xa5f0;
  m.step(0x157b, 10); // 1578  ld hl,0xa5f0
  regs.a = mem.read8(regs.de);
  m.step(0x157c, 7); // 157b  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x157d, 7); // 157c  ld (hl),a
  regs.addHl(regs.bc);
  m.step(0x157e, 11); // 157d  add hl,bc
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x157f, 6); // 157e  inc de
  regs.a = mem.read8(regs.de);
  m.step(0x1580, 7); // 157f  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x1581, 7); // 1580  ld (hl),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1582, 6); // 1581  inc de
  regs.hl = 0xa5f2;
  m.step(0x1585, 10); // 1582  ld hl,0xa5f2
  regs.a = mem.read8(regs.de);
  m.step(0x1586, 7); // 1585  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x1587, 7); // 1586  ld (hl),a
  regs.addHl(regs.bc);
  m.step(0x1588, 11); // 1587  add hl,bc
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1589, 6); // 1588  inc de
  regs.a = mem.read8(regs.de);
  m.step(0x158a, 7); // 1589  ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x158b, 7); // 158a  ld (hl),a

  m.ret(10); // 158b  ret
}
