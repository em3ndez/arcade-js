// SPDX-License-Identifier: GPL-3.0-only
// loc_db6f  (ROM 0xdb6f-0xdb7d) -- Y=($50>>1), A=$68, calls loc_df4c, loads X=$4e/A=$33 then bne to
// loc_db88 (A=$33 nonzero -> always taken); the never-taken fall runs into loc_db7e.
export function loc_db6f(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x50); regs.setNZ(regs.a); m.step(0xdb71, 3);
  regs.a = regs.lsr(regs.a); m.step(0xdb72, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xdb73, 2);
  regs.a = 0x68; regs.setNZ(regs.a); m.step(0xdb75, 2);
  m.push16((0xdb75 + 2) & 0xffff); m.step(0xdb78, 6); m.call(0xdf4c);
  regs.x = 0x4e; regs.setNZ(regs.x); m.step(0xdb7a, 2);
  regs.a = 0x33; regs.setNZ(regs.a); m.step(0xdb7c, 2);
  if (regs.fNZ) { m.step(0xdb88, 3); return m.call(0xdb88); }
  m.step(0xdb7e, 2); return m.call(0xdb7e);
}
