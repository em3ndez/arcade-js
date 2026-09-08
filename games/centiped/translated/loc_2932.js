// SPDX-License-Identifier: GPL-3.0-only
// loc_2932  (ROM 0x2932-0x2950) -- seeds the player/shot start cells $42/$43/$62/$63/$72/$73 from fixed
// constants EORed against the $F0-$F2 orientation bytes; RTS.
export function loc_2932(m) {
  const { regs, mem } = m;
  regs.a = 0x10; regs.setNZ(regs.a); m.step(0x2934, 2);
  regs.eor(mem.read8(0x00f2)); m.step(0x2936, 3);                 // 2934 eor $f2
  mem.write8(0x0043, regs.a); m.step(0x2938, 3);                  // 2936 sta $43
  regs.a = 0x80; regs.setNZ(regs.a); m.step(0x293a, 2);
  mem.write8(0x0063, regs.a); m.step(0x293c, 3);                  // 293a sta $63
  mem.write8(0x0062, regs.a); m.step(0x293e, 3);                  // 293c sta $62
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0x2940, 2);
  regs.eor(mem.read8(0x00f0)); m.step(0x2942, 3);                 // 2940 eor $f0
  mem.write8(0x0073, regs.a); m.step(0x2944, 3);                  // 2942 sta $73
  regs.a = 0x0c; regs.setNZ(regs.a); m.step(0x2946, 2);           // 2944 lda #$0c
  regs.eor(mem.read8(0x00f1)); m.step(0x2948, 3);                 // 2946 eor $f1
  mem.write8(0x0072, regs.a); m.step(0x294a, 3);                  // 2948 sta $72
  regs.a = 0x11; regs.setNZ(regs.a); m.step(0x294c, 2);           // 294a lda #$11
  regs.eor(mem.read8(0x00f2)); m.step(0x294e, 3);                 // 294c eor $f2
  mem.write8(0x0042, regs.a); m.step(0x2950, 3);                  // 294e sta $42
  return m.ret(6);                                                // 2950 rts
}
