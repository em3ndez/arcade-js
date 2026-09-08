// SPDX-License-Identifier: GPL-3.0-only
// loc_303e (ROM 0x303e-0x3046) -- seeds $b2 = 0x13 and $34+X = 0xff, then falls through to loc_3046.
export function loc_303e(m) {
  const { regs, mem } = m;
  regs.a = 0x13; regs.setNZ(regs.a); m.step(0x3040, 2);            // 303e lda #$13
  mem.write8(0x00b2, regs.a); m.step(0x3042, 3);                   // 3040 sta $b2
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x3044, 2);            // 3042 lda #$ff
  mem.write8((0x0034 + regs.x) & 0xff, regs.a); m.step(0x3046, 4); // 3044 sta $34,x
  return m.call(0x3046);                                           // fall through into loc_3046
}
