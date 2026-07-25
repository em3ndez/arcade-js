// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2104  (ROM 0x2104–0x2117) — reached from loc_2101 AND from 0x20F7 (jp c). BOTH.
 *  INTERNAL. bounds-check (ix+3)+8: >= 0x10 -> loc_1fce (0x210B); else deactivate.
 */
export function loc_2104(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x03));
  m.step(0x2107, 19); // ld a,(ix+0x03)
  regs.add(0x08);
  m.step(0x2109, 7); // add a,0x08
  regs.cp(0x10);
  m.step(0x210b, 7); // cp 0x10
  if (regs.fNC) { m.step(0x1fce, 10); return m.call(0x1fce); } // jp nc,0x1fce -- INTERNAL
  m.step(0x210e, 10);
  regs.xor(regs.a); // A = 0
  m.step(0x210f, 4); // xor a
  mem.write8(R(0x00), regs.a);
  m.step(0x2112, 19); // ld (ix+0x00),a -- deactivate slot
  mem.write8(R(0x03), regs.a);
  m.step(0x2115, 19); // ld (ix+0x03),a
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
