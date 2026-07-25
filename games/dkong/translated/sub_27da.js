// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_27da  (ROM 0x27DA–0x2807) — spawn: if (0x62A7)==0, find a free slot in IX=0x6600[6] (DE=0x10 live-in) and seed it; always dec (0x62A7).
 */
export function sub_27da(m) {
  const { regs, mem } = m;
  regs.hl = 0x62a7;
  m.step(0x27dd, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x27de, 7);
  regs.and(regs.a);
  m.step(0x27df, 4);
  if (regs.fNZ) { m.step(0x2806, 10); return m.call(0x2806); } // jp nz -> just decrement
  m.step(0x27e2, 10);
  regs.b = 0x06;
  m.step(0x27e4, 7);
  regs.ix = 0x6600;
  m.step(0x27e8, 14);
  for (;;) {
    if (!regs.bit(0, mem.read8((regs.ix + 0) & 0xffff))) { m.step(0x27f4, 30); break; } // free slot
    m.step(0x27ef, 20);
    regs.ix = (regs.ix + regs.de) & 0xffff;
    m.step(0x27f1, 15); // add ix,de
    regs.djnz();
    m.step(regs.b ? 0x27e8 : 0x27f3, regs.b ? 13 : 8);
    if (regs.b === 0) { m.ret(10); return; } // no free slot
  }
  mem.write8((regs.ix + 0) & 0xffff, 0x01);
  m.step(0x27f8, 19);
  mem.write8((regs.ix + 3) & 0xffff, 0x37);
  m.step(0x27fc, 19);
  mem.write8((regs.ix + 5) & 0xffff, 0xf8);
  m.step(0x2800, 19);
  mem.write8((regs.ix + 0x0d) & 0xffff, 0x08);
  m.step(0x2804, 19);
  mem.write8(regs.hl, 0x34);
  m.step(0x2806, 10); // (0x62A7) = 0x34
  return m.call(0x2806);
}
