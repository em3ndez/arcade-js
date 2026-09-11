// SPDX-License-Identifier: GPL-3.0-only
// loc_a69b (ROM 0xa69b-0xa6a8) -- signed random step. lsr a shifts the caller's A to seed carry from its
// bit0 (A itself is discarded), reads a 3-bit random 0..7 from $60da (POKEY2 RANDOM) & #$07, then if the
// carry was set two's-complements it (eor #$ff; adc #$01) so the sign of the caller's incoming bit0 picks
// the direction. Returns the value in A. Leaf.
export function loc_a69b(m) {
  const { regs, mem } = m;
  regs.a = regs.lsr(regs.a); m.step(0xa69c, 2); // lsr a: carry = old bit0
  regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0xa69f, 4);
  regs.and(0x07); m.step(0xa6a1, 2);
  if (regs.fNC) { m.step(0xa6a8, 3); return m.ret(6); } // bcc taken -> positive
  m.step(0xa6a3, 2);
  regs.eor(0xff); m.step(0xa6a5, 2);
  regs.clc(); m.step(0xa6a6, 2);
  regs.adc(0x01); m.step(0xa6a8, 2);
  return m.ret(6); // a6a8 rts
}
