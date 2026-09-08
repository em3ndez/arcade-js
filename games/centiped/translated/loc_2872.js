// SPDX-License-Identifier: GPL-3.0-only
// loc_2872  (ROM 0x2872-0x28bf) -- seeds $9b/$9c/$9d/$9e/$88/$53/$83 and hardware regs $1008/$100f, zeroes the
// $b2..$b8 and $a8..$ad tables, folds $100a into $c8, seeds $a0/$a2/$a3, and falls through into loc_28bf.
export function loc_2872(m) {
  const { regs, mem } = m;
  regs.a = 0x20; regs.setNZ(regs.a); m.step(0x2874, 2);                          // 2872 lda #$20
  mem.write8(0x1008, regs.a); m.step(0x2877, 4);                                 // 2874 sta $1008
  regs.a = 0x0c; regs.setNZ(regs.a); m.step(0x2879, 2);
  mem.write8(0x009b, regs.a); m.step(0x287b, 3);                                 // 2879 sta $9b
  mem.write8(0x009c, regs.a); m.step(0x287d, 3);
  regs.a = mem.read8(0x00ff); regs.setNZ(regs.a); m.step(0x287f, 3);             // 287d lda $ff
  mem.write8(0x0088, regs.a); m.step(0x2881, 3);                                 // 287f sta $88
  mem.write8(0x0053, regs.a); m.step(0x2883, 3);
  mem.write8(0x0083, regs.a); m.step(0x2885, 3);
  regs.a = 0x02; regs.setNZ(regs.a); m.step(0x2887, 2);
  mem.write8(0x009d, regs.a); m.step(0x2889, 3);                                 // 2887 sta $9d
  mem.write8(0x009e, regs.a); m.step(0x288b, 3);
  regs.x = 0x06; regs.setNZ(regs.x); m.step(0x288d, 2);                          // 288b ldx #$06
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x288f, 2);
  mem.write8(0x100f, regs.a); m.step(0x2892, 4);                                 // 288f sta $100f
  for (;;) {                                                                     // 2892 loop
    mem.write8((0x00b2 + regs.x) & 0xff, regs.a); m.step(0x2894, 4);             // 2892 sta $b2,x
    regs.x = regs.dec8(regs.x); m.step(0x2895, 2);
    if (regs.fPl) { m.step(0x2892, 3); continue; }                              // 2895 bpl $2892 (taken)
    m.step(0x2897, 2); break;
  }
  regs.x = 0x05; regs.setNZ(regs.x); m.step(0x2899, 2);                          // 2897 ldx #$05
  for (;;) {                                                                     // 2899 loop
    mem.write8((0x00a8 + regs.x) & 0xff, regs.a); m.step(0x289b, 4);             // 2899 sta $a8,x
    regs.x = regs.dec8(regs.x); m.step(0x289c, 2);
    if (regs.fPl) { m.step(0x2899, 3); continue; }                              // 289c bpl $2899 (taken)
    m.step(0x289e, 2); break;
  }
  regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x28a1, 4);             // 289e lda $100a
  regs.eor(mem.read8(0x100a)); m.step(0x28a4, 4);
  regs.clc(); m.step(0x28a5, 2);
  regs.adc(mem.read8(0x00c8)); m.step(0x28a7, 3);
  mem.write8(0x00c8, regs.a); m.step(0x28a9, 3);                                 // 28a7 sta $c8
  regs.a = 0x03; regs.setNZ(regs.a); m.step(0x28ab, 2);                          // 28a9 lda #$03
  mem.write8(0x100f, regs.a); m.step(0x28ae, 4);                                 // 28ab sta $100f
  m.step(0x28b1, 6); m.call(0x231f);                                             // 28ae jsr $231f
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0x28b3, 2);                          // 28b1 lda #$c0
  mem.write8(0x00a0, regs.a); m.step(0x28b5, 3);                                 // 28b3 sta $a0
  mem.write8(0x00a2, regs.a); m.step(0x28b7, 3);                                 // 28b5 sta $a2
  mem.write8(0x00a3, regs.a); m.step(0x28b9, 3);
  m.step(0x28bc, 6); m.call(0x21c7);                                             // 28b9 jsr $21c7
  m.step(0x28bf, 6); m.call(0x20e8);                                             // 28bc jsr $20e8
  return m.call(0x28bf);                                                         // fall-through into loc_28bf
}
