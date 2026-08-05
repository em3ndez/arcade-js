// SPDX-License-Identifier: GPL-3.0-only

// loc_1980  (ROM 0x1980-0x1983, Time Pilot)
export function loc_1980(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, 0x00);
  m.step(0x1982, 10); // ld (hl),0x00
  regs.xor(regs.a);
  m.step(0x1983, 4); // xor a -- A = 0, Z set
  m.ret(); // 1983  ret
}
