// SPDX-License-Identifier: GPL-3.0-only

// loc_0f2b  (ROM 0x0f2b-0x0f2f) -- sound command 0x11: A=0x11 then tail-jp into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f2b(m) {
  const { regs } = m;

  regs.a = 0x11;
  m.step(0x0f2d, 7); // 0f2b  ld a,0x11
  m.step(0x0ea2, 10); // 0f2d  jp 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
