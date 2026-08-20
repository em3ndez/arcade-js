// SPDX-License-Identifier: GPL-3.0-only

// loc_5e98  (ROM 0x5e98-0x5ebc) -- entry/dispatch of an actor sweep. Picks the active 0x8c90/0x8ca8
// pair per the I-register parity (`ld a,i`), returns if the pair's bit0 is clear, latches the pair at
// 0x8d65, then sets up the B=4 / HL=0x8c30 / IX=0x8888 sweep and dispatches on the pair's bit1:
// set -> the 0x5f11 loop, clear -> falls through to the 0x5ebd loop body. Both exits are tail delegations.
export function loc_5e98(m) {
  const { regs, mem } = m;

  regs.ldAI();                                       m.step(0x5e9a, 9);
  regs.ix = 0x8c90;                                  m.step(0x5e9e, 14);
  regs.and(regs.a);                                  m.step(0x5e9f, 4);
  if (regs.fZ) {
    m.step(0x5ea5, 12);                              // jr z -- keep 0x8c90
  } else {
    m.step(0x5ea1, 7);
    regs.ix = 0x8ca8;                                m.step(0x5ea5, 14);
  }
  regs.bit(0, mem.read8((regs.ix + 0x00) & 0xffff)); m.step(0x5ea9, 20);
  if (regs.fZ) { return m.ret(11); }                 // ret z -- pair inactive
  m.step(0x5eaa, 5);
  mem.write16(0x8d65, regs.ix);                      m.step(0x5eae, 20);
  regs.bit(1, mem.read8((regs.ix + 0x00) & 0xffff)); m.step(0x5eb2, 20); // latch bit1 for the dispatch below
  regs.ix = 0x8888;                                  m.step(0x5eb6, 14);
  regs.b = 0x04;                                     m.step(0x5eb8, 7);
  regs.hl = 0x8c30;                                  m.step(0x5ebb, 10);
  if (regs.fNZ) { m.step(0x5f11, 12); return m.call(0x5f11); } // jr nz -- bit1 set: 0x5f11 loop
  m.step(0x5ebd, 7);                                 // fall through -- bit1 clear: 0x5ebd loop
  return m.call(0x5ebd);
}
