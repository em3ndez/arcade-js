// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2974  (ROM 0x2974–0x2988).
 */
export function entry_2974(m) {
  const { regs, mem } = m;

  regs.iy = 0x6200;
  m.step(0x2978, 14); // ld iy,0x6200
  regs.a = mem.read8(0x6205);
  m.step(0x297b, 13); // ld a,(0x6205)
  regs.c = regs.a;
  m.step(0x297c, 4); // ld c,a
  regs.hl = 0x0408;
  m.step(0x297f, 10); // ld hl,0x0408
  regs.b = 0x02;
  m.step(0x2981, 7); // ld b,0x02
  regs.de = 0x0010;
  m.step(0x2984, 10); // ld de,0x0010
  regs.ix = 0x6680;
  m.step(0x2988, 14); // ld ix,0x6680

  m.push16(0x298b); // call 0x2913 -- entry_2913's skip path consumes this
  m.step(0x2913, 17);
  if (!m.call(0x2913)) return; // HIT (A=1): 2913 already returned past us
  m.ret(10); // ret (0x298B)
}
