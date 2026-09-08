// SPDX-License-Identifier: GPL-3.0-only
// loc_26a0  (ROM 0x26a0-0x26b7) -- sets $C1/$C2 to $FF, copies the $02-$0A and $1A-$22 zp blocks up into
// $0178,X / $0181,X (X: 8..0), then tail-jumps to $3A08.
export function loc_26a0(m) {
  const { regs, mem } = m;
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x26a2, 2);              // 26a0 lda #$ff
  mem.write8(0x00c1, regs.a); m.step(0x26a4, 3);                    // 26a2 sta $c1
  mem.write8(0x00c2, regs.a); m.step(0x26a6, 3);                    // 26a4 sta $c2
  regs.x = 0x08; regs.setNZ(regs.x); m.step(0x26a8, 2);            // 26a6 ldx #$08
  for (;;) {
    regs.a = mem.read8((0x02 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x26aa, 4); // 26a8 lda $02,x
    mem.write8((0x0178 + regs.x) & 0xffff, regs.a); m.step(0x26ad, 5);                 // 26aa sta $0178,x
    regs.a = mem.read8((0x1a + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x26af, 4); // 26ad lda $1a,x
    mem.write8((0x0181 + regs.x) & 0xffff, regs.a); m.step(0x26b2, 5);                 // 26af sta $0181,x
    regs.x = regs.dec8(regs.x); m.step(0x26b3, 2);                                     // 26b2 dex
    if (regs.fPl) { m.step(0x26a8, 3); continue; }                                     // 26b3 bpl $26a8 (taken, same page)
    m.step(0x26b5, 2); break;                                                          // 26b3 bpl $26a8 (not taken)
  }
  m.step(0x3a08, 3); return m.call(0x3a08);                                            // 26b5 jmp $3a08
}
