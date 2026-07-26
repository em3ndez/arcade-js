// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4d0c  (ROM 0x4d0c-0x4d39) — splits the 16-bit value staged at 0x8037/0x8038
 * into four nibble "digit" cells at the buffer HL points to, with leading-zero
 * suppression on the top digit, then appends two trailing zero cells.
 *
 * 0x8038 is the high byte, 0x8037 the low byte (the caller stores a value with
 * `ld (0x8037),hl`). Each byte is unpacked most-significant-nibble first:
 *   HL[+0] = hi>>4   (WRITTEN ONLY IF NON-ZERO — leading-zero blanking)
 *   HL[+1] = hi&0x0f
 *   HL[+2] = lo>>4
 *   HL[+3] = lo&0x0f
 *   HL[+4] = 0
 *   HL[+5] = 0
 * When the top nibble (hi>>4) is zero the first store and its inc hl are skipped,
 * so the whole run shifts down one cell and only five bytes are written. HL is
 * left just past the last cell written. These are display "digit" codes: four
 * nibbles of the packed value followed by two blanks.
 *
 *   4d0c  3a 38 80     ld   a,(0x8038)
 *   4d0f  4f           ld   c,a
 *   4d10  cb 3f        srl  a
 *   4d12  cb 3f        srl  a
 *   4d14  cb 3f        srl  a
 *   4d16  cb 3f        srl  a          ; A = hi>>4, Z if the top nibble is 0
 *   4d18  28 02        jr   z,0x4d1c   ; blank the leading digit
 *   4d1a  77           ld   (hl),a
 *   4d1b  23           inc  hl
 *   4d1c  79           ld   a,c        ; loc_4d1c
 *   4d1d  e6 0f        and  0x0f
 *   4d1f  77           ld   (hl),a
 *   4d20  23           inc  hl
 *   4d21  3a 37 80     ld   a,(0x8037)
 *   4d24  4f           ld   c,a
 *   4d25  cb 3f        srl  a
 *   4d27  cb 3f        srl  a
 *   4d29  cb 3f        srl  a
 *   4d2b  cb 3f        srl  a          ; A = lo>>4 (no blanking here)
 *   4d2d  77           ld   (hl),a
 *   4d2e  23           inc  hl
 *   4d2f  79           ld   a,c
 *   4d30  e6 0f        and  0x0f
 *   4d32  77           ld   (hl),a
 *   4d33  23           inc  hl
 *   4d34  36 00        ld   (hl),0x00
 *   4d36  23           inc  hl
 *   4d37  36 00        ld   (hl),0x00
 *   4d39  c9           ret
 */
export function loc_4d0c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8038);
  m.step(0x4d0f, 13); // ld a,(0x8038) -- high byte

  regs.c = regs.a;
  m.step(0x4d10, 4); // ld c,a -- save the packed byte

  regs.a = regs.srl(regs.a);
  m.step(0x4d12, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x4d14, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x4d16, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x4d18, 8); // srl a -- A = hi>>4, Z set if the top nibble is 0

  if (regs.fZ) {
    m.step(0x4d1c, 12); // jr z taken -- top digit is zero, blank it
  } else {
    m.step(0x4d1a, 7); // jr z not taken -- emit the top digit
    mem.write8(regs.hl, regs.a);
    m.step(0x4d1b, 7); // ld (hl),a -- hi>>4
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4d1c, 6); // inc hl
  }

  // loc_4d1c
  regs.a = regs.c;
  m.step(0x4d1d, 4); // ld a,c -- restore packed high byte
  regs.and(0x0f);
  m.step(0x4d1f, 7); // and 0x0f -- low nibble of hi
  mem.write8(regs.hl, regs.a);
  m.step(0x4d20, 7); // ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d21, 6); // inc hl

  regs.a = mem.read8(0x8037);
  m.step(0x4d24, 13); // ld a,(0x8037) -- low byte

  regs.c = regs.a;
  m.step(0x4d25, 4); // ld c,a -- save the packed byte

  regs.a = regs.srl(regs.a);
  m.step(0x4d27, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x4d29, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x4d2b, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x4d2d, 8); // srl a -- A = lo>>4

  mem.write8(regs.hl, regs.a);
  m.step(0x4d2e, 7); // ld (hl),a -- lo>>4 (no blanking)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d2f, 6); // inc hl

  regs.a = regs.c;
  m.step(0x4d30, 4); // ld a,c -- restore packed low byte
  regs.and(0x0f);
  m.step(0x4d32, 7); // and 0x0f -- low nibble of lo
  mem.write8(regs.hl, regs.a);
  m.step(0x4d33, 7); // ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d34, 6); // inc hl

  mem.write8(regs.hl, 0x00);
  m.step(0x4d36, 10); // ld (hl),0x00 -- trailing blank
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d37, 6); // inc hl

  mem.write8(regs.hl, 0x00);
  m.step(0x4d39, 10); // ld (hl),0x00 -- trailing blank

  m.ret(); // 4d39  ret
}
