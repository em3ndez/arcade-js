// SPDX-License-Identifier: GPL-3.0-only

// loc_1952  (ROM 0x1952-0x1A01) — frog sprite render: three column-copy loops write the 4-byte
// tile groups at ROM 0x19F6/0x19FA/0x19FE down VRAM columns 0xA843/0xA8A4/0xA8A5 (stride 0x20),
// paint the 0x47 banner column at 0xA8C3, seed corner tiles + (0x8007/8009/800b)=1, then jp loc_1a02.
export function loc_1952(m) {
  const { regs, mem } = m;

  regs.hl = 0xa843;
  m.step(0x1955, 10);
  regs.c = 0x05;
  m.step(0x1957, 7); // C = 5 columns

  for (;;) {
    // loc_1957: one column, 4 tiles from ROM 0x19f6
    regs.de = 0x19f6;
    m.step(0x195a, 10);
    regs.b = 0x04;
    m.step(0x195c, 7);
    for (;;) {
      // loc_195c: copy one tile down, HL += 0x20 (BC saved across the add)
      regs.a = mem.read8(regs.de);
      m.step(0x195d, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x195e, 7);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x195f, 6);
      m.push16(regs.bc);
      m.step(0x1960, 11);
      regs.bc = 0x0020;
      m.step(0x1963, 10);
      regs.addHl(regs.bc);
      m.step(0x1964, 11); // HL += 0x20 -- next VRAM row
      regs.bc = m.pop16();
      m.step(0x1965, 10);
      if (regs.djnz() !== 0) {
        m.step(0x195c, 13);
        continue;
      }
      m.step(0x1967, 8);
      break;
    }
    regs.de = 0x0040;
    m.step(0x196a, 10);
    regs.addHl(regs.de);
    m.step(0x196b, 11); // HL += 0x40 -- next column
    regs.c = regs.dec8(regs.c);
    m.step(0x196c, 4);
    if (regs.fNZ) {
      m.step(0x1957, 10);
      continue;
    }
    m.step(0x196f, 10);
    break;
  }

  regs.hl = 0xa8a4;
  m.step(0x1972, 10);
  regs.c = 0x04;
  m.step(0x1974, 7);

  for (;;) {
    // loc_1974: second column set, 4 tiles from ROM 0x19fa
    regs.de = 0x19fa;
    m.step(0x1977, 10);
    regs.b = 0x04;
    m.step(0x1979, 7);
    for (;;) {
      regs.a = mem.read8(regs.de);
      m.step(0x197a, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x197b, 7);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x197c, 6);
      m.push16(regs.bc);
      m.step(0x197d, 11);
      regs.bc = 0x0020;
      m.step(0x1980, 10);
      regs.addHl(regs.bc);
      m.step(0x1981, 11);
      regs.bc = m.pop16();
      m.step(0x1982, 10);
      if (regs.djnz() !== 0) {
        m.step(0x1979, 13);
        continue;
      }
      m.step(0x1984, 8);
      break;
    }
    regs.de = 0x0040;
    m.step(0x1987, 10);
    regs.addHl(regs.de);
    m.step(0x1988, 11);
    regs.c = regs.dec8(regs.c);
    m.step(0x1989, 4);
    if (regs.fNZ) {
      m.step(0x1974, 10);
      continue;
    }
    m.step(0x198c, 10);
    break;
  }

  regs.hl = 0xa8a5;
  m.step(0x198f, 10);
  regs.c = 0x04;
  m.step(0x1991, 7);

  for (;;) {
    // loc_1991: third column set, 4 tiles from ROM 0x19fe
    regs.de = 0x19fe;
    m.step(0x1994, 10);
    regs.b = 0x04;
    m.step(0x1996, 7);
    for (;;) {
      regs.a = mem.read8(regs.de);
      m.step(0x1997, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x1998, 7);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x1999, 6);
      m.push16(regs.bc);
      m.step(0x199a, 11);
      regs.bc = 0x0020;
      m.step(0x199d, 10);
      regs.addHl(regs.bc);
      m.step(0x199e, 11);
      regs.bc = m.pop16();
      m.step(0x199f, 10);
      if (regs.djnz() !== 0) {
        m.step(0x1996, 13);
        continue;
      }
      m.step(0x19a1, 8);
      break;
    }
    regs.de = 0x0040;
    m.step(0x19a4, 10);
    regs.addHl(regs.de);
    m.step(0x19a5, 11);
    regs.c = regs.dec8(regs.c);
    m.step(0x19a6, 4);
    if (regs.fNZ) {
      m.step(0x1991, 10);
      continue;
    }
    m.step(0x19a9, 10);
    break;
  }

  regs.hl = 0xa8c3;
  m.step(0x19ac, 10);
  regs.b = 0x04;
  m.step(0x19ae, 7);

  for (;;) {
    // loc_19ae: 0x47 banner tiles, HL += 0x20 then += 0xa0 per pair
    mem.write8(regs.hl, 0x47);
    m.step(0x19b0, 10);
    regs.de = 0x0020;
    m.step(0x19b3, 10);
    regs.addHl(regs.de);
    m.step(0x19b4, 11);
    mem.write8(regs.hl, 0x47);
    m.step(0x19b6, 10);
    regs.de = 0x00a0;
    m.step(0x19b9, 10);
    regs.addHl(regs.de);
    m.step(0x19ba, 11);
    if (regs.djnz() !== 0) {
      m.step(0x19ae, 13);
      continue;
    }
    m.step(0x19bc, 8);
    break;
  }

  regs.hl = 0xa844;
  m.step(0x19bf, 10);
  mem.write8(regs.hl, 0x41);
  m.step(0x19c1, 10); // corner tile 0x41
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x19c2, 6);
  mem.write8(regs.hl, 0x42);
  m.step(0x19c4, 10); // corner tile 0x42
  regs.bc = 0x035f;
  m.step(0x19c7, 10);
  regs.addHl(regs.bc);
  m.step(0x19c8, 11); // HL += 0x35f -- bottom corner
  mem.write8(regs.hl, 0x45);
  m.step(0x19ca, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x19cb, 6);
  mem.write8(regs.hl, 0x46);
  m.step(0x19cd, 10);

  regs.hl = 0xa85c;
  m.step(0x19d0, 10);
  m.push16(0x19d3);
  m.step(0x19e2, 17);
  m.call(0x19e2); // blit the 0x0e-row tile string from HL

  regs.hl = 0x8007;
  m.step(0x19d6, 10);
  regs.a = 0x01;
  m.step(0x19d8, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x19d9, 7); // (0x8007) = 1
  regs.l = regs.inc8(regs.l);
  m.step(0x19da, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x19db, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x19dc, 7); // (0x8009) = 1
  regs.l = regs.inc8(regs.l);
  m.step(0x19dd, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x19de, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x19df, 7); // (0x800b) = 1

  m.step(0x1a02, 10);
  return m.call(0x1a02); // jp loc_1a02 -- tail into object-anim init
}
