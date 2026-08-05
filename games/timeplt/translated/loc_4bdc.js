// SPDX-License-Identifier: GPL-3.0-only

// loc_4bdc  (ROM 0x4BDC-0x4C13, Time Pilot)
export function loc_4bdc(m) {
  const { regs } = m;

  regs.hl = 0xab08;
  m.step(0x4bdf, 10); // ld hl,0xab08
  regs.de = 0xa711;
  m.step(0x4be2, 10); // ld de,0xa711
  regs.c = 0x14;
  m.step(0x4be4, 7); // ld c,0x14
  m.push16(0x4be7);
  m.step(0x4c1f, 17); // call 0x4c1f
  m.call(0x4c1f);

  regs.hl = 0xab10;
  m.step(0x4bea, 10); // ld hl,0xab10
  regs.de = 0xa713;
  m.step(0x4bed, 10); // ld de,0xa713
  regs.c = 0x16;
  m.step(0x4bef, 7); // ld c,0x16
  m.push16(0x4bf2);
  m.step(0x4c1f, 17); // call 0x4c1f
  m.call(0x4c1f);

  regs.hl = 0xab18;
  m.step(0x4bf5, 10); // ld hl,0xab18
  regs.de = 0xa715;
  m.step(0x4bf8, 10); // ld de,0xa715
  regs.c = 0x12;
  m.step(0x4bfa, 7); // ld c,0x12
  m.push16(0x4bfd);
  m.step(0x4c1f, 17); // call 0x4c1f
  m.call(0x4c1f);

  regs.hl = 0xab20;
  m.step(0x4c00, 10); // ld hl,0xab20
  regs.de = 0xa717;
  m.step(0x4c03, 10); // ld de,0xa717
  regs.c = 0x15;
  m.step(0x4c05, 7); // ld c,0x15
  m.push16(0x4c08);
  m.step(0x4c1f, 17); // call 0x4c1f
  m.call(0x4c1f);

  regs.hl = 0xab28;
  m.step(0x4c0b, 10); // ld hl,0xab28
  regs.de = 0xa719;
  m.step(0x4c0e, 10); // ld de,0xa719
  regs.c = 0x13;
  m.step(0x4c10, 7); // ld c,0x13
  m.push16(0x4c13);
  m.step(0x4c1f, 17); // call 0x4c1f
  m.call(0x4c1f);

  m.ret(); // 4c13  ret
}
