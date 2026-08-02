// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0010  (ROM 0x0010–0x0017) — the `rst 0x10` conditional-skip helper.
 *
 *   0010  3a 00 62     ld   a,(0x6200)
 *   0013  0f           rrca
 *   0014  d8           ret  c
 *   0015  33           inc  sp
 *   0016  33           inc  sp
 *   0017  c9           ret
 *
 * Mirror of sub_0008 with the opposite polarity: returns NORMALLY when bit 0
 * of 0x6200 is SET, and skips the caller's remainder when it is clear.
 * Returns true for a normal return.
 */
export function loc_0010(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6200);
  m.step(0x0013, 13);
  regs.rrca();
  m.step(0x0014, 4);
  if (regs.fC) {
    m.ret(11);
    return true;
  }
  m.step(0x0015, 5);
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x0016, 6);
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x0017, 6);
  m.ret();
  return false;
}
