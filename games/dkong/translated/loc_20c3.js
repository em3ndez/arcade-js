// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_20c3  (ROM 0x20C3–0x20E0) — 2407 (fixed-point), HL >>= 2 (srl h/rr l x2), store.
 *  landing (ix+12/13), clear (ix+14/04/06). jp 0x21ba.
 */
export function loc_20c3(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  m.push16(0x20c6);
  m.step(0x2407, 17); // call 0x2407
  m.call(0x2407); // returns HL
  regs.h = regs.srl(regs.h);
  m.step(0x20c8, 8); // srl h
  regs.l = regs.rr(regs.l);
  m.step(0x20ca, 8); // rr l
  regs.h = regs.srl(regs.h);
  m.step(0x20cc, 8); // srl h
  regs.l = regs.rr(regs.l);
  m.step(0x20ce, 8); // rr l -- HL >>= 2
  mem.write8(R(0x12), regs.h);
  m.step(0x20d1, 19); // ld (ix+0x12),h
  mem.write8(R(0x13), regs.l);
  m.step(0x20d4, 19); // ld (ix+0x13),l
  regs.xor(regs.a);
  m.step(0x20d5, 4); // xor a
  mem.write8(R(0x14), regs.a);
  m.step(0x20d8, 19); // ld (ix+0x14),a
  mem.write8(R(0x04), regs.a);
  m.step(0x20db, 19); // ld (ix+0x04),a
  mem.write8(R(0x06), regs.a);
  m.step(0x20de, 19); // ld (ix+0x06),a
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
