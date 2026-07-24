// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e19 — hand-optimized rewrite of the translated routine at ROM 0x0E19,
 * proven equal to its oracle by the equivalence harness. Stores land in video RAM
 * and board-render scratch (0x63B2, currently unnamed), so no ram.js name is imported.
 */

/**
 * loc_0e19 -- draw a vertical run of girder/ladder cells.  [ROM 0x0E19-0x0E29]
 *
 * A draw primitive of the board-layout renderer (sub_0da7 walks the ROM layout table
 * and dispatches here for a "vertical run" op). It repeatedly steps the span counter
 * at 0x63B2 down by 8 and, while it has not underflowed, stamps tile 0xC0 into the
 * next cell down the tilemap column (HL advanced by `inc l`, which wraps within the
 * 32-cell page). When the subtraction borrows (carry), the span is exhausted and it
 * tail-jumps into loc_0e2a (its `ret` returns to loc_0e19's caller).
 *
 *   loop: a = (0x63B2); a -= 8; (0x63B2) = a
 *         if carry -> jp loc_0e2a         ; span done
 *         inc l ; (hl) = 0xC0 ; jp loop   ; draw one cell, continue
 *
 * INPUTS : 0x63B2 (span counter, in units of 8), HL (current tilemap cell).
 * OUTPUTS: 0x63B2 decremented past 0; video RAM cells = 0xC0; HL advanced. F = the
 *          final `sub 0x08` (the `inc l` sets none observable at the tail).
 *
 * CYCLES -- COLLAPSED to one m.step per basic block: the span-decrement test (read/sub/
 * store/carry-test) is one block, and the draw-one-cell continuation is another. loc_0e19
 * is a draw primitive of sub_0da7, which is reached from many callers (board-setup
 * handlers -- confirmed atomic, dispatched inside the mask-cleared NMI -- but also the
 * intro/how-high steppers loc_17b6/loc_1880, themselves reached via dispatchGameState too,
 * so likely the SAME non-interruptible family; not independently re-verified here). Per the
 * lead's rule the whole-machine gate is the CONVERGENT one regardless of whether strict
 * still passes after the collapse, since a pass is a property of the tested scenario, not a
 * proof of atomicity. Each fold's total is the exact sum of the oracle's per-instruction
 * charges it replaces: span-test block 13+7+13=33t continuing to a carry test that itself
 * folds in the jp's charge (33+10=43t not-carry / 33+10=43t carry -- both jp arms cost the
 * same 10t, so the merge is uniform); draw block 4+10+10=24t. No 0x7Dxx hardware latch is
 * written (VRAM tilemap + work RAM only), so nothing here needs a partial-collapse boundary.
 */
export function loc_0e19(m) {
  const { regs, mem } = m;

  for (;;) {
    // span-decrement block: a = (0x63B2) - 8; store back; test carry. 13+7+13 = 33t,
    // then the `jp c` itself is 10t on EITHER arm -- folded into the same charge.
    regs.a = mem.read8(0x63b2);
    regs.sub(0x08);
    mem.write8(0x63b2, regs.a);
    if (regs.fC) {
      m.step(0x0e2a, 43); // jp c taken -- fall into loc_0e2a
      break;
    }
    m.step(0x0e24, 43); // jp c not taken

    // draw one 0xC0 cell down the column, then loop. inc l(4) + ld (hl),0xc0(10) + jp(10) = 24t
    regs.l = regs.inc8(regs.l);
    mem.write8(regs.hl, 0xc0);
    m.step(0x0e19, 24); // jp 0x0e19
  }

  // tail jump: no push16 -- loc_0e2a's ret returns to loc_0e19's caller.
  return m.call(0x0e2a);
}
