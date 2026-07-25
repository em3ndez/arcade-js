// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_04f1  (ROM 0x04F1–0x04F6) — colour write then fall into loc_04f9 (blink OFF).
 */
export function loc_04f1(m) {
  const { regs, mem } = m;
  regs.a = 0xef;
  m.step(0x04f3, 7); // ld a,0xef
  regs.hl = 0x7583;
  m.step(0x04f6, 10); // ld hl,0x7583
  m.push16(0x04f9); m.step(0x0514, 17); m.call(0x0514); // call 0x0514 -> falls into 0x04f9
  return m.call(0x04f9);
}
