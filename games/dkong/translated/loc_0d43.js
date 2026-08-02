// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0d43  (ROM 0x0D43–0x0D5E) — fill two 0x04-cell rows of 0xFD/0xFC via sub_0d4c (HL=0x7687 then 0x7547).
 */
export function loc_0d43(m) {
  const { regs } = m;
  regs.hl = 0x7687;
  m.step(0x0d46, 10); // ld hl,0x7687
  m.push16(0x0d49); m.step(0x0d4c, 17); m.call(0x0d4c); // call 0x0d4c
  regs.hl = 0x7547;
  m.step(0x0d4c, 10); // ld hl,0x7547 -- falls into sub_0d4c
  return m.call(0x0d4c);
}
