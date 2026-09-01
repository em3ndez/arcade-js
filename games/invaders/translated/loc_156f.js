// SPDX-License-Identifier: GPL-3.0-only
// loc_156f  (ROM 0x156f-0x1578) -- Y-scale: load 0x200a into A, call the scale helper 0x1554,
// take A := A - 0x10 (SBI) as the residual and stash it into H. Returns with H holding the result.
export function loc_156f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x200a); m.step(0x1572, 13); // 156f  lda 0x200a
  m.push16(0x1575); m.step(0x1554, 17); m.call(0x1554); // 1572  call 0x1554
  regs.sbc(0x10); m.step(0x1577, 7); // 1575  sbi 0x10
  regs.h = regs.a; m.step(0x1578, 5); // 1577  mov h,a
  return m.ret(10); // 1578  ret
}
