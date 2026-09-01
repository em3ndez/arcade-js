// SPDX-License-Identifier: GPL-3.0-only
// loc_09ef  (ROM 0x09ef-0x0a3b) -- player switch/handoff, `jz 0x09ef` at 0x082f: wait on flip (0x0a3c),
// clear 0x20e9, clear field (0x09d6), advance player index 0x2067 (saved across 0x01e4), rebuild 0x20fc/0x20fd from table 0x1da2 + 0x2098, tail-jmp 0x0804 by page bit0.
export function loc_09ef(m) {
  const { regs, mem } = m;

  m.push16(0x09f2); m.step(0x0a3c, 17); m.call(0x0a3c); // 09ef  call 0x0a3c
  regs.xor(regs.a); m.step(0x09f3, 4); // 09f2  xra a
  mem.write8(0x20e9, regs.a); m.step(0x09f6, 13); // 09f3  sta 0x20e9
  m.push16(0x09f9); m.step(0x09d6, 17); m.call(0x09d6); // 09f6  call 0x09d6
  regs.a = mem.read8(0x2067); m.step(0x09fc, 13); // 09f9  lda 0x2067
  m.push16(regs.af); m.step(0x09fd, 11); // 09fc  push psw
  m.push16(0x0a00); m.step(0x01e4, 17); m.call(0x01e4); // 09fd  call 0x01e4
  regs.af = m.pop16(); m.step(0x0a01, 10); // 0a00  pop psw
  mem.write8(0x2067, regs.a); m.step(0x0a04, 13); // 0a01  sta 0x2067
  regs.a = mem.read8(0x2067); m.step(0x0a07, 13); // 0a04  lda 0x2067
  regs.h = regs.a; m.step(0x0a08, 5);
  m.push16(regs.hl); m.step(0x0a09, 11);
  regs.l = 0xfe; m.step(0x0a0b, 7); // 0a09  mvi l,0xfe
  regs.a = mem.read8(regs.hl); m.step(0x0a0c, 7);
  regs.and(0x07); m.step(0x0a0e, 7); // 0a0c  ani 0x07
  regs.a = regs.inc8(regs.a); m.step(0x0a0f, 5);
  mem.write8(regs.hl, regs.a); m.step(0x0a10, 7);
  regs.hl = 0x1da2; m.step(0x0a13, 10); // 0a10  lxi h,0x1da2
  for (;;) {
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0a14, 5);
    regs.a = regs.dec8(regs.a); m.step(0x0a15, 5);
    if (regs.fNZ) { m.step(0x0a13, 10); continue; }
    m.step(0x0a18, 10);
    break;
  }
  regs.a = mem.read8(regs.hl); m.step(0x0a19, 7); // 0a18  mov a,m
  regs.hl = m.pop16(); m.step(0x0a1a, 10); // 0a19  pop h
  regs.l = 0xfc; m.step(0x0a1c, 7); // 0a1a  mvi l,0xfc
  mem.write8(regs.hl, regs.a); m.step(0x0a1d, 7); // 0a1c  mov m,a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0a1e, 5); // 0a1d  inx h
  mem.write8(regs.hl, 0x38); m.step(0x0a20, 10); // 0a1e  mvi m,0x38
  regs.a = regs.h; m.step(0x0a21, 5); // 0a20  mov a,h
  regs.rrca(); m.step(0x0a22, 4); // 0a21  rrc (bit0 of page -> carry)
  if (regs.fC) {
    m.step(0x0a33, 10);
    m.push16(0x0a36); m.step(0x01ef, 17); m.call(0x01ef); // 0a33  call 0x01ef
    m.push16(0x0a39); m.step(0x01c0, 17); m.call(0x01c0); // 0a36  call 0x01c0
    m.step(0x0804, 10); // 0a39  jmp 0x0804
    return m.call(0x0804);
  }
  m.step(0x0a25, 10);
  regs.a = 0x21; m.step(0x0a27, 7); // 0a25  mvi a,0x21
  mem.write8(0x2098, regs.a); m.step(0x0a2a, 13); // 0a27  sta 0x2098
  m.push16(0x0a2d); m.step(0x01f5, 17); m.call(0x01f5); // 0a2a  call 0x01f5
  m.push16(0x0a30); m.step(0x1904, 17); m.call(0x1904); // 0a2d  call 0x1904
  m.step(0x0804, 10); // 0a30  jmp 0x0804
  return m.call(0x0804);
}
