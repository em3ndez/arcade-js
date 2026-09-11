// SPDX-License-Identifier: GPL-3.0-only
// loc_a33a  (ROM 0xa33a-0xa342) -- A=5, calls the $a352 mid-routine entry (into loc_a34b), then
// decrements the $0201 counter and returns.
export function loc_a33a(m) {
  const { regs, mem } = m;
  regs.a = 0x05; regs.setNZ(regs.a); m.step(0xa33c, 2);
  m.push16(0xa33e); m.step(0xa33f, 6); m.call(0xa352);
  mem.write8(0x0201, regs.dec8(mem.read8(0x0201))); m.step(0xa342, 6);
  return m.ret(6);
}
