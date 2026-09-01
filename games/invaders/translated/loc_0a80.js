// SPDX-License-Identifier: GPL-3.0-only
// loc_0a80  (ROM 0x0a80-0x0a92) -- set 0x20c1=2, then spin (loc_0a85) strobing OUT 0x06 and
// waiting for [0x20cb]!=0; on release clear A and 0x20c1, then ret.
export function loc_0a80(m) {
  const { regs, mem } = m;

  regs.a = 0x02; m.step(0x0a82, 7);              // 0a80 mvi a,0x02
  mem.write8(0x20c1, regs.a); m.step(0x0a85, 13); // 0a82 sta 0x20c1
  for (;;) {                                      // loc_0a85
    m.io.portOut(0x06, regs.a); m.step(0x0a87, 10); // 0a85 out 0x06
    regs.a = mem.read8(0x20cb); m.step(0x0a8a, 13); // 0a87 lda 0x20cb
    regs.and(regs.a); m.step(0x0a8b, 4);          // 0a8a ana a
    if (regs.fZ) { m.step(0x0a85, 10); continue; } // 0a8b jz 0x0a85 (taken)
    m.step(0x0a8e, 10);                           // 0a8b jz 0x0a85 (not taken)
    break;
  }
  regs.xor(regs.a); m.step(0x0a8f, 4);            // 0a8e xra a
  mem.write8(0x20c1, regs.a); m.step(0x0a92, 13); // 0a8f sta 0x20c1
  return m.ret(10);                               // 0a92 ret
}
