// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_47a1  (ROM 0x47A1-0x47E0) — draws a play-field column and its colour trim.
 * Copies a 28-byte strip from work RAM (0x8282..) UP the video column at 0x93BF
 * (stride -0x20, one row per pass), then fills a colour-RAM column through
 * sub_3e1d (C=0x02, column selector A=0x1F), and finally paints three 3-cell
 * colour runs — 0x06, then 0x04, then 0x07 — down neighbouring columns, hopping
 * between them with two strides: DE=0xFFE0 (-0x20, one row up) and BC=0xFF20
 * (-0xE0, up and across to the next column).
 *
 *   47a1  dd 21 82 82  ld   ix,0x8282     ; IX = work-RAM source strip
 *   47a5  21 bf 93     ld   hl,0x93bf     ; HL = top of the video column
 *   47a8  11 e0 ff     ld   de,0xffe0     ; DE = -0x20 (one row up per pass)
 *   47ab  06 1c        ld   b,0x1c        ; 28 tiles
 * loc_47ad:
 *   47ad  dd 7e 00     ld   a,(ix+0x00)   ; A = next source byte
 *   47b0  77           ld   (hl),a        ; write it
 *   47b1  dd 23        inc  ix            ; source pointer walks up
 *   47b3  19           add  hl,de         ; HL -= 0x20
 *   47b4  10 f7        djnz 0x47ad        ; B--; more -> loc_47ad
 *   47b6  0e 02        ld   c,0x02        ; sub_3e1d fill byte
 *   47b8  3e 1f        ld   a,0x1f        ; sub_3e1d column selector
 *   47ba  cd 1d 3e     call 0x3e1d        ; fill a colour column
 *   47bd  21 9f 8b     ld   hl,0x8b9f     ; HL = top of the trim column
 *   47c0  11 e0 ff     ld   de,0xffe0     ; DE = -0x20 (within a column)
 *   47c3  01 20 ff     ld   bc,0xff20     ; BC = -0xE0 (hop to next column)
 *   47c6  36 06        ld   (hl),0x06
 *   47c8  19           add  hl,de
 *   47c9  36 06        ld   (hl),0x06
 *   47cb  19           add  hl,de
 *   47cc  36 06        ld   (hl),0x06
 *   47ce  09           add  hl,bc
 *   47cf  36 04        ld   (hl),0x04
 *   47d1  19           add  hl,de
 *   47d2  36 04        ld   (hl),0x04
 *   47d4  19           add  hl,de
 *   47d5  36 04        ld   (hl),0x04
 *   47d7  09           add  hl,bc
 *   47d8  36 07        ld   (hl),0x07
 *   47da  19           add  hl,de
 *   47db  36 07        ld   (hl),0x07
 *   47dd  19           add  hl,de
 *   47de  36 07        ld   (hl),0x07
 *   47e0  c9           ret
 *
 * `ld a,(ix+d)`, `ld (hl),a/n`, `inc ix` and `djnz` touch no flags; only the
 * `add hl,rr` instructions do (H/N/C set, S/Z/PV preserved), so the flags at
 * `ret` are the last `add hl,de` (0x47dd)'s. THE TWO STRIDES ARE THE TRAP:
 * 0xFFE0 (-0x20) steps up one row; 0xFF20 (-0xE0) is used at the two `add hl,bc`
 * sites to jump up-and-left to the next colour column. On exit HL = 0x891F,
 * IX = 0x829E (source+0x1C), DE = 0xFFE0, BC = 0xFF20, A = 0x1F, B = 0x00.
 * One unconditional `ret`, stack balanced.
 */
export function sub_47a1(m) {
  const { regs, mem } = m;

  regs.ix = 0x8282; // 47a1  ld ix,0x8282
  m.step(0x47a5, 14);

  regs.hl = 0x93bf; // 47a5  ld hl,0x93bf
  m.step(0x47a8, 10);

  regs.de = 0xffe0; // 47a8  ld de,0xffe0
  m.step(0x47ab, 10);

  regs.b = 0x1c; // 47ab  ld b,0x1c
  m.step(0x47ad, 7);

  // loc_47ad -- copy 28 bytes UP the video column.
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); // 47ad  ld a,(ix+0x00)
    m.step(0x47b0, 19);

    mem.write8(regs.hl, regs.a); // 47b0  ld (hl),a
    m.step(0x47b1, 7);

    regs.ix = (regs.ix + 1) & 0xffff; // 47b1  inc ix -- no flags
    m.step(0x47b3, 10);

    regs.addHl(regs.de); // 47b3  add hl,de -- sets H/N/C, keeps S/Z/PV
    m.step(0x47b4, 11);

    // 47b4  djnz 0x47ad -- B-- (no flags), loop while non-zero
    if (regs.djnz() !== 0) {
      m.step(0x47ad, 13); // taken -> loc_47ad
    } else {
      m.step(0x47b6, 8); // not taken -> fall through
      break;
    }
  }

  regs.c = 0x02; // 47b6  ld c,0x02
  m.step(0x47b8, 7);

  regs.a = 0x1f; // 47b8  ld a,0x1f
  m.step(0x47ba, 7);

  m.push16(0x47bd); // 47ba  call 0x3e1d
  m.step(0x3e1d, 17);
  m.call(0x3e1d);

  regs.hl = 0x8b9f; // 47bd  ld hl,0x8b9f
  m.step(0x47c0, 10);

  regs.de = 0xffe0; // 47c0  ld de,0xffe0
  m.step(0x47c3, 10);

  regs.bc = 0xff20; // 47c3  ld bc,0xff20
  m.step(0x47c6, 10);

  mem.write8(regs.hl, 0x06); // 47c6  ld (hl),0x06
  m.step(0x47c8, 10);

  regs.addHl(regs.de); // 47c8  add hl,de
  m.step(0x47c9, 11);

  mem.write8(regs.hl, 0x06); // 47c9  ld (hl),0x06
  m.step(0x47cb, 10);

  regs.addHl(regs.de); // 47cb  add hl,de
  m.step(0x47cc, 11);

  mem.write8(regs.hl, 0x06); // 47cc  ld (hl),0x06
  m.step(0x47ce, 10);

  regs.addHl(regs.bc); // 47ce  add hl,bc -- hop to next column (-0xE0)
  m.step(0x47cf, 11);

  mem.write8(regs.hl, 0x04); // 47cf  ld (hl),0x04
  m.step(0x47d1, 10);

  regs.addHl(regs.de); // 47d1  add hl,de
  m.step(0x47d2, 11);

  mem.write8(regs.hl, 0x04); // 47d2  ld (hl),0x04
  m.step(0x47d4, 10);

  regs.addHl(regs.de); // 47d4  add hl,de
  m.step(0x47d5, 11);

  mem.write8(regs.hl, 0x04); // 47d5  ld (hl),0x04
  m.step(0x47d7, 10);

  regs.addHl(regs.bc); // 47d7  add hl,bc -- hop to next column (-0xE0)
  m.step(0x47d8, 11);

  mem.write8(regs.hl, 0x07); // 47d8  ld (hl),0x07
  m.step(0x47da, 10);

  regs.addHl(regs.de); // 47da  add hl,de
  m.step(0x47db, 11);

  mem.write8(regs.hl, 0x07); // 47db  ld (hl),0x07
  m.step(0x47dd, 10);

  regs.addHl(regs.de); // 47dd  add hl,de
  m.step(0x47de, 11);

  mem.write8(regs.hl, 0x07); // 47de  ld (hl),0x07
  m.step(0x47e0, 10);

  m.ret(); // 47e0  ret -- unconditional, 10 T
}
