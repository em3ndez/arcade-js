// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_28ab  (ROM 0x28ab-0x29ac, The Pit) -- object/tile setup for the pointer at
 * 0x806e. Reads IX=(0x806e) (saved to 0x80ba), classifies the tile pair
 * (ix-1)=E, (ix+0)=D against the constants 0x70/0xc1/0x95/0xc5/0x2a, and from that
 * picks a sprite id -> 0x80bf, a sub-type -> 0x80c0, and a step count in B
 * (0x11/0x15/0x0d). It then fills the 0x80aa-0x80c0 placement/scratch block: X from
 * (0x8094)-4 -> 0x80b6, Y from (0x806b) (biased by (0x80a2)==4) rounded and minus B
 * -> 0x80b9, an attribute (0x80a3)<<1 -> 0x80bc. Unless a counter at 0x80bd is
 * already zero it just arms state 0x80b1=0x08 and returns; when 0x80bd rolls it
 * commits a second entity (0x80aa..0x80b1 fields), rewrites (ix-1)/(ix+0), and
 * remaps the neighbour tile at (ix-1)/(ix-2) through the 0x2dc3 tile-translation
 * table. (Role is best-effort from the code; the addresses, constants and control
 * flow are exact.)
 *
 * Every exit is a `ret` (there are no tail-jumps out of this routine), so the
 * forward-jump targets loc_28d9/loc_28e4/loc_28f3/loc_28f8/loc_28fa/loc_2934/
 * loc_298a/loc_299c/loc_29a9 are modelled as local closures reached by
 * `return loc_xxxx()`, not as ROM routines. Conditional `ret cc` = 11 T taken (pops)
 * / 5 T not taken; `jr cc` = 12 T taken / 7 T not taken; plain `ret` = 10 T.
 *
 *   28ab  dd 2a 6e 80  ld   ix,(0x806e)
 *   28af  dd 22 ba 80  ld   (0x80ba),ix
 *   28b3  06 11        ld   b,0x11
 *   28b5  2e 00        ld   l,0x00
 *   28b7  dd 5e ff     ld   e,(ix-0x01)
 *   28ba  dd 56 00     ld   d,(ix+0x00)
 *   28bd  3e 70        ld   a,0x70
 *   28bf  ba           cp   d
 *   28c0  20 22        jr   nz,0x28e4
 *   28c2  3e c1        ld   a,0xc1
 *   28c4  bb           cp   e
 *   28c5  28 12        jr   z,0x28d9
 *   28c7  3e 95        ld   a,0x95
 *   28c9  bb           cp   e
 *   28ca  28 0d        jr   z,0x28d9
 *   28cc  3e c5        ld   a,0xc5
 *   28ce  bb           cp   e
 *   28cf  c0           ret  nz
 *   28d0  3e 70        ld   a,0x70
 *   28d2  ba           cp   d
 *   28d3  c0           ret  nz
 *   28d4  06 15        ld   b,0x15
 *   28d6  2c           inc  l
 *   28d7  18 1f        jr   0x28f8
 * loc_28d9:
 *   28d9  dd 7e fe     ld   a,(ix-0x02)
 *   28dc  fe c1        cp   0xc1
 *   28de  20 18        jr   nz,0x28f8
 *   28e0  2e 02        ld   l,0x02
 *   28e2  18 14        jr   0x28f8
 * loc_28e4:
 *   28e4  06 0d        ld   b,0x0d
 *   28e6  3e c5        ld   a,0xc5
 *   28e8  ba           cp   d
 *   28e9  c0           ret  nz
 *   28ea  3e c1        ld   a,0xc1
 *   28ec  bb           cp   e
 *   28ed  20 04        jr   nz,0x28f3
 *   28ef  3e 9d        ld   a,0x9d
 *   28f1  18 07        jr   0x28fa
 * loc_28f3:
 *   28f3  3e 2a        ld   a,0x2a
 *   28f5  bb           cp   e
 *   28f6  28 02        jr   z,0x28fa
 * loc_28f8:
 *   28f8  3e 70        ld   a,0x70
 * loc_28fa:
 *   28fa  32 bf 80     ld   (0x80bf),a
 *   28fd  7d           ld   a,l
 *   28fe  32 c0 80     ld   (0x80c0),a
 *   2901  3a 94 80     ld   a,(0x8094)
 *   2904  d6 04        sub  0x04
 *   2906  32 b6 80     ld   (0x80b6),a
 *   2909  3a a2 80     ld   a,(0x80a2)
 *   290c  fe 04        cp   0x04
 *   290e  3a 6b 80     ld   a,(0x806b)
 *   2911  20 01        jr   nz,0x2914
 *   2913  3d           dec  a
 * loc_2914:
 *   2914  c6 05        add  a,0x05
 *   2916  e6 f8        and  0xf8
 *   2918  90           sub  b
 *   2919  32 b9 80     ld   (0x80b9),a
 *   291c  3a a3 80     ld   a,(0x80a3)
 *   291f  cb 27        sla  a
 *   2921  32 bc 80     ld   (0x80bc),a
 *   2924  3a bd 80     ld   a,(0x80bd)
 *   2927  3c           inc  a
 *   2928  32 bd 80     ld   (0x80bd),a
 *   292b  3d           dec  a
 *   292c  28 06        jr   z,0x2934
 *   292e  3e 08        ld   a,0x08
 *   2930  32 b1 80     ld   (0x80b1),a
 *   2933  c9           ret
 * loc_2934:
 *   2934  3e 30        ld   a,0x30
 *   2936  32 aa 80     ld   (0x80aa),a
 *   2939  3e 07        ld   a,0x07
 *   293b  32 ab 80     ld   (0x80ab),a
 *   293e  dd 2a ba 80  ld   ix,(0x80ba)
 *   2942  dd 22 af 80  ld   (0x80af),ix
 *   2946  3a b6 80     ld   a,(0x80b6)
 *   2949  32 a9 80     ld   (0x80a9),a
 *   294c  32 be 80     ld   (0x80be),a
 *   294f  3a b9 80     ld   a,(0x80b9)
 *   2952  32 ac 80     ld   (0x80ac),a
 *   2955  3a bc 80     ld   a,(0x80bc)
 *   2958  32 b1 80     ld   (0x80b1),a
 *   295b  dd 5e ff     ld   e,(ix-0x01)
 *   295e  3a bf 80     ld   a,(0x80bf)
 *   2961  dd 77 ff     ld   (ix-0x01),a
 *   2964  3e 70        ld   a,0x70
 *   2966  dd 77 00     ld   (ix+0x00),a
 *   2969  7b           ld   a,e
 *   296a  fe c1        cp   0xc1
 *   296c  28 1c        jr   z,0x298a
 *   296e  fe 95        cp   0x95
 *   2970  28 18        jr   z,0x298a
 *   2972  fe c5        cp   0xc5
 *   2974  28 14        jr   z,0x298a
 *   2976  fe 96        cp   0x96
 *   2978  d8           ret  c
 *   2979  fe 9a        cp   0x9a
 *   297b  d0           ret  nc
 *   297c  d6 96        sub  0x96
 *   297e  4f           ld   c,a
 *   297f  06 00        ld   b,0x00
 *   2981  21 c3 2d     ld   hl,0x2dc3
 *   2984  09           add  hl,bc
 *   2985  7e           ld   a,(hl)
 *   2986  dd 77 ff     ld   (ix-0x01),a
 *   2989  c9           ret
 * loc_298a:
 *   298a  3a c0 80     ld   a,(0x80c0)
 *   298d  b7           or   a
 *   298e  c8           ret  z
 *   298f  fe 02        cp   0x02
 *   2991  20 09        jr   nz,0x299c
 *   2993  3e 10        ld   a,0x10
 *   2995  32 b1 80     ld   (0x80b1),a
 *   2998  3e 70        ld   a,0x70
 *   299a  18 0d        jr   0x29a9
 * loc_299c:
 *   299c  dd 7e fe     ld   a,(ix-0x02)
 *   299f  d6 96        sub  0x96
 *   29a1  4f           ld   c,a
 *   29a2  06 00        ld   b,0x00
 *   29a4  21 c3 2d     ld   hl,0x2dc3
 *   29a7  09           add  hl,bc
 *   29a8  7e           ld   a,(hl)
 * loc_29a9:
 *   29a9  dd 77 fe     ld   (ix-0x02),a
 *   29ac  c9           ret
 */
export function loc_28ab(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // effective address for (ix+d)

  // loc_29a9: write the remapped/kept tile to (ix-0x02) and return.
  function loc_29a9() {
    // 29a9  ld (ix-0x02),a
    mem.write8(R(-0x02), regs.a);
    m.step(0x29ac, 19);
    // 29ac  ret
    m.ret(10);
  }

  // loc_298a: sub-type dispatch on (0x80c0) for the second-entity commit.
  function loc_298a() {
    // 298a  ld a,(0x80c0)
    regs.a = mem.read8(0x80c0);
    m.step(0x298d, 13);
    // 298d  or a
    regs.or(regs.a);
    m.step(0x298e, 4);
    // 298e  ret z
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x298f, 5); // ret z not taken
    // 298f  cp 0x02
    regs.cp(0x02);
    m.step(0x2991, 7);
    // 2991  jr nz,0x299c
    if (regs.fNZ) {
      m.step(0x299c, 12); // jr nz taken -> loc_299c
      // loc_299c:
      // 299c  ld a,(ix-0x02)
      regs.a = mem.read8(R(-0x02));
      m.step(0x299f, 19);
      // 299f  sub 0x96
      regs.sub(0x96);
      m.step(0x29a1, 7);
      // 29a1  ld c,a
      regs.c = regs.a;
      m.step(0x29a2, 4);
      // 29a2  ld b,0x00
      regs.b = 0x00;
      m.step(0x29a4, 7);
      // 29a4  ld hl,0x2dc3
      regs.hl = 0x2dc3;
      m.step(0x29a7, 10);
      // 29a7  add hl,bc
      regs.addHl(regs.bc);
      m.step(0x29a8, 11);
      // 29a8  ld a,(hl)
      regs.a = mem.read8(regs.hl);
      m.step(0x29a9, 7);
      return loc_29a9(); // fall through into loc_29a9
    }
    m.step(0x2993, 7); // jr nz not taken
    // 2993  ld a,0x10
    regs.a = 0x10;
    m.step(0x2995, 7);
    // 2995  ld (0x80b1),a
    mem.write8(0x80b1, regs.a);
    m.step(0x2998, 13);
    // 2998  ld a,0x70
    regs.a = 0x70;
    m.step(0x299a, 7);
    // 299a  jr 0x29a9
    m.step(0x29a9, 12);
    return loc_29a9();
  }

  // loc_2934: the second-entity commit path (0x80bd counter rolled to zero).
  function loc_2934() {
    // 2934  ld a,0x30
    regs.a = 0x30;
    m.step(0x2936, 7);
    // 2936  ld (0x80aa),a
    mem.write8(0x80aa, regs.a);
    m.step(0x2939, 13);
    // 2939  ld a,0x07
    regs.a = 0x07;
    m.step(0x293b, 7);
    // 293b  ld (0x80ab),a
    mem.write8(0x80ab, regs.a);
    m.step(0x293e, 13);
    // 293e  ld ix,(0x80ba)
    regs.ix = mem.read16(0x80ba);
    m.step(0x2942, 20);
    // 2942  ld (0x80af),ix
    mem.write16(0x80af, regs.ix);
    m.step(0x2946, 20);
    // 2946  ld a,(0x80b6)
    regs.a = mem.read8(0x80b6);
    m.step(0x2949, 13);
    // 2949  ld (0x80a9),a
    mem.write8(0x80a9, regs.a);
    m.step(0x294c, 13);
    // 294c  ld (0x80be),a
    mem.write8(0x80be, regs.a);
    m.step(0x294f, 13);
    // 294f  ld a,(0x80b9)
    regs.a = mem.read8(0x80b9);
    m.step(0x2952, 13);
    // 2952  ld (0x80ac),a
    mem.write8(0x80ac, regs.a);
    m.step(0x2955, 13);
    // 2955  ld a,(0x80bc)
    regs.a = mem.read8(0x80bc);
    m.step(0x2958, 13);
    // 2958  ld (0x80b1),a
    mem.write8(0x80b1, regs.a);
    m.step(0x295b, 13);
    // 295b  ld e,(ix-0x01) -- OLD (ix-1), read BEFORE the overwrite two lines down
    regs.e = mem.read8(R(-0x01));
    m.step(0x295e, 19);
    // 295e  ld a,(0x80bf)
    regs.a = mem.read8(0x80bf);
    m.step(0x2961, 13);
    // 2961  ld (ix-0x01),a
    mem.write8(R(-0x01), regs.a);
    m.step(0x2964, 19);
    // 2964  ld a,0x70
    regs.a = 0x70;
    m.step(0x2966, 7);
    // 2966  ld (ix+0x00),a
    mem.write8(R(0x00), regs.a);
    m.step(0x2969, 19);
    // 2969  ld a,e
    regs.a = regs.e;
    m.step(0x296a, 4);
    // 296a  cp 0xc1
    regs.cp(0xc1);
    m.step(0x296c, 7);
    // 296c  jr z,0x298a
    if (regs.fZ) { m.step(0x298a, 12); return loc_298a(); }
    m.step(0x296e, 7); // jr z not taken
    // 296e  cp 0x95
    regs.cp(0x95);
    m.step(0x2970, 7);
    // 2970  jr z,0x298a
    if (regs.fZ) { m.step(0x298a, 12); return loc_298a(); }
    m.step(0x2972, 7); // jr z not taken
    // 2972  cp 0xc5
    regs.cp(0xc5);
    m.step(0x2974, 7);
    // 2974  jr z,0x298a
    if (regs.fZ) { m.step(0x298a, 12); return loc_298a(); }
    m.step(0x2976, 7); // jr z not taken
    // 2976  cp 0x96
    regs.cp(0x96);
    m.step(0x2978, 7);
    // 2978  ret c -- neighbour tile below 0x96, keep it as-is
    if (regs.fC) { m.ret(11); return; }
    m.step(0x2979, 5); // ret c not taken
    // 2979  cp 0x9a
    regs.cp(0x9a);
    m.step(0x297b, 7);
    // 297b  ret nc -- neighbour tile 0x9a or above, keep it as-is
    if (regs.fNC) { m.ret(11); return; }
    m.step(0x297c, 5); // ret nc not taken
    // 297c  sub 0x96 -- index 0..3 into the 0x2dc3 tile-translation table
    regs.sub(0x96);
    m.step(0x297e, 7);
    // 297e  ld c,a
    regs.c = regs.a;
    m.step(0x297f, 4);
    // 297f  ld b,0x00
    regs.b = 0x00;
    m.step(0x2981, 7);
    // 2981  ld hl,0x2dc3
    regs.hl = 0x2dc3;
    m.step(0x2984, 10);
    // 2984  add hl,bc
    regs.addHl(regs.bc);
    m.step(0x2985, 11);
    // 2985  ld a,(hl)
    regs.a = mem.read8(regs.hl);
    m.step(0x2986, 7);
    // 2986  ld (ix-0x01),a
    mem.write8(R(-0x01), regs.a);
    m.step(0x2989, 19);
    // 2989  ret
    m.ret(10);
  }

  // loc_28fa: the shared placement/scratch fill (entered with A = sprite id, L = sub-type).
  function loc_28fa() {
    // 28fa  ld (0x80bf),a
    mem.write8(0x80bf, regs.a);
    m.step(0x28fd, 13);
    // 28fd  ld a,l
    regs.a = regs.l;
    m.step(0x28fe, 4);
    // 28fe  ld (0x80c0),a
    mem.write8(0x80c0, regs.a);
    m.step(0x2901, 13);
    // 2901  ld a,(0x8094)
    regs.a = mem.read8(0x8094);
    m.step(0x2904, 13);
    // 2904  sub 0x04
    regs.sub(0x04);
    m.step(0x2906, 7);
    // 2906  ld (0x80b6),a
    mem.write8(0x80b6, regs.a);
    m.step(0x2909, 13);
    // 2909  ld a,(0x80a2)
    regs.a = mem.read8(0x80a2);
    m.step(0x290c, 13);
    // 290c  cp 0x04 -- sets the flag the jr nz below tests
    regs.cp(0x04);
    m.step(0x290e, 7);
    // 290e  ld a,(0x806b) -- a plain load; leaves the cp 0x04 flags intact
    regs.a = mem.read8(0x806b);
    m.step(0x2911, 13);
    // 2911  jr nz,0x2914
    if (regs.fNZ) {
      m.step(0x2914, 12); // jr nz taken -> skip the dec a
    } else {
      m.step(0x2913, 7); // jr nz not taken
      // 2913  dec a -- bias Y by one when (0x80a2) == 4
      regs.a = regs.dec8(regs.a);
      m.step(0x2914, 4);
    }
    // loc_2914:
    // 2914  add a,0x05
    regs.add(0x05);
    m.step(0x2916, 7);
    // 2916  and 0xf8
    regs.and(0xf8);
    m.step(0x2918, 7);
    // 2918  sub b -- subtract the step count selected during classification
    regs.sub(regs.b);
    m.step(0x2919, 4);
    // 2919  ld (0x80b9),a
    mem.write8(0x80b9, regs.a);
    m.step(0x291c, 13);
    // 291c  ld a,(0x80a3)
    regs.a = mem.read8(0x80a3);
    m.step(0x291f, 13);
    // 291f  sla a
    regs.a = regs.sla(regs.a);
    m.step(0x2921, 8);
    // 2921  ld (0x80bc),a
    mem.write8(0x80bc, regs.a);
    m.step(0x2924, 13);
    // 2924  ld a,(0x80bd)
    regs.a = mem.read8(0x80bd);
    m.step(0x2927, 13);
    // 2927  inc a
    regs.a = regs.inc8(regs.a);
    m.step(0x2928, 4);
    // 2928  ld (0x80bd),a
    mem.write8(0x80bd, regs.a);
    m.step(0x292b, 13);
    // 292b  dec a -- Z reflects whether the ORIGINAL (0x80bd) was zero
    regs.a = regs.dec8(regs.a);
    m.step(0x292c, 4);
    // 292c  jr z,0x2934
    if (regs.fZ) { m.step(0x2934, 12); return loc_2934(); }
    m.step(0x292e, 7); // jr z not taken
    // 292e  ld a,0x08
    regs.a = 0x08;
    m.step(0x2930, 7);
    // 2930  ld (0x80b1),a
    mem.write8(0x80b1, regs.a);
    m.step(0x2933, 13);
    // 2933  ret
    m.ret(10);
  }

  // loc_28f8: default sprite id 0x70, then fall into loc_28fa.
  function loc_28f8() {
    // 28f8  ld a,0x70
    regs.a = 0x70;
    m.step(0x28fa, 7);
    return loc_28fa();
  }

  // loc_28f3: from loc_28e4, an alternate 0x2a-tile check.
  function loc_28f3() {
    // 28f3  ld a,0x2a
    regs.a = 0x2a;
    m.step(0x28f5, 7);
    // 28f5  cp e
    regs.cp(regs.e);
    m.step(0x28f6, 4);
    // 28f6  jr z,0x28fa -- keep A = 0x2a as the sprite id
    if (regs.fZ) { m.step(0x28fa, 12); return loc_28fa(); }
    m.step(0x28f8, 7); // jr z not taken -> falls into loc_28f8
    return loc_28f8();
  }

  // loc_28e4: the D != 0x70 classification branch (step count B = 0x0d).
  function loc_28e4() {
    // 28e4  ld b,0x0d
    regs.b = 0x0d;
    m.step(0x28e6, 7);
    // 28e6  ld a,0xc5
    regs.a = 0xc5;
    m.step(0x28e8, 7);
    // 28e8  cp d
    regs.cp(regs.d);
    m.step(0x28e9, 4);
    // 28e9  ret nz -- D neither 0x70 nor 0xc5: nothing to place
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x28ea, 5); // ret nz not taken
    // 28ea  ld a,0xc1
    regs.a = 0xc1;
    m.step(0x28ec, 7);
    // 28ec  cp e
    regs.cp(regs.e);
    m.step(0x28ed, 4);
    // 28ed  jr nz,0x28f3
    if (regs.fNZ) { m.step(0x28f3, 12); return loc_28f3(); }
    m.step(0x28ef, 7); // jr nz not taken
    // 28ef  ld a,0x9d -- sprite id 0x9d
    regs.a = 0x9d;
    m.step(0x28f1, 7);
    // 28f1  jr 0x28fa
    m.step(0x28fa, 12);
    return loc_28fa();
  }

  // loc_28d9: from the D == 0x70 branch, refine the sub-type from (ix-0x02).
  function loc_28d9() {
    // 28d9  ld a,(ix-0x02)
    regs.a = mem.read8(R(-0x02));
    m.step(0x28dc, 19);
    // 28dc  cp 0xc1
    regs.cp(0xc1);
    m.step(0x28de, 7);
    // 28de  jr nz,0x28f8
    if (regs.fNZ) { m.step(0x28f8, 12); return loc_28f8(); }
    m.step(0x28e0, 7); // jr nz not taken
    // 28e0  ld l,0x02 -- sub-type 2
    regs.l = 0x02;
    m.step(0x28e2, 7);
    // 28e2  jr 0x28f8
    m.step(0x28f8, 12);
    return loc_28f8();
  }

  // ===== entry (loc_28ab) =====
  // 28ab  ld ix,(0x806e)
  regs.ix = mem.read16(0x806e);
  m.step(0x28af, 20);
  // 28af  ld (0x80ba),ix
  mem.write16(0x80ba, regs.ix);
  m.step(0x28b3, 20);
  // 28b3  ld b,0x11
  regs.b = 0x11;
  m.step(0x28b5, 7);
  // 28b5  ld l,0x00
  regs.l = 0x00;
  m.step(0x28b7, 7);
  // 28b7  ld e,(ix-0x01)
  regs.e = mem.read8(R(-0x01));
  m.step(0x28ba, 19);
  // 28ba  ld d,(ix+0x00)
  regs.d = mem.read8(R(0x00));
  m.step(0x28bd, 19);
  // 28bd  ld a,0x70
  regs.a = 0x70;
  m.step(0x28bf, 7);
  // 28bf  cp d
  regs.cp(regs.d);
  m.step(0x28c0, 4);
  // 28c0  jr nz,0x28e4
  if (regs.fNZ) { m.step(0x28e4, 12); return loc_28e4(); }
  m.step(0x28c2, 7); // jr nz not taken
  // 28c2  ld a,0xc1
  regs.a = 0xc1;
  m.step(0x28c4, 7);
  // 28c4  cp e
  regs.cp(regs.e);
  m.step(0x28c5, 4);
  // 28c5  jr z,0x28d9
  if (regs.fZ) { m.step(0x28d9, 12); return loc_28d9(); }
  m.step(0x28c7, 7); // jr z not taken
  // 28c7  ld a,0x95
  regs.a = 0x95;
  m.step(0x28c9, 7);
  // 28c9  cp e
  regs.cp(regs.e);
  m.step(0x28ca, 4);
  // 28ca  jr z,0x28d9
  if (regs.fZ) { m.step(0x28d9, 12); return loc_28d9(); }
  m.step(0x28cc, 7); // jr z not taken
  // 28cc  ld a,0xc5
  regs.a = 0xc5;
  m.step(0x28ce, 7);
  // 28ce  cp e
  regs.cp(regs.e);
  m.step(0x28cf, 4);
  // 28cf  ret nz -- E is none of 0xc1/0x95/0xc5: nothing to place
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x28d0, 5); // ret nz not taken
  // 28d0  ld a,0x70
  regs.a = 0x70;
  m.step(0x28d2, 7);
  // 28d2  cp d
  regs.cp(regs.d);
  m.step(0x28d3, 4);
  // 28d3  ret nz -- (dead in practice: D is 0x70 on this arm, but modelled faithfully)
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x28d4, 5); // ret nz not taken
  // 28d4  ld b,0x15
  regs.b = 0x15;
  m.step(0x28d6, 7);
  // 28d6  inc l
  regs.l = regs.inc8(regs.l);
  m.step(0x28d7, 4);
  // 28d7  jr 0x28f8
  m.step(0x28f8, 12);
  return loc_28f8();
}
