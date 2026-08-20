// SPDX-License-Identifier: GPL-3.0-only

// loc_1391  (ROM 0x1391-0x1398) -- guard: if (ix+0x08) bit0 is set return, else tail to loc_12d0.
// Reached only via jr nc from loc_1399 (its a>=0x14 branch); the ret/tail run in that caller's frame.
export function loc_1391(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x1395, 20); // 1391 bit 0,(ix+0x08)
  if (regs.fNZ) { return m.ret(11); }                                   // 1395 ret nz (bit0 set)
  m.step(0x1396, 5);                                                    // ret nz not taken
  m.step(0x12d0, 10);                                                   // 1396 jp 0x12d0 (tail)
  return m.call(0x12d0);
}
