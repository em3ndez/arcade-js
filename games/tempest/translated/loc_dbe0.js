// SPDX-License-Identifier: GPL-3.0-only
// loc_dbe0  (ROM 0xdbe0-0xdbf6) -- stores A to $60db, builds A = ($60d8 & 7) (also -> $37, $60cb)
// then | (($60c8 & 0x20) >> 2), returns.
export function loc_dbe0(m) {
  const { regs, mem } = m;
  mem.write8(0x60db, regs.a); m.step(0xdbe3, 4);
  regs.a = mem.read8(0x60d8); regs.setNZ(regs.a); m.step(0xdbe6, 4);
  regs.and(0x07); m.step(0xdbe8, 2);
  mem.write8(0x37, regs.a); m.step(0xdbea, 3);
  mem.write8(0x60cb, regs.a); m.step(0xdbed, 4);
  regs.a = mem.read8(0x60c8); regs.setNZ(regs.a); m.step(0xdbf0, 4);
  regs.and(0x20); m.step(0xdbf2, 2);
  regs.a = regs.lsr(regs.a); m.step(0xdbf3, 2);
  regs.a = regs.lsr(regs.a); m.step(0xdbf4, 2);
  regs.ora(mem.read8(0x37)); m.step(0xdbf6, 3);
  return m.ret(6);
}
