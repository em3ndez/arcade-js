// SPDX-License-Identifier: GPL-3.0-only

// loc_02b1  (ROM 0x02b1-0x02b8) -- write tile 0x10 into three cells DE apart (a 3-tile
// column of blanks); A holds 0x10 across all three stores. ret.
export function loc_02b1(m) {
  const { regs, mem } = m;

  regs.a = 0x10;
  m.step(0x02b3, 7); // 02b1  ld a,0x10
  mem.write8(regs.hl, regs.a);
  m.step(0x02b4, 7); // 02b3  ld (hl),a
  regs.addHl(regs.de);
  m.step(0x02b5, 11); // 02b4  add hl,de
  mem.write8(regs.hl, regs.a);
  m.step(0x02b6, 7); // 02b5  ld (hl),a
  regs.addHl(regs.de);
  m.step(0x02b7, 11); // 02b6  add hl,de
  mem.write8(regs.hl, regs.a);
  m.step(0x02b8, 7); // 02b7  ld (hl),a
  m.ret(); // 02b8  ret
}
