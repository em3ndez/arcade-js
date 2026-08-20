// SPDX-License-Identifier: GPL-3.0-only

// loc_0f05  (ROM 0x0f05-0x0f08) -- command 0x0a: A=0x0a then tail-jr into the
// text-ring append helper 0x0ea2 (its ret returns to our caller).
export function loc_0f05(m) {
  const { regs } = m;

  regs.a = 0x0a;
  m.step(0x0f07, 7); // 0f05  ld a,0x0a
  m.step(0x0ea2, 12); // 0f07  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
