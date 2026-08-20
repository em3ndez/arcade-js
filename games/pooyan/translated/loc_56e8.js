// SPDX-License-Identifier: GPL-3.0-only

// loc_56e8  (ROM 0x56e8-0x572a) -- countdown at 0x8d07: while nonzero decrement it and ret.
// At zero: if (0x8907) bit0 clear tail-jp to loc_5871; else gate on (0x8901) vs (0x8d40) with a
// threshold from (0x8900) (>=3 -> 6, else +4); pass -> sweep the 6 records at 0x8ae0 via loc_572b.
export function loc_56e8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d07);        m.step(0x56eb, 13);
  regs.and(regs.a);                  m.step(0x56ec, 4);
  if (regs.fNZ) {
    m.step(0x56ee, 7);               // jr z not taken -- still counting down
    regs.a = regs.dec8(regs.a);      m.step(0x56ef, 4);
    mem.write8(0x8d07, regs.a);      m.step(0x56f2, 13);
    return m.ret(); // 56f2  ret
  }
  m.step(0x56f3, 12);                // jr z taken

  regs.a = mem.read8(0x8907);        m.step(0x56f6, 13);
  regs.bit(0, regs.a);               m.step(0x56f8, 8);
  if (regs.fZ) { m.step(0x5871, 10); return m.call(0x5871); } // jp z,0x5871 tail
  m.step(0x56fb, 10);                // jp z not taken

  regs.a = mem.read8(0x8901);        m.step(0x56fe, 13);
  regs.hl = 0x8d40;                  m.step(0x5701, 10);
  regs.sub(mem.read8(regs.hl));      m.step(0x5702, 7);
  if (regs.fZ) { return m.ret(11); } m.step(0x5703, 5); // ret z
  if (regs.fC) { return m.ret(11); } m.step(0x5704, 5); // ret c
  regs.c = regs.a;                   m.step(0x5705, 4);
  regs.a = mem.read8(0x8900);        m.step(0x5708, 13);
  regs.cp(0x03);                     m.step(0x570a, 7);
  if (regs.fC) {
    m.step(0x5710, 12);              // jr c taken -- (0x8900) < 3
    regs.add(0x04);                  m.step(0x5712, 7);
    regs.b = regs.a;                 m.step(0x5713, 4);
  } else {
    m.step(0x570c, 7);
    regs.b = 0x06;                   m.step(0x570e, 7);
    m.step(0x5713, 12);              // jr 0x5713
  }
  regs.a = mem.read8(0x8d40);        m.step(0x5716, 13);
  regs.cp(regs.b);                   m.step(0x5717, 4);
  if (regs.fNC) { return m.ret(11); } m.step(0x5718, 5); // ret nc

  regs.ix = 0x8ae0;                  m.step(0x571c, 14);
  regs.b = 0x06;                     m.step(0x571e, 7);
  for (;;) {
    regs.e = 0x1d;                     m.step(0x5720, 7);
    m.push16(0x5723); m.step(0x572b, 17); m.call(0x572b);
    if (m.pc !== 0x5723) return;   // loc_572b full-path skip-returned past this loop; propagate
    regs.de = 0x0018;                 m.step(0x5726, 10);
    regs.addIx(regs.de);              m.step(0x5728, 15);
    if (regs.djnz()) { m.step(0x571e, 13); } else { m.step(0x572a, 8); break; }
  }
  return m.ret(); // 572a  ret
}
