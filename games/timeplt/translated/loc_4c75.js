// SPDX-License-Identifier: GPL-3.0-only

// loc_4c75  (ROM 0x4C75–0x4CB3)
export function loc_4c75(m) {
  const { regs, mem } = m;

  m.push16(0x4c78);
  m.step(0x07d2, 17); // call 0x07d2
  m.call(0x07d2);

  regs.a = mem.read8(0xad32);
  m.step(0x4c7b, 13); // ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x4c7c, 4); // and a
  regs.hl = 0xad10; // player 1 record
  m.step(0x4c7f, 10); // ld hl,0xad10

  if (regs.fZ) {
    m.step(0x4c84, 12); // jr z,0x4c84 (taken)
  } else {
    m.step(0x4c81, 7); // jr z,0x4c84 (not taken)
    regs.hl = 0xad20; // player 2 record
    m.step(0x4c84, 10); // ld hl,0xad20
  }

  regs.de = 0xad00;
  m.step(0x4c87, 10); // ld de,0xad00
  regs.bc = 0x0010;
  m.step(0x4c8a, 10); // ld bc,0x0010
  m.ldirAt(0x4c8a, 0x4c8c); // ldir -- 16 bytes into 0xAD00; leaves HL=src+16, DE=0xAD10

  regs.a = mem.read8(0xad30);
  m.step(0x4c8f, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x4c90, 4); // and a

  if (regs.fZ) {
    m.step(0x0f1a, 10);
    return m.call(0x0f1a);
  }
  m.step(0x4c93, 10); // jp z,0x0f1a (not taken)

  regs.a = mem.read8(0xad01);
  m.step(0x4c96, 13); // ld a,(0xad01)
  regs.d = 0x06;
  m.step(0x4c98, 7); // ld d,0x06
  regs.e = regs.a;
  m.step(0x4c99, 4); // ld e,a
  m.push16(0x4c9a);
  m.step(0x0038, 11); // rst 0x38 -- append (D,E) to the 0xAC00 command ring
  m.call(0x0038);

  regs.a = mem.read8(0xad00);
  m.step(0x4c9d, 13); // ld a,(0xad00)
  regs.a = regs.dec8(regs.a);
  m.step(0x4c9e, 4); // dec a
  regs.d = 0x05;
  m.step(0x4ca0, 7); // ld d,0x05
  regs.e = regs.a;
  m.step(0x4ca1, 4); // ld e,a
  m.push16(0x4ca2);
  m.step(0x0038, 11); // rst 0x38 -- append the second (D,E) to the ring
  m.call(0x0038);

  regs.b = 0x00; // djnz wraps 0x00 -> 0xFF: 256 iterations
  m.step(0x4ca4, 7); // ld b,0x00
  regs.hl = 0x5b50;
  m.step(0x4ca7, 10); // ld hl,0x5b50
  regs.sub(regs.a); // sub a -- A = 0
  m.step(0x4ca8, 4); // sub a

  do {
    regs.xor(mem.read8(regs.hl));
    m.step(0x4ca9, 7); // xor (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4caa, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4ca8 : 0x4cac, regs.b !== 0 ? 13 : 8); // djnz 0x4ca8
  } while (regs.b !== 0);

  regs.add(0xff); // A - 1, and carry set iff A was non-zero
  m.step(0x4cae, 7); // add a,0xff
  mem.write8(0xc308, regs.a, 10); // LS259 control latch, not work RAM
  m.step(0x4cb1, 13); // ld (0xc308),a

  m.step(0x0f1a, 10);
  return m.call(0x0f1a);
}
