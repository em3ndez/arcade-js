// SPDX-License-Identifier: GPL-3.0-only
// loc_c7a0  (ROM 0xc7a0-0xc7bc) -- main frame loop: jsr cd95, then forever { wait until frame
// counter $53>=9, clear $53, jsr c7bd/c891/b1b6, loop } (clc/bcc is the unconditional back-edge).
// No rts -- this routine does not return (the VBLANK IRQ advances $53).
export function loc_c7a0(m) {
  const { regs, mem } = m;
  m.push16(0xc7a2); m.step(0xc7a3, 6); m.call(0xcd95);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc7a5, 2);
  mem.write8(0x00, regs.a); m.step(0xc7a7, 3);
  // c7a7..c7bb outer loop (bcc back-edge is unconditional)
  while (true) {
    // c7a7..c7ab wait: while $53 < 9
    while (true) {
      regs.a = mem.read8(0x53); regs.setNZ(regs.a); m.step(0xc7a9, 3);
      regs.cmp(0x09); m.step(0xc7ab, 2);
      if (regs.fNC) { m.step(0xc7a7, 3); continue; }
      m.step(0xc7ad, 2); break;
    }
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc7af, 2);
    mem.write8(0x53, regs.a); m.step(0xc7b1, 3);
    m.push16(0xc7b3); m.step(0xc7b4, 6); m.call(0xc7bd);
    m.push16(0xc7b6); m.step(0xc7b7, 6); m.call(0xc891);
    m.push16(0xc7b9); m.step(0xc7ba, 6); m.call(0xb1b6);
    regs.clc(); m.step(0xc7bb, 2);
    m.step(0xc7a7, 3);
  }
}
