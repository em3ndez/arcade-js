// SPDX-License-Identifier: GPL-3.0-only
// loc_ccb9  (ROM 0xccb9-0xccbc) -- trampoline entry: loads sound id A=0x4f then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. Not-taken fall-through (dead, A!=0) would enter loc_ccbd.
export function loc_ccb9(m) {
  const { regs } = m;
  regs.a = 0x4f; regs.setNZ(regs.a); m.step(0xccbb, 2);
  if (regs.fNZ) { m.step(0xccc3, 3); return m.call(0xccc3); }
  m.step(0xccbd, 2); return m.call(0xccbd);
}
