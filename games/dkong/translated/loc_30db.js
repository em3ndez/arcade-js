// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_30db  (ROM 0x30DB–0x30E3) — , then FALLS THROUGH into sub_30e4.
 *
 *   30db  21 4c 69     ld   hl,0x694c
 *   30de  36 00        ld   (hl),0x00
 *   30e0  2e 58        ld   l,0x58
 *   30e2  06 06        ld   b,0x06
 *   (falls through into sub_30e4 at 0x30E4)
 *
 * The FIFTH entry to sub_30e4, and a fallthrough, not a call:
 * nothing is pushed at 0x30E2->0x30E4, so sub_30e4's `ret` returns to
 * loc_30db's OWN caller. Writes 0x00 to 0x694C, then sets HL = 0x6958 and
 * B = 6 so sub_30e4 zeros 0x6958/5C/60/64/68/6C. `ld l,0x58` writes L only,
 * leaving H = 0x69.
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 */
export function loc_30db(m) {
  const { regs, mem } = m;

  regs.hl = 0x694c;
  m.step(0x30de, 10); // ld hl,0x694c
  mem.write8(regs.hl, 0x00);
  m.step(0x30e0, 10); // ld (hl),0x00
  regs.l = 0x58; // L only -- HL becomes 0x6958
  m.step(0x30e2, 7); // ld l,0x58
  regs.b = 0x06;
  m.step(0x30e4, 7); // ld b,0x06

  // FALLTHROUGH into sub_30e4, no push -- its ret returns to OUR caller.
  return m.call(0x30e4);
}
