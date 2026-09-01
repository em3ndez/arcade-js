// SPDX-License-Identifier: GPL-3.0-only
// loc_0a93  (ROM 0x0a93-0x0aaa) -- for C bytes from DE: fetch [DE], call 0x08ff, then busy-wait
// (loc_0a9e) on the VBLANK-decremented timer 0x20c0 (seeded 7) before advancing DE. Loops on C.
export function loc_0a93(m) {
  const { regs, mem } = m;

  for (;;) {                                      // loc_0a93
    m.push16(regs.de); m.step(0x0a94, 11);        // 0a93 push d
    regs.a = mem.read8(regs.de); m.step(0x0a95, 7); // 0a94 ldax d
    m.push16(0x0a98); m.step(0x08ff, 17); m.call(0x08ff); // 0a95 call 0x08ff
    regs.de = m.pop16(); m.step(0x0a99, 10);      // 0a98 pop d
    regs.a = 0x07; m.step(0x0a9b, 7);             // 0a99 mvi a,0x07
    mem.write8(0x20c0, regs.a); m.step(0x0a9e, 13); // 0a9b sta 0x20c0
    for (;;) {                                    // loc_0a9e
      regs.a = mem.read8(0x20c0); m.step(0x0aa1, 13); // 0a9e lda 0x20c0
      regs.a = regs.dec8(regs.a); m.step(0x0aa2, 5);  // 0aa1 dcr a
      if (regs.fNZ) { m.step(0x0a9e, 10); continue; } // 0aa2 jnz 0x0a9e (taken)
      m.step(0x0aa5, 10);                         // 0aa2 jnz 0x0a9e (not taken)
      break;
    }
    regs.de = (regs.de + 1) & 0xffff; m.step(0x0aa6, 5); // 0aa5 inx d
    regs.c = regs.dec8(regs.c); m.step(0x0aa7, 5);  // 0aa6 dcr c
    if (regs.fNZ) { m.step(0x0a93, 10); continue; } // 0aa7 jnz 0x0a93 (taken)
    m.step(0x0aaa, 10);                           // 0aa7 jnz 0x0a93 (not taken)
    break;
  }
  return m.ret(10);                               // 0aaa ret
}
