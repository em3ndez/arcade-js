// SPDX-License-Identifier: GPL-3.0-only
// loc_09b2  (ROM 0x09b2-0x09c4) -- draw a byte in A as two hex digits: save DE/A, emit the high
// nibble via 0x09c5, restore A, emit the low nibble via 0x09c5, restore DE. Called at 0x09ae (and
// jumped to at 0x194d); falls into from loc_09ad which draws the D byte then A=E and re-enters here.
export function loc_09b2(m) {
  const { regs } = m;

  m.push16(regs.de); m.step(0x09b3, 11); // 09b2  push d
  m.push16(regs.af); m.step(0x09b4, 11); // 09b3  push psw
  regs.rrca(); m.step(0x09b5, 4); // 09b4  rrc
  regs.rrca(); m.step(0x09b6, 4); // 09b5  rrc
  regs.rrca(); m.step(0x09b7, 4); // 09b6  rrc
  regs.rrca(); m.step(0x09b8, 4); // 09b7  rrc
  regs.and(0x0f); m.step(0x09ba, 7); // 09b8  ani 0x0f (high nibble)
  m.push16(0x09bd); m.step(0x09c5, 17); m.call(0x09c5); // 09ba  call 0x09c5
  regs.af = m.pop16(); m.step(0x09be, 10); // 09bd  pop psw (restore A)
  regs.and(0x0f); m.step(0x09c0, 7); // 09be  ani 0x0f (low nibble)
  m.push16(0x09c3); m.step(0x09c5, 17); m.call(0x09c5); // 09c0  call 0x09c5
  regs.de = m.pop16(); m.step(0x09c4, 10); // 09c3  pop d
  return m.ret(10); // 09c4  ret
}
