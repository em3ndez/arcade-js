// SPDX-License-Identifier: GPL-3.0-only
// loc_3956 (ROM 0x3956-0x396d) -- tail of a per-index X loop: stores A to $07c0,X, builds a $07f0,X byte from $34,X bit6 (min 0x0c for X<0x0c) ORed with 0x39, DEX and loop to $3907
export function loc_3956(m) {
  const { regs, mem } = m;
  mem.write8((0x07c0 + regs.x) & 0xffff, regs.a); m.step(0x3959, 5);                   // 3956 sta $07c0,x
  regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x395b, 4);   // 3959 lda $34,x
  regs.and(0x40); m.step(0x395d, 2);                                                   // 395b and #$40
  if (regs.fZ) {
    m.step(0x3965, 3);                                                                 // 395d beq $3965 (taken)
  } else {
    m.step(0x395f, 2);                                                                 // 395d beq $3965 (not taken)
    regs.cpx(0x0c); m.step(0x3961, 2);                                                 // 395f cpx #$0c
    if (regs.fC) {
      m.step(0x3965, 3);                                                               // 3961 bcs $3965 (taken)
    } else {
      m.step(0x3963, 2);                                                               // 3961 bcs $3965 (not taken)
      regs.a = 0x0c; regs.setNZ(regs.a); m.step(0x3965, 2);                            // 3963 lda #$0c
    }
  }
  regs.ora(0x39); m.step(0x3967, 2);                                                   // 3965 ora #$39
  mem.write8((0x07f0 + regs.x) & 0xffff, regs.a); m.step(0x396a, 5);                   // 3967 sta $07f0,x
  regs.x = regs.dec8(regs.x); m.step(0x396b, 2);                                       // 396a dex
  if (regs.fPl) {
    m.step(0x3907, 3);                                                                 // 396b bpl $3907 (taken)
    return m.call(0x3907);
  }
  m.step(0x396d, 2);                                                                   // 396b bpl $3907 (not taken)
  return m.call(0x396d);
}
