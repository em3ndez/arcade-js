// SPDX-License-Identifier: GPL-3.0-only
// loc_9c3b (ROM 0x9c3b-0x9c4e) -- derives the $010c flag from $0147/$0148:
// (((($0147 << 2) + $0148) & $0148) & $80) ^ $80 -- bit7 of that product, inverted,
// so $010c is $00 when the high bit lands set and $80 when it is clear.
export function loc_9c3b(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0147); regs.setNZ(regs.a); m.step(0x9c3e, 4);
  regs.a = regs.asl(regs.a); m.step(0x9c3f, 2);
  regs.a = regs.asl(regs.a); m.step(0x9c40, 2);
  regs.clc(); m.step(0x9c41, 2);
  regs.adc(mem.read8(0x0148)); m.step(0x9c44, 4);
  regs.and(mem.read8(0x0148)); m.step(0x9c47, 4);
  regs.and(0x80); m.step(0x9c49, 2);
  regs.eor(0x80); m.step(0x9c4b, 2);
  mem.write8(0x010c, regs.a); m.step(0x9c4e, 4);
  return m.ret(6); // 9c4e rts
}
