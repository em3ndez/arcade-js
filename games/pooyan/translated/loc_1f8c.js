// SPDX-License-Identifier: GPL-3.0-only

// loc_1f8c  (ROM 0x1f8c-0x1fa1) -- blit a 4-row x 3-column glyph block from (DE) into (HL).
// The I register (interrupt-vector reg, repurposed as a spare counter) holds the remaining row
// count, initialised to 4. Each row copies 3 bytes (DE++ -> HL, L++), then HL += 0x1d to step to
// the next row's column origin. `ld a,i; dec a; ret z` decrements the row counter and returns
// after the 4th row. No calls -- a leaf. Only exit is the `ret z` at 0x1f9e.
export function loc_1f8c(m) {
  const { regs, mem } = m;

  regs.a = 0x04;                m.step(0x1f8e, 7);
  regs.i = regs.a;             m.step(0x1f90, 9); // ld i,a -- row counter = 4
  for (;;) { // loc_1f90: one glyph row
    regs.b = 0x03;             m.step(0x1f92, 7);
    for (;;) { // loc_1f92: copy 3 bytes
      regs.a = mem.read8(regs.de);       m.step(0x1f93, 7);
      mem.write8(regs.hl, regs.a);       m.step(0x1f94, 7);
      regs.l = regs.inc8(regs.l);        m.step(0x1f95, 4); // inc l
      regs.de = (regs.de + 1) & 0xffff;  m.step(0x1f96, 6);
      if (regs.djnz()) { m.step(0x1f92, 13); } else { m.step(0x1f98, 8); break; }
    }
    regs.c = 0x1d;             m.step(0x1f9a, 7);
    regs.addHl(regs.bc);       m.step(0x1f9b, 11); // B==0 here -> HL += 0x001d
    regs.ldAI();               m.step(0x1f9d, 9);  // ld a,i
    regs.a = regs.dec8(regs.a); m.step(0x1f9e, 4); // dec a
    if (regs.fZ) { return m.ret(11); } // ret z -- last row done
    m.step(0x1f9f, 5);
    regs.i = regs.a;           m.step(0x1fa1, 9); // ld i,a
    m.step(0x1f90, 12);        // jr 0x1f90
  }
}
