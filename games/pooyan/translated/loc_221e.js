// SPDX-License-Identifier: GPL-3.0-only

// loc_221e  (ROM 0x221e-0x2225) -- object-clear helper: HL <- IY (push iy/pop hl), then blank
// 0x18 tiles at (HL) with A=0 via the fill helper rst 0x10 (loc_0010); ret.
export function loc_221e(m) {
  const { regs } = m;

  m.push16(regs.iy);   m.step(0x2220, 15);
  regs.hl = m.pop16(); m.step(0x2221, 10); // HL = IY
  regs.b = 0x18;       m.step(0x2223, 7);
  regs.xor(regs.a);    m.step(0x2224, 4);
  m.push16(0x2225);
  m.step(0x0010, 11);  // 2224  rst 0x10 (loc_0010) fill B bytes at (HL) = A
  m.call(0x0010);
  return m.ret(10);    // 2225  ret
}
