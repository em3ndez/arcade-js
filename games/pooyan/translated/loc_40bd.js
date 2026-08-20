// SPDX-License-Identifier: GPL-3.0-only

// loc_40bd  (ROM 0x40bd-0x40cf) -- per-record sweep over a 4-entry table at IX=0x8c30, stride 0x18.
// The B counter and DE stride are parked in the alt register set (exx) across loc_40d0 so the callee
// may clobber the main set freely. loc_40d0 is a boundary (batch 10).
export function loc_40bd(m) {
  const { regs } = m;

  regs.ix = 0x8c30;           m.step(0x40c1, 14); // ld ix,0x8c30
  regs.de = 0x0018;           m.step(0x40c4, 10); // ld de,0x0018
  regs.b = 0x04;              m.step(0x40c6, 7);  // ld b,0x04
  for (;;) {
    regs.exx();               m.step(0x40c7, 4);  // exx -- park B/DE
    m.push16(0x40ca);
    m.step(0x40d0, 17);       // 40c7  call 0x40d0 (boundary)
    m.call(0x40d0);
    regs.exx();               m.step(0x40cb, 4);  // exx -- restore B/DE
    regs.addIx(regs.de);      m.step(0x40cd, 15); // add ix,de
    if (regs.djnz() !== 0) { m.step(0x40c6, 13); continue; } // djnz 0x40c6
    m.step(0x40cf, 8); break;
  }
  return m.ret(10);           // 40cf  ret
}
