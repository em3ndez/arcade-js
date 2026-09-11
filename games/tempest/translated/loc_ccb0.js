// SPDX-License-Identifier: GPL-3.0-only
// loc_ccb0  (ROM 0xccb0-0xccb4) -- trampoline entry: loads sound id A=0x5f then JMP $ccc3 (tail-call loc_ccc3).
export function loc_ccb0(m) {
  const { regs } = m;
  regs.a = 0x5f; regs.setNZ(regs.a); m.step(0xccb2, 2);
  m.step(0xccc3, 3); return m.call(0xccc3);
}
