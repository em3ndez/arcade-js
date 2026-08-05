// SPDX-License-Identifier: GPL-3.0-only

// loc_59c5  (ROM 0x59C5-0x59CA, Time Pilot)
export function loc_59c5(m) {
  const { regs } = m;

  regs.hl = 0x59d7;
  m.step(0x59c8, 10); // ld hl,0x59d7

  m.step(0x59a0, 10); // jp 0x59a0 -- tail-jump; its ret returns to OUR caller
  return m.call(0x59a0);
}
