// SPDX-License-Identifier: GPL-3.0-only
// loc_ac36  (ROM 0xac36-0xac3e) -- sets bits 0-1 of $01c9 (ora #$03) and returns.
export function loc_ac36(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xac39, 4);
  regs.ora(0x03); m.step(0xac3b, 2);
  mem.write8(0x01c9, regs.a); m.step(0xac3e, 4);
  return m.ret(6);
}
