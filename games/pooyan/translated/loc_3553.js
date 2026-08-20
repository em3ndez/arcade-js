// SPDX-License-Identifier: GPL-3.0-only

// loc_3553  (ROM 0x3553-0x355a) -- blank the actor's sprite band. A=0, HL=IX (via push ix/pop hl),
// then rst 0x10 (loc_0010) fills B=0x17 bytes at (HL) with A. Tail of loc_3536.
export function loc_3553(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);       m.step(0x3554, 4);
  m.push16(regs.ix);      m.step(0x3556, 15); // 3554  push ix
  regs.hl = m.pop16();    m.step(0x3557, 10); // 3556  pop hl -- HL = IX
  regs.b = 0x17;          m.step(0x3559, 7);
  m.push16(0x355a); m.step(0x0010, 11); m.call(0x0010); // 3559  rst 0x10 (fill 0x17 bytes)
  return m.ret(10);       // 355a  ret
}
