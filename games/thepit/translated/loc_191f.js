// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_191f  (ROM 0x191f-0x19cf, The Pit) — the tile-code classifier / dig-arm of
 * the actor-movement dispatch, reached from loc_18cf (its tile-boundary sibling)
 * once that arm declines. B is the tile code sitting under the actor and E is the
 * actor's position accumulator; the routine sorts B into ranges and either bails,
 * defers, or (for the "diggable" range 0x71-0x99) does two table lookups to decide
 * whether the actor has run into a tile it must react to, then latches a per-actor
 * state + sound request. Every terminal transfer is a tail-jump into a peer
 * routine (loc_1b5b epilogue, loc_19d0 movement continuation, or the internal
 * loc_19b9 latch tail whose own `jp 0x1b5b` exits) — none pushes a return, so a
 * callee's `ret` unwinds to OUR caller; modelled `m.step(target,t); return
 * m.call(target)` with NO trailing m.ret. The one true `call` (0x4c9f, request
 * sound 0x14) pushes 0x19cd and resumes there.
 *
 * Branch map on B (A := B at entry):
 *   B in [0x36, 0x3a)             -> jp 0x1b5b  (handled elsewhere; just rebuild+ret)
 *   B == 0x2a/0x2b/0x41/0xc1/0x95 -> loc_19b9   (latch state 0x80c1=2 + sound 0x14)
 *   B == 0xc4                     -> loc_194f    (bit-2-of-E gate -> loc_19b9)
 *   B in [0x96, 0x9a)            \_ if bit2 of E set -> loc_19b9, else -> loc_1954
 *   B in [0x71, 0x96)            /  (the < 0x96 codes fall straight to loc_1954)
 *   B >= 0x9a  (and not < 0x96)   -> loc_19d0    (nothing under; keep moving)
 *   loc_1954: B in [0x71,0x9a)    -> look up expected tile in table 0x1e48 indexed
 *                                    ((B-0x71)<<3)|(E&7); store 0x80a7. If it equals
 *                                    the running tile D -> loc_19d0 (no change). Else
 *                                    stage a reaction: 0x80a4:=0x80a3, 0x80a2:=3,
 *                                    0x8069:=0x36; and when (E&7)!=0 also look up the
 *                                    NEIGHBOUR cell (ix+1) in table 0x1fb0 -> 0x80a8;
 *                                    then fall into loc_19b9.
 *   loc_19b9: if 0x80c1 == 0 -> loc_1b5b (not armed); else 0x80c1:=2, 0x80b1:=0x40,
 *             call 0x4c9f (request sound 0x14), jp 0x1b5b.
 *
 * The two 3x`sla a`+`rl b` sequences build BC = ((B-0x71)<<3)|(E&7) as a 16-bit
 * index (the third sla spills bit 8 to carry, which `rl b` catches into B).
 * Internal forward jumps (to 0x1929/0x194f/0x1954/0x19b9) are labelled-block breaks.
 *
 *   191f  78           ld   a,b
 *   1920  fe 36        cp   0x36
 *   1922  38 05        jr   c,0x1929
 *   1924  fe 3a        cp   0x3a
 *   1926  da 5b 1b     jp   c,0x1b5b
 * loc_1929:
 *   1929  fe 2a        cp   0x2a
 *   192b  ca b9 19     jp   z,0x19b9
 *   192e  fe 2b        cp   0x2b
 *   1930  ca b9 19     jp   z,0x19b9
 *   1933  fe 41        cp   0x41
 *   1935  ca b9 19     jp   z,0x19b9
 *   1938  fe c1        cp   0xc1
 *   193a  ca b9 19     jp   z,0x19b9
 *   193d  fe 95        cp   0x95
 *   193f  ca b9 19     jp   z,0x19b9
 *   1942  fe c4        cp   0xc4
 *   1944  28 09        jr   z,0x194f
 *   1946  fe 96        cp   0x96
 *   1948  38 0a        jr   c,0x1954
 *   194a  fe 9a        cp   0x9a
 *   194c  d2 d0 19     jp   nc,0x19d0
 * loc_194f:
 *   194f  cb 53        bit  2,e
 *   1951  c2 b9 19     jp   nz,0x19b9
 * loc_1954:
 *   1954  fe 71        cp   0x71
 *   1956  da d0 19     jp   c,0x19d0
 *   1959  fe 9a        cp   0x9a
 *   195b  d2 d0 19     jp   nc,0x19d0
 *   195e  57           ld   d,a
 *   195f  d6 71        sub  0x71
 *   1961  06 00        ld   b,0x00
 *   1963  cb 27        sla  a
 *   1965  cb 27        sla  a
 *   1967  cb 27        sla  a
 *   1969  cb 10        rl   b
 *   196b  4f           ld   c,a
 *   196c  7b           ld   a,e
 *   196d  e6 07        and  0x07
 *   196f  b1           or   c
 *   1970  4f           ld   c,a
 *   1971  21 48 1e     ld   hl,0x1e48
 *   1974  09           add  hl,bc
 *   1975  7e           ld   a,(hl)
 *   1976  32 a7 80     ld   (0x80a7),a
 *   1979  ba           cp   d
 *   197a  28 54        jr   z,0x19d0
 *   197c  3a a3 80     ld   a,(0x80a3)
 *   197f  32 a4 80     ld   (0x80a4),a
 *   1982  3e 03        ld   a,0x03
 *   1984  32 a2 80     ld   (0x80a2),a
 *   1987  3e 36        ld   a,0x36
 *   1989  32 69 80     ld   (0x8069),a
 *   198c  7b           ld   a,e
 *   198d  e6 07        and  0x07
 *   198f  28 28        jr   z,0x19b9
 *   1991  dd 7e 01     ld   a,(ix+0x01)
 *   1994  32 a6 80     ld   (0x80a6),a
 *   1997  fe 71        cp   0x71
 *   1999  38 1e        jr   c,0x19b9
 *   199b  fe 9a        cp   0x9a
 *   199d  30 1a        jr   nc,0x19b9
 *   199f  d6 71        sub  0x71
 *   19a1  06 00        ld   b,0x00
 *   19a3  cb 27        sla  a
 *   19a5  cb 27        sla  a
 *   19a7  cb 27        sla  a
 *   19a9  cb 10        rl   b
 *   19ab  4f           ld   c,a
 *   19ac  7b           ld   a,e
 *   19ad  e6 07        and  0x07
 *   19af  b1           or   c
 *   19b0  4f           ld   c,a
 *   19b1  21 b0 1f     ld   hl,0x1fb0
 *   19b4  09           add  hl,bc
 *   19b5  7e           ld   a,(hl)
 *   19b6  32 a8 80     ld   (0x80a8),a
 * loc_19b9:
 *   19b9  3a c1 80     ld   a,(0x80c1)
 *   19bc  a7           and  a
 *   19bd  ca 5b 1b     jp   z,0x1b5b
 *   19c0  3e 02        ld   a,0x02
 *   19c2  32 c1 80     ld   (0x80c1),a
 *   19c5  3e 40        ld   a,0x40
 *   19c7  32 b1 80     ld   (0x80b1),a
 *   19ca  cd 9f 4c     call 0x4c9f
 *   19cd  c3 5b 1b     jp   0x1b5b
 */
export function loc_191f(m) {
  const { regs, mem } = m;

  blk19b9: {
    blk1954: {
      blk194f: {
        blk1929: {
          // ---- Block A (0x191f): the [0x36,0x3a) escape ----
          regs.a = regs.b;
          m.step(0x1920, 4); // 191f  ld a,b -- tile code under the actor
          regs.cp(0x36);
          m.step(0x1922, 7); // 1920  cp 0x36
          if (regs.fC) {
            m.step(0x1929, 12); // 1922  jr c taken -- B < 0x36, on to loc_1929
            break blk1929;
          }
          m.step(0x1924, 7); // 1922  jr c not taken
          regs.cp(0x3a);
          m.step(0x1926, 7); // 1924  cp 0x3a
          if (regs.fC) {
            m.step(0x1b5b, 10); // 1926  jp c taken -- B in [0x36,0x3a): handled elsewhere
            return m.call(0x1b5b);
          }
          m.step(0x1929, 10); // 1926  jp c not taken -- fall into loc_1929
        }

        // ---- loc_1929 (0x1929): the exact-code table + range gates ----
        regs.cp(0x2a);
        m.step(0x192b, 7); // 1929  cp 0x2a
        if (regs.fZ) {
          m.step(0x19b9, 10); // 192b  jp z taken -> the latch tail
          break blk19b9;
        }
        m.step(0x192e, 10); // 192b  jp z not taken
        regs.cp(0x2b);
        m.step(0x1930, 7); // 192e  cp 0x2b
        if (regs.fZ) {
          m.step(0x19b9, 10); // 1930  jp z taken
          break blk19b9;
        }
        m.step(0x1933, 10); // 1930  jp z not taken
        regs.cp(0x41);
        m.step(0x1935, 7); // 1933  cp 0x41
        if (regs.fZ) {
          m.step(0x19b9, 10); // 1935  jp z taken
          break blk19b9;
        }
        m.step(0x1938, 10); // 1935  jp z not taken
        regs.cp(0xc1);
        m.step(0x193a, 7); // 1938  cp 0xc1
        if (regs.fZ) {
          m.step(0x19b9, 10); // 193a  jp z taken
          break blk19b9;
        }
        m.step(0x193d, 10); // 193a  jp z not taken
        regs.cp(0x95);
        m.step(0x193f, 7); // 193d  cp 0x95
        if (regs.fZ) {
          m.step(0x19b9, 10); // 193f  jp z taken
          break blk19b9;
        }
        m.step(0x1942, 10); // 193f  jp z not taken
        regs.cp(0xc4);
        m.step(0x1944, 7); // 1942  cp 0xc4
        if (regs.fZ) {
          m.step(0x194f, 12); // 1944  jr z taken -- 0xc4: check bit 2 of E
          break blk194f;
        }
        m.step(0x1946, 7); // 1944  jr z not taken
        regs.cp(0x96);
        m.step(0x1948, 7); // 1946  cp 0x96
        if (regs.fC) {
          m.step(0x1954, 12); // 1948  jr c taken -- B < 0x96, straight to the dig block
          break blk1954;
        }
        m.step(0x194a, 7); // 1948  jr c not taken
        regs.cp(0x9a);
        m.step(0x194c, 7); // 194a  cp 0x9a
        if (regs.fNC) {
          m.step(0x19d0, 10); // 194c  jp nc taken -- B >= 0x9a: nothing here, keep moving
          return m.call(0x19d0);
        }
        m.step(0x194f, 10); // 194c  jp nc not taken -- fall into loc_194f

        // ---- loc_194f (0x194f): the bit-2-of-E gate for 0xc4 / [0x96,0x9a) ----
      }
      regs.bit(2, regs.e);
      m.step(0x1951, 8); // 194f  bit 2,e -- Z = !(bit2 of E)
      if (regs.fNZ) {
        m.step(0x19b9, 10); // 1951  jp nz taken -- bit2 set -> the latch tail
        break blk19b9;
      }
      m.step(0x1954, 10); // 1951  jp nz not taken -- fall into loc_1954

      // ---- loc_1954 (0x1954): the "diggable" range + table lookups ----
    }
    regs.cp(0x71);
    m.step(0x1956, 7); // 1954  cp 0x71
    if (regs.fC) {
      m.step(0x19d0, 10); // 1956  jp c taken -- B < 0x71: keep moving
      return m.call(0x19d0);
    }
    m.step(0x1959, 10); // 1956  jp c not taken
    regs.cp(0x9a);
    m.step(0x195b, 7); // 1959  cp 0x9a
    if (regs.fNC) {
      m.step(0x19d0, 10); // 195b  jp nc taken -- B >= 0x9a: keep moving
      return m.call(0x19d0);
    }
    m.step(0x195e, 10); // 195b  jp nc not taken -- B in [0x71,0x9a): do the lookup

    regs.d = regs.a;
    m.step(0x195f, 4); // 195e  ld d,a -- keep the running tile code in D
    regs.sub(0x71);
    m.step(0x1961, 7); // 195f  sub 0x71 -- index base (tile - 0x71)
    regs.b = 0x00;
    m.step(0x1963, 7); // 1961  ld b,0x00
    regs.a = regs.sla(regs.a);
    m.step(0x1965, 8); // 1963  sla a
    regs.a = regs.sla(regs.a);
    m.step(0x1967, 8); // 1965  sla a
    regs.a = regs.sla(regs.a);
    m.step(0x1969, 8); // 1967  sla a -- (tile-0x71) << 3, bit 8 spilt to carry
    regs.b = regs.rl(regs.b);
    m.step(0x196b, 8); // 1969  rl b -- catch that carry as BC bit 8
    regs.c = regs.a;
    m.step(0x196c, 4); // 196b  ld c,a
    regs.a = regs.e;
    m.step(0x196d, 4); // 196c  ld a,e
    regs.and(0x07);
    m.step(0x196f, 7); // 196d  and 0x07 -- sub-tile offset (E & 7)
    regs.or(regs.c);
    m.step(0x1970, 4); // 196f  or c
    regs.c = regs.a;
    m.step(0x1971, 4); // 1970  ld c,a -- BC = ((tile-0x71)<<3) | (E&7)
    regs.hl = 0x1e48;
    m.step(0x1974, 10); // 1971  ld hl,0x1e48 -- the "under" tile table
    regs.addHl(regs.bc);
    m.step(0x1975, 11); // 1974  add hl,bc
    regs.a = mem.read8(regs.hl);
    m.step(0x1976, 7); // 1975  ld a,(hl) -- expected tile
    mem.write8(0x80a7, regs.a);
    m.step(0x1979, 13); // 1976  ld (0x80a7),a
    regs.cp(regs.d);
    m.step(0x197a, 4); // 1979  cp d -- matches the running tile?
    if (regs.fZ) {
      m.step(0x19d0, 12); // 197a  jr z taken -- same tile, no reaction; keep moving
      return m.call(0x19d0);
    }
    m.step(0x197c, 7); // 197a  jr z not taken -- mismatch: stage the reaction

    regs.a = mem.read8(0x80a3);
    m.step(0x197f, 13); // 197c  ld a,(0x80a3)
    mem.write8(0x80a4, regs.a);
    m.step(0x1982, 13); // 197f  ld (0x80a4),a
    regs.a = 0x03;
    m.step(0x1984, 7); // 1982  ld a,0x03
    mem.write8(0x80a2, regs.a);
    m.step(0x1987, 13); // 1984  ld (0x80a2),a
    regs.a = 0x36;
    m.step(0x1989, 7); // 1987  ld a,0x36
    mem.write8(0x8069, regs.a);
    m.step(0x198c, 13); // 1989  ld (0x8069),a
    regs.a = regs.e;
    m.step(0x198d, 4); // 198c  ld a,e
    regs.and(0x07);
    m.step(0x198f, 7); // 198d  and 0x07 -- on an 8-cell boundary the neighbour lookup is skipped
    if (regs.fZ) {
      m.step(0x19b9, 12); // 198f  jr z taken -- (E&7)==0, straight to the latch tail
      break blk19b9;
    }
    m.step(0x1991, 7); // 198f  jr z not taken -- also look up the neighbour cell

    regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
    m.step(0x1994, 19); // 1991  ld a,(ix+0x01) -- neighbour tile code
    mem.write8(0x80a6, regs.a);
    m.step(0x1997, 13); // 1994  ld (0x80a6),a
    regs.cp(0x71);
    m.step(0x1999, 7); // 1997  cp 0x71
    if (regs.fC) {
      m.step(0x19b9, 12); // 1999  jr c taken -- neighbour < 0x71: no second lookup
      break blk19b9;
    }
    m.step(0x199b, 7); // 1999  jr c not taken
    regs.cp(0x9a);
    m.step(0x199d, 7); // 199b  cp 0x9a
    if (regs.fNC) {
      m.step(0x19b9, 12); // 199d  jr nc taken -- neighbour >= 0x9a: no second lookup
      break blk19b9;
    }
    m.step(0x199f, 7); // 199d  jr nc not taken -- neighbour in [0x71,0x9a): look it up

    regs.sub(0x71);
    m.step(0x19a1, 7); // 199f  sub 0x71
    regs.b = 0x00;
    m.step(0x19a3, 7); // 19a1  ld b,0x00
    regs.a = regs.sla(regs.a);
    m.step(0x19a5, 8); // 19a3  sla a
    regs.a = regs.sla(regs.a);
    m.step(0x19a7, 8); // 19a5  sla a
    regs.a = regs.sla(regs.a);
    m.step(0x19a9, 8); // 19a7  sla a
    regs.b = regs.rl(regs.b);
    m.step(0x19ab, 8); // 19a9  rl b
    regs.c = regs.a;
    m.step(0x19ac, 4); // 19ab  ld c,a
    regs.a = regs.e;
    m.step(0x19ad, 4); // 19ac  ld a,e
    regs.and(0x07);
    m.step(0x19af, 7); // 19ad  and 0x07
    regs.or(regs.c);
    m.step(0x19b0, 4); // 19af  or c
    regs.c = regs.a;
    m.step(0x19b1, 4); // 19b0  ld c,a -- BC = ((neighbour-0x71)<<3) | (E&7)
    regs.hl = 0x1fb0;
    m.step(0x19b4, 10); // 19b1  ld hl,0x1fb0 -- the neighbour tile table
    regs.addHl(regs.bc);
    m.step(0x19b5, 11); // 19b4  add hl,bc
    regs.a = mem.read8(regs.hl);
    m.step(0x19b6, 7); // 19b5  ld a,(hl)
    mem.write8(0x80a8, regs.a);
    m.step(0x19b9, 13); // 19b6  ld (0x80a8),a -- fall into loc_19b9

    // ---- loc_19b9 (0x19b9): arm the state + request sound, or bail ----
  }
  regs.a = mem.read8(0x80c1);
  m.step(0x19bc, 13); // 19b9  ld a,(0x80c1) -- is this actor armed?
  regs.and(regs.a);
  m.step(0x19bd, 4); // 19bc  and a -- Z iff 0x80c1 == 0
  if (regs.fZ) {
    m.step(0x1b5b, 10); // 19bd  jp z taken -- not armed; just rebuild + ret
    return m.call(0x1b5b);
  }
  m.step(0x19c0, 10); // 19bd  jp z not taken
  regs.a = 0x02;
  m.step(0x19c2, 7); // 19c0  ld a,0x02
  mem.write8(0x80c1, regs.a);
  m.step(0x19c5, 13); // 19c2  ld (0x80c1),a -- set state 2
  regs.a = 0x40;
  m.step(0x19c7, 7); // 19c5  ld a,0x40
  mem.write8(0x80b1, regs.a);
  m.step(0x19ca, 13); // 19c7  ld (0x80b1),a
  m.push16(0x19cd);
  m.step(0x4c9f, 17); // 19ca  call 0x4c9f -- request sound 0x14
  m.call(0x4c9f);
  m.step(0x1b5b, 10); // 19cd  jp 0x1b5b -- tail-jump; loc_1b5b's ret unwinds to OUR caller
  return m.call(0x1b5b);
}
