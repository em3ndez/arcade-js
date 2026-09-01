// SPDX-License-Identifier: GPL-3.0-only
// loc_1554  (ROM 0x1554-0x1561) -- scale helper: count in C how many 0x10 steps A takes to
// reach/pass H (CMP H drives it). Pre-normalizes a too-small A via `cnc 0x1590`, then loops at
// 0x155a (interior) adding 0x10 and bumping C until A >= H (rnc). Returns C = the step count.
export function loc_1554(m) {
  const { regs } = m;

  regs.c = 0x00; m.step(0x1556, 7); // 1554  mvi c,0x00
  regs.cp(regs.h); m.step(0x1557, 4); // 1556  cmp h
  if (regs.fNC) { m.push16(0x155a); m.step(0x1590, 17); m.call(0x1590); } // 1557  cnc 0x1590
  else { m.step(0x155a, 11); }

  for (;;) { // loc_155a
    regs.cp(regs.h); m.step(0x155b, 4); // 155a  cmp h
    if (regs.fNC) { return m.ret(11); } // 155b  rnc
    m.step(0x155c, 5);
    regs.add(0x10); m.step(0x155e, 7); // 155c  adi 0x10
    regs.c = regs.inc8(regs.c); m.step(0x155f, 5); // 155e  inr c
    m.step(0x155a, 10); // 155f  jmp 0x155a
  }
}
