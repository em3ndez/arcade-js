// SPDX-License-Identifier: GPL-3.0-only
// loc_b2de  (ROM 0xb2de-0xb2fd) -- like loc_b2be but into $3b/$3c and with the two tables swapped:
// $ce68 when $0415,x==0, $ce7a when !=0. Indexed by 2*A; clears $a9.
export function loc_b2de(m) {
  const { regs, mem } = m;
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xb2df, 2);
  regs.a = regs.asl(regs.a); m.step(0xb2e0, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb2e1, 2);
  { const ea = (0x0415 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb2e4, (0x0415 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  if (regs.fNZ) {
    m.step(0xb2ef, 3);
    { const ea = (0xce7a + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xb2f2, (0xce7a & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    { const ea = (0xce7b + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb2f5, (0xce7b & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  } else {
    m.step(0xb2e6, 2);
    { const ea = (0xce68 + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xb2e9, (0xce68 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    { const ea = (0xce69 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb2ec, (0xce69 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    regs.clv(); m.step(0xb2ed, 2);
    m.step(0xb2f5, 3);
  }
  mem.write8(0x3b, regs.x); m.step(0xb2f7, 3);
  mem.write8(0x3c, regs.a); m.step(0xb2f9, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb2fb, 2);
  mem.write8(0xa9, regs.a); m.step(0xb2fd, 3);
  return m.ret(6);
}
