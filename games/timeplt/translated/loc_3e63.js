// SPDX-License-Identifier: GPL-3.0-only

// loc_3e63  (ROM 0x3E63-0x3E6B, Time Pilot)
export function loc_3e63(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3e66, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x3e67, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken -- inactive
    return;
  }
  m.step(0x3e68, 5); // ret z NOT taken

  regs.a = regs.inc8(regs.a);
  m.step(0x3e69, 4); // inc a -- Z only when the byte was 0xFF
  if (regs.fNZ) {
    m.step(0x3e8e, 10); // jp nz,0x3e8e -- tail-jump
    return m.call(0x3e8e);
  }
  m.step(0x3e6c, 10); // jp nz NOT taken -- fall through into 0x3e6c
  return m.call(0x3e6c);
}
