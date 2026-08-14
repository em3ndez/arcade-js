// SPDX-License-Identifier: GPL-3.0-only

// loc_219c  (ROM 0x219C-0x2230) — column-N scroll-wrap handler. From the 3-byte descriptor at 0x827C
// (IX+0 = column, IX+1 = unit count, IX+2 = row count) it computes a VIDEO-RAM band base, then the
// mode at (0x8111) selects one of three tile rows (0x2231/0x2235/0x2239) which the folded copy helper
// (0x2219) blits down the band 0x03 times; the tail (0x2229) stores (row-1) to (0x8119). IX flags.
export function loc_219c(m) {
  const { regs, mem } = m;

  regs.ix = 0x827c;
  m.step(0x21a0, 14);
  regs.xor(regs.a);
  m.step(0x21a1, 4);
  regs.h = regs.a;
  m.step(0x21a2, 4);
  regs.b = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x21a5, 19); // ld b,(ix+0x01) -- B = the unit count
  return block_21a5();

  function block_21a5() {
    regs.add(0x20);
    m.step(0x21a7, 7); // add a,0x20 -- A accrues 0x20 per unit
    if (m.regs.djnz() !== 0) {
      m.step(0x21a5, 13);
      return block_21a5();
    }
    m.step(0x21a9, 8);
    regs.c = regs.a;
    m.step(0x21aa, 4);
    regs.l = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x21ad, 19); // ld l,(ix+0x00) -- L = the column
    regs.addHl(regs.bc);
    m.step(0x21ae, 11); // HL = column + 0x20*units
    regs.e = regs.l;
    m.step(0x21af, 4);
    regs.d = regs.h;
    m.step(0x21b0, 4); // DE = the per-row stride
    regs.xor(regs.a);
    m.step(0x21b1, 4);
    regs.l = regs.a;
    m.step(0x21b2, 4);
    regs.h = regs.a;
    m.step(0x21b3, 4);
    regs.b = mem.read8((regs.ix + 0x02) & 0xffff);
    m.step(0x21b6, 19); // ld b,(ix+0x02) -- B = the row count
    regs.b = regs.dec8(regs.b);
    m.step(0x21b7, 4);
    return block_21b7();
  }

  function block_21b7() {
    regs.addHl(regs.de);
    m.step(0x21b8, 11); // HL += stride, (rows-1) times
    if (m.regs.djnz() !== 0) {
      m.step(0x21b7, 13);
      return block_21b7();
    }
    m.step(0x21ba, 8);
    regs.de = 0xa80e;
    m.step(0x21bd, 10); // ld de,0xa80e -- the video-RAM band base
    regs.addHl(regs.de);
    m.step(0x21be, 11); // HL = the band's top cell
    regs.c = 0x03;
    m.step(0x21c0, 7); // ld c,0x03 -- the band repeat count
    regs.a = mem.read8(0x8111);
    m.step(0x21c3, 13); // ld a,(0x8111) -- the scroll-phase mode
    regs.cp(0x00);
    m.step(0x21c5, 7);
    if (regs.fZ) {
      m.step(0x21df, 10);
      return block_21df();
    }
    m.step(0x21c8, 10);
    regs.cp(0x30);
    m.step(0x21ca, 7);
    if (regs.fZ) {
      m.step(0x21ed, 10);
      return block_21ed();
    }
    m.step(0x21cd, 10);
    regs.cp(0x50);
    m.step(0x21cf, 7);
    if (regs.fZ) {
      m.step(0x2206, 10);
      return block_2206();
    }
    m.step(0x21d2, 10);
    regs.cp(0x60);
    m.step(0x21d4, 7);
    if (regs.fZ) {
      m.step(0x21ed, 10);
      return block_21ed();
    }
    m.step(0x21d7, 10);
    regs.cp(0x70);
    m.step(0x21d9, 7);
    if (regs.fZ) {
      m.step(0x21df, 10);
      return block_21df();
    }
    m.step(0x21dc, 10);
    m.step(0x2229, 10); // jp 0x2229 -- mode outside the table
    return block_2229();
  }

  function block_21df() {
    regs.b = 0x02;
    m.step(0x21e1, 7);
    regs.de = 0x2231;
    m.step(0x21e4, 10); // ld de,0x2231 -- source row A
    m.push16(0x21e7);
    m.step(0x2219, 17);
    block_2219();
    regs.c = regs.dec8(regs.c);
    m.step(0x21e8, 4);
    if (regs.fNZ) {
      m.step(0x21df, 12);
      return block_21df();
    }
    m.step(0x21ea, 7);
    m.step(0x2229, 10);
    return block_2229();
  }

  function block_21ed() {
    regs.b = 0x02;
    m.step(0x21ef, 7);
    regs.de = 0x2235;
    m.step(0x21f2, 10); // ld de,0x2235 -- source row B
    m.push16(0x21f5);
    m.step(0x2219, 17);
    block_2219();
    regs.c = regs.dec8(regs.c);
    m.step(0x21f6, 4);
    if (regs.fNZ) {
      m.step(0x21ed, 12);
      return block_21ed();
    }
    m.step(0x21f8, 7);
    regs.a = mem.read8(0x8108);
    m.step(0x21fb, 13); // ld a,(0x8108) -- the wrap-latch
    regs.and(regs.a);
    m.step(0x21fc, 4);
    if (regs.fZ) {
      m.step(0x2229, 10);
      return block_2229();
    }
    m.step(0x21ff, 10);
    regs.xor(regs.a);
    m.step(0x2200, 4);
    mem.write8(0x8108, regs.a);
    m.step(0x2203, 13); // (0x8108) = 0 -- clear the wrap-latch
    m.step(0x2229, 10);
    return block_2229();
  }

  function block_2206() {
    regs.b = 0x02;
    m.step(0x2208, 7);
    regs.de = 0x2239;
    m.step(0x220b, 10); // ld de,0x2239 -- source row C
    m.push16(0x220e);
    m.step(0x2219, 17);
    block_2219();
    regs.c = regs.dec8(regs.c);
    m.step(0x220f, 4);
    if (regs.fNZ) {
      m.step(0x2206, 12);
      return block_2206();
    }
    m.step(0x2211, 7);
    regs.a = 0x01;
    m.step(0x2213, 7);
    mem.write8(0x8108, regs.a);
    m.step(0x2216, 13); // (0x8108) = 1 -- set the wrap-latch
    m.step(0x2229, 10);
    return block_2229();
  }

  // Folded copy helper (ROM 0x2219-0x2228): B pairs from (DE) to (HL), advancing HL by one full row
  // (0x20) per pair. Reached only by the three `call 0x2219` sites above; direct-called, not registered.
  function block_2219() {
    regs.a = mem.read8(regs.de);
    m.step(0x221a, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x221b, 7);
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x221c, 6);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x221d, 6);
    regs.a = mem.read8(regs.de);
    m.step(0x221e, 7);
    mem.write8(regs.hl, regs.a);
    m.step(0x221f, 7);
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x2220, 6);
    m.push16(regs.de);
    m.step(0x2221, 11);
    regs.de = 0x001f;
    m.step(0x2224, 10); // ld de,0x001f -- +0x1f after the two inc hl = one row down
    regs.addHl(regs.de);
    m.step(0x2225, 11);
    regs.de = m.pop16();
    m.step(0x2226, 10);
    if (m.regs.djnz() !== 0) {
      m.step(0x2219, 13);
      return block_2219();
    }
    m.step(0x2228, 8);
    m.ret();
  }

  // Folded tail (ROM 0x2229-0x2230): reached by every `jp 0x2229` above.
  function block_2229() {
    regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
    m.step(0x222c, 19); // ld a,(ix+0x02) -- the row count
    regs.a = regs.dec8(regs.a);
    m.step(0x222d, 4);
    mem.write8(0x8119, regs.a);
    m.step(0x2230, 13); // (0x8119) = rows - 1
    m.ret();
  }
}
