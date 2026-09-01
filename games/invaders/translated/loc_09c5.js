// SPDX-License-Identifier: GPL-3.0-only
// loc_09c5  (ROM 0x09c5-0x09c9) -- map a 0-15 nibble in A to its glyph code (+0x1a) then tail-jump
// into the glyph plotter at 0x08ff. Called from loc_09b2 (twice) and jumped to at 0x1a90.
export function loc_09c5(m) {
  const { regs } = m;

  regs.add(0x1a); m.step(0x09c7, 7); // 09c5  adi 0x1a
  m.step(0x08ff, 10); // 09c7  jmp 0x08ff
  return m.call(0x08ff);
}
