// SPDX-License-Identifier: GPL-3.0-only

// loc_1389  (ROM 0x1389-0x1390) -- guard: if (ix+0x08) bit0 is clear return, else tail to loc_141c.
// Reached only via jr c from loc_1399 (its a<7 branch); the ret/tail run in that caller's frame.
export function loc_1389(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x138d, 20); // 1389 bit 0,(ix+0x08)
  if (regs.fZ) { return m.ret(11); }                                    // 138d ret z (bit0 clear)
  m.step(0x138e, 5);                                                    // ret z not taken
  m.step(0x141c, 10);                                                   // 138e jp 0x141c (tail)
  return m.call(0x141c);
}
