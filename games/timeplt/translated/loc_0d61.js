// SPDX-License-Identifier: GPL-3.0-only

// loc_0d61  (ROM 0x0D61-0x0D6A)
export function loc_0d61(m) {
  const { regs } = m;

  regs.de = 0xa501;
  m.step(0x0d64, 10); // 0d61  ld de,0xa501
  regs.hl = 0xad38;
  m.step(0x0d67, 10); // 0d64  ld hl,0xad38
  regs.c = 0x10;
  m.step(0x0d69, 7); // 0d67  ld c,0x10

  m.step(0x0d73, 12); // 0d69  jr 0x0d73 -- tail jump into the shared digit writer
  return m.call(0x0d73);
}
