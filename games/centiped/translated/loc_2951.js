// SPDX-License-Identifier: GPL-3.0-only
// loc_2951  (ROM 0x2951-0x2962) -- if $87 is nonzero RTS; else load X=$0b and, when ($00 & $0f)==0,
// store 7 to $b3; falls through into loc_2962.
export function loc_2951(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0087); regs.setNZ(regs.a); m.step(0x2953, 3);   // 2951 lda $87
  if (regs.fZ) {                                                       // 2953 beq $2956 (taken)
    m.step(0x2956, 3);
  } else {                                                             // 2953 beq $2956 (not taken)
    m.step(0x2955, 2);
    return m.ret(6);                                                   // 2955 rts
  }
  regs.x = 0x0b; regs.setNZ(regs.x); m.step(0x2958, 2);                // 2956 ldx #$0b
  regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x295a, 3);   // 2958 lda $00
  regs.and(0x0f); m.step(0x295c, 2);                                   // 295a and #$0f
  if (regs.fNZ) {                                                      // 295c bne $2962 (taken)
    m.step(0x2962, 3);
    return m.call(0x2962);
  }
  m.step(0x295e, 2);                                                   // 295c bne $2962 (not taken)
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0x2960, 2);                // 295e lda #$07
  mem.write8(0x00b3, regs.a); m.step(0x2962, 3);                       // 2960 sta $b3
  return m.call(0x2962);                                               // fall through into loc_2962
}
