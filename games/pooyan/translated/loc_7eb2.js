// SPDX-License-Identifier: GPL-3.0-only

// loc_7eb2  (ROM 0x7eb2-0x7f0d) -- entry 0 of the 0x7e94 write-anim dispatch table.
// Seeds the anim work-block 0x8e1f..0x8e2b: IX = 0x8dfd + 3*(0x89fc) -> (0x8e1f);
// (0x8e21) picks 0x8811 unless (0x880f)==0 && (0x880d)!=0 -> 0x8812; a second
// counter (0x89fc) advances the (0x8e27) write pointer by 2 each step, stamping 0x11.
export function loc_7eb2(m) {
  const { regs, mem } = m;

  regs.hl = 0x8565;             m.step(0x7eb5, 10);
  mem.write16(0x8e27, regs.hl); m.step(0x7eb8, 16);
  regs.a = 0x03;                m.step(0x7eba, 7);
  mem.write8(0x8e25, regs.a);   m.step(0x7ebd, 13);
  regs.a = mem.read8(0x89fc);   m.step(0x7ec0, 13);
  regs.hl = 0x03a0;             m.step(0x7ec3, 10);
  mem.write16(0x8e2b, regs.hl); m.step(0x7ec6, 16);
  regs.ix = 0x8dfd;             m.step(0x7eca, 14);
  regs.b = regs.a;              m.step(0x7ecb, 4);
  regs.de = 0x0003;             m.step(0x7ece, 10);

  for (;;) { // loc_7ece: IX += 3 * B
    regs.addIx(regs.de);        m.step(0x7ed0, 15);
    if (regs.djnz() !== 0) { m.step(0x7ece, 13); continue; }
    m.step(0x7ed2, 8);
    break;
  }

  mem.write16(0x8e1f, regs.ix); m.step(0x7ed6, 20);
  regs.a = mem.read8(0x880f);   m.step(0x7ed9, 13);
  regs.and(regs.a);             m.step(0x7eda, 4);
  if (regs.fNZ) {
    m.step(0x7ee2, 12);                                // jr nz,0x7ee2 -- (0x880f)!=0
    regs.hl = 0x8811;           m.step(0x7ee5, 10);    // loc_7ee2
    m.step(0x7eea, 12);                                // loc_7ee5: jr 0x7eea
  } else {
    m.step(0x7edc, 7);
    regs.a = mem.read8(0x880d); m.step(0x7edf, 13);
    regs.and(regs.a);           m.step(0x7ee0, 4);
    if (regs.fNZ) {
      m.step(0x7ee7, 12);                              // jr nz,0x7ee7 -- (0x880d)!=0
      regs.hl = 0x8812;         m.step(0x7eea, 10);    // loc_7ee7
    } else {
      m.step(0x7ee2, 7);
      regs.hl = 0x8811;         m.step(0x7ee5, 10);    // loc_7ee2
      m.step(0x7eea, 12);                              // loc_7ee5: jr 0x7eea
    }
  }

  mem.write16(0x8e21, regs.hl); m.step(0x7eed, 16);    // loc_7eea
  regs.a = mem.read8(0x89fc);   m.step(0x7ef0, 13);
  regs.b = regs.a;              m.step(0x7ef1, 4);
  regs.de = mem.read16(0x8e27); m.step(0x7ef5, 20);

  for (;;) { // loc_7ef5: DE += 2 * B
    regs.de = (regs.de + 1) & 0xffff; m.step(0x7ef6, 6);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x7ef7, 6);
    if (regs.djnz() !== 0) { m.step(0x7ef5, 13); continue; }
    m.step(0x7ef9, 8);
    break;
  }

  mem.write16(0x8e27, regs.de); m.step(0x7efd, 20);
  regs.a = 0x11;                m.step(0x7eff, 7);
  mem.write8(regs.de, regs.a);  m.step(0x7f00, 7);
  mem.write8(0x8e23, regs.a);   m.step(0x7f03, 13);
  regs.a = 0x01;                m.step(0x7f05, 7);
  mem.write8(0x8e26, regs.a);   m.step(0x7f08, 13);
  regs.a = 0x0c;                m.step(0x7f0a, 7);
  mem.write8(0x8e24, regs.a);   m.step(0x7f0d, 13);
  m.ret(10);
}
