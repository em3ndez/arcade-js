// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2901  (ROM 0x2901–0x2912) — one entry_2913 sweep; twin of sub_28b0.
 *   twin diffs: one group; B=0x07, DE=0x0020, IX=0x6400.
 */
export function sub_2901(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); // pop hl
  m.step(0x2902, 10);

  regs.b = 0x07;
  m.step(0x2904, 7); // ld b,0x07
  regs.a = regs.b;
  m.step(0x2905, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x2908, 13); // ld (0x63b9),a
  regs.de = 0x0020;
  m.step(0x290b, 10); // ld de,0x0020
  regs.ix = 0x6400;
  m.step(0x290f, 14); // ld ix,0x6400
  m.push16(0x2912); // call 0x2913
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return true;

  m.ret(); // ret (0x2912)
  return true;
}
