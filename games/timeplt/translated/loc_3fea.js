// SPDX-License-Identifier: GPL-3.0-only

// loc_3fea  (ROM 0x3FEA–0x4007)
export function loc_3fea(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x3fed, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x3fee, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x3fef, 5); // ret nz NOT taken

  regs.ix = 0xa8c0;
  m.step(0x3ff3, 14); // ld ix,0xa8c0
  regs.iy = 0xaa28;
  m.step(0x3ff7, 14); // ld iy,0xaa28
  regs.b = 0x03;
  m.step(0x3ff9, 7); // ld b,0x03

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3ffc, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x3ffd, 4); // and a
  if (regs.fZ) {
    m.step(0x400b, 10); // jp z,0x400b TAKEN -- TAIL jump into the loop tail
    return m.call(0x400b);
  }
  m.step(0x4000, 10); // jp z NOT taken

  regs.a = regs.inc8(regs.a); // inc a -- Z iff (ix+0x00) was 0xFF
  m.step(0x4001, 4); // inc a
  if (regs.fNZ) {
    m.step(0x4008, 12); // jr nz,0x4008 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x4008);
  }
  m.step(0x4003, 7); // jr nz NOT taken -- (ix+0x00) was 0xFF

  m.push16(0x4006);
  m.step(0x4017, 17); // call 0x4017
  m.call(0x4017);

  m.step(0x400b, 12); // jr 0x400b -- TAIL jump into the loop tail
  return m.call(0x400b);
}
