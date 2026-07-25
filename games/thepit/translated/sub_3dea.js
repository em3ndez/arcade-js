// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3dea  (ROM 0x3dea-0x3e00) — copies a run of bytes DOWN a RAM column.
 *
 * Copies B = mem[0x8055] bytes from a DESCENDING IX source pointer into
 * successive rows of a column: destination starts at HL = word[0x8060] and
 * advances by DE = 0x20 (one tile-row down the 32-wide map) per byte, while the
 * source pointer IX walks backwards one byte per store. The advanced HL is
 * written back to 0x8060 so a follow-up call continues from the next column
 * cell. loc_3df4 (the `ld a,(ix+0x00)`) is the djnz target, so the source is
 * re-read every pass — a genuine copy, not a constant fill (that is the sibling
 * at 0x3ddd which jumps straight to loc_3df7).
 *
 *   3dea  3a 55 80     ld   a,(0x8055)
 *   3ded  47           ld   b,a
 *   3dee  2a 60 80     ld   hl,(0x8060)
 *   3df1  11 20 00     ld   de,0x0020
 * loc_3df4:
 *   3df4  dd 7e 00     ld   a,(ix+0x00)
 * loc_3df7:
 *   3df7  77           ld   (hl),a
 *   3df8  19           add  hl,de
 *   3df9  dd 2b        dec  ix
 *   3dfb  10 f7        djnz 0x3df4
 *   3dfd  22 60 80     ld   (0x8060),hl
 *   3e00  c9           ret
 *
 * `dec ix` and `djnz` touch no flags; the flags left at `ret` are the last
 * `add hl,de`'s. If B is 0 on entry the djnz wraps and runs 256 passes — real
 * Z80 behaviour, reproduced not guarded.
 */
export function sub_3dea(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8055);
  m.step(0x3ded, 13); // 3dea  ld a,(0x8055)

  regs.b = regs.a;
  m.step(0x3dee, 4); // 3ded  ld b,a

  regs.hl = mem.read16(0x8060);
  m.step(0x3df1, 16); // 3dee  ld hl,(0x8060)

  regs.de = 0x0020;
  m.step(0x3df4, 10); // 3df1  ld de,0x0020

  // loc_3df4: copy B bytes down the column; IX walks backwards, HL by +0x20.
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); // 3df4  ld a,(ix+0x00)
    m.step(0x3df7, 19);

    mem.write8(regs.hl, regs.a); // 3df7  ld (hl),a
    m.step(0x3df8, 7);

    regs.addHl(regs.de); // 3df8  add hl,de
    m.step(0x3df9, 11);

    regs.ix = (regs.ix - 1) & 0xffff; // 3df9  dec ix
    m.step(0x3dfb, 10);

    // 3dfb  djnz 0x3df4 -- decrement B (no flags), loop while non-zero
    if (regs.djnz() !== 0) {
      m.step(0x3df4, 13); // djnz taken
    } else {
      m.step(0x3dfd, 8); // djnz not taken -> fall through
      break;
    }
  }

  mem.write16(0x8060, regs.hl); // 3dfd  ld (0x8060),hl
  m.step(0x3e00, 16);

  m.ret(); // 3e00  ret
}
