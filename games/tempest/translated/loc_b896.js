// SPDX-License-Identifier: GPL-3.0-only
// loc_b896 (ROM 0xb896-0xb8b9) -- writes hardware regs $2ffc:=$0139, $2ffd:=$013a|$70, $2fff:=$c0
// (vector-RAM tail). Then $0139 -= $20 (sec;sbc): if the result stays >=0 (bpl) store it back; else
// mask to $7f, decrement $013a, store. Single abs,x/abs,y-free path pair; no page-cross variance.
export function loc_b896(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0139); regs.setNZ(regs.a); m.step(0xb899, 4);
  mem.write8(0x2ffc, regs.a); m.step(0xb89c, 4);
  regs.a = mem.read8(0x013a); regs.setNZ(regs.a); m.step(0xb89f, 4);
  regs.ora(0x70); m.step(0xb8a1, 2);
  mem.write8(0x2ffd, regs.a); m.step(0xb8a4, 4);
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xb8a6, 2);
  mem.write8(0x2fff, regs.a); m.step(0xb8a9, 4);
  regs.a = mem.read8(0x0139); regs.setNZ(regs.a); m.step(0xb8ac, 4);
  regs.sec(); m.step(0xb8ad, 2);
  regs.sbc(0x20); m.step(0xb8af, 2);
  if (regs.fPl) { m.step(0xb8b6, 3); }                              // bpl same-page taken (result >=0)
  else {
    m.step(0xb8b1, 2);                                              // bpl not taken (result <0)
    regs.and(0x7f); m.step(0xb8b3, 2);
    mem.write8(0x013a, regs.dec8(mem.read8(0x013a))); m.step(0xb8b6, 6); // dec $013a (abs RMW 6)
  }
  mem.write8(0x0139, regs.a); m.step(0xb8b9, 4);
  return m.ret(6); // 0xb8b9 rts
}
