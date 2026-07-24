// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e4f — hand-optimized rewrite of the translated routine at ROM 0x0E4F,
 * proven equal to its oracle by the equivalence harness. It touches only board-render
 * scratch (0x63AB/0x63AF/0x63B1/0x63B2/0x63B3/0x63B5, currently unnamed) and video RAM,
 * so no ram.js name is imported.
 */

/**
 * loc_0e4f -- draw a slanted (diagonal) board element.  [ROM 0x0E4F-0x0ED2]
 *
 * The record-kind>=2 arm of the board-layout renderer (loc_0dd3 jumps here on `jp p`).
 * If the kind is exactly 2 it runs a small state machine that walks the run cell by
 * cell, laying the base tile (0x63B5, seeded from 0x63AF+0xF0) and, every 32 columns
 * (the `l & 0x1F == 0` page-wrap tests), stepping HL by 0x1F to the next tilemap row and
 * nudging the tile code so the element SLANTS — climbing (`inc`) or, when the x-delta
 * (0x63B2 bit 7) is negative, descending (`dec`), wrapping the tile code at the 0xF0/0xF8
 * boundaries. It advances the vertical extent 0x63B1 by 8 each row until it borrows, then
 * steps DE past the record and re-enters the walk at 0x0DA7. For kind 3 or more it tails
 * to loc_0ee8 (strip drawer / entry_0f1b).
 *
 * The `at` variable names the ROM block about to run; each assignment mirrors a `jp` in
 * the listing (the translation's faithful model of the routine's internal jumps).
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (each straight-line run's per-
 * instruction charges folded into a single charge at the run's exit PC, exactly like
 * sub_0350). A "not taken" branch charge is folded FORWARD into whatever unconditional
 * code immediately follows it (its own convention, same as sub_0350's block B) since a
 * fallthrough has exactly one predecessor; a "taken" branch that lands on a real MERGE
 * point (an `at` state reached from more than one edge, e.g. 0x0e78/0x0ea0/0x0e62/0x0ecf)
 * keeps its own single charge, unfoldable forward, because that merge's own block runs
 * fresh regardless of which edge arrived. Every branch TOTAL sums to the oracle's,
 * EXACTLY (verified against translated/nmi.js's per-instruction charges below; the
 * `and 0x1f`x3 row-boundary tests and the `jp p` sign test at 0x0EDC are untouched --
 * only the m.step granularity changes, never the flags/values/order). The `jp 0x0da7`
 * tail is a bare charge (no push, folded with the preceding `inc de`) and loc_0ee8 is
 * reached through m.call (the registry), matching the translation.
 *
 * NOT provably mask-cleared on every path (a draw primitive of sub_0da7, itself reached
 * from board-setup init AND the per-frame board-record path) -- so this collapse is
 * gated the same way sub_0350's is: if the strict whole-machine test still passes,
 * every predecessor that reaches it in the harness's exercised frames happens to run
 * mask-disabled (ATOMIC in practice) and the test file is left unchanged; otherwise the
 * test is swapped to the convergent gate (see test/equivalence-0e4f.test.js's own note
 * for which applies).
 */
export function loc_0e4f(m) {
  const { regs, mem } = m;

  // Block: ld a,(0x63b3)[13] + cp 0x02[7] -- kind dispatch.  20 t
  regs.a = mem.read8(0x63b3);
  regs.cp(0x02);
  m.step(0x0e54, 20);
  if (regs.fNZ) {
    m.step(0x0ee8, 10); // jp nz -- kind 3 or more (fixed-cost jp, taken)
    return m.call(0x0ee8);
  }
  m.step(0x0e57, 10); // jp nz not taken (fixed-cost jp)

  // Block: ld a,(63af)[13]+add 0xf0[7]+ld (63b5),a[13]+ld hl,(63ab)[16] -- seed the walk.  49 t
  regs.a = mem.read8(0x63af);
  regs.add(0xf0);
  mem.write8(0x63b5, regs.a);
  regs.hl = mem.read16(0x63ab);
  m.step(0x0e62, 49);

  let at = 0x0e62;
  for (;;) {
    if (at === 0x0e62) {
      // ld a,(63b5)[13]+ld (hl),a[7]+inc hl[6]+ld a,l[4]+and 0x1f[7] -- lay tile, row test.  37 t
      regs.a = mem.read8(0x63b5);
      mem.write8(regs.hl, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = regs.l;
      regs.and(0x1f);
      m.step(0x0e6a, 37);
      if (regs.fZ) { m.step(0x0e78, 10); at = 0x0e78; continue; } // jp z taken -- merge, alone
      // jp z not-taken[10]+ld a,(63b5)[13]+cp 0xf0[7] -- second row test.  30 t
      regs.a = mem.read8(0x63b5);
      regs.cp(0xf0);
      m.step(0x0e72, 30);
      if (regs.fZ) { m.step(0x0e78, 10); at = 0x0e78; continue; } // jp z taken -- merge, alone
      // jp z not-taken[10]+sub 0x10[7]+ld (hl),a[7] -- wrap the tile code, enter 0e78.  24 t
      regs.sub(0x10);
      mem.write8(regs.hl, regs.a);
      m.step(0x0e78, 24);
      at = 0x0e78;
      continue;
    }

    if (at === 0x0e78) {
      // ld bc,0x1f[10]+add hl,bc[11]+ld a,(63b1)[13]+sub 8[7] -- advance row, height test.  41 t
      regs.bc = 0x001f;
      regs.addHl(regs.bc);
      regs.a = mem.read8(0x63b1);
      regs.sub(0x08);
      m.step(0x0e81, 41);
      if (regs.fC) { m.step(0x0ecf, 10); at = 0x0ecf; continue; } // jp c taken -- merge, alone
      // jp c not-taken[10]+ld(63b1),a[13]+ld a,(63b2)[13]+cp 0[7] -- x-delta test.  43 t
      mem.write8(0x63b1, regs.a);
      regs.a = mem.read8(0x63b2);
      regs.cp(0x00);
      m.step(0x0e8c, 43);
      if (regs.fZ) { m.step(0x0e62, 10); at = 0x0e62; continue; } // jp z taken -- merge, alone
      // jp z not-taken[10]+ld a,(63b5)[13]+ld(hl),a[7]+inc hl[6]+ld a,l[4]+and 0x1f[7] -- lay + row test.  47 t
      regs.a = mem.read8(0x63b5);
      mem.write8(regs.hl, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = regs.l;
      regs.and(0x1f);
      m.step(0x0e97, 47);
      if (regs.fZ) { m.step(0x0ea0, 10); at = 0x0ea0; continue; } // jp z taken -- merge, alone
      // jp z not-taken[10]+ld a,(63b5)[13]+sub 0x10[7]+ld(hl),a[7] -- wrap, enter 0ea0.  37 t
      regs.a = mem.read8(0x63b5);
      regs.sub(0x10);
      mem.write8(regs.hl, regs.a);
      m.step(0x0ea0, 37);
      at = 0x0ea0;
      continue;
    }

    if (at === 0x0ea0) {
      // ld bc,0x1f[10]+add hl,bc[11]+ld a,(63b1)[13]+sub 8[7] -- advance row, height test.  41 t
      regs.bc = 0x001f;
      regs.addHl(regs.bc);
      regs.a = mem.read8(0x63b1);
      regs.sub(0x08);
      m.step(0x0ea9, 41);
      if (regs.fC) { m.step(0x0ecf, 10); at = 0x0ecf; continue; } // jp c taken -- merge, alone
      // jp c not-taken[10]+ld(63b1),a[13]+ld a,(63b2)[13]+bit 7,a[8] -- sign test.  44 t
      mem.write8(0x63b1, regs.a);
      regs.a = mem.read8(0x63b2);
      const neg = regs.bit(7, regs.a); // x-delta negative -> slant the other way
      m.step(0x0eb4, 44);
      if (neg) { m.step(0x0ed3, 10); at = 0x0ed3; continue; } // jp m taken -- single pred, alone
      // jp p not-taken[10]+ld a,(63b5)[13]+inc a[4]+ld(63b5),a[13]+cp 0xf8[7] -- climb + wrap test.  47 t
      regs.a = mem.read8(0x63b5);
      regs.a = regs.inc8(regs.a);
      mem.write8(0x63b5, regs.a);
      regs.cp(0xf8);
      m.step(0x0ec0, 47);
      if (regs.fNZ) { m.step(0x0ec9, 10); at = 0x0ec9; continue; } // jp nz taken -- merge, alone
      // jp nz not-taken[10]+inc hl[6]+ld a,0xf0[7]+ld(63b5),a[13] -- wrap the tile code.  36 t
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = 0xf0;
      mem.write8(0x63b5, regs.a);
      m.step(0x0ec9, 36);
      at = 0x0ec9;
      continue;
    }

    if (at === 0x0ec9) {
      // ld a,l[4]+and 0x1f[7] -- row test.  11 t
      regs.a = regs.l;
      regs.and(0x1f);
      m.step(0x0ecc, 11);
      if (regs.fNZ) { m.step(0x0e62, 10); at = 0x0e62; continue; } // jp nz taken -- merge, alone
      m.step(0x0ecf, 10); // jp nz not-taken -- merge, alone
      at = 0x0ecf;
      continue;
    }

    if (at === 0x0ed3) {
      // ld a,(63b5)[13]+dec a[4]+ld(63b5),a[13]+cp 0xf0[7] -- descend + wrap test.  37 t
      regs.a = mem.read8(0x63b5);
      regs.a = regs.dec8(regs.a);
      mem.write8(0x63b5, regs.a);
      regs.cp(0xf0);
      m.step(0x0edc, 37);
      if (regs.fP) { m.step(0x0ee5, 10); at = 0x0ee5; continue; } // jp p taken -- alone
      // jp p not-taken[10]+dec hl[6]+ld a,0xf7[7]+ld(63b5),a[13] -- wrap the tile code.  36 t
      regs.hl = (regs.hl - 1) & 0xffff;
      regs.a = 0xf7;
      mem.write8(0x63b5, regs.a);
      m.step(0x0ee5, 36);
      at = 0x0ee5;
      continue;
    }

    if (at === 0x0ee5) {
      m.step(0x0e62, 10); // jp 0x0e62 -- unconditional, fixed-cost
      at = 0x0e62;
      continue;
    }

    // loc_0ecf -- inc de[6]+jp 0x0da7[10] -- step past the record, re-enter the walk (bare jp).  16 t
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0da7, 16);
    return;
  }
}
