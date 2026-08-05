// SPDX-License-Identifier: GPL-3.0-only

// loc_379f  (ROM 0x379F-0x37D5)
export function loc_379f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x37a0, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x37a1, 4); // and a
  if (regs.fZ) {
    m.step(0x37a6, 12); // jr z,0x37a6 TAKEN
  } else {
    m.step(0x37a3, 7); // jr z NOT taken
    regs.cp(0x30);
    m.step(0x37a5, 7); // cp 0x30
    if (regs.fNZ) {
      m.ret(11); // ret nz -- neither 0x00 nor 0x30
      return;
    }
    m.step(0x37a6, 5); // ret nz NOT taken
  }

  regs.hl = 0xa850;
  m.step(0x37a9, 10); // ld hl,0xa850
  regs.de = 0x0010;
  m.step(0x37ac, 10); // ld de,0x0010
  regs.bc = 0x0700;
  m.step(0x37af, 10); // ld bc,0x0700

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x37b0, 7); // ld a,(hl)
    regs.and(regs.a);
    m.step(0x37b1, 4); // and a
    if (regs.fZ) {
      m.step(0x37b4, 12); // jr z,0x37b4 TAKEN -- slot free, not counted
    } else {
      m.step(0x37b3, 7); // jr z NOT taken
      regs.c = regs.inc8(regs.c);
      m.step(0x37b4, 4); // inc c
    }
    regs.addHl(regs.de);
    m.step(0x37b5, 11); // add hl,de
    if (regs.djnz() !== 0) {
      m.step(0x37af, 13); // djnz 0x37af taken
      continue;
    }
    m.step(0x37b7, 8); // djnz NOT taken
    break;
  }

  regs.a = regs.c;
  m.step(0x37b8, 4); // ld a,c -- occupied count
  regs.cp(0x02);
  m.step(0x37ba, 7); // cp 0x02
  if (regs.fNC) {
    m.ret(11); // ret nc -- two or more already busy
    return;
  }
  m.step(0x37bb, 5); // ret nc NOT taken

  m.step(0x37c4, 12); // jr 0x37c4 -- over the 0x37BD twin preamble

  regs.a = mem.read8(0xad02);
  m.step(0x37c7, 13); // ld a,(0xad02)
  regs.and(regs.a);
  m.step(0x37c8, 4); // and a
  if (regs.fZ) {
    m.step(0x3793, 12); // jr z,0x3793 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x3793);
  }
  m.step(0x37ca, 7); // jr z NOT taken

  regs.a = mem.read8(0xacc1);
  m.step(0x37cd, 13); // ld a,(0xacc1)
  regs.b = regs.a;
  m.step(0x37ce, 4); // ld b,a
  regs.ix = 0xa8b0;
  m.step(0x37d2, 14); // ld ix,0xa8b0
  regs.iy = 0xaa26;
  m.step(0x37d6, 14); // ld iy,0xaa26

  return m.call(0x37d6);
}
