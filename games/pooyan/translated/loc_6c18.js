// SPDX-License-Identifier: GPL-3.0-only

// loc_6c18  (ROM 0x6c18-0x6c3e) -- walk 3 record triples (ix=0x8840, iy=0x887c stride 4,
// hl=0x8be8 stride 0x18), calling loc_6c3f for each. Then clear bits 2,3 of 0x8a87 and zero 0x8d54.
export function loc_6c18(m) {
  const { regs, mem } = m;

  regs.ix = 0x8840;                m.step(0x6c1c, 14);
  regs.iy = 0x887c;                m.step(0x6c20, 14);
  regs.hl = 0x8be8;                m.step(0x6c23, 10);
  regs.b = 0x03;                   m.step(0x6c25, 7);

  for (;;) {
    m.push16(0x6c28);
    m.step(0x6c3f, 17);            // 6c25  call 0x6c3f
    m.call(0x6c3f);

    regs.de = 0x0004;             m.step(0x6c2b, 10);
    regs.addIy(regs.de);          m.step(0x6c2d, 15);
    regs.e = 0x18;                m.step(0x6c2f, 7); // D still 0 -> DE = 0x0018
    regs.addHl(regs.de);          m.step(0x6c30, 11);
    if (regs.djnz()) { m.step(0x6c25, 13); continue; }
    m.step(0x6c32, 8);            // djnz falls out
    break;
  }

  regs.hl = 0x8a87;                                       m.step(0x6c35, 10);
  mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl)));   m.step(0x6c37, 15);
  mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl)));   m.step(0x6c39, 15);
  regs.hl = 0x8d54;                                       m.step(0x6c3c, 10);
  mem.write8(regs.hl, 0x00);                              m.step(0x6c3e, 10);
  m.ret(10);
}
