// SPDX-License-Identifier: GPL-3.0-only

// loc_37bd  (ROM 0x37BD–0x37D5, plus the 0x3793–0x379E block it branches back to)
export function loc_37bd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x37be, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x37bf, 4); // and a

  if (regs.fZ) {
    m.step(0x37c4, 12); // jr z,0x37c4 taken
  } else {
    m.step(0x37c1, 7); // jr z not taken
    regs.cp(0x30);
    m.step(0x37c3, 7); // cp 0x30
    if (regs.fNZ) {
      m.ret(11); // ret nz taken -- neither 0x00 nor 0x30
      return;
    }
    m.step(0x37c4, 5); // ret nz not taken
  }

  regs.a = mem.read8(0xad02);
  m.step(0x37c7, 13); // ld a,(0xad02)
  regs.and(regs.a);
  m.step(0x37c8, 4); // and a

  if (regs.fZ) {
    m.step(0x3793, 12); // jr z,0x3793 taken -- backward, to the fixed-count bank

    regs.b = 0x05;
    m.step(0x3795, 7); // ld b,0x05
    regs.ix = 0xa890;
    m.step(0x3799, 14); // ld ix,0xa890
    regs.iy = 0xaa22;
    m.step(0x379d, 14); // ld iy,0xaa22

    m.step(0x37d6, 12); // jr 0x37d6 -- TAIL, nothing pushed
    return m.call(0x37d6);
  }
  m.step(0x37ca, 7); // jr z not taken

  regs.a = mem.read8(0xacc1);
  m.step(0x37cd, 13); // ld a,(0xacc1)
  regs.b = regs.a; // the slot count
  m.step(0x37ce, 4); // ld b,a
  regs.ix = 0xa8b0;
  m.step(0x37d2, 14); // ld ix,0xa8b0
  regs.iy = 0xaa26;
  m.step(0x37d6, 14); // ld iy,0xaa26 -- falls straight into 0x37d6

  return m.call(0x37d6); // TAIL, by fallthrough
}
