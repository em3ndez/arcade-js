// SPDX-License-Identifier: GPL-3.0-only

// loc_0f6c  (ROM 0x0f6c-0x0f75) -- enqueue two sound commands (0x19 then 0x15) via loc_0eb3;
// the second goes through a tail jp that reuses this frame (loc_0eb3's ret returns to our caller).
export function loc_0f6c(m) {
  const { regs } = m;

  regs.a = 0x19;      m.step(0x0f6e, 7);
  m.push16(0x0f71);
  m.step(0x0eb3, 17); // 0f6e  call 0x0eb3
  m.call(0x0eb3);
  regs.a = 0x15;      m.step(0x0f73, 7);
  m.step(0x0eb3, 10); // 0f73  jp 0x0eb3 (tail)
  return m.call(0x0eb3);
}
