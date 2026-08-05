// SPDX-License-Identifier: GPL-3.0-only

// loc_51de  (ROM 0x51DE–0x5204)
export function loc_51de(m) {
  const { regs, mem } = m;

  m.push16(regs.de);
  m.step(0x51df, 11); // push de
  regs.a = mem.read8(0xa99d);
  m.step(0x51e2, 13); // ld a,(0xa99d)
  regs.and(regs.a);
  m.step(0x51e3, 4); // and a

  if (regs.fZ) {
    m.step(0x51fa, 12); // jr z,0x51fa taken

    regs.de = 0x0401;
    m.step(0x51fd, 10); // ld de,0x0401
    m.push16(0x51fe);
    m.step(0x0038, 11); // rst 0x38
    m.call(0x0038);
    regs.de = m.pop16();
    m.step(0x51ff, 10); // pop de
    regs.a = 0x1e;
    m.step(0x5201, 7); // ld a,0x1e
    mem.write8(0xa99d, regs.a);
    m.step(0x5204, 13); // ld (0xa99d),a
    m.ret(); // 0x5204
    return;
  }
  m.step(0x51e5, 7); // jr z not taken

  regs.a = mem.read8(0xa99e);
  m.step(0x51e8, 13); // ld a,(0xa99e)
  regs.a = regs.inc8(regs.a);
  m.step(0x51e9, 4); // inc a
  mem.write8(0xa99e, regs.a);
  m.step(0x51ec, 13); // ld (0xa99e),a
  regs.and(0x07);
  m.step(0x51ee, 7); // and 0x07
  regs.a = regs.inc8(regs.a);
  m.step(0x51ef, 4); // inc a
  regs.e = regs.a;
  m.step(0x51f0, 4); // ld e,a
  regs.d = 0x04;
  m.step(0x51f2, 7); // ld d,0x04

  m.push16(0x51f3);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.de = m.pop16();
  m.step(0x51f4, 10); // pop de
  regs.a = 0x1e;
  m.step(0x51f6, 7); // ld a,0x1e
  mem.write8(0xa99d, regs.a);
  m.step(0x51f9, 13); // ld (0xa99d),a

  m.ret(); // 0x51f9
}
