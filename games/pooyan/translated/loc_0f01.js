// SPDX-License-Identifier: GPL-3.0-only

// loc_0f01  (ROM 0x0f01-0x0f04) -- command 0x09: A=0x09 then tail-jr into the
// sound-ring enqueue helper 0x0eb3 (its ret returns to our caller).
export function loc_0f01(m) {
  const { regs } = m;

  regs.a = 0x09;
  m.step(0x0f03, 7); // 0f01  ld a,0x09
  m.step(0x0eb3, 12); // 0f03  jr 0x0eb3 -- tail into loc_0eb3
  return m.call(0x0eb3);
}
