// SPDX-License-Identifier: GPL-3.0-only
// loc_b56a  (ROM 0xb56a-0xb585) -- writes 4 bytes at ($74): 0,0,0,A (A saved on stack), then advances ptr $74/$75 by 4.
export function loc_b56a(m) {
  const { regs, mem } = m;
  m.push8(regs.a); m.step(0xb56b, 3);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb56d, 2);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xb56e, 2);
  mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb570, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb571, 2);
  mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb573, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb574, 2);
  mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb576, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xb577, 2);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xb578, 4);
  mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb57a, 6);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xb57c, 2);
  regs.clc(); m.step(0xb57d, 2);
  regs.adc(mem.read8(0x74)); m.step(0xb57f, 3);
  mem.write8(0x74, regs.a); m.step(0xb581, 3);
  if (regs.fNC) {
    m.step(0xb585, 3);
  } else {
    m.step(0xb583, 2);
    const v = (mem.read8(0x75) + 1) & 0xff; mem.write8(0x75, v); regs.setNZ(v); m.step(0xb585, 5);
  }
  return m.ret(6);
}
