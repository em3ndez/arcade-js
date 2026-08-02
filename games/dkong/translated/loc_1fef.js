// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1fef  (ROM 0x1FEF–0x1FF5) — exx; -X velocity BC=0xff04, dec (ix+3); FALLS INTO.
 *  shared_1ff6. Twin of branch_1fe5 (BC sign, inc vs dec).
 */
export function loc_1fef(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.exx();
  m.step(0x1ff0, 4); // exx
  regs.bc = 0xff04; // -X
  m.step(0x1ff3, 10); // ld bc,0xff04
  mem.write8(R(0x03), regs.dec8(mem.read8(R(0x03))));
  m.step(0x1ff6, 23); // dec (ix+0x03)
  return m.call(0x1ff6);
}
