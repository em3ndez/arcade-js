// SPDX-License-Identifier: GPL-3.0-only
// loc_1a06  (ROM 0x1a06-0x1a10) -- object-direction predicate (called from 0x03be/0x05c4/0x06ae):
// XOR bit7 of mem[DE] against the flag byte mem[0x2072]. Differ -> nonzero -> rnz returns early
// with carry CLEAR (ani/xra both cleared it). Match -> zero -> stc, ret with carry SET.
export function loc_1a06(m) {
  const { regs, mem } = m;

  regs.hl = 0x2072; m.step(0x1a09, 10); // 1a06  lxi h,0x2072
  regs.b = mem.read8(regs.hl); m.step(0x1a0a, 7); // 1a09  mov b,m
  regs.a = mem.read8(regs.de); m.step(0x1a0b, 7); // 1a0a  ldax d
  regs.and(0x80); m.step(0x1a0d, 7); // 1a0b  ani 0x80
  regs.xor(regs.b); m.step(0x1a0e, 4); // 1a0d  xra b
  if (regs.fNZ) { return m.ret(11); } // 1a0e  rnz (taken)
  m.step(0x1a0f, 5); // 1a0e  rnz (not taken)
  regs.scf(); m.step(0x1a10, 4); // 1a0f  stc
  return m.ret(10); // 1a10  ret
}
