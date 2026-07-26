// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_16b9  (ROM 0x16b9-0x1703) — the row-index common path from loc_167f: turn
 * the tile row in H into a tilemap pointer, peek two cells of the map, and decide
 * whether this actor has reached a "0x27" terminator cell (rescue/goal) or should
 * keep being processed by the collision handler at 0x1704.
 *
 * The routine is entered via the tail-jump at loc_167f (H = the tile row, L = a
 * caller sprite/state code). It has three internal blocks; two of them are only
 * reachable from within this routine, so they are inlined rather than split into
 * their own files (the loc_1659 discipline — loc_166d/loc_1679 were inlined the
 * same way):
 *
 *   HEAD (16b9-16c2): if mem[0x80e7] (the "already-latched" flag) is zero, jump
 *     straight to the pointer computation. Otherwise, if L == 0x17 the actor is
 *     already at the terminator sprite, so short-circuit into the FB block with A
 *     still holding L; else fall into the pointer computation.
 *
 *   C4block (16c4-16f9): build a VRAM pointer into 0x9000 from the column at
 *     0x806b (>>3 gives the tile column, kept in BC) and the row in H (three
 *     `srl h / rra` groups slide H's low 3 bits down into A's top, giving the row
 *     * 0x20 tilemap stride), store it to 0x806e, load IX from it, and test the
 *     cell one past it (ix+0x01) and the cell a full row further (ix+0x21) against
 *     0x27. Either cell == 0x27 -> FB block; both != 0x27 -> tail-jump loc_1704.
 *
 *   FB block (16fb-1701): latch whatever A holds into mem[0x80e7] and mem[0x8077],
 *     then tail-jump 0x19d0. A is L (from HEAD), or 0x27 (a matched cell) — the
 *     value the tail then acts on. Reached from three sites (16c2 jr z, 16f2 jr z,
 *     16f9 fall-through), so it is factored into loc_16b9_fb and direct-called.
 *
 * FLAG NOTES: the three `srl a` and three `srl h` each set carry from a shifted-out
 * bit, and each `rra` consumes the carry left by the preceding `srl h` — that carry
 * chain is the whole point of the sequence, modelled faithfully via regs.srl/regs.rra.
 * The `add hl,bc` pair leaves S/Z/PV alone; nothing reads them before the next
 * flag-setter (`cp`). Every `jr` here reads the Z set by the `and a`/`cp` right
 * before it (no flag-neutral instruction wedged between, unlike loc_1659).
 *
 * CONTROL FLOW: every exit is a jump-out, so each is a tail-jump — `return
 * m.call(target)` with no trailing m.ret, so the callee's own ret returns to OUR
 * caller (loc_167f's caller). Targets: 0x19d0 (FB) and 0x1704 (the collision arm).
 *
 *   16b9  3a e7 80     ld   a,(0x80e7)
 *   16bc  a7           and  a
 *   16bd  28 05        jr   z,0x16c4
 *   16bf  7d           ld   a,l
 *   16c0  fe 17        cp   0x17
 *   16c2  28 37        jr   z,0x16fb
 *   16c4  3a 6b 80     ld   a,(0x806b)      ; loc_16c4
 *   16c7  c6 05        add  a,0x05
 *   16c9  57           ld   d,a
 *   16ca  cb 3f        srl  a
 *   16cc  cb 3f        srl  a
 *   16ce  cb 3f        srl  a
 *   16d0  32 71 80     ld   (0x8071),a
 *   16d3  4f           ld   c,a
 *   16d4  3e 00        ld   a,0x00
 *   16d6  47           ld   b,a
 *   16d7  cb 3c        srl  h
 *   16d9  1f           rra
 *   16da  cb 3c        srl  h
 *   16dc  1f           rra
 *   16dd  cb 3c        srl  h
 *   16df  1f           rra
 *   16e0  6f           ld   l,a
 *   16e1  09           add  hl,bc
 *   16e2  01 00 90     ld   bc,0x9000
 *   16e5  09           add  hl,bc
 *   16e6  22 6e 80     ld   (0x806e),hl
 *   16e9  dd 2a 6e 80  ld   ix,(0x806e)
 *   16ed  dd 7e 01     ld   a,(ix+0x01)
 *   16f0  fe 27        cp   0x27
 *   16f2  28 07        jr   z,0x16fb
 *   16f4  dd 7e 21     ld   a,(ix+0x21)
 *   16f7  fe 27        cp   0x27
 *   16f9  20 09        jr   nz,0x1704
 *   16fb  32 e7 80     ld   (0x80e7),a      ; loc_16fb
 *   16fe  32 77 80     ld   (0x8077),a
 *   1701  c3 d0 19     jp   0x19d0
 */
export function loc_16b9(m) {
  const { regs, mem } = m;

  // -- HEAD: 16b9-16c2 --
  regs.a = mem.read8(0x80e7);
  m.step(0x16bc, 13); // ld a,(0x80e7) -- the "already latched" flag
  regs.and(regs.a);
  m.step(0x16bd, 4); // and a -- Z set iff the flag is zero
  if (regs.fZ) {
    m.step(0x16c4, 12); // jr z taken -- flag zero, go straight to the pointer build
  } else {
    m.step(0x16bf, 7); // jr z not taken
    regs.a = regs.l;
    m.step(0x16c0, 4); // ld a,l -- the caller sprite/state code
    regs.cp(0x17);
    m.step(0x16c2, 7); // cp 0x17 -- Z set iff already at the terminator sprite
    if (regs.fZ) {
      m.step(0x16fb, 12); // jr z taken -- short-circuit into FB with A = L
      return loc_16b9_fb(m);
    }
    m.step(0x16c4, 7); // jr z not taken -- fall into the pointer build
  }

  // -- C4block: 16c4-16f9 -- build the VRAM pointer, peek two cells
  regs.a = mem.read8(0x806b);
  m.step(0x16c7, 13); // ld a,(0x806b) -- the pixel column
  regs.add(0x05);
  m.step(0x16c9, 7); // add a,0x05 -- rounding bias
  regs.d = regs.a;
  m.step(0x16ca, 4); // ld d,a -- keep the biased column in D
  regs.a = regs.srl(regs.a);
  m.step(0x16cc, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x16ce, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x16d0, 8); // srl a -- A = column >> 3 (tile column)
  mem.write8(0x8071, regs.a);
  m.step(0x16d3, 13); // ld (0x8071),a -- store the tile column
  regs.c = regs.a;
  m.step(0x16d4, 4); // ld c,a -- low byte of the column offset
  regs.a = 0x00;
  m.step(0x16d6, 7); // ld a,0x00
  regs.b = regs.a;
  m.step(0x16d7, 4); // ld b,a -- BC = tile column (high byte 0)
  regs.h = regs.srl(regs.h);
  m.step(0x16d9, 8); // srl h -- carry = row bit shifted out
  regs.rra();
  m.step(0x16da, 4); // rra -- slide it into A's top bit
  regs.h = regs.srl(regs.h);
  m.step(0x16dc, 8); // srl h
  regs.rra();
  m.step(0x16dd, 4); // rra
  regs.h = regs.srl(regs.h);
  m.step(0x16df, 8); // srl h
  regs.rra();
  m.step(0x16e0, 4); // rra -- A now holds the row * 0x20 stride (low byte)
  regs.l = regs.a;
  m.step(0x16e1, 4); // ld l,a -- HL = H:L = row-stride word
  regs.addHl(regs.bc);
  m.step(0x16e2, 11); // add hl,bc -- add the tile column
  regs.bc = 0x9000;
  m.step(0x16e5, 10); // ld bc,0x9000 -- the tilemap base
  regs.addHl(regs.bc);
  m.step(0x16e6, 11); // add hl,bc -- HL = &tilemap[row,col]
  mem.write16(0x806e, regs.hl);
  m.step(0x16e9, 16); // ld (0x806e),hl -- stash the pointer
  regs.ix = mem.read16(0x806e);
  m.step(0x16ed, 20); // ld ix,(0x806e) -- reload it into IX
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x16f0, 19); // ld a,(ix+0x01) -- the cell one past the pointer
  regs.cp(0x27);
  m.step(0x16f2, 7); // cp 0x27 -- Z set iff that cell is the terminator
  if (regs.fZ) {
    m.step(0x16fb, 12); // jr z taken -- terminator reached, latch it
    return loc_16b9_fb(m);
  }
  m.step(0x16f4, 7); // jr z not taken
  regs.a = mem.read8((regs.ix + 0x21) & 0xffff);
  m.step(0x16f7, 19); // ld a,(ix+0x21) -- the cell a full row further on
  regs.cp(0x27);
  m.step(0x16f9, 7); // cp 0x27 -- Z set iff THAT cell is the terminator
  if (regs.fNZ) {
    m.step(0x1704, 12); // jr nz taken -- neither cell matched, hand off to loc_1704
    return m.call(0x1704);
  }
  m.step(0x16fb, 7); // jr nz not taken -- (ix+0x21) matched, fall into FB

  // -- FB block: 16fb-1701 (fall-through entry) --
  return loc_16b9_fb(m);
}

/**
 * loc_16b9_fb -- the FB tail (ROM 0x16fb-0x1701), shared by all three entries into
 * it. Latch A into mem[0x80e7] and mem[0x8077], then tail-jump 0x19d0. A on entry
 * is either L (the HEAD short-circuit) or 0x27 (a matched terminator cell). Not a
 * routine of its own (reached only from within loc_16b9), so it is a plain helper:
 * no address claim, direct-called, and the closing `jp 0x19d0` stays a tail-jump.
 */
function loc_16b9_fb(m) {
  const { regs, mem } = m;
  mem.write8(0x80e7, regs.a);
  m.step(0x16fe, 13); // ld (0x80e7),a -- latch the terminator/state byte
  mem.write8(0x8077, regs.a);
  m.step(0x1701, 13); // ld (0x8077),a -- and a second copy
  m.step(0x19d0, 10); // jp 0x19d0 -- tail-jump to the goal/latched handler
  return m.call(0x19d0);
}
