// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2af6  (ROM 0x2AF6–0x2AFF) — Y==0x78: pick 0x63A5 (X>=0x80) or 0x63A4, then move.
 */
export function loc_2af6(m) {
  const { regs, mem } = m;
  regs.a = regs.b;
  m.step(0x2af7, 4);
  regs.cp(0x80);
  m.step(0x2af9, 7);
  regs.a = mem.read8(0x63a5);
  m.step(0x2afc, 13); // ld a,(nn) flag-neutral
  if (regs.fNC) { m.step(0x2b02, 10); return m.call(0x2b02); } // X >= 0x80
  m.step(0x2aff, 10);
  regs.a = mem.read8(0x63a4);
  m.step(0x2b02, 13);
  return m.call(0x2b02);
}
