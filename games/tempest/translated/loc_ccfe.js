// SPDX-License-Identifier: GPL-3.0-only
// loc_ccfe  (ROM 0xccfe-0xcd01) -- trampoline entry: loads sound id A=0xbf then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. Not-taken fall-through (dead, A!=0) would enter loc_cd02.
export function loc_ccfe(m) {
  const { regs } = m;
  regs.a = 0xbf; regs.setNZ(regs.a); m.step(0xcd00, 2);
  if (regs.fNZ) { m.step(0xccc3, 4); return m.call(0xccc3); }
  m.step(0xcd02, 2); return m.call(0xcd02);
}
