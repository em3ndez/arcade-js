// SPDX-License-Identifier: GPL-3.0-only

// loc_69ad  (ROM 0x69ad-0x69c5) -- steps 8 paired records (ix from 0x8ae0, iy from 0x8ba0, both by
// stride 0x18) through loc_69c6. exx swaps the loop's B (count 8) and DE (stride) into the shadow set
// across the call so loc_69c6 cannot clobber them.
export function loc_69ad(m) {
  const { regs } = m;

  regs.ix = 0x8ae0;             m.step(0x69b1, 14);
  regs.iy = 0x8ba0;             m.step(0x69b5, 14);
  regs.de = 0x0018;            m.step(0x69b8, 10);
  regs.b = 0x08;              m.step(0x69ba, 7);

  for (;;) {
    regs.exx();                m.step(0x69bb, 4);
    m.push16(0x69be); m.step(0x69c6, 17); m.call(0x69c6);
    regs.exx();                m.step(0x69bf, 4);
    regs.addIx(regs.de);       m.step(0x69c1, 15);
    regs.addIy(regs.de);       m.step(0x69c3, 15);
    if (regs.djnz() !== 0) { m.step(0x69ba, 13); continue; }
    m.step(0x69c5, 8);
    break;
  }
  return m.ret(10);            // 69c5  ret
}
