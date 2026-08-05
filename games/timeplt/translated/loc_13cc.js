// SPDX-License-Identifier: GPL-3.0-only

// loc_13cc  (ROM 0x13CC-0x1429, Time Pilot)
export function loc_13cc(m) {
  const { regs, mem } = m;

  regs.a = 0x05;
  m.step(0x13ce, 7); // ld a,0x05

  mem.write8(0xa9f0, regs.a);
  m.step(0x13d1, 13); // ld (0xa9f0),a -- step 5

  regs.a = mem.read8(0xad32);
  m.step(0x13d4, 13); // ld a,(0xad32)

  regs.and(regs.a);
  m.step(0x13d5, 4); // and a

  regs.a = mem.read8(0xad1c);
  m.step(0x13d8, 13); // ld a,(0xad1c) -- sets no flags

  regs.b = regs.a;
  m.step(0x13d9, 4); // ld b,a -- sets no flags

  if (regs.fZ) {
    m.step(0x13df, 12); // jr z,0x13df (taken)
  } else {
    m.step(0x13db, 7); // jr z,0x13df (not taken)

    regs.a = mem.read8(0xad2c);
    m.step(0x13de, 13); // ld a,(0xad2c)

    regs.b = regs.a;
    m.step(0x13df, 4); // ld b,a
  }

  regs.a = mem.read8(0xa987);
  m.step(0x13e2, 13); // ld a,(0xa987) -- the screen-flip flag

  regs.and(regs.a);
  m.step(0x13e3, 4); // and a

  regs.a = regs.b;
  m.step(0x13e4, 4); // ld a,b -- sets no flags; A is now the fill byte

  if (regs.fZ) {
    m.step(0x1408, 12); // jr z,0x1408 (taken) -- the descending copy

    regs.hl = 0xa3be;
    m.step(0x140b, 10); // ld hl,0xa3be

    regs.de = 0xa3bd;
    m.step(0x140e, 10); // ld de,0xa3bd

    regs.exx();
    m.step(0x140f, 4); // exx

    regs.b = 0x1c;
    m.step(0x1411, 7); // ld b,0x1c -- 28 rows, in the alternate B

    do {
      regs.exx();
      m.step(0x1412, 4); // exx -- back to the pointer set

      regs.bc = 0x001a;
      m.step(0x1415, 10); // ld bc,0x001a

      mem.write8(regs.hl, regs.a);
      m.step(0x1416, 7); // ld (hl),a -- seed the row

      m.lddrAt(0x1416, 0x1418); // 1416  lddr

      regs.de = 0xfffa;
      m.step(0x141b, 10); // ld de,0xfffa

      regs.addHl(regs.de);
      m.step(0x141c, 11); // add hl,de -- down to the next row

      regs.d = regs.h;
      m.step(0x141d, 4); // ld d,h

      regs.e = regs.l;
      m.step(0x141e, 4); // ld e,l

      regs.de = (regs.de - 1) & 0xffff;
      m.step(0x141f, 6); // dec de -- no flags

      regs.exx();
      m.step(0x1420, 4); // exx -- reach the row counter

      regs.djnz(); // djnz -- no flags
      m.step(regs.b !== 0 ? 0x1411 : 0x1422, regs.b !== 0 ? 13 : 8); // djnz 0x1411
    } while (regs.b !== 0);

    regs.a = mem.read8(0xa9f6);
    m.step(0x1425, 13); // ld a,(0xa9f6)

    regs.a = regs.dec8(regs.a);
    m.step(0x1426, 4); // dec a

    mem.write8(0xa9f6, regs.a);
    m.step(0x1429, 13); // ld (0xa9f6),a

    m.ret(); // 1429  ret
    return;
  }
  m.step(0x13e6, 7); // jr z,0x1408 (not taken) -- the ascending copy

  regs.hl = 0xa044;
  m.step(0x13e9, 10); // ld hl,0xa044

  regs.de = 0xa045;
  m.step(0x13ec, 10); // ld de,0xa045

  regs.exx();
  m.step(0x13ed, 4); // exx

  regs.b = 0x1c;
  m.step(0x13ef, 7); // ld b,0x1c -- 28 rows, in the alternate B

  do {
    regs.exx();
    m.step(0x13f0, 4); // exx -- back to the pointer set

    regs.bc = 0x001a;
    m.step(0x13f3, 10); // ld bc,0x001a

    mem.write8(regs.hl, regs.a);
    m.step(0x13f4, 7); // ld (hl),a -- seed the row

    m.ldirAt(0x13f4, 0x13f6); // ldir -- propagate it across 27 cells

    regs.de = 0x0006;
    m.step(0x13f9, 10); // ld de,0x0006

    regs.addHl(regs.de);
    m.step(0x13fa, 11); // add hl,de -- up to the next row

    regs.d = regs.h;
    m.step(0x13fb, 4); // ld d,h

    regs.e = regs.l;
    m.step(0x13fc, 4); // ld e,l

    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x13fd, 6); // inc de -- no flags

    regs.exx();
    m.step(0x13fe, 4); // exx -- reach the row counter

    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x13ef : 0x1400, regs.b !== 0 ? 13 : 8); // djnz 0x13ef
  } while (regs.b !== 0);

  regs.a = mem.read8(0xa9f6);
  m.step(0x1403, 13); // ld a,(0xa9f6)

  regs.a = regs.dec8(regs.a);
  m.step(0x1404, 4); // dec a

  mem.write8(0xa9f6, regs.a);
  m.step(0x1407, 13); // ld (0xa9f6),a

  m.ret(); // 1407  ret
}
