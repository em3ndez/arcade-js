// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c27  (ROM 0x4C27–0x4C36) — fills the entire video RAM (0x9000–0x93FF)
 * with the byte held at ROM 0x4B0F.
 *
 *   4c27  06 04        ld   b,0x04        ; 4 pages of 256 bytes
 *   4c29  3a 0f 4b     ld   a,(0x4b0f)    ; A = the fill byte (a ROM constant)
 *   4c2c  21 00 90     ld   hl,0x9000     ; video RAM base
 *
 *   ---- loc_4c2f : the fill loop (inner `inc l` page + outer djnz page count) ----
 *   4c2f  77           ld   (hl),a        ; write the fill byte
 *   4c30  2c           inc  l             ; next byte, WITHIN the current page
 *   4c31  20 fc        jr   nz,0x4c2f     ; loop while L != 0 (one full 256-byte page)
 *   4c33  24           inc  h             ; advance to the next page
 *   4c34  10 f9        djnz 0x4c2f        ; repeat for all 4 pages
 *   4c36  c9           ret
 *
 * WHAT IT DOES: paints all 1024 bytes of video RAM (0x9000..0x93FF) with one
 * value — an init-time tilemap clear/fill. The fill byte is not a literal: it is
 * loaded once from 0x4B0F, so whatever tile code sits there is what the screen
 * gets filled with.
 *
 * TWO NESTED LOOPS, ONE ENTRY LABEL (loc_4c2f). `inc l` (0x2c), NOT `inc hl`:
 * only L advances, so a page is exactly 256 bytes. The inner `jr nz` runs the
 * page until `inc l` wraps L 0xFF->0x00 (Z set) — 256 writes, of which 255 leave
 * L non-zero (branch taken) and the 256th wraps (branch not taken). Then `inc h`
 * steps to the next page and `djnz` (B: 4->3->2->1->0) re-enters loc_4c2f for the
 * next page. HL walks 0x9000 -> 0x9400 exactly, so the fill spans 0x9000..0x93FF
 * and stops. Final state: HL = 0x9400, B = 0.
 *
 * FLAGS ARE DEAD RESIDUE across the seams: `inc l`/`inc h` set S/Z/H/PV (carry
 * preserved via regs.inc8), but the only consumer is the inner `jr nz`, which
 * reads the Z from `inc l`. `inc h`'s flags are overwritten by the next page's
 * first `inc l` before any branch reads them; `djnz` counts B without touching
 * flags (that is why it is regs.djnz, not dec8), and `ret` reads none.
 */
export function loc_4c27(m) {
  const { regs, mem } = m;

  regs.b = 0x04; // ld b,0x04 -- 4 pages
  m.step(0x4c29, 7);
  regs.a = mem.read8(0x4b0f); // ld a,(0x4b0f) -- the fill byte
  m.step(0x4c2c, 13);
  regs.hl = 0x9000; // ld hl,0x9000 -- video RAM base
  m.step(0x4c2f, 10);

  do {
    // outer djnz page loop -- each pass fills one 256-byte page, re-entering
    // the inner loop at loc_4c2f.
    do {
      // loc_4c2f -- both `jr nz` and `djnz` target here; write, step L in-page.
      mem.write8(regs.hl, regs.a); // ld (hl),a
      m.step(0x4c30, 7);
      regs.l = regs.inc8(regs.l); // inc l -- L++ (carry preserved); stays in page
      m.step(0x4c31, 4);
      // jr nz,0x4c2f -- loop while L != 0 (Z clear)
      m.step(regs.fNZ ? 0x4c2f : 0x4c33, regs.fNZ ? 12 : 7);
    } while (regs.fNZ);

    regs.h = regs.inc8(regs.h); // inc h -- advance to the next page
    m.step(0x4c34, 4);
    regs.djnz(); // djnz 0x4c2f -- dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x4c2f : 0x4c36, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 4c36
}
