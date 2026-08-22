// SPDX-License-Identifier: GPL-3.0-only

// loc_6905  (ROM 0x6905-0x6930) -- (0x8929) delay-counter gate over an 8-record update sweep. While
// (0x8929)!=0 it just decrements and rets. On 0 it gates on (0x892d): rets if (0x892d)==(0x8903) or
// (0x892d)>=8, else it walks 8 record pairs at ix=0x8ae0 / iy=0x8ba0 (0x18-byte stride), calling
// loc_6931 on each (exx parks the loop counter B + stride DE in the shadow set across the call).
export function loc_6905(m) {
  const { regs, mem } = m;

  regs.hl = 0x8929;                m.step(0x6908, 10);
  regs.a = mem.read8(regs.hl);     m.step(0x6909, 7);
  regs.and(regs.a);                m.step(0x690a, 4);
  if (regs.fNZ) {
    m.step(0x690c, 7);             // 690a  jr z not taken
    regs.decMem8(mem, regs.hl);    m.step(0x690d, 11);
    return m.ret(10);              // 690d  ret
  }
  m.step(0x690e, 12);              // 690a  jr z taken

  regs.l = 0x2d;                   m.step(0x6910, 7);  // hl = 0x892d
  regs.a = mem.read8(regs.hl);     m.step(0x6911, 7);
  regs.l = 0x03;                   m.step(0x6913, 7);  // hl = 0x8903
  regs.cp(mem.read8(regs.hl));     m.step(0x6914, 7);
  if (regs.fZ) { m.ret(11); return; }  // 6914  ret z -- (0x892d)==(0x8903)
  m.step(0x6915, 5);
  regs.cp(0x08);                   m.step(0x6917, 7);
  if (regs.fNC) { m.ret(11); return; } // 6917  ret nc -- (0x892d) >= 8
  m.step(0x6918, 5);

  regs.ix = 0x8ae0;                m.step(0x691c, 14);
  regs.iy = 0x8ba0;                m.step(0x6920, 14);
  regs.de = 0x0018;                m.step(0x6923, 10); // record stride
  regs.b = 0x08;                   m.step(0x6925, 7);

  for (;;) { // 6925: 8 record pairs
    regs.exx();                    m.step(0x6926, 4);  // park B/DE in the shadow set
    m.push16(0x6929); m.step(0x6931, 17); m.call(0x6931);
    if (m.pc !== 0x6929) return; // 6931's pop-af/ret caller-skip unwound past this loop -> abort (cf loc_6404 @ 0x6420; one spawn/sweep, transfer-validated in scratchpad/FIDELITY-6905-6a0f-oracle-fix.md)
    regs.exx();                    m.step(0x692a, 4);  // restore B/DE
    regs.addIx(regs.de);           m.step(0x692c, 15);
    regs.addIy(regs.de);           m.step(0x692e, 15);
    if (regs.djnz() !== 0) { m.step(0x6925, 13); continue; }
    m.step(0x6930, 8);
    break;
  }

  return m.ret(10);                // 6930  ret
}
