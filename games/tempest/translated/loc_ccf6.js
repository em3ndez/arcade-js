// SPDX-License-Identifier: GPL-3.0-only
// loc_ccf6  (ROM 0xccf6-0xccf9) -- trampoline entry: loads sound id A=0x9f then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. Not-taken fall-through (dead, A!=0) would enter loc_ccfa.
export function loc_ccf6(m) {
  const { regs } = m;
  regs.a = 0x9f; regs.setNZ(regs.a); m.step(0xccf8, 2);
  if (regs.fNZ) { m.step(0xccc3, 3); return m.call(0xccc3); }
  m.step(0xccfa, 2); return m.call(0xccfa);
}
