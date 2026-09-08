// SPDX-License-Identifier: GPL-3.0-only
// loc_22fa  (ROM 0x22fa-0x2310) -- decrements the $a1 countdown; on wrap reloads it from $100a masked
// ($2f|$0f), sets $b5=$14 and $41=$14^$f2; RTS (early on non-zero countdown).
export function loc_22fa(m) {
  const { regs, mem } = m;
  mem.write8(0x00a1, regs.dec8(mem.read8(0x00a1))); m.step(0x22fc, 5); // 22fa dec $a1
  if (regs.fNZ) { m.step(0x230f, 4); return m.ret(6); }              // 22fc bne $230f (taken+cross -> 230f rts)
  m.step(0x22fe, 2);                                                  // 22fc bne $230f (fall)
  regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x2301, 4); // 22fe lda $100a
  regs.and(0x2f); m.step(0x2303, 2);                                 // 2301 and #$2f
  regs.ora(0x0f); m.step(0x2305, 2);                                 // 2303 ora #$0f
  mem.write8(0x00a1, regs.a); m.step(0x2307, 3);                     // 2305 sta $a1
  regs.a = 0x14; regs.setNZ(regs.a); m.step(0x2309, 2);            // 2307 lda #$14
  mem.write8(0x00b5, regs.a); m.step(0x230b, 3);                     // 2309 sta $b5
  regs.eor(mem.read8(0x00f2)); m.step(0x230d, 3);                    // 230b eor $f2
  mem.write8(0x0041, regs.a); m.step(0x230f, 3);                     // 230d sta $41
  return m.ret(6);                                                   // 230f rts
}
