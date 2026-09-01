// SPDX-License-Identifier: GPL-3.0-only
// loc_1581  (ROM 0x1581-0x158f) -- table index: A := B rotated left 3 (RLC x3, i.e. B*8 mod 256)
// plus 3*B plus C, minus 1; store that low byte into L and load the page base 0x2067 into H.
// Returns HL = (0x2067 << 8) | ((B*11 + C - 1) & 0xff), a computed record address.
export function loc_1581(m) {
  const { regs, mem } = m;

  regs.a = regs.b; m.step(0x1582, 5); // 1581  mov a,b
  regs.rlca(); m.step(0x1583, 4); // 1582  rlc
  regs.rlca(); m.step(0x1584, 4); // 1583  rlc
  regs.rlca(); m.step(0x1585, 4); // 1584  rlc
  regs.add(regs.b); m.step(0x1586, 4); // 1585  add b
  regs.add(regs.b); m.step(0x1587, 4); // 1586  add b
  regs.add(regs.b); m.step(0x1588, 4); // 1587  add b
  regs.add(regs.c); m.step(0x1589, 4); // 1588  add c
  regs.a = regs.dec8(regs.a); m.step(0x158a, 5); // 1589  dcr a
  regs.l = regs.a; m.step(0x158b, 5); // 158a  mov l,a
  regs.a = mem.read8(0x2067); m.step(0x158e, 13); // 158b  lda 0x2067
  regs.h = regs.a; m.step(0x158f, 5); // 158e  mov h,a
  return m.ret(10); // 158f  ret
}
