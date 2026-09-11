// SPDX-License-Identifier: GPL-3.0-only
// loc_9a87  (ROM 0x9a87-0x9a87) -- lone `txa`, then falls through into loc_9a88 (the RTS-trick dispatch).
export function loc_9a87(m) {
  const { regs } = m;
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0x9a88, 2);
  return m.call(0x9a88);
}
