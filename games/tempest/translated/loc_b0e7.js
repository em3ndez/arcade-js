// SPDX-License-Identifier: GPL-3.0-only
// loc_b0e7 (ROM 0xb0e7-0xb101) -- loads a fixed init block: $00=0x0a, $02=0x00, $04=0xdf,
// $01=0x12, $014e=0x19, $014d=0x18. Straight-line, no branches, then rts.
export function loc_b0e7(m) {
  const { regs, mem } = m;
  regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xb0e9, 2);
  mem.write8(0x00, regs.a); m.step(0xb0eb, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb0ed, 2);
  mem.write8(0x02, regs.a); m.step(0xb0ef, 3);
  regs.a = 0xdf; regs.setNZ(regs.a); m.step(0xb0f1, 2);
  mem.write8(0x04, regs.a); m.step(0xb0f3, 3);
  regs.a = 0x12; regs.setNZ(regs.a); m.step(0xb0f5, 2);
  mem.write8(0x01, regs.a); m.step(0xb0f7, 3);
  regs.a = 0x19; regs.setNZ(regs.a); m.step(0xb0f9, 2);
  mem.write8(0x014e, regs.a); m.step(0xb0fc, 4);
  regs.a = 0x18; regs.setNZ(regs.a); m.step(0xb0fe, 2);
  mem.write8(0x014d, regs.a); m.step(0xb101, 4);
  return m.ret(6); // 0xb101 rts
}
