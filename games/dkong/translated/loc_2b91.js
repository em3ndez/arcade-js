// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b91  (ROM 0x2B91–0x2B9A) — store the adjusted X to (0x6203) and (0x694c), A=1, then pop hl/ret SKIP.
 */
export function loc_2b91(m) {
  const { regs, mem } = m;
  mem.write8(0x6203, regs.a);
  m.step(0x2b94, 13); // ld (0x6203),a
  mem.write8(0x694c, regs.a);
  m.step(0x2b97, 13); // ld (0x694c),a
  regs.a = 0x01;
  m.step(0x2b99, 7); // ld a,0x01
  regs.hl = m.pop16();
  m.step(0x2b9a, 10); // pop hl -- discard 2b29's return
  m.ret(); // ret -- SKIP past 2b1c
  return false;
}
