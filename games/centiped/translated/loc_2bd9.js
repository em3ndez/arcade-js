// SPDX-License-Identifier: GPL-3.0-only
// loc_2bd9 (ROM 0x2bd9-0x2c2a) -- gated by $97/$87, ticks the $a0 timer; on expiry scans slots $34+Y for a free (negative) one and spawns there, seeding its fields and bumping $94,X.
export function loc_2bd9(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0097); regs.setNZ(regs.a); m.step(0x2bdb, 3);                                 // 2bd9 lda $97
  if (regs.fZ) { m.step(0x2c2a, 4); return m.ret(6); }                                               // 2bdb beq $2c2a
  m.step(0x2bdd, 2);
  regs.a = mem.read8(0x0087); regs.setNZ(regs.a); m.step(0x2bdf, 3);                                 // 2bdd lda $87
  if (regs.fNZ) { m.step(0x2c2a, 4); return m.ret(6); }                                              // 2bdf bne $2c2a
  m.step(0x2be1, 2);
  regs.a = mem.read8(0x00a0); regs.setNZ(regs.a); m.step(0x2be3, 3);                                 // 2be1 lda $a0
  if (regs.fZ) { m.step(0x2be8, 3); }                                                                // 2be3 beq $2be8
  else {
    m.step(0x2be5, 2);
    mem.write8(0x00a0, regs.dec8(mem.read8(0x00a0))); m.step(0x2be7, 5);                             // 2be5 dec $a0
    return m.ret(6);                                                                                 // 2be7 rts
  }
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2bea, 3);                                 // 2be8 ldx $88
  regs.y = 0x0b; regs.setNZ(regs.y); m.step(0x2bec, 2);                                              // 2bea ldy #$0b
  for (;;) {
    regs.a = mem.read8((0x0034 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x2bef, 4);           // 2bec lda $0034,y
    if (regs.fN) { m.step(0x2bf5, 3); break; }                                                       // 2bef bmi $2bf5
    m.step(0x2bf1, 2);
    regs.y = regs.dec8(regs.y); m.step(0x2bf2, 2);                                                   // 2bf1 dey
    if (regs.fPl) { m.step(0x2bec, 3); continue; }                                                   // 2bf2 bpl $2bec
    m.step(0x2bf4, 2);
    return m.ret(6);                                                                                 // 2bf4 rts
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2bf7, 2);
  mem.write8((0x0034 + regs.y) & 0xffff, regs.a); m.step(0x2bfa, 5);                                 // 2bf7 sta $0034,y
  regs.a = 0x40; regs.setNZ(regs.a); m.step(0x2bfc, 2);                                              // 2bfa lda #$40
  regs.eor(mem.read8(0x00f0)); m.step(0x2bfe, 3);                                                    // 2bfc eor $f0
  mem.write8((0x0064 + regs.y) & 0xffff, regs.a); m.step(0x2c01, 5);                                 // 2bfe sta $0064,y
  regs.a = 0xfc; regs.setNZ(regs.a); m.step(0x2c03, 2);
  mem.write8((0x0054 + regs.y) & 0xffff, regs.a); m.step(0x2c06, 5);                                 // 2c03 sta $0054,y
  regs.a = 0x02; regs.setNZ(regs.a); m.step(0x2c08, 2);
  mem.write8((0x0074 + regs.y) & 0xffff, regs.a); m.step(0x2c0b, 5);                                 // 2c08 sta $0074,y
  regs.a = mem.read8((0x00a1 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2c0d, 4);               // 2c0b lda $a1,x
  regs.cmp(0x60); m.step(0x2c0f, 2);                                                                 // 2c0d cmp #$60
  if (regs.fNC) { m.step(0x2c15, 3); }                                                               // 2c0f bcc $2c15
  else {
    m.step(0x2c11, 2);
    regs.sbc(0x08); m.step(0x2c13, 2);                                                               // 2c11 sbc #$08
    mem.write8((0x00a1 + regs.x) & 0xff, regs.a); m.step(0x2c15, 4);                                 // 2c13 sta $a1,x
  }
  mem.write8(0x00a0, regs.a); m.step(0x2c17, 3);                                                     // 2c15 sta $a0
  regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x2c1a, 4);                                 // 2c17 lda $100a
  regs.and(0x02); m.step(0x2c1c, 2);                                                                 // 2c1a and #$02
  if (regs.fNZ) { m.step(0x2c25, 3); }                                                               // 2c1c bne $2c25
  else {
    m.step(0x2c1e, 2);
    regs.a = 0x04; regs.setNZ(regs.a); m.step(0x2c20, 2);
    mem.write8((0x0054 + regs.y) & 0xffff, regs.a); m.step(0x2c23, 5);                               // 2c20 sta $0054,y
    regs.a = 0xfe; regs.setNZ(regs.a); m.step(0x2c25, 2);
  }
  mem.write8((0x0044 + regs.y) & 0xffff, regs.a); m.step(0x2c28, 5);                                 // 2c25 sta $0044,y
  { const a = (0x0094 + regs.x) & 0xff; mem.write8(a, regs.inc8(mem.read8(a))); } m.step(0x2c2a, 6); // 2c28 inc $94,x
  return m.ret(6);                                                                                   // 2c2a rts
}
