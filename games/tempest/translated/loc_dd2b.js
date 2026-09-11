// SPDX-License-Identifier: GPL-3.0-only
// loc_dd2b  (ROM 0xdd2b-0xdd40) -- Y->$35, jsr df75; then 8 passes ($37 = 7..0): asl $35 into carry, roll
// carry into A (A=0/1), jsr df1f (emit the digit), dec $37, bpl loop; rts. Y is a live-in.
export function loc_dd2b(m) {
  const { regs, mem } = m;
  mem.write8(0x0035, regs.y); m.step(0xdd2d, 3);
  m.push16(0xdd2f); m.step(0xdd30, 6); m.call(0xdf75);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xdd32, 2);
  mem.write8(0x0037, regs.x); m.step(0xdd34, 3);
  while (true) {
    mem.write8(0x0035, regs.asl(mem.read8(0x0035))); m.step(0xdd36, 5);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdd38, 2);
    regs.a = regs.rol(regs.a); m.step(0xdd39, 2);
    m.push16(0xdd3b); m.step(0xdd3c, 6); m.call(0xdf1f);
    mem.write8(0x0037, regs.dec8(mem.read8(0x0037))); m.step(0xdd3e, 5);
    if (!regs.fN) { m.step(0xdd34, 3); continue; }
    m.step(0xdd40, 2); break;
  }
  return m.ret(6);
}
