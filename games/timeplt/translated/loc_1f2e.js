// SPDX-License-Identifier: GPL-3.0-only

// loc_1f2e  (ROM 0x1F2E-0x1F3D, Time Pilot)
export function loc_1f2e(m) {
  const { regs } = m;

  m.step(0x1f2f, 4); // nop
  m.step(0x1f30, 4); // nop

  regs.add(regs.b);
  m.step(0x1f31, 4); // add a,b -- the first byte of the table that is not a nop

  m.step(0x1f32, 4); // nop

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- A + B was nonzero
    return;
  }
  m.step(0x1f33, 5); // ret nz not taken

  if (regs.fPO) {
    m.ret(11); // ret po taken
    return;
  }
  m.step(0x1f34, 5); // ret po not taken

  regs.and(regs.b);
  m.step(0x1f35, 4); // and b

  m.step(0x1f36, 4); // nop
  m.step(0x1f37, 4); // ld b,b -- a no-op that does not touch the flags

  if (regs.fNZ) {
    m.step(0x1f99, 12); // jr nz taken
    return m.call(0x1f99);
  }
  m.step(0x1f39, 7); // jr nz not taken

  m.step(0x1f3a, 4); // nop
  m.step(0x1f3b, 4); // nop
  m.step(0x1f3c, 4); // nop
  m.step(0x1f3d, 4); // nop
  m.step(0x1f3e, 4); // nop -- runs out of the table

  return m.call(0x1f3e);
}
