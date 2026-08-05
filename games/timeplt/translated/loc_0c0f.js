// SPDX-License-Identifier: GPL-3.0-only

// loc_0c0f  (ROM 0x0C0F-0x0C21)
export function loc_0c0f(m) {
  const { regs, mem } = m;

  regs.hl = 0x0c50;
  m.step(0x0c12, 10); // 0c0f  ld hl,0x0c50
  m.push16(0x0c15);
  m.step(0x018c, 17); // 0c12  call 0x018c
  m.call(0x018c);

  regs.exDeHl();
  m.step(0x0c16, 4); // 0c15  ex de,hl
  regs.e = mem.read8(regs.hl);
  m.step(0x0c17, 7); // 0c16  ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c18, 6); // 0c17  inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0c19, 7); // 0c18  ld d,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c1a, 6); // 0c19  inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c1b, 6); // 0c1a  inc hl -- steps OVER the record's colour byte

  regs.a = mem.read8(0xad0c);
  m.step(0x0c1e, 13); // 0c1b  ld a,(0xad0c)
  regs.and(0x0f);
  m.step(0x0c20, 7); // 0c1e  and 0x0f
  regs.c = regs.a;
  m.step(0x0c21, 4); // 0c20  ld c,a

  m.step(0x0bff, 12); // 0c21  jr 0x0bff -- tail jump into the shared character loop
  return m.call(0x0bff);
}
