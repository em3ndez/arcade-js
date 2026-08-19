// SPDX-License-Identifier: GPL-3.0-only

// loc_05b2  (ROM 0x05b2-0x05ec) -- table-indexed field renderer.
// A doubled & masked to 7 bits indexes pointer table 0x7a0d, whose entry heads a list of
// (dest-addr, string) records. Each record draws bottom-up (hl += 0xffe0 per cell). Carry
// is the mode latch (origA bit7, preserved across the push/pop, re-armed by scf): clear ->
// write char minus '0'; set -> write blank tile 0x10. '.' ends a record, '?' ends the run
// via `ret z`. No calls. Every m.step target is the ROM address of the next instruction.
export function loc_05b2(m) {
  const { regs, mem } = m;

  regs.add(regs.a);                  m.step(0x05b3, 4);
  m.push16(regs.af);                 m.step(0x05b4, 11); // save carry(=origA bit7) as the mode
  regs.hl = 0x7a0d;                  m.step(0x05b7, 10);
  regs.and(0x7f);                    m.step(0x05b9, 7);
  regs.e = regs.a;                   m.step(0x05ba, 4);
  regs.d = 0x00;                     m.step(0x05bc, 7);
  regs.addHl(regs.de);               m.step(0x05bd, 11);
  regs.af = m.pop16();               m.step(0x05be, 10); // restore the mode carry
  regs.e = mem.read8(regs.hl);       m.step(0x05bf, 7);
  regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x05c0, 6);
  regs.d = mem.read8(regs.hl);       m.step(0x05c1, 7);
  regs.exDeHl();                     m.step(0x05c2, 4);

  for (;;) { // loc_05c2: fetch the next record's dest address
    regs.e = mem.read8(regs.hl);       m.step(0x05c3, 7);
    regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x05c4, 6);
    regs.d = mem.read8(regs.hl);       m.step(0x05c5, 7);
    regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x05c6, 6);
    regs.exDeHl();                     m.step(0x05c7, 4);
    regs.bc = 0xffe0;                  m.step(0x05ca, 10);

    if (regs.fC) {
      m.step(0x05e0, 12); // jr c,0x05e0 taken
      for (;;) { // loc_05e0: blank fill
        regs.a = mem.read8(regs.de);       m.step(0x05e1, 7);
        regs.cp(0x2e);                     m.step(0x05e3, 7);
        if (regs.fZ) {
          m.step(0x05db, 12);
          regs.scf();                      m.step(0x05dc, 4); // re-arm blank mode past the '.'
          break;
        }
        m.step(0x05e5, 7);
        regs.cp(0x3f);                     m.step(0x05e7, 7);
        if (regs.fZ) { m.ret(11); return; }
        m.step(0x05e8, 5);
        mem.write8(regs.hl, 0x10);         m.step(0x05ea, 10);
        regs.de = (regs.de + 1) & 0xffff;  m.step(0x05eb, 6);
        regs.addHl(regs.bc);               m.step(0x05ec, 11);
        m.step(0x05e0, 12);
      }
    } else {
      m.step(0x05cc, 7); // jr c not taken
      for (;;) { // loc_05cc: digit fill
        regs.a = mem.read8(regs.de);       m.step(0x05cd, 7);
        regs.cp(0x2e);                     m.step(0x05cf, 7);
        if (regs.fZ) { m.step(0x05dc, 12); break; }
        m.step(0x05d1, 7);
        regs.cp(0x3f);                     m.step(0x05d3, 7);
        if (regs.fZ) { m.ret(11); return; }
        m.step(0x05d4, 5);
        regs.sub(0x30);                    m.step(0x05d6, 7);
        mem.write8(regs.hl, regs.a);       m.step(0x05d7, 7);
        regs.de = (regs.de + 1) & 0xffff;  m.step(0x05d8, 6);
        regs.addHl(regs.bc);               m.step(0x05d9, 11);
        m.step(0x05cc, 12);
      }
    }

    // loc_05dc: record delimiter -> advance the list pointer, fetch the next record
    regs.exDeHl();                     m.step(0x05dd, 4);
    regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x05de, 6);
    m.step(0x05c2, 12);
  }
}
