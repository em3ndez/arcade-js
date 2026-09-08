// SPDX-License-Identifier: GPL-3.0-only
// loc_32fe  (ROM 0x32fe-0x335a) -- seeds $91/$92 (EOR $f5/$f7 flip masks) then feeds coordinate
// bytes ($ac/$aa/$a8, optionally $ad/$ab/$a9 when $89-1!=0, then $04/$03/$02) through the 0x384f
// helper with SEC/CLC-seeded carry; tail-jumps 0x384f.
export function loc_32fe(m) {
  const { regs, mem } = m;
  regs.a = 0x1f; regs.setNZ(regs.a); m.step(0x3300, 2);
  regs.eor(mem.read8(0x00f5)); m.step(0x3302, 3);
  mem.write8(0x0091, regs.a); m.step(0x3304, 3);                                      // 3302 sta $91
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x3306, 2);
  regs.eor(mem.read8(0x00f7)); m.step(0x3308, 3);
  mem.write8(0x0092, regs.a); m.step(0x330a, 3);                                      // 3308 sta $92
  regs.a = mem.read8(0x00ac); regs.setNZ(regs.a); m.step(0x330c, 3);                  // 330a lda $ac
  regs.sec(); m.step(0x330d, 2);
  m.step(0x3310, 6); m.call(0x384f);                                                  // 330d jsr $384f
  regs.a = mem.read8(0x00aa); regs.setNZ(regs.a); m.step(0x3312, 3);                  // 3310 lda $aa
  m.step(0x3315, 6); m.call(0x384f);                                                  // 3312 jsr $384f
  regs.a = mem.read8(0x00a8); regs.setNZ(regs.a); m.step(0x3317, 3);                  // 3315 lda $a8
  regs.clc(); m.step(0x3318, 2);
  m.step(0x331b, 6); m.call(0x384f);                                                  // 3318 jsr $384f
  regs.y = mem.read8(0x0089); regs.setNZ(regs.y); m.step(0x331d, 3);                  // 331b ldy $89
  regs.y = regs.dec8(regs.y); m.step(0x331e, 2);
  if (regs.fZ) {
    m.step(0x333d, 3);                                                                // 331e beq $333d (taken)
  } else {
    m.step(0x3320, 2);                                                                // 331e beq $333d (fall)
    regs.a = 0x07; regs.setNZ(regs.a); m.step(0x3322, 2);
    regs.eor(mem.read8(0x00f7)); m.step(0x3324, 3);
    mem.write8(0x0092, regs.a); m.step(0x3326, 3);                                    // 3324 sta $92
    regs.a = 0x1f; regs.setNZ(regs.a); m.step(0x3328, 2);
    regs.eor(mem.read8(0x00f5)); m.step(0x332a, 3);
    mem.write8(0x0091, regs.a); m.step(0x332c, 3);                                    // 332a sta $91
    regs.a = mem.read8(0x00ad); regs.setNZ(regs.a); m.step(0x332e, 3);               // 332c lda $ad
    regs.sec(); m.step(0x332f, 2);
    m.step(0x3332, 6); m.call(0x384f);                                                // 332f jsr $384f
    regs.a = mem.read8(0x00ab); regs.setNZ(regs.a); m.step(0x3334, 3);               // 3332 lda $ab
    m.step(0x3337, 6); m.call(0x384f);                                                // 3334 jsr $384f
    regs.a = mem.read8(0x00a9); regs.setNZ(regs.a); m.step(0x3339, 3);               // 3337 lda $a9
    regs.clc(); m.step(0x333a, 2);
    m.step(0x333d, 6); m.call(0x384f);                                                // 333a jsr $384f
  }
  regs.a = 0x9f; regs.setNZ(regs.a); m.step(0x333f, 2);
  regs.eor(mem.read8(0x00f5)); m.step(0x3341, 3);
  mem.write8(0x0091, regs.a); m.step(0x3343, 3);                                      // 3341 sta $91
  regs.a = 0x05; regs.setNZ(regs.a); m.step(0x3345, 2);
  regs.eor(mem.read8(0x00f7)); m.step(0x3347, 3);
  mem.write8(0x0092, regs.a); m.step(0x3349, 3);                                      // 3347 sta $92
  regs.a = mem.read8(0x0004); regs.setNZ(regs.a); m.step(0x334b, 3);                  // 3349 lda $04
  regs.sec(); m.step(0x334c, 2);
  m.step(0x334f, 6); m.call(0x384f);                                                  // 334c jsr $384f
  regs.a = mem.read8(0x0003); regs.setNZ(regs.a); m.step(0x3351, 3);                  // 334f lda $03
  m.step(0x3354, 6); m.call(0x384f);                                                  // 3351 jsr $384f
  regs.a = mem.read8(0x0002); regs.setNZ(regs.a); m.step(0x3356, 3);                  // 3354 lda $02
  regs.clc(); m.step(0x3357, 2);
  m.step(0x384f, 3); return m.call(0x384f);                                           // 3357 jmp $384f
}
