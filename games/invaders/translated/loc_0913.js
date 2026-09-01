// SPDX-License-Identifier: GPL-3.0-only
// loc_0913  (ROM 0x0913-0x092d) -- `call 0x0913` from loc_0000's dispatch. Returns early if
// (0x2009) >= 0x78; else on underflow (counter 0x2091 == 0) reloads HL=0x0600 and sets flag
// 0x2083=1, then always decrements the 16-bit counter and stores it back.
export function loc_0913(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2009); m.step(0x0916, 13); // 0913  lda 0x2009
  regs.cp(0x78); m.step(0x0918, 7); // 0916  cpi 0x78
  if (regs.fNC) { return m.ret(11); } m.step(0x0919, 5); // 0918  rnc
  regs.hl = mem.read16(0x2091); m.step(0x091c, 16); // 0919  lhld 0x2091
  regs.a = regs.l; m.step(0x091d, 5); // 091c  mov a,l
  regs.or(regs.h); m.step(0x091e, 4); // 091d  ora h
  if (regs.fNZ) {
    m.step(0x0929, 10); // 091e  jnz 0x0929 (taken)
  } else {
    m.step(0x0921, 10); // 091e  jnz 0x0929 (not taken)
    regs.hl = 0x0600; m.step(0x0924, 10); // 0921  lxi h,0x0600
    regs.a = 0x01; m.step(0x0926, 7); // 0924  mvi a,0x01
    mem.write8(0x2083, regs.a); m.step(0x0929, 13); // 0926  sta 0x2083
  }
  // loc_0929:
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x092a, 5); // 0929  dcx h
  mem.write16(0x2091, regs.hl); m.step(0x092d, 16); // 092a  shld 0x2091
  return m.ret(10); // 092d  ret
}
