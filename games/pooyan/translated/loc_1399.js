// SPDX-License-Identifier: GPL-3.0-only

// loc_1399  (ROM 0x1399-0x13bb) -- state dispatch on the actor's (ix+0x06) sub-state.
// a<7 -> tail loc_1389; a>=0x14 -> tail loc_1391. Else a timer at 0x8d6b: nonzero -> dec+ret;
// zero and B<0x80 -> reload 0x8d6b from table 0x13d3[(0x8907)&7] (rst 0x20 = A<-mem[HL+A]) via the
// ex de,hl (DE=0x8d6b), then fall through into the shared body at loc_13bc (also entered by loc_1383;
// 0x13bc is NOT in this batch -> boundary). rst 0x20 dispatches to loc_0020 (already translated).
export function loc_1399(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x139c, 19);
  regs.cp(0x07);                                 m.step(0x139e, 7);
  if (regs.fC) { m.step(0x1389, 12); return m.call(0x1389); }        // jr c,0x1389 (tail)
  m.step(0x13a0, 7);
  regs.cp(0x14);                                 m.step(0x13a2, 7);
  if (regs.fNC) { m.step(0x1391, 12); return m.call(0x1391); }       // jr nc,0x1391 (tail)
  m.step(0x13a4, 7);
  regs.hl = 0x8d6b;                              m.step(0x13a7, 10);
  regs.a = mem.read8(regs.hl);                   m.step(0x13a8, 7);
  regs.and(regs.a);                              m.step(0x13a9, 4);

  if (regs.fZ) {
    m.step(0x13ad, 12);                                              // jr z,0x13ad (timer==0)
    regs.a = regs.b;                             m.step(0x13ae, 4);
    regs.cp(0x80);                               m.step(0x13b0, 7);
    if (regs.fNC) { return m.ret(11); }                             // ret nc (B>=0x80)
    m.step(0x13b1, 5);
    regs.exDeHl();                               m.step(0x13b2, 4);  // DE=0x8d6b for the ld (de),a below
    regs.hl = 0x13d3;                            m.step(0x13b5, 10);
    regs.a = mem.read8(0x8907);                  m.step(0x13b8, 13);
    regs.and(0x07);                              m.step(0x13ba, 7);
    m.push16(0x13bb);
    m.step(0x0020, 11);                                             // rst 0x20 -> loc_0020, returns to 0x13bb
    m.call(0x0020);
    mem.write8(regs.de, regs.a);                 m.step(0x13bc, 7);
    return m.call(0x13bc);                                          // fall through into shared body loc_13bc
  }

  m.step(0x13ab, 7);
  regs.decMem8(mem, regs.hl);                    m.step(0x13ac, 11); // dec (hl)
  return m.ret(10);
}
