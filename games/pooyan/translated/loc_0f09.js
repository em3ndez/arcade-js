// SPDX-License-Identifier: GPL-3.0-only

// loc_0f09  (ROM 0x0f09-0x0f0c) -- sound command 0x0b: A=0x0b then tail-jr into the
// direct sound-latch helper 0x0e8f (its ret returns to our caller).
export function loc_0f09(m) {
  const { regs } = m;

  regs.a = 0x0b;
  m.step(0x0f0b, 7); // 0f09  ld a,0x0b
  m.step(0x0e8f, 12); // 0f0b  jr 0x0e8f -- tail into loc_0e8f
  return m.call(0x0e8f);
}
