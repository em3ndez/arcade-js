// SPDX-License-Identifier: GPL-3.0-only
// loc_08e4  (ROM 0x08e4-0x08f0) -- HEAD via tail-jump `jmp 0x08e4` at 0x00df. If the flag at
// 0x20ce is nonzero it returns (rnz); otherwise it sets up HL=0x391c, B=0x20 and tail-jumps to
// the strip blitter loc_14cb.
export function loc_08e4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x20ce); m.step(0x08e7, 13); // 08e4  lda 0x20ce
  regs.and(regs.a); m.step(0x08e8, 4); // 08e7  ana a
  if (regs.fNZ) { return m.ret(11); } // 08e8  rnz (taken: 0x20ce != 0)
  m.step(0x08e9, 5); // 08e8  rnz (not taken)
  regs.hl = 0x391c; m.step(0x08ec, 10); // 08e9  lxi h,0x391c
  regs.b = 0x20; m.step(0x08ee, 7); // 08ec  mvi b,0x20
  m.step(0x14cb, 10); return m.call(0x14cb); // 08ee  jmp 0x14cb
}
