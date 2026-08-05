// SPDX-License-Identifier: GPL-3.0-only

// loc_1748  (ROM 0x1748-0x1769)
export function loc_1748(m) {
  const { regs, mem } = m;

  m.push16(0x174b);
  m.step(0x0b06, 17); // 1748  call 0x0b06
  m.call(0x0b06);

  m.push16(0x174e);
  m.step(0x0b39, 17); // 174b  call 0x0b39
  m.call(0x0b39);

  regs.hl = 0xa9eb;
  m.step(0x1751, 10); // 174e  ld hl,0xa9eb
  regs.decMem8(mem, regs.hl);
  m.step(0x1752, 11); // 1751  dec (hl)

  if (regs.fNZ) {
    m.ret(11); // 1752  ret nz (taken) -- the countdown has not expired
    return;
  }
  m.step(0x1753, 5); // 1752  ret nz (not taken)

  regs.hl = 0xa63c;
  m.step(0x1756, 10); // 1753  ld hl,0xa63c
  regs.de = 0xacc7;
  m.step(0x1759, 10); // 1756  ld de,0xacc7
  regs.a = mem.read8(regs.hl);
  m.step(0x175a, 7); // 1759  ld a,(hl) -- the glyph
  mem.write8(regs.de, regs.a);
  m.step(0x175b, 7); // 175a  ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x175c, 6); // 175b  inc de
  regs.h = regs.res(2, regs.h); // no flags
  m.step(0x175e, 8); // 175c  res 2,h -- 0xA63C becomes 0xA23C, COLOUR RAM
  regs.a = mem.read8(regs.hl);
  m.step(0x175f, 7); // 175e  ld a,(hl) -- the colour
  mem.write8(regs.de, regs.a);
  m.step(0x1760, 7); // 175f  ld (de),a
  regs.de = 0x0303;
  m.step(0x1763, 10); // 1760  ld de,0x0303

  m.push16(0x1764);
  m.step(0x0038, 11); // 1763  rst 0x38
  m.call(0x0038);

  regs.e = regs.inc8(regs.e);
  m.step(0x1765, 4); // 1764  inc e -- DE becomes 0x0304

  m.push16(0x1766);
  m.step(0x0038, 11); // 1765  rst 0x38
  m.call(0x0038);

  m.step(0x0f1a, 10); // 1766  jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
