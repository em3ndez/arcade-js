// SPDX-License-Identifier: GPL-3.0-only

// loc_0f15  (ROM 0x0f15-0x0f18) -- sound command 0x0d: A=0x0d then tail-jr into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0f15(m) {
  const { regs } = m;

  regs.a = 0x0d;
  m.step(0x0f17, 7); // 0f15  ld a,0x0d
  m.step(0x0ea2, 12); // 0f17  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
