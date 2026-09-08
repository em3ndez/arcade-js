// SPDX-License-Identifier: GPL-3.0-only
// loc_2509  (ROM 0x2509-0x252a) -- broadcasts $fe to $bd/$bf, the $1c07 + $2400 hardware ports, and the
// $ef-$f8 sound/state block; RTS.
export function loc_2509(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x00fe); regs.setNZ(regs.a); m.step(0x250b, 3); // 2509 lda $fe
  mem.write8(0x00bd, regs.a); m.step(0x250d, 3);                     // 250b sta $bd
  mem.write8(0x00bf, regs.a); m.step(0x250f, 3);                     // 250d sta $bf
  mem.write8(0x1c07, regs.a); m.step(0x2512, 4);                     // 250f sta $1c07
  mem.write8(0x2400, regs.a); m.step(0x2515, 4);                     // 2512 sta $2400
  mem.write8(0x00f5, regs.a); m.step(0x2517, 3);
  mem.write8(0x00f7, regs.a); m.step(0x2519, 3);
  mem.write8(0x00f6, regs.a); m.step(0x251b, 3);
  mem.write8(0x00f0, regs.a); m.step(0x251d, 3);
  mem.write8(0x00ef, regs.a); m.step(0x251f, 3);                     // 251d sta $ef
  mem.write8(0x00f1, regs.a); m.step(0x2521, 3);                     // 251f sta $f1
  mem.write8(0x00f2, regs.a); m.step(0x2523, 3);                     // 2521 sta $f2
  mem.write8(0x00f3, regs.a); m.step(0x2525, 3);                     // 2523 sta $f3
  mem.write8(0x00f4, regs.a); m.step(0x2527, 3);                     // 2525 sta $f4
  mem.write8(0x00f8, regs.a); m.step(0x2529, 3);                     // 2527 sta $f8
  return m.ret(6);                                                   // 2529 rts
}
