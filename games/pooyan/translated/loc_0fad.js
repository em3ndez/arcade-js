// SPDX-License-Identifier: GPL-3.0-only

// loc_0fad  (ROM 0x0fad-0x0fb1) -- tile code 0x26: A=0x26 then tail-jp into the
// 4-tile emitter 0x0fc3 (its ret returns to our caller).
export function loc_0fad(m) {
  const { regs } = m;

  regs.a = 0x26;
  m.step(0x0faf, 7); // 0fad  ld a,0x26
  m.step(0x0fc3, 10); // 0faf  jp 0x0fc3 -- tail into loc_0fc3
  return m.call(0x0fc3);
}
