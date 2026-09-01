// SPDX-License-Identifier: GPL-3.0-only
// loc_19dc  (ROM 0x19dc-0x19e5) -- ANDs the 0x2094 shadow with B (mask off bits), writes it back
// and out to port 3 (the sound latch), returns.
export function loc_19dc(m) {
  const { regs, mem, io } = m;
  regs.a = mem.read8(0x2094); m.step(0x19df, 13); // 19dc  lda 0x2094
  regs.and(regs.b); m.step(0x19e0, 4);            // 19df  ana b
  mem.write8(0x2094, regs.a); m.step(0x19e3, 13); // 19e0  sta 0x2094
  io.portOut(0x03, regs.a); m.step(0x19e5, 10);   // 19e3  out 0x03
  return m.ret(10);                                // 19e5  ret
}
