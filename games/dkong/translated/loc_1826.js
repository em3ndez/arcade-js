// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1826  (ROM 0x1826–0x1838) — shared helper: nested descending fill, HL live-in.
 *
 *   1826  11 db ff     ld   de,0xffdb    ; = -0x25
 *   1829  0e 0e        ld   c,0x0e       ; 14 rows
 *   182b  3e 10        ld   a,0x10       ; fill value, set ONCE
 *   182d  06 05        ld   b,0x05       ; loc_182d (outer re-entry) -- 5 per row
 *   182f  77           ld   (hl),a       ; loc_182f (inner)
 *   1830  23           inc  hl
 *   1831  10 fc        djnz 0x182f
 *   1833  19           add  hl,de        ; HL -= 0x25 (next row, backward)
 *   1834  0d           dec  c
 *   1835  c2 2d 18     jp   nz,0x182d
 *   1838  c9           ret
 *
 * HL is the caller's start address (live-in). 5x14 = 70 bytes of 0x10.
 * Translated for completeness; not yet wired into the live dispatcher.
 */
export function loc_1826(m) {
  const { regs, mem } = m;

  regs.de = 0xffdb; // -0x25
  m.step(0x1829, 10); // ld de,0xffdb
  regs.c = 0x0e;
  m.step(0x182b, 7); // ld c,0x0e
  regs.a = 0x10;
  m.step(0x182d, 7); // ld a,0x10 (once)

  do {
    // -- loc_182d (outer) --
    regs.b = 0x05;
    m.step(0x182f, 7); // ld b,0x05
    do {
      // -- loc_182f (inner) --
      mem.write8(regs.hl, regs.a);
      m.step(0x1830, 7); // ld (hl),a
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x1831, 6); // inc hl
      regs.djnz();
      m.step(regs.b !== 0 ? 0x182f : 0x1833, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    regs.addHl(regs.de); // add hl,de -- HL -= 0x25
    m.step(0x1834, 11);
    regs.c = regs.dec8(regs.c);
    m.step(0x1835, 4); // dec c
    m.step(regs.fNZ ? 0x182d : 0x1838, 10); // jp nz,0x182d
  } while (regs.fNZ);

  m.ret();
}
