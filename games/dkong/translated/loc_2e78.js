// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2e78  (ROM 0x2E78–0x2E81) — advance IX by 0x10 and IY by 0x04; returns to the djnz in entry_2e04.
 */
export function loc_2e78(m) {
  const { regs } = m;
  regs.de = 0x0010;
  m.step(0x2e7b, 10); // ld de,0x0010
  regs.addIx(regs.de);
  m.step(0x2e7d, 15); // add ix,de
  regs.e = 0x04;
  m.step(0x2e7f, 7); // ld e,0x04
  regs.addIy(regs.de);
  m.step(0x2e81, 15); // add iy,de (DE = 0x0004) -- 0x2E81 is the djnz
}
