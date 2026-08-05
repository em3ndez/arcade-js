// SPDX-License-Identifier: GPL-3.0-only

// loc_1830  (ROM 0x1830-0x1869, Time Pilot)
export function loc_1830(m) {
  const { regs, mem } = m;

  m.push16(0x1833);
  m.step(0x0b06, 17); // call 0x0b06
  m.call(0x0b06);

  m.push16(0x1836);
  m.step(0x0b39, 17); // call 0x0b39
  m.call(0x0b39);

  regs.de = 0x0101;
  m.step(0x1839, 10); // ld de,0x0101

  m.push16(0x183a);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.e = 0x14;
  m.step(0x183c, 7); // ld e,0x14

  m.push16(0x183d);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.e = regs.inc8(regs.e);
  m.step(0x183e, 4); // inc e -- E = 0x15

  m.push16(0x183f);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.e = 0x0f;
  m.step(0x1841, 7); // ld e,0x0f
  regs.a = mem.read8(0xa9c3);
  m.step(0x1844, 13); // ld a,(0xa9c3)
  regs.and(regs.a);
  m.step(0x1845, 4); // and a

  if (regs.fZ) {
    m.step(0x1849, 12); // jr z,0x1849 (taken)
  } else {
    m.step(0x1847, 7); // jr z,0x1849 (not taken)
    regs.e = regs.inc8(regs.e);
    m.step(0x1848, 4); // inc e
    regs.e = regs.inc8(regs.e);
    m.step(0x1849, 4); // inc e -- E = 0x11
  }

  m.push16(0x184a);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.e = regs.inc8(regs.e);
  m.step(0x184b, 4); // inc e

  m.push16(0x184c);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.e = 0x16;
  m.step(0x184e, 7); // ld e,0x16

  m.push16(0x184f);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.e = 0x00;
  m.step(0x1851, 7); // ld e,0x00

  m.push16(0x1852);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.a = mem.read8(0xa986);
  m.step(0x1855, 13); // ld a,(0xa986)
  regs.cp(0x02);
  m.step(0x1857, 7); // cp 0x02

  if (regs.fNC) {
    m.step(0x1860, 12); // jr nc,0x1860 (taken)

    regs.de = 0x0119;
    m.step(0x1863, 10); // ld de,0x0119

    m.push16(0x1864);
    m.step(0x0038, 11); // rst 0x38
    m.call(0x0038);

    m.push16(0x1867);
    m.step(0x0f1a, 17); // call 0x0f1a
    m.call(0x0f1a);

    m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL
    return m.call(0x0f1a);
  }
  m.step(0x1859, 7); // jr nc,0x1860 (not taken)

  regs.de = 0x0117;
  m.step(0x185c, 10); // ld de,0x0117

  m.push16(0x185d);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL
  return m.call(0x0f1a);
}
