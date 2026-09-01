// SPDX-License-Identifier: GPL-3.0-only
// loc_0886  (ROM 0x0886-0x088c) -- called from 0x00b1, also the tail-jump target of loc_0878.
// Builds HL = (mem[0x2067] << 8) | 0xfc and returns.
export function loc_0886(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2067); m.step(0x0889, 13); // 0886  lda 0x2067
  regs.h = regs.a; m.step(0x088a, 5); // 0889  mov h,a
  regs.l = 0xfc; m.step(0x088c, 7); // 088a  mvi l,0xfc
  return m.ret(10); // 088c  ret
}
