// SPDX-License-Identifier: GPL-3.0-only
// loc_1982  (ROM 0x1982-0x1985) -- stores A at 0x20c1, returns.
export function loc_1982(m) {
  const { regs, mem } = m;
  mem.write8(0x20c1, regs.a); m.step(0x1985, 13); // 1982  sta 0x20c1
  return m.ret(10);                                // 1985  ret
}
