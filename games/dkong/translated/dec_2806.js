// SPDX-License-Identifier: GPL-3.0-only

/**
 * dec_2806  (ROM 0x2806–0x2807).
 */
export function dec_2806(m) {
  const { regs, mem } = m;
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x2807, 11); // dec (0x62A7)
  m.ret(10);
}
