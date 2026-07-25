// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1087  (ROM 0x1087–0x1120) — inline-table arm C=3: table copies + two fill loops + IX=0x6400 init block + ldir.
 */
export function loc_1087(m) {
  const { regs, mem } = m;
  regs.hl = 0x3dec;
  m.step(0x108a, 10); // ld hl,0x3dec
  regs.de = 0x6407;
  m.step(0x108d, 10); // ld de,0x6407
  regs.bc = 0x051c;
  m.step(0x1090, 10); // ld bc,0x051c
  m.push16(0x1093); m.step(0x122a, 17); m.call(0x122a);
  m.push16(0x1096); m.step(0x1186, 17); m.call(0x1186);
  regs.hl = 0x6600;
  m.step(0x1099, 10); // ld hl,0x6600
  regs.de = 0x0010;
  m.step(0x109c, 10); // ld de,0x0010
  regs.a = 0x01;
  m.step(0x109e, 7); // ld a,0x01
  regs.b = 0x06;
  m.step(0x10a0, 7); // ld b,0x06
  do {
    // -- loc_10a0: fill 6 cells stride 0x10 --
    mem.write8(regs.hl, regs.a);
    m.step(0x10a1, 7); // ld (hl),a
    regs.addHl(regs.de);
    m.step(0x10a2, 11); // add hl,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x10a0 : 0x10a4, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  regs.c = 0x02;
  m.step(0x10a6, 7); // ld c,0x02
  regs.a = 0x08;
  m.step(0x10a8, 7); // ld a,0x08
  do {
    // -- loc_10a8 outer (HL reset each pass -> both passes write the same 3 cells) --
    regs.b = 0x03;
    m.step(0x10aa, 7); // ld b,0x03
    regs.hl = 0x660d;
    m.step(0x10ad, 10); // ld hl,0x660d
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x10ae, 7); // ld (hl),a
      regs.addHl(regs.de);
      m.step(0x10af, 11); // add hl,de
      regs.djnz();
      m.step(regs.b !== 0 ? 0x10ad : 0x10b1, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    regs.a = 0x08;
    m.step(0x10b3, 7); // ld a,0x08
    regs.c = regs.dec8(regs.c);
    m.step(0x10b4, 4); // dec c
    m.step(regs.fNZ ? 0x10a8 : 0x10b7, 10); // jp nz,0x10a8
  } while (regs.fNZ);
  regs.hl = 0x3e64;
  m.step(0x10ba, 10); // ld hl,0x3e64
  regs.de = 0x6603;
  m.step(0x10bd, 10); // ld de,0x6603
  regs.bc = 0x060e;
  m.step(0x10c0, 10); // ld bc,0x060e
  m.push16(0x10c3); m.step(0x11ec, 17); m.call(0x11ec);
  regs.hl = 0x3e60;
  m.step(0x10c6, 10); // ld hl,0x3e60
  regs.de = 0x6607;
  m.step(0x10c9, 10); // ld de,0x6607
  regs.bc = 0x060c;
  m.step(0x10cc, 10); // ld bc,0x060c
  m.push16(0x10cf); m.step(0x122a, 17); m.call(0x122a);
  regs.ix = 0x6600;
  m.step(0x10d3, 14); // ld ix,0x6600
  regs.hl = 0x6958;
  m.step(0x10d6, 10); // ld hl,0x6958
  regs.b = 0x06;
  m.step(0x10d8, 7); // ld b,0x06
  regs.de = 0x0010;
  m.step(0x10db, 10); // ld de,0x0010
  m.push16(0x10de); m.step(0x11d3, 17); m.call(0x11d3);
  regs.hl = 0x3e48;
  m.step(0x10e1, 10); // ld hl,0x3e48
  regs.de = 0x6a0c;
  m.step(0x10e4, 10); // ld de,0x6a0c
  regs.bc = 0x000c;
  m.step(0x10e7, 10); // ld bc,0x000c
  m.ldir(0x10e9);
  regs.ix = 0x6400;
  m.step(0x10ed, 14); // ld ix,0x6400
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x00), 0x01);
  m.step(0x10f1, 19); // ld (ix+0x00),0x01
  mem.write8(R(0x03), 0x58);
  m.step(0x10f5, 19); // ld (ix+0x03),0x58
  mem.write8(R(0x0e), 0x58);
  m.step(0x10f9, 19); // ld (ix+0x0e),0x58
  mem.write8(R(0x05), 0x80);
  m.step(0x10fd, 19); // ld (ix+0x05),0x80
  mem.write8(R(0x0f), 0x80);
  m.step(0x1101, 19); // ld (ix+0x0f),0x80
  mem.write8(R(0x20), 0x01);
  m.step(0x1105, 19); // ld (ix+0x20),0x01
  mem.write8(R(0x23), 0xeb);
  m.step(0x1109, 19); // ld (ix+0x23),0xeb
  mem.write8(R(0x2e), 0xeb);
  m.step(0x110d, 19); // ld (ix+0x2e),0xeb
  mem.write8(R(0x25), 0x60);
  m.step(0x1111, 19); // ld (ix+0x25),0x60
  mem.write8(R(0x2f), 0x60);
  m.step(0x1115, 19); // ld (ix+0x2f),0x60
  regs.de = 0x6970;
  m.step(0x1118, 10); // ld de,0x6970
  regs.hl = 0x1121;
  m.step(0x111b, 10); // ld hl,0x1121
  regs.bc = 0x0010;
  m.step(0x111e, 10); // ld bc,0x0010
  m.ldir(0x1120);
  m.ret();
}
