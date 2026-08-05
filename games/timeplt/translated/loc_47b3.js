// SPDX-License-Identifier: GPL-3.0-only

// loc_47b3  (ROM 0x47B3–0x4808)
export function loc_47b3(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xad04);
  m.step(0x47b6, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x47b8, 7); // cp 0x04
  if (regs.fZ) {
    m.step(m.pop16(), 11); // ret z
    return;
  }
  m.step(0x47b9, 5);

  regs.ix = 0xa8f0;
  m.step(0x47bd, 14); // ld ix,0xa8f0
  regs.iy = 0xaa2e;
  m.step(0x47c1, 14); // ld iy,0xaa2e
  regs.a = mem.read8(X(0x00));
  m.step(0x47c4, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x47c5, 4); // and a
  if (regs.fZ) {
    m.step(0x4853, 10); // jp z,0x4853
    return m.call(0x4853);
  }
  m.step(0x47c8, 10);

  regs.a = regs.inc8(regs.a); // a test for 0xFF; the value is discarded
  m.step(0x47c9, 4); // inc a
  if (regs.fNZ) {
    m.step(0x47f2, 10); // jp nz,0x47f2 -- (ix+0x00) is neither 0 nor 0xFF

    m.push16(0x47f5);
    m.step(0x2b60, 17); // call 0x2b60
    m.call(0x2b60);

    regs.a = mem.read8(X(0x00));
    m.step(0x47f8, 19); // ld a,(ix+0x00)
    regs.cp(0x10);
    m.step(0x47fa, 7); // cp 0x10
    if (regs.fZ) {
      m.step(0x4831, 10); // jp z,0x4831
      return m.call(0x4831);
    }
    m.step(0x47fd, 10);
    regs.cp(0x3c);
    m.step(0x47ff, 7); // cp 0x3c
    if (regs.fNC) {
      m.step(0x4809, 10); // jp nc,0x4809
      return m.call(0x4809);
    }
    m.step(0x4802, 10);
    regs.decMem8(mem, X(0x00));
    m.step(0x4805, 23); // dec (ix+0x00)
    if (regs.fNZ) {
      m.step(m.pop16(), 11); // ret nz -- still counting
      return;
    }
    m.step(0x4806, 5);
    m.step(0x48ad, 10); // jp 0x48ad
    return m.call(0x48ad);
  }
  m.step(0x47cc, 10);

  m.push16(0x47cf);
  m.step(0x3e05, 17); // call 0x3e05
  m.call(0x3e05);

  m.push16(0x47d2);
  m.step(0x2b83, 17); // call 0x2b83
  m.call(0x2b83);

  if (regs.fC) {
    m.step(0x48ad, 10); // jp c,0x48ad
    return m.call(0x48ad);
  }
  m.step(0x47d5, 10);

  regs.a = mem.read8(0xa980);
  m.step(0x47d8, 13); // ld a,(0xa980)
  regs.rrca();
  m.step(0x47d9, 4); // rrca
  regs.rrca();
  m.step(0x47da, 4); // rrca
  regs.rrca();
  m.step(0x47db, 4); // rrca
  regs.rrca();
  m.step(0x47dc, 4); // rrca
  regs.and(0x07); // eight entries
  m.step(0x47de, 7); // and 0x07
  regs.hl = 0x47ea; // the table between the ret and 0x47F2
  m.step(0x47e1, 10); // ld hl,0x47ea

  m.push16(0x47e2);
  m.step(0x0008, 11); // rst 0x08 -- HL += A, A = (HL)
  m.call(0x0008);

  mem.write8(Y(0x01), regs.a);
  m.step(0x47e5, 19); // ld (iy+0x01),a
  mem.write8(Y(0x30), 0x75);
  m.step(0x47e9, 19); // ld (iy+0x30),0x75

  m.ret(); // 47e9
}
