// SPDX-License-Identifier: GPL-3.0-only

// loc_0fbc  (ROM 0x0fbc-0x0fd4) -- enqueue the four-tile sequence 0x28,0x15,0x16,0x17 into the
// text ring via loc_0ea2. Entry loads A=0x28 and jumps over the alternate entry 0x0fc1 (A=0x29).
// The final append is a tail jp into loc_0ea2 (its ret returns to our caller).
export function loc_0fbc(m) {
  const { regs } = m;

  regs.a = 0x28;        m.step(0x0fbe, 7);
  m.step(0x0fc3, 10);   // jp 0x0fc3 -- skip the 0x0fc1 (A=0x29) entry
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
