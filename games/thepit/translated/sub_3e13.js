// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3e13  (ROM 0x3E13–0x3E31) — advance the shared colour index at 0x8057 and
 * paint it down a 28-cell colour-RAM column selected by the entry A.
 *
 *   3e13  5f           ld   e,a           ; E = entry A -> column byte offset
 *   3e14  3a 57 80     ld   a,(0x8057)    ; the current colour index
 *   3e17  3c           inc  a             ; ++
 *   3e18  e6 f7        and  0xf7          ; keep it out of bit 3 (mask 1111_0111)
 *   3e1a  4f           ld   c,a           ; C = the advanced index
 *   3e1b  18 01        jr   0x3e1e        ; skip sub_3e1d's own `ld e,a`
 *
 *   ---- loc_3e1e : shared tail, also entered by sub_3e1d ----
 *   3e1e  16 00        ld   d,0x00        ; DE = 0x00__ ; E already the offset
 *   3e20  21 40 88     ld   hl,0x8840     ; colour-RAM column base
 *   3e23  19           add  hl,de         ; HL = 0x8840 + offset
 *   3e24  79           ld   a,c           ; A = the index to paint
 *   3e25  32 57 80     ld   (0x8057),a    ; write the advanced index back
 *   3e28  11 20 00     ld   de,0x0020     ; stride: one row down the 32-wide map
 *   3e2b  06 1c        ld   b,0x1c        ; 28 rows
 *
 *   ---- loc_3e2d : the djnz fill loop ----
 *   3e2d  77           ld   (hl),a        ; paint one cell
 *   3e2e  19           add  hl,de         ; advance one row
 *   3e2f  10 fc        djnz 0x3e2d
 *   3e31  c9           ret
 *
 * WHAT IT DOES: E is the column offset passed in A; the shared colour index at
 * 0x8057 is incremented and masked (`AND 0xF7` clears bit 3 so the index never
 * lands on a value with bit 3 set), written back, and then stored into 28 cells
 * of colour RAM at stride 0x20 starting from 0x8840 + E — one vertical column.
 *
 * ENTRY IS THROUGH 0x3E13 ONLY. The `jr 0x3e1e` deliberately hops over the
 * `ld e,a` at 0x3e1d, which is sub_3e1d's separate entry (it takes the offset in
 * A and does NOT touch 0x8057's +1/AND bookkeeping). Modelled here as a bare
 * `m.step` into the shared tail — no register effect, the offset is already in E.
 *
 * `add hl,de` writes H, N and C (S/Z/PV preserved); its carry-out survives the
 * flagless `djnz` and the `ret`, so regs.addHl is required over a bare 16-bit add
 * — the sub_3e01 / sub_003d shape. `inc a` leaves carry alone; `and` clears it.
 *
 * B IS NOT CHECKED FOR ZERO, but here it is a fixed 0x1C, so the loop always runs
 * exactly 28 times.
 */
export function sub_3e13(m) {
  const { regs, mem } = m;

  regs.e = regs.a; // ld e,a -- E = entry A (the column offset)
  m.step(0x3e14, 4);
  regs.a = mem.read8(0x8057); // ld a,(0x8057) -- current colour index
  m.step(0x3e17, 13);
  regs.a = regs.inc8(regs.a); // inc a -- carry preserved
  m.step(0x3e18, 4);
  regs.and(0xf7); // and 0xf7 -- clear bit 3; carry cleared
  m.step(0x3e1a, 7);
  regs.c = regs.a; // ld c,a -- C = the advanced index
  m.step(0x3e1b, 4);
  m.step(0x3e1e, 12); // jr 0x3e1e -- skips sub_3e1d's `ld e,a` at 0x3e1d

  regs.d = 0x00; // ld d,0x00 -- DE = 0x00__, E already the offset
  m.step(0x3e20, 7);
  regs.hl = 0x8840; // ld hl,0x8840 -- colour-RAM column base
  m.step(0x3e23, 10);
  regs.addHl(regs.de); // add hl,de -- HL = 0x8840 + offset
  m.step(0x3e24, 11);
  regs.a = regs.c; // ld a,c -- A = the index to paint
  m.step(0x3e25, 4);
  mem.write8(0x8057, regs.a); // ld (0x8057),a -- persist the advanced index
  m.step(0x3e28, 13);
  regs.de = 0x0020; // ld de,0x0020 -- one row down the column
  m.step(0x3e2b, 10);
  regs.b = 0x1c; // ld b,0x1c -- 28 rows
  m.step(0x3e2d, 7);

  do {
    // loc_3e2d -- djnz targets here; paint one cell, advance one row.
    mem.write8(regs.hl, regs.a); // ld (hl),a
    m.step(0x3e2e, 7);
    regs.addHl(regs.de); // add hl,de -- writes H,N,C; the final carry escapes
    m.step(0x3e2f, 11);
    regs.djnz(); // dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x3e2d : 0x3e31, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 3e31
}
