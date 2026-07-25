// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0874  (ROM 0x0874–0x08B1) — clear the playfield.
 *
 *   0874  21 04 74     ld   hl,0x7404
 *   0877  0e 20        ld   c,0x20
 *   0879  06 1c        ld   b,0x1c
 *   087b  3e 10        ld   a,0x10
 *   087d  11 04 00     ld   de,0x0004
 *   0880  77           ld   (hl),a
 *   0881  23           inc  hl
 *   0882  10 fc        djnz 0x0880
 *   0884  19           add  hl,de
 *   0885  0d           dec  c
 *   0886  c2 79 08     jp   nz,0x0879
 *   0889  21 22 75     ld   hl,0x7522
 *   088c  11 20 00     ld   de,0x0020
 *   088f  0e 02        ld   c,0x02
 *   0891  3e 10        ld   a,0x10
 *   0893  06 0e        ld   b,0x0e
 *   0895  77           ld   (hl),a
 *   0896  19           add  hl,de
 *   0897  10 fc        djnz 0x0895
 *   0899  21 23 75     ld   hl,0x7523
 *   089c  0d           dec  c
 *   089d  c2 93 08     jp   nz,0x0893
 *   08a0  21 00 69     ld   hl,0x6900
 *   08a3  06 00        ld   b,0x00
 *   08a5  3e 00        ld   a,0x00
 *   08a7  77           ld   (hl),a
 *   08a8  23           inc  hl
 *   08a9  10 fc        djnz 0x08a7
 *   08ab  06 80        ld   b,0x80
 *   08ad  77           ld   (hl),a
 *   08ae  23           inc  hl
 *   08af  10 fc        djnz 0x08ad
 *   08b1  c9           ret
 *
 * Three blocks:
 *  1. 32 rows x 28 cells of tile 0x10 from 0x7404, stepping DE=4 between rows
 *     -- the 28-wide playfield inside a 32-wide tilemap, so 4 cells per row
 *     are skipped.
 *  2. two columns at 0x7522/0x7523, 14 cells each, stepping DE=0x20 (one row).
 *  3. **clears 0x6900-0x6A7F, 384 bytes** -- 256 (B=0 means 256) then 128.
 *
 * Block 3 is worth noting: 384 = 96 sprites x 4, and 0x6900 is exactly the
 * i8257 channel-0 source address. Independent corroboration that 0x6900 is
 * the sprite BUFFER the CPU fills, not the destination of the blit.
 */
export function sub_0874(m) {
  const { regs, mem } = m;

  regs.hl = 0x7404;
  m.step(0x0877, 10);
  regs.c = 0x20;
  m.step(0x0879, 7);
  do {
    regs.b = 0x1c;
    m.step(0x087b, 7);
    regs.a = 0x10;
    m.step(0x087d, 7);
    regs.de = 0x0004;
    m.step(0x0880, 10);
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x0881, 7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x0882, 6);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x0880 : 0x0884, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    regs.addHl(regs.de);
    m.step(0x0885, 11);
    regs.c = regs.dec8(regs.c);
    m.step(0x0886, 4);
    m.step(regs.fNZ ? 0x0879 : 0x0889, 10);
  } while (regs.fNZ);

  regs.hl = 0x7522;
  m.step(0x088c, 10);
  regs.de = 0x0020;
  m.step(0x088f, 10);
  regs.c = 0x02;
  m.step(0x0891, 7);
  // `ld a,0x10` at 0x0891 is OUTSIDE the loop: the branch at 0x089D is
  // `jp nz,0x0893`, which re-enters at `ld b,0x0e`, NOT at 0x0891. Having it
  // inside cost one extra 7 T-state load on the second pass -- the exact
  // 7-cycle surplus the write trace and the taps had bracketed.
  regs.a = 0x10;
  m.step(0x0893, 7);
  do {
    regs.b = 0x0e;
    m.step(0x0895, 7);
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x0896, 7);
      regs.addHl(regs.de);
      m.step(0x0897, 11);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x0895 : 0x0899, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    regs.hl = 0x7523;
    m.step(0x089c, 10);
    regs.c = regs.dec8(regs.c);
    m.step(0x089d, 4);
    m.step(regs.fNZ ? 0x0893 : 0x08a0, 10);
  } while (regs.fNZ);

  // Clear the sprite buffer: 256 + 128 = 384 bytes at 0x6900-0x6A7F.
  regs.hl = 0x6900;
  m.step(0x08a3, 10);
  regs.b = 0x00; // means 256
  m.step(0x08a5, 7);
  regs.a = 0x00;
  m.step(0x08a7, 7);
  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x08a8, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x08a9, 6);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x08a7 : 0x08ab, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  regs.b = 0x80;
  m.step(0x08ad, 7);
  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x08ae, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x08af, 6);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x08ad : 0x08b1, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret();
}
