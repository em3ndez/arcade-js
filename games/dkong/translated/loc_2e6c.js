// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2e6c  (ROM 0x2E6C–0x2E75) — mirror (ix+3)/(ix+5) to (iy+0)/(iy+3); falls into loc_2e78.
 */
export function loc_2e6c(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  const RY = (d) => (regs.iy + d) & 0xffff;
  regs.a = mem.read8(R(0x03));
  m.step(0x2e6f, 19); // ld a,(ix+0x03)
  mem.write8(RY(0x00), regs.a);
  m.step(0x2e72, 19); // ld (iy+0x00),a
  regs.a = mem.read8(R(0x05));
  m.step(0x2e75, 19); // ld a,(ix+0x05)
  mem.write8(RY(0x03), regs.a);
  m.step(0x2e78, 19); // ld (iy+0x03),a -- falls into loc_2e78
  return m.call(0x2e78);
}
