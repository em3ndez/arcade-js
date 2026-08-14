// SPDX-License-Identifier: GPL-3.0-only

// loc_2b93  (ROM 0x2B93-0x2BAA) — IX sprite-object arm. IX = object struct, IY = sprite slot.
export function loc_2b93(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2b96, 19);
  regs.or(regs.a);
  m.step(0x2b97, 4);
  if (regs.fZ) {
    m.ret(11); // ret z -- object inactive ((ix+0x06)==0)
    return;
  }
  m.step(0x2b98, 5);
  regs.l = mem.read8((regs.ix + 0x0b) & 0xffff);
  m.step(0x2b9b, 19);
  regs.h = 0x80;
  m.step(0x2b9d, 7); // HL = 0x80(ix+0x0b) -- a 0x80xx table entry
  regs.a = mem.read8(regs.hl);
  m.step(0x2b9e, 7);
  regs.sub(mem.read8((regs.ix + 0x02) & 0xffff));
  m.step(0x2ba1, 19);
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
  m.step(0x2ba4, 19);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x2ba7, 19);
  mem.write8((regs.iy + 0x03) & 0xffff, regs.a);
  m.step(0x2baa, 19);
  m.ret();
}
