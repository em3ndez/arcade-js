// SPDX-License-Identifier: GPL-3.0-only

// loc_0f4e  (ROM 0x0f4e-0x0f57) -- queue two sound commands. Loads A=0x82 and calls the sound-latch
// helper 0x0eb3, then loads A=0x95 and tail-jumps into 0x0eb3 (its ret returns to loc_0f4e's caller).
export function loc_0f4e(m) {
  const { regs } = m;

  regs.a = 0x82; m.step(0x0f50, 7); // 0f4e  ld a,0x82
  m.push16(0x0f53); m.step(0x0eb3, 17); m.call(0x0eb3); // 0f50  call 0x0eb3
  regs.a = 0x95; m.step(0x0f55, 7); // 0f53  ld a,0x95
  m.step(0x0eb3, 10); return m.call(0x0eb3); // 0f55  jp 0x0eb3 (tail)
}
