// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c4f  (ROM 0x2C4F–0x2C6F) — ROM 0x2C4F entry (from entry_2c7b jp 0x2c4f): stores caller's A at.
 *  0x638f (0x6382 NOT written on this entry), then the gate + free-slot search.
 */
export function loc_2c4f(m) {
  const { regs, mem } = m;
  mem.write8(0x638f, regs.a); // ld (0x638f),a
  m.step(0x2c52, 13); // ld (0x638f),a
  regs.a = 0x01;
  m.step(0x2c54, 7); // ld a,0x01
  mem.write8(0x6392, regs.a);
  m.step(0x2c57, 13); // ld (0x6392),a

  regs.a = mem.read8(0x62b2);
  m.step(0x2c5a, 13); // ld a,(0x62b2)
  regs.cp(regs.c); // cp c -- C is the entry_2c03 live-in
  m.step(0x2c5b, 4); // cp c
  if (regs.fNZ) {
    m.ret(11); // ret nz -- returns unless (0x62b2) == C
    return;
  }
  m.step(0x2c5c, 5); // ret nz not taken

  regs.sub(0x08);
  m.step(0x2c5e, 7); // sub 0x08
  mem.write8(0x62b2, regs.a); // (0x62b2) -= 8 (RMW)
  m.step(0x2c61, 13); // ld (0x62b2),a
  regs.de = 0x0020;
  m.step(0x2c64, 10); // ld de,0x0020
  regs.hl = 0x6400;
  m.step(0x2c67, 10); // ld hl,0x6400
  regs.b = 0x05;
  m.step(0x2c69, 7); // ld b,0x05

  do {
    // loc_2c69: find the FIRST ZERO of 5 records at 0x6400 stride 0x20 (draft TEST 2)
    regs.a = mem.read8(regs.hl);
    m.step(0x2c6a, 7); // ld a,(hl)
    regs.and(regs.a); // and a -- test (hl) for zero
    m.step(0x2c6b, 4); // and a
    if (regs.fZ) {
      m.step(0x2c72, 10); // jp z,0x2c72 taken (tail) -- free slot found
      return m.call(0x2c72); // entry_2c72 IS translated (0acc93f): set bit 7 of 0x6382
    }
    m.step(0x2c6e, 10); // jp z,0x2c72 not taken
    regs.addHl(regs.de); // add hl,de -- next record
    m.step(0x2c6f, 11); // add hl,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2c69 : 0x2c71, regs.b !== 0 ? 13 : 8); // djnz 0x2c69
  } while (regs.b !== 0);

  m.ret(); // 0x2C71 -- no free slot in the 5 records
}
