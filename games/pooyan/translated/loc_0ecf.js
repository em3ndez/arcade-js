// SPDX-License-Identifier: GPL-3.0-only

// loc_0ecf  (ROM 0x0ecf-0x0ed1) -- sound command 0x00: A=0 then tail-jr into the
// ring-buffer enqueue 0x0eb3 (its ret returns to our caller).
export function loc_0ecf(m) {
  const { regs } = m;

  regs.xor(regs.a);
  m.step(0x0ed0, 4); // 0ecf  xor a
  m.step(0x0eb3, 12); // 0ed0  jr 0x0eb3 -- tail into loc_0eb3
  return m.call(0x0eb3);
}
