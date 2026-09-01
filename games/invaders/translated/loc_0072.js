// SPDX-License-Identifier: GPL-3.0-only
// loc_0072  (ROM 0x0072-0x0081) -- entered by `jmp 0x0072` at 0x0abc and by fall-through from
// loc_0010's loc_006f arm. Latches 0x2032 into 0x2080, runs three subroutines, then falls
// through into the shared epilogue loc_0082 (its own head).
export function loc_0072(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2032); m.step(0x0075, 13); // 0072  lda 0x2032
  mem.write8(0x2080, regs.a); m.step(0x0078, 13); // 0075  sta 0x2080
  m.push16(0x007b); m.step(0x0100, 17); m.call(0x0100); // 0078  call 0x0100
  m.push16(0x007e); m.step(0x0248, 17); m.call(0x0248); // 007b  call 0x0248
  m.push16(0x0081); m.step(0x0913, 17); m.call(0x0913); // 007e  call 0x0913
  m.step(0x0082, 4); // 0081  nop
  return m.call(0x0082); // fall through into loc_0082 (its own head)
}
