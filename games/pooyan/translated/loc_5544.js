// SPDX-License-Identifier: GPL-3.0-only

// loc_5544  (ROM 0x5544-0x5563) -- scan an actor-block table (count B, stride DE, base IX). Live blocks
// ((ix+0)|(ix+1) != 0) are skipped and IX advanced (djnz). The first free block is seeded: its script
// byte (ix+17) comes from table 0x5647 indexed by (0x8d13 & 0x0f) via rst 0x20 (loc_0020), then loc_5489
// initialises it. loc_5489 ends `pop af; ret`, so it skip-returns past loc_5544 -- exactly one block is
// seeded per call. If no free block exists the loop falls out of djnz and rets. Body runs in the alt bank
// (exx pair); the loop counter B and stride DE live in the main bank.
export function loc_5544(m) {
  const { regs, mem } = m;

  for (;;) { // 5544: scan the actor table
    regs.exx();                                    m.step(0x5545, 4);
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x5548, 19);
    regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x554b, 19);
    if (regs.fZ) {
      // 554b jr nz not taken -- free block: seed it, then skip-return via loc_5489
      m.step(0x554d, 7);
      regs.b = 0x0f;                               m.step(0x554f, 7);
      regs.hl = 0x5647;                            m.step(0x5552, 10);
      regs.a = mem.read8(0x8d13);                  m.step(0x5555, 13);
      regs.and(0x0f);                              m.step(0x5557, 7);
      m.push16(0x5558); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 (loc_0020: A = mem[0x5647+idx])
      mem.write8((regs.ix + 0x17) & 0xffff, regs.a); m.step(0x555b, 19);
      m.push16(0x555e); m.step(0x5489, 17); m.call(0x5489); // call 0x5489 (init block; pop af + ret)
      return; // loc_5489's skip-return already popped loc_5544's frame -- do not run the djnz tail
    }
    // 554b jr nz taken -- live block: advance IX and loop
    m.step(0x555e, 12);
    regs.exx();                                    m.step(0x555f, 4);
    regs.addIx(regs.de);                           m.step(0x5561, 15);
    if (regs.djnz()) { m.step(0x5544, 13); continue; }
    m.step(0x5563, 8);
    break;
  }
  m.ret(); // 5563 ret -- no free block found
}
