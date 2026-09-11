// SPDX-License-Identifier: GPL-3.0-only
// loc_91b5  (ROM 0x91b5-0x91c5) -- A*2 -> X, clears $29, loads the 16-bit pointer at table 0x91c6,x into $2a/$2b.
export function loc_91b5(m) {
  const { regs, mem } = m;
  regs.a = regs.asl(regs.a); m.step(0x91b6, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x91b7, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x91b9, 2);
  mem.write8(0x29, regs.a); m.step(0x91bb, 3);
  { const addr = (0x91c6 + regs.x) & 0xffff; regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x91be, 4 + ((addr & 0xff00) !== 0x9100 ? 1 : 0)); }
  mem.write8(0x2a, regs.a); m.step(0x91c0, 3);
  { const addr = (0x91c7 + regs.x) & 0xffff; regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x91c3, 4 + ((addr & 0xff00) !== 0x9100 ? 1 : 0)); }
  mem.write8(0x2b, regs.a); m.step(0x91c5, 3);
  return m.ret(6);
}
