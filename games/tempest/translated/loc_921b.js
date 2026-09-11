// SPDX-License-Identifier: GPL-3.0-only
// loc_921b  (ROM 0x921b-0x9233) -- seeds $0200=0x0e, $51=0xf0, $0106=0x00, $0201=0x0f, $0202=0x10, rts.
export function loc_921b(m) {
  const { regs, mem } = m;
  regs.a = 0x0e; regs.setNZ(regs.a); m.step(0x921d, 2);
  mem.write8(0x0200, regs.a); m.step(0x9220, 4);
  regs.a = 0xf0; regs.setNZ(regs.a); m.step(0x9222, 2);
  mem.write8(0x51, regs.a); m.step(0x9224, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9226, 2);
  mem.write8(0x0106, regs.a); m.step(0x9229, 4);
  regs.a = 0x0f; regs.setNZ(regs.a); m.step(0x922b, 2);
  mem.write8(0x0201, regs.a); m.step(0x922e, 4);
  regs.a = 0x10; regs.setNZ(regs.a); m.step(0x9230, 2);
  mem.write8(0x0202, regs.a); m.step(0x9233, 4);
  return m.ret(6);
}
