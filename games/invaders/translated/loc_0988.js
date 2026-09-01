// SPDX-License-Identifier: GPL-3.0-only
// loc_0988  (ROM 0x0988-0x09ac) -- `call 0x0988` from loc_081f: if pending flag 0x20f1 clear return, else
// clear it and add the 2-byte BCD delta at (0x20f2) into the accumulator at (HL from 0x09ca) via DAA, load next ptr, tail-jmp loc_09ad.
export function loc_0988(m) {
  const { regs, mem } = m;

  m.push16(0x098b); m.step(0x09ca, 17); m.call(0x09ca); // 0988  call 0x09ca
  regs.a = mem.read8(0x20f1); m.step(0x098e, 13); // 098b  lda 0x20f1
  regs.and(regs.a); m.step(0x098f, 4); // 098e  ana a
  if (regs.fZ) { return m.ret(11); } m.step(0x0990, 5); // 098f  rz
  regs.xor(regs.a); m.step(0x0991, 4); // 0990  xra a
  mem.write8(0x20f1, regs.a); m.step(0x0994, 13); // 0991  sta 0x20f1
  m.push16(regs.hl); m.step(0x0995, 11); // 0994  push h
  regs.hl = mem.read16(0x20f2); m.step(0x0998, 16); // 0995  lhld 0x20f2
  regs.exDeHl(); m.step(0x0999, 4);
  regs.hl = m.pop16(); m.step(0x099a, 10); // 0999  pop h
  regs.a = mem.read8(regs.hl); m.step(0x099b, 7); // 099a  mov a,m
  regs.add(regs.e); m.step(0x099c, 4);
  regs.daa(); m.step(0x099d, 4); // 099c  daa
  mem.write8(regs.hl, regs.a); m.step(0x099e, 7); // 099d  mov m,a
  regs.e = regs.a; m.step(0x099f, 5);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x09a0, 5);
  regs.a = mem.read8(regs.hl); m.step(0x09a1, 7); // 09a0  mov a,m
  regs.adc(regs.d); m.step(0x09a2, 4); // 09a1  adc d
  regs.daa(); m.step(0x09a3, 4); // 09a2  daa
  mem.write8(regs.hl, regs.a); m.step(0x09a4, 7); // 09a3  mov m,a
  regs.d = regs.a; m.step(0x09a5, 5);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x09a6, 5);
  regs.a = mem.read8(regs.hl); m.step(0x09a7, 7); // 09a6  mov a,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x09a8, 5);
  regs.h = mem.read8(regs.hl); m.step(0x09a9, 7); // 09a8  mov h,m
  regs.l = regs.a; m.step(0x09aa, 5);
  m.step(0x09ad, 10); return m.call(0x09ad); // 09aa  jmp 0x09ad (tail)
}
