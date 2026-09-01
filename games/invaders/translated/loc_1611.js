// SPDX-License-Identifier: GPL-3.0-only
// loc_1611  (ROM 0x1611-0x1617) -- `call 0x1611` (from loc_15f3, loc_092e, 0x1a7f). Points HL at the
// top of the page selected by [0x2067]: L:=0, A:=mem[0x2067], H:=A -- i.e. HL = mem[0x2067] << 8.
export function loc_1611(m) {
  const { regs, mem } = m;

  regs.l = 0x00; m.step(0x1613, 7); // 1611  mvi l,0x00
  regs.a = mem.read8(0x2067); m.step(0x1616, 13); // 1613  lda 0x2067
  regs.h = regs.a; m.step(0x1617, 5); // 1616  mov h,a
  return m.ret(10); // 1617  ret
}
