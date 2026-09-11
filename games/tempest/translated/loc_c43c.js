// SPDX-License-Identifier: GPL-3.0-only
// loc_c43c  (ROM 0xc43c-0xc452) -- copies four $03xx,x table cells into $61-$64, then rts.
export function loc_c43c(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xc43e, 3);
  regs.a = mem.read8((0x036a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc441, 4);
  mem.write8(0x61, regs.a); m.step(0xc443, 3);
  regs.a = mem.read8((0x035a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc446, 4);
  mem.write8(0x62, regs.a); m.step(0xc448, 3);
  regs.a = mem.read8((0x038a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc44b, 4);
  mem.write8(0x63, regs.a); m.step(0xc44d, 3);
  regs.a = mem.read8((0x037a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc450, 4);
  mem.write8(0x64, regs.a); m.step(0xc452, 3);
  return m.ret(6);
}
