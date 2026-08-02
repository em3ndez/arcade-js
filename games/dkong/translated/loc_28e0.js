// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_28e0  (ROM 0x28E0–0x2900) — two entry_2913 sweeps; twin of sub_28b0.
 *   twin diffs: two groups (not three); group 2 B=0x0A, IX=0x6500.
 */
export function loc_28e0(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); // pop hl
  m.step(0x28e1, 10);

  regs.b = 0x05;
  m.step(0x28e3, 7); // ld b,0x05
  regs.a = regs.b;
  m.step(0x28e4, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x28e7, 13); // ld (0x63b9),a
  regs.de = 0x0020;
  m.step(0x28ea, 10); // ld de,0x0020
  regs.ix = 0x6400;
  m.step(0x28ee, 14); // ld ix,0x6400
  m.push16(0x28f1); // call 0x2913
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return true;

  regs.b = 0x0a;
  m.step(0x28f3, 7); // ld b,0x0a
  regs.a = regs.b;
  m.step(0x28f4, 4); // ld a,b
  mem.write8(0x63b9, regs.a);
  m.step(0x28f7, 13); // ld (0x63b9),a
  regs.e = 0x10;
  m.step(0x28f9, 7); // ld e,0x10 -- D preserved
  regs.ix = 0x6500;
  m.step(0x28fd, 14); // ld ix,0x6500
  m.push16(0x2900); // call 0x2913
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return true;

  m.ret(); // ret (0x2900)
  return true;
}
