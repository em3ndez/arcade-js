// SPDX-License-Identifier: GPL-3.0-only

// loc_596e  (ROM 0x596E–0x598D)
export function loc_596e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x5971, 19); // ld a,(ix+0x02) -- the direction byte
  regs.c = regs.a;
  m.step(0x5972, 4); // ld c,a -- keep the raw value for the second lookup
  regs.add(regs.a);
  m.step(0x5973, 4); // add a,a -- 2*dir, C = bit 7 of dir

  if (regs.fC) {
    m.step(0x5975, 7); // jr nc not taken
    regs.h = regs.inc8(regs.h); // inc h -- carry is preserved, but nothing reads it
    m.step(0x5976, 4); // inc h
  } else {
    m.step(0x5976, 12); // jr nc,0x5976 taken
  }

  regs.add(regs.l);
  m.step(0x5977, 4); // add a,l
  regs.l = regs.a;
  m.step(0x5978, 4); // ld l,a

  if (regs.fC) {
    m.step(0x597a, 7); // jr nc not taken
    regs.h = regs.inc8(regs.h);
    m.step(0x597b, 4); // inc h
  } else {
    m.step(0x597b, 12); // jr nc,0x597b taken
  }

  regs.e = mem.read8(regs.hl);
  m.step(0x597c, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x597d, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x597e, 7); // ld d,(hl) -- DE = table[dir]
  regs.a = regs.c;
  m.step(0x597f, 4); // ld a,c
  regs.add(0xc0);
  m.step(0x5981, 7); // add a,0xc0 -- C set iff dir >= 0x40
  regs.bc = 0x0180;
  m.step(0x5984, 10); // ld bc,0x0180

  if (regs.fC) {
    m.step(0x5986, 7); // jr nc not taken -- dir >= 0x40, step BACK 0x40 entries
    regs.bc = 0xff80;
    m.step(0x5989, 10); // ld bc,0xff80
  } else {
    m.step(0x5989, 12); // jr nc,0x5989 taken -- dir < 0x40, step FORWARD 0xC0 entries
  }

  regs.addHl(regs.bc);
  m.step(0x598a, 11); // add hl,bc
  regs.b = mem.read8(regs.hl);
  m.step(0x598b, 7); // ld b,(hl) -- high byte first
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x598c, 6); // dec hl
  regs.c = mem.read8(regs.hl);
  m.step(0x598d, 7); // ld c,(hl) -- BC = table[(dir - 0x40) & 0xff]

  m.ret(); // 598d
}
