// SPDX-License-Identifier: GPL-3.0-only
// loc_a9fc  (ROM 0xa9fc-0xaa12) -- maps A's low nibble to a word from the $31e4 table and stores it at
// $2f60,x, advancing x by 2. Y = nibble, bumped by 1 when nonzero-with-carry-clear or zero-with-carry-
// clear (the beq/clc/bcs dance), then doubled as the table index. Carry preserved across via php/plp.
export function loc_a9fc(m) {
  const { regs, mem } = m;
  regs.and(0x0f); m.step(0xa9fe, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa9ff, 2);
  // a9ff beq 0xaa02
  if (regs.fZ) {
    m.step(0xaa02, 3);
  } else {
    m.step(0xaa01, 2);
    regs.clc(); m.step(0xaa02, 2);
  }
  // aa02 bcs 0xaa05
  if (regs.fC) {
    m.step(0xaa05, 3);
  } else {
    m.step(0xaa04, 2);
    regs.y = regs.inc8(regs.y); m.step(0xaa05, 2);
  }
  m.push8(regs.p); m.step(0xaa06, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xaa07, 2);
  regs.a = regs.asl(regs.a); m.step(0xaa08, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xaa09, 2);
  regs.a = mem.read8((0x31e4 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xaa0c, 4);
  mem.write8((0x2f60 + regs.x) & 0xffff, regs.a); m.step(0xaa0f, 5);
  regs.x = regs.inc8(regs.x); m.step(0xaa10, 2);
  regs.x = regs.inc8(regs.x); m.step(0xaa11, 2);
  regs.p = m.pull8(); m.step(0xaa12, 4);
  return m.ret(6);
}
