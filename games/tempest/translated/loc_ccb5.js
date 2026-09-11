// SPDX-License-Identifier: GPL-3.0-only
// loc_ccb5  (ROM 0xccb5-0xccb8) -- trampoline entry: loads sound id A=0x0f then BNE $ccc3 (always taken, A
//   nonzero) tail-calls loc_ccc3. Not-taken fall-through (dead, A!=0) would enter loc_ccb9.
export function loc_ccb5(m) {
  const { regs } = m;
  regs.a = 0x0f; regs.setNZ(regs.a); m.step(0xccb7, 2);
  if (regs.fNZ) { m.step(0xccc3, 3); return m.call(0xccc3); }
  m.step(0xccb9, 2); return m.call(0xccb9);
}
