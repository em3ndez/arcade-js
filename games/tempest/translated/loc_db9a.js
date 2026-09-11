// SPDX-License-Identifier: GPL-3.0-only
// loc_db9a  (ROM 0xdb9a-0xdbd4) -- steps $39 (unless $03&0x3f!=0), indexes tables 0xdbd5/0xdbd6/0xdfdc,x to
// write $60c0/$60c1 slots, calls loc_df39 & loc_df6c, then tail-jumps loc_df39.
export function loc_db9a(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xdb9c, 3);
  regs.and(0x3f); m.step(0xdb9e, 2);
  if (regs.fNZ) {
    m.step(0xdba2, 3);
  } else {
    m.step(0xdba0, 2);
    const v = (mem.read8(0x39) + 1) & 0xff; mem.write8(0x39, v); regs.setNZ(v); m.step(0xdba2, 5);
  }
  regs.a = mem.read8(0x39); regs.setNZ(regs.a); m.step(0xdba4, 3);
  regs.and(0x07); m.step(0xdba6, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xdba7, 2);
  regs.y = mem.read8((0xdbd5 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xdbaa, 4);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdbac, 2);
  mem.write8((0x60c1 + regs.y) & 0xffff, regs.a); m.step(0xdbaf, 5);
  regs.y = mem.read8((0xdbd6 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xdbb2, 4);
  regs.a = mem.read8((0xdfdc + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xdbb5, 4);
  mem.write8((0x60c0 + regs.y) & 0xffff, regs.a); m.step(0xdbb8, 5);
  regs.a = 0xa8; regs.setNZ(regs.a); m.step(0xdbba, 2);
  mem.write8((0x60c1 + regs.y) & 0xffff, regs.a); m.step(0xdbbd, 5);
  regs.a = 0x34; regs.setNZ(regs.a); m.step(0xdbbf, 2);
  regs.x = 0x56; regs.setNZ(regs.x); m.step(0xdbc1, 2);
  m.push16((0xdbc1 + 2) & 0xffff); m.step(0xdbc4, 6); m.call(0xdf39);
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xdbc6, 3);
  regs.and(0x7f); m.step(0xdbc8, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xdbc9, 2);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xdbcb, 2);
  m.push16((0xdbcb + 2) & 0xffff); m.step(0xdbce, 6); m.call(0xdf6c);
  regs.a = 0x34; regs.setNZ(regs.a); m.step(0xdbd0, 2);
  regs.x = 0xaa; regs.setNZ(regs.x); m.step(0xdbd2, 2);
  m.step(0xdf39, 3); return m.call(0xdf39);
}
