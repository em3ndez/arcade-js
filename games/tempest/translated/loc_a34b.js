// SPDX-License-Identifier: GPL-3.0-only
// loc_a34b  (ROM 0xa34b-0xa36e) -- sets $013b=0xff, $2c=1, copies $0202->$29 and $0200->$2d, calls ccb0
// then a3d6, sets $0201=0x81 and $013c=1, rts.
export function loc_a34b(m) {
  const { regs, mem } = m;
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa34d, 2);
  mem.write8(0x013b, regs.a); m.step(0xa350, 4);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa352, 2);
  mem.write8(0x2c, regs.a); m.step(0xa354, 3);
  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0xa357, 4);
  mem.write8(0x29, regs.a); m.step(0xa359, 3);
  regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0xa35c, 4);
  mem.write8(0x2d, regs.a); m.step(0xa35e, 3);
  m.push16(0xa360); m.step(0xa361, 6); m.call(0xccb0);
  m.push16(0xa363); m.step(0xa364, 6); m.call(0xa3d6);
  regs.a = 0x81; regs.setNZ(regs.a); m.step(0xa366, 2);
  mem.write8(0x0201, regs.a); m.step(0xa369, 4);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa36b, 2);
  mem.write8(0x013c, regs.a); m.step(0xa36e, 4);
  return m.ret(6);
}
