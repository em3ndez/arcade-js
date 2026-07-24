// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_13ca — hand-optimized rewrite of the translated routine at ROM 0x13CA,
 * proven equal to its oracle by the equivalence harness. It works the score-display /
 * high-score buffer (0x61A5-0x61CA, unnamed in ram.js), so those stay hex.
 */

/**
 * sub_13ca -- format a score and insertion-sort it into the high-score table.  [ROM 0x13CA-0x141D]
 *
 * Two callers. A is the entry index, HL points at the 3-byte packed (BCD) score.
 *   - Store A at 0x61C6, then rst 0x08 -- a skip-capable guard: if bit 0 of 0x6007 is set it
 *     aborts back to the caller (the sub_0008 false convention).
 *   - ldir the 3 score bytes to 0x61C7.
 *   - BCD UNPACK (x3): each score byte becomes two digit nibbles (high via rrca x4 + and
 *     0x0F, then low via re-read + and 0x0F) written forward from 0x61B1 -- 6 digits.
 *   - Pad with 14 blank tiles (0x10) and a 0x3F terminator.
 *   - INSERTION SORT (up to 5 passes) from 0x61A5 / 0x61C7: a 3-byte multi-precision
 *     subtract (sub then sbc, sbc) compares the candidate against the table entry; on borrow
 *     (candidate smaller) it stops (ret c); otherwise it SWAPS the two 25-byte records
 *     backward, steps both pointers back 11, and continues -- a bubble-up into the table.
 *
 * The four rrca are explicit (not a loop); `sbc a,(hl)` chains the borrow across the three
 * bytes; the 25-byte swap preserves the outer count via push/pop bc.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). The
 * BCD-unpack loop (fixed 3 iterations), the blank-fill loop (fixed 14) and the
 * 25-byte swap loop (fixed 25, per outer pass) are FIXED trip counts (the loop
 * register is never touched by data inside the loop), so only the loop BODY folds;
 * each djnz's own branch charge (13 taken / 8 not-taken) stays a separate step, as
 * does the insertion sort's `ret c` early-exit test (the one genuinely
 * data-dependent branch here). No hardware-bus write occurs anywhere in this
 * routine (all stores are 0x61xx/0x63xx-range work RAM), so nothing else pins a
 * boundary. `m.call(0x0008)` (the rst 0x08 skip-guard) and `m.ldir` (the fixed-site
 * block copy) are left exactly as the oracle invokes them -- both are call-like
 * boundaries, never folded across.
 */
export function sub_13ca(m) {
  const { regs, mem } = m;

  // Block: ld de,0x61c6 (10) + ld (de),a (7) = 17 t, exit right before rst 0x08.
  regs.de = 0x61c6;
  mem.write8(regs.de, regs.a); // store the A parameter
  m.step(0x13ce, 17);

  m.push16(0x13cf); // rst 0x08 pushes its return address
  m.step(0x0008, 11);
  if (!m.call(0x0008)) return; // SKIP: bit0 of 0x6007 set -> aborted to caller

  // Block: inc de (6) + ld bc,3 (10) = 16 t, exit right before the fixed-site ldir.
  regs.de = (regs.de + 1) & 0xffff; // DE = 0x61C7
  regs.bc = 0x0003;
  m.step(0x13d3, 16);
  m.ldir(0x13d5); // copy 3 bytes HL(param) -> 0x61C7. Leaves DE=0x61CA, HL=src+3

  // -- BCD unpack (x3, FIXED trip count): each source byte -> high nibble then
  // low nibble. Loop prologue: ld b,3 (7) + ld hl,0x61b1 (10) = 17 t.
  regs.b = 0x03;
  regs.hl = 0x61b1;
  m.step(0x13da, 17);
  do {
    // Loop body (folds across the whole iteration; djnz's own charge stays a
    // separate step below): dec de(6)+ld a,(de)(7)+4x rrca(4 each=16)+and 0f(7)+
    // ld (hl),a(7)+inc hl(6)+ld a,(de)(7)+and 0f(7)+ld (hl),a(7)+inc hl(6) = 76 t.
    regs.de = (regs.de - 1) & 0xffff;
    regs.a = mem.read8(regs.de);
    regs.rrca(); regs.rrca(); regs.rrca(); regs.rrca(); // four explicit rrca -- NOT a loop
    regs.and(0x0f); // high nibble
    mem.write8(regs.hl, regs.a);
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.a = mem.read8(regs.de); // re-read
    regs.and(0x0f); // low nibble
    mem.write8(regs.hl, regs.a);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x13e9, 76);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x13da : 0x13eb, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  // -- fill 14 blanks (0x10, FIXED trip count) then a 0x3F terminator --
  regs.b = 0x0e;
  m.step(0x13ed, 7);
  do {
    // Loop body: ld (hl),0x10 (10) + inc hl (6) = 16 t; djnz stays a separate step.
    mem.write8(regs.hl, 0x10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x13f0, 16);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x13ed : 0x13f2, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  mem.write8(regs.hl, 0x3f);
  m.step(0x13f4, 10);

  // -- insertion sort: up to 5 passes -- prologue: ld b,5(7)+ld hl,0x61a5(10)+
  // ld de,0x61c7(10) = 27 t, executed ONCE before the loop (a `continue` re-enters
  // the for(;;) body below with hl/de already advanced by the previous pass, not
  // this prologue).
  regs.b = 0x05;
  regs.hl = 0x61a5;
  regs.de = 0x61c7;
  m.step(0x13fc, 27);
  for (;;) {
    // 3-byte multi-precision subtract (de[] - hl[]), the one data-dependent branch
    // here: sub+2x sbc chained across 3 byte pairs (with the hl/de walks between
    // them) = 66 t, exit right before the `ret c` test.
    regs.a = mem.read8(regs.de);
    regs.sub(mem.read8(regs.hl)); // sets borrow
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.de = (regs.de + 1) & 0xffff;
    regs.a = mem.read8(regs.de);
    regs.sbc(mem.read8(regs.hl)); // carry chain
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.de = (regs.de + 1) & 0xffff;
    regs.a = mem.read8(regs.de);
    regs.sbc(mem.read8(regs.hl));
    m.step(0x1406, 66);
    if (regs.fC) { m.ret(11); return; } // ret c -- candidate smaller, stop

    // (jr not taken 5) + push16(outer B) (11) + ld b,0x19 (7) = 23 t, exit right
    // before the swap loop. push16 must run BEFORE b is overwritten (it saves the
    // OUTER pass counter), so the call stays in its original sequence position.
    m.push16(regs.bc); // save outer B (the current pass counter)
    regs.b = 0x19;
    m.step(0x140a, 23);
    do {
      // swap 25 bytes backward (FIXED trip count): ld c,(hl)(7)+ld a,(de)(7)+
      // ld (hl),a(7)+ld a,c(4)+ld (de),a(7)+dec hl(6)+dec de(6) = 44 t; djnz stays
      // a separate step.
      regs.c = mem.read8(regs.hl);
      regs.a = mem.read8(regs.de);
      mem.write8(regs.hl, regs.a);
      regs.a = regs.c;
      mem.write8(regs.de, regs.a);
      regs.hl = (regs.hl - 1) & 0xffff;
      regs.de = (regs.de - 1) & 0xffff;
      m.step(0x1411, 44);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x140a : 0x1413, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);

    // ld bc,-11(10) + addHl(11) + exDeHl(4) + addHl(11) + exDeHl(4) + pop bc(10)
    // (restore the outer count) = 50 t, exit right before the outer djnz test.
    regs.bc = 0xfff5; // -11
    regs.addHl(regs.bc); // HL -= 11
    regs.exDeHl();
    regs.addHl(regs.bc); // the other pointer -= 11
    regs.exDeHl();
    regs.bc = m.pop16(); // restore outer B
    m.step(0x141b, 50);
    regs.djnz();
    if (regs.b !== 0) { m.step(0x13fc, 13); continue; }
    m.step(0x141d, 8);
    m.ret();
    return;
  }
}
