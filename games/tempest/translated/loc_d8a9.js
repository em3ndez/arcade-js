// SPDX-License-Identifier: GPL-3.0-only
// loc_d8a9  (ROM 0xd8a9-0xd8b5) -- stashes A at $29, moves Y->A, calls loc_df75, then tail-jumps to loc_dfb1.
export function loc_d8a9(m) {
  const { regs, mem } = m;
  mem.write8(0x29, regs.a); m.step(0xd8ab, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xd8ac, 2);
  m.push16((0xd8ac + 2) & 0xffff); m.step(0xd8af, 6); m.call(0xdf75);
  regs.a = 0x29; regs.setNZ(regs.a); m.step(0xd8b1, 2);
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0xd8b3, 2);
  m.step(0xdfb1, 3); return m.call(0xdfb1);
}
