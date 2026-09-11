// SPDX-License-Identifier: GPL-3.0-only
// loc_96e2 (ROM 0x96e2-0x96f3) -- call loc_96f4 to get a repeat count in X, then sum X consecutive (0x2c),y
// entries (running total in A). Dispatch target ($968f table); accumulates a multi-segment coordinate.
export function loc_96e2(m) {
  const { regs, mem } = m;
  m.push16(0x96e4); m.step(0x96f4, 6); m.call(0x96f4); // jsr 0x96f4 (returns to 0x96e5)
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x96e6, 2);
  { const p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x96e8, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.y = regs.inc8(regs.y); m.step(0x96e9, 2);
  regs.cpx(0x00); m.step(0x96eb, 2);
  if (regs.fZ) { m.step(0x96f3, 3); return m.ret(6); } // beq 0x96f3 (count 0 -> done)
  m.step(0x96ed, 2);
  for (;;) {
    regs.clc(); m.step(0x96ee, 2);
    { const p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
      regs.adc(mem.read8(e)); m.step(0x96f0, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.x = regs.dec8(regs.x); m.step(0x96f1, 2);
    if (regs.fZ) break; // bne 0x96ed not taken
    m.step(0x96ed, 3);
  }
  m.step(0x96f3, 2);
  return m.ret(6);
}
