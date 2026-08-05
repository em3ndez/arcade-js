// SPDX-License-Identifier: GPL-3.0-only

// loc_2bef  (ROM 0x2BEF-0x2C1C)
export function loc_2bef(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x2bf2, 19); // ld a,(ix+0x01)
  regs.sub(mem.read8((regs.ix + 0x02) & 0xffff));
  m.step(0x2bf5, 19); // sub (ix+0x02)
  regs.c = regs.a;
  m.step(0x2bf6, 4); // ld c,a
  regs.add(0x02);
  m.step(0x2bf8, 7); // add a,0x02
  regs.cp(0x04);
  m.step(0x2bfa, 7); // cp 0x04
  if (regs.fC) {
    m.ret(11); // ret c -- difference is -1, 0 or +1
    return;
  }
  m.step(0x2bfb, 5); // ret c not taken

  regs.b = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x2bfe, 19); // ld b,(ix+0x02)
  regs.a = regs.c;
  m.step(0x2bff, 4); // ld a,c
  regs.cp(0x80);
  m.step(0x2c01, 7); // cp 0x80

  if (regs.fNC) {
    m.step(0x2c0f, 12); // jr nc,0x2c0f taken -- turn the negative way
    regs.hl = 0x2c1d;
    m.step(0x2c12, 10); // ld hl,0x2c1d
    regs.a = mem.read8(0xad04);
    m.step(0x2c15, 13); // ld a,(0xad04)

    m.push16(0x2c16);
    m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
    m.call(0x0008);

    regs.sub(regs.b);
    m.step(0x2c17, 4); // sub b
    regs.neg();
    m.step(0x2c19, 8); // neg -- A = B - step
    mem.write8((regs.ix + 0x02) & 0xffff, regs.a);
    m.step(0x2c1c, 19); // ld (ix+0x02),a
    m.ret(10); // 2c1c
    return;
  }
  m.step(0x2c03, 7); // jr nc not taken

  regs.hl = 0x2c1d;
  m.step(0x2c06, 10); // ld hl,0x2c1d
  regs.a = mem.read8(0xad04);
  m.step(0x2c09, 13); // ld a,(0xad04)

  m.push16(0x2c0a);
  m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
  m.call(0x0008);

  regs.add(regs.b);
  m.step(0x2c0b, 4); // add a,b
  mem.write8((regs.ix + 0x02) & 0xffff, regs.a);
  m.step(0x2c0e, 19); // ld (ix+0x02),a
  m.ret(10); // 2c0e
}
