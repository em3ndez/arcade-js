// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4785  (ROM 0x4785-0x47A0) — draws a border/HUD column. Copies a 0x20-byte
 * ROM tile strip (0x4ACB..0x4AEA) UP a video-RAM column (0x93FE, descending by
 * one row = 0x20 each pass), then TAIL-jumps into sub_3e1d with C=0x01, A=0x1E to
 * paint the matching colour-RAM column (base 0x8840+0x1E, 28 rows of colour 0x01).
 *
 * The tile source 0x4ACB is exactly sub_46f4's source + 0x20 — this routine draws
 * the sibling column, using the identical copy-up loop.
 *
 *   4785  dd 21 cb 4a  ld   ix,0x4acb       ; IX = tile source strip
 *   4789  21 fe 93     ld   hl,0x93fe       ; HL = top of the video column
 *   478c  11 e0 ff     ld   de,0xffe0       ; DE = -0x20 (one row up per pass)
 *   478f  06 20        ld   b,0x20          ; 32 tiles
 * loc_4791:
 *   4791  dd 7e 00     ld   a,(ix+0x00)     ; A = next source tile
 *   4794  77           ld   (hl),a          ; write it
 *   4795  19           add  hl,de           ; HL -= 0x20
 *   4796  dd 23        inc  ix              ; source pointer walks up
 *   4798  10 f7        djnz 0x4791          ; B--; more tiles -> loc_4791
 *   479a  0e 01        ld   c,0x01          ; colour byte for the colour column
 *   479c  3e 1e        ld   a,0x1e          ; column offset for the colour column
 *   479e  c3 1d 3e     jp   0x3e1d          ; TAIL-jump -> colour-column fill
 *
 * `add hl,de` with DE = 0xFFE0 is a 16-bit "subtract 0x20", walking the column
 * UPWARDS through video RAM. It sets H/N/C and preserves S/Z/PV; `ld a,(ix+0x00)`,
 * `inc ix`, `ld (hl),a`, `djnz`, `ld c,n` and `ld a,n` touch no flags, so the flags
 * entering the tail are the last loop `add hl,de`'s — but sub_3e1d overwrites them
 * before any conditional reads them. On exit from the loop IX = 0x4AEB (source +
 * 0x20), HL = 0x8FFE (0x93FE - 0x20*0x20), DE = 0xFFE0, B = 0.
 *
 * `jp 0x3e1d` is a TAIL-JUMP: an unconditional JP pushes nothing, so sub_3e1d's own
 * `ret` returns to OUR caller. Modelled `m.step(0x3e1d,10); return m.call(0x3e1d)`,
 * NOT the `m.call; m.ret()` shape — that would pop a spurious word off the stack and
 * charge a second ret (see sub_3d7e / sub_3b81). sub_3e1d reads A (0x1E) as the
 * colour-column offset and C (0x01) as the fill byte, which is why they are loaded
 * here immediately before the jump.
 */
export function sub_4785(m) {
  const { regs, mem } = m;

  regs.ix = 0x4acb; // 4785  ld ix,0x4acb -- tile source strip
  m.step(0x4789, 14);

  regs.hl = 0x93fe; // 4789  ld hl,0x93fe -- top of the video column
  m.step(0x478c, 10);

  regs.de = 0xffe0; // 478c  ld de,0xffe0 -- -0x20, one row up per pass
  m.step(0x478f, 10);

  regs.b = 0x20; // 478f  ld b,0x20 -- 32 tiles
  m.step(0x4791, 7);

  // loc_4791 -- copy 32 tiles UP the video column.
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); // 4791  ld a,(ix+0x00)
    m.step(0x4794, 19);

    mem.write8(regs.hl, regs.a); // 4794  ld (hl),a
    m.step(0x4795, 7);

    regs.addHl(regs.de); // 4795  add hl,de -- sets H/N/C, keeps S/Z/PV
    m.step(0x4796, 11);

    regs.ix = (regs.ix + 1) & 0xffff; // 4796  inc ix -- no flags
    m.step(0x4798, 10);

    // 4798  djnz 0x4791 -- B-- (no flags), loop while non-zero
    if (regs.djnz() !== 0) {
      m.step(0x4791, 13); // taken -> loc_4791
    } else {
      m.step(0x479a, 8); // not taken -> fall through
      break;
    }
  }

  regs.c = 0x01; // 479a  ld c,0x01 -- fill byte for sub_3e1d's colour column
  m.step(0x479c, 7);

  regs.a = 0x1e; // 479c  ld a,0x1e -- column offset for sub_3e1d
  m.step(0x479e, 7);

  // 479e  jp 0x3e1d -- tail-jump; sub_3e1d's ret returns to OUR caller.
  m.step(0x3e1d, 10);
  return m.call(0x3e1d);
}
