// SPDX-License-Identifier: GPL-3.0-only

// loc_02aa  (ROM 0x02aa-0x02b0) -- step HL by DE, write tile 0x25, step by DE again,
// write tile 0x20, ret. With the caller's leading store this paints a 3-tile column.
export function loc_02aa(m) {
  const { regs, mem } = m;

  regs.addHl(regs.de);
  m.step(0x02ab, 11); // 02aa  add hl,de
  mem.write8(regs.hl, 0x25);
  m.step(0x02ad, 10); // 02ab  ld (hl),0x25
  regs.addHl(regs.de);
  m.step(0x02ae, 11); // 02ad  add hl,de
  mem.write8(regs.hl, 0x20);
  m.step(0x02b0, 10); // 02ae  ld (hl),0x20
  m.ret(); // 02b0  ret
}
