// SPDX-License-Identifier: GPL-3.0-only

// loc_0714  (ROM 0x0714-0x0727) -- one iteration of the sprite-attribute copy loop.
// Copies 2 bytes from (hl) into (ix+1)/(ix+0) and 2 more into (de)+, walking hl by inc l
// (stays in-page) and ix +1. Falls through to loc_0728 (second inc ix + djnz), delegated
// via the seam. m.step targets are the ROM address of the next instruction.
export function loc_0714(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);                 m.step(0x0715, 7);
  mem.write8((regs.ix + 1) & 0xffff, regs.a);  m.step(0x0718, 19);
  regs.l = regs.inc8(regs.l);                  m.step(0x0719, 4);
  regs.a = mem.read8(regs.hl);                 m.step(0x071a, 7);
  mem.write8(regs.ix, regs.a);                 m.step(0x071d, 19);
  regs.l = regs.inc8(regs.l);                  m.step(0x071e, 4);
  regs.a = mem.read8(regs.hl);                 m.step(0x071f, 7);
  mem.write8(regs.de, regs.a);                 m.step(0x0720, 7);
  regs.de = (regs.de + 1) & 0xffff;            m.step(0x0721, 6);
  regs.l = regs.inc8(regs.l);                  m.step(0x0722, 4);
  regs.a = mem.read8(regs.hl);                 m.step(0x0723, 7);
  mem.write8(regs.de, regs.a);                 m.step(0x0724, 7);
  regs.de = (regs.de + 1) & 0xffff;            m.step(0x0725, 6);
  regs.l = regs.inc8(regs.l);                  m.step(0x0726, 4);
  regs.ix = (regs.ix + 1) & 0xffff;            m.step(0x0728, 10);
  return m.call(0x0728);
}
