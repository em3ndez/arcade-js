// SPDX-License-Identifier: GPL-3.0-only

/**
 * arm_1a4b  (ROM 0x1A4B–0x1A50) — sub_1a33 edge-hit: set (0x6291)=1 (arm the pickup).
 */
export function arm_1a4b(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x1a4d, 7);
  mem.write8(0x6291, regs.a);
  m.step(0x1a50, 13);
  m.ret(10);
}
