// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b74  (ROM 0x2B74–0x2B79) — A=0, B=0, then pop hl / ret: SKIP.
 */
export function loc_2b74(m) {
  const { regs } = m;
  regs.a = 0x00;
  m.step(0x2b76, 7); // ld a,0x00
  regs.b = 0x00;
  m.step(0x2b78, 7); // ld b,0x00
  regs.hl = m.pop16();
  m.step(0x2b79, 10); // pop hl
  m.ret();
  return false;
}
