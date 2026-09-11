// SPDX-License-Identifier: GPL-3.0-only
// loc_a7a6  (ROM 0xa7a6-0xa7bb) -- $2a = A - Y (via sec/sbc); if $0111<0 skip, else mask A to low
// nibble and if bit3 (bit 0xa7bc=0x08) set, ora #0xf8 to sign-extend; returns A.
export function loc_a7a6(m) {
  const { regs, mem } = m;
  mem.write8(0x2a, regs.y); m.step(0xa7a8, 3);
  regs.sec(); m.step(0xa7a9, 2);
  regs.sbc(mem.read8(0x2a)); m.step(0xa7ab, 3);
  mem.write8(0x2a, regs.a); m.step(0xa7ad, 3);
  regs.bit(mem.read8(0x0111)); m.step(0xa7b0, 4);
  if (regs.fN) {
    m.step(0xa7bb, 3);
  } else {
    m.step(0xa7b2, 2);
    regs.and(0x0f); m.step(0xa7b4, 2);
    regs.bit(mem.read8(0xa7bc)); m.step(0xa7b7, 4);
    if (regs.fZ) {
      m.step(0xa7bb, 3);
    } else {
      m.step(0xa7b9, 2);
      regs.ora(0xf8); m.step(0xa7bb, 2);
    }
  }
  return m.ret(6);
}
