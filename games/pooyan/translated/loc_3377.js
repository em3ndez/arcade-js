// SPDX-License-Identifier: GPL-3.0-only

// loc_3377  (ROM 0x3377-0x3389) -- per-record sweep over a 0x0e-entry table at IX=0x8ae0, stride
// 0x18. The B counter and DE stride are parked in the alt register set (exx) across loc_338a so the
// callee may clobber the main set freely. loc_338a is a boundary (batch 10).
export function loc_3377(m) {
  const { regs } = m;

  regs.ix = 0x8ae0;           m.step(0x337b, 14); // ld ix,0x8ae0
  regs.de = 0x0018;           m.step(0x337e, 10); // ld de,0x0018
  regs.b = 0x0e;              m.step(0x3380, 7);  // ld b,0x0e
  for (;;) {
    regs.exx();               m.step(0x3381, 4);  // exx -- park B/DE
    m.push16(0x3384);
    m.step(0x338a, 17);       // 3381  call 0x338a (boundary)
    m.call(0x338a);
    regs.exx();               m.step(0x3385, 4);  // exx -- restore B/DE
    regs.addIx(regs.de);      m.step(0x3387, 15); // add ix,de
    if (regs.djnz() !== 0) { m.step(0x3380, 13); continue; } // djnz 0x3380
    m.step(0x3389, 8); break;
  }
  return m.ret(10);           // 3389  ret
}
