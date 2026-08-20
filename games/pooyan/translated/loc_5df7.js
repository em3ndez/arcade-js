// SPDX-License-Identifier: GPL-3.0-only

// loc_5df7  (ROM 0x5df7-0x5e10) -- gate + setup for the loc_5e11 proximity sweep. Bails (ret nz) if
// the trigger flag 0x8d32 is already set, or if (0x8f08 | 0x8f24) is non-zero. Otherwise seeds the
// sweep registers (IX=0x8840 source, IY=0x887c target[], HL=0x8be8 records, B=3) and falls through
// into loc_5e11 (a tail delegate -- loc_5e11's ret returns to this routine's caller).
export function loc_5df7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d32);   m.step(0x5dfa, 13); // 5df7  ld a,(0x8d32)
  regs.and(regs.a);             m.step(0x5dfb, 4);  // 5dfa  and a
  if (regs.fNZ) { return m.ret(11); }               // 5dfb  ret nz -- already triggered
  m.step(0x5dfc, 5);
  regs.a = mem.read8(0x8f08);   m.step(0x5dff, 13); // 5dfc  ld a,(0x8f08)
  regs.hl = 0x8f24;             m.step(0x5e02, 10); // 5dff  ld hl,0x8f24
  regs.or(mem.read8(regs.hl));  m.step(0x5e03, 7);  // 5e02  or (hl)
  if (regs.fNZ) { return m.ret(11); }               // 5e03  ret nz -- guard non-zero
  m.step(0x5e04, 5);
  regs.ix = 0x8840;             m.step(0x5e08, 14); // 5e04  ld ix,0x8840
  regs.iy = 0x887c;             m.step(0x5e0c, 14); // 5e08  ld iy,0x887c
  regs.hl = 0x8be8;             m.step(0x5e0f, 10); // 5e0c  ld hl,0x8be8
  regs.b = 0x03;                m.step(0x5e11, 7);  // 5e0f  ld b,0x03
  return m.call(0x5e11); // fall through into loc_5e11
}
