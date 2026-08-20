// SPDX-License-Identifier: GPL-3.0-only

// loc_0429  (ROM 0x0429-0x0438) -- BCD byte splitter used by the HUD renderers.
// Reads (ix): writes its LOW nibble to (hl), advances HL by DE, and returns the HIGH
// nibble in A with Z set when that high nibble is 0 (leading-zero test for the caller).
// C (=the whole byte) is the scratch that survives the store so the high nibble can be
// re-derived. No calls.
export function loc_0429(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.ix & 0xffff);  m.step(0x042c, 19); // ld a,(ix+0)
  regs.c = regs.a;                       m.step(0x042d, 4);
  regs.and(0x0f);                        m.step(0x042f, 7);  // low nibble
  mem.write8(regs.hl, regs.a);           m.step(0x0430, 7);
  regs.addHl(regs.de);                   m.step(0x0431, 11);
  regs.a = regs.c;                       m.step(0x0432, 4);
  regs.rrca();                           m.step(0x0433, 4);
  regs.rrca();                           m.step(0x0434, 4);
  regs.rrca();                           m.step(0x0435, 4);
  regs.rrca();                           m.step(0x0436, 4);
  regs.and(0x0f);                        m.step(0x0438, 7);  // high nibble -> A, Z if 0
  m.ret(10);
}
