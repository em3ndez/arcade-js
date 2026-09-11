// SPDX-License-Identifier: GPL-3.0-only
// loc_c97b (ROM 0xc97b-0xc98b) -- a leaf setup routine (computed-dispatch target, no static call site) that
// seeds the zero-page pointer/config bytes $00-$04 for the next state, then rts. $00=0x0a, $01=0x00,
// $02=0x04, $04=0x14.
export function loc_c97b(m) {
  const { regs, mem } = m;
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xc97d, 2);
  mem.write8(0x02, regs.a); m.step(0xc97f, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc981, 2);
  mem.write8(0x01, regs.a); m.step(0xc983, 3);
  regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xc985, 2);
  mem.write8(0x00, regs.a); m.step(0xc987, 3);
  regs.a = 0x14; regs.setNZ(regs.a); m.step(0xc989, 2);
  mem.write8(0x04, regs.a); m.step(0xc98b, 3);
  return m.ret(6);
}
