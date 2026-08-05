// SPDX-License-Identifier: GPL-3.0-only

// loc_5854  (ROM 0x5854–0x5859)
export function loc_5854(m) {
  const { regs } = m;

  regs.hl = 0x5e00;
  m.step(0x5857, 10); // ld hl,0x5e00

  m.step(0x58bc, 10); // jp 0x58bc -- TAIL
  return m.call(0x58bc);
}
