// SPDX-License-Identifier: GPL-3.0-only

// loc_0f88  (ROM 0x0f88-0x0f91) -- a tile-command trampoline: emit tile 0x82 via loc_0ea2, then
// load index 0x1c and tail-jump into the 0x0fc3 command builder (which ret's to loc_0f88's caller).
export function loc_0f88(m) {
  const { regs } = m;

  regs.a = 0x82;
  m.step(0x0f8a, 7);  // 0f88  ld a,0x82
  m.push16(0x0f8d);
  m.step(0x0ea2, 17); // 0f8a  call 0x0ea2 -- emit tile 0x82 (returns to 0x0f8d)
  m.call(0x0ea2);

  regs.a = 0x1c;
  m.step(0x0f8f, 7);  // 0f8d  ld a,0x1c
  m.step(0x0fc3, 10); // 0f8f  jp 0x0fc3 -- tail: its ret is ours
  return m.call(0x0fc3);
}
