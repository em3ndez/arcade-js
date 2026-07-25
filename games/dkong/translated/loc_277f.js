// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_277f  (ROM 0x277F–0x2786) — edge reset: 0x6200=0, 0x6398=0.
 */
export function loc_277f(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x2780, 4);
  mem.write8(0x6200, regs.a);
  m.step(0x2783, 13);
  mem.write8(0x6398, regs.a);
  m.step(0x2786, 13);
  m.ret(10);
}
