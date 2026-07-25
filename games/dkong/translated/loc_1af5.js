// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1af5  (ROM 0x1AF5–0x1AFB) — second direction (D), then fall to loc_1afe (climb collision).
 */
export function loc_1af5(m, R) {
  const { regs } = m;
  regs.d = regs.dec8(regs.d);
  m.step(0x1af6, 4); // dec d
  if (regs.fNZ) {
    m.step(0x1af9, 10);
    regs.bit(1, regs.a);
    m.step(0x1afb, 12); // bit 1,a
    if (regs.fNZ) { m.step(0x1cab, 10); return m.call(0x1cab); } // jp nz
  } else {
    m.step(0x1afe, 10);
  }
  return m.call(0x1afe, R);
}
