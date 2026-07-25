// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1c8f  (ROM 0x1C8F–0x1CAA) — MOVE +dir. Twin of loc_1cab: B=+1, 3009 arg=0x05.
 *  extra `or 0x80`. Shares loc_1cc2.
 */
export function loc_1c8f(m) {
  const { regs, mem } = m;
  regs.b = 0x01; // +1 delta
  m.step(0x1c91, 7); // ld b,0x01
  regs.a = mem.read8(0x620f); // jump phase
  m.step(0x1c94, 13); // ld a,(0x620f)
  regs.and(regs.a);
  m.step(0x1c95, 4); // and a
  if (regs.fNZ) { m.step(0x1cd2, 10); return m.call(0x1cd2); } // jp nz -- already moving
  m.step(0x1c98, 10);
  regs.a = mem.read8(0x6202); // facing
  m.step(0x1c9b, 13); // ld a,(0x6202)
  regs.b = regs.a;
  m.step(0x1c9c, 4); // ld b,a
  regs.a = 0x05; // 3009 arg (differs from loc_1cab's 0x01)
  m.step(0x1c9e, 7); // ld a,0x05
  m.push16(0x1ca1);
  m.step(0x3009, 17); // call 0x3009
  m.call(0x3009); // returns A (new facing)
  mem.write8(0x6202, regs.a);
  m.step(0x1ca4, 13); // ld (0x6202),a
  regs.and(0x03);
  m.step(0x1ca6, 7); // and 0x03
  regs.or(0x80); // <-- the extra step loc_1cab does NOT have
  m.step(0x1ca8, 7); // or 0x80
  m.step(0x1cc2, 10); // jp 0x1cc2
  return m.call(0x1cc2);
}
