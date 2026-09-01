// SPDX-License-Identifier: GPL-3.0-only
// loc_0765  (ROM 0x0765-0x077e) -- reached by `jmp 0x0765` at 0x0064. Seats SP, enables
// interrupts, runs the init/draw subroutines, then falls through into loc_077f (its own head).
export function loc_0765(m) {
  const { regs, mem } = m;

  regs.a = 0x01; m.step(0x0767, 7);                     // 0765  mvi a,0x01
  mem.write8(0x2093, regs.a); m.step(0x076a, 13);       // 0767  sta 0x2093
  regs.sp = 0x2400; m.step(0x076d, 10);                 // 076a  lxi sp,0x2400
  m.step(0x076e, 4);                                    // 076d  ei (INTE set in board seam)
  m.push16(0x0771); m.step(0x1979, 17); m.call(0x1979); // 076e  call 0x1979
  m.push16(0x0774); m.step(0x09d6, 17); m.call(0x09d6); // 0771  call 0x09d6
  regs.hl = 0x3013; m.step(0x0777, 10);                 // 0774  lxi h,0x3013
  regs.de = 0x1ff3; m.step(0x077a, 10);                 // 0777  lxi d,0x1ff3
  regs.c = 0x04; m.step(0x077c, 7);                      // 077a  mvi c,0x04
  m.push16(0x077f); m.step(0x08f3, 17); m.call(0x08f3); // 077c  call 0x08f3
  return m.call(0x077f);                                // 077f  fall through into loc_077f
}
