// SPDX-License-Identifier: GPL-3.0-only
// loc_26b8  (ROM 0x26b8-0x26fd) -- builds $91/$92 pointer pair from $F6/$F7, then runs two 6-count
// $3836 draw loops (indexed by $A5 then 6-$A6), each supplying A=0x1F/0x00 by the DEX sign; RTS.
export function loc_26b8(m) {
  const { regs, mem } = m;
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0x26ba, 2);
  mem.write8(0x008b, regs.a); m.step(0x26bc, 3);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x26be, 2);
  regs.eor(mem.read8(0x00f7)); m.step(0x26c0, 3);                       // 26be eor $f7
  regs.and(0x06); m.step(0x26c2, 2);                                    // 26c0 and #$06
  mem.write8(0x0092, regs.a); m.step(0x26c4, 3);
  regs.a = 0xdf; regs.setNZ(regs.a); m.step(0x26c6, 2);                 // 26c4 lda #$df
  regs.eor(mem.read8(0x00f6)); m.step(0x26c8, 3);                       // 26c6 eor $f6
  mem.write8(0x0091, regs.a); m.step(0x26ca, 3);
  regs.x = mem.read8(0x00a5); regs.setNZ(regs.x); m.step(0x26cc, 3);    // 26ca ldx $a5
  while (true) {
    regs.a = 0x1f; regs.setNZ(regs.a); m.step(0x26ce, 2);              // 26cc lda #$1f (loop1 top)
    regs.x = regs.dec8(regs.x); m.step(0x26cf, 2);
    if (regs.fPl) {
      m.step(0x26d3, 3);                                              // 26cf bpl $26d3
    } else {
      m.step(0x26d1, 2);                                             // 26cf bpl $26d3 (fall)
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0x26d3, 2);
    }
    m.step(0x26d6, 6); m.call(0x3836);                                // 26d3 jsr $3836
    mem.write8(0x008b, regs.dec8(mem.read8(0x008b))); m.step(0x26d8, 5);
    if (regs.fNZ) { m.step(0x26cc, 3); continue; }                    // 26d8 bne $26cc
    m.step(0x26da, 2); break;                                         // 26d8 bne $26cc (fall)
  }
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0x26dc, 2);                // 26da lda #$06
  regs.eor(mem.read8(0x00f7)); m.step(0x26de, 3);                      // 26dc eor $f7
  mem.write8(0x0092, regs.a); m.step(0x26e0, 3);
  regs.a = 0x5f; regs.setNZ(regs.a); m.step(0x26e2, 2);                // 26e0 lda #$5f
  regs.eor(mem.read8(0x00f6)); m.step(0x26e4, 3);                      // 26e2 eor $f6
  mem.write8(0x0091, regs.a); m.step(0x26e6, 3);
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0x26e8, 2);                // 26e6 lda #$06
  mem.write8(0x008b, regs.a); m.step(0x26ea, 3);
  regs.sec(); m.step(0x26eb, 2);                                       // 26ea sec
  regs.sbc(mem.read8(0x00a6)); m.step(0x26ed, 3);                      // 26eb sbc $a6
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x26ee, 2);              // 26ed tax
  while (true) {
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x26f0, 2);             // 26ee lda #$00 (loop2 top)
    regs.x = regs.dec8(regs.x); m.step(0x26f1, 2);
    if (regs.fPl) {
      m.step(0x26f5, 3);                                              // 26f1 bpl $26f5
    } else {
      m.step(0x26f3, 2);                                             // 26f1 bpl $26f5 (fall)
      regs.a = 0x1f; regs.setNZ(regs.a); m.step(0x26f5, 2);
    }
    m.step(0x26f8, 6); m.call(0x3836);                                // 26f5 jsr $3836
    mem.write8(0x008b, regs.dec8(mem.read8(0x008b))); m.step(0x26fa, 5); // 26f8 dec $8b
    if (regs.fNZ) { m.step(0x26ee, 3); continue; }                    // 26fa bne $26ee
    m.step(0x26fc, 2); break;                                         // 26fa bne $26ee (fall)
  }
  return m.ret(6);                                                     // 26fc rts
}
