// SPDX-License-Identifier: GPL-3.0-only
// loc_a309  (ROM 0xa309-0xa339) -- saves X in $37, flags $02f2,x=0xff; y-4 indexes $02b9 into $2d; reads
// $60da&7 clamped <3 (else 0), calls a3ca/a06f around a pha/pla, then +5 -> X -> jsr ca6c; restores X, rts.
export function loc_a309(m) {
  const { regs, mem } = m;
  mem.write8(0x37, regs.x); m.step(0xa30b, 3);
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa30d, 2);
  mem.write8((0x02f2 + regs.x) & 0xffff, regs.a); m.step(0xa310, 5);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xa311, 2);
  regs.sec(); m.step(0xa312, 2);
  regs.sbc(0x04); m.step(0xa314, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa315, 2);
  regs.a = mem.read8((0x02b9 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa318, 4);
  mem.write8(0x2d, regs.a); m.step(0xa31a, 3);
  regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0xa31d, 4);
  regs.and(0x07); m.step(0xa31f, 2);
  regs.cmp(0x03); m.step(0xa321, 2);
  if (regs.fNC) { m.step(0xa325, 3); }
  else {
    m.step(0xa323, 2);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa325, 2);
  }
  m.push8(regs.a); m.step(0xa326, 3);
  regs.clc(); m.step(0xa327, 2);
  regs.adc(0x02); m.step(0xa329, 2);
  m.push16(0xa32b); m.step(0xa32c, 6); m.call(0xa3ca);
  m.push16(0xa32e); m.step(0xa32f, 6); m.call(0xa06f);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xa330, 4);
  regs.clc(); m.step(0xa331, 2);
  regs.adc(0x05); m.step(0xa333, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xa334, 2);
  m.push16(0xa336); m.step(0xa337, 6); m.call(0xca6c);
  regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xa339, 3);
  return m.ret(6);
}
