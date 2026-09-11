// SPDX-License-Identifier: GPL-3.0-only
// loc_aa13  (ROM 0xaa13-0xaa59) -- picks a $ce66,x count, sets the $74/$75 dest pointer to $2f60+count,
// then copies (count..0) bytes from $cde6,y down into ($74),y; when $05 is negative also calls loc_af77
// with $9f+1. Finally restores $74 from the saved sum and JMPs (tail) to loc_df09. Reads off
// $ce66/$cde6 may add +1 T on a page cross.
export function loc_aa13(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x3e); regs.setNZ(regs.x); m.step(0xaa15, 3);
  regs.bit(mem.read8(0x05)); m.step(0xaa17, 3);
  // aa17 bmi 0xaa23
  if (regs.fN) {
    m.step(0xaa23, 3);
  } else {
    m.step(0xaa19, 2);
    regs.a = mem.read8(0x43); regs.setNZ(regs.a); m.step(0xaa1b, 3);
    regs.ora(mem.read8(0x44)); m.step(0xaa1d, 3);
    regs.ora(mem.read8(0x45)); m.step(0xaa1f, 3);
    // aa1f beq 0xaa23
    if (regs.fZ) {
      m.step(0xaa23, 3);
    } else {
      m.step(0xaa21, 2);
      regs.x = 0x01; regs.setNZ(regs.x); m.step(0xaa23, 2);
    }
  }
  regs.a = 0x60; regs.setNZ(regs.a); m.step(0xaa25, 2);
  mem.write8(0x74, regs.a); m.step(0xaa27, 3);
  regs.a = 0x2f; regs.setNZ(regs.a); m.step(0xaa29, 2);
  mem.write8(0x75, regs.a); m.step(0xaa2b, 3);
  regs.a = mem.read8((0xce66 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xaa2e, 4);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xaa2f, 2);
  regs.sec(); m.step(0xaa30, 2);
  regs.adc(mem.read8(0x74)); m.step(0xaa32, 3);
  m.push8(regs.a); m.step(0xaa33, 3);
  do {
    regs.a = mem.read8((0xcde6 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xaa36, 4);
    { const base = mem.read8(0x74) | (mem.read8(0x75) << 8);
      mem.write8((base + regs.y) & 0xffff, regs.a); } m.step(0xaa38, 6);
    regs.y = regs.dec8(regs.y); m.step(0xaa39, 2);
    // aa39 bne 0xaa33
    if (regs.fNZ) { m.step(0xaa33, 3); } else { m.step(0xaa3b, 2); break; }
  } while (true);
  regs.a = mem.read8((0xcde6 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xaa3e, 4);
  { const base = mem.read8(0x74) | (mem.read8(0x75) << 8);
    mem.write8((base + regs.y) & 0xffff, regs.a); } m.step(0xaa40, 6);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xaa42, 3);
  // aa42 bpl 0xaa54
  if (regs.fPl) {
    m.step(0xaa54, 3);
  } else {
    m.step(0xaa44, 2);
    regs.a = 0x2f; regs.setNZ(regs.a); m.step(0xaa46, 2);
    mem.write8(0x75, regs.a); m.step(0xaa48, 3);
    regs.a = 0xa6; regs.setNZ(regs.a); m.step(0xaa4a, 2);
    mem.write8(0x74, regs.a); m.step(0xaa4c, 3);
    regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0xaa4e, 3);
    regs.clc(); m.step(0xaa4f, 2);
    regs.adc(0x01); m.step(0xaa51, 2);
    m.push16(0xaa53); m.step(0xaa54, 6); m.call(0xaf77);
  }
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xaa55, 4);
  mem.write8(0x74, regs.a); m.step(0xaa57, 3);
  m.step(0xdf09, 3); return m.call(0xdf09);
}
