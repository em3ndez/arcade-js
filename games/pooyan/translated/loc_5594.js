// SPDX-License-Identifier: GPL-3.0-only

// loc_5594  (ROM 0x5594-0x55d3) -- scan an actor-block table (count B, stride DE, base IX). Live blocks
// ((ix+0)|(ix+1) != 0) are skipped and IX advanced (djnz). At the first free block it sums the 8-byte
// guard at 0x0bad against the local signature table 0x55b5 (inlined loop at 0x55a5); if any pair is
// nonzero it bumps the miss tally 0x881e. Either way it then seeds the block: script byte (ix+17) from
// table 0x5627 indexed by (0x8d14 & 0x0f) via rst 0x20 (loc_0020), then loc_5489 initialises it and
// skip-returns (`pop af; ret`) past loc_5594. No free block -> the djnz falls out and rets. Body runs in
// the alt bank (exx pair); the loop counter B and stride DE live in the main bank.
export function loc_5594(m) {
  const { regs, mem } = m;

  for (;;) { // 5594: scan the actor table
    regs.exx();                                    m.step(0x5595, 4);
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x5598, 19);
    regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x559b, 19);
    if (regs.fNZ) {
      // 559b jr nz taken -- live block: advance IX and loop
      m.step(0x55ce, 12);
      regs.exx();                                  m.step(0x55cf, 4);
      regs.addIx(regs.de);                         m.step(0x55d1, 15);
      if (regs.djnz()) { m.step(0x5594, 13); continue; }
      m.step(0x55d3, 8);
      break;
    }
    // 559b jr nz not taken -- free block: sum the 8-byte guard vs the 0x55b5 signature
    m.step(0x559d, 7);
    regs.de = 0x0bad;                              m.step(0x55a0, 10);
    regs.hl = 0x55b5;                              m.step(0x55a3, 10);
    regs.b = 0x08;                                 m.step(0x55a5, 7);
    let mismatch = false;
    for (;;) { // 55a5 (inlined djnz loop): any nonzero sum -> 0x55af
      regs.a = mem.read8(regs.de);                 m.step(0x55a6, 7);
      regs.add(mem.read8(regs.hl));                m.step(0x55a7, 7);
      if (regs.fNZ) { m.step(0x55af, 12); mismatch = true; break; }
      m.step(0x55a9, 7);
      regs.de = (regs.de + 1) & 0xffff;            m.step(0x55aa, 6);
      regs.hl = (regs.hl + 1) & 0xffff;            m.step(0x55ab, 6);
      if (regs.djnz()) { m.step(0x55a5, 13); continue; }
      m.step(0x55ad, 8);
      break;
    }
    if (mismatch) {
      regs.hl = 0x881e;                            m.step(0x55b2, 10);
      regs.incMem8(mem, regs.hl);                  m.step(0x55b3, 11); // 55af: bump miss tally
      m.step(0x55bd, 12);                          // 55b3 jr 0x55bd
    } else {
      m.step(0x55bd, 12);                          // 55ad jr 0x55bd -- all 8 matched
    }
    // 55bd: seed the block, then skip-return via loc_5489
    regs.b = 0x13;                                 m.step(0x55bf, 7);
    regs.hl = 0x5627;                              m.step(0x55c2, 10);
    regs.a = mem.read8(0x8d14);                    m.step(0x55c5, 13);
    regs.and(0x0f);                                m.step(0x55c7, 7);
    m.push16(0x55c8); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 (loc_0020: A = mem[0x5627+idx])
    mem.write8((regs.ix + 0x17) & 0xffff, regs.a); m.step(0x55cb, 19);
    m.push16(0x55ce); m.step(0x5489, 17); m.call(0x5489); // call 0x5489 (init block; pop af + ret)
    return; // loc_5489's skip-return already popped loc_5594's frame -- do not run the djnz tail
  }
  m.ret(); // 55d3 ret -- no free block found
}
