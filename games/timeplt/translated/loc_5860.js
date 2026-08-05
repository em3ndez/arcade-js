// SPDX-License-Identifier: GPL-3.0-only

// loc_5860  (ROM 0x5860-0x5865, Time Pilot)
export function loc_5860(m) {
  const { regs } = m;

  regs.hl = 0x2e3e;
  m.step(0x5863, 10); // ld hl,0x2e3e

  m.step(0x58bc, 10); // jp 0x58bc -- TAIL
  return m.call(0x58bc);
}
