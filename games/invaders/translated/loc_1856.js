// SPDX-License-Identifier: GPL-3.0-only
// loc_1856  (ROM 0x1856-0x1867) -- read a 4-byte record via BC. A=(BC); if it is the 0xff
// terminator, STC then RZ returns with carry SET. Otherwise HL=(BC),(BC+1) and DE=(BC+2),(BC+3),
// BC advances past all four, ANA A clears carry, return. Carry = "hit terminator". Each m.step
// carries the landing address, so the straight-line flow is traceable without per-line comments.
export function loc_1856(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.bc); m.step(0x1857, 7); // 1856  ldax b
  regs.cp(0xff); m.step(0x1859, 7); // 1857  cpi 0xff
  regs.scf(); m.step(0x185a, 4); // 1859  stc
  if (regs.fZ) { return m.ret(11); } // 185a  rz -> terminator, carry set
  m.step(0x185b, 5);
  regs.l = regs.a; m.step(0x185c, 5); // 185b  mov l,a
  regs.bc = (regs.bc + 1) & 0xffff; m.step(0x185d, 5);
  regs.a = mem.read8(regs.bc); m.step(0x185e, 7); // 185d  ldax b
  regs.h = regs.a; m.step(0x185f, 5); // 185e  mov h,a
  regs.bc = (regs.bc + 1) & 0xffff; m.step(0x1860, 5);
  regs.a = mem.read8(regs.bc); m.step(0x1861, 7); // 1860  ldax b
  regs.e = regs.a; m.step(0x1862, 5); // 1861  mov e,a
  regs.bc = (regs.bc + 1) & 0xffff; m.step(0x1863, 5);
  regs.a = mem.read8(regs.bc); m.step(0x1864, 7); // 1863  ldax b
  regs.d = regs.a; m.step(0x1865, 5); // 1864  mov d,a
  regs.bc = (regs.bc + 1) & 0xffff; m.step(0x1866, 5);
  regs.and(regs.a); m.step(0x1867, 4); // 1866  ana a -> clear carry
  return m.ret(10); // 1867  ret
}
