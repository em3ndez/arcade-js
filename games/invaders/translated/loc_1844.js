// SPDX-License-Identifier: GPL-3.0-only
// loc_1844  (ROM 0x1844-0x184b) -- called from 0x182e (loc_1815 script walker). Preserves BC,
// sets a 0x10 step count in B, delegates the draw to 0x1439, restores BC, returns.
export function loc_1844(m) {
  const { regs } = m;

  m.push16(regs.bc); m.step(0x1845, 11); // 1844  push b
  regs.b = 0x10; m.step(0x1847, 7); // 1845  mvi b,0x10
  m.push16(0x184a); m.step(0x1439, 17); m.call(0x1439); // 1847  call 0x1439
  regs.bc = m.pop16(); m.step(0x184b, 10); // 184a  pop b
  return m.ret(10); // 184b  ret
}
