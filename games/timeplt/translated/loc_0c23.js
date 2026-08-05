// SPDX-License-Identifier: GPL-3.0-only

// loc_0c23  (ROM 0x0C23-0x0C38)
export function loc_0c23(m) {
  const { regs, mem } = m;

  regs.hl = 0x0c50;
  m.step(0x0c26, 10); // 0c23  ld hl,0x0c50
  m.push16(0x0c29);
  m.step(0x018c, 17); // 0c26  call 0x018c
  m.call(0x018c);

  regs.exDeHl();
  m.step(0x0c2a, 4); // 0c29  ex de,hl
  regs.e = mem.read8(regs.hl);
  m.step(0x0c2b, 7); // 0c2a  ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c2c, 6); // 0c2b  inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0c2d, 7); // 0c2c  ld d,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c2e, 6); // 0c2d  inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c2f, 6); // 0c2e  inc hl -- steps OVER the record's colour byte

  regs.a = mem.read8(0xad0c);
  m.step(0x0c32, 13); // 0c2f  ld a,(0xad0c)
  regs.add(0x0a);
  m.step(0x0c34, 7); // 0c32  add a,0x0a
  regs.and(0x0f);
  m.step(0x0c36, 7); // 0c34  and 0x0f
  regs.c = regs.a;
  m.step(0x0c37, 4); // 0c36  ld c,a

  m.step(0x0bff, 12); // 0c37  jr 0x0bff -- tail jump into the shared character loop
  return m.call(0x0bff);
}
