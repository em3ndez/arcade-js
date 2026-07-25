// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d3f  (ROM 0x1D3F–0x1D48) — write sprite-control (0x6207): flip direction bit (xor 0x80), OR in frame B.
 */
export function loc_1d3f(m) {
  const { regs, mem } = m;
  regs.a = 0x80;
  m.step(0x1d41, 7); // ld a,0x80
  regs.hl = 0x6207;
  m.step(0x1d44, 10); // ld hl,0x6207
  regs.and(mem.read8(regs.hl));
  m.step(0x1d45, 7); // and (hl) -- A = bit7 of (0x6207)
  regs.xor(0x80);
  m.step(0x1d47, 7); // xor 0x80 -- flip direction bit
  regs.or(regs.b);
  m.step(0x1d48, 4); // or b -- | frame
  mem.write8(regs.hl, regs.a);
  m.step(0x1d49, 7); // ld (hl),a -- falls into loc_1d49
  return m.call(0x1d49);
}
