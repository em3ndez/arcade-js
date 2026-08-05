// SPDX-License-Identifier: GPL-3.0-only

// loc_12fb  (ROM 0x12FB-0x1318, Time Pilot)
export function loc_12fb(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x12fc, 4); // xor a

  mem.write8(0xad30, regs.a);
  m.step(0x12ff, 13); // ld (0xad30),a

  mem.write8(0xa9ac, regs.a);
  m.step(0x1302, 13); // ld (0xa9ac),a

  mem.write8(0xad32, regs.a);
  m.step(0x1305, 13); // ld (0xad32),a

  regs.a = mem.read8(0x16d3); // a ROM byte: 0x01
  m.step(0x1308, 13); // ld a,(0x16d3)

  mem.write8(0xa9ab, regs.a);
  m.step(0x130b, 13); // ld (0xa9ab),a

  regs.a = mem.read8(0x4901); // a ROM byte: 0xA6
  m.step(0x130e, 13); // ld a,(0x4901)

  regs.hl = mem.read16(0x4902); // a ROM word: 0x3005
  m.step(0x1311, 16); // ld hl,(0x4902)

  m.push16(0x1312);
  m.step(0x0018, 11); // rst 0x18 -- HL += A, and A becomes the new L
  m.call(0x0018);

  regs.xor(regs.h);
  m.step(0x1313, 4); // xor h

  regs.sub(0x9b);
  m.step(0x1315, 7); // sub 0x9b -- the block folds to zero

  mem.write8(0xa9ac, regs.a);
  m.step(0x1318, 13); // ld (0xa9ac),a

  m.ret(); // 1318  ret
}
