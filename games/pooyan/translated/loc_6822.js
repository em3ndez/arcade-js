// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_6834 = "0x6834 ((ix+2) state of the 0x8b28 record): 0..2 = 683a 6857 68ac";

// loc_6822  (ROM 0x6822-0x6833) -- 0x8b28 record state dispatcher, gated by 0x8afa. When the gate
// is zero it returns; otherwise IX = 0x8ae0+0x48 (=0x8b28) and it rst 0x28 tail-dispatches state
// (ix+2) through the inline 3-word table at 0x6834 (handler ret's to loc_6822's caller).
export function loc_6822(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8afa);   m.step(0x6825, 13);
  regs.and(regs.a);             m.step(0x6826, 4);
  if (regs.fZ) { return m.ret(11); } // 6826  ret z -- gate closed
  m.step(0x6827, 5);
  regs.ix = 0x8ae0;             m.step(0x682b, 14);
  regs.de = 0x0048;             m.step(0x682e, 10);
  regs.addIx(regs.de);          m.step(0x6830, 15); // 682e  add ix,de -> record at 0x8b28
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x6833, 19);           // 6830  ld a,(ix+0x02)
  m.push16(0x6834);
  m.step(0x0028, 11);           // 6833  rst 0x28 -- pushes inline table base 0x6834
  return m.call(0x0028, DISPATCH_TABLE_6834);
}
