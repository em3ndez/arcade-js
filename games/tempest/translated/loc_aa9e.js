// SPDX-License-Identifier: GPL-3.0-only
// loc_aa9e  (ROM 0xaa9e-0xaaa7) -- x++, store x at $61, set up ptr $61/y=1, tail-jmp loc_dfb1.
export function loc_aa9e(m) {
  const { regs, mem } = m;
  regs.x = regs.inc8(regs.x); m.step(0xaa9f, 2);
  mem.write8(0x61, regs.x); m.step(0xaaa1, 3);
  regs.a = 0x61; regs.setNZ(regs.a); m.step(0xaaa3, 2);
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0xaaa5, 2);
  m.step(0xdfb1, 3); return m.call(0xdfb1);
}
