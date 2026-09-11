// SPDX-License-Identifier: GPL-3.0-only
// loc_de11  (ROM 0xde11-0xde1a) -- sets $01c7=7, $01c8=0, then falls through into loc_de1b (no rts).
export function loc_de11(m) {
  const { regs, mem } = m;
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0xde13, 2);
  mem.write8(0x01c7, regs.a); m.step(0xde16, 4);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xde18, 2);
  mem.write8(0x01c8, regs.a); m.step(0xde1b, 4);
  return m.call(0xde1b);
}
