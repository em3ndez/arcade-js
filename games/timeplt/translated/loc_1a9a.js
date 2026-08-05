// SPDX-License-Identifier: GPL-3.0-only

// loc_1a9a  (ROM 0x1A9A-0x1AE3, Time Pilot)
export function loc_1a9a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x1a9d, 13); // ld a,(0xad04)
  regs.rlca();
  m.step(0x1a9e, 4); // rlca
  regs.rlca();
  m.step(0x1a9f, 4); // rlca
  regs.rlca();
  m.step(0x1aa0, 4); // rlca
  regs.rlca();
  m.step(0x1aa1, 4); // rlca -- four rotates = nibble swap
  regs.and(0xf0);
  m.step(0x1aa3, 7); // and 0xf0
  regs.b = regs.a;
  m.step(0x1aa4, 4); // ld b,a

  regs.a = mem.read8(0xacc0);
  m.step(0x1aa7, 13); // ld a,(0xacc0)
  regs.add(regs.b);
  m.step(0x1aa8, 4); // add a,b -- the composite record index
  regs.hl = 0x1b04;
  m.step(0x1aab, 10); // ld hl,0x1b04

  m.push16(0x1aac);
  m.step(0x0010, 11); // rst 0x10 -- DE = the record pointer
  m.call(0x0010);

  regs.a = mem.read8(regs.de);
  m.step(0x1aad, 7); // ld a,(de) -- byte 0
  mem.write8(0xa844, regs.a);
  m.step(0x1ab0, 13); // ld (0xa844),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ab1, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ab2, 7); // ld a,(de) -- byte 1
  mem.write8(0xa837, regs.a);
  m.step(0x1ab5, 13); // ld (0xa837),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ab6, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ab7, 7); // ld a,(de) -- byte 2
  mem.write8(0xa827, regs.a);
  m.step(0x1aba, 13); // ld (0xa827),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1abb, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1abc, 7); // ld a,(de) -- byte 3
  mem.write8(0xa817, regs.a);
  m.step(0x1abf, 13); // ld (0xa817),a
  mem.write8(0xa814, regs.a);
  m.step(0x1ac2, 13); // ld (0xa814),a -- same byte, second cell
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ac3, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ac4, 7); // ld a,(de) -- byte 4
  mem.write8(0xacc1, regs.a);
  m.step(0x1ac7, 13); // ld (0xacc1),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ac8, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ac9, 7); // ld a,(de) -- byte 5
  mem.write8(0xacc4, regs.a);
  m.step(0x1acc, 13); // ld (0xacc4),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1acd, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ace, 7); // ld a,(de) -- byte 6
  mem.write8(0xa8c6, regs.a);
  m.step(0x1ad1, 13); // ld (0xa8c6),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ad2, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ad3, 7); // ld a,(de) -- byte 7
  mem.write8(0xa8d6, regs.a);
  m.step(0x1ad6, 13); // ld (0xa8d6),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ad7, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ad8, 7); // ld a,(de) -- byte 8
  mem.write8(0xa8e6, regs.a);
  m.step(0x1adb, 13); // ld (0xa8e6),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1adc, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1add, 7); // ld a,(de) -- byte 9
  mem.write8(0xa8f4, regs.a);
  m.step(0x1ae0, 13); // ld (0xa8f4),a
  mem.write8(0xa8f6, regs.a);
  m.step(0x1ae3, 13); // ld (0xa8f6),a -- same byte, second cell

  m.ret(10); // 1ae3  ret
}
