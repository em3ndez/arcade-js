// SPDX-License-Identifier: GPL-3.0-only
// loc_18f1  (ROM 0x18f1-0x18f9) -- B := 0x02, then reads 0x2082 and bumps B to 0x03 only when
// that byte was exactly 1 (dcr a -> zero; rnz returns early otherwise). Returns B in {2,3}.
export function loc_18f1(m) {
  const { regs, mem } = m;

  regs.b = 0x02; m.step(0x18f3, 7); // 18f1  mvi b,0x02
  regs.a = mem.read8(0x2082); m.step(0x18f6, 13); // 18f3  lda 0x2082
  regs.a = regs.dec8(regs.a); m.step(0x18f7, 5); // 18f6  dcr a
  if (regs.fNZ) { return m.ret(11); } // 18f7  rnz (taken)
  m.step(0x18f8, 5); // 18f7  rnz (not taken)
  regs.b = regs.inc8(regs.b); m.step(0x18f9, 5); // 18f8  inr b
  return m.ret(10); // 18f9  ret
}
