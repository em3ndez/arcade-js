// SPDX-License-Identifier: GPL-3.0-only

// loc_0fc3  (ROM 0x0fc3-0x0fd4) -- emit a 4-tile run via loc_0ea2: the caller's A, then
// 0x15, 0x16, 0x17. Three calls plus a tail jp for the last.
export function loc_0fc3(m) {
  const { regs } = m;

  m.push16(0x0fc6);
  m.step(0x0ea2, 17);              // 0fc3  call 0x0ea2 (A from caller)
  m.call(0x0ea2);

  regs.a = 0x15;                   m.step(0x0fc8, 7);
  m.push16(0x0fcb);
  m.step(0x0ea2, 17);              // 0fc8  call 0x0ea2
  m.call(0x0ea2);

  regs.a = 0x16;                   m.step(0x0fcd, 7);
  m.push16(0x0fd0);
  m.step(0x0ea2, 17);              // 0fcd  call 0x0ea2
  m.call(0x0ea2);

  regs.a = 0x17;                   m.step(0x0fd2, 7);
  m.step(0x0ea2, 10);             // 0fd2  jp 0x0ea2 (tail)
  return m.call(0x0ea2);
}
