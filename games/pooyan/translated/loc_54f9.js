// SPDX-License-Identifier: GPL-3.0-only

// loc_54f9  (ROM 0x54f9-0x5518) -- spawn-slot scan loop over B actor blocks at IX (stride DE). Per slot,
// exx to the scan register set, then test (ix+0)|(ix+1): non-zero means the slot is live -> exx back,
// advance IX by DE, djnz. Zero means a free slot -> pick its type word from table 0x5637 (index
// 0x8d12&0x0f via rst 0x20), store to (ix+0x17), and call loc_5489 to seed it. loc_5489 ends pop af;ret,
// so it skip-returns TWO levels -- one spawn per entry, returning to loc_54f9's caller (never to 0x5513).
export function loc_54f9(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.exx();                                    m.step(0x54fa, 4);   // 54f9  exx
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x54fd, 19);  // 54fa  ld a,(ix+0x00)
    regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x5500, 19);  // 54fd  or (ix+0x01)
    if (regs.fZ) {
      m.step(0x5502, 7);                                                // 5500  jr nz not taken -- free slot
      regs.b = 0x0b;                               m.step(0x5504, 7);
      regs.hl = 0x5637;                            m.step(0x5507, 10);
      regs.a = mem.read8(0x8d12);                  m.step(0x550a, 13);
      regs.and(0x0f);                              m.step(0x550c, 7);
      m.push16(0x550d); m.step(0x0020, 11); m.call(0x0020);             // 550c  rst 0x20 (A = table[0x5637 + A])
      mem.write8((regs.ix + 0x17) & 0xffff, regs.a); m.step(0x5510, 19); // 550d  ld (ix+0x17),a
      m.push16(0x5513); m.step(0x5489, 17); return m.call(0x5489);      // 5510  call 0x5489 -- skip-returns 2 levels
    }
    m.step(0x5513, 12);                                                 // 5500  jr nz taken -- slot live
    regs.exx();                                    m.step(0x5514, 4);   // 5513  exx
    regs.addIx(regs.de);                           m.step(0x5516, 15);  // 5514  add ix,de
    if (regs.djnz()) { m.step(0x54f9, 13); } else { m.step(0x5518, 8); break; } // 5516  djnz 0x54f9
  }
  return m.ret(10);                                                    // 5518  ret
}
