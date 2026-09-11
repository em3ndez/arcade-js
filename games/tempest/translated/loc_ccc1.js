// SPDX-License-Identifier: GPL-3.0-only
// loc_ccc1  (ROM 0xccc1-0xccc2) -- trampoline entry: loads sound id A=0x1f then falls off the end into loc_ccc3.
export function loc_ccc1(m) {
  const { regs } = m;
  regs.a = 0x1f; regs.setNZ(regs.a); m.step(0xccc3, 2);
  return m.call(0xccc3);
}
