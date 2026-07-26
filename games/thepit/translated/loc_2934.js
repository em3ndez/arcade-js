// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2934  (ROM 0x2934-0x29ac, The Pit) -- the second-entity commit path, entered
 * once the projectile/spawn counter 0x80bd has rolled to zero (from loc_28ab's
 * `jr z,0x2934` and from loc_29ad's `jp nz,0x2934` tail-jump). It fills the
 * 0x80aa-0x80b1 placement block for the committed entity: state 0x80aa=0x30 and
 * 0x80ab=0x07; reloads the saved object pointer IX from 0x80ba into 0x80af; copies
 * the placement scratch built earlier -- (0x80b6)->0x80a9 and 0x80be, (0x80b9)->
 * 0x80ac, (0x80bc)->0x80b1. It captures the OLD neighbour tile (ix-0x01) into E,
 * then overwrites (ix-0x01) with the sprite id (0x80bf) and (ix+0x00) with 0x70.
 * Finally it classifies the captured E:
 *   E in {0xc1,0x95,0xc5}  -> loc_298a (sub-type dispatch on 0x80c0)
 *   E < 0x96 or E >= 0x9a  -> ret, leaving (ix-0x01) as the just-written sprite id
 *   0x96 <= E <= 0x99      -> remap E-0x96 through the 0x2dc3 tile-translation table
 *                            into (ix-0x01), then ret
 * loc_298a dispatches on the sub-type (0x80c0): 0 -> ret; 2 -> arm 0x80b1=0x10 and
 * write tile 0x70 to (ix-0x02); otherwise remap (ix-0x02)-0x96 through the 0x2dc3
 * table into (ix-0x02). (Role is best-effort from the code; the addresses,
 * constants and control flow are exact.)
 *
 * The forward-jump targets loc_298a/loc_299c/loc_29a9 are reached only from within
 * this routine, so they are modelled as local closures reached by `return
 * loc_xxxx()`, not as separate ROM routines. Every exit is a `ret` (there are no
 * tail-jumps out), so each terminal `ret`/`ret c`/`ret nc`/`ret z` is `m.ret(...)`.
 * Conditional `ret cc` = 11 T taken (pops) / 5 T not taken; `jr cc` = 12 T taken /
 * 7 T not taken; unconditional `jr` = 12 T; plain `ret` = 10 T.
 *
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
export function loc_2934(m) {
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

  // loc_298a: sub-type dispatch on (0x80c0) for the second-entity commit --
  // 0 -> ret; 2 -> arm 0x80b1=0x10 + tile 0x70; else remap (ix-0x02) via 0x2dc3.
  function loc_298a() {
    // 298a  ld a,(0x80c0)
    regs.a = mem.read8(0x80c0);
    m.step(0x298d, 13);
    // 298d  or a
    regs.or(regs.a);
    m.step(0x298e, 4);
    // 298e  ret z -- sub-type 0: nothing more to commit
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
      // 299f  sub 0x96 -- index into the 0x2dc3 tile-translation table
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
    // 2995  ld (0x80b1),a -- arm state 0x10 for the sub-type-2 entity
    mem.write8(0x80b1, regs.a);
    m.step(0x2998, 13);
    // 2998  ld a,0x70
    regs.a = 0x70;
    m.step(0x299a, 7);
    // 299a  jr 0x29a9 -- write tile 0x70 to (ix-0x02)
    m.step(0x29a9, 12);
    return loc_29a9();
  }

  // ===== entry (loc_2934) =====
  // 2934  ld a,0x30
  regs.a = 0x30;
  m.step(0x2936, 7);
  // 2936  ld (0x80aa),a -- commit state 0x30
  mem.write8(0x80aa, regs.a);
  m.step(0x2939, 13);
  // 2939  ld a,0x07
  regs.a = 0x07;
  m.step(0x293b, 7);
  // 293b  ld (0x80ab),a
  mem.write8(0x80ab, regs.a);
  m.step(0x293e, 13);
  // 293e  ld ix,(0x80ba) -- reload the saved object pointer
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
  // 295b  ld e,(ix-0x01) -- OLD neighbour tile, captured BEFORE the overwrite below
  regs.e = mem.read8(R(-0x01));
  m.step(0x295e, 19);
  // 295e  ld a,(0x80bf)
  regs.a = mem.read8(0x80bf);
  m.step(0x2961, 13);
  // 2961  ld (ix-0x01),a -- write the classified sprite id
  mem.write8(R(-0x01), regs.a);
  m.step(0x2964, 19);
  // 2964  ld a,0x70
  regs.a = 0x70;
  m.step(0x2966, 7);
  // 2966  ld (ix+0x00),a
  mem.write8(R(0x00), regs.a);
  m.step(0x2969, 19);
  // 2969  ld a,e -- classify the captured neighbour tile
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
  // 2978  ret c -- neighbour tile below 0x96: keep the just-written sprite id
  if (regs.fC) { m.ret(11); return; }
  m.step(0x2979, 5); // ret c not taken
  // 2979  cp 0x9a
  regs.cp(0x9a);
  m.step(0x297b, 7);
  // 297b  ret nc -- neighbour tile 0x9a or above: keep the just-written sprite id
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
  // 2985  ld a,(hl) -- the remapped tile
  regs.a = mem.read8(regs.hl);
  m.step(0x2986, 7);
  // 2986  ld (ix-0x01),a -- overwrite (ix-0x01) with the table value
  mem.write8(R(-0x01), regs.a);
  m.step(0x2989, 19);
  // 2989  ret
  m.ret(10);
}
