// SPDX-License-Identifier: GPL-3.0-only
// loc_b944  (ROM 0xb944-0xb954) -- swaps the 16-bit pointer $74/$75 with $76/$77 (via X=lo,Y=hi temps).
export function loc_b944(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x74); regs.setNZ(regs.x); m.step(0xb946, 3);
  regs.y = mem.read8(0x75); regs.setNZ(regs.y); m.step(0xb948, 3);
  regs.a = mem.read8(0x76); regs.setNZ(regs.a); m.step(0xb94a, 3);
  mem.write8(0x74, regs.a); m.step(0xb94c, 3);
  mem.write8(0x76, regs.x); m.step(0xb94e, 3);
  regs.a = mem.read8(0x77); regs.setNZ(regs.a); m.step(0xb950, 3);
  mem.write8(0x75, regs.a); m.step(0xb952, 3);
  mem.write8(0x77, regs.y); m.step(0xb954, 3);
  return m.ret(6);
}
