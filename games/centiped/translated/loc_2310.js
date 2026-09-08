// SPDX-License-Identifier: GPL-3.0-only
// loc_2310  (ROM 0x2310-0x231f) -- copies $54,x to $8b, sets Y = sign of $44,x ($ff if negative else $01),
// loads $64,x into A; RTS (X selects the object slot).
export function loc_2310(m) {
  const { regs, mem } = m;
  regs.a = mem.read8((0x0054 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2312, 4); // 2310 lda $54,x
  mem.write8(0x008b, regs.a); m.step(0x2314, 3);                     // 2312 sta $8b
  regs.y = 0xff; regs.setNZ(regs.y); m.step(0x2316, 2);            // 2314 ldy #$ff
  regs.a = mem.read8((0x0044 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2318, 4); // 2316 lda $44,x
  if (regs.fN) {
    m.step(0x231c, 3);                                               // 2318 bmi $231c (taken)
  } else {
    m.step(0x231a, 2);                                               // 2318 bmi $231c (fall)
    regs.y = 0x01; regs.setNZ(regs.y); m.step(0x231c, 2);          // 231a ldy #$01
  }
  regs.a = mem.read8((0x0064 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x231e, 4); // 231c lda $64,x
  return m.ret(6);                                                   // 231e rts
}
