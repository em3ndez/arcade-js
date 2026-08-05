// SPDX-License-Identifier: GPL-3.0-only

// loc_58b6  (ROM 0x58B6-0x58BB, Time Pilot)
export function loc_58b6(m) {
  const { regs } = m;

  regs.hl = 0x5e00;
  m.step(0x58b9, 10); // ld hl,0x5e00

  m.step(0x58fe, 10); // jp 0x58fe -- TAIL
  return m.call(0x58fe);
}
