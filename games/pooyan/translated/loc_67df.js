// SPDX-License-Identifier: GPL-3.0-only

// loc_67df  (ROM 0x67df-0x6821) -- checksum gate + screen init. Sum 10 bytes at 0x82bc (stride
// -0x20) into C; if C != 0x5a, tail to loc_67a0. On a match: set 0x8904/0x8808/0x880a=1, clear the
// 9-byte block at 0x8928 (rst 0x10) and the 0x8a80.. block (ld (hl),0 + ldir propagate), then paint
// 0x1d rows of tile 0x10 from 0x8442 (rst 0x10 fill of 0x1d, +0x20 per row). The 0x67e8 sum loop
// and the 0x6818 paint loop are inlined latches (djnz / jr targets), not separate routines.
export function loc_67df(m) {
  const { regs, mem } = m;

  regs.hl = 0x82bc;  m.step(0x67e2, 10);
  regs.de = 0xffe0;  m.step(0x67e5, 10);
  regs.bc = 0x0a00;  m.step(0x67e8, 10);

  for (;;) { // 67e8: checksum accumulate
    regs.a = mem.read8(regs.hl); m.step(0x67e9, 7);
    regs.add(regs.c);            m.step(0x67ea, 4);
    regs.c = regs.a;             m.step(0x67eb, 4);
    regs.addHl(regs.de);         m.step(0x67ec, 11);
    if (regs.djnz() !== 0) { m.step(0x67e8, 13); continue; }
    m.step(0x67ee, 8);
    break;
  }

  regs.a = 0x5a;     m.step(0x67f0, 7);
  regs.cp(regs.c);   m.step(0x67f1, 4);
  if (regs.fNZ) {
    m.step(0x67a0, 12);           // jr nz -- checksum mismatch, tail to loc_67a0
    return m.call(0x67a0);
  }
  m.step(0x67f3, 7);

  regs.a = 0x01;                m.step(0x67f5, 7);
  mem.write8(0x8904, regs.a);   m.step(0x67f8, 13);
  mem.write8(0x8808, regs.a);   m.step(0x67fb, 13);
  mem.write8(0x880a, regs.a);   m.step(0x67fe, 13);
  regs.xor(regs.a);             m.step(0x67ff, 4);
  regs.hl = 0x8928;             m.step(0x6802, 10);
  regs.b = 0x09;                m.step(0x6804, 7);
  m.push16(0x6805);
  m.step(0x0010, 11);           // 6804  rst 0x10 -- fill 9 bytes at 0x8928 with 0
  m.call(0x0010);

  regs.hl = 0x8a80;             m.step(0x6808, 10);
  mem.write8(regs.hl, regs.a);  m.step(0x6809, 7);
  regs.de = 0x8a81;             m.step(0x680c, 10);
  regs.bc = 0x0240;             m.step(0x680f, 10);
  m.ldirAt(0x680f, 0x6811);     // propagate 0 across 0x8a80..0x8cbf

  regs.a = 0x10;                m.step(0x6813, 7);
  regs.hl = 0x8442;             m.step(0x6816, 10);
  regs.c = 0x1d;                m.step(0x6818, 7);

  for (;;) { // 6818: paint 0x1d rows of tile 0x10
    regs.b = 0x1d;              m.step(0x681a, 7);
    m.push16(0x681b);
    m.step(0x0010, 11);         // 681a  rst 0x10 -- fill 0x1d bytes at (hl) with 0x10
    m.call(0x0010);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x681c, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x681d, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x681e, 6);
    regs.c = regs.dec8(regs.c); m.step(0x681f, 4);
    if (regs.fNZ) { m.step(0x6818, 12); continue; }
    m.step(0x6821, 7);
    break;
  }
  m.ret(); // 6821  ret
}
