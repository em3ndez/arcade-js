// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_46f4  (ROM 0x46F4-0x472B) — draws the left border/HUD column of the play
 * field. Copies a 0x20-byte ROM strip (0x4AAB..) UP the leftmost video-RAM
 * column (0x93E0 descending by one row, 0x20, each pass), then paints three
 * fixed colour-RAM runs: colour 0x02 down two columns (0x8BA0 and 0x8940) and
 * colour 0x03 down a third (0x8A80).
 *
 *   46f4  dd 21 ab 4a  ld   ix,0x4aab       ; IX = tile source strip
 *   46f8  21 e0 93     ld   hl,0x93e0       ; HL = top of the video column
 *   46fb  11 e0 ff     ld   de,0xffe0       ; DE = -0x20 (one row up per pass)
 *   46fe  06 20        ld   b,0x20          ; 32 tiles
 * loc_4700:
 *   4700  dd 7e 00     ld   a,(ix+0x00)     ; A = next source tile
 *   4703  77           ld   (hl),a          ; write it
 *   4704  19           add  hl,de           ; HL -= 0x20
 *   4705  dd 23        inc  ix              ; source pointer walks up
 *   4707  10 f7        djnz 0x4700          ; B--; more tiles -> loc_4700
 *   4709  21 a0 8b     ld   hl,0x8ba0       ; HL = top of first colour column
 *   470c  11 e0 ff     ld   de,0xffe0       ; DE = -0x20
 *   470f  3e 02        ld   a,0x02          ; colour 0x02
 *   4711  06 09        ld   b,0x09          ; 9 cells
 * loc_4713:
 *   4713  77           ld   (hl),a
 *   4714  19           add  hl,de
 *   4715  10 fc        djnz 0x4713          ; -> loc_4713
 *   4717  21 40 89     ld   hl,0x8940       ; HL = top of second colour column
 *   471a  06 09        ld   b,0x09          ; 9 cells (A still 0x02)
 * loc_471c:
 *   471c  77           ld   (hl),a
 *   471d  19           add  hl,de
 *   471e  10 fc        djnz 0x471c          ; -> loc_471c
 *   4720  21 80 8a     ld   hl,0x8a80       ; HL = top of third colour column
 *   4723  3e 03        ld   a,0x03          ; colour 0x03
 *   4725  06 0a        ld   b,0x0a          ; 10 cells
 * loc_4727:
 *   4727  77           ld   (hl),a
 *   4728  19           add  hl,de
 *   4729  10 fc        djnz 0x4727          ; -> loc_4727
 *   472b  c9           ret
 *
 * `add hl,de` with DE = 0xFFE0 is a 16-bit "subtract 0x20", walking each column
 * UPWARDS through the tilemap/colour RAM. It sets H/N/C and preserves S/Z/PV;
 * `ld a,(ix+0x00)`, `inc ix`, `ld (hl),a` and `djnz` touch no flags, so the
 * flags at `ret` are the last (loop-4) `add hl,de`'s. One unconditional `ret`,
 * stack balanced. On exit IX = 0x4ACB (source+0x20), HL = 0x8940, DE = 0xFFE0,
 * A = 0x03, B = 0x00.
 */
export function loc_46f4(m) {
  const { regs, mem } = m;

  regs.ix = 0x4aab; // 46f4  ld ix,0x4aab
  m.step(0x46f8, 14);

  regs.hl = 0x93e0; // 46f8  ld hl,0x93e0
  m.step(0x46fb, 10);

  regs.de = 0xffe0; // 46fb  ld de,0xffe0
  m.step(0x46fe, 10);

  regs.b = 0x20; // 46fe  ld b,0x20
  m.step(0x4700, 7);

  // loc_4700 -- copy 32 tiles UP the video column.
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); // 4700  ld a,(ix+0x00)
    m.step(0x4703, 19);

    mem.write8(regs.hl, regs.a); // 4703  ld (hl),a
    m.step(0x4704, 7);

    regs.addHl(regs.de); // 4704  add hl,de -- sets H/N/C, keeps S/Z/PV
    m.step(0x4705, 11);

    regs.ix = (regs.ix + 1) & 0xffff; // 4705  inc ix -- no flags
    m.step(0x4707, 10);

    // 4707  djnz 0x4700 -- B-- (no flags), loop while non-zero
    if (regs.djnz() !== 0) {
      m.step(0x4700, 13); // taken -> loc_4700
    } else {
      m.step(0x4709, 8); // not taken -> fall through
      break;
    }
  }

  regs.hl = 0x8ba0; // 4709  ld hl,0x8ba0
  m.step(0x470c, 10);

  regs.de = 0xffe0; // 470c  ld de,0xffe0
  m.step(0x470f, 10);

  regs.a = 0x02; // 470f  ld a,0x02
  m.step(0x4711, 7);

  regs.b = 0x09; // 4711  ld b,0x09
  m.step(0x4713, 7);

  // loc_4713 -- paint colour 0x02 down the first colour column (9 cells).
  for (;;) {
    mem.write8(regs.hl, regs.a); // 4713  ld (hl),a
    m.step(0x4714, 7);

    regs.addHl(regs.de); // 4714  add hl,de
    m.step(0x4715, 11);

    // 4715  djnz 0x4713
    if (regs.djnz() !== 0) {
      m.step(0x4713, 13); // taken -> loc_4713
    } else {
      m.step(0x4717, 8); // not taken -> fall through
      break;
    }
  }

  regs.hl = 0x8940; // 4717  ld hl,0x8940
  m.step(0x471a, 10);

  regs.b = 0x09; // 471a  ld b,0x09  (A still 0x02)
  m.step(0x471c, 7);

  // loc_471c -- paint colour 0x02 down the second colour column (9 cells).
  for (;;) {
    mem.write8(regs.hl, regs.a); // 471c  ld (hl),a
    m.step(0x471d, 7);

    regs.addHl(regs.de); // 471d  add hl,de
    m.step(0x471e, 11);

    // 471e  djnz 0x471c
    if (regs.djnz() !== 0) {
      m.step(0x471c, 13); // taken -> loc_471c
    } else {
      m.step(0x4720, 8); // not taken -> fall through
      break;
    }
  }

  regs.hl = 0x8a80; // 4720  ld hl,0x8a80
  m.step(0x4723, 10);

  regs.a = 0x03; // 4723  ld a,0x03
  m.step(0x4725, 7);

  regs.b = 0x0a; // 4725  ld b,0x0a
  m.step(0x4727, 7);

  // loc_4727 -- paint colour 0x03 down the third colour column (10 cells).
  for (;;) {
    mem.write8(regs.hl, regs.a); // 4727  ld (hl),a
    m.step(0x4728, 7);

    regs.addHl(regs.de); // 4728  add hl,de
    m.step(0x4729, 11);

    // 4729  djnz 0x4727
    if (regs.djnz() !== 0) {
      m.step(0x4727, 13); // taken -> loc_4727
    } else {
      m.step(0x472b, 8); // not taken -> fall through
      break;
    }
  }

  m.ret(); // 472b  ret -- unconditional, 10 T
}
