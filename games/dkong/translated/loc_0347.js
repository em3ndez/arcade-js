// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0347  (ROM 0x0347–0x034F) — selects one of two video-RAM columns from A; returns HL.
 *
 *   0347  21 40 77     ld   hl,0x7740
 *   034a  a7           and  a
 *   034b  c8           ret  z
 *   034c  21 e0 74     ld   hl,0x74e0
 *   034f  c9           ret
 *
 * Selects one of two video RAM columns based on A. Returns HL.
 */
export function loc_0347(m) {
  const { regs } = m;
  regs.hl = 0x7740;
  m.step(0x034a, 10);
  regs.and(regs.a); // and a -- sets Z from A, clears carry
  m.step(0x034b, 4);
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x034c, 5);
  regs.hl = 0x74e0;
  m.step(0x034f, 10);
  m.ret();
}
