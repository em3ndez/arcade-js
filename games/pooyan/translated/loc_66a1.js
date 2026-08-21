// SPDX-License-Identifier: GPL-3.0-only

// loc_66a1  (ROM 0x66a1-0x66be) -- decrement the 0x892b timer; while it is nonzero, ret. On zero:
// reload it 0x08, advance the 0x892c phase, pick the sprite table by its bit 0 (0x66bf even /
// 0x66c2 odd), and run loc_2514 across three records (DE stride -0x18).
export function loc_66a1(m) {
  const { regs, mem } = m;

  regs.hl = 0x892b;            m.step(0x66a4, 10);
  regs.decMem8(mem, regs.hl);  m.step(0x66a5, 11);
  regs.a = mem.read8(regs.hl); m.step(0x66a6, 7);
  regs.and(regs.a);            m.step(0x66a7, 4);
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- timer still live
  m.step(0x66a8, 5);
  mem.write8(regs.hl, 0x08);   m.step(0x66aa, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x66ab, 6); // HL = 0x892c
  regs.incMem8(mem, regs.hl);  m.step(0x66ac, 11);
  regs.bit(0, mem.read8(regs.hl)); m.step(0x66ae, 12);
  regs.hl = 0x66bf;            m.step(0x66b1, 10);
  if (regs.fZ) {
    m.step(0x66b6, 12);
  } else {
    m.step(0x66b3, 7);
    regs.hl = 0x66c2;          m.step(0x66b6, 10);
  }
  regs.de = 0xffe8;            m.step(0x66b9, 10);
  regs.b = 0x03;               m.step(0x66bb, 7);
  m.push16(0x66be); m.step(0x2514, 17); m.call(0x2514);
  return m.ret(10);
}
