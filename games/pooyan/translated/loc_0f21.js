// SPDX-License-Identifier: GPL-3.0-only

// loc_0f21  (ROM 0x0f21-0x0f2a) -- queue two sound commands (0x95 then 0x10) via enqueue
// helper 0x0ea2. First is a pattern-A call (returns to 0x0f26); the second is a tail-jp,
// so 0x0ea2's ret carries control back to loc_0f21's caller.
export function loc_0f21(m) {
  const { regs } = m;

  regs.a = 0x95;
  m.step(0x0f23, 7); // 0f21  ld a,0x95
  m.push16(0x0f26); m.step(0x0ea2, 17); m.call(0x0ea2); // 0f23  call 0x0ea2
  regs.a = 0x10;
  m.step(0x0f28, 7); // 0f26  ld a,0x10
  m.step(0x0ea2, 10); // 0f28  jp 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
