// SPDX-License-Identifier: GPL-3.0-only
// loc_b0c6  (ROM 0xb0c6-0xb0d0) -- txa; jsr 0x91b5 (pointer setup); lda #$29/ldy #$03; tail-jmp 0xdfb1.
export function loc_b0c6(m) {
  const { regs, mem } = m;
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xb0c7, 2);
  m.push16(0xb0c9); m.step(0xb0ca, 6); m.call(0x91b5);
  regs.a = 0x29; regs.setNZ(regs.a); m.step(0xb0cc, 2);
  regs.y = 0x03; regs.setNZ(regs.y); m.step(0xb0ce, 2);
  m.step(0xdfb1, 3); return m.call(0xdfb1);
}
