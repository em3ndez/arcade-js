// SPDX-License-Identifier: GPL-3.0-only

// loc_6a98  (ROM 0x6a98-0x6aa3) -- per-object state handler, called once per record by loc_6a7f.
// Inactive when (ix+1)==0. Otherwise dispatches on state ((ix+2)-1 & 3) through the rst-0x28
// trampoline: the inline word table at 0x6aa4 is [0x6aa8, 0x67df] (two entries -- code resumes at
// 0x6aa8). Tail dispatch: the chosen handler ret's to loc_6a98's caller, so no continuation follows.
const DISPATCH_TABLE_6AA4 = "0x6aa4 (object state, selector (ix+2)-1 & 3): 6aa8 67df";

export function loc_6a98(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 1) & 0xffff); m.step(0x6a9b, 19);
  regs.and(regs.a);                           m.step(0x6a9c, 4);
  if (regs.fZ) { m.ret(11); return; }         // 6a9c  ret z -- inactive slot
  m.step(0x6a9d, 5);
  regs.a = mem.read8((regs.ix + 2) & 0xffff); m.step(0x6aa0, 19);
  regs.a = regs.dec8(regs.a);                 m.step(0x6aa1, 4);
  regs.and(0x03);                             m.step(0x6aa3, 7);
  m.push16(0x6aa4); m.step(0x0028, 11);       // 6aa3  rst 0x28
  return m.call(0x0028, DISPATCH_TABLE_6AA4);
}
