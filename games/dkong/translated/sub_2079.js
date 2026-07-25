// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2079  (ROM 0x2079–0x2082) — (ix+3)+8 < 0x10 -- deactivate the slot.
 */
export function sub_2079(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.xor(regs.a);
  m.step(0x207a, 4); // xor a
  mem.write8(R(0x00), regs.a);
  m.step(0x207d, 19); // ld (ix+0x00),a
  mem.write8(R(0x03), regs.a);
  m.step(0x2080, 19); // ld (ix+0x03),a
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
