// SPDX-License-Identifier: GPL-3.0-only
// loc_db84  (ROM 0xdb84-0xdb99) -- A=$33/X=$0a, calls loc_df39, then zeroes $60c1..$60c7 and $60d1..$60d7
// at even indices (dex/dex bpl loop); rts. db88 is the shared entry for the db6f/db7e bne branches.
export function loc_db84(m) {
  const { regs, mem } = m;
  regs.a = 0x33; regs.setNZ(regs.a); m.step(0xdb86, 2);
  regs.x = 0x0a; regs.setNZ(regs.x); m.step(0xdb88, 2);
  m.push16((0xdb88 + 2) & 0xffff); m.step(0xdb8b, 6); m.call(0xdf39);
  regs.x = 0x06; regs.setNZ(regs.x); m.step(0xdb8d, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdb8f, 2);
  for (;;) {
    mem.write8((0x60c1 + regs.x) & 0xffff, regs.a); m.step(0xdb92, 5);
    mem.write8((0x60d1 + regs.x) & 0xffff, regs.a); m.step(0xdb95, 5);
    regs.x = regs.dec8(regs.x); m.step(0xdb96, 2);
    regs.x = regs.dec8(regs.x); m.step(0xdb97, 2);
    if (regs.fPl) { m.step(0xdb8f, 3); continue; }
    m.step(0xdb99, 2); break;
  }
  return m.ret(6);
}
