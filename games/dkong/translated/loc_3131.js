// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3131  (ROM 0x3131–0x313B).
 */
export function loc_3131(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x3134, 13); // ld a,(0x601a)
  regs.and(0x07);
  m.step(0x3136, 7); // and 0x07
  regs.cp(0x07);
  m.step(0x3138, 7); // cp 0x07
  if (regs.fM) {
    m.ret(11); // ret m -- (0x601a & 7) < 7
    return true;
  }
  m.step(0x3139, 5); // ret m NOT taken
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x313a, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x313b, 6); // inc sp
  m.ret(); // 313b
  return false;
}
