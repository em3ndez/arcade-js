// SPDX-License-Identifier: GPL-3.0-only
//
// loc_27f3  (ROM 0x27f3-0x2855) -- 0x8f30 state 1 (dispatch 0x277e[1]). Below arrow Y 0x34 it looks for
// a free hunter slot in the 2-entry 0x8c90 table; finding one it advances the state (0x8f30=2), runs
// loc_0f05, blits, optionally lights a HUD tile, and seeds the new hunter record (0x8a99/0x8a9e/0x8aa7).
// At/above 0x34 it runs a 0x10-frame flip counter (0x892f/0x892e) and tail-blits one of two tiles
// (0x2d51/0x2d55) via loc_3325. loc_0f05/loc_3325 pattern A; tiles are ROM data.
export function loc_27f3(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8ab4); m.step(0x27f6, 13); // 27f3  ld a,(0x8ab4)
  regs.cp(0x34); m.step(0x27f8, 7);
  if (regs.fC) {
    m.step(0x2813, 12);
  } else {
    m.step(0x27fa, 7);
    regs.hl = 0x892f; m.step(0x27fd, 10);
    regs.decMem8(mem, regs.hl); m.step(0x27fe, 11); // 27fd  dec (hl)
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x27ff, 5);
    mem.write8(regs.hl, 0x10); m.step(0x2801, 10); // 27ff  ld (hl),0x10
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x2802, 6); // 2801  dec hl -> 0x892e
    regs.incMem8(mem, regs.hl); m.step(0x2803, 11); // 2802  inc (hl)
    regs.bit(0, mem.read8(regs.hl)); m.step(0x2805, 12); // 2803  bit 0,(hl)
    regs.hl = 0x84a7; m.step(0x2808, 10);
    regs.de = 0x2d51; m.step(0x280b, 10);
    if (regs.fNZ) {
      m.step(0x2810, 12);
    } else {
      m.step(0x280d, 7);
      regs.de = 0x2d55; m.step(0x2810, 10);
    }
    m.step(0x3325, 10); return m.call(0x3325);
  }
  regs.hl = 0x8c90; m.step(0x2816, 10);
  regs.de = 0x0018; m.step(0x2819, 10);
  regs.b = 0x02; m.step(0x281b, 7);
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x281c, 7); // 281b  ld a,(hl)
    regs.and(regs.a); m.step(0x281d, 4);
    if (regs.fZ) { m.step(0x2823, 12); break; } // 281d  jr z,0x2823 (free slot)
    m.step(0x281f, 7);
    regs.addHl(regs.de); m.step(0x2820, 11);
    if (regs.djnz() !== 0) { m.step(0x281b, 13); continue; }
    m.step(0x2822, 8); m.ret(); return; // 2822  ret (no free slot)
  }
  regs.a = 0x02; m.step(0x2825, 7);
  mem.write8(0x8f30, regs.a); m.step(0x2828, 13); // 2825  ld (0x8f30),a
  mem.write8(regs.hl, regs.a); m.step(0x2829, 7); // 2828  ld (hl),a
  m.push16(0x282c); m.step(0x0f05, 17); m.call(0x0f05); // 2829  call 0x0f05 (pattern A)
  regs.hl = 0x84a7; m.step(0x282f, 10);
  regs.de = 0x2d55; m.step(0x2832, 10);
  m.push16(0x2835); m.step(0x3325, 17); m.call(0x3325); // 2832  call 0x3325 (pattern A)
  regs.a = mem.read8(0x8f50); m.step(0x2838, 13); // 2835  ld a,(0x8f50)
  regs.hl = 0x8f3f; m.step(0x283b, 10);
  regs.or(mem.read8(regs.hl)); m.step(0x283c, 7); // 283b  or (hl)
  if (regs.fZ) {
    m.step(0x2841, 12);
    regs.exAf(); m.step(0x2842, 4); // 2841  ex af,af'
    regs.add(regs.l); m.step(0x2843, 4); // 2842  add a,l
  } else {
    m.step(0x283e, 7);
    regs.a = 0x10; m.step(0x2840, 7);
    mem.write8(0x8508, regs.a); m.step(0x2843, 13); // 2840  ld (0x8508),a
  }
  regs.a = 0x01; m.step(0x2845, 7); // 2843  ld a,0x01
  mem.write8(0x8a99, regs.a); m.step(0x2848, 13); // 2845  ld (0x8a99),a
  regs.a = mem.read8(0x8a86); m.step(0x284b, 13); // 2848  ld a,(0x8a86)
  regs.add(0x0c); m.step(0x284d, 7); // 284b  add a,0x0c
  mem.write8(0x8a9e, regs.a); m.step(0x2850, 13); // 284d  ld (0x8a9e),a
  regs.a = 0x10; m.step(0x2852, 7); // 2850  ld a,0x10
  mem.write8(0x8aa7, regs.a); m.step(0x2855, 13); // 2852  ld (0x8aa7),a
  m.ret();
}
