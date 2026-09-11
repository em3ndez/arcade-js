// SPDX-License-Identifier: GPL-3.0-only
// loc_93e0  (ROM 0x93e0-0x93f9) -- shifts A left 3x rol-ing carry into $29 (init 0xff), then
// derives X = (0x0d - ($29 ^ 0xff)) >> 1 while preserving A across pha/pla; rts.
export function loc_93e0(m) {
  const { regs, mem } = m;
  regs.y = 0xff; regs.setNZ(regs.y); m.step(0x93e2, 2);
  mem.write8(0x29, regs.y); m.step(0x93e4, 3);
  regs.a = regs.asl(regs.a); m.step(0x93e5, 2);
  mem.write8(0x29, regs.rol(mem.read8(0x29))); m.step(0x93e7, 5);
  regs.a = regs.asl(regs.a); m.step(0x93e8, 2);
  mem.write8(0x29, regs.rol(mem.read8(0x29))); m.step(0x93ea, 5);
  regs.a = regs.asl(regs.a); m.step(0x93eb, 2);
  mem.write8(0x29, regs.rol(mem.read8(0x29))); m.step(0x93ed, 5);
  regs.y = mem.read8(0x29); regs.setNZ(regs.y); m.step(0x93ef, 3);
  m.push8(regs.a); m.step(0x93f0, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0x93f1, 2);
  regs.eor(0xff); m.step(0x93f3, 2);
  regs.clc(); m.step(0x93f4, 2);
  regs.adc(0x0d); m.step(0x93f6, 2);
  regs.a = regs.lsr(regs.a); m.step(0x93f7, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x93f8, 2);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x93f9, 4);
  return m.ret(6);
}
