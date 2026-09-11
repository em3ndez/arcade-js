// SPDX-License-Identifier: GPL-3.0-only
// loc_c800  (ROM 0xc800-0xc81a) -- if ($03 & $016b)==0 and the $04 down-counter reaches 0, arm the
// next state ($00=$02, clear $016b); then jmp 0x9749 (tail) in every path.
export function loc_c800(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xc802, 3);
  regs.and(mem.read8(0x016b)); m.step(0xc805, 4);
  // c805 bne 0xc818
  if (regs.fNZ) { m.step(0xc818, 3); m.step(0x9749, 3); return m.call(0x9749); }
  m.step(0xc807, 2);
  regs.a = mem.read8(0x04); regs.setNZ(regs.a); m.step(0xc809, 3);
  // c809 beq 0xc80d
  if (regs.fZ) {
    m.step(0xc80d, 3);
  } else {
    m.step(0xc80b, 2);
    { const v = (mem.read8(0x04) - 1) & 0xff; mem.write8(0x04, v); regs.setNZ(v); } m.step(0xc80d, 5);
  }
  // c80d bne 0xc818
  if (regs.fNZ) { m.step(0xc818, 3); m.step(0x9749, 3); return m.call(0x9749); }
  m.step(0xc80f, 2);
  regs.a = mem.read8(0x02); regs.setNZ(regs.a); m.step(0xc811, 3);
  mem.write8(0x00, regs.a); m.step(0xc813, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc815, 2);
  mem.write8(0x016b, regs.a); m.step(0xc818, 4);
  m.step(0x9749, 3); return m.call(0x9749);
}
