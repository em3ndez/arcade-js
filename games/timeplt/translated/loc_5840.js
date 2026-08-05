// SPDX-License-Identifier: GPL-3.0-only

// loc_5840  (ROM 0x5840–0x5845)
export function loc_5840(m) {
  const { regs } = m;

  regs.hl = 0x59d7;
  m.step(0x5843, 10); // ld hl,0x59d7
  m.step(0x58bc, 10); // jp 0x58bc
  return m.call(0x58bc);
}
