// SPDX-License-Identifier: GPL-3.0-only
// loc_3a99 (ROM 0x3a99-0x3aa6) -- fills $0178..$01b7 (X=$3f..0) each from loc_3aa7's return, then
// stores X(=$ff) into $f9; RTS.
export function loc_3a99(m) {
  const { regs, mem } = m;
  regs.x = 0x3f; regs.setNZ(regs.x); m.step(0x3a9b, 2);                    // 3a99 ldx #$3f
  for (;;) {
    m.push16(0x3a9d); m.step(0x3a9e, 6); m.call(0x3aa7);                                     // 3a9b jsr $3aa7
    mem.write8((0x0178 + regs.x) & 0xffff, regs.a); m.step(0x3aa1, 5);     // 3a9e sta $0178,x
    regs.x = regs.dec8(regs.x); m.step(0x3aa2, 2);                         // 3aa1 dex
    if (regs.fPl) { m.step(0x3a9b, 3); continue; }                         // 3aa2 bpl $3a9b
    m.step(0x3aa4, 2);                                                     // 3aa2 bpl (fall)
    mem.write8(0x00f9, regs.x); m.step(0x3aa6, 3);                         // 3aa4 stx $f9
    return m.ret(6);                                                       // 3aa6 rts
  }
}
