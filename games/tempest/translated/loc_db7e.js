// SPDX-License-Identifier: GPL-3.0-only
// loc_db7e  (ROM 0xdb7e-0xdb83) -- loads X=$b6/A=$32 then bne to loc_db88 (A=$32 nonzero -> always taken);
// the never-taken fall runs into loc_db84.
export function loc_db7e(m) {
  const { regs } = m;
  regs.x = 0xb6; regs.setNZ(regs.x); m.step(0xdb80, 2);
  regs.a = 0x32; regs.setNZ(regs.a); m.step(0xdb82, 2);
  if (regs.fNZ) { m.step(0xdb88, 3); return m.call(0xdb88); }
  m.step(0xdb84, 2); return m.call(0xdb84);
}
