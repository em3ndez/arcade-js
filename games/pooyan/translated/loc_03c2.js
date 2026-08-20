// SPDX-License-Identifier: GPL-3.0-only

// loc_03c2  (ROM 0x03c2-0x03e8) -- render a 5-cell vertical gauge from the count at 0x8908.
// Base tile addr 0x863f, each cell one row up (HL += DE = -0x20). count 0 -> nothing. Otherwise
// C = min(count-1, 5) filled tiles (0xb0), then 5-C blank tiles (0x10) above them.
export function loc_03c2(m) {
  const { regs, mem } = m;

  regs.hl = 0x863f;                  m.step(0x03c5, 10);
  regs.de = 0xffe0;                  m.step(0x03c8, 10); // -0x20 (one row up)
  regs.a = mem.read8(0x8908);        m.step(0x03cb, 13);
  regs.and(regs.a);                  m.step(0x03cc, 4);
  if (regs.fZ) { return m.ret(11); } // ret z -- empty gauge
  m.step(0x03cd, 5);
  regs.a = regs.dec8(regs.a);        m.step(0x03ce, 4);
  regs.c = regs.a;                   m.step(0x03cf, 4);  // ld c,a leaves the dec's Z intact
  if (regs.fZ) {
    m.step(0x03de, 12);              // jr z -- count was 1, no filled tiles
  } else {
    m.step(0x03d1, 7);
    regs.cp(0x05);                   m.step(0x03d3, 7);
    if (regs.fC) {
      m.step(0x03d7, 12);            // jr c -- below 5, no clamp
    } else {
      m.step(0x03d5, 7);
      regs.a = 0x05;                 m.step(0x03d7, 7); // clamp filled count to 5
    }
    regs.c = regs.a;                 m.step(0x03d8, 4);
    regs.b = regs.a;                 m.step(0x03d9, 4);
    for (;;) { // loc_03d9: filled tiles
      mem.write8(regs.hl, 0xb0);     m.step(0x03db, 10);
      regs.addHl(regs.de);           m.step(0x03dc, 11);
      if (regs.djnz()) { m.step(0x03d9, 13); } else { m.step(0x03de, 8); break; }
    }
  }

  // loc_03de: blank the remaining cells
  regs.a = 0x05;                     m.step(0x03e0, 7);
  regs.sub(regs.c);                  m.step(0x03e1, 4);
  if (regs.fZ) { return m.ret(11); } // ret z -- gauge full, no blanks
  m.step(0x03e2, 5);
  regs.b = regs.a;                   m.step(0x03e3, 4);
  for (;;) { // loc_03e3: blank tiles
    mem.write8(regs.hl, 0x10);       m.step(0x03e5, 10);
    regs.addHl(regs.de);             m.step(0x03e6, 11);
    if (regs.djnz()) { m.step(0x03e3, 13); } else { m.step(0x03e8, 8); break; }
  }
  return m.ret(10);
}
