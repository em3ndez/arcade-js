// SPDX-License-Identifier: GPL-3.0-only

// loc_0728  (ROM 0x0728-0x072c) -- tail of the sprite-attribute copy loop: second inc ix,
// then djnz back to the body at 0x0714 while B != 0. The loop-back crosses a routine
// boundary, so a taken djnz delegates via m.call(0x0714); B==0 returns to loc_0714's caller.
export function loc_0728(m) {
  const { regs } = m;

  regs.ix = (regs.ix + 1) & 0xffff;  m.step(0x072a, 10);
  if (regs.djnz() !== 0) {
    m.step(0x0714, 13); // djnz taken
    return m.call(0x0714);
  }
  m.step(0x072c, 8); // djnz not taken
  m.ret();
}
