// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0008  (ROM 0x0008–0x000F) — the `rst 0x08` conditional-skip helper.
 *
 *   0008  3a 07 60     ld   a,(0x6007)
 *   000b  0f           rrca
 *   000c  d0           ret  nc
 *   000d  33           inc  sp
 *   000e  33           inc  sp
 *   000f  c9           ret
 *
 * A THIRD STACK IDIOM. If bit 0 of 0x6007 is set, the two `inc sp` discard
 * this routine's own return address so the final `ret` returns to the
 * CALLER'S CALLER -- skipping the rest of whoever invoked `rst 0x08`.
 * Returns true when it returned normally, false when it skipped, so the
 * caller can model the skip as an early return.
 */
export function sub_0008(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6007);
  m.step(0x000b, 13);
  regs.rrca(); // bit 0 -> carry
  m.step(0x000c, 4);
  if (regs.fNC) {
    m.ret(11); // ret nc taken -- normal return
    return true;
  }
  m.step(0x000d, 5); // ret nc not taken
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x000e, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x000f, 6); // inc sp
  m.ret(); // returns to the caller's CALLER
  return false; // caller must return immediately
}
