// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2153  (ROM 0x2153–0x215C) — clear (ix+14/04/06), tail. A = 0 on entry.
 */
export function loc_2153(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x14), regs.a);
  m.step(0x2156, 19); // ld (ix+0x14),a
  mem.write8(R(0x04), regs.a);
  m.step(0x2159, 19); // ld (ix+0x04),a
  mem.write8(R(0x06), regs.a);
  m.step(0x215c, 19); // ld (ix+0x06),a
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
