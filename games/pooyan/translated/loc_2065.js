// SPDX-License-Identifier: GPL-3.0-only

// loc_2065  (ROM 0x2065-0x208b) -- render a 5-cell bar gauge at 0x863f (cells stride 0xffe0, bottom-up).
// Value at 0x8908: 0 -> return; else (value-1) clamped to 5 cells are drawn filled (tile 0xb0) and the
// remaining (5 - filled) are drawn blank (tile 0x10). No calls; leaf.
export function loc_2065(m) {
  const { regs, mem } = m;

  regs.hl = 0x863f;                m.step(0x2068, 10);
  regs.de = 0xffe0;                m.step(0x206b, 10);
  regs.a = mem.read8(0x8908);      m.step(0x206e, 13);
  regs.and(regs.a);                m.step(0x206f, 4);
  if (regs.fZ) { return m.ret(11); } // ret z -- gauge value 0
  m.step(0x2070, 5);
  regs.a = regs.dec8(regs.a);      m.step(0x2071, 4);
  regs.c = regs.a;                 m.step(0x2072, 4);
  if (regs.fZ) {
    m.step(0x2081, 12);            // jr z -- value 1: C=0, no filled cells
  } else {
    m.step(0x2074, 7);            // jr z not taken
    regs.cp(0x05);                 m.step(0x2076, 7);
    if (regs.fC) {
      m.step(0x207a, 12);          // jr c -- (value-1) < 5, keep it
    } else {
      m.step(0x2078, 7);          // jr c not taken
      regs.a = 0x05;               m.step(0x207a, 7); // clamp filled count to 5
    }
    regs.c = regs.a;               m.step(0x207b, 4);
    regs.b = regs.a;               m.step(0x207c, 4);
    for (;;) { // loc_207c: draw the filled cells
      mem.write8(regs.hl, 0xb0);   m.step(0x207e, 10);
      regs.addHl(regs.de);         m.step(0x207f, 11);
      if (regs.djnz()) { m.step(0x207c, 13); } else { m.step(0x2081, 8); break; }
    }
  }

  // loc_2081: fill the remaining (5 - C) cells with the blank tile
  regs.a = 0x05;                   m.step(0x2083, 7);
  regs.sub(regs.c);                m.step(0x2084, 4);
  if (regs.fZ) { return m.ret(11); } // ret z -- gauge full, no blanks
  m.step(0x2085, 5);
  regs.b = regs.a;                 m.step(0x2086, 4);
  for (;;) { // loc_2086: draw the blank cells
    mem.write8(regs.hl, 0x10);     m.step(0x2088, 10);
    regs.addHl(regs.de);           m.step(0x2089, 11);
    if (regs.djnz()) { m.step(0x2086, 13); } else { m.step(0x208b, 8); break; }
  }
  return m.ret(10);
}
