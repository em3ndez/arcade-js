// SPDX-License-Identifier: GPL-3.0-only

// loc_0ef9  (ROM 0x0ef9-0x0efc) -- append tile 0x07: load A=0x07 and tail-jump into loc_0ea2.
export function loc_0ef9(m) {
  const { regs } = m;

  regs.a = 0x07;       m.step(0x0efb, 7);
  m.step(0x0ea2, 12);  // 0efb  jr 0x0ea2 (tail)
  return m.call(0x0ea2);
}
