// SPDX-License-Identifier: GPL-3.0-only

// loc_6505  (ROM 0x6505-0x6522) -- rst-0x28 handler (index 0): seeds 0x8929=0x1c and 0x892b=0x08,
// then walks three object records backward (IX -= 0x18 per step) running loc_6523 on each under the
// alternate bank while bumping the record's +0x02 phase; finally loc_0f88.
export function loc_6505(m) {
  const { regs, mem } = m;

  regs.hl = 0x8929;            m.step(0x6508, 10);
  mem.write8(regs.hl, 0x1c);   m.step(0x650a, 10);
  regs.de = 0xffe8;            m.step(0x650d, 10);
  regs.b = 0x03;               m.step(0x650f, 7);
  regs.l = 0x2b;               m.step(0x6511, 7);  // HL = 0x892b
  mem.write8(regs.hl, 0x08);   m.step(0x6513, 10);
  for (;;) {
    regs.exx();                m.step(0x6514, 4);
    m.push16(0x6517); m.step(0x6523, 17); m.call(0x6523);
    regs.exx();                m.step(0x6518, 4);
    regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x651b, 23);
    regs.addIx(regs.de);       m.step(0x651d, 15);
    if (regs.djnz() !== 0) { m.step(0x6513, 13); continue; }
    m.step(0x651f, 8);
    break;
  }
  m.push16(0x6522); m.step(0x0f88, 17); m.call(0x0f88);
  return m.ret(10);
}
