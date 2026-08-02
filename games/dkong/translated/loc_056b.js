// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_056b  (ROM 0x056B–0x0577) — picks the destination column, then joins draw_0578 at 0x057C.
 *
 *   056b  dd 21 81 77  ld   ix,0x7781
 *   056f  a7           and  a
 *   0570  28 0a        jr   z,0x057c
 *   0572  dd 21 21 75  ld   ix,0x7521
 *   0576  18 04        jr   0x057c
 *
 * Picks the destination column, then joins draw_0578 partway in -- at
 * 0x057C, AFTER its own `ld ix`. So the two entry points differ only in
 * which IX they establish.
 */
export function loc_056b(m) {
  const { regs } = m;
  regs.ix = 0x7781;
  m.step(0x056f, 14);
  regs.and(regs.a);
  m.step(0x0570, 4);
  if (regs.fZ) {
    m.step(0x057c, 12); // jr z taken
  } else {
    m.step(0x0572, 7);
    regs.ix = 0x7521;
    m.step(0x0576, 14);
    m.step(0x057c, 12);
  }
  return m.call(0x0578, true);
}
