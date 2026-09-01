// SPDX-License-Identifier: GPL-3.0-only
// loc_092e  (ROM 0x092e-0x0934) -- `call 0x092e` (from loc_0935 and 0x1a7f). Calls 0x1611, forces
// L=0xff, then loads A from that (HL) address and returns.
export function loc_092e(m) {
  const { regs, mem } = m;

  m.push16(0x0931); m.step(0x1611, 17); m.call(0x1611); // 092e  call 0x1611
  regs.l = 0xff; m.step(0x0933, 7); // 0931  mvi l,0xff
  regs.a = mem.read8(regs.hl); m.step(0x0934, 7); // 0933  mov a,m
  return m.ret(10); // 0934  ret
}
