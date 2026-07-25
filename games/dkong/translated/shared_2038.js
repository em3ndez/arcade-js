// SPDX-License-Identifier: GPL-3.0-only

/**
 * shared_2038  (ROM 0x2038–0x2052) — the common velocity/sprite record write. A=0.
 */
export function shared_2038(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x12), 0xff);
  m.step(0x203c, 19); // ld (ix+0x12),0xff
  mem.write8(R(0x13), 0xf0);
  m.step(0x2040, 19); // ld (ix+0x13),0xf0
  mem.write8(R(0x14), regs.a);
  m.step(0x2043, 19); // ld (ix+0x14),a  (A=0)
  mem.write8(R(0x0e), regs.a);
  m.step(0x2046, 19); // ld (ix+0x0e),a
  mem.write8(R(0x04), regs.a);
  m.step(0x2049, 19); // ld (ix+0x04),a
  mem.write8(R(0x06), regs.a);
  m.step(0x204c, 19); // ld (ix+0x06),a
  mem.write8(R(0x02), 0x08);
  m.step(0x2050, 19); // ld (ix+0x02),0x08
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
