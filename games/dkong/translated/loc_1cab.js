// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1cab  (ROM 0x1CAB–0x1CC1) — MOVE -dir. Twin of loc_1c8f: B=0xFF, 3009 arg=0x01.
 *  NO `or 0x80`. Shares loc_1cc2.
 */
export function loc_1cab(m) {
  const { regs, mem } = m;
  regs.b = 0xff; // -1 delta
  m.step(0x1cad, 7); // ld b,0xff
  regs.a = mem.read8(0x620f);
  m.step(0x1cb0, 13); // ld a,(0x620f)
  regs.and(regs.a);
  m.step(0x1cb1, 4); // and a
  if (regs.fNZ) { m.step(0x1cd2, 10); return m.call(0x1cd2); } // jp nz
  m.step(0x1cb4, 10);
  regs.a = mem.read8(0x6202);
  m.step(0x1cb7, 13); // ld a,(0x6202)
  regs.b = regs.a;
  m.step(0x1cb8, 4); // ld b,a
  regs.a = 0x01; // 3009 arg (differs from loc_1c8f's 0x05)
  m.step(0x1cba, 7); // ld a,0x01
  m.push16(0x1cbd);
  m.step(0x3009, 17); // call 0x3009
  m.call(0x3009);
  mem.write8(0x6202, regs.a);
  m.step(0x1cc0, 13); // ld (0x6202),a
  regs.and(0x03); // NO or 0x80 -- falls into loc_1cc2
  m.step(0x1cc2, 7); // and 0x03
  return m.call(0x1cc2);
}
