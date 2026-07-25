// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1732  (ROM 0x1732–0x1757) — call 0x306f; if (0x6913)>=0x2C hold; else reset object block, seed 0x6924/2C, advance 0x6388.
 */
export function sub_1732(m) {
  const { regs, mem } = m;
  m.push16(0x1735); m.step(0x306f, 17); m.call(0x306f); // call 0x306f
  regs.a = mem.read8(0x6913);
  m.step(0x1738, 13);
  regs.cp(0x2c);
  m.step(0x173a, 7);
  if (regs.fNC) { m.ret(11); return; } // ret nc -- hold
  m.step(0x173b, 5);
  regs.xor(regs.a);
  m.step(0x173c, 4);
  mem.write8(0x6900, regs.a);
  m.step(0x173f, 13);
  mem.write8(0x6904, regs.a);
  m.step(0x1742, 13);
  mem.write8(0x690c, regs.a);
  m.step(0x1745, 13);
  regs.a = 0x6b;
  m.step(0x1747, 7);
  mem.write8(0x6924, regs.a);
  m.step(0x174a, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x174b, 4); // 0x6B -> 0x6A
  mem.write8(0x692c, regs.a);
  m.step(0x174e, 13);
  regs.hl = 0x6a21;
  m.step(0x1751, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x1752, 11); // inc (0x6A21)
  regs.hl = 0x6388;
  m.step(0x1755, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x1756, 11); // inc (0x6388)
  m.ret(10);
}
