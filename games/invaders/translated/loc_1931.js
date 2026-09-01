// SPDX-License-Identifier: GPL-3.0-only
// loc_1931  (ROM 0x1931-0x193b) -- read a 4-byte descriptor at HL into DE (word), A, then a
// byte; final HL = (last byte << 8) | A. Tail-jumps into loc_09ad (the draw) -- delegate.
export function loc_1931(m) {
  const { regs, mem } = m;

  regs.e = mem.read8(regs.hl); m.step(0x1932, 7); // 1931  mov e,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1933, 5); // 1932  inx h
  regs.d = mem.read8(regs.hl); m.step(0x1934, 7); // 1933  mov d,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1935, 5); // 1934  inx h
  regs.a = mem.read8(regs.hl); m.step(0x1936, 7); // 1935  mov a,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1937, 5); // 1936  inx h
  regs.h = mem.read8(regs.hl); m.step(0x1938, 7); // 1937  mov h,m
  regs.l = regs.a; m.step(0x1939, 5); // 1938  mov l,a
  m.step(0x09ad, 10); return m.call(0x09ad); // 1939  jmp 0x09ad
}
