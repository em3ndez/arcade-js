// SPDX-License-Identifier: GPL-3.0-only

// loc_3855  (ROM 0x3855–0x386D)
export function loc_3855(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(regs.hl);
  m.step(0x3856, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x3857, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz -- (hl) non-zero
    return;
  }
  m.step(0x3858, 5); // ret nz NOT taken

  regs.ix = 0xa850;
  m.step(0x385c, 14); // ld ix,0xa850
  regs.de = 0x0010;
  m.step(0x385f, 10); // ld de,0x0010
  regs.b = 0x05;
  m.step(0x3861, 7); // ld b,0x05

  do {
    mem.write8(IX(0x08), 0x11);
    m.step(0x3865, 19); // ld (ix+0x08),0x11
    mem.write8(IX(0x09), 0x00);
    m.step(0x3869, 19); // ld (ix+0x09),0x00
    regs.addIx(regs.de);
    m.step(0x386b, 15); // add ix,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3861 : 0x386d, regs.b !== 0 ? 13 : 8); // djnz 0x3861
  } while (regs.b !== 0);

  m.ret(); // 386d
}
