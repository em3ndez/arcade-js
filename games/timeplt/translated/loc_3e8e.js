// SPDX-License-Identifier: GPL-3.0-only

// loc_3e8e  (ROM 0x3E8E-0x3EC2, Time Pilot)
export function loc_3e8e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x3e91, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x3e93, 7); // cp 0x04

  if (regs.fZ) {
    m.step(0x3e98, 12); // jr z,0x3e98 taken
  } else {
    m.step(0x3e95, 7); // jr z NOT taken
    m.step(0x40ab, 10); // jp 0x40ab -- TAIL
    return m.call(0x40ab);
  }

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3e9b, 19); // ld a,(ix+0x00)
  regs.cp(0x01);
  m.step(0x3e9d, 7); // cp 0x01

  if (regs.fZ) {
    m.step(0x40ab, 10); // jp z,0x40ab taken -- TAIL
    return m.call(0x40ab);
  }
  m.step(0x3ea0, 10); // jp z NOT taken

  regs.decMem8(mem, (regs.ix + 0x00) & 0xffff);
  m.step(0x3ea3, 23); // dec (ix+0x00) -- does not touch carry

  regs.cp(0x3c);
  m.step(0x3ea5, 7); // cp 0x3c -- against the PRE-decrement value still in A

  if (regs.fNC) {
    m.push16(0x3ea8);
    m.step(0x3ecb, 17); // call nc,0x3ecb taken
    m.call(0x3ecb);
  } else {
    m.step(0x3ea8, 10); // call nc NOT taken
  }

  m.push16(0x3eab);
  m.step(0x2b60, 17); // call 0x2b60
  m.call(0x2b60);

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3eae, 19); // ld a,(ix+0x00) -- reread; 0x2b60 may have moved it
  regs.cp(0x1c);
  m.step(0x3eb0, 7); // cp 0x1c

  if (regs.fC) {
    m.ret(11); // ret c -- below 0x1c, no frame update
    return;
  }
  m.step(0x3eb1, 5); // ret c NOT taken

  regs.sub(0x1c);
  m.step(0x3eb3, 7); // sub 0x1c
  regs.rrca();
  m.step(0x3eb4, 4); // rrca
  regs.rrca();
  m.step(0x3eb5, 4); // rrca
  regs.and(0x07);
  m.step(0x3eb7, 7); // and 0x07 -- index into the 0x3ec3 table
  regs.hl = 0x3ec3;
  m.step(0x3eba, 10); // ld hl,0x3ec3

  m.push16(0x3ebb);
  m.step(0x0008, 11); // rst 0x08 -- A = table[A]
  m.call(0x0008);

  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
  m.step(0x3ebe, 19); // ld (iy+0x01),a -- the sprite code
  mem.write8((regs.iy + 0x30) & 0xffff, 0x03);
  m.step(0x3ec2, 19); // ld (iy+0x30),0x03

  m.ret(); // 3ec2
}
