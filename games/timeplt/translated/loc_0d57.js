// SPDX-License-Identifier: GPL-3.0-only

// loc_0d57  (ROM 0x0D57-0x0D60)
export function loc_0d57(m) {
  const { regs } = m;

  regs.de = 0xa781;
  m.step(0x0d5a, 10); // 0d57  ld de,0xa781
  regs.hl = 0xad35;
  m.step(0x0d5d, 10); // 0d5a  ld hl,0xad35
  regs.c = 0x10;
  m.step(0x0d5f, 7); // 0d5d  ld c,0x10

  m.step(0x0d73, 12); // 0d5f  jr 0x0d73 -- tail jump into the shared digit writer
  return m.call(0x0d73);
}
