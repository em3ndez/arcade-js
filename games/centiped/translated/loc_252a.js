// SPDX-License-Identifier: GPL-3.0-only
// loc_252a  (ROM 0x252a-0x2560) -- seeds the $EF-$F8 constant block and the $1C07/$2400 ports with fixed
// bytes, clears $BD/$BF; RTS.
export function loc_252a(m) {
  const { regs, mem } = m;
  regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x252c, 2);   // 252a lda #$f8
  mem.write8(0x00f0, regs.a); m.step(0x252e, 3);          // 252c sta $f0
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x2530, 2);
  mem.write8(0x00f3, regs.a); m.step(0x2532, 3);          // 2530 sta $f3
  regs.a = 0xfe; regs.setNZ(regs.a); m.step(0x2534, 2);
  mem.write8(0x00f4, regs.a); m.step(0x2536, 3);          // 2534 sta $f4
  regs.a = 0xfc; regs.setNZ(regs.a); m.step(0x2538, 2);
  mem.write8(0x00f8, regs.a); m.step(0x253a, 3);          // 2538 sta $f8
  regs.a = 0xe0; regs.setNZ(regs.a); m.step(0x253c, 2);
  mem.write8(0x00f1, regs.a); m.step(0x253e, 3);          // 253c sta $f1
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0x2540, 2);
  mem.write8(0x00ef, regs.a); m.step(0x2542, 3);          // 2540 sta $ef
  regs.a = 0x40; regs.setNZ(regs.a); m.step(0x2544, 2);
  mem.write8(0x00f2, regs.a); m.step(0x2546, 3);          // 2544 sta $f2
  regs.a = 0xbf; regs.setNZ(regs.a); m.step(0x2548, 2);
  mem.write8(0x00f5, regs.a); m.step(0x254a, 3);          // 2548 sta $f5
  regs.a = 0x03; regs.setNZ(regs.a); m.step(0x254c, 2);
  mem.write8(0x00f7, regs.a); m.step(0x254e, 3);          // 254c sta $f7
  regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x2550, 2);
  mem.write8(0x00f6, regs.a); m.step(0x2552, 3);          // 2550 sta $f6
  regs.a = 0x80; regs.setNZ(regs.a); m.step(0x2554, 2);   // 2552 lda #$80
  mem.write8(0x1c07, regs.a); m.step(0x2557, 4);          // 2554 sta $1c07
  mem.write8(0x2400, regs.a); m.step(0x255a, 4);          // 2557 sta $2400
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x255c, 2);   // 255a lda #$00
  mem.write8(0x00bd, regs.a); m.step(0x255e, 3);          // 255c sta $bd
  mem.write8(0x00bf, regs.a); m.step(0x2560, 3);          // 255e sta $bf
  return m.ret(6);                                        // 2560 rts
}
