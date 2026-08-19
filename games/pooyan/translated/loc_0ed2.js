// SPDX-License-Identifier: GPL-3.0-only

// loc_0ed2  (ROM 0x0ed2-0x0ed5) -- sound command 0x01: A=0x01 then tail-jr into the
// enqueue helper 0x0ea2 (its ret returns to our caller).
export function loc_0ed2(m) {
  const { regs } = m;

  regs.a = 0x01;
  m.step(0x0ed4, 7); // 0ed2  ld a,0x01
  m.step(0x0ea2, 12); // 0ed4  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
