// SPDX-License-Identifier: GPL-3.0-only
// loc_96db (ROM 0x96db-0x96e1) -- read (0x2c),y and add the base at $0160, then rts. Dispatch target
// ($968f table via loc_9677); resolves a list entry to an absolute coordinate.
export function loc_96db(m) {
  const { regs, mem } = m;
  const p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x96dd, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0));
  regs.clc(); m.step(0x96de, 2);
  regs.adc(mem.read8(0x0160)); m.step(0x96e1, 4);
  return m.ret(6);
}
