// SPDX-License-Identifier: GPL-3.0-only
// loc_ca18 (ROM 0xca18-0xca37) -- masks $05 &= 0x3f, then loads a fixed init block: $3e=0x00,
// $02=0x1a, $00=0x0a, $04=0xa0, $016b=0x01, $01=0x0a. Straight-line, no branches, then rts.
export function loc_ca18(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xca1a, 3);
  regs.and(0x3f); m.step(0xca1c, 2);
  mem.write8(0x05, regs.a); m.step(0xca1e, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xca20, 2);
  mem.write8(0x3e, regs.a); m.step(0xca22, 3);
  regs.a = 0x1a; regs.setNZ(regs.a); m.step(0xca24, 2);
  mem.write8(0x02, regs.a); m.step(0xca26, 3);
  regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xca28, 2);
  mem.write8(0x00, regs.a); m.step(0xca2a, 3);
  regs.a = 0xa0; regs.setNZ(regs.a); m.step(0xca2c, 2);
  mem.write8(0x04, regs.a); m.step(0xca2e, 3);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xca30, 2);
  mem.write8(0x016b, regs.a); m.step(0xca33, 4);
  regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xca35, 2);
  mem.write8(0x01, regs.a); m.step(0xca37, 3);
  return m.ret(6); // 0xca37 rts
}
