// SPDX-License-Identifier: GPL-3.0-only

// loc_12e2  (ROM 0x12E2-0x12FA, Time Pilot)
export function loc_12e2(m) {
  const { regs, mem } = m;

  regs.hl = 0xa9eb;
  m.step(0x12e5, 10); // ld hl,0xa9eb
  regs.decMem8(mem, regs.hl);
  m.step(0x12e6, 11); // dec (hl)
  if (regs.fNZ) {
    m.ret(11); // ret nz -- timer still running
    return;
  }
  m.step(0x12e7, 5); // ret nz not taken

  return m.call(0x12e7);
}
