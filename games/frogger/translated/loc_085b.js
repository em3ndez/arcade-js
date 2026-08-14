// SPDX-License-Identifier: GPL-3.0-only

// loc_085b  (ROM 0x085B-0x086F) — "no more frogs" tail: blit a 4-tile strip (rst 0x28 from 0x2F6E)
// then a 5-tile strip (rst 0x28 from 0x2F12) up the column starting at 0xAA51, then set (0x8004)=1.
// PURE LEAF apart from rst 0x28. Sole caller: loc_0870 (jp z,0x085b).
export function loc_085b(m) {
  const { regs, mem } = m;

  regs.hl = 0xaa51;
  m.step(0x085e, 10);
  regs.de = 0x2f6e;
  m.step(0x0861, 10);
  regs.b = 0x04;
  m.step(0x0863, 7);
  m.push16(0x0864);
  m.step(0x0028, 11); // rst 0x28 -- blit 4 tiles up the column
  m.call(0x0028);

  regs.de = 0x2f12;
  m.step(0x0867, 10);
  regs.b = 0x05;
  m.step(0x0869, 7);
  m.push16(0x086a);
  m.step(0x0028, 11); // rst 0x28 -- blit 5 more tiles; HL continues from the first strip
  m.call(0x0028);

  regs.a = 0x01;
  m.step(0x086c, 7);
  mem.write8(0x8004, regs.a);
  m.step(0x086f, 13); // (0x8004) = 1
  m.ret();
}
