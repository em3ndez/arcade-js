// SPDX-License-Identifier: GPL-3.0-only

// loc_3ecb  (ROM 0x3ECB-0x3ED1, Time Pilot)
export function loc_3ecb(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x00) & 0xffff, 0x3b);
  m.step(0x3ecf, 19); // ld (ix+0x00),0x3b

  m.step(0x5683, 10); // jp 0x5683 -- TAIL, nothing pushed
  return m.call(0x5683);
}
