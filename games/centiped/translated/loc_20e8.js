// SPDX-License-Identifier: GPL-3.0-only
// loc_20e8  (ROM 0x20e8-0x2119) -- seeds $40/$70 from $ef/$f0, spin-waits on $100a until (($100a & $f8) in
// [$10,$f8)), stores that-$04 to $60, picks $80 = 3 or 2 by $ab,x vs 6, then clears $50/$b8; RTS.
export function loc_20e8(m) {
  const { regs, mem } = m;
  regs.a = 0x1c; regs.setNZ(regs.a); m.step(0x20ea, 2);
  regs.eor(mem.read8(0x00ef)); m.step(0x20ec, 3);                    // 20ea eor $ef
  mem.write8(0x0040, regs.a); m.step(0x20ee, 3);
  regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x20f0, 2);             // 20ee lda #$f8
  regs.eor(mem.read8(0x00f0)); m.step(0x20f2, 3);                    // 20f0 eor $f0
  mem.write8(0x0070, regs.a); m.step(0x20f4, 3);
  for (;;) {
    regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x20f7, 4); // 20f4 lda $100a
    regs.and(0xf8); m.step(0x20f9, 2);                               // 20f7 and #$f8
    if (regs.fZ) { m.step(0x20f4, 3); continue; }                    // 20f9 beq $20f4 (taken, loop)
    m.step(0x20fb, 2);                                               // 20f9 beq $20f4 (fall)
    regs.cmp(0x10); m.step(0x20fd, 2);                               // 20fb cmp #$10
    if (regs.fNC) { m.step(0x20f4, 3); continue; }                   // 20fd bcc $20f4 (taken, loop)
    m.step(0x20ff, 2);                                               // 20fd bcc $20f4 (fall)
    break;
  }
  regs.sec(); m.step(0x2100, 2);                                     // 20ff sec
  regs.sbc(0x04); m.step(0x2102, 2);                                 // 2100 sbc #$04
  mem.write8(0x0060, regs.a); m.step(0x2104, 3);
  regs.y = 0x03; regs.setNZ(regs.y); m.step(0x2106, 2);            // 2104 ldy #$03
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2108, 3); // 2106 ldx $88
  regs.a = mem.read8((0x00ab + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x210a, 4); // 2108 lda $ab,x
  regs.cmp(0x06); m.step(0x210c, 2);                                 // 210a cmp #$06
  if (regs.fC) {
    m.step(0x2110, 3);                                               // 210c bcs $2110 (taken)
  } else {
    m.step(0x210e, 2);                                               // 210c bcs $2110 (fall)
    regs.y = 0x02; regs.setNZ(regs.y); m.step(0x2110, 2);          // 210e ldy #$02
  }
  mem.write8(0x0080, regs.y); m.step(0x2112, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2114, 2);            // 2112 lda #$00
  mem.write8(0x0050, regs.a); m.step(0x2116, 3);
  mem.write8(0x00b8, regs.a); m.step(0x2118, 3);
  return m.ret(6);                                                   // 2118 rts
}
