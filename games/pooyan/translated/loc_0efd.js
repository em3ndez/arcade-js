// SPDX-License-Identifier: GPL-3.0-only

// loc_0efd  (ROM 0x0efd-0x0f00) -- command 0x08: A=0x08 then tail-jr into the
// text-ring appender 0x0ea2 (its ret returns to our caller).
export function loc_0efd(m) {
  const { regs } = m;

  regs.a = 0x08;
  m.step(0x0eff, 7); // 0efd  ld a,0x08
  m.step(0x0ea2, 12); // 0eff  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
