// SPDX-License-Identifier: GPL-3.0-only

// loc_55f8  (ROM 0x55F8–0x560B)
export function loc_55f8(m) {
  const { regs, mem } = m;

  mem.write8(0xc000, regs.a, 10);
  m.step(0x55fb, 13); // ld (0xc000),a
  regs.a = 0x01;
  m.step(0x55fd, 7); // ld a,0x01
  mem.write8(0xc304, regs.a, 10);
  m.step(0x5600, 13); // ld (0xc304),a

  m.step(0x5601, 4); // nop
  m.step(0x5602, 4); // nop
  m.step(0x5603, 4); // nop
  m.step(0x5604, 4); // nop
  m.step(0x5605, 4); // nop
  m.step(0x5606, 4); // nop

  regs.a = 0x00;
  m.step(0x5608, 7); // ld a,0x00
  mem.write8(0xc304, regs.a, 10);
  m.step(0x560b, 13); // ld (0xc304),a

  m.ret(); // 0x560b
}
