// SPDX-License-Identifier: GPL-3.0-only
// loc_3833  (ROM 0x3833-0x3836) -- reads the $001A,Y byte into A, then falls straight into 0x3836.
export function loc_3833(m) {
  const { regs, mem } = m;
  const ea = (0x001a + regs.y) & 0xffff;
  regs.a = mem.read8(ea); regs.setNZ(regs.a);
  m.step(0x3836, 4 + ((0x001a & 0xff00) !== (ea & 0xff00) ? 1 : 0)); // 3833 lda $001a,y
  return m.call(0x3836);                                             // falls through into 0x3836
}
