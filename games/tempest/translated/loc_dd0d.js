// SPDX-License-Identifier: GPL-3.0-only
// loc_dd0d  (ROM 0xdd0d-0xdd26) -- jsr df53 (header word), lda #0 jsr df6a, then A=$e8/Y=$0d00 jsr dd29 and
// Y=$0e00 jsr dd27, jsr dbe0, tay; falls through into loc_dd27.
export function loc_dd0d(m) {
  const { regs, mem } = m;
  m.push16(0xdd0f); m.step(0xdd10, 6); m.call(0xdf53);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdd12, 2);
  m.push16(0xdd14); m.step(0xdd15, 6); m.call(0xdf6a);
  regs.a = 0xe8; regs.setNZ(regs.a); m.step(0xdd17, 2);
  regs.y = mem.read8(0x0d00); regs.setNZ(regs.y); m.step(0xdd1a, 4);
  m.push16(0xdd1c); m.step(0xdd1d, 6); m.call(0xdd29);
  regs.y = mem.read8(0x0e00); regs.setNZ(regs.y); m.step(0xdd20, 4);
  m.push16(0xdd22); m.step(0xdd23, 6); m.call(0xdd27);
  m.push16(0xdd25); m.step(0xdd26, 6); m.call(0xdbe0);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xdd27, 2);
  return m.call(0xdd27);
}
