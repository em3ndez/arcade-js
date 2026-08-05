// SPDX-License-Identifier: GPL-3.0-only

// loc_07ad  (ROM 0x07AD-0x07B0, Time Pilot)
export function loc_07ad(m) {
  const { regs } = m;

  regs.b = regs.a;
  m.step(0x07ae, 4); // ld b,a -- no flags

  m.step(0x5303, 10); // jp 0x5303
  return m.call(0x5303);
}
