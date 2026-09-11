// SPDX-License-Identifier: GPL-3.0-only
// loc_aa5a  (ROM 0xaa5a-0xaa61) -- x=8, call loc_ab14, then tail-jmp into loc_aa62 body at 0xaa69.
export function loc_aa5a(m) {
  const { regs, mem } = m;
  regs.x = 0x08; regs.setNZ(regs.x); m.step(0xaa5c, 2);
  m.push16(0xaa5e); m.step(0xaa5f, 6); m.call(0xab14);
  m.step(0xaa69, 3); return m.call(0xaa69);
}
