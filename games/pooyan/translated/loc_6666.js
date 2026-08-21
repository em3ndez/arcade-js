// SPDX-License-Identifier: GPL-3.0-only

// loc_6666  (ROM 0x6666-0x667b) -- rst-0x28 handler (index 2): walk three object records backward
// (IX -= 0x18 per step) running loc_667c on each under the alternate bank, then run loc_66a1 on
// the 0x8c78 record.
export function loc_6666(m) {
  const { regs } = m;

  regs.de = 0xffe8;            m.step(0x6669, 10);
  regs.b = 0x03;               m.step(0x666b, 7);
  for (;;) {
    regs.exx();                m.step(0x666c, 4);
    m.push16(0x666f); m.step(0x667c, 17); m.call(0x667c);
    regs.exx();                m.step(0x6670, 4);
    regs.addIx(regs.de);       m.step(0x6672, 15);
    if (regs.djnz() !== 0) { m.step(0x666b, 13); continue; }
    m.step(0x6674, 8);
    break;
  }
  regs.ix = 0x8c78;            m.step(0x6678, 14);
  m.push16(0x667b); m.step(0x66a1, 17); m.call(0x66a1);
  return m.ret(10);
}
