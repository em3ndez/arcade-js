// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_311b  (ROM 0x311B–0x3125).
 */
export function loc_311b(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x311e, 13); // ld a,(0x601a)
  regs.and(0x07);
  m.step(0x3120, 7); // and 0x07
  regs.cp(0x05);
  m.step(0x3122, 7); // cp 0x05
  if (regs.fM) {
    m.ret(11); // ret m -- SIGN, i.e. (0x601a & 7) < 5
    return true;
  }
  m.step(0x3123, 5); // ret m NOT taken
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x3124, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x3125, 6); // inc sp
  m.ret(); // 3125
  return false;
}
