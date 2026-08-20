// SPDX-License-Identifier: GPL-3.0-only

// loc_5f83  (ROM 0x5f83-0x5fa1) -- selects the active object record (0x8c90, or 0x8ca8 when the
// I register is non-zero) and reads its type byte. Type 0 -> ret. Otherwise it latches the type
// (to 0x8d44 and C), points IX at 0x8850, sets B=6, HL=0x8ae0, and FALLS THROUGH into loc_5fa2
// (the 6-slot scan), which the tail m.call preserves -- there is no ret/push between them.
export function loc_5f83(m) {
  const { regs, mem } = m;

  regs.ix = 0x8c90;             m.step(0x5f87, 14); // 5f83 ld ix,0x8c90
  regs.ldAI();                  m.step(0x5f89, 9);  // 5f87 ld a,i
  regs.and(regs.a);            m.step(0x5f8a, 4);  // 5f89 and a
  if (regs.fZ) {
    m.step(0x5f90, 12);                             // 5f8a jr z,0x5f90
  } else {
    m.step(0x5f8c, 7);
    regs.ix = 0x8ca8;          m.step(0x5f90, 14); // 5f8c ld ix,0x8ca8
  }
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x5f93, 19); // 5f90 ld a,(ix+0)
  regs.and(regs.a);            m.step(0x5f94, 4);  // 5f93 and a
  if (regs.fZ) { return m.ret(11); }                // 5f94 ret z
  m.step(0x5f95, 5);
  mem.write8(0x8d44, regs.a);   m.step(0x5f98, 13); // 5f95 ld (0x8d44),a
  regs.c = regs.a;             m.step(0x5f99, 4);  // 5f98 ld c,a
  regs.ix = 0x8850;             m.step(0x5f9d, 14); // 5f99 ld ix,0x8850
  regs.b = 0x06;               m.step(0x5f9f, 7);  // 5f9d ld b,0x06
  regs.hl = 0x8ae0;             m.step(0x5fa2, 10); // 5f9f ld hl,0x8ae0
  return m.call(0x5fa2);                            // fall through into loc_5fa2 (tail, no push)
}
