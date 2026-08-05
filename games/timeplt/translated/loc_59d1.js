// SPDX-License-Identifier: GPL-3.0-only

// loc_59d1  (ROM 0x59D1–0x59D6)
export function loc_59d1(m) {
  const { regs } = m;

  regs.hl = 0x5e00;
  m.step(0x59d4, 10); // ld hl,0x5e00
  m.step(0x59a0, 10); // jp 0x59a0 -- TAIL jump, nothing pushed
  return m.call(0x59a0);
}
