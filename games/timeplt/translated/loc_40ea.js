// SPDX-License-Identifier: GPL-3.0-only

// loc_40ea  (ROM 0x40EA-0x4107)
export function loc_40ea(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x40ed, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x40ee, 4); // and a
  if (regs.fZ) {
    m.step(0x410b, 10); // jp z,0x410b TAKEN -- TAIL jump into the loop tail
    return m.call(0x410b);
  }
  m.step(0x40f1, 10); // jp z NOT taken

  regs.a = regs.inc8(regs.a); // Z iff (ix+0x00) was 0xFF
  m.step(0x40f2, 4); // inc a
  if (regs.fNZ) {
    m.step(0x4108, 12); // jr nz,0x4108 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x4108);
  }
  m.step(0x40f4, 7); // jr nz NOT taken -- (ix+0x00) was 0xFF

  regs.a = mem.read8(0xad04);
  m.step(0x40f7, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x40f9, 7); // cp 0x04
  if (regs.fZ) {
    m.step(0x4194, 10); // jp z,0x4194 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x4194);
  }
  m.step(0x40fc, 10); // jp z NOT taken

  regs.a = mem.read8((regs.ix + 0x0e) & 0xffff);
  m.step(0x40ff, 19); // ld a,(ix+0x0e)
  regs.and(regs.a);
  m.step(0x4100, 4); // and a
  if (regs.fNZ) {
    m.step(0x418b, 10); // jp nz,0x418b TAKEN -- TAIL jump, nothing pushed
    return m.call(0x418b);
  }
  m.step(0x4103, 10); // jp nz NOT taken

  m.push16(0x4106);
  m.step(0x4117, 17); // call 0x4117
  m.call(0x4117);

  m.step(0x410b, 12); // jr 0x410b -- TAIL jump into the loop tail
  return m.call(0x410b);
}
