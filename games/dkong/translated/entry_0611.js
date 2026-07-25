// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_0611  (ROM 0x0611–0x0615) — task table entry 8.
 *
 *   0611  3a 07 60     ld   a,(0x6007)
 *   0614  0f           rrca
 *   0615  d0           ret  nc
 *   ... falls through into sub_0616
 *
 * The `rrca` moves bit 0 of 0x6007 into carry, so this returns unless that
 * bit is set -- a one-bit enable guard, not a value test. A is left rotated
 * and IS read by nothing downstream, which is why the guard can clobber it.
 *
 * 0x6007 bit 0 is the same flag `sub_0008` tests with the identical
 * `ld a,(0x6007) / rrca / ret nc` sequence, so this is a shared idiom rather
 * than a coincidence.
 */
export function entry_0611(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6007);
  m.step(0x0614, 13);
  regs.rrca();
  m.step(0x0615, 4);
  if (regs.fNC) {
    m.ret(11); // ret nc taken -- the enable bit is clear, do nothing
    return;
  }
  m.step(0x0616, 5); // not taken: 5, and falls through into sub_0616
  m.call(0x0616);
}
