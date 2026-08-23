// SPDX-License-Identifier: GPL-3.0-only

// loc_0fc1  (ROM 0x0fc1-0x0fd4) -- alternate A=0x29 entry of loc_0fbc: enqueue the four-tile sequence
// 0x29,0x15,0x16,0x17 into the text ring via loc_0ea2, re-emitting loc_0fbc's shared 0x0fc3 tail (the
// only difference from loc_0fbc is the first byte 0x29 vs 0x28). The final append is a tail jp into
// loc_0ea2 (its ret returns to our caller).
export function loc_0fc1(m) {
  const { regs } = m;

  regs.a = 0x29;        m.step(0x0fc3, 7);   // 0fc1  ld a,0x29 -- falls through into the shared tail
  m.push16(0x0fc6);
  m.step(0x0ea2, 17);   // 0fc3  call 0x0ea2
  m.call(0x0ea2);
  regs.a = 0x15;        m.step(0x0fc8, 7);
  m.push16(0x0fcb);
  m.step(0x0ea2, 17);   // 0fc8  call 0x0ea2
  m.call(0x0ea2);
  regs.a = 0x16;        m.step(0x0fcd, 7);
  m.push16(0x0fd0);
  m.step(0x0ea2, 17);   // 0fcd  call 0x0ea2
  m.call(0x0ea2);
  regs.a = 0x17;        m.step(0x0fd2, 7);
  m.step(0x0ea2, 10);   // 0fd2  jp 0x0ea2 -- tail append
  return m.call(0x0ea2);
}
