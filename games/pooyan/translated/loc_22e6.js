// SPDX-License-Identifier: GPL-3.0-only

// loc_22e6  (ROM 0x22e6-0x2324) -- per-actor animation-script stepper. IX = the actor record.
// (ix+0x0e) is a frame countdown: while nonzero it just decrements and returns. At zero it pulls
// the next 3-byte entry {tile(ix+0x10), colour(ix+0x0f), delay(ix+0x0e)} from the script cursor
// (0x8f00) and advances it. A 0xff lead byte is a control marker: call 0x22d0 tallies a flag pair,
// and the marker is resolved either as a full reset to 0x26e7 (tally==3) or an inline 2-byte
// pointer following the 0xff -- both loop back to re-read at the new cursor. 0x22d0 preserves HL.
export function loc_22e6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x0e) & 0xffff); m.step(0x22e9, 19);
  regs.and(regs.a);                              m.step(0x22ea, 4);
  if (regs.fNZ) {
    m.step(0x22ec, 7);                                    // jr z not taken -- countdown live
    regs.decMem8(mem, (regs.ix + 0x0e) & 0xffff);  m.step(0x22ef, 23);
    return m.ret(10);
  }
  m.step(0x22f0, 12);                            // jr z taken

  for (;;) { // loc_22f0: read the entry at the script cursor
    regs.hl = mem.read16(0x8f00);                m.step(0x22f3, 16);
    regs.a = mem.read8(regs.hl);                 m.step(0x22f4, 7);
    regs.cp(0xff);                               m.step(0x22f6, 7);
    if (regs.fNZ) {
      m.step(0x22f8, 7);                                  // jr z not taken -- real 3-byte entry
      mem.write8((regs.ix + 0x10) & 0xffff, regs.a); m.step(0x22fb, 19);
      regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x22fc, 6);
      regs.a = mem.read8(regs.hl);                   m.step(0x22fd, 7);
      mem.write8((regs.ix + 0x0f) & 0xffff, regs.a); m.step(0x2300, 19);
      regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x2301, 6);
      regs.a = mem.read8(regs.hl);                   m.step(0x2302, 7);
      mem.write8((regs.ix + 0x0e) & 0xffff, regs.a); m.step(0x2305, 19);
      regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x2306, 6);
      mem.write16(0x8f00, regs.hl);                  m.step(0x2309, 16);
      return m.ret(10);
    }
    m.step(0x230a, 12);                          // jr z taken -- 0xff control marker

    m.push16(0x230d);
    m.step(0x22d0, 17);                          // 230a  call 0x22d0 (A <- flag tally; HL preserved)
    m.call(0x22d0);
    regs.cp(0x03);                               m.step(0x230f, 7);
    if (regs.fNZ) {
      m.step(0x2319, 12);                                 // jr nz taken -- inline 2-byte cursor
      regs.hl = (regs.hl + 1) & 0xffff;          m.step(0x231a, 6);
      regs.a = mem.read8(regs.hl);               m.step(0x231b, 7);
      mem.write8(0x8f00, regs.a);                m.step(0x231e, 13);
      regs.hl = (regs.hl + 1) & 0xffff;          m.step(0x231f, 6);
      regs.a = mem.read8(regs.hl);               m.step(0x2320, 7);
      mem.write8(0x8f01, regs.a);                m.step(0x2323, 13);
      m.step(0x22f0, 12);                        // jr 0x22f0
    } else {
      m.step(0x2311, 7);                                  // jr nz not taken -- tally==3: full reset
      regs.hl = 0x26e7;                          m.step(0x2314, 10);
      mem.write16(0x8f00, regs.hl);              m.step(0x2317, 16);
      m.step(0x22f0, 12);                        // jr 0x22f0
    }
  }
}
