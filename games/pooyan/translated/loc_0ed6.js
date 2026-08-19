// SPDX-License-Identifier: GPL-3.0-only

// loc_0ed6  (ROM 0x0ed6-0x0ed9) -- sound command 0x02: A=0x02 then tail-jr into the
// enqueue helper 0x0eb3 (its ret returns to our caller).
export function loc_0ed6(m) {
  const { regs } = m;

  regs.a = 0x02;
  m.step(0x0ed8, 7); // 0ed6  ld a,0x02
  m.step(0x0eb3, 12); // 0ed8  jr 0x0eb3 -- tail into loc_0eb3
  return m.call(0x0eb3);
}
