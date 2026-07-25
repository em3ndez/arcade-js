// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3ddb  (ROM 0x3ddb-0x3e00) — fills a vertical strip (stride 0x20) of
 * B = (0x8055) cells starting at HL = (0x8060). The FIRST cell gets the fixed
 * byte (0x4b0f); every later cell gets a byte walked BACKWARDS through (ix)
 * (ix decremented each pass). The advanced HL is stored back to 0x8060.
 *
 *   3ddb  3a 55 80     ld   a,(0x8055)      ; A = strip height (loop count)
 *   3dde  47           ld   b,a             ; B = count
 *   3ddf  2a 60 80     ld   hl,(0x8060)     ; HL = write cursor
 *   3de2  11 20 00     ld   de,0x0020       ; stride = 32 (one row down)
 *   3de5  3a 0f 4b     ld   a,(0x4b0f)      ; A = the FIRST (cap) byte
 *   3de8  18 0d        jr   0x3df7          ; enter the loop at loc_3df7 --
 *                                           ;   SKIPS the (ix) load first time
 * loc_3df4:
 *   3df4  dd 7e 00     ld   a,(ix+0x00)     ; A = next source byte
 * loc_3df7:
 *   3df7  77           ld   (hl),a          ; write the cell
 *   3df8  19           add  hl,de           ; cursor += 0x20
 *   3df9  dd 2b        dec  ix              ; source pointer walks down
 *   3dfb  10 f7        djnz 0x3df4          ; B--; more cells -> loc_3df4
 *   3dfd  22 60 80     ld   (0x8060),hl     ; store the advanced cursor
 *   3e00  c9           ret
 *
 * THE `jr 0x3df7` IS THE WHOLE POINT. The shared loop body is entered one
 * instruction late, past the `ld a,(ix+0x00)` at loc_3df4, so the first cell
 * takes the pre-loaded constant (0x4b0f) while all the rest take (ix). The
 * sibling loc_3dea (0x3dea) is byte-identical setup but enters at loc_3df4, so
 * ITS first cell also comes from (ix). Modelling the entry as loc_3df4 here
 * would silently make the first written byte wrong -- that is this routine's
 * one load-bearing subtlety and what the test's mutation attacks.
 *
 * `dec ix` runs BEFORE the first (ix) read (the read happens on the djnz-taken
 * path, after a decrement), so (ix) at entry is never read: the reads are
 * ix-1, ix-2, ... ix-(B-1). `add hl,de` sets H/N/C and preserves S/Z/PV;
 * `dec ix` and `djnz` touch no flags, so the flags at ret are the last
 * `add hl,de`'s.
 */
export function loc_3ddb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8055); // 3ddb  ld a,(0x8055)
  m.step(0x3dde, 13);

  regs.b = regs.a; // 3dde  ld b,a
  m.step(0x3ddf, 4);

  regs.hl = mem.read16(0x8060); // 3ddf  ld hl,(0x8060)
  m.step(0x3de2, 16);

  regs.de = 0x0020; // 3de2  ld de,0x0020
  m.step(0x3de5, 10);

  regs.a = mem.read8(0x4b0f); // 3de5  ld a,(0x4b0f)
  m.step(0x3de8, 13);

  // 3de8  jr 0x3df7 -- enter the loop at loc_3df7, past loc_3df4's (ix) load.
  m.step(0x3df7, 12);

  for (;;) {
    // loc_3df7
    mem.write8(regs.hl, regs.a); // 3df7  ld (hl),a
    m.step(0x3df8, 7);

    regs.addHl(regs.de); // 3df8  add hl,de -- sets H/N/C, keeps S/Z/PV
    m.step(0x3df9, 11);

    regs.ix = (regs.ix - 1) & 0xffff; // 3df9  dec ix -- no flags
    m.step(0x3dfb, 10);

    // 3dfb  djnz 0x3df4 -- decrement B (no flags), loop while non-zero
    if (regs.djnz() !== 0) {
      m.step(0x3df4, 13); // djnz taken -> loc_3df4
      regs.a = mem.read8((regs.ix + 0x00) & 0xffff); // 3df4  ld a,(ix+0x00)
      m.step(0x3df7, 19);
    } else {
      m.step(0x3dfd, 8); // djnz not taken -> fall through
      break;
    }
  }

  mem.write16(0x8060, regs.hl); // 3dfd  ld (0x8060),hl
  m.step(0x3e00, 16);

  m.ret(); // 3e00  ret
}
