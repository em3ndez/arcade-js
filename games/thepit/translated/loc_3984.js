// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3984  (ROM 0x3984-0x3a12, The Pit) -- one-shot spawn/init of a two-record
 * actor, gated on a "spawn requested" flag at 0x810d. A sibling of loc_37cf's
 * alt-phase spawn: both stamp an 8-cell tile block into video+colour RAM and seed
 * a fixed set of object fields, then tail-jump to the shared 0x3a4c epilogue.
 *
 * Behaviour:
 *   - Read the request flag 0x810d and `and a`. If it is zero this frame's spawn
 *     was not requested -> `ret z`, straight back to the caller (no draw, no seed).
 *   - Otherwise clear the request flag 0x810d and its twin mirror 0x811e to 0.
 *   - Draw an 8-cell block: tiles 0xa8..0xaf (A starts 0xa8, `inc a` between the
 *     pairs) into video RAM via IX=0x90e4, and the constant colour 0x93 (B) into
 *     colour RAM via IY=0x88e4, at the eight (ix/iy + d) offsets -0x60,-0x5f,
 *     -0x40,-0x3f,-0x20,-0x1f,+0x00,+0x01 -- a 4-row x 2-col object (rows a stride
 *     of 0x20 apart, i.e. one tilemap row).
 *   - Seed the PRIMARY record at 0x810a and its TWIN at 0x811b (the two 17-byte
 *     actor records loc_3a13 block-copies): tile 0x810b/0x811c = 0x09; coordinate
 *     /state bytes 0x810a,0x811b,0x810c,0x811d,0x8117,0x8128 = 0; timer 0x8112/
 *     0x8123 = 0xb4; 0x811a = 0x06, twin 0x812b = 0x07 (twin is +1 here). Finally
 *     0x8118/0x8129 = 0x07 - ((0x8028) & 0x06) -- a start value derived from the
 *     low bits of 0x8028.
 *   - Tail-jump to 0x3a4c (its `ret` returns to OUR caller; no `ret` of our own).
 *
 * FLAGS: `and a` (0x3987) sets the Z that `ret z` (0x3988) reads immediately; the
 * `inc a` between the draw pairs advances the tile byte and its flags are unused;
 * `and 0x06` / `ld b,a` / `sub b` (0x3a04-0x3a09) compute 0x07-(0x8028&6) and only
 * the value is consumed. Every write lands in work / video / colour RAM (none is a
 * hardware address 0xb000-0xb007 / 0xb800), so none carries a write-bus offset.
 * The closing `jp 0x3a4c` is a TAIL-jump, modelled `return m.call(0x3a4c)` with no
 * trailing m.ret. Role is best-effort from the code; addresses, flags, cycle costs
 * and control flow are exact, one JS statement per Z80 instruction.
 *
 * loc_3984:
 *   3984  3a 0d 81     ld   a,(0x810d)
 *   3987  a7           and  a
 *   3988  c8           ret  z
 *   3989  3e 00        ld   a,0x00
 *   398b  32 0d 81     ld   (0x810d),a
 *   398e  32 1e 81     ld   (0x811e),a
 *   3991  dd 21 e4 90  ld   ix,0x90e4
 *   3995  fd 21 e4 88  ld   iy,0x88e4
 *   3999  06 93        ld   b,0x93
 *   399b  3e a8        ld   a,0xa8
 *   399d  dd 77 a0     ld   (ix-0x60),a
 *   39a0  fd 70 a0     ld   (iy-0x60),b
 *   39a3  3c           inc  a
 *   39a4  dd 77 a1     ld   (ix-0x5f),a
 *   39a7  fd 70 a1     ld   (iy-0x5f),b
 *   39aa  3c           inc  a
 *   39ab  dd 77 c0     ld   (ix-0x40),a
 *   39ae  fd 70 c0     ld   (iy-0x40),b
 *   39b1  3c           inc  a
 *   39b2  dd 77 c1     ld   (ix-0x3f),a
 *   39b5  fd 70 c1     ld   (iy-0x3f),b
 *   39b8  3c           inc  a
 *   39b9  dd 77 e0     ld   (ix-0x20),a
 *   39bc  fd 70 e0     ld   (iy-0x20),b
 *   39bf  3c           inc  a
 *   39c0  dd 77 e1     ld   (ix-0x1f),a
 *   39c3  fd 70 e1     ld   (iy-0x1f),b
 *   39c6  3c           inc  a
 *   39c7  dd 77 00     ld   (ix+0x00),a
 *   39ca  fd 70 00     ld   (iy+0x00),b
 *   39cd  3c           inc  a
 *   39ce  dd 77 01     ld   (ix+0x01),a
 *   39d1  fd 70 01     ld   (iy+0x01),b
 *   39d4  3e 09        ld   a,0x09
 *   39d6  32 0b 81     ld   (0x810b),a
 *   39d9  32 1c 81     ld   (0x811c),a
 *   39dc  3e 00        ld   a,0x00
 *   39de  32 0a 81     ld   (0x810a),a
 *   39e1  32 1b 81     ld   (0x811b),a
 *   39e4  32 0c 81     ld   (0x810c),a
 *   39e7  32 1d 81     ld   (0x811d),a
 *   39ea  32 17 81     ld   (0x8117),a
 *   39ed  32 28 81     ld   (0x8128),a
 *   39f0  3e b4        ld   a,0xb4
 *   39f2  32 12 81     ld   (0x8112),a
 *   39f5  32 23 81     ld   (0x8123),a
 *   39f8  3e 06        ld   a,0x06
 *   39fa  32 1a 81     ld   (0x811a),a
 *   39fd  3c           inc  a
 *   39fe  32 2b 81     ld   (0x812b),a
 *   3a01  3a 28 80     ld   a,(0x8028)
 *   3a04  e6 06        and  0x06
 *   3a06  47           ld   b,a
 *   3a07  3e 07        ld   a,0x07
 *   3a09  90           sub  b
 *   3a0a  32 18 81     ld   (0x8118),a
 *   3a0d  32 29 81     ld   (0x8129),a
 *   3a10  c3 4c 3a     jp   0x3a4c
 */
export function loc_3984(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x810d); m.step(0x3987, 13); // 3984  ld a,(0x810d) -- spawn "requested" flag
  regs.and(regs.a); m.step(0x3988, 4);            // 3987  and a -- set Z iff the flag is 0
  if (regs.fZ) { m.ret(11); return; }             // 3988  ret z -- not requested this frame -> return to caller
  m.step(0x3989, 5);                              // 3988  ret z (not taken)

  regs.a = 0x00; m.step(0x398b, 7);               // 3989  ld a,0x00 (no flags)
  mem.write8(0x810d, regs.a); m.step(0x398e, 13); // 398b  ld (0x810d),a -- clear the request flag
  mem.write8(0x811e, regs.a); m.step(0x3991, 13); // 398e  ld (0x811e),a -- clear its twin mirror
  regs.ix = 0x90e4; m.step(0x3995, 14);           // 3991  ld ix,0x90e4 -- video RAM cursor
  regs.iy = 0x88e4; m.step(0x3999, 14);           // 3995  ld iy,0x88e4 -- colour RAM cursor
  regs.b = 0x93; m.step(0x399b, 7);               // 3999  ld b,0x93 -- colour byte for every cell
  regs.a = 0xa8; m.step(0x399d, 7);               // 399b  ld a,0xa8 -- first tile byte

  mem.write8((regs.ix - 0x60) & 0xffff, regs.a); m.step(0x39a0, 19); // 399d  ld (ix-0x60),a -- tile 0xa8
  mem.write8((regs.iy - 0x60) & 0xffff, regs.b); m.step(0x39a3, 19); // 39a0  ld (iy-0x60),b
  regs.a = regs.inc8(regs.a); m.step(0x39a4, 4);                     // 39a3  inc a -- 0xa9
  mem.write8((regs.ix - 0x5f) & 0xffff, regs.a); m.step(0x39a7, 19); // 39a4  ld (ix-0x5f),a -- tile 0xa9
  mem.write8((regs.iy - 0x5f) & 0xffff, regs.b); m.step(0x39aa, 19); // 39a7  ld (iy-0x5f),b
  regs.a = regs.inc8(regs.a); m.step(0x39ab, 4);                     // 39aa  inc a -- 0xaa
  mem.write8((regs.ix - 0x40) & 0xffff, regs.a); m.step(0x39ae, 19); // 39ab  ld (ix-0x40),a -- tile 0xaa
  mem.write8((regs.iy - 0x40) & 0xffff, regs.b); m.step(0x39b1, 19); // 39ae  ld (iy-0x40),b
  regs.a = regs.inc8(regs.a); m.step(0x39b2, 4);                     // 39b1  inc a -- 0xab
  mem.write8((regs.ix - 0x3f) & 0xffff, regs.a); m.step(0x39b5, 19); // 39b2  ld (ix-0x3f),a -- tile 0xab
  mem.write8((regs.iy - 0x3f) & 0xffff, regs.b); m.step(0x39b8, 19); // 39b5  ld (iy-0x3f),b
  regs.a = regs.inc8(regs.a); m.step(0x39b9, 4);                     // 39b8  inc a -- 0xac
  mem.write8((regs.ix - 0x20) & 0xffff, regs.a); m.step(0x39bc, 19); // 39b9  ld (ix-0x20),a -- tile 0xac
  mem.write8((regs.iy - 0x20) & 0xffff, regs.b); m.step(0x39bf, 19); // 39bc  ld (iy-0x20),b
  regs.a = regs.inc8(regs.a); m.step(0x39c0, 4);                     // 39bf  inc a -- 0xad
  mem.write8((regs.ix - 0x1f) & 0xffff, regs.a); m.step(0x39c3, 19); // 39c0  ld (ix-0x1f),a -- tile 0xad
  mem.write8((regs.iy - 0x1f) & 0xffff, regs.b); m.step(0x39c6, 19); // 39c3  ld (iy-0x1f),b
  regs.a = regs.inc8(regs.a); m.step(0x39c7, 4);                     // 39c6  inc a -- 0xae
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x39ca, 19); // 39c7  ld (ix+0x00),a -- tile 0xae
  mem.write8((regs.iy + 0x00) & 0xffff, regs.b); m.step(0x39cd, 19); // 39ca  ld (iy+0x00),b
  regs.a = regs.inc8(regs.a); m.step(0x39ce, 4);                     // 39cd  inc a -- 0xaf
  mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x39d1, 19); // 39ce  ld (ix+0x01),a -- tile 0xaf
  mem.write8((regs.iy + 0x01) & 0xffff, regs.b); m.step(0x39d4, 19); // 39d1  ld (iy+0x01),b

  regs.a = 0x09; m.step(0x39d6, 7);               // 39d4  ld a,0x09
  mem.write8(0x810b, regs.a); m.step(0x39d9, 13); // 39d6  ld (0x810b),a -- primary tile field
  mem.write8(0x811c, regs.a); m.step(0x39dc, 13); // 39d9  ld (0x811c),a -- twin tile field
  regs.a = 0x00; m.step(0x39de, 7);               // 39dc  ld a,0x00 (no flags)
  mem.write8(0x810a, regs.a); m.step(0x39e1, 13); // 39de  ld (0x810a),a -- primary X/coord
  mem.write8(0x811b, regs.a); m.step(0x39e4, 13); // 39e1  ld (0x811b),a -- twin X/coord
  mem.write8(0x810c, regs.a); m.step(0x39e7, 13); // 39e4  ld (0x810c),a
  mem.write8(0x811d, regs.a); m.step(0x39ea, 13); // 39e7  ld (0x811d),a
  mem.write8(0x8117, regs.a); m.step(0x39ed, 13); // 39ea  ld (0x8117),a
  mem.write8(0x8128, regs.a); m.step(0x39f0, 13); // 39ed  ld (0x8128),a
  regs.a = 0xb4; m.step(0x39f2, 7);               // 39f0  ld a,0xb4
  mem.write8(0x8112, regs.a); m.step(0x39f5, 13); // 39f2  ld (0x8112),a -- primary timer
  mem.write8(0x8123, regs.a); m.step(0x39f8, 13); // 39f5  ld (0x8123),a -- twin timer
  regs.a = 0x06; m.step(0x39fa, 7);               // 39f8  ld a,0x06
  mem.write8(0x811a, regs.a); m.step(0x39fd, 13); // 39fa  ld (0x811a),a -- primary field = 0x06
  regs.a = regs.inc8(regs.a); m.step(0x39fe, 4);  // 39fd  inc a -- 0x07
  mem.write8(0x812b, regs.a); m.step(0x3a01, 13); // 39fe  ld (0x812b),a -- twin field = 0x07 (+1)
  regs.a = mem.read8(0x8028); m.step(0x3a04, 13); // 3a01  ld a,(0x8028)
  regs.and(0x06); m.step(0x3a06, 7);              // 3a04  and 0x06 -- keep bits 1..2
  regs.b = regs.a; m.step(0x3a07, 4);             // 3a06  ld b,a
  regs.a = 0x07; m.step(0x3a09, 7);               // 3a07  ld a,0x07
  regs.sub(regs.b); m.step(0x3a0a, 4);            // 3a09  sub b -- A = 0x07 - (0x8028 & 0x06)
  mem.write8(0x8118, regs.a); m.step(0x3a0d, 13); // 3a0a  ld (0x8118),a -- primary start value
  mem.write8(0x8129, regs.a); m.step(0x3a10, 13); // 3a0d  ld (0x8129),a -- twin start value
  m.step(0x3a4c, 10); return m.call(0x3a4c);      // 3a10  jp 0x3a4c (tail out; loc_3a4c's ret -> our caller)
}
