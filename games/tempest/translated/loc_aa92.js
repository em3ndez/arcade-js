// SPDX-License-Identifier: GPL-3.0-only
// loc_aa92  (ROM 0xaa92-0xaa96) -- x=2, call loc_ab14, then fall through into loc_aa97.
export function loc_aa92(m) {
  const { regs, mem } = m;
  regs.x = 0x02; regs.setNZ(regs.x); m.step(0xaa94, 2);
  m.push16(0xaa96); m.step(0xaa97, 6); m.call(0xab14);
  return m.call(0xaa97);
}
