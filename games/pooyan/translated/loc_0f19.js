// SPDX-License-Identifier: GPL-3.0-only

// loc_0f19  (ROM 0x0f19-0x0f1c) -- sound command 0x0e: A=0x0e then tail-jr into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f19(m) {
  const { regs } = m;

  regs.a = 0x0e;
  m.step(0x0f1b, 7); // 0f19  ld a,0x0e
  m.step(0x0ea2, 12); // 0f1b  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
