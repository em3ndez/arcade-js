// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2fb7  (ROM 0x2FB7–0x2FBB) — (0x6394) counter did not wrap: (0x6395)==0 -> loc_2f7c, else loc_2fbe.
 */
export function loc_2fb7(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6395);
  m.step(0x2fba, 13); // ld a,(0x6395)
  regs.and(regs.a);
  m.step(0x2fbb, 4); // and a
  if (regs.fZ) { m.step(0x2f7c, 10); return m.call(0x2f7c); } // jp z,0x2f7c
  m.step(0x2fbe, 10); // fall into loc_2fbe
  return m.call(0x2fbe);
}
