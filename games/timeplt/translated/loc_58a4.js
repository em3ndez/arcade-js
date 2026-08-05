// SPDX-License-Identifier: GPL-3.0-only

// loc_58a4  (ROM 0x58A4-0x58A9, Time Pilot)
export function loc_58a4(m) {
  const { regs } = m;

  regs.hl = 0x08fa;
  m.step(0x58a7, 10); // ld hl,0x08fa

  m.step(0x58bc, 10); // jp 0x58bc -- TAIL
  return m.call(0x58bc);
}
