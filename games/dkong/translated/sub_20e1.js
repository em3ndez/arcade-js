// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_20e1  (ROM 0x20E1–0x20EB) — the (ix+10)!=0 velocity variant, then jp 0x20c3.
 */
export function sub_20e1(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x10), 0x01);
  m.step(0x20e5, 19); // ld (ix+0x10),0x01
  mem.write8(R(0x11), 0x00);
  m.step(0x20e9, 19); // ld (ix+0x11),0x00
  m.step(0x20c3, 10); // jp 0x20c3
  return m.call(0x20c3);
}
