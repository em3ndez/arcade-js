// SPDX-License-Identifier: GPL-3.0-only

// loc_5d1e  (ROM 0x5d1e-0x5d4c) -- animation-hold countdown for one object at IX. Gated off unless
// (ix+0x0b) bit0 is set OR 0x8907 bit0 is clear; then requires the object active (ix+0x00 bit0) and
// armed (ix+0x16 bit1). Decrements the hold timer (ix+0x12); on underflow it steps the 2-bit phase
// (ix+0x13), re-arming (ix+0x16)=1 while phase remains, or 0 at phase end.
export function loc_5d1e(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x0b) & 0xffff), ((regs.ix + 0x0b) >> 8) & 0xff);
  m.step(0x5d22, 20); // 5d1e  bit 0,(ix+0x0b)
  if (regs.fNZ) {
    m.step(0x5d2a, 12); // 5d22  jr nz,0x5d2a
  } else {
    m.step(0x5d24, 7);
    regs.a = mem.read8(0x8907); m.step(0x5d27, 13);
    regs.bit(0, regs.a);        m.step(0x5d29, 8);
    if (regs.fNZ) { return m.ret(11); } // 5d29  ret nz
    m.step(0x5d2a, 5);
  }

  regs.bit(0, mem.read8((regs.ix + 0x00) & 0xffff), ((regs.ix + 0x00) >> 8) & 0xff);
  m.step(0x5d2e, 20); // 5d2a  bit 0,(ix+0x00)
  if (regs.fZ) { return m.ret(11); } // 5d2e  ret z -- object inactive
  m.step(0x5d2f, 5);

  regs.bit(1, mem.read8((regs.ix + 0x16) & 0xffff), ((regs.ix + 0x16) >> 8) & 0xff);
  m.step(0x5d33, 20); // 5d2f  bit 1,(ix+0x16)
  if (regs.fZ) { return m.ret(11); } // 5d33  ret z -- not armed
  m.step(0x5d34, 5);

  regs.decMem8(mem, (regs.ix + 0x12) & 0xffff);
  m.step(0x5d37, 23); // 5d34  dec (ix+0x12)
  if (regs.fNZ) { return m.ret(11); } // 5d37  ret nz -- timer still running
  m.step(0x5d38, 5);

  regs.a = mem.read8((regs.ix + 0x13) & 0xffff); m.step(0x5d3b, 19); // 5d38  ld a,(ix+0x13)
  regs.and(0x03);                                m.step(0x5d3d, 7);
  if (regs.fZ) {
    m.step(0x5d48, 12); // 5d3d  jr z,0x5d48
    mem.write8((regs.ix + 0x16) & 0xffff, 0x00); m.step(0x5d4c, 19); // 5d48  ld (ix+0x16),0x00
    return m.ret(10);
  }
  m.step(0x5d3f, 7);
  regs.a = regs.dec8(regs.a);                    m.step(0x5d40, 4); // 5d3f  dec a
  mem.write8((regs.ix + 0x13) & 0xffff, regs.a); m.step(0x5d43, 19); // 5d40  ld (ix+0x13),a
  mem.write8((regs.ix + 0x16) & 0xffff, 0x01);   m.step(0x5d47, 19); // 5d43  ld (ix+0x16),0x01
  return m.ret(10); // 5d47  ret
}
