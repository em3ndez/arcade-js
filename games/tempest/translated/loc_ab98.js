// SPDX-License-Identifier: GPL-3.0-only
// loc_ab98  (ROM 0xab98-0xaba1) -- store x->$35, a->$2a, 0->$2b, then tail-enter loc_ab17 body at 0xab3b.
export function loc_ab98(m) {
  const { regs, mem } = m;
  mem.write8(0x35, regs.x); m.step(0xab9a, 3);
  mem.write8(0x2a, regs.a); m.step(0xab9c, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xab9e, 2);
  mem.write8(0x2b, regs.a); m.step(0xaba0, 3);
  m.step(0xab3b, 3); return m.call(0xab3b);
}
