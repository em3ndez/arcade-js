// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0018  (ROM 0x0018–0x001F) — the `rst 0x18` skip helper.
 *
 *   0018  21 09 60     ld   hl,0x6009
 *   001b  35           dec  (hl)
 *   001c  c8           ret  z
 *   001d  33           inc  sp
 *   001e  33           inc  sp
 *   001f  c9           ret
 *
 * Decrement the counter at 0x6009. On ZERO return normally; otherwise
 * discard this routine's own return address with the two `inc sp` and return
 * to the CALLER'S CALLER, skipping whatever followed the `rst`.
 *
 * Note the polarity: the caller's remainder runs only when the counter
 * EXPIRES. This is a "do it every Nth time" gate, not a "do it while
 * counting" one, and reading it the other way inverts the whole routine.
 *
 * @returns {boolean} true when control returns to the instruction after the
 *   `rst`; false when it skipped, so the caller must return immediately.
 */
export function loc_0018(m) {
  const { regs, mem } = m;
  regs.hl = 0x6009;
  m.step(0x001b, 10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8); // dec (hl)
  m.step(0x001c, 11);
  if (regs.fZ) {
    m.ret(11); // ret z taken -- normal return
    return true;
  }
  m.step(0x001d, 5);
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x001e, 6);
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x001f, 6);
  m.ret(); // returns to the caller's CALLER
  return false;
}
