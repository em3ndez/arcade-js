// SPDX-License-Identifier: GPL-3.0-only

// loc_0f49  (ROM 0x0f49-0x0f4d) -- sound command 0x14: A=0x14 then tail-jp into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f49(m) {
  const { regs } = m;

  regs.a = 0x14;
  m.step(0x0f4b, 7); // 0f49  ld a,0x14
  m.step(0x0ea2, 10); // 0f4b  jp 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
