// SPDX-License-Identifier: GPL-3.0-only
// loc_1804  (ROM 0x1804-0x1814) -- called from 0x084e. Tests the 0x2084/0x2085 pair: if 0x2084
// is zero -> delegate 0x0707; else if 0x2085 is nonzero -> return; else B=1, tail-jump 0x18fa.
export function loc_1804(m) {
  const { regs, mem } = m;

  regs.hl = 0x2084; m.step(0x1807, 10); // 1804  lxi h,0x2084
  regs.a = mem.read8(regs.hl); m.step(0x1808, 7); // 1807  mov a,m
  regs.and(regs.a); m.step(0x1809, 4); // 1808  ana a
  if (regs.fZ) { m.step(0x0707, 10); return m.call(0x0707); } // 1809  jz 0x0707
  m.step(0x180c, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x180d, 5); // 180c  inx h
  regs.a = mem.read8(regs.hl); m.step(0x180e, 7); // 180d  mov a,m
  regs.and(regs.a); m.step(0x180f, 4); // 180e  ana a
  if (regs.fNZ) { return m.ret(11); } m.step(0x1810, 5); // 180f  rnz
  regs.b = 0x01; m.step(0x1812, 7); // 1810  mvi b,0x01
  m.step(0x18fa, 10); return m.call(0x18fa); // 1812  jmp 0x18fa (tail)
}
