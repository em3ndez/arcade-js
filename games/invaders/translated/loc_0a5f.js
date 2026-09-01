// SPDX-License-Identifier: GPL-3.0-only
// loc_0a5f  (ROM 0x0a5f-0x0a7f) -- if [0x20ef]!=0, run helpers 0x18fa/0x097c (B saved through C),
// then write the looked-up byte + markers at 0x20f1-0x20f3; either way leave HL=0x2062 and ret.
export function loc_0a5f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x20ef); m.step(0x0a62, 13);       // 0a5f lda 0x20ef
  regs.and(regs.a); m.step(0x0a63, 4);                  // 0a62 ana a
  if (regs.fNZ) {                                        // 0a63 jz 0x0a7c (not taken)
    m.step(0x0a66, 10);
    regs.c = regs.b; m.step(0x0a67, 5);                 // 0a66 mov c,b
    regs.b = 0x08; m.step(0x0a69, 7);                   // 0a67 mvi b,0x08
    m.push16(0x0a6c); m.step(0x18fa, 17); m.call(0x18fa); // 0a69 call 0x18fa
    regs.b = regs.c; m.step(0x0a6d, 5);                 // 0a6c mov b,c
    regs.a = regs.b; m.step(0x0a6e, 5);                 // 0a6d mov a,b
    m.push16(0x0a71); m.step(0x097c, 17); m.call(0x097c); // 0a6e call 0x097c
    regs.a = mem.read8(regs.hl); m.step(0x0a72, 7);     // 0a71 mov a,m
    regs.hl = 0x20f3; m.step(0x0a75, 10);               // 0a72 lxi h,0x20f3
    mem.write8(regs.hl, 0x00); m.step(0x0a77, 10);      // 0a75 mvi m,0x00
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0a78, 5);
    mem.write8(regs.hl, regs.a); m.step(0x0a79, 7);     // 0a78 mov m,a
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0a7a, 5);
    mem.write8(regs.hl, 0x01); m.step(0x0a7c, 10);      // 0a7a mvi m,0x01
  } else {
    m.step(0x0a7c, 10);                                 // 0a63 jz 0x0a7c (taken)
  }
  regs.hl = 0x2062; m.step(0x0a7f, 10);                 // 0a7c lxi h,0x2062
  return m.ret(10);                                     // 0a7f ret
}
