// SPDX-License-Identifier: GPL-3.0-only
// loc_902b  (ROM 0x902b-0x904a) -- six init calls, then $0124=$0148=0xff, $0123=0x00, rts.
export function loc_902b(m) {
  const { regs, mem } = m;
  m.push16(0x902d); m.step(0x902e, 6); m.call(0x928f);
  m.push16(0x9030); m.step(0x9031, 6); m.call(0x926f);
  m.push16(0x9033); m.step(0x9034, 6); m.call(0x9246);
  m.push16(0x9036); m.step(0x9037, 6); m.call(0x929f);
  m.push16(0x9039); m.step(0x903a, 6); m.call(0x92ad);
  m.push16(0x903c); m.step(0x903d, 6); m.call(0xc16e);
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x903f, 2);
  mem.write8(0x0124, regs.a); m.step(0x9042, 4);
  mem.write8(0x0148, regs.a); m.step(0x9045, 4);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9047, 2);
  mem.write8(0x0123, regs.a); m.step(0x904a, 4);
  return m.ret(6);
}
