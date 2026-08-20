// SPDX-License-Identifier: GPL-3.0-only

// loc_0ef5  (ROM 0x0ef5-0x0ef8) -- sound-command stub 0x06: A=0x06 then tail-jr into the
// tile/command append helper 0x0ea2 (its ret returns to our caller).
export function loc_0ef5(m) {
  const { regs } = m;

  regs.a = 0x06;
  m.step(0x0ef7, 7); // 0ef5  ld a,0x06
  m.step(0x0ea2, 12); // 0ef7  jr 0x0ea2 -- tail into loc_0ea2
  return m.call(0x0ea2);
}
