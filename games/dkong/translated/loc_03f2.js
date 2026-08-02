// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_03f2  (ROM 0x03F2–0x03FA) — stores B at (HL), then B+1 again at the same address unless bit 0 of (0x6019) is set.
 *
 *   03f2  70           ld   (hl),b
 *   03f3  3a 19 60     ld   a,(0x6019)
 *   03f6  0f           rrca
 *   03f7  d8           ret  c
 *   03f8  04           inc  b
 *   03f9  70           ld   (hl),b
 *   03fa  c9           ret
 *
 * Stores B at (HL). Then, unless bit 0 of (0x6019) is set, increments B and
 * stores AGAIN at the SAME address -- there is no `inc hl` -- so (HL) ends as
 * B when the bit is set and B+1 when it is clear. The first store is then
 * visible only in the write TRACE, never in final state (the second overwrites
 * it), which is exactly the kind of write writediff sees and state-diff cannot.
 * The caller supplies HL = 0x6A29 and B pre-loaded. Called from both arms of
 * sub_03a2.
 */
export function loc_03f2(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, regs.b);
  m.step(0x03f3, 7); // ld (hl),b
  regs.a = mem.read8(0x6019);
  m.step(0x03f6, 13); // ld a,(0x6019)
  regs.rrca();
  m.step(0x03f7, 4); // rrca
  if (regs.fC) {
    m.ret(11); // ret c
    return;
  }
  m.step(0x03f8, 5); // ret c not taken

  regs.b = regs.inc8(regs.b);
  m.step(0x03f9, 4); // inc b
  mem.write8(regs.hl, regs.b);
  m.step(0x03fa, 7); // ld (hl),b

  m.ret(); // 03fa
}
