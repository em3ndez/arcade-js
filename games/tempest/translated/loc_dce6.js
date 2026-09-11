// SPDX-License-Identifier: GPL-3.0-only
// loc_dce6  (ROM 0xdce6-0xdd0c) -- zeros $73/$0414/$6090, stores A->$608e X->$608f, sets $608c=$6094=$10,
// then a dex loop scanning $6040 (bmi $dcfe skips) that on the first non-negative slot loads $6060->A and
// $6070->Y; exits (bmi $dd0c) when X underflows; rts. A and X are live-ins.
export function loc_dce6(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdce8, 2);
  mem.write8(0x0073, regs.y); m.step(0xdcea, 3);
  mem.write8(0x0414, regs.y); m.step(0xdced, 4);
  mem.write8(0x608e, regs.a); m.step(0xdcf0, 4);
  mem.write8(0x608f, regs.x); m.step(0xdcf3, 4);
  mem.write8(0x6090, regs.y); m.step(0xdcf6, 4);
  regs.x = 0x10; regs.setNZ(regs.x); m.step(0xdcf8, 2);
  mem.write8(0x608c, regs.x); m.step(0xdcfb, 4);
  mem.write8(0x6094, regs.x); m.step(0xdcfe, 4);
  while (true) {
    regs.x = regs.dec8(regs.x); m.step(0xdcff, 2);
    if (regs.fN) { m.step(0xdd0c, 3); break; }
    m.step(0xdd01, 2);
    regs.a = mem.read8(0x6040); regs.setNZ(regs.a); m.step(0xdd04, 4);
    if (regs.fN) { m.step(0xdcfe, 4); continue; }
    m.step(0xdd06, 2);
    regs.a = mem.read8(0x6060); regs.setNZ(regs.a); m.step(0xdd09, 4);
    regs.y = mem.read8(0x6070); regs.setNZ(regs.y); m.step(0xdd0c, 4);
    break;
  }
  return m.ret(6);
}
