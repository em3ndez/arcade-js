// SPDX-License-Identifier: GPL-3.0-only

// loc_5f76  (ROM 0x5f76-0x5f82) -- B-count driver loop around loc_5f83. Each pass swaps to the
// alternate set, runs loc_5f83, swaps back, advances IY by DE, and latches B into the I register
// (loc_5f83 reads it via `ld a,i`). djnz counts B iterations; ret on exhaustion.
export function loc_5f76(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.exx();               m.step(0x5f77, 4);  // 5f76 exx
    m.push16(0x5f7a);
    m.step(0x5f83, 17);                           // 5f77 call 0x5f83
    m.call(0x5f83);
    regs.exx();               m.step(0x5f7b, 4);  // 5f7a exx
    regs.addIy(regs.de);      m.step(0x5f7d, 15); // 5f7b add iy,de
    regs.a = regs.b;          m.step(0x5f7e, 4);  // 5f7d ld a,b
    regs.i = regs.a;          m.step(0x5f80, 9);  // 5f7e ld i,a
    if (regs.djnz()) { m.step(0x5f76, 13); } else { m.step(0x5f82, 8); break; } // 5f80 djnz 0x5f76
  }
  return m.ret(10);                               // 5f82 ret
}
