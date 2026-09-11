// SPDX-License-Identifier: GPL-3.0-only
// loc_b2be  (ROM 0xb2be-0xb2dd) -- select a pointer pair into $74/$75 from table $ce68 (if $0415,x!=0)
// or $ce7a (if ==0), indexed by 2*A; clears $a9. A is the index (also -> X, Y=2*A).
export function loc_b2be(m) {
  const { regs, mem } = m;
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xb2bf, 2);
  regs.a = regs.asl(regs.a); m.step(0xb2c0, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb2c1, 2);
  { const ea = (0x0415 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb2c4, (0x0415 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  if (regs.fNZ) {
    m.step(0xb2cf, 3);
    { const ea = (0xce68 + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xb2d2, (0xce68 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    { const ea = (0xce69 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb2d5, (0xce69 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  } else {
    m.step(0xb2c6, 2);
    { const ea = (0xce7a + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xb2c9, (0xce7a & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    { const ea = (0xce7b + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb2cc, (0xce7b & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    regs.clv(); m.step(0xb2cd, 2);
    m.step(0xb2d5, 3);
  }
  mem.write8(0x74, regs.x); m.step(0xb2d7, 3);
  mem.write8(0x75, regs.a); m.step(0xb2d9, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb2db, 2);
  mem.write8(0xa9, regs.a); m.step(0xb2dd, 3);
  return m.ret(6);
}
