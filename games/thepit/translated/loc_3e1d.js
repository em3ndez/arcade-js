// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3e1d  (ROM 0x3E1D–0x3E31) — fills a colour-RAM column: writes the byte in C
 * down 0x1C (28) rows at stride 0x20, starting at 0x8840 + A (A selects the
 * column), and caches C at 0x8057.
 *
 *   3e1d  5f           ld   e,a           ; loc_3e1d entry: column offset A -> E
 *
 *   3e1e  16 00        ld   d,0x00        ; loc_3e1e (also reached from loc_3e13)
 *   3e20  21 40 88     ld   hl,0x8840     ; colour RAM, top of the column (row 2)
 *   3e23  19           add  hl,de         ; + column offset -> base pointer
 *   3e24  79           ld   a,c           ; the fill byte
 *   3e25  32 57 80     ld   (0x8057),a    ; cache it at 0x8057
 *   3e28  11 20 00     ld   de,0x0020     ; stride: one row down the column
 *   3e2b  06 1c        ld   b,0x1c        ; 28 rows -> B (djnz)
 *
 *   3e2d  77           ld   (hl),a        ; loc_3e2d -- the djnz loop body
 *   3e2e  19           add  hl,de
 *   3e2f  10 fc        djnz 0x3e2d
 *   3e31  c9           ret
 *
 * The head `add hl,de` (0x3e23) forms the base from A (DE = 0x00:A there); the
 * loop `add hl,de` (0x3e2e) walks the column at stride 0x20. Both write H,N,C
 * (S/Z/PV preserved) via regs.addHl, and the flagless `djnz` + `ret` carry the
 * final carry-out to the caller, so a bare 16-bit add would not do — the
 * loc_3e01 shape.
 *
 * B IS THE FIXED IMMEDIATE 0x1C, not read from RAM, so the loop always runs 28
 * times regardless of input; only the base (A) and fill byte (C) vary.
 */
export function loc_3e1d(m) {
  const { regs, mem } = m;

  regs.e = regs.a; // ld e,a -- column offset into E
  m.step(0x3e1e, 4);
  regs.d = 0x00; // ld d,0x00 -- DE = 0x00:A
  m.step(0x3e20, 7);
  regs.hl = 0x8840; // ld hl,0x8840 -- colour RAM, top of the column
  m.step(0x3e23, 10);
  regs.addHl(regs.de); // add hl,de -- base = 0x8840 + A (writes H,N,C)
  m.step(0x3e24, 11);
  regs.a = regs.c; // ld a,c -- the fill byte
  m.step(0x3e25, 4);
  mem.write8(0x8057, regs.a); // ld (0x8057),a -- cache the fill byte
  m.step(0x3e28, 13);
  regs.de = 0x0020; // ld de,0x0020 -- one row down the column
  m.step(0x3e2b, 10);
  regs.b = 0x1c; // ld b,0x1c -- 28 rows
  m.step(0x3e2d, 7);

  do {
    // loc_3e2d -- djnz targets here; write the byte, advance one row down.
    mem.write8(regs.hl, regs.a); // ld (hl),a
    m.step(0x3e2e, 7);
    regs.addHl(regs.de); // add hl,de -- writes H,N,C; the final carry escapes
    m.step(0x3e2f, 11);
    regs.djnz(); // dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x3e2d : 0x3e31, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 3e31
}
