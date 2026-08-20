// SPDX-License-Identifier: GPL-3.0-only

// loc_5f06  (ROM 0x5f06-0x5f10) -- tail of the 0x5ebd actor sweep: advance IX by one record (+4)
// and HL by one row (+0x18), then djnz back to the loop body at 0x5ebd. B==0 returns to 0x5e98's
// caller. The loop-back crosses a routine boundary, so a taken djnz delegates via m.call(0x5ebd).
export function loc_5f06(m) {
  const { regs } = m;

  regs.de = 0x0004;    m.step(0x5f09, 10);
  regs.addIx(regs.de); m.step(0x5f0b, 15);
  regs.e = 0x18;       m.step(0x5f0d, 7);
  regs.addHl(regs.de); m.step(0x5f0e, 11);
  if (regs.djnz() !== 0) {
    m.step(0x5ebd, 13); // djnz taken -- next actor
    return m.call(0x5ebd);
  }
  m.step(0x5f10, 8);    // djnz not taken
  return m.ret(10);
}
