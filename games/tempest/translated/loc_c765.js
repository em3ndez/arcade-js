// SPDX-License-Identifier: GPL-3.0-only
// loc_c765  (ROM 0xc765-0xc771) -- alt entry: writes a {0x00,0x71} header word through ($74),0..1 with y=2,
// then bne (always taken, y=2) into loc_c772's body at c774 to continue building the vector with y preserved.
export function loc_c765(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xc767, 2);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xc768, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc76a, 6);
  regs.a = 0x71; regs.setNZ(regs.a); m.step(0xc76c, 2);
  regs.y = regs.inc8(regs.y); m.step(0xc76d, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc76f, 6);
  regs.y = regs.inc8(regs.y); m.step(0xc770, 2);
  if (regs.fNZ) { m.step(0xc774, 3); return m.call(0xc774); }
  m.step(0xc772, 2); return m.call(0xc772);
}
