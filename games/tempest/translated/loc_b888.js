// SPDX-License-Identifier: GPL-3.0-only
// loc_b888 (ROM 0xb888-0xb895) -- jsr $c196 (exported delegate), then loads $0139=$7f and $013a=$04.
// A=$04 at rts. $0139/$013a is the two-byte value that loc_b896 folds into the vector-RAM tail.
export function loc_b888(m) {
  const { regs, mem } = m;
  m.push16(0xb88a); m.step(0xb88b, 6); m.call(0xc196);   // jsr $c196 (pushes jsraddr+2)
  regs.a = 0x7f; regs.setNZ(regs.a); m.step(0xb88d, 2);
  mem.write8(0x0139, regs.a); m.step(0xb890, 4);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xb892, 2);
  mem.write8(0x013a, regs.a); m.step(0xb895, 4);
  return m.ret(6); // 0xb895 rts
}
