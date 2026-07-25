// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_13ca  (ROM 0x13CA–0x141D) — shared helper: BCD unpack + fill + 3-byte-subtract sort pass.
 *
 * PARAMETERS: HL = 3-byte source (ldir), A = value stored to 0x61C6. From both callers:
 * loc_12f2 (HL=0x60B2, A=0x01), loc_1344 (HL=0x60B5, A=0x03).
 *
 * !! rst 0x08 (0x13CE) is a CALLER-SKIP -- SKIPS when bit0 of 0x6007 SET. push16 + guard. !!
 * !! FOUR rrca (0x13DC-0x13DF) -- emit EXPLICITLY, NOT a loop. !!
 * !! sub (hl)/sbc a,(hl)/sbc a,(hl) is a 3-byte multi-precision subtract; the carry chain is
 *    load-bearing. sbc a,(hl) is a FIRST-USE of the memory form. !!
 * Translated for completeness; not yet wired into the live dispatcher.
 */
export function sub_13ca(m) {
  const { regs, mem } = m;

  regs.de = 0x61c6;
  m.step(0x13cd, 10); // ld de,0x61c6
  mem.write8(regs.de, regs.a); // ld (de),a -- store the A parameter
  m.step(0x13ce, 7);

  m.push16(0x13cf); // rst 0x08 pushes its return address
  m.step(0x0008, 11); // rst 0x08
  if (!m.call(0x0008)) return; // SKIP: bit0 of 0x6007 set -> aborted to caller

  regs.de = (regs.de + 1) & 0xffff; // inc de -- DE = 0x61C7
  m.step(0x13d0, 6);
  regs.bc = 0x0003;
  m.step(0x13d3, 10); // ld bc,0x0003
  m.ldir(0x13d5); // ldir -- copy 3 bytes from HL(param) to 0x61C7. Leaves DE=0x61CA, HL=src+3

  // -- BCD unpack loop (x3): each source byte -> high nibble then low nibble --
  regs.b = 0x03;
  m.step(0x13d7, 7); // ld b,0x03
  regs.hl = 0x61b1;
  m.step(0x13da, 10); // ld hl,0x61b1
  do {
    regs.de = (regs.de - 1) & 0xffff; // dec de
    m.step(0x13db, 6);
    regs.a = mem.read8(regs.de); // ld a,(de)
    m.step(0x13dc, 7);
    regs.rrca(); m.step(0x13dd, 4); // rrca  (FOUR explicit -- NOT a loop)
    regs.rrca(); m.step(0x13de, 4); // rrca
    regs.rrca(); m.step(0x13df, 4); // rrca
    regs.rrca(); m.step(0x13e0, 4); // rrca
    regs.and(0x0f); // high nibble
    m.step(0x13e2, 7); // and 0x0f
    mem.write8(regs.hl, regs.a);
    m.step(0x13e3, 7); // ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x13e4, 6); // inc hl
    regs.a = mem.read8(regs.de); // ld a,(de) -- re-read
    m.step(0x13e5, 7);
    regs.and(0x0f); // low nibble
    m.step(0x13e7, 7); // and 0x0f
    mem.write8(regs.hl, regs.a);
    m.step(0x13e8, 7); // ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x13e9, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x13da : 0x13eb, regs.b !== 0 ? 13 : 8); // djnz 0x13da
  } while (regs.b !== 0);

  // -- fill loop (x14): 0x10, then a 0x3F terminator --
  regs.b = 0x0e;
  m.step(0x13ed, 7); // ld b,0x0e
  do {
    mem.write8(regs.hl, 0x10);
    m.step(0x13ef, 10); // ld (hl),0x10
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x13f0, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x13ed : 0x13f2, regs.b !== 0 ? 13 : 8); // djnz 0x13ed
  } while (regs.b !== 0);
  mem.write8(regs.hl, 0x3f);
  m.step(0x13f4, 10); // ld (hl),0x3f

  // -- compare-and-swap: up to 5 passes --
  regs.b = 0x05;
  m.step(0x13f6, 7); // ld b,0x05
  regs.hl = 0x61a5;
  m.step(0x13f9, 10); // ld hl,0x61a5
  regs.de = 0x61c7;
  m.step(0x13fc, 10); // ld de,0x61c7
  for (;;) {
    // -- loc_13fc: 3-byte multi-precision subtract (de[] - hl[]) --
    regs.a = mem.read8(regs.de); m.step(0x13fd, 7); // ld a,(de)
    regs.sub(mem.read8(regs.hl)); m.step(0x13fe, 7); // sub (hl) -- sets borrow
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x13ff, 6); // inc hl
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1400, 6); // inc de
    regs.a = mem.read8(regs.de); m.step(0x1401, 7); // ld a,(de)
    regs.sbc(mem.read8(regs.hl)); m.step(0x1402, 7); // sbc a,(hl) -- carry chain (FIRST-USE mem form)
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1403, 6); // inc hl
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1404, 6); // inc de
    regs.a = mem.read8(regs.de); m.step(0x1405, 7); // ld a,(de)
    regs.sbc(mem.read8(regs.hl)); m.step(0x1406, 7); // sbc a,(hl)
    if (regs.fC) { m.ret(11); return; } // ret c -- borrow, 4th exit
    m.step(0x1407, 5);

    // -- swap 25 bytes (backward), preserving the outer count --
    m.push16(regs.bc); // push bc -- save outer B=5
    m.step(0x1408, 11);
    regs.b = 0x19;
    m.step(0x140a, 7); // ld b,0x19
    do {
      regs.c = mem.read8(regs.hl); m.step(0x140b, 7); // ld c,(hl)
      regs.a = mem.read8(regs.de); m.step(0x140c, 7); // ld a,(de)
      mem.write8(regs.hl, regs.a); m.step(0x140d, 7); // ld (hl),a
      regs.a = regs.c; m.step(0x140e, 4); // ld a,c
      mem.write8(regs.de, regs.a); m.step(0x140f, 7); // ld (de),a
      regs.hl = (regs.hl - 1) & 0xffff; m.step(0x1410, 6); // dec hl
      regs.de = (regs.de - 1) & 0xffff; m.step(0x1411, 6); // dec de
      regs.djnz();
      m.step(regs.b !== 0 ? 0x140a : 0x1413, regs.b !== 0 ? 13 : 8); // djnz 0x140a
    } while (regs.b !== 0);

    regs.bc = 0xfff5; // -11
    m.step(0x1416, 10); // ld bc,0xfff5
    regs.addHl(regs.bc); // add hl,bc -- HL -= 11
    m.step(0x1417, 11);
    regs.exDeHl(); m.step(0x1418, 4); // ex de,hl
    regs.addHl(regs.bc); // add hl,bc -- (the other pointer) -= 11
    m.step(0x1419, 11);
    regs.exDeHl(); m.step(0x141a, 4); // ex de,hl
    regs.bc = m.pop16(); // pop bc -- restore outer B
    m.step(0x141b, 10);
    regs.djnz();
    if (regs.b !== 0) { m.step(0x13fc, 13); continue; } // djnz 0x13fc
    m.step(0x141d, 8);
    m.ret();
    return;
  }
}
