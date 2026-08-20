// SPDX-License-Identifier: GPL-3.0-only

// loc_361d  (ROM 0x361d-0x3624) -- guard: if (ix+0x08) bit0 is clear return, else tail to loc_3775.
// Reached only via jr c from loc_362d (its a<7 branch); the ret/tail run in that caller's frame.
export function loc_361d(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x3621, 20); // 361d bit 0,(ix+0x08)
  if (regs.fZ) { return m.ret(11); }                                    // 3621 ret z (bit0 clear)
  m.step(0x3622, 5);                                                    // ret z not taken
  m.step(0x3775, 10);                                                   // 3622 jp 0x3775 (tail)
  return m.call(0x3775);
}
