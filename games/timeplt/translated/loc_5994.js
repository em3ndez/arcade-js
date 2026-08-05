// SPDX-License-Identifier: GPL-3.0-only

// loc_5994  (ROM 0x5994-0x5999, Time Pilot)
export function loc_5994(m) {
  const { regs } = m;

  regs.hl = 0x5c00;
  m.step(0x5997, 10); // ld hl,0x5c00

  m.step(0x599d, 10); // jp 0x599d -- TAIL
  return m.call(0x599d);
}
