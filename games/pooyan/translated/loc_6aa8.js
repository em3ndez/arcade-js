// SPDX-License-Identifier: GPL-3.0-only

// loc_6aa8  (ROM 0x6aa8-0x6ac4) -- state-1 object step, the rst-0x28 table[0] entry from loc_6a98.
// Runs the shared motion helper loc_4006, then subtracts speed (ix+9) from the 16-bit position
// (ix+6):(ix+5) (a borrow decrements the high byte). While (ix+6)!=0 it rets; on reaching 0 it clears
// (0x8f56) and advances the state (ix+2). Tail entry: its ret returns to loc_6a98's caller.
export function loc_6aa8(m) {
  const { regs, mem } = m;

  m.push16(0x6aab); m.step(0x4006, 17); m.call(0x4006);
  regs.a = mem.read8((regs.ix + 5) & 0xffff);  m.step(0x6aae, 19);
  regs.sub(mem.read8((regs.ix + 9) & 0xffff)); m.step(0x6ab1, 19);
  if (regs.fNC) {
    m.step(0x6ab6, 12);
  } else {
    m.step(0x6ab3, 7);
    regs.decMem8(mem, (regs.ix + 6) & 0xffff); m.step(0x6ab6, 23); // borrow
  }
  mem.write8((regs.ix + 5) & 0xffff, regs.a);  m.step(0x6ab9, 19);
  regs.a = mem.read8((regs.ix + 6) & 0xffff);  m.step(0x6abc, 19);
  regs.and(regs.a);                            m.step(0x6abd, 4);
  if (regs.fNZ) { m.ret(11); return; }         // 6abd  ret nz -- still descending
  m.step(0x6abe, 5);
  mem.write8(0x8f56, regs.a);                  m.step(0x6ac1, 13); // a==(ix+6)==0 here
  regs.incMem8(mem, (regs.ix + 2) & 0xffff);   m.step(0x6ac4, 23);
  m.ret();
}
