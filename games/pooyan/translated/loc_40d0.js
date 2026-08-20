// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_40E1 = "0x40e1 (state (ix+2)&0x1f, 0..0x10): 4103 4137 416f 4179 4179 4179 4179 4179 417a 418d 4179 4221 4350 4364 4378 4378 4378";

// loc_40d0  (ROM 0x40d0-0x40e0) -- IX-object state dispatcher. Returns early unless the object is
// live ((ix+0)|(ix+1) bit0 clear) and its state (ix+2)&0x1f is below 0x11; otherwise rst 0x28 tail-
// dispatches through the inline 17-word table at 0x40e1 (the handler ret's to loc_40d0's caller).
export function loc_40d0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x40d3, 19); // ld a,(ix+0)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x40d6, 19); // or (ix+1)
  regs.rrca();                                   m.step(0x40d7, 4);
  if (regs.fNC) { return m.ret(11); } // ret nc -- object inactive
  m.step(0x40d8, 5);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x40db, 19); // ld a,(ix+2)
  regs.and(0x1f);                                m.step(0x40dd, 7);
  regs.cp(0x11);                                 m.step(0x40df, 7);
  if (regs.fNC) { return m.ret(11); } // ret nc -- state index out of range
  m.step(0x40e0, 5);

  m.push16(0x40e1);            // rst 0x28 pushes the inline table base
  m.step(0x0028, 11);
  return m.call(0x0028, DISPATCH_TABLE_40E1);
}
