// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0d27  (ROM 0x0D27–0x0D42) — fill two 0x11-cell rows of 0xFD/0xFC via sub_0d30 (HL=0x770D then 0x760D).
 */
export function loc_0d27(m) {
  const { regs } = m;
  regs.hl = 0x770d;
  m.step(0x0d2a, 10); // ld hl,0x770d
  m.push16(0x0d2d); m.step(0x0d30, 17); m.call(0x0d30); // call 0x0d30
  regs.hl = 0x760d;
  m.step(0x0d30, 10); // ld hl,0x760d -- falls into sub_0d30
  return m.call(0x0d30);
}
