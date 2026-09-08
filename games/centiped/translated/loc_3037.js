// SPDX-License-Identifier: GPL-3.0-only
// loc_3037  (ROM 0x3037-0x303e) -- stashes Y at $8b, clears A, tail-JSRs loc_2db6, then falls into loc_303e.
export function loc_3037(m) {
  const { regs, mem } = m;
  mem.write8(0x008b, regs.y); m.step(0x3039, 3);          // 3037 sty $8b
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x303b, 2);   // 3039 lda #$00
  m.push16(0x303d); m.step(0x303e, 6); m.call(0x2db6);                      // 303b jsr $2db6
  return m.call(0x303e);                                  // fall into loc_303e
}
