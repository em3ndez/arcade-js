// SPDX-License-Identifier: GPL-3.0-only
// loc_1590  (ROM 0x1590-0x1596) -- normalize A upward: while A is negative (sign set) keep adding
// 0x10 and bumping C. Called by the scale helper 0x1554 when A starts below range. Returns once
// A has gone non-negative, C holding the number of 0x10 steps applied.
export function loc_1590(m) {
  const { regs } = m;

  for (;;) {
    regs.c = regs.inc8(regs.c); m.step(0x1591, 5); // 1590  inr c
    regs.add(0x10); m.step(0x1593, 7); // 1591  adi 0x10
    if (regs.fM) { m.step(0x1590, 10); continue; } // 1593  jm 0x1590
    m.step(0x1596, 10); break;
  }
  return m.ret(10); // 1596  ret
}
