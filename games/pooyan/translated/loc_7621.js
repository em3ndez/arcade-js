// SPDX-License-Identifier: GPL-3.0-only
//
// loc_7621  (ROM 0x7621-0x7625) -- entry that seeds B=0x0e then jumps into the shared
// animation-tick walk at 0x7627 (loc_7625 is the twin entry, seeding B=0x08). It delegates to
// 0x7627, not 0x7625, so the jr skips the twin's `ld b,0x08`.
export function loc_7621(m) {
  const { regs } = m;

  regs.b = 0x0e;
  m.step(0x7623, 7); // 7621  ld b,0x0e
  m.step(0x7627, 12); // 7623  jr 0x7627 -- into loc_7627, past loc_7625's ld b
  return m.call(0x7627);
}
