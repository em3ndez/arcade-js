// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0509  (ROM 0x0509–0x0511) — (6227)==4, bit6 clear arm: route on X (0x6203) to loc_04f9 / loc_04e1.
 */
export function loc_0509(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6203);
  m.step(0x050c, 13); // ld a,(0x6203)
  regs.cp(0x80);
  m.step(0x050e, 7); // cp 0x80
  if (regs.fNC) { m.step(0x04f9, 10); return m.call(0x04f9); } // jp nc,0x04f9
  m.step(0x0511, 10); // (6203) < 0x80
  m.step(0x04e1, 10); // jp 0x04e1 (BACKWARD rejoin)
  return m.call(0x04e1);
}
