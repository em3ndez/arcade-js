// SPDX-License-Identifier: GPL-3.0-only

// loc_58fe  (ROM 0x58FE-0x5941, Time Pilot)
export function loc_58fe(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x5901, 19); // ld a,(ix+0x02) -- the heading

  regs.c = regs.a;
  m.step(0x5902, 4); // ld c,a -- kept for the quarter-turn test below

  regs.add(regs.a);
  m.step(0x5903, 4); // add a,a -- 2*heading

  if (regs.fNC) {
    m.step(0x5906, 12); // jr nc,0x5906 taken
  } else {
    m.step(0x5905, 7); // jr nc not taken
    regs.h = regs.inc8(regs.h);
    m.step(0x5906, 4); // inc h -- the doubling carry into the high byte
  }

  regs.add(regs.l);
  m.step(0x5907, 4); // add a,l

  regs.l = regs.a; // flag-neutral; the carry below is `add a,l`'s
  m.step(0x5908, 4); // ld l,a

  if (regs.fNC) {
    m.step(0x590b, 12); // jr nc,0x590b taken
  } else {
    m.step(0x590a, 7); // jr nc not taken
    regs.h = regs.inc8(regs.h);
    m.step(0x590b, 4); // inc h
  }

  regs.e = mem.read8(regs.hl);
  m.step(0x590c, 7); // ld e,(hl)

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x590d, 6); // inc hl

  regs.d = mem.read8(regs.hl);
  m.step(0x590e, 7); // ld d,(hl) -- DE = T[heading]; HL is left on the high byte

  regs.a = regs.c;
  m.step(0x590f, 4); // ld a,c

  regs.add(0xc0);
  m.step(0x5911, 7); // add a,0xc0 -- C set iff heading >= 0x40

  regs.bc = 0x0180;
  m.step(0x5914, 10); // ld bc,0x0180 -- flag-neutral, so the carry above survives

  if (regs.fNC) {
    m.step(0x5919, 12); // jr nc,0x5919 taken -- keeps BC = 0x0180, +0xC0 entries
  } else {
    m.step(0x5916, 7); // jr nc not taken
    regs.bc = 0xff80;
    m.step(0x5919, 10); // ld bc,0xff80 -- the same entry, reached backwards
  }

  regs.addHl(regs.bc);
  m.step(0x591a, 11); // add hl,bc

  regs.b = mem.read8(regs.hl);
  m.step(0x591b, 7); // ld b,(hl) -- high byte first

  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x591c, 6); // dec hl

  regs.c = mem.read8(regs.hl);
  m.step(0x591d, 7); // ld c,(hl) -- BC = T[(heading-0x40) & 0xff]

  regs.hl = mem.read16(0xa808);
  m.step(0x5920, 16); // ld hl,(0xa808)

  regs.addHl(regs.de);
  m.step(0x5921, 11); // add hl,de

  regs.addHl(regs.de);
  m.step(0x5922, 11); // add hl,de -- 2 * the DE term

  regs.e = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x5925, 19); // ld e,(ix+0x03)

  regs.d = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x5928, 19); // ld d,(iy+0x31) -- DE = (ix+0x03) low, (iy+0x31) high

  regs.addHl(regs.de);
  m.step(0x5929, 11); // add hl,de

  mem.write8((regs.ix + 0x03) & 0xffff, regs.l);
  m.step(0x592c, 19); // ld (ix+0x03),l

  mem.write8((regs.iy + 0x31) & 0xffff, regs.h);
  m.step(0x592f, 19); // ld (iy+0x31),h

  regs.hl = mem.read16(0xa80a);
  m.step(0x5932, 16); // ld hl,(0xa80a)

  regs.addHl(regs.bc);
  m.step(0x5933, 11); // add hl,bc

  regs.addHl(regs.bc);
  m.step(0x5934, 11); // add hl,bc -- 2 * the BC term

  regs.e = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x5937, 19); // ld e,(ix+0x05)

  regs.d = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x593a, 19); // ld d,(iy+0x00) -- DE = (ix+0x05) low, (iy+0x00) high

  regs.addHl(regs.de);
  m.step(0x593b, 11); // add hl,de

  mem.write8((regs.ix + 0x05) & 0xffff, regs.l);
  m.step(0x593e, 19); // ld (ix+0x05),l

  mem.write8((regs.iy + 0x00) & 0xffff, regs.h);
  m.step(0x5941, 19); // ld (iy+0x00),h

  m.ret(); // 5941  ret
}
