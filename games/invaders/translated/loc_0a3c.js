// SPDX-License-Identifier: GPL-3.0-only
// loc_0a3c  (ROM 0x0a3c-0x0a58) -- poll loc_0a59 ([0x2015]==0xff?); if NZ spin at loc_0a52 while
// it keeps returning NZ, else seed timer 0x20c0=0x30 and wait (loc_0a47) for the VBLANK-decremented
// timer to reach 0, re-polling loc_0a59 each tick. Returns via `rz` mid-loop or the tail ret.
export function loc_0a3c(m) {
  const { regs, mem } = m;

  m.push16(0x0a3f); m.step(0x0a59, 17); m.call(0x0a59); // 0a3c call 0x0a59
  if (regs.fNZ) {
    m.step(0x0a52, 10);                                 // 0a3f jnz 0x0a52 (taken)
  } else {
    m.step(0x0a42, 10);                                 // 0a3f jnz 0x0a52 (not taken)
    regs.a = 0x30; m.step(0x0a44, 7);                   // 0a42 mvi a,0x30
    mem.write8(0x20c0, regs.a); m.step(0x0a47, 13);     // 0a44 sta 0x20c0
    for (;;) {                                          // loc_0a47
      regs.a = mem.read8(0x20c0); m.step(0x0a4a, 13);   // 0a47 lda 0x20c0
      regs.and(regs.a); m.step(0x0a4b, 4);              // 0a4a ana a
      if (regs.fZ) { return m.ret(11); }                // 0a4b rz (taken)
      m.step(0x0a4c, 5);                                // 0a4b rz (not taken)
      m.push16(0x0a4f); m.step(0x0a59, 17); m.call(0x0a59); // 0a4c call 0x0a59
      if (regs.fZ) { m.step(0x0a47, 10); continue; }    // 0a4f jz 0x0a47 (taken)
      m.step(0x0a52, 10);                               // 0a4f jz 0x0a47 (not taken)
      break;
    }
  }

  for (;;) {                                            // loc_0a52
    m.push16(0x0a55); m.step(0x0a59, 17); m.call(0x0a59); // 0a52 call 0x0a59
    if (regs.fNZ) { m.step(0x0a52, 10); continue; }     // 0a55 jnz 0x0a52 (taken)
    m.step(0x0a58, 10);                                 // 0a55 jnz 0x0a52 (not taken)
    break;
  }
  return m.ret(10);                                     // 0a58 ret
}
