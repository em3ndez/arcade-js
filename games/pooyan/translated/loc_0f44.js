// SPDX-License-Identifier: GPL-3.0-only

// loc_0f44  (ROM 0x0f44-0x0f48) -- sound command 0x13: A=0x13 then tail-jp into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f44(m) {
  const { regs } = m;

  regs.a = 0x13;
  m.step(0x0f46, 7); // 0f44  ld a,0x13
  m.step(0x0ea2, 10); // 0f46  jp 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
