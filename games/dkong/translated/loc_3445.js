// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3445  (ROM 0x3445–0x3477) — , the table-walk + finalize TAIL of sub_342c.
 *
 *   3445  7e           ld   a,(hl)
 *   3446  fe aa        cp   0xaa           ; terminator?
 *   3448  ca 56 34     jp   z,0x3456
 *   344b  dd 77 05     ld   (ix+0x05),a    ; store the current entry
 *   344e  23           inc  hl
 *   344f  dd 75 1a     ld   (ix+0x1a),l    ; save the advanced pointer
 *   3452  dd 74 1b     ld   (ix+0x1b),h
 *   3455  c9           ret
 *   3456  af           xor  a               ; loc_3456 -- finalize
 *   3457  dd 77 13     ld   (ix+0x13),a
 *   345a  dd 77 18     ld   (ix+0x18),a
 *   345d  dd 77 0d     ld   (ix+0x0d),a
 *   3460  dd 77 1c     ld   (ix+0x1c),a
 *   3463  dd 7e 03     ld   a,(ix+0x03)
 *   3466  dd 77 0e     ld   (ix+0x0e),a
 *   3469  dd 7e 05     ld   a,(ix+0x05)
 *   346c  dd 77 0f     ld   (ix+0x0f),a
 *   346f  dd 36 1a 00  ld   (ix+0x1a),0x00  ; clear the saved pointer
 *   3473  dd 36 1b 00  ld   (ix+0x1b),0x00
 *   3477  c9           ret
 *
 * FACTORED OUT BECAUSE IT IS SHARED: sub_3478 (the twin) does `jp 0x3445` from
 * 0x34A5 and 0x34B6, jumping INTO this tail rather than calling it -- so both
 * routines' rets are this block's rets. Same shape as loc_0038/sub_003d in
 * nmi.js. sub_342c falls through into it; sub_3478 will jump to it.
 */
export function loc_3445(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(regs.hl);
  m.step(0x3446, 7); // ld a,(hl)
  regs.cp(0xaa);
  m.step(0x3448, 7); // cp 0xaa
  if (regs.fZ) {
    // loc_3456 -- terminator reached: finalize the object's fields
    m.step(0x3456, 10); // jp z,0x3456 TAKEN
    regs.xor(regs.a); // xor a -- A = 0
    m.step(0x3457, 4); // xor a
    mem.write8(R(0x13), regs.a);
    m.step(0x345a, 19); // ld (ix+0x13),a
    mem.write8(R(0x18), regs.a);
    m.step(0x345d, 19); // ld (ix+0x18),a
    mem.write8(R(0x0d), regs.a);
    m.step(0x3460, 19); // ld (ix+0x0d),a
    mem.write8(R(0x1c), regs.a);
    m.step(0x3463, 19); // ld (ix+0x1c),a
    regs.a = mem.read8(R(0x03));
    m.step(0x3466, 19); // ld a,(ix+0x03)
    mem.write8(R(0x0e), regs.a);
    m.step(0x3469, 19); // ld (ix+0x0e),a
    regs.a = mem.read8(R(0x05));
    m.step(0x346c, 19); // ld a,(ix+0x05)
    mem.write8(R(0x0f), regs.a);
    m.step(0x346f, 19); // ld (ix+0x0f),a
    mem.write8(R(0x1a), 0x00);
    m.step(0x3473, 19); // ld (ix+0x1a),0x00
    mem.write8(R(0x1b), 0x00);
    m.step(0x3477, 19); // ld (ix+0x1b),0x00
    m.ret(); // 3477
    return;
  }
  m.step(0x344b, 10); // jp z NOT taken -- an ordinary entry

  mem.write8(R(0x05), regs.a);
  m.step(0x344e, 19); // ld (ix+0x05),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x344f, 6); // inc hl -- 16-bit, unlike the inc l elsewhere
  mem.write8(R(0x1a), regs.l);
  m.step(0x3452, 19); // ld (ix+0x1a),l
  mem.write8(R(0x1b), regs.h);
  m.step(0x3455, 19); // ld (ix+0x1b),h

  m.ret(); // 3455
}
