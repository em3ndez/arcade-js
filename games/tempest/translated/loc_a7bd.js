// SPDX-License-Identifier: GPL-3.0-only
// loc_a7bd (ROM 0xa7bd-0xa7d1) -- leaf reset of an 8-byte table. Zeroes $03fe..$0405 (x=7 down to 0),
// then overwrites $0405 with $f0 and sets the $0115 flag to $ff.
export function loc_a7bd(m) {
  const { regs, mem } = m;
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xa7bf, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa7c1, 2);
  while (true) {
    mem.write8((0x03fe + regs.x) & 0xffff, regs.a); m.step(0xa7c4, 5); // sta abs,x store fixed 5
    regs.x = regs.dec8(regs.x); m.step(0xa7c5, 2);
    if (regs.fPl) { m.step(0xa7c1, 3); continue; } // bpl taken (x>=0), same-page 3
    m.step(0xa7c7, 2); break;                       // x wrapped to 0xff -> fall through
  }
  regs.a = 0xf0; regs.setNZ(regs.a); m.step(0xa7c9, 2);
  mem.write8(0x0405, regs.a); m.step(0xa7cc, 4);
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa7ce, 2);
  mem.write8(0x0115, regs.a); m.step(0xa7d1, 4);
  return m.ret(6); // a7d1 rts
}
