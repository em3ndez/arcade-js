// SPDX-License-Identifier: GPL-3.0-only

/**
 * branch_1fe5  (ROM 0x1FE5–0x1FEC) — exx; +X velocity BC=0x0100, inc (ix+3); jp shared_1ff6.
 */
export function branch_1fe5(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.exx();
  m.step(0x1fe6, 4); // exx
  regs.bc = 0x0100; // shadow BC scratch
  m.step(0x1fe9, 10); // ld bc,0x0100
  mem.write8(R(0x03), regs.inc8(mem.read8(R(0x03))));
  m.step(0x1fec, 23); // inc (ix+0x03)
  m.step(0x1ff6, 10); // jp 0x1ff6
  return m.call(0x1ff6);
}
