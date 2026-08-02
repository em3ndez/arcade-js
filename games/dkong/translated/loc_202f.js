// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_202f  (ROM 0x202F–0x2037) — the low-X (jp c) velocity variant.
 */
export function loc_202f(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.xor(regs.a); // A = 0
  m.step(0x2030, 4); // xor a
  mem.write8(R(0x10), 0xff);
  m.step(0x2034, 19); // ld (ix+0x10),0xff
  mem.write8(R(0x11), 0xa0);
  m.step(0x2038, 19); // ld (ix+0x11),0xa0
  return m.call(0x2038);
}
