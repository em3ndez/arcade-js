// SPDX-License-Identifier: GPL-3.0-only
// loc_3a08 (ROM 0x3a08-0x3a1d) -- XOR-folds the 0x0178..0x01b4 table into A (seed 0xff), stores the fold to 0x01b5, and returns the old-0x01b5 XOR new-0x01b5 delta
export function loc_3a08(m) {
  const { regs, mem } = m;
  regs.y = 0x3c; regs.setNZ(regs.y); m.step(0x3a0a, 2);                                // 3a08 ldy #$3c
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x3a0c, 2);                                // 3a0a lda #$ff
  do {
    regs.eor(mem.read8((0x0178 + regs.y) & 0xffff)); m.step(0x3a0f, 4);                // 3a0c eor $0178,y (0x0178+Y stays in page 1)
    regs.y = regs.dec8(regs.y); m.step(0x3a10, 2);                                     // 3a0f dey
    if (regs.fPl) { m.step(0x3a0c, 3); continue; }                                     // 3a10 bpl $3a0c (taken)
    m.step(0x3a12, 2); break;                                                          // 3a10 bpl $3a0c (not taken)
  } while (true);
  regs.y = mem.read8(0x01b5); regs.setNZ(regs.y); m.step(0x3a15, 4);                   // 3a12 ldy $01b5
  mem.write8(0x01b5, regs.a); m.step(0x3a18, 4);                                       // 3a15 sta $01b5
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3a19, 2);                              // 3a18 tya
  regs.eor(mem.read8(0x01b5)); m.step(0x3a1c, 4);                                       // 3a19 eor $01b5
  return m.ret(6);                                                                     // 3a1c rts
}
