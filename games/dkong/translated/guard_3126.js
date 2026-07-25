// SPDX-License-Identifier: GPL-3.0-only

/**
 * guard_3126  (ROM 0x3126–0x3130).
 */
export function guard_3126(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x3129, 13); // ld a,(0x601a)
  regs.and(0x03);
  m.step(0x312b, 7); // and 0x03
  regs.cp(0x03);
  m.step(0x312d, 7); // cp 0x03
  if (regs.fM) {
    m.ret(11); // ret m -- (0x601a & 3) < 3
    return true;
  }
  m.step(0x312e, 5); // ret m NOT taken
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x312f, 6); // inc sp
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x3130, 6); // inc sp
  m.ret(); // 3130
  return false;
}
