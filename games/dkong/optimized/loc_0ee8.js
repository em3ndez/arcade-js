// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0ee8 — hand-optimized rewrite of the translated routine at ROM 0x0EE8,
 * proven equal to its oracle by the equivalence harness. It touches only board-render
 * scratch (0x63AB tilemap pointer, 0x63B1 vertical extent, 0x63B3 kind) and video RAM,
 * so no ram.js name is imported.
 */

/**
 * loc_0ee8 -- draw a VERTICAL strip (a ladder run).  [ROM 0x0EE8-0x0F1A]
 *
 * The record-kind>=3 arm of the board-layout renderer (loc_0e4f tails here). Kind 4+ is
 * passed straight on to entry_0f1b. Kind exactly 3 lays a vertical run in the tilemap:
 *   - a TOP cap (tile 0xB3) at the record's tilemap address (0x63AB),
 *   - then step HL down one whole tilemap row (+0x20) at a time, writing a BODY tile
 *     (0xB1) each row and decrementing the vertical extent (0x63B1) -- by 0x10 the first
 *     step, 0x08 each row after -- until the subtraction borrows,
 *   - a BOTTOM cap (tile 0xB2) on the borrowing row.
 * Then it steps DE past the record and re-enters the walk at 0x0DA7.
 *
 * The loop counter LIVES IN 0x63B1 (reloaded, decremented, stored every row), not a JS
 * local: it is inside the diffed work RAM, so its intermediate values are observable.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). The
 * kind/cp prologue folds to 20 t (exit 0x0eed, the `jp nz` decision); the taken (kind
 * 4+) arm is a single already-atomic instruction (10 t, tail to entry_0f1b); the
 * not-taken arm plus the whole loop-setup run (top cap + first row-step + first
 * extent decrement) folds to 81 t (exit 0x0eff, the borrow-test `jp c` decision,
 * ALSO the loop's back-edge target). Each loop iteration is itself one basic block
 * (no calls or branches inside it) so it folds to ONE charge per iteration: the
 * loop-continue body (store the decremented extent to 0x63B1, lay a body tile, step
 * one tilemap row, decrement again) folds to 88 t (exit 0x0eff, the back-edge); the
 * loop-exit body (bottom cap + step DE + the walk back-edge) folds to 40 t (exit
 * 0x0da7). Every fold's TOTAL is the oracle's, EXACTLY -- total-preservation keeps
 * the main loop's spin count (0x6019, the PRNG entropy) deterministic. The loop
 * counter 0x63B1 is still written every iteration, in the same order, so its
 * per-row intermediate values stay observable exactly as the oracle leaves them;
 * only the m.step GRANULARITY (once per iteration instead of per instruction)
 * changes. Kind 4+ still reaches entry_0f1b through m.call (the registry).
 *
 * A draw primitive of sub_0da7, whose call graph is not provably mask-cleared on
 * every path, so the collapse coarsens where an in-flight NMI's PC would land (a
 * block/iteration-exit address, not the exact instruction) -- see
 * equivalence-0ee8.test.js for how that is covered (this routine's test is
 * crafted-entry, not a whole-machine/convergent run, so a cycle-total assertion was
 * added there rather than relying on a pixel/PRNG gate).
 */
export function loc_0ee8(m) {
  const { regs, mem } = m;

  // Block A: read the record kind and compare it to 3.  13+7 = 20 t.
  regs.a = mem.read8(0x63b3);
  regs.cp(0x03);
  m.step(0x0eed, 20);
  if (regs.fNZ) {
    m.step(0x0f1b, 10); // jp nz taken -- kind 4+, already one instruction
    return m.call(0x0f1b);
  }

  // Block B (jp nz not taken -- kind exactly 3): lay the TOP cap, step one tilemap
  // row, and load+decrement the vertical extent (the loop's FIRST step).
  //   10+16+7+7+10+11+13+7 = 81 t.
  regs.hl = mem.read16(0x63ab);
  regs.a = 0xb3;
  mem.write8(regs.hl, regs.a);
  regs.bc = 0x0020;
  regs.addHl(regs.bc);
  regs.a = mem.read8(0x63b1);
  regs.sub(0x10);
  m.step(0x0eff, 81);

  for (;;) {
    // loc_0eff -- borrow test
    if (regs.fC) {
      // Block D (run exhausted): bottom cap, step DE past the record, walk
      // back-edge (bare jp, no push16 -- returns to OUR caller).  10+7+7+6+10 = 40 t.
      regs.a = 0xb2;
      mem.write8(regs.hl, regs.a);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x0da7, 40);
      return;
    }
    // Block C (loop continues): store the decremented extent, lay a BODY tile,
    // step one tilemap row, load+decrement the extent again (the SUBSEQUENT
    // step), then loop.  10+13+7+7+10+11+13+7+10 = 88 t.
    mem.write8(0x63b1, regs.a);
    regs.a = 0xb1;
    mem.write8(regs.hl, regs.a);
    regs.bc = 0x0020;
    regs.addHl(regs.bc);
    regs.a = mem.read8(0x63b1);
    regs.sub(0x08);
    m.step(0x0eff, 88);
  }
}
