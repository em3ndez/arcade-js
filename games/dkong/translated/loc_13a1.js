// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_13a1  (ROM 0x13A1–0x13A9) — 0x0702 table idx17; TWIN of loc_138f, reads 0x6040.
 *   13a1 df rst 0x18   13a2 0e 17 ld c,0x17   13a4 3a 40 60 ld a,(0x6040)   13a7 c3 95 13 jp 0x1395
 * Converges on loc_1395 (inline in loc_138f). Wired after the 0x0702
 * table-audit found idx17 -> 0x13A1 un-wired. loc_1395 tail
 * duplicated here rather than refactoring the gated loc_138f.
 */
export function loc_13a1(m) {
  const { regs, mem } = m;
  m.push16(0x13a2);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter did not expire -- dispatch abandoned
  regs.c = 0x17;
  m.step(0x13a4, 7); // ld c,0x17
  regs.a = mem.read8(0x6040); // 0x6040 (vs loc_138f's 0x6048)
  m.step(0x13a7, 13); // ld a,(0x6040)
  m.step(0x1395, 10); // jp 0x1395 -- converge on the loc_1395 tail
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (hl) -- HL=0x6009 from sub_0018
  m.step(0x1396, 11);
  regs.and(regs.a); // tests the 0x6040 byte
  m.step(0x1397, 4);
  if (regs.fNZ) {
    m.step(0x139c, 10); // jp nz -- C stays 0x17
  } else {
    m.step(0x139a, 10);
    regs.c = 0x14;
    m.step(0x139c, 7);
  }
  regs.a = regs.c;
  m.step(0x139d, 4); // ld a,c
  mem.write8(0x600a, regs.a);
  m.step(0x13a0, 13);
  m.ret(10); // ret (0x13A0)
}
