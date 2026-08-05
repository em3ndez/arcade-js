// SPDX-License-Identifier: GPL-3.0-only

// loc_3156  (ROM 0x3156-0x315A, Time Pilot)
export function loc_3156(m) {
  const { regs } = m;

  regs.a = 0x28;
  m.step(0x3158, 7); // ld a,0x28 -- the fill byte for the 0xAA60 stride-2 run

  m.step(0x30d1, 10); // jp 0x30d1 -- TAIL into 0x30D1, which owns that body
  return m.call(0x30d1);
}
