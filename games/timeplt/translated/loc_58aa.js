// SPDX-License-Identifier: GPL-3.0-only

// loc_58aa  (ROM 0x58AA–0x58AF)
export function loc_58aa(m) {
  const { regs } = m;

  regs.hl = 0x59d7;
  m.step(0x58ad, 10); // ld hl,0x59d7

  m.step(0x58fe, 10); // jp 0x58fe -- TAIL
  return m.call(0x58fe);
}
