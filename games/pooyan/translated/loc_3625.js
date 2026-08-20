// SPDX-License-Identifier: GPL-3.0-only

// loc_3625  (ROM 0x3625-0x362c) -- guard: if (ix+0x08) bit0 is set return, else tail to loc_357c.
// Reached only via jr nc from loc_362d (its a>=0x14 branch); the ret/tail run in that caller's frame.
export function loc_3625(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x3629, 20); // 3625 bit 0,(ix+0x08)
  if (regs.fNZ) { return m.ret(11); }                                   // 3629 ret nz (bit0 set)
  m.step(0x362a, 5);                                                    // ret nz not taken
  m.step(0x357c, 10);                                                   // 362a jp 0x357c (tail)
  return m.call(0x357c);
}
