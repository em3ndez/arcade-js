// SPDX-License-Identifier: GPL-3.0-only
// loc_cd06  (ROM 0xcd06-0xcd09) -- trampoline entry: loads sound id A=0xcf then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. Not-taken fall-through (dead, A!=0) would enter loc_cd0a.
export function loc_cd06(m) {
  const { regs } = m;
  regs.a = 0xcf; regs.setNZ(regs.a); m.step(0xcd08, 2);
  if (regs.fNZ) { m.step(0xccc3, 4); return m.call(0xccc3); }
  m.step(0xcd0a, 2); return m.call(0xcd0a);
}
