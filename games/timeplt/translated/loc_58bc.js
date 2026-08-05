// SPDX-License-Identifier: GPL-3.0-only

// loc_58bc  (ROM 0x58BC-0x58FD, Time Pilot)
export function loc_58bc(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(IX(0x02));
  m.step(0x58bf, 19); // ld a,(ix+0x02) -- the angle
  regs.c = regs.a;
  m.step(0x58c0, 4); // ld c,a -- keep it for the second lookup
  regs.add(regs.a);
  m.step(0x58c1, 4); // add a,a -- two bytes per entry

  if (regs.fNC) {
    m.step(0x58c4, 12); // jr nc,0x58c4 taken
  } else {
    m.step(0x58c3, 7); // jr nc NOT taken
    regs.h = regs.inc8(regs.h);
    m.step(0x58c4, 4); // inc h
  }

  regs.add(regs.l);
  m.step(0x58c5, 4); // add a,l
  regs.l = regs.a;
  m.step(0x58c6, 4); // ld l,a

  if (regs.fNC) {
    m.step(0x58c9, 12); // jr nc,0x58c9 taken
  } else {
    m.step(0x58c8, 7); // jr nc NOT taken
    regs.h = regs.inc8(regs.h);
    m.step(0x58c9, 4); // inc h
  }

  regs.e = mem.read8(regs.hl);
  m.step(0x58ca, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x58cb, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x58cc, 7); // ld d,(hl) -- DE = the first component
  regs.a = regs.c;
  m.step(0x58cd, 4); // ld a,c
  regs.add(0xc0);
  m.step(0x58cf, 7); // add a,0xc0 -- the perpendicular angle
  regs.bc = 0x0180;
  m.step(0x58d2, 10); // ld bc,0x0180 -- flag-neutral, the add's carry survives

  if (regs.fNC) {
    m.step(0x58d7, 12); // jr nc,0x58d7 taken
  } else {
    m.step(0x58d4, 7); // jr nc NOT taken
    regs.bc = 0xff80;
    m.step(0x58d7, 10); // ld bc,0xff80 -- the angle wrapped
  }

  regs.addHl(regs.bc);
  m.step(0x58d8, 11); // add hl,bc
  regs.b = mem.read8(regs.hl);
  m.step(0x58d9, 7); // ld b,(hl)
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x58da, 6); // dec hl
  regs.c = mem.read8(regs.hl);
  m.step(0x58db, 7); // ld c,(hl) -- BC = the second component

  regs.hl = mem.read16(0xa808);
  m.step(0x58de, 16); // ld hl,(0xa808)
  regs.addHl(regs.de);
  m.step(0x58df, 11); // add hl,de
  regs.e = mem.read8(IX(0x03));
  m.step(0x58e2, 19); // ld e,(ix+0x03) -- fraction
  regs.d = mem.read8(IY(0x31));
  m.step(0x58e5, 19); // ld d,(iy+0x31) -- whole part
  regs.addHl(regs.de);
  m.step(0x58e6, 11); // add hl,de
  mem.write8(IX(0x03), regs.l);
  m.step(0x58e9, 19); // ld (ix+0x03),l
  mem.write8(IY(0x31), regs.h);
  m.step(0x58ec, 19); // ld (iy+0x31),h

  regs.hl = mem.read16(0xa80a);
  m.step(0x58ef, 16); // ld hl,(0xa80a)
  regs.addHl(regs.bc);
  m.step(0x58f0, 11); // add hl,bc
  regs.e = mem.read8(IX(0x05));
  m.step(0x58f3, 19); // ld e,(ix+0x05) -- fraction
  regs.d = mem.read8(IY(0x00));
  m.step(0x58f6, 19); // ld d,(iy+0x00) -- whole part
  regs.addHl(regs.de);
  m.step(0x58f7, 11); // add hl,de
  mem.write8(IX(0x05), regs.l);
  m.step(0x58fa, 19); // ld (ix+0x05),l
  mem.write8(IY(0x00), regs.h);
  m.step(0x58fd, 19); // ld (iy+0x00),h

  m.ret(); // 58fd  ret
}
