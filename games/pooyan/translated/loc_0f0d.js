// SPDX-License-Identifier: GPL-3.0-only

// loc_0f0d  (ROM 0x0f0d-0x0f10) -- sound command 0x0b: A=0x0b then tail-jr into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f0d(m) {
  const { regs } = m;

  regs.a = 0x0b;
  m.step(0x0f0f, 7); // 0f0d  ld a,0x0b
  m.step(0x0ea2, 12); // 0f0f  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
