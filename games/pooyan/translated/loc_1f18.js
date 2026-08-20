// SPDX-License-Identifier: GPL-3.0-only

// loc_1f18  (ROM 0x1f18-0x1f86) -- timer/round-progress HUD updater.
// First scans the 7 word slots at 0x89e7; if any is nonzero it returns early (ret nz). Otherwise
// it reads the timer at 0x8901, computes its tens digit into C by repeated `sub 0x0a`, and jumps to
// loc_1f4e. When C==0 (timer < 10) it BCD-converts round 0x8907+1, selects one of two ROM glyph
// tables (0x1fe6 / 0x1fda by bit4 of the BCD value), blits it via loc_1f8c into 0x8722, fills a
// 3-tile blank via rst 0x10, copies the timer to 0x8743, and clears A. Both paths converge at
// loc_1f7a which renders 0x1fa3 (loc_0c45) and blits 0x8322 via loc_1f8c, then returns.
// (0x1f2f-0x1f4d is a distinct routine reached only from elsewhere -- unreachable from this entry.)
export function loc_1f18(m) {
  const { regs, mem } = m;

  regs.hl = 0x89e7;                m.step(0x1f1b, 10);
  regs.b = 0x07;                   m.step(0x1f1d, 7);
  for (;;) { // loc_1f1d: return early if any of the 7 word slots is nonzero
    regs.a = mem.read8(regs.hl);       m.step(0x1f1e, 7);
    regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x1f1f, 6);
    regs.or(mem.read8(regs.hl));       m.step(0x1f20, 7);
    if (regs.fNZ) { return m.ret(11); } // ret nz
    m.step(0x1f21, 5);
    if (regs.djnz()) { m.step(0x1f1d, 13); } else { m.step(0x1f23, 8); break; }
  }

  regs.c = 0x00;                   m.step(0x1f25, 7);
  regs.l = 0x01;                   m.step(0x1f27, 7); // HL -> 0x8901 (timer)
  regs.a = mem.read8(regs.hl);     m.step(0x1f28, 7);
  for (;;) { // loc_1f28: C = timer / 10 by repeated subtraction
    regs.sub(0x0a);                m.step(0x1f2a, 7);
    if (regs.fC) { m.step(0x1f4e, 12); break; } // jr c -> loc_1f4e
    m.step(0x1f2c, 7);
    regs.c = regs.inc8(regs.c);    m.step(0x1f2d, 4);
    m.step(0x1f28, 12);            // jr 0x1f28
  }

  // loc_1f4e
  regs.a = regs.c;                 m.step(0x1f4f, 4);
  regs.and(regs.a);                m.step(0x1f50, 4);
  if (regs.fNZ) {
    m.step(0x1f7a, 12);            // jr nz -> tens != 0, skip the round-glyph blit
  } else {
    m.step(0x1f52, 7);
    regs.a = mem.read8(0x8907);    m.step(0x1f55, 13);
    regs.add(0x01);                m.step(0x1f57, 7);
    regs.b = regs.a;               m.step(0x1f58, 4);
    regs.xor(regs.a);              m.step(0x1f59, 4);
    for (;;) { // loc_1f59: BCD-convert B by adding 1 B times
      regs.add(0x01);              m.step(0x1f5b, 7);
      regs.daa();                  m.step(0x1f5c, 4);
      if (regs.djnz()) { m.step(0x1f59, 13); } else { m.step(0x1f5e, 8); break; }
    }
    regs.de = 0x1fe6;              m.step(0x1f61, 10);
    regs.bit(4, regs.a);           m.step(0x1f63, 8); // bit 4,a
    if (regs.fNZ) {
      m.step(0x1f68, 12);          // jr nz (bit4 set) -> keep 0x1fe6
    } else {
      m.step(0x1f65, 7);
      regs.de = 0x1fda;            m.step(0x1f68, 10);
    }
    regs.hl = 0x8722;             m.step(0x1f6b, 10);
    m.push16(0x1f6e);
    m.step(0x1f8c, 17);           // 1f6b  call 0x1f8c
    m.call(0x1f8c);
    regs.a = 0x10;                m.step(0x1f70, 7);
    regs.b = 0x03;                m.step(0x1f72, 7);
    m.push16(0x1f73);
    m.step(0x0010, 11);           // 1f72  rst 0x10 (memset B tiles of A at HL)
    m.call(0x0010);
    regs.a = mem.read8(0x8901);   m.step(0x1f76, 13);
    mem.write8(0x8743, regs.a);    m.step(0x1f79, 13);
    regs.xor(regs.a);             m.step(0x1f7a, 4);
  }

  // loc_1f7a: shared tail render
  regs.hl = 0x1fa3;               m.step(0x1f7d, 10);
  m.push16(0x1f80);
  m.step(0x0c45, 17);             // 1f7d  call 0x0c45
  m.call(0x0c45);
  regs.hl = 0x8322;               m.step(0x1f83, 10);
  m.push16(0x1f86);
  m.step(0x1f8c, 17);             // 1f83  call 0x1f8c
  m.call(0x1f8c);
  return m.ret(10);               // 1f86  ret
}
