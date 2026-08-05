// SPDX-License-Identifier: GPL-3.0-only

// loc_4831  (ROM 0x4831-0x484E, Time Pilot)
export function loc_4831(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.decMem8(mem, X(0x00));
  m.step(0x4834, 23); // dec (ix+0x00)
  regs.a = mem.read8(X(0x07));
  m.step(0x4837, 19); // ld a,(ix+0x07) -- read before the increment
  regs.incMem8(mem, X(0x07));
  m.step(0x483a, 23); // inc (ix+0x07)
  regs.cp(0x04);
  m.step(0x483c, 7); // cp 0x04 -- the table has four entries

  if (regs.fNC) {
    m.step(0x4849, 10); // jp nc,0x4849 taken -- past the end of the table

    regs.de = 0x040f;
    m.step(0x484c, 10); // ld de,0x040f

    m.step(0x0038, 10); // jp 0x0038 -- TAIL
    return m.call(0x0038);
  }
  m.step(0x483f, 10); // jp nc NOT taken

  regs.hl = 0x484f;
  m.step(0x4842, 10); // ld hl,0x484f -- the table, inline after this routine

  m.push16(0x4843);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.e = mem.read8(regs.hl);
  m.step(0x4844, 7); // ld e,(hl)
  regs.d = 0x04;
  m.step(0x4846, 7); // ld d,0x04

  m.step(0x0038, 10); // jp 0x0038 -- TAIL
  return m.call(0x0038);
}
