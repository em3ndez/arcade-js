// SPDX-License-Identifier: GPL-3.0-only

// loc_0f1d  (ROM 0x0f1d-0x0f20) -- sound command 0x0f: A=0x0f then tail-jr into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f1d(m) {
  const { regs } = m;

  regs.a = 0x0f;
  m.step(0x0f1f, 7); // 0f1d  ld a,0x0f
  m.step(0x0ea2, 12); // 0f1f  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
