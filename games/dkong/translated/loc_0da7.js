// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0da7  (ROM 0x0DA7–0x0DD1) — walks a segment table at DE (>=5 bytes/record, 0xAA-terminated), converting two corners per record.
 *
 *   0da7  1a           ld   a,(de)
 *   0da8  32 b3 63     ld   (0x63b3),a
 *   0dab  fe aa        cp   0xaa
 *   0dad  c8           ret  z
 *   0dae  13           inc  de
 *   0daf  1a           ld   a,(de)
 *   0db0  67           ld   h,a
 *   0db1  44           ld   b,h
 *   0db2  13           inc  de
 *   0db3  1a           ld   a,(de)
 *   0db4  6f           ld   l,a
 *   0db5  4d           ld   c,l
 *   0db6  d5           push de
 *   0db7  cd f0 2f     call 0x2ff0
 *   0dba  d1           pop  de
 *   0dbb  22 ab 63     ld   (0x63ab),hl
 *   0dbe  78           ld   a,b
 *   0dbf  e6 07        and  0x07
 *   0dc1  32 b4 63     ld   (0x63b4),a
 *   0dc4  79           ld   a,c
 *   0dc5  e6 07        and  0x07
 *   0dc7  32 af 63     ld   (0x63af),a
 *   0dca  13           inc  de
 *   0dcb  1a           ld   a,(de)
 *   0dcc  67           ld   h,a
 *   0dcd  90           sub  b
 *   0dce  d2 d3 0d     jp   nc,0x0dd3
 *   0dd1  ed 44        neg
 *
 * Walks a table pointed at by DE, AT LEAST FIVE bytes per record, terminated
 * by a leading 0xAA. Record layout as the code uses it:
 *
 *   +0  kind / terminator   -> stashed at 0x63B3, 0xAA ends the walk
 *   +1  y in pixels         -> H and B
 *   +2  x in pixels         -> L and C
 *   +3  a second y          -> H, then A = |(+3) - y|
 *   +4  a second x          -> read at 0x0DD6, paired with +3, x&7 to 0x63B0
 *
 * The +4 byte is read by the continuation at loc_0dd3, which is why this
 * said "four bytes per record" until review: the count was taken from the
 * instructions translated so far rather than from the record. So the pair
 * (+3,+4) is a SECOND point, and this routine is converting two corners.
 *
 * `push de / call 0x2FF0 / pop de` preserves the table pointer across the
 * address conversion, which clobbers HL. The converted VRAM address is
 * stashed whole at 0x63AB with `ld (nn),hl`.
 *
 * THE `and 0x07` PAIR IS THE SUB-TILE REMAINDER. sub_2ff0 divides both
 * coordinates by 8 to get a tile address and discards the low three bits;
 * this saves those bits separately -- y&7 at 0x63B4, x&7 at 0x63AF. So the
 * caller keeps both the tile the point falls in AND its offset within that
 * tile, from one conversion.
 *
 * `sub b / jp nc / neg` is an ABSOLUTE DIFFERENCE: A = |(+3) - y|. The `neg`
 * runs only on the borrow path, so the result is unsigned either way -- a
 * length or extent, not a signed delta.
 */
export function loc_0da7(m) {
  const { regs, mem } = m;

  // A LOOP, because the chain closes: loc_0e4b ends `inc de / jp 0x0da7`,
  // returning here for the next record. Translating that tail jump as a JS
  // call would recurse once per table entry and grow a frame per record for
  // a walk the ROM does with flat stack depth.
  for (;;) {
  regs.a = mem.read8(regs.de);
  m.step(0x0da8, 7);
  mem.write8(0x63b3, regs.a);
  m.step(0x0dab, 13);
  regs.cp(0xaa);
  m.step(0x0dad, 7);
  if (regs.fZ) {
    m.ret(11); // ret z taken -- 0xAA terminator, walk ends
    return;
  }
  m.step(0x0dae, 5);

  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0daf, 6);
  regs.a = mem.read8(regs.de);
  m.step(0x0db0, 7);
  regs.h = regs.a;
  m.step(0x0db1, 4);
  regs.b = regs.h;
  m.step(0x0db2, 4);
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0db3, 6);
  regs.a = mem.read8(regs.de);
  m.step(0x0db4, 7);
  regs.l = regs.a;
  m.step(0x0db5, 4);
  regs.c = regs.l;
  m.step(0x0db6, 4);

  m.push16(regs.de);
  m.step(0x0db7, 11);
  m.push16(0x0dba);
  m.step(0x2ff0, 17);
  m.call(0x2ff0);
  regs.de = m.pop16();
  m.step(0x0dbb, 10);

  mem.write16(0x63ab, regs.hl);
  m.step(0x0dbe, 16);
  regs.a = regs.b;
  m.step(0x0dbf, 4);
  regs.and(0x07);
  m.step(0x0dc1, 7);
  mem.write8(0x63b4, regs.a);
  m.step(0x0dc4, 13);
  regs.a = regs.c;
  m.step(0x0dc5, 4);
  regs.and(0x07);
  m.step(0x0dc7, 7);
  mem.write8(0x63af, regs.a);
  m.step(0x0dca, 13);

  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0dcb, 6);
  regs.a = mem.read8(regs.de);
  m.step(0x0dcc, 7);
  regs.h = regs.a;
  m.step(0x0dcd, 4);
  regs.sub(regs.b);
  m.step(0x0dce, 4);
  if (regs.fNC) {
    m.step(0x0dd3, 10); // jp nc taken
  } else {
    m.step(0x0dd1, 10); // jp nc not taken -- `jp cc` is 10 either way
    regs.neg();
    m.step(0x0dd3, 8); // neg is ED-prefixed
  }

  m.call(0x0dd3); // returns having reached loc_0e4b's `jp 0x0da7`
  }
}
