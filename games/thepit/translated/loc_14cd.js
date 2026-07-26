// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_14cd  (ROM 0x14cd-0x1657) — the object-vs-tilemap collision/dispatch body.
 * Entered from loc_1493 (`jr nz/jr z 0x14cd`) with H holding the object's screen
 * row and the caller's registers set up. It:
 *
 *   1. Derives a tilemap address from the row byte 0x806b and H:
 *        D = 0x806b + 5 ; column = D >> 3 -> 0x8071 -> C ; B = 0
 *        L = (H >> 3) via three `srl h / rra` ; HL += BC ; HL += 0x9000
 *        -> 0x806e = HL (the video-RAM cell), IX = that cell.
 *   2. Clears the scratch tile byte 0x80a8, then reads the tile UNDER the object
 *      at (IX+1). If it is 0x27 AND ((0x8068 + 3) & 7) == 0 (object grid-aligned),
 *      it latches 0x80e7 = 0x8077 = 1 and tail-jumps to 0x1659.
 *   3. Otherwise (loc_1515) it reads the tile at (IX+0) into 0x80a5/0x80a7/B and,
 *      only when the object IS grid-aligned (D & 7 == 0), special-cases tile
 *      values 0x3a (call 0x467b, bump the 0x8081 counter) and 0x3b/0x3c/0x3d
 *      (arm 0x8078 unless 0x80bd is set, call 0x4683, bump 0x8082), then stamps
 *      the cell with 0x70 and tail-jumps to 0x1659.
 *   4. The not-aligned / other-tile path (loc_1568) records 0x26->0x8076 and
 *      0x27->0x80e7, then runs the tile-classification ladder (loc_1578): a list
 *      of "solid" tile ids (0x2a/0x41/0xc1/0x95/0xc4, the 0x96..0x99 and >=0x9e
 *      ranges, plus 0xc5 gated on D bit2) that defer the frame via 0x1b5b, and a
 *      0x71..0x9d "pushable" range that indexes table 0x1b78 by
 *      ((tile-0x71) << 3 | (D & 7)); a mismatch there arms the 0xb5 push state
 *      (0x80a2/0x80a4/0x8069) and defers. loc_15ea repeats the same ladder for the
 *      tile AHEAD at (IX+1) against table 0x1ce0, and loc_164f cross-checks
 *      0x80a5 vs 0x80a7 before falling through to 0x1659.
 *
 * CONTROL FLOW. Every `jp/jp cc 0x1b5b` and the tail-reach of 0x1659 are
 * tail-jumps to SEPARATE routines: `return m.call(target)`, whose own ret returns
 * to OUR caller (no trailing m.ret — a second ret would double-pop). 0x1659 is a
 * distinct registered routine (loc_13de already `m.call`s it); this routine's own
 * body ends at loc_164f (0x1657), falling through into 0x1659 exactly the way
 * loc_13de falls through into loc_1420. The two `call`s (0x467b, 0x4683) are
 * ORDINARY returning calls: push16(return), step(target,17), m.call(target), then
 * execution continues at the pushed return address.
 *
 * The 16 internal labels (0x1515 .. 0x164f) are reached ONLY from inside this
 * routine, so they are modelled as address-suffixed helpers called directly
 * (`return loc_14cd_1515(m)`), never registered at their own address — the
 * registry regex `^[a-z]+_([0-9a-f]+)$` rejects the embedded second underscore,
 * so a bare `m.call(0x1515)` can never resolve here. `srl h`/`rra` and
 * `sla`/`rl b` are ordered so the carry the first sets is the carry the second
 * reads.
 *
 *   14cd  3a 6b 80     ld   a,(0x806b)
 *   14d0  c6 05        add  a,0x05
 *   14d2  57           ld   d,a
 *   14d3  cb 3f        srl  a
 *   14d5  cb 3f        srl  a
 *   14d7  cb 3f        srl  a
 *   14d9  32 71 80     ld   (0x8071),a
 *   14dc  4f           ld   c,a
 *   14dd  3e 00        ld   a,0x00
 *   14df  47           ld   b,a
 *   14e0  cb 3c        srl  h
 *   14e2  1f           rra
 *   14e3  cb 3c        srl  h
 *   14e5  1f           rra
 *   14e6  cb 3c        srl  h
 *   14e8  1f           rra
 *   14e9  6f           ld   l,a
 *   14ea  09           add  hl,bc
 *   14eb  01 00 90     ld   bc,0x9000
 *   14ee  09           add  hl,bc
 *   14ef  22 6e 80     ld   (0x806e),hl
 *   14f2  dd 2a 6e 80  ld   ix,(0x806e)
 *   14f6  3e 00        ld   a,0x00
 *   14f8  32 a8 80     ld   (0x80a8),a
 *   14fb  dd 7e 01     ld   a,(ix+0x01)
 *   14fe  fe 27        cp   0x27
 *   1500  20 13        jr   nz,0x1515
 *   1502  3a 68 80     ld   a,(0x8068)
 *   1505  c6 03        add  a,0x03
 *   1507  e6 07        and  0x07
 *   1509  20 0a        jr   nz,0x1515
 *   150b  3c           inc  a
 *   150c  32 e7 80     ld   (0x80e7),a
 *   150f  32 77 80     ld   (0x8077),a
 *   1512  c3 59 16     jp   0x1659
 * loc_1515:
 *   1515  dd 7e 00     ld   a,(ix+0x00)
 *   1518  32 a5 80     ld   (0x80a5),a
 *   151b  32 a7 80     ld   (0x80a7),a
 *   151e  47           ld   b,a
 *   151f  7a           ld   a,d
 *   1520  e6 07        and  0x07
 *   1522  20 44        jr   nz,0x1568
 *   1524  78           ld   a,b
 *   1525  fe 3a        cp   0x3a
 *   1527  20 0c        jr   nz,0x1535
 *   1529  cd 7b 46     call 0x467b
 *   152c  3a 81 80     ld   a,(0x8081)
 *   152f  3c           inc  a
 *   1530  32 81 80     ld   (0x8081),a
 *   1533  18 27        jr   0x155c
 * loc_1535:
 *   1535  78           ld   a,b
 *   1536  fe 3b        cp   0x3b
 *   1538  28 08        jr   z,0x1542
 *   153a  fe 3c        cp   0x3c
 *   153c  28 04        jr   z,0x1542
 *   153e  fe 3d        cp   0x3d
 *   1540  20 26        jr   nz,0x1568
 * loc_1542:
 *   1542  3a 78 80     ld   a,(0x8078)
 *   1545  b7           or   a
 *   1546  20 0a        jr   nz,0x1552
 *   1548  3a bd 80     ld   a,(0x80bd)
 *   154b  b7           or   a
 *   154c  20 1a        jr   nz,0x1568
 *   154e  3c           inc  a
 *   154f  32 78 80     ld   (0x8078),a
 * loc_1552:
 *   1552  cd 83 46     call 0x4683
 *   1555  3a 82 80     ld   a,(0x8082)
 *   1558  3c           inc  a
 *   1559  32 82 80     ld   (0x8082),a
 * loc_155c:
 *   155c  dd 2a 6e 80  ld   ix,(0x806e)
 *   1560  3e 70        ld   a,0x70
 *   1562  dd 77 00     ld   (ix+0x00),a
 *   1565  c3 59 16     jp   0x1659
 * loc_1568:
 *   1568  78           ld   a,b
 *   1569  fe 26        cp   0x26
 *   156b  20 03        jr   nz,0x1570
 *   156d  32 76 80     ld   (0x8076),a
 * loc_1570:
 *   1570  78           ld   a,b
 *   1571  fe 27        cp   0x27
 *   1573  20 03        jr   nz,0x1578
 *   1575  32 e7 80     ld   (0x80e7),a
 * loc_1578:
 *   1578  fe 2a        cp   0x2a
 *   157a  ca 5b 1b     jp   z,0x1b5b
 *   157d  fe 41        cp   0x41
 *   157f  ca 5b 1b     jp   z,0x1b5b
 *   1582  fe c1        cp   0xc1
 *   1584  ca 5b 1b     jp   z,0x1b5b
 *   1587  fe 95        cp   0x95
 *   1589  ca 5b 1b     jp   z,0x1b5b
 *   158c  fe c4        cp   0xc4
 *   158e  ca 5b 1b     jp   z,0x1b5b
 *   1591  fe c5        cp   0xc5
 *   1593  28 0d        jr   z,0x15a2
 *   1595  fe 96        cp   0x96
 *   1597  38 0e        jr   c,0x15a7
 *   1599  fe 9a        cp   0x9a
 *   159b  da 5b 1b     jp   c,0x1b5b
 *   159e  fe 9e        cp   0x9e
 *   15a0  30 43        jr   nc,0x15e5
 * loc_15a2:
 *   15a2  cb 52        bit  2,d
 *   15a4  ca 5b 1b     jp   z,0x1b5b
 * loc_15a7:
 *   15a7  fe 71        cp   0x71
 *   15a9  38 3a        jr   c,0x15e5
 *   15ab  fe 9e        cp   0x9e
 *   15ad  30 36        jr   nc,0x15e5
 *   15af  5f           ld   e,a
 *   15b0  d6 71        sub  0x71
 *   15b2  06 00        ld   b,0x00
 *   15b4  cb 27        sla  a
 *   15b6  cb 27        sla  a
 *   15b8  cb 27        sla  a
 *   15ba  cb 10        rl   b
 *   15bc  4f           ld   c,a
 *   15bd  7a           ld   a,d
 *   15be  e6 07        and  0x07
 *   15c0  b1           or   c
 *   15c1  4f           ld   c,a
 *   15c2  21 78 1b     ld   hl,0x1b78
 *   15c5  09           add  hl,bc
 *   15c6  7e           ld   a,(hl)
 *   15c7  32 a7 80     ld   (0x80a7),a
 *   15ca  bb           cp   e
 *   15cb  28 18        jr   z,0x15e5
 *   15cd  7a           ld   a,d
 *   15ce  e6 07        and  0x07
 *   15d0  20 18        jr   nz,0x15ea
 *   15d2  3a a3 80     ld   a,(0x80a3)
 *   15d5  32 a4 80     ld   (0x80a4),a
 *   15d8  3e 01        ld   a,0x01
 *   15da  32 a2 80     ld   (0x80a2),a
 *   15dd  3e b5        ld   a,0xb5
 *   15df  32 69 80     ld   (0x8069),a
 *   15e2  c3 5b 1b     jp   0x1b5b
 * loc_15e5:
 *   15e5  7a           ld   a,d
 *   15e6  e6 07        and  0x07
 *   15e8  28 6f        jr   z,0x1659
 * loc_15ea:
 *   15ea  dd 7e 01     ld   a,(ix+0x01)
 *   15ed  32 a6 80     ld   (0x80a6),a
 *   15f0  fe 2a        cp   0x2a
 *   15f2  ca 5b 1b     jp   z,0x1b5b
 *   15f5  fe 41        cp   0x41
 *   15f7  ca 5b 1b     jp   z,0x1b5b
 *   15fa  fe c1        cp   0xc1
 *   15fc  ca 5b 1b     jp   z,0x1b5b
 *   15ff  fe c4        cp   0xc4
 *   1601  28 0d        jr   z,0x1610
 *   1603  fe 95        cp   0x95
 *   1605  ca 5b 1b     jp   z,0x1b5b
 *   1608  fe 96        cp   0x96
 *   160a  38 0a        jr   c,0x1616
 *   160c  fe 9a        cp   0x9a
 *   160e  30 3f        jr   nc,0x164f
 * loc_1610:
 *   1610  15           dec  d
 *   1611  cb 52        bit  2,d
 *   1613  c2 5b 1b     jp   nz,0x1b5b
 * loc_1616:
 *   1616  fe 71        cp   0x71
 *   1618  38 35        jr   c,0x164f
 *   161a  fe 9e        cp   0x9e
 *   161c  30 31        jr   nc,0x164f
 *   161e  5f           ld   e,a
 *   161f  d6 71        sub  0x71
 *   1621  06 00        ld   b,0x00
 *   1623  cb 27        sla  a
 *   1625  cb 27        sla  a
 *   1627  cb 27        sla  a
 *   1629  cb 10        rl   b
 *   162b  4f           ld   c,a
 *   162c  7a           ld   a,d
 *   162d  e6 07        and  0x07
 *   162f  b1           or   c
 *   1630  4f           ld   c,a
 *   1631  21 e0 1c     ld   hl,0x1ce0
 *   1634  09           add  hl,bc
 *   1635  7e           ld   a,(hl)
 *   1636  32 a8 80     ld   (0x80a8),a
 *   1639  bb           cp   e
 *   163a  28 13        jr   z,0x164f
 * loc_163c:
 *   163c  3a a3 80     ld   a,(0x80a3)
 *   163f  32 a4 80     ld   (0x80a4),a
 *   1642  3e 01        ld   a,0x01
 *   1644  32 a2 80     ld   (0x80a2),a
 *   1647  3e b5        ld   a,0xb5
 *   1649  32 69 80     ld   (0x8069),a
 *   164c  c3 5b 1b     jp   0x1b5b
 * loc_164f:
 *   164f  3a a5 80     ld   a,(0x80a5)
 *   1652  5f           ld   e,a
 *   1653  3a a7 80     ld   a,(0x80a7)
 *   1656  bb           cp   e
 *   1657  20 e3        jr   nz,0x163c
 *                      (fall through into 0x1659)
 */
export function loc_14cd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x806b);
  m.step(0x14d0, 13); // ld a,(0x806b) -- object screen column seed
  regs.add(0x05);
  m.step(0x14d2, 7); // add a,0x05 -- rounding bias before the /8
  regs.d = regs.a;
  m.step(0x14d3, 4); // ld d,a -- keep the biased column in D
  regs.a = regs.srl(regs.a);
  m.step(0x14d5, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x14d7, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x14d9, 8); // srl a -- A = (0x806b + 5) >> 3 = column
  mem.write8(0x8071, regs.a);
  m.step(0x14dc, 13); // ld (0x8071),a -- store the tile column
  regs.c = regs.a;
  m.step(0x14dd, 4); // ld c,a -- BC low = column
  regs.a = 0x00;
  m.step(0x14df, 7); // ld a,0x00
  regs.b = regs.a;
  m.step(0x14e0, 4); // ld b,a -- BC high = 0
  regs.h = regs.srl(regs.h);
  m.step(0x14e2, 8); // srl h -- shift the row byte, bit0 -> carry
  regs.rra();
  m.step(0x14e3, 4); // rra -- pull that carry into A bit7
  regs.h = regs.srl(regs.h);
  m.step(0x14e5, 8); // srl h
  regs.rra();
  m.step(0x14e6, 4); // rra
  regs.h = regs.srl(regs.h);
  m.step(0x14e8, 8); // srl h
  regs.rra();
  m.step(0x14e9, 4); // rra -- A = (H >> 3) packed via three srl/rra
  regs.l = regs.a;
  m.step(0x14ea, 4); // ld l,a -- HL = H:L (row base)
  regs.addHl(regs.bc);
  m.step(0x14eb, 11); // add hl,bc -- add the column
  regs.bc = 0x9000;
  m.step(0x14ee, 10); // ld bc,0x9000
  regs.addHl(regs.bc);
  m.step(0x14ef, 11); // add hl,bc -- HL = video-RAM cell address
  mem.write16(0x806e, regs.hl);
  m.step(0x14f2, 16); // ld (0x806e),hl -- stash the cell pointer
  regs.ix = mem.read16(0x806e);
  m.step(0x14f6, 20); // ld ix,(0x806e) -- IX = the cell
  regs.a = 0x00;
  m.step(0x14f8, 7); // ld a,0x00
  mem.write8(0x80a8, regs.a);
  m.step(0x14fb, 13); // ld (0x80a8),a -- clear the "tile ahead" scratch
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x14fe, 19); // ld a,(ix+0x01) -- tile just under the object
  regs.cp(0x27);
  m.step(0x1500, 7); // cp 0x27
  if (regs.fNZ) {
    m.step(0x1515, 12); // jr nz taken -- not the 0x27 marker
    return loc_14cd_1515(m);
  }
  m.step(0x1502, 7); // jr nz not taken

  regs.a = mem.read8(0x8068);
  m.step(0x1505, 13); // ld a,(0x8068) -- object X
  regs.add(0x03);
  m.step(0x1507, 7); // add a,0x03
  regs.and(0x07);
  m.step(0x1509, 7); // and 0x07 -- grid-aligned?
  if (regs.fNZ) {
    m.step(0x1515, 12); // jr nz taken -- not aligned
    return loc_14cd_1515(m);
  }
  m.step(0x150b, 7); // jr nz not taken -- aligned on the 0x27 marker

  regs.a = regs.inc8(regs.a); // A was 0 -> 1
  m.step(0x150c, 4); // inc a
  mem.write8(0x80e7, regs.a);
  m.step(0x150f, 13); // ld (0x80e7),a -- latch 1
  mem.write8(0x8077, regs.a);
  m.step(0x1512, 13); // ld (0x8077),a -- latch 1

  m.step(0x1659, 10); // jp 0x1659 -- hand off to the shared tail
  return m.call(0x1659);
}

/**
 * loc_14cd_1515  (ROM 0x1515-0x1533) — reads the tile the object sits ON (IX+0)
 * into 0x80a5/0x80a7/B. When the object is grid-aligned (D & 7 == 0) it handles
 * the collectible/gate tiles: 0x3a -> call 0x467b and bump 0x8081; 0x3b/0x3c/0x3d
 * -> loc_1542; anything else -> loc_1568. Not aligned -> loc_1568 directly.
 */
export function loc_14cd_1515(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.ix);
  m.step(0x1518, 19); // ld a,(ix+0x00) -- tile under the object
  mem.write8(0x80a5, regs.a);
  m.step(0x151b, 13); // ld (0x80a5),a
  mem.write8(0x80a7, regs.a);
  m.step(0x151e, 13); // ld (0x80a7),a
  regs.b = regs.a;
  m.step(0x151f, 4); // ld b,a -- keep the tile id in B
  regs.a = regs.d;
  m.step(0x1520, 4); // ld a,d
  regs.and(0x07);
  m.step(0x1522, 7); // and 0x07 -- object grid-aligned?
  if (regs.fNZ) {
    m.step(0x1568, 12); // jr nz taken -- not aligned
    return loc_14cd_1568(m);
  }
  m.step(0x1524, 7); // jr nz not taken

  regs.a = regs.b;
  m.step(0x1525, 4); // ld a,b
  regs.cp(0x3a);
  m.step(0x1527, 7); // cp 0x3a
  if (regs.fNZ) {
    m.step(0x1535, 12); // jr nz taken -- not tile 0x3a
    return loc_14cd_1535(m);
  }
  m.step(0x1529, 7); // jr nz not taken -- tile 0x3a

  m.push16(0x152c);
  m.step(0x467b, 17); // call 0x467b -- ordinary call, returns to 0x152c
  m.call(0x467b);

  regs.a = mem.read8(0x8081);
  m.step(0x152f, 13); // ld a,(0x8081)
  regs.a = regs.inc8(regs.a);
  m.step(0x1530, 4); // inc a
  mem.write8(0x8081, regs.a);
  m.step(0x1533, 13); // ld (0x8081),a -- bump the 0x3a counter

  m.step(0x155c, 12); // jr 0x155c
  return loc_14cd_155c(m);
}

/**
 * loc_14cd_1535  (ROM 0x1535-0x1540) — tile ids 0x3b/0x3c/0x3d go to loc_1542;
 * every other id falls out to loc_1568.
 */
export function loc_14cd_1535(m) {
  const { regs } = m;

  regs.a = regs.b;
  m.step(0x1536, 4); // ld a,b
  regs.cp(0x3b);
  m.step(0x1538, 7); // cp 0x3b
  if (regs.fZ) {
    m.step(0x1542, 12); // jr z taken
    return loc_14cd_1542(m);
  }
  m.step(0x153a, 7); // jr z not taken

  regs.cp(0x3c);
  m.step(0x153c, 7); // cp 0x3c
  if (regs.fZ) {
    m.step(0x1542, 12); // jr z taken
    return loc_14cd_1542(m);
  }
  m.step(0x153e, 7); // jr z not taken

  regs.cp(0x3d);
  m.step(0x1540, 7); // cp 0x3d
  if (regs.fNZ) {
    m.step(0x1568, 12); // jr nz taken -- none of 0x3b/0x3c/0x3d
    return loc_14cd_1568(m);
  }
  m.step(0x1542, 7); // jr nz not taken -- fall into loc_1542

  return loc_14cd_1542(m);
}

/**
 * loc_14cd_1542  (ROM 0x1542-0x1551) — the gate tiles (0x3b..0x3d): if the busy
 * flag 0x8078 is already set, skip to loc_1552; else if 0x80bd is set, bail to
 * loc_1568; otherwise arm 0x8078 = 1 and fall into loc_1552.
 */
export function loc_14cd_1542(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8078);
  m.step(0x1545, 13); // ld a,(0x8078)
  regs.or(regs.a);
  m.step(0x1546, 4); // or a -- busy flag set?
  if (regs.fNZ) {
    m.step(0x1552, 12); // jr nz taken -- already armed
    return loc_14cd_1552(m);
  }
  m.step(0x1548, 7); // jr nz not taken

  regs.a = mem.read8(0x80bd);
  m.step(0x154b, 13); // ld a,(0x80bd)
  regs.or(regs.a);
  m.step(0x154c, 4); // or a -- 0x80bd set?
  if (regs.fNZ) {
    m.step(0x1568, 12); // jr nz taken -- suppressed, back to the ladder
    return loc_14cd_1568(m);
  }
  m.step(0x154e, 7); // jr nz not taken -- A is 0 here

  regs.a = regs.inc8(regs.a); // A was 0 -> 1
  m.step(0x154f, 4); // inc a
  mem.write8(0x8078, regs.a);
  m.step(0x1552, 13); // ld (0x8078),a -- arm the busy flag

  return loc_14cd_1552(m);
}

/**
 * loc_14cd_1552  (ROM 0x1552-0x155b) — call 0x4683, bump the 0x8082 counter,
 * then fall into loc_155c.
 */
export function loc_14cd_1552(m) {
  const { regs, mem } = m;

  m.push16(0x1555);
  m.step(0x4683, 17); // call 0x4683 -- ordinary call, returns to 0x1555
  m.call(0x4683);

  regs.a = mem.read8(0x8082);
  m.step(0x1558, 13); // ld a,(0x8082)
  regs.a = regs.inc8(regs.a);
  m.step(0x1559, 4); // inc a
  mem.write8(0x8082, regs.a);
  m.step(0x155c, 13); // ld (0x8082),a -- bump the gate counter

  return loc_14cd_155c(m);
}

/**
 * loc_14cd_155c  (ROM 0x155c-0x1567) — stamp the cell with 0x70 and tail-jump to
 * the shared tail 0x1659.
 */
export function loc_14cd_155c(m) {
  const { regs, mem } = m;

  regs.ix = mem.read16(0x806e);
  m.step(0x1560, 20); // ld ix,(0x806e) -- reload the cell pointer
  regs.a = 0x70;
  m.step(0x1562, 7); // ld a,0x70
  mem.write8(regs.ix, regs.a);
  m.step(0x1565, 19); // ld (ix+0x00),a -- stamp the cell

  m.step(0x1659, 10); // jp 0x1659
  return m.call(0x1659);
}

/**
 * loc_14cd_1568  (ROM 0x1568-0x156f) — record tile 0x26 into 0x8076, then fall
 * into loc_1570.
 */
export function loc_14cd_1568(m) {
  const { regs, mem } = m;

  regs.a = regs.b;
  m.step(0x1569, 4); // ld a,b
  regs.cp(0x26);
  m.step(0x156b, 7); // cp 0x26
  if (regs.fNZ) {
    m.step(0x1570, 12); // jr nz taken
    return loc_14cd_1570(m);
  }
  m.step(0x156d, 7); // jr nz not taken -- tile 0x26

  mem.write8(0x8076, regs.a); // A == 0x26
  m.step(0x1570, 13); // ld (0x8076),a

  return loc_14cd_1570(m);
}

/**
 * loc_14cd_1570  (ROM 0x1570-0x1577) — record tile 0x27 into 0x80e7, then fall
 * into the classification ladder loc_1578.
 */
export function loc_14cd_1570(m) {
  const { regs, mem } = m;

  regs.a = regs.b;
  m.step(0x1571, 4); // ld a,b
  regs.cp(0x27);
  m.step(0x1573, 7); // cp 0x27
  if (regs.fNZ) {
    m.step(0x1578, 12); // jr nz taken
    return loc_14cd_1578(m);
  }
  m.step(0x1575, 7); // jr nz not taken -- tile 0x27

  mem.write8(0x80e7, regs.a); // A == 0x27
  m.step(0x1578, 13); // ld (0x80e7),a

  return loc_14cd_1578(m);
}

/**
 * loc_14cd_1578  (ROM 0x1578-0x15a1) — the "tile under object" classification
 * ladder. Solid ids (0x2a/0x41/0xc1/0x95/0xc4, plus 0x9a..0x9d) defer to 0x1b5b;
 * 0xc5 and the 0x96..0x99 band route to the bit2 / pushable checks; >= 0x9e goes
 * straight to loc_15e5. A holds the tile id throughout (cp does not change it).
 */
export function loc_14cd_1578(m) {
  const { regs } = m;

  regs.cp(0x2a);
  m.step(0x157a, 7); // cp 0x2a
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken -- solid, defer
    return m.call(0x1b5b);
  }
  m.step(0x157d, 10); // jp z not taken

  regs.cp(0x41);
  m.step(0x157f, 7); // cp 0x41
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken
    return m.call(0x1b5b);
  }
  m.step(0x1582, 10); // jp z not taken

  regs.cp(0xc1);
  m.step(0x1584, 7); // cp 0xc1
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken
    return m.call(0x1b5b);
  }
  m.step(0x1587, 10); // jp z not taken

  regs.cp(0x95);
  m.step(0x1589, 7); // cp 0x95
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken
    return m.call(0x1b5b);
  }
  m.step(0x158c, 10); // jp z not taken

  regs.cp(0xc4);
  m.step(0x158e, 7); // cp 0xc4
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken
    return m.call(0x1b5b);
  }
  m.step(0x1591, 10); // jp z not taken

  regs.cp(0xc5);
  m.step(0x1593, 7); // cp 0xc5
  if (regs.fZ) {
    m.step(0x15a2, 12); // jr z taken -- 0xc5, gate on D bit2
    return loc_14cd_15a2(m);
  }
  m.step(0x1595, 7); // jr z not taken

  regs.cp(0x96);
  m.step(0x1597, 7); // cp 0x96
  if (regs.fC) {
    m.step(0x15a7, 12); // jr c taken -- below 0x96, try the pushable range
    return loc_14cd_15a7(m);
  }
  m.step(0x1599, 7); // jr c not taken

  regs.cp(0x9a);
  m.step(0x159b, 7); // cp 0x9a
  if (regs.fC) {
    m.step(0x1b5b, 10); // jp c taken -- 0x96..0x99 solid, defer
    return m.call(0x1b5b);
  }
  m.step(0x159e, 10); // jp c not taken

  regs.cp(0x9e);
  m.step(0x15a0, 7); // cp 0x9e
  if (regs.fNC) {
    m.step(0x15e5, 12); // jr nc taken -- >= 0x9e
    return loc_14cd_15e5(m);
  }
  m.step(0x15a2, 7); // jr nc not taken -- 0x9a..0x9d, fall into loc_15a2

  return loc_14cd_15a2(m);
}

/**
 * loc_14cd_15a2  (ROM 0x15a2-0x15a6) — the D bit2 gate: if clear, defer to
 * 0x1b5b; else fall into the pushable-range test loc_15a7.
 */
export function loc_14cd_15a2(m) {
  const { regs } = m;

  regs.bit(2, regs.d);
  m.step(0x15a4, 8); // bit 2,d
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken -- bit2 clear, defer
    return m.call(0x1b5b);
  }
  m.step(0x15a7, 10); // jp z not taken -- fall into loc_15a7

  return loc_14cd_15a7(m);
}

/**
 * loc_14cd_15a7  (ROM 0x15a7-0x15e4) — the pushable-tile range 0x71..0x9d.
 * Outside it (below 0x71 or >= 0x9e) -> loc_15e5. Inside, index table 0x1b78 by
 * ((tile - 0x71) << 3 | (D & 7)); the byte there is stored to 0x80a7 and compared
 * to the tile. Equal -> loc_15e5. Unequal, and only when the object is
 * grid-aligned (D & 7 == 0), arm the 0xb5 push state (0x80a2=1, 0x80a4=0x80a3,
 * 0x8069=0xb5) and defer to 0x1b5b; if not aligned -> loc_15ea.
 */
export function loc_14cd_15a7(m) {
  const { regs, mem } = m;

  regs.cp(0x71);
  m.step(0x15a9, 7); // cp 0x71
  if (regs.fC) {
    m.step(0x15e5, 12); // jr c taken -- below the range
    return loc_14cd_15e5(m);
  }
  m.step(0x15ab, 7); // jr c not taken

  regs.cp(0x9e);
  m.step(0x15ad, 7); // cp 0x9e
  if (regs.fNC) {
    m.step(0x15e5, 12); // jr nc taken -- above the range
    return loc_14cd_15e5(m);
  }
  m.step(0x15af, 7); // jr nc not taken -- 0x71..0x9d

  regs.e = regs.a;
  m.step(0x15b0, 4); // ld e,a -- keep the tile id in E
  regs.sub(0x71);
  m.step(0x15b2, 7); // sub 0x71 -- index base
  regs.b = 0x00;
  m.step(0x15b4, 7); // ld b,0x00
  regs.a = regs.sla(regs.a);
  m.step(0x15b6, 8); // sla a
  regs.a = regs.sla(regs.a);
  m.step(0x15b8, 8); // sla a
  regs.a = regs.sla(regs.a);
  m.step(0x15ba, 8); // sla a -- (tile-0x71) << 3, bit8 spilt to carry
  regs.b = regs.rl(regs.b);
  m.step(0x15bc, 8); // rl b -- catch that carry as BC bit8
  regs.c = regs.a;
  m.step(0x15bd, 4); // ld c,a
  regs.a = regs.d;
  m.step(0x15be, 4); // ld a,d
  regs.and(0x07);
  m.step(0x15c0, 7); // and 0x07 -- sub-tile offset (D & 7)
  regs.or(regs.c);
  m.step(0x15c1, 4); // or c
  regs.c = regs.a;
  m.step(0x15c2, 4); // ld c,a -- BC = ((tile-0x71)<<3) | (D&7)
  regs.hl = 0x1b78;
  m.step(0x15c5, 10); // ld hl,0x1b78 -- the "under" tile table
  regs.addHl(regs.bc);
  m.step(0x15c6, 11); // add hl,bc
  regs.a = mem.read8(regs.hl);
  m.step(0x15c7, 7); // ld a,(hl) -- expected tile
  mem.write8(0x80a7, regs.a);
  m.step(0x15ca, 13); // ld (0x80a7),a
  regs.cp(regs.e);
  m.step(0x15cb, 4); // cp e -- matches the actual tile?
  if (regs.fZ) {
    m.step(0x15e5, 12); // jr z taken -- matched
    return loc_14cd_15e5(m);
  }
  m.step(0x15cd, 7); // jr z not taken

  regs.a = regs.d;
  m.step(0x15ce, 4); // ld a,d
  regs.and(0x07);
  m.step(0x15d0, 7); // and 0x07 -- grid-aligned?
  if (regs.fNZ) {
    m.step(0x15ea, 12); // jr nz taken -- not aligned, check the tile ahead
    return loc_14cd_15ea(m);
  }
  m.step(0x15d2, 7); // jr nz not taken -- aligned mismatch: arm the push

  regs.a = mem.read8(0x80a3);
  m.step(0x15d5, 13); // ld a,(0x80a3)
  mem.write8(0x80a4, regs.a);
  m.step(0x15d8, 13); // ld (0x80a4),a
  regs.a = 0x01;
  m.step(0x15da, 7); // ld a,0x01
  mem.write8(0x80a2, regs.a);
  m.step(0x15dd, 13); // ld (0x80a2),a
  regs.a = 0xb5;
  m.step(0x15df, 7); // ld a,0xb5
  mem.write8(0x8069, regs.a);
  m.step(0x15e2, 13); // ld (0x8069),a -- select the 0xb5 push handler

  m.step(0x1b5b, 10); // jp 0x1b5b
  return m.call(0x1b5b);
}

/**
 * loc_14cd_15e5  (ROM 0x15e5-0x15e9) — if the object is grid-aligned (D & 7 == 0)
 * the "under" tile is settled, so tail-jump to 0x1659; otherwise fall into
 * loc_15ea to classify the tile AHEAD.
 */
export function loc_14cd_15e5(m) {
  const { regs } = m;

  regs.a = regs.d;
  m.step(0x15e6, 4); // ld a,d
  regs.and(0x07);
  m.step(0x15e8, 7); // and 0x07 -- grid-aligned?
  if (regs.fZ) {
    m.step(0x1659, 12); // jr z taken -- settled, hand off
    return m.call(0x1659);
  }
  m.step(0x15ea, 7); // jr z not taken -- fall into loc_15ea

  return loc_14cd_15ea(m);
}

/**
 * loc_14cd_15ea  (ROM 0x15ea-0x160f) — the same solid-tile ladder applied to the
 * tile AHEAD at (IX+1), recorded into 0x80a6. Solid ids defer to 0x1b5b; 0xc4
 * decrements D and rechecks bit2 (loc_1610); the 0x96..0x99 band -> loc_1616;
 * >= 0x9a -> loc_164f.
 */
export function loc_14cd_15ea(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x15ed, 19); // ld a,(ix+0x01) -- tile ahead of the object
  mem.write8(0x80a6, regs.a);
  m.step(0x15f0, 13); // ld (0x80a6),a
  regs.cp(0x2a);
  m.step(0x15f2, 7); // cp 0x2a
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken -- solid, defer
    return m.call(0x1b5b);
  }
  m.step(0x15f5, 10); // jp z not taken

  regs.cp(0x41);
  m.step(0x15f7, 7); // cp 0x41
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken
    return m.call(0x1b5b);
  }
  m.step(0x15fa, 10); // jp z not taken

  regs.cp(0xc1);
  m.step(0x15fc, 7); // cp 0xc1
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken
    return m.call(0x1b5b);
  }
  m.step(0x15ff, 10); // jp z not taken

  regs.cp(0xc4);
  m.step(0x1601, 7); // cp 0xc4
  if (regs.fZ) {
    m.step(0x1610, 12); // jr z taken -- 0xc4, dec D then recheck bit2
    return loc_14cd_1610(m);
  }
  m.step(0x1603, 7); // jr z not taken

  regs.cp(0x95);
  m.step(0x1605, 7); // cp 0x95
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken
    return m.call(0x1b5b);
  }
  m.step(0x1608, 10); // jp z not taken

  regs.cp(0x96);
  m.step(0x160a, 7); // cp 0x96
  if (regs.fC) {
    m.step(0x1616, 12); // jr c taken -- below 0x96, try the pushable range
    return loc_14cd_1616(m);
  }
  m.step(0x160c, 7); // jr c not taken

  regs.cp(0x9a);
  m.step(0x160e, 7); // cp 0x9a
  if (regs.fNC) {
    m.step(0x164f, 12); // jr nc taken -- >= 0x9a
    return loc_14cd_164f(m);
  }
  m.step(0x1610, 7); // jr nc not taken -- 0x96..0x99, fall into loc_1610

  return loc_14cd_1610(m);
}

/**
 * loc_14cd_1610  (ROM 0x1610-0x1615) — decrement D, retest bit2: if set, defer to
 * 0x1b5b; else fall into the pushable-ahead test loc_1616.
 */
export function loc_14cd_1610(m) {
  const { regs } = m;

  regs.d = regs.dec8(regs.d);
  m.step(0x1611, 4); // dec d
  regs.bit(2, regs.d);
  m.step(0x1613, 8); // bit 2,d
  if (regs.fNZ) {
    m.step(0x1b5b, 10); // jp nz taken -- bit2 set, defer
    return m.call(0x1b5b);
  }
  m.step(0x1616, 10); // jp nz not taken -- fall into loc_1616

  return loc_14cd_1616(m);
}

/**
 * loc_14cd_1616  (ROM 0x1616-0x163b) — the pushable-tile range test for the tile
 * ahead, indexing table 0x1ce0 by ((tile-0x71)<<3 | (D&7)). Outside 0x71..0x9d
 * -> loc_164f. The looked-up byte is stored to 0x80a8 and compared to the tile;
 * equal -> loc_164f, else fall into loc_163c to arm the push.
 */
export function loc_14cd_1616(m) {
  const { regs, mem } = m;

  regs.cp(0x71);
  m.step(0x1618, 7); // cp 0x71
  if (regs.fC) {
    m.step(0x164f, 12); // jr c taken -- below the range
    return loc_14cd_164f(m);
  }
  m.step(0x161a, 7); // jr c not taken

  regs.cp(0x9e);
  m.step(0x161c, 7); // cp 0x9e
  if (regs.fNC) {
    m.step(0x164f, 12); // jr nc taken -- above the range
    return loc_14cd_164f(m);
  }
  m.step(0x161e, 7); // jr nc not taken -- 0x71..0x9d

  regs.e = regs.a;
  m.step(0x161f, 4); // ld e,a
  regs.sub(0x71);
  m.step(0x1621, 7); // sub 0x71
  regs.b = 0x00;
  m.step(0x1623, 7); // ld b,0x00
  regs.a = regs.sla(regs.a);
  m.step(0x1625, 8); // sla a
  regs.a = regs.sla(regs.a);
  m.step(0x1627, 8); // sla a
  regs.a = regs.sla(regs.a);
  m.step(0x1629, 8); // sla a
  regs.b = regs.rl(regs.b);
  m.step(0x162b, 8); // rl b -- catch the bit8 carry
  regs.c = regs.a;
  m.step(0x162c, 4); // ld c,a
  regs.a = regs.d;
  m.step(0x162d, 4); // ld a,d
  regs.and(0x07);
  m.step(0x162f, 7); // and 0x07
  regs.or(regs.c);
  m.step(0x1630, 4); // or c
  regs.c = regs.a;
  m.step(0x1631, 4); // ld c,a -- BC = ((tile-0x71)<<3) | (D&7)
  regs.hl = 0x1ce0;
  m.step(0x1634, 10); // ld hl,0x1ce0 -- the "ahead" tile table
  regs.addHl(regs.bc);
  m.step(0x1635, 11); // add hl,bc
  regs.a = mem.read8(regs.hl);
  m.step(0x1636, 7); // ld a,(hl) -- expected tile
  mem.write8(0x80a8, regs.a);
  m.step(0x1639, 13); // ld (0x80a8),a
  regs.cp(regs.e);
  m.step(0x163a, 4); // cp e -- matches the actual tile?
  if (regs.fZ) {
    m.step(0x164f, 12); // jr z taken -- matched
    return loc_14cd_164f(m);
  }
  m.step(0x163c, 7); // jr z not taken -- fall into loc_163c

  return loc_14cd_163c(m);
}

/**
 * loc_14cd_163c  (ROM 0x163c-0x164e) — arm the 0xb5 push state (0x80a4=0x80a3,
 * 0x80a2=1, 0x8069=0xb5) and defer to 0x1b5b. Same body as the aligned-mismatch
 * arm inside loc_15a7.
 */
export function loc_14cd_163c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x80a3);
  m.step(0x163f, 13); // ld a,(0x80a3)
  mem.write8(0x80a4, regs.a);
  m.step(0x1642, 13); // ld (0x80a4),a
  regs.a = 0x01;
  m.step(0x1644, 7); // ld a,0x01
  mem.write8(0x80a2, regs.a);
  m.step(0x1647, 13); // ld (0x80a2),a
  regs.a = 0xb5;
  m.step(0x1649, 7); // ld a,0xb5
  mem.write8(0x8069, regs.a);
  m.step(0x164c, 13); // ld (0x8069),a -- select the 0xb5 push handler

  m.step(0x1b5b, 10); // jp 0x1b5b
  return m.call(0x1b5b);
}

/**
 * loc_14cd_164f  (ROM 0x164f-0x1657) — cross-check the "under" tile record: if
 * 0x80a7 != 0x80a5 the tile changed, so go arm the push (loc_163c); otherwise
 * fall through into the shared tail 0x1659.
 */
export function loc_14cd_164f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x80a5);
  m.step(0x1652, 13); // ld a,(0x80a5)
  regs.e = regs.a;
  m.step(0x1653, 4); // ld e,a
  regs.a = mem.read8(0x80a7);
  m.step(0x1656, 13); // ld a,(0x80a7)
  regs.cp(regs.e);
  m.step(0x1657, 4); // cp e -- did the under-tile record change?
  if (regs.fNZ) {
    m.step(0x163c, 12); // jr nz taken -- changed, arm the push
    return loc_14cd_163c(m);
  }
  m.step(0x1659, 7); // jr nz not taken -- fall through into 0x1659

  return m.call(0x1659);
}
