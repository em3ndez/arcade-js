// SPDX-License-Identifier: GPL-3.0-only
// loc_b586  (ROM 0xb586-0xb5ac) -- sets $9e=1, gates on $0202 (0 or >=0xf0 -> rts); else stores it to $57/$2f,
// and unless $0201==0x81, builds ($51>>1 & 7)+1 and jsr $bda0. Terminates rts.
export function loc_b586(m) {
  const { regs, mem } = m;
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xb588, 2);
  mem.write8(0x9e, regs.a); m.step(0xb58a, 3);
  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0xb58d, 4);
  if (regs.fZ) { m.step(0xb5ac, 3); return m.ret(6); }
  m.step(0xb58f, 2);
  regs.cmp(0xf0); m.step(0xb591, 2);
  if (regs.fC) { m.step(0xb5ac, 3); return m.ret(6); }
  m.step(0xb593, 2);
  mem.write8(0x57, regs.a); m.step(0xb595, 3);
  mem.write8(0x2f, regs.a); m.step(0xb597, 3);
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xb59a, 4);
  regs.cmp(0x81); m.step(0xb59c, 2);
  if (regs.fZ) { m.step(0xb5ac, 3); return m.ret(6); }
  m.step(0xb59e, 2);
  regs.y = mem.read8(0x0200); regs.setNZ(regs.y); m.step(0xb5a1, 4);
  regs.a = mem.read8(0x51); regs.setNZ(regs.a); m.step(0xb5a3, 3);
  regs.a = regs.lsr(regs.a); m.step(0xb5a4, 2);
  regs.and(0x07); m.step(0xb5a6, 2);
  regs.clc(); m.step(0xb5a7, 2);
  regs.adc(0x01); m.step(0xb5a9, 2);
  m.push16(0xb5ab); m.step(0xb5ac, 6); m.call(0xbda0);
  return m.ret(6);
}
