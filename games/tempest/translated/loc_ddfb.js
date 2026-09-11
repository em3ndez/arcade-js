// SPDX-License-Identifier: GPL-3.0-only
// loc_ddfb  (ROM 0xddfb-0xde10) -- entry ddfb: A=$04,Y=$00; the ddfd alt-entry sets Y=$00 with A preset;
// the ddff alt-entry (A/Y preset) is the shared tail: Y->$01c6, $01c7 |= A, $01c8 |= A; rts. loc_ddfd and
// loc_ddff are exported so the ddf7/dde9/dded/ddf1 branches into $ddfd/$ddff dispatch.
export function loc_ddfb(m) {
  const { regs } = m;
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xddfd, 2);
  return loc_ddfd(m);
}

export function loc_ddfd(m) {
  const { regs } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xddff, 2);
  return loc_ddff(m);
}

export function loc_ddff(m) {
  const { regs, mem } = m;
  mem.write8(0x01c6, regs.y); m.step(0xde02, 4);
  m.push8(regs.a); m.step(0xde03, 3);
  regs.ora(mem.read8(0x01c7)); m.step(0xde06, 4);
  mem.write8(0x01c7, regs.a); m.step(0xde09, 4);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xde0a, 4);
  regs.ora(mem.read8(0x01c8)); m.step(0xde0d, 4);
  mem.write8(0x01c8, regs.a); m.step(0xde10, 4);
  return m.ret(6);
}
