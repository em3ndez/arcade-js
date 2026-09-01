// SPDX-License-Identifier: GPL-3.0-only
// loc_176d  (ROM 0x176d-0x1774) -- sound-off helper: mask mem[0x2098] to its two high sound
// bits (0x30) and write to port 5, silencing the per-shot channels while leaving them latched.
export function loc_176d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2098); m.step(0x1770, 13); // 176d  lda 0x2098
  regs.and(0x30); m.step(0x1772, 7); // 1770  ani 0x30
  m.io.portOut(0x05, regs.a); m.step(0x1774, 10); // 1772  out 0x05
  return m.ret(10); // 1774  ret
}
