// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_34b9  (ROM 0x34B9–0x34F2) — 58 bytes, 26 instructions.
 *
 *   34b9  3a 27 62     ld   a,(0x6227)
 *   34bc  fe 03        cp   0x03
 *   34be  c8           ret  z               ; early out
 *   34bf  3a 03 62     ld   a,(0x6203)
 *   34c2  cb 7f        bit  7,a             ; two-table select
 *   34c4  c2 ed 34     jp   nz,0x34ed
 *   34c7  21 c4 3a     ld   hl,0x3ac4       ; bit 7 CLEAR
 *   34ca  06 00        ld   b,0x00          ; loc_34ca -- SHARED tail
 *   34cc  3a 19 60     ld   a,(0x6019)
 *   34cf  e6 06        and  0x06            ; index 0/2/4/6 (2-byte entries)
 *   34d1  4f           ld   c,a
 *   34d2  09           add  hl,bc
 *   34d3  7e           ld   a,(hl)
 *   34d4  dd 77 03     ld   (ix+0x03),a
 *   34d7  dd 77 0e     ld   (ix+0x0e),a
 *   34da  23           inc  hl
 *   34db  7e           ld   a,(hl)
 *   34dc  dd 77 05     ld   (ix+0x05),a
 *   34df  dd 77 0f     ld   (ix+0x0f),a
 *   34e2  af           xor  a
 *   34e3  dd 77 0d     ld   (ix+0x0d),a
 *   34e6  dd 77 18     ld   (ix+0x18),a
 *   34e9  dd 77 1c     ld   (ix+0x1c),a
 *   34ec  c9           ret
 *   34ed  21 d4 3a     ld   hl,0x3ad4       ; loc_34ed -- bit 7 SET
 *   34f0  c3 ca 34     jp   0x34ca
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x32CA (sub_32bd, untranslated).
 * Calls nothing; IX live-in. With #19 and #20 this completes sub_32bd's callees.
 *
 * A table initializer: returns immediately if 0x6227 == 3; otherwise selects one
 * of two tables by BIT 7 of 0x6203 (set -> 0x3AD4, clear -> 0x3AC4), indexes it
 * by (0x6019 & 6) -- masking to {0,2,4,6}, i.e. 2-byte-aligned entries -- and
 * loads the entry into PAIRED object fields: byte 0 into both (ix+0x03) and
 * (ix+0x0e), byte 1 into both (ix+0x05) and (ix+0x0f), then clears (ix+0x0d),
 * (ix+0x18) and (ix+0x1c). Tables / 0x6019 / 0x6203 / 0x6227 not interpreted.
 *
 * loc_34ca is a SHARED tail: both table branches converge on it with different
 * HL, so the select is purely which base address is in HL when it arrives.
 * `add hl,bc` here is a PLAIN add (0x09 -> regs.addHl), not the adc hl,bc
 * zero-test idiom the twins 342c/3478 use.
 */
export function sub_34b9(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(0x6227);
  m.step(0x34bc, 13); // ld a,(0x6227)
  regs.cp(0x03);
  m.step(0x34be, 7); // cp 0x03
  if (regs.fZ) {
    m.ret(11); // ret z -- early out
    return;
  }
  m.step(0x34bf, 5); // ret z NOT taken

  regs.a = mem.read8(0x6203);
  m.step(0x34c2, 13); // ld a,(0x6203)
  regs.bit(7, regs.a); // sets Z = !bit7
  m.step(0x34c4, 8); // bit 7,a
  if (regs.fNZ) {
    // loc_34ed -- bit 7 SET
    m.step(0x34ed, 10); // jp nz,0x34ed TAKEN
    regs.hl = 0x3ad4;
    m.step(0x34f0, 10); // ld hl,0x3ad4
    m.step(0x34ca, 10); // jp 0x34ca
  } else {
    m.step(0x34c7, 10); // jp nz NOT taken -- bit 7 CLEAR
    regs.hl = 0x3ac4;
    m.step(0x34ca, 10); // ld hl,0x3ac4
  }

  // loc_34ca -- shared tail, HL already holds the selected table base
  regs.b = 0x00;
  m.step(0x34cc, 7); // ld b,0x00
  regs.a = mem.read8(0x6019);
  m.step(0x34cf, 13); // ld a,(0x6019)
  regs.and(0x06); // index 0/2/4/6 -- NOT &7, NOT &0xE
  m.step(0x34d1, 7); // and 0x06
  regs.c = regs.a;
  m.step(0x34d2, 4); // ld c,a
  regs.addHl(regs.bc); // add hl,bc -- PLAIN add (0x09), not adc
  m.step(0x34d3, 11); // add hl,bc
  regs.a = mem.read8(regs.hl);
  m.step(0x34d4, 7); // ld a,(hl)
  mem.write8(R(0x03), regs.a);
  m.step(0x34d7, 19); // ld (ix+0x03),a
  mem.write8(R(0x0e), regs.a); // SAME byte into a second field
  m.step(0x34da, 19); // ld (ix+0x0e),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x34db, 6); // inc hl -- 16-bit
  regs.a = mem.read8(regs.hl);
  m.step(0x34dc, 7); // ld a,(hl)
  mem.write8(R(0x05), regs.a);
  m.step(0x34df, 19); // ld (ix+0x05),a
  mem.write8(R(0x0f), regs.a); // SAME byte into a second field
  m.step(0x34e2, 19); // ld (ix+0x0f),a
  regs.xor(regs.a); // xor a -- A = 0
  m.step(0x34e3, 4); // xor a
  mem.write8(R(0x0d), regs.a);
  m.step(0x34e6, 19); // ld (ix+0x0d),a
  mem.write8(R(0x18), regs.a);
  m.step(0x34e9, 19); // ld (ix+0x18),a
  mem.write8(R(0x1c), regs.a);
  m.step(0x34ec, 19); // ld (ix+0x1c),a

  m.ret(); // 34ec
}
