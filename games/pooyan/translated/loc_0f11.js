// SPDX-License-Identifier: GPL-3.0-only

// loc_0f11  (ROM 0x0f11-0x0f14) -- sound command 0x0c: A=0x0c then tail-jr into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f11(m) {
  const { regs } = m;

  regs.a = 0x0c;
  m.step(0x0f13, 7); // 0f11  ld a,0x0c
  m.step(0x0ea2, 12); // 0f13  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
