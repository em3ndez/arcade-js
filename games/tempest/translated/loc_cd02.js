// SPDX-License-Identifier: GPL-3.0-only
// loc_cd02  (ROM 0xcd02-0xcd05) -- trampoline entry: loads sound id A=0x3f then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. Not-taken fall-through (dead, A!=0) would enter loc_cd06.
export function loc_cd02(m) {
  const { regs } = m;
  regs.a = 0x3f; regs.setNZ(regs.a); m.step(0xcd04, 2);
  if (regs.fNZ) { m.step(0xccc3, 4); return m.call(0xccc3); }
  m.step(0xcd06, 2); return m.call(0xcd06);
}
