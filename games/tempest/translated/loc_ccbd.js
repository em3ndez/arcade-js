// SPDX-License-Identifier: GPL-3.0-only
// loc_ccbd  (ROM 0xccbd-0xccc0) -- trampoline entry: loads sound id A=0x8f then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. Not-taken fall-through (dead, A!=0) would enter loc_ccc1.
export function loc_ccbd(m) {
  const { regs } = m;
  regs.a = 0x8f; regs.setNZ(regs.a); m.step(0xccbf, 2);
  if (regs.fNZ) { m.step(0xccc3, 3); return m.call(0xccc3); }
  m.step(0xccc1, 2); return m.call(0xccc1);
}
