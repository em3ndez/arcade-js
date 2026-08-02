// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2cf6  (ROM 0x2CF6–0x2D11).
 */
export function loc_2cf6(m) {
  const { regs, mem } = m;
  const ixb = (d) => (regs.ix + d) & 0xffff;
  mem.write8(ixb(0x07), 0x15);
  m.step(0x2cfa, 19); // ld (ix+0x07),0x15 -- default (written even on the set path)
  mem.write8(ixb(0x08), 0x0b);
  m.step(0x2cfe, 19); // ld (ix+0x08),0x0b
  mem.write8(ixb(0x15), 0x00);
  m.step(0x2d02, 19); // ld (ix+0x15),0x00
  regs.a = mem.read8(0x6382);
  m.step(0x2d05, 13); // ld a,(0x6382)
  regs.rlca();
  m.step(0x2d06, 4); // rlca -- bit 7 -> carry
  if (regs.fNC) { m.step(0x2d15, 10); return m.call(0x2d15); } // jp nc,0x2d15 (bit7 clear -> keep defaults)
  m.step(0x2d09, 10);
  mem.write8(ixb(0x07), 0x19);
  m.step(0x2d0d, 19); // ld (ix+0x07),0x19 -- overwrite (bit7 set)
  mem.write8(ixb(0x08), 0x0c);
  m.step(0x2d11, 19); // ld (ix+0x08),0x0c
  mem.write8(ixb(0x15), 0x01);
  m.step(0x2d15, 19); // ld (ix+0x15),0x01 -- falls into loc_2d15
  return m.call(0x2d15);
}
