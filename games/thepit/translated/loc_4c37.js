// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c37  (ROM 0x4C37–0x4C46) — fills all 1024 bytes of colour RAM
 * (0x8800–0x8BFF) with the byte held at 0x8057.
 *
 *   4c37  06 04        ld   b,0x04        ; 4 pages of 256 bytes
 *   4c39  3a 57 80     ld   a,(0x8057)    ; the fill byte
 *   4c3c  21 00 88     ld   hl,0x8800     ; colour RAM base
 *
 *   ---- loc_4c3f : the fill loop ----
 *   4c3f  77           ld   (hl),a        ; store the fill byte
 *   4c40  2c           inc  l             ; next byte, WITHIN the current page
 *   4c41  20 fc        jr   nz,0x4c3f     ; 256 bytes -> until L wraps to 0
 *   4c43  24           inc  h             ; advance to the next page
 *   4c44  10 f9        djnz 0x4c3f        ; 4 pages
 *   4c46  c9           ret
 *
 * WHAT IT DOES: writes the value at 0x8057 into every cell of 0x8800..0x8BFF —
 * the whole per-tile colour RAM (0x400 = 1024 bytes). A screen-wide colour
 * repaint from a single palette-index byte held in work RAM at 0x8057.
 *
 * TWO NESTED LOOPS with two different counters:
 *   - the INNER loop walks one page with `inc l` (0x2c, L only — never leaves the
 *     current page) and `jr nz`. Starting L = 0x00, the 256th `inc l` wraps L to
 *     0x00 and sets Z, so `jr nz` falls through after exactly 256 stores.
 *   - the OUTER loop bumps the page high byte with `inc h` and counts it down with
 *     the flagless `djnz` (B = 4). H runs 0x88 -> 0x8B over the four passes; the
 *     final `inc h` lands H on 0x8C, so HL exits at 0x8C00 (the first byte NOT
 *     written) with B = 0.
 *
 * `jr nz` reads the Z set by `inc l` (nothing between them touches flags);
 * `djnz` decrements B WITHOUT touching flags (regs.djnz, not dec8), so the
 * outer branch is decided on B, not on a flag. The flag residue at `ret` is
 * whatever the last `inc h` (H = 0x8C: S set, Z/H/PV clear) left — dead, since
 * djnz and ret read no flags.
 *
 * A is loaded once and never rewritten, so 0x8057 is read a single time and the
 * same byte lands in all 1024 cells.
 */
export function loc_4c37(m) {
  const { regs, mem } = m;

  regs.b = 0x04; // ld b,0x04 -- 4 pages
  m.step(0x4c39, 7);
  regs.a = mem.read8(0x8057); // ld a,(0x8057) -- the fill byte
  m.step(0x4c3c, 13);
  regs.hl = 0x8800; // ld hl,0x8800 -- colour RAM base
  m.step(0x4c3f, 10);

  do {
    // outer (djnz) loop; loc_4c3f is also the inner loop's jr-nz target.
    do {
      mem.write8(regs.hl, regs.a); // ld (hl),a
      m.step(0x4c40, 7);
      regs.l = regs.inc8(regs.l); // inc l -- L++ within the page; sets Z on wrap
      m.step(0x4c41, 4);
      // jr nz,0x4c3f -- loop the page until inc l wrapped L to 0 (Z set)
      m.step(regs.fNZ ? 0x4c3f : 0x4c43, regs.fNZ ? 12 : 7);
    } while (regs.fNZ);

    regs.h = regs.inc8(regs.h); // inc h -- advance to the next page
    m.step(0x4c44, 4);
    regs.djnz(); // djnz 0x4c3f -- dec B, no flags
    m.step(regs.b !== 0 ? 0x4c3f : 0x4c46, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 4c46
}
