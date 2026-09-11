// SPDX-License-Identifier: GPL-3.0-only
// loc_aa97  (ROM 0xaa97-0xaa9d) -- a=0, call loc_b0dd, x=$3d, then fall through into loc_aa9e.
export function loc_aa97(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xaa99, 2);
  m.push16(0xaa9b); m.step(0xaa9c, 6); m.call(0xb0dd);
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xaa9e, 3);
  return m.call(0xaa9e);
}
