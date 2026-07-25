// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_055f  (ROM 0x055F–0x056A) — selects a BCD-counter address into DE from the flag at 0x600D.
 *
 *   055f  11 b2 60     ld   de,0x60b2
 *   0562  3a 0d 60     ld   a,(0x600d)
 *   0565  a7           and  a
 *   0566  c8           ret  z
 *   0567  11 b5 60     ld   de,0x60b5
 *   056a  c9           ret
 *
 * Selects one of two BCD counter addresses into DE from the flag at 0x600D:
 * zero keeps 0x60B2, non-zero replaces it with 0x60B5. The `ld de` at 0x055F
 * is executed and then possibly OVERWRITTEN -- the fall-through IS the
 * selection, the same shape as handler_05c6's 0x05CB/0x05D2 pair.
 *
 * TWO EXITS, both ordinary `ret`s -- no stack idiom here. It is six
 * instructions with only two callers, both inside entry_051c, at 0x051E and
 * 0x0550.
 *
 * IT RETURNS ITS RESULT IN DE AND CLOBBERS A AND F. A holds (0x600D) at both
 * exits and the flags are `and a`'s -- entry_051c's second call site at 0x0550
 * is followed immediately by `ld hl,0x60b8`, so neither is read there.
 */
export function sub_055f(m) {
  const { regs, mem } = m;

  regs.de = 0x60b2;
  m.step(0x0562, 10); // ld de,0x60b2
  regs.a = mem.read8(0x600d);
  m.step(0x0565, 13); // ld a,(0x600d)
  regs.and(regs.a); // sets Z from A; clears C, sets H
  m.step(0x0566, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken -- DE stays 0x60B2
    return;
  }
  m.step(0x0567, 5); // ret z not taken

  regs.de = 0x60b5; // overwrites the 0x055F load
  m.step(0x056a, 10); // ld de,0x60b5

  m.ret(); // 056a
}
