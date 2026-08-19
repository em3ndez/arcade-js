// SPDX-License-Identifier: GPL-3.0-only

// loc_0f3f  (ROM 0x0f3f-0x0f43) -- sound command 0x12: A=0x12 then tail-jp into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f3f(m) {
  const { regs } = m;

  regs.a = 0x12;
  m.step(0x0f41, 7); // 0f3f  ld a,0x12
  m.step(0x0ea2, 10); // 0f41  jp 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
