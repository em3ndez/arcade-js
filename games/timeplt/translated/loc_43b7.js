// SPDX-License-Identifier: GPL-3.0-only

// loc_43b7  (ROM 0x43B7–0x43E7)
export function loc_43b7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xacc6);
  m.step(0x43ba, 13); // ld a,(0xacc6)
  regs.a = regs.inc8(regs.a);
  m.step(0x43bb, 4); // inc a
  if (regs.fZ) {
    m.ret(11); // 0x43bb ret z -- taken
    return;
  }
  m.step(0x43bc, 5); // ret z not taken

  regs.a = mem.read8(0xad0d);
  m.step(0x43bf, 13); // ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x43c0, 4); // and a
  if (regs.fNZ) {
    m.step(0x43f0, 12); // jr nz,0x43f0 taken -- TAIL transfer
    return m.call(0x43f0);
  }
  m.step(0x43c2, 7); // jr nz not taken

  regs.a = mem.read8(0xa980);
  m.step(0x43c5, 13); // ld a,(0xa980)
  regs.and(0x07);
  m.step(0x43c7, 7); // and 0x07
  regs.cp(0x05);
  m.step(0x43c9, 7); // cp 0x05
  if (regs.fNZ) {
    m.ret(11); // 0x43c9 ret nz -- taken
    return;
  }
  m.step(0x43ca, 5); // ret nz not taken

  regs.ix = 0xa8a0;
  m.step(0x43ce, 14); // ld ix,0xa8a0
  regs.iy = 0xaa24;
  m.step(0x43d2, 14); // ld iy,0xaa24
  regs.a = mem.read8(0xad02);
  m.step(0x43d5, 13); // ld a,(0xad02)
  regs.or(mem.read8((regs.ix + 0x00) & 0xffff));
  m.step(0x43d8, 19); // or (ix+0x00)
  regs.or(mem.read8((regs.ix + 0x10) & 0xffff));
  m.step(0x43db, 19); // or (ix+0x10)
  if (regs.fNZ) {
    m.ret(11); // 0x43db ret nz -- taken
    return;
  }
  m.step(0x43dc, 5); // ret nz not taken

  regs.a = 0xff;
  m.step(0x43de, 7); // ld a,0xff
  mem.write8(0xad0d, regs.a);
  m.step(0x43e1, 13); // ld (0xad0d),a
  mem.write8((regs.ix + 0x04) & 0xffff, 0x07);
  m.step(0x43e5, 19); // ld (ix+0x04),0x07

  m.step(0x46db, 10); // jp 0x46db -- TAIL transfer
  return m.call(0x46db);
}
