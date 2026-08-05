// SPDX-License-Identifier: GPL-3.0-only

// loc_176a  (ROM 0x176A-0x178B)
export function loc_176a(m) {
  const { regs, mem } = m;

  m.push16(0x176d);
  m.step(0x19da, 17); // 176a  call 0x19da
  m.call(0x19da);

  regs.a = mem.read8(0xa67c);
  m.step(0x1770, 13); // 176d  ld a,(0xa67c) -- a video-RAM cell
  regs.cp(0x7c);
  m.step(0x1772, 7); // 1770  cp 0x7c

  if (regs.fNZ) {
    m.step(0x459b, 10); // 1772  jp nz,0x459b -- TAIL jump, nothing pushed
    return m.call(0x459b);
  }
  m.step(0x1775, 10); // 1772  jp nz,0x459b (not taken)

  regs.de = 0x0113;
  m.step(0x1778, 10); // 1775  ld de,0x0113

  m.push16(0x1779);
  m.step(0x0038, 11); // 1778  rst 0x38
  m.call(0x0038);

  m.push16(0x177c);
  m.step(0x4bdc, 17); // 1779  call 0x4bdc
  m.call(0x4bdc);

  regs.hl = 0xa5dc;
  m.step(0x177f, 10); // 177c  ld hl,0xa5dc
  regs.de = 0xadfb;
  m.step(0x1782, 10); // 177f  ld de,0xadfb
  regs.a = mem.read8(regs.hl);
  m.step(0x1783, 7); // 1782  ld a,(hl) -- the glyph
  mem.write8(regs.de, regs.a);
  m.step(0x1784, 7); // 1783  ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1785, 6); // 1784  inc de
  regs.h = regs.res(2, regs.h); // no flags
  m.step(0x1787, 8); // 1785  res 2,h -- 0xA5DC becomes 0xA1DC, COLOUR RAM
  regs.a = mem.read8(regs.hl);
  m.step(0x1788, 7); // 1787  ld a,(hl) -- the colour
  mem.write8(regs.de, regs.a);
  m.step(0x1789, 7); // 1788  ld (de),a

  m.step(0x0f1a, 10); // 1789  jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
