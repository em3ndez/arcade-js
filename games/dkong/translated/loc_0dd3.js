// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0dd3  (ROM 0x0DD3–0x0E18) — converts a record's second point and computes the segment deltas -- a line-segment primitive.
 *
 *   0dd3  32 b1 63     ld   (0x63b1),a
 *   0dd6  13           inc  de
 *   0dd7  1a           ld   a,(de)
 *   0dd8  6f           ld   l,a
 *   0dd9  91           sub  c
 *   0dda  32 b2 63     ld   (0x63b2),a
 *   0ddd  1a           ld   a,(de)
 *   0dde  e6 07        and  0x07
 *   0de0  32 b0 63     ld   (0x63b0),a
 *   0de3  d5           push de
 *   0de4  cd f0 2f     call 0x2ff0
 *   0de7  d1           pop  de
 *   0de8  22 ad 63     ld   (0x63ad),hl
 *   0deb  3a b3 63     ld   a,(0x63b3)
 *   0dee  fe 02        cp   0x02
 *   0df0  f2 4f 0e     jp   p,0x0e4f
 *   0df3  3a b2 63     ld   a,(0x63b2)
 *   0df6  d6 10        sub  0x10
 *   0df8  47           ld   b,a
 *   0df9  3a af 63     ld   a,(0x63af)
 *   0dfc  80           add  a,b
 *   0dfd  32 b2 63     ld   (0x63b2),a
 *   0e00  3a af 63     ld   a,(0x63af)
 *   0e03  c6 f0        add  a,0xf0
 *   0e05  2a ab 63     ld   hl,(0x63ab)
 *   0e08  77           ld   (hl),a
 *   0e09  2c           inc  l
 *   0e0a  d6 30        sub  0x30
 *   0e0c  77           ld   (hl),a
 *   0e0d  3a b3 63     ld   a,(0x63b3)
 *   0e10  fe 01        cp   0x01
 *   0e12  c2 19 0e     jp   nz,0x0e19
 *   0e15  af           xor  a
 *   0e16  32 b2 63     ld   (0x63b2),a
 *
 * THE RECORD IS A SEGMENT BETWEEN TWO POINTS. sub_0da7 converted (+1,+2) as
 * (y,x); this converts (+3,+4) as (y2,x2) -- H still holds y2 from 0x0DCC
 * and L is loaded here -- and calls the same converter. So one record yields
 * two tile addresses, 0x63AB and 0x63AD, and the deltas between them:
 *
 *   0x63B1 = |y2 - y|      (computed by the caller's sub/neg pair)
 *   0x63B2 = x2 - x        (signed here, adjusted below)
 *   0x63B0 = x2 & 7        sub-tile x of the second point
 *   0x63AD = tile address of (y2, x2)
 *
 * That is a line-segment primitive, which is what a playfield of girders and
 * ladders is built from.
 *
 * `jp p,0x0e4f` TESTS BIT 7 OF (A - 2) AND NOTHING ELSE.
 *
 * An earlier version of this comment said it "takes the branch when the
 * record kind is >= 2 (the subtraction not going negative)". That is FALSE,
 * and it is false in the specific way the same paragraph warned against:
 * "the subtraction not going negative" describes BORROW, which is the `jp nc`
 * condition, so the comment stated the misreading it was cautioning about.
 *
 * Enumerated over all 256 values of A:
 *
 *     jp p taken  <=>  0x02 <= A <= 0x81      (128 values)
 *     "A >= 2" disagrees on A = 0x82..0xFF    (126 values)
 *
 * For A in 0x82..0xFF the result lands in 0x80..0xFD, S is set, and the
 * branch is NOT taken even though A is >= 2 unsigned. `jp p` and `jp nc`
 * agree on 130 values and differ on 126 -- they DIVERGE, they do not invert,
 * which the old wording also got wrong.
 *
 * Nor is it a signed comparison: signed `A >= 2` is `S xor PV`, and at
 * A = 0x80 (-128) the `cp` sets PV, so signed semantics say no-branch while
 * `jp p` branches.
 *
 * WHY IT NEVERTHELESS BEHAVES LIKE "kind >= 2" ON LIVE DATA: the dispatch
 * chain downstream compares 0x63B3 against 0x02, 0x03, 0x04, 0x05 and 0x07,
 * and 0xAA was rejected as the terminator back at 0x0DAB -- so real kinds are
 * small and stay inside the range where the two readings coincide. That is a
 * property of the DATA, not of the instruction, and 0x0F1B uses the same
 * `cp n / jp p` idiom where a session generalising from the old wording would
 * get it wrong.
 *
 * The 0xF0 / 0x30 pair at 0x0E03 and 0x0E0A writes TWO tiles at consecutive
 * addresses: A then A-0x30 at the following cell. Those are tile codes, so
 * the -0x30 is selecting a different glyph for the second cell rather than
 * doing arithmetic on a coordinate.
 */
export function loc_0dd3(m) {
  const { regs, mem } = m;

  mem.write8(0x63b1, regs.a);
  m.step(0x0dd6, 13);
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0dd7, 6);
  regs.a = mem.read8(regs.de);
  m.step(0x0dd8, 7);
  regs.l = regs.a;
  m.step(0x0dd9, 4);
  regs.sub(regs.c);
  m.step(0x0dda, 4);
  mem.write8(0x63b2, regs.a);
  m.step(0x0ddd, 13);
  regs.a = mem.read8(regs.de);
  m.step(0x0dde, 7);
  regs.and(0x07);
  m.step(0x0de0, 7);
  mem.write8(0x63b0, regs.a);
  m.step(0x0de3, 13);

  m.push16(regs.de);
  m.step(0x0de4, 11);
  m.push16(0x0de7);
  m.step(0x2ff0, 17);
  m.call(0x2ff0);
  regs.de = m.pop16();
  m.step(0x0de8, 10);
  mem.write16(0x63ad, regs.hl);
  m.step(0x0deb, 16);

  regs.a = mem.read8(0x63b3);
  m.step(0x0dee, 13);
  regs.cp(0x02);
  m.step(0x0df0, 7);
  if (regs.fP) {
    m.step(0x0e4f, 10); // jp p taken -- record kind >= 2
    return m.call(0x0e4f);
  }
  m.step(0x0df3, 10);

  regs.a = mem.read8(0x63b2);
  m.step(0x0df6, 13);
  regs.sub(0x10);
  m.step(0x0df8, 7);
  regs.b = regs.a;
  m.step(0x0df9, 4);
  regs.a = mem.read8(0x63af);
  m.step(0x0dfc, 13);
  regs.add(regs.b);
  m.step(0x0dfd, 4);
  mem.write8(0x63b2, regs.a);
  m.step(0x0e00, 13);

  regs.a = mem.read8(0x63af);
  m.step(0x0e03, 13);
  regs.add(0xf0);
  m.step(0x0e05, 7);
  regs.hl = mem.read16(0x63ab);
  m.step(0x0e08, 16);
  mem.write8(regs.hl, regs.a);
  m.step(0x0e09, 7);
  regs.l = regs.inc8(regs.l); // `inc l`, NOT `inc hl` -- wraps within the page
  m.step(0x0e0a, 4);
  regs.sub(0x30);
  m.step(0x0e0c, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x0e0d, 7);

  regs.a = mem.read8(0x63b3);
  m.step(0x0e10, 13);
  regs.cp(0x01);
  m.step(0x0e12, 7);
  if (regs.fNZ) {
    m.step(0x0e19, 10); // jp nz taken
  } else {
    m.step(0x0e15, 10);
    regs.xor(regs.a);
    m.step(0x0e16, 4);
    mem.write8(0x63b2, regs.a);
    m.step(0x0e19, 13);
  }

  m.call(0x0e19);
}
