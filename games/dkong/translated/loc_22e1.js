// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_22e1  (ROM 0x22E1–0x22F3) — mode 0: pick A from (0x6229): 1 -> 0x01, 2 -> 0xB1, else 0xE9; jp loc_22f9.
 */
export function loc_22e1(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6229);
  m.step(0x22e4, 13); // ld a,(0x6229)
  regs.b = regs.a;
  m.step(0x22e5, 4); // ld b,a
  regs.b = regs.dec8(regs.b); // dec b -- sets Z read by the jp z below
  m.step(0x22e6, 4);
  regs.a = 0x01;
  m.step(0x22e8, 7); // ld a,0x01
  if (regs.fZ) { m.step(0x22f9, 10); return m.call(0x22f9); } // (0x6229)==1
  m.step(0x22eb, 10);
  regs.b = regs.dec8(regs.b);
  m.step(0x22ec, 4); // dec b
  regs.a = 0xb1;
  m.step(0x22ee, 7); // ld a,0xb1
  if (regs.fZ) { m.step(0x22f9, 10); return m.call(0x22f9); } // (0x6229)==2
  m.step(0x22f1, 10);
  regs.a = 0xe9;
  m.step(0x22f3, 7); // ld a,0xe9
  m.step(0x22f9, 10); // jp 0x22f9
  return m.call(0x22f9);
}
