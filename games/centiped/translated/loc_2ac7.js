// SPDX-License-Identifier: GPL-3.0-only
// loc_2ac7  (ROM 0x2ac7-0x2ace) -- decrement X; if it went negative RTS, else JMP loc_2962 (object loop tail).
export function loc_2ac7(m) {
  const { regs, mem } = m;
  regs.x = regs.dec8(regs.x); m.step(0x2ac8, 2);                       // 2ac7 dex
  if (regs.fN) {                                                       // 2ac8 bmi $2acd (taken)
    m.step(0x2acd, 3);
    return m.ret(6);                                                   // 2acd rts
  }
  m.step(0x2aca, 2);                                                   // 2ac8 bmi $2acd (not taken)
  m.step(0x2962, 3);                                                   // 2aca jmp $2962
  return m.call(0x2962);
}
