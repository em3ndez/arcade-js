// SPDX-License-Identifier: GPL-3.0-only

// loc_17e2  (ROM 0x17E2-0x17FA)
export function loc_17e2(m) {
  const { regs, mem } = m;

  regs.a = 0xff;
  m.step(0x17e4, 7); // 17e2  ld a,0xff
  mem.write8(0xaa3f, regs.a);
  m.step(0x17e7, 13); // 17e4  ld (0xaa3f),a
  regs.de = 0x17b9;
  m.step(0x17ea, 10); // 17e7  ld de,0x17b9 -- a ROM code address, as data
  regs.c = 0x08;
  m.step(0x17ec, 7); // 17ea  ld c,0x08

  m.push16(0x17ef);
  m.step(0x4bd9, 17); // 17ec  call 0x4bd9
  m.call(0x4bd9);

  regs.a = mem.read8(0x27c0);
  m.step(0x17f2, 13); // 17ef  ld a,(0x27c0) -- 0x00

  m.push16(0x17f5);
  m.step(0x291e, 17); // 17f2  call 0x291e
  m.call(0x291e);

  mem.write8(0xaa6f, regs.a);
  m.step(0x17f8, 13); // 17f5  ld (0xaa6f),a

  m.step(0x0f1a, 10); // 17f8  jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
