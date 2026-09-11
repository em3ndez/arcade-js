// SPDX-License-Identifier: GPL-3.0-only
// loc_a34b  (ROM 0xa34b-0xa36e) -- A=$ff head into loc_a34d, the $013b-seed mid-entry (0xa34d, jmp'd from
// loc_a343/loc_a347 with A=9/7), which stores A->$013b, sets A=1, falls into loc_a352 (the shared tail):
// stores A->$2c, copies $0202->$29 and $0200->$2d, calls ccb0 then a3d6, sets $0201=0x81 and $013c=1, rts.
// loc_a352 is a mid-routine entry (jsr'd from loc_a33a) with the caller's A as the $2c value (sta sets no flags).
export function loc_a34b(m) {
  const { regs } = m;
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa34d, 2);
  return loc_a34d(m);
}

export function loc_a34d(m) {
  const { regs, mem } = m;
  mem.write8(0x013b, regs.a); m.step(0xa350, 4);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa352, 2);
  return loc_a352(m);
}

export function loc_a352(m) {
  const { regs, mem } = m;
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
