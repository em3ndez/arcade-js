// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_011c  (ROM 0x011C–0x0137) — silence the sound hardware.
 *
 *   011c  06 08        ld   b,0x08
 *   011e  af           xor  a
 *   011f  21 00 7d     ld   hl,0x7d00
 *   0122  11 80 60     ld   de,0x6080
 *   0125  77           ld   (hl),a           ; loc_0125
 *   0126  12           ld   (de),a
 *   0127  2c           inc  l
 *   0128  1c           inc  e
 *   0129  10 fa        djnz 0x0125
 *   012b  06 04        ld   b,0x04
 *   012d  12           ld   (de),a           ; loc_012d
 *   012e  1c           inc  e
 *   012f  10 fc        djnz 0x012d
 *   0131  32 80 7d     ld   (0x7d80),a
 *   0134  32 00 7c     ld   (0x7c00),a
 *   0137  c9           ret
 *
 * Zeroes all eight ls259.6h latch bits (0x7D00-0x7D07) while keeping a shadow
 * copy in work RAM at 0x6080-0x6087, then zeroes 0x6088-0x608B, the audio IRQ
 * (0x7D80) and the ls175.3d sound latch (0x7C00).
 *
 * The shadow copy matters for us: the latch is write-only from the Z80's
 * side, so the ROM keeps its own readable mirror in RAM. That mirror lands in
 * the state dump, which means the state diff covers the latch contents even
 * though the hardware register itself is invisible.
 *
 * Note `inc l` / `inc e` (8-bit) rather than `inc hl` / `inc de`: the high
 * bytes never change here, and translating them as 16-bit increments would be
 * wrong the moment a low byte wrapped.
 */
export function sub_011c(m) {
  const { regs, mem } = m;

  regs.b = 0x08;
  m.tick(7); // ld b,0x08
  regs.xor(regs.a); // A = 0
  m.tick(4); // xor a
  regs.hl = 0x7d00;
  m.tick(10); // ld hl,0x7d00
  regs.de = 0x6080;
  m.tick(10); // ld de,0x6080

  do {
    mem.write8(regs.hl, regs.a, 4); // loc_0125 -- ls259.6h bit, ld (hl),a
    m.tick(7); // ld (hl),a
    mem.write8(regs.de, regs.a); // shadow copy in work RAM
    m.tick(7); // ld (de),a
    regs.l = regs.inc8(regs.l); // inc l, NOT inc hl -- and INC sets flags
    m.tick(4);
    regs.e = regs.inc8(regs.e); // inc e, NOT inc de
    m.tick(4);
    regs.djnz();
    m.tick(regs.b !== 0 ? 13 : 8); // djnz
  } while (regs.b !== 0);

  regs.b = 0x04;
  m.tick(7); // ld b,0x04
  do {
    mem.write8(regs.de, regs.a); // loc_012d -- 0x6088-0x608B
    m.tick(7); // ld (de),a
    regs.e = regs.inc8(regs.e);
    m.tick(4); // inc e
    regs.djnz();
    m.tick(regs.b !== 0 ? 13 : 8); // djnz
  } while (regs.b !== 0);

  mem.write8(0x7d80, regs.a, 10); // audio IRQ off
  m.tick(13);
  mem.write8(0x7c00, regs.a, 10); // ls175.3d sound latch cleared
  m.tick(13);

  m.pop16(); // 0137: ret
  m.tick(10);
}
