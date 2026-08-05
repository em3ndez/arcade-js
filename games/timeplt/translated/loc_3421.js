// SPDX-License-Identifier: GPL-3.0-only

// loc_3421  (ROM 0x3421-0x3437)
export function loc_3421(m) {
  const { regs, mem } = m;

  regs.hl = 0x0c50;
  m.step(0x3424, 10); // 3421  ld hl,0x0c50
  m.push16(0x3427);
  m.step(0x018c, 17); // 3424  call 0x018c
  m.call(0x018c);

  regs.exDeHl();
  m.step(0x3428, 4); // 3427  ex de,hl
  regs.e = mem.read8(regs.hl);
  m.step(0x3429, 7); // 3428  ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x342a, 6); // 3429  inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x342b, 7); // 342a  ld d,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x342c, 6); // 342b  inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x342d, 6); // 342c  inc hl -- steps OVER the record's colour byte

  regs.a = mem.read8(0xad0c);
  m.step(0x3430, 13); // 342d  ld a,(0xad0c)
  regs.add(0x05);
  m.step(0x3432, 7); // 3430  add a,0x05
  regs.and(0x0f);
  m.step(0x3434, 7); // 3432  and 0x0f
  regs.c = regs.a;
  m.step(0x3435, 4); // 3434  ld c,a

  m.step(0x0bff, 10); // 3435  jp 0x0bff -- tail jump into the shared character loop
  return m.call(0x0bff);
}
