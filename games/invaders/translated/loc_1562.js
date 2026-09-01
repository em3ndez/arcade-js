// SPDX-License-Identifier: GPL-3.0-only
// loc_1562  (ROM 0x1562-0x156e) -- X-scale: load 0x2009 into A, mirror L into H, call the scale
// helper 0x1554 (C := step count), then compute L := (C-1) via B, and A := A - 0x10 (SBI) as the
// residual, storing it back into L. Returns with L holding the scaled residual.
export function loc_1562(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2009); m.step(0x1565, 13); // 1562  lda 0x2009
  regs.h = regs.l; m.step(0x1566, 5); // 1565  mov h,l
  m.push16(0x1569); m.step(0x1554, 17); m.call(0x1554); // 1566  call 0x1554
  regs.b = regs.c; m.step(0x156a, 5); // 1569  mov b,c
  regs.b = regs.dec8(regs.b); m.step(0x156b, 5); // 156a  dcr b
  regs.sbc(0x10); m.step(0x156d, 7); // 156b  sbi 0x10
  regs.l = regs.a; m.step(0x156e, 5); // 156d  mov l,a
  return m.ret(10); // 156e  ret
}
