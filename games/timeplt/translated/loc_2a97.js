// SPDX-License-Identifier: GPL-3.0-only

// loc_2a97  (ROM 0x2A97–0x2ABB)
export function loc_2a97(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(X(0x02));
  m.step(0x2a9a, 19); // ld a,(ix+0x02)
  regs.add(0x04);
  m.step(0x2a9c, 7); // add a,0x04
  regs.and(0xf8);
  m.step(0x2a9e, 7); // and 0xf8
  regs.rrca();
  m.step(0x2a9f, 4); // rrca
  regs.rrca();
  m.step(0x2aa0, 4); // rrca
  regs.and(0x3f); // even index, 0..0x3E
  m.step(0x2aa2, 7); // and 0x3f
  regs.hl = 0x2abc; // table starts right after this routine
  m.step(0x2aa5, 10); // ld hl,0x2abc

  m.push16(0x2aa6);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.b = mem.read8(regs.hl);
  m.step(0x2aa7, 7); // ld b,(hl)
  regs.a = mem.read8(0xa980);
  m.step(0x2aaa, 13); // ld a,(0xa980)
  regs.and(0x02);
  m.step(0x2aac, 7); // and 0x02
  if (regs.fNZ) {
    m.step(0x2ab8, 12); // jr nz,0x2ab8
    regs.a = 0x08; // the bias
    m.step(0x2aba, 7); // ld a,0x08
    m.step(0x2aae, 12); // jr 0x2aae
  } else {
    m.step(0x2aae, 7); // jr nz not taken -- A is 0 here
  }

  regs.add(regs.b);
  m.step(0x2aaf, 4); // add a,b
  mem.write8(Y(0x01), regs.a);
  m.step(0x2ab2, 19); // ld (iy+0x01),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2ab3, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x2ab4, 7); // ld a,(hl)
  mem.write8(Y(0x30), regs.a);
  m.step(0x2ab7, 19); // ld (iy+0x30),a

  m.ret(); // 2ab7
}
