// SPDX-License-Identifier: GPL-3.0-only

// loc_142c  (ROM 0x142c-0x148b) -- spawn/init a child actor at IY from parent IX. Seeds fixed slots
// (iy+0=1, iy+2=4, iy+14=C, iy+7/+0e=0), copies parent position (ix+5/+3 +0x80, ix+4 -1, ix+6 +1),
// clamps (0x8900) to <=7 and indexes speed table 0x148e via rst 0x20, negates it per (0x8907) bit0,
// mirrors that speed into iy/ix+0a and iy+0b, seeds vector 0x38cb and timer 0x28, tail-jumps loc_0ee3.
// The 8-byte speed table lives inline at 0x148e (read by the rst 0x20 lookup, not executed).
export function loc_142c(m) {
  const { regs, mem } = m;

  mem.write8((regs.iy + 0x00) & 0xffff, 0x01);   m.step(0x1430, 19);
  mem.write8((regs.iy + 0x02) & 0xffff, 0x04);   m.step(0x1434, 19);
  mem.write8((regs.iy + 0x14) & 0xffff, regs.c); m.step(0x1437, 19);
  regs.xor(regs.a);                              m.step(0x1438, 4);
  mem.write8((regs.iy + 0x07) & 0xffff, regs.a); m.step(0x143b, 19);
  mem.write8((regs.iy + 0x0e) & 0xffff, regs.a); m.step(0x143e, 19);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x1441, 19);
  regs.add(0x80);                                m.step(0x1443, 7);
  mem.write8((regs.iy + 0x05) & 0xffff, regs.a); m.step(0x1446, 19);
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x1449, 19);
  regs.add(0x80);                                m.step(0x144b, 7);
  mem.write8((regs.iy + 0x03) & 0xffff, regs.a); m.step(0x144e, 19);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x1451, 19);
  regs.sub(0x01);                                m.step(0x1453, 7);
  mem.write8((regs.iy + 0x04) & 0xffff, regs.a); m.step(0x1456, 19);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x1459, 19);
  regs.add(0x01);                                m.step(0x145b, 7);
  mem.write8((regs.iy + 0x06) & 0xffff, regs.a); m.step(0x145e, 19);
  regs.a = mem.read8(0x8900);                    m.step(0x1461, 13);
  regs.cp(0x08);                                 m.step(0x1463, 7);
  if (regs.fC) {
    m.step(0x1467, 12);                          // jr c,0x1467 taken
  } else {
    m.step(0x1465, 7);                           // jr c not taken
    regs.a = 0x07;                               m.step(0x1467, 7); // clamp to 7
  }
  regs.hl = 0x148e;                              m.step(0x146a, 10);
  m.push16(0x146b); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- HL+=A, A=(HL)
  regs.a = mem.read8(0x8907);                    m.step(0x146e, 13);
  regs.and(0x01);                                m.step(0x1470, 7); // Z = facing bit0
  regs.a = mem.read8(regs.hl);                   m.step(0x1471, 7); // reload speed magnitude
  if (regs.fZ) {
    m.step(0x1475, 12);                          // jr z,0x1475 taken -- keep sign
  } else {
    m.step(0x1473, 7);                           // jr z not taken
    regs.neg();                                  m.step(0x1475, 8); // negate for the other facing
  }
  mem.write8((regs.iy + 0x0a) & 0xffff, regs.a); m.step(0x1478, 19);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a); m.step(0x147b, 19);
  regs.de = 0x38cb;                              m.step(0x147e, 10);
  mem.write8((regs.iy + 0x0b) & 0xffff, regs.a); m.step(0x1481, 19);
  mem.write8((regs.iy + 0x0c) & 0xffff, regs.e); m.step(0x1484, 19);
  mem.write8((regs.iy + 0x0d) & 0xffff, regs.d); m.step(0x1487, 19);
  mem.write8((regs.iy + 0x11) & 0xffff, 0x28);   m.step(0x148b, 19);
  m.step(0x0ee3, 10);                            // jp 0x0ee3 (tail)
  return m.call(0x0ee3);
}
