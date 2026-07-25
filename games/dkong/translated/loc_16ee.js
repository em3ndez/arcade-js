// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_16ee  (ROM 0x16EE–0x1707) — reinit board object block (0x690C=0x66, clear 0x6924/2C/62AF), advance 0x6388.
 */
export function loc_16ee(m) {
  const { regs, mem } = m;
  regs.hl = 0x388c;
  m.step(0x16f1, 10);
  m.push16(0x16f4); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.a = 0x66;
  m.step(0x16f6, 7);
  mem.write8(0x690c, regs.a);
  m.step(0x16f9, 13);
  regs.xor(regs.a);
  m.step(0x16fa, 4);
  mem.write8(0x6924, regs.a);
  m.step(0x16fd, 13);
  mem.write8(0x692c, regs.a);
  m.step(0x1700, 13);
  mem.write8(0x62af, regs.a);
  m.step(0x1703, 13);
  regs.hl = 0x6388;
  m.step(0x1706, 10);
  regs.incMem8(mem, regs.hl);
  m.step(0x1707, 11); // inc (0x6388)
  m.ret(10);
}
