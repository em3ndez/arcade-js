// SPDX-License-Identifier: GPL-3.0-only

// loc_02b9  (ROM 0x02b9-0x02c8) -- zero-fills RAM regions. A=0; each rst 0x10 is a
// call to the loc_0010 fill helper (ld(hl),a; inc hl; djnz; ret), B bytes at HL.
export function loc_02b9(m) {
  const { regs } = m;

  regs.hl = 0x8840;
  m.step(0x02bc, 10);
  regs.b = 0x60;
  m.step(0x02be, 7);
  regs.xor(regs.a);
  m.step(0x02bf, 4); // xor a -> A=0

  m.push16(0x02c0);
  m.step(0x0010, 11); // rst 0x10 -- fill B(0x60) bytes with A(0)
  m.call(0x0010);

  regs.hl = 0x8a80;
  m.step(0x02c3, 10);

  m.push16(0x02c4);
  m.step(0x0010, 11); // rst 0x10 -- B=0 -> 256 bytes
  m.call(0x0010);

  m.push16(0x02c5);
  m.step(0x0010, 11); // rst 0x10 -- B=0 -> 256 bytes
  m.call(0x0010);

  regs.b = 0x37;
  m.step(0x02c7, 7);

  m.push16(0x02c8);
  m.step(0x0010, 11); // rst 0x10 -- fill 0x37 bytes
  m.call(0x0010);

  return m.ret(); // ret (10 T)
}
