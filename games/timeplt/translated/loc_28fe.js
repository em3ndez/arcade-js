// SPDX-License-Identifier: GPL-3.0-only

// loc_28fe  (ROM 0x28FE-0x290D, Time Pilot)
export function loc_28fe(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad0d);
  m.step(0x2901, 13); // ld a,(0xad0d)

  regs.and(regs.a);
  m.step(0x2902, 4); // and a -- zero test on A

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- the 0xad0d gate is closed
    return;
  }
  m.step(0x2903, 5); // ret nz not taken

  regs.ix = 0xa8b0;
  m.step(0x2907, 14); // ld ix,0xa8b0

  regs.iy = 0xaa26;
  m.step(0x290b, 14); // ld iy,0xaa26

  m.step(0x290e, 10);
  return m.call(0x290e);
}
