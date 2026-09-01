// SPDX-License-Identifier: GPL-3.0-only
// loc_01a1  (ROM 0x01a1-0x01be) -- reached by `cz 0x01a1` at 0x0157. Decrements D; if it hits
// zero, delegates to the 0x01cd abort (pop h; ret). Otherwise clears 0x2006/0x2007, tallies via
// 0x01d9, toggles bit0 of 0x2005, then loads H from *0x2067 and returns.
export function loc_01a1(m) {
  const { regs, mem } = m;

  regs.d = regs.dec8(regs.d); m.step(0x01a2, 5);
  if (regs.fZ) { m.step(0x01cd, 10); return m.call(0x01cd); } // 01a2  jz 0x01cd (abort)
  m.step(0x01a5, 10);

  regs.hl = 0x2006; m.step(0x01a8, 10);
  mem.write8(regs.hl, 0x00); m.step(0x01aa, 10); // 01a8  mvi m,0x00
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x01ab, 5);
  regs.c = mem.read8(regs.hl); m.step(0x01ac, 7); // 01ab  mov c,m
  mem.write8(regs.hl, 0x00); m.step(0x01ae, 10); // 01ac  mvi m,0x00
  m.push16(0x01b1); m.step(0x01d9, 17); m.call(0x01d9); // 01ae  call 0x01d9

  regs.hl = 0x2005; m.step(0x01b4, 10);
  regs.a = mem.read8(regs.hl); m.step(0x01b5, 7); // 01b4  mov a,m
  regs.a = regs.inc8(regs.a); m.step(0x01b6, 5);
  regs.and(0x01); m.step(0x01b8, 7);
  mem.write8(regs.hl, regs.a); m.step(0x01b9, 7); // 01b8  mov m,a
  regs.xor(regs.a); m.step(0x01ba, 4);
  regs.hl = 0x2067; m.step(0x01bd, 10);
  regs.h = mem.read8(regs.hl); m.step(0x01be, 7); // 01bd  mov h,m
  return m.ret(10); // 01be  ret
}
