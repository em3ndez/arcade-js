// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_084b  (ROM 0x084B–0x0851) — rst 0x20 gate, then clears 0x600A.
 *
 *   084b  e7           rst  0x20          ; skip unless BOTH counters expire
 *   084c  21 0a 60     ld   hl,0x600a
 *   084f  36 00        ld   (hl),0x00     ; 0x600A = 0
 *   0851  c9           ret
 */
export function loc_084b(m) {
  const { regs, mem } = m;

  m.push16(0x084c); // rst 0x20 PUSHES its return address (the rst's own semantics)
  m.step(0x0020, 11); // rst 0x20
  if (!m.call(0x0020)) return; // skipped: control went to our caller, 0x600A untouched

  regs.hl = 0x600a;
  m.step(0x084f, 10); // ld hl,0x600a
  mem.write8(regs.hl, 0x00);
  m.step(0x0851, 10); // ld (hl),0x00
  m.ret(); // ret (0x0851)
}
