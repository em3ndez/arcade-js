// SPDX-License-Identifier: GPL-3.0-only

// loc_2bb4  (ROM 0x2BB4-0x2BB9, Time Pilot)
export function loc_2bb4(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x00) & 0xffff);
  m.step(0x2bb7, 23); // dec (ix+0x00)

  m.step(0x5840, 10); // jp 0x5840 -- TAIL jump, nothing pushed
  return m.call(0x5840);
}
