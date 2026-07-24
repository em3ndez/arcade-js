// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_03f2 — hand-optimized rewrite of the translated routine at ROM 0x03F2,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. It calls nothing (a leaf), so there are no `m.call`
 * callees here; only the RAM name SPIN_COUNT is imported (from ram.js). The
 * addresses it does NOT name (0x6A29, supplied by the caller in HL) stay hex.
 */

import { SPIN_COUNT } from "./ram.js";

/**
 * sub_03f2 -- conditional double-store of a sprite byte, gated on the spin count.
 * [ROM 0x03F2-0x03FA; the periodic-event tail of sub_03a2, called from BOTH its
 * arms — 0x03CE (B=0x42) and 0x03EC (B=0x40).]
 *
 *   03f2  70           ld  (hl),b        ; store B at (HL)
 *   03f3  3a 19 60     ld  a,(0x6019)    ; A = SPIN_COUNT
 *   03f6  0f           rrca              ; bit 0 of the spin count -> carry
 *   03f7  d8           ret c             ; bit set: leave (HL) = B, done
 *   03f8  04           inc b             ; else B := B+1 ...
 *   03f9  70           ld  (hl),b        ; ... and store AGAIN at the SAME (HL)
 *   03fa  c9           ret
 *
 * WHAT IT DOES. Stores B at (HL), then reads the spin counter and rotates its
 * bit 0 into carry. If that bit is SET it returns immediately, leaving (HL) = B.
 * If it is CLEAR it increments B and stores AGAIN at the SAME address (there is
 * no `inc hl` between the two stores), so (HL) ends B+1. So the low bit of the
 * spin count — a per-frame-jittery pseudo-random value (ram.js SPIN_COUNT) —
 * flips the stored sprite byte between B and B+1 roughly every other frame,
 * which is the flicker/animation this leaf produces at the caller's cell.
 *
 * THE DOUBLE STORE IS DELIBERATE AND KEPT. On the not-taken branch the first
 * store (B) is immediately overwritten by the second (B+1), so it is invisible
 * in FINAL state — but it is a real bus write, visible in the emit `--writes`
 * trace even though the state diff cannot see it (the oracle's own note). Both
 * stores are reproduced verbatim so the write sequence to (HL) is byte-identical
 * to the oracle, not just the final value; the equivalence unit gate confirms the
 * final value and the equivalence-03f2 write-sequence test pins both writes.
 *
 * INPUTS: HL (the target address, 0x6A29 from sub_03a2) and B (0x40 or 0x42 from
 *   sub_03a2), both pre-loaded by the caller; SPIN_COUNT (0x6019). No other RAM
 *   read. OUTPUTS: (HL) — B or B+1; register B (B+1 on the not-taken branch);
 *   A (= the rotated spin count); F (see below). HL is unchanged.
 *
 * FLAGS. No caller consumes sub_03f2's flags directly: sub_03a2's 0x03CE arm
 *   `jp 0x03de`s past any flag test, and its 0x03EC arm recomputes F with a
 *   `dec (hl)` before its next `ret cc`. But F still reaches diffed RAM through
 *   the NMI's `push af`, and the unit gate compares the whole register file, so
 *   `rrca` and `inc8` are kept VERBATIM — the returned F is `rrca`'s on the taken
 *   branch (C = old bit 0, N=H=0, S/Z/PV preserved) and `inc8(B)`'s on the not-
 *   taken branch (C preserved 0 from the rrca). A is likewise kept exact (the
 *   rotated spin count) because it flows out unmodified on the taken arm.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block: the prologue (store + read
 * SPIN_COUNT + rrca) folds to one 24t charge before the `ret c` decision; the
 * not-taken continuation (its own 5t + inc b + the second store + the routine's own
 * ret) folds to one 26t charge at the final `m.ret`. Both fold totals are the exact
 * sum of the oracle's per-instruction charges they replace: 24+11=35t (taken),
 * 24+26=50t (not-taken) -- unchanged from the oracle.
 *
 * ATOMIC? NO. sub_03f2 is a leaf reached ONLY via `m.call(0x03f2)` from sub_03a2, and
 * sub_03a2 is called from the MAIN LOOP (mainloop.js ROM 0x02E1) with the vblank NMI
 * mask ENABLED, so the NMI genuinely CAN fall between any two of sub_03f2's
 * instructions. Per the lead's collapse-sweep rule the whole-machine gate is
 * therefore the CONVERGENT one UNCONDITIONALLY (equivalence-03f2.test.js), never the
 * strict one -- a strict pass on any single scenario is a property of that scenario
 * (whether the NMI happened to land inside), not proof of safety, which is exactly
 * why per-instruction was kept here before the convergent gate existed. The double
 * store is UNCHANGED (still two separate mem.write8 calls in the same order), so the
 * write-sequence test (dropped-first-store teeth) still has something to catch.
 */
export function sub_03f2(m) {
  const { regs, mem } = m;

  // ld (hl),b / ld a,(SPIN_COUNT) / rrca -- 7+13+4 = 24t. The first store is kept
  // (on the not-taken branch it is overwritten below, but it is a real bus write,
  // trace-visible, state-invisible); rrca rotates the spin count's bit 0 into carry.
  mem.write8(regs.hl, regs.b);
  regs.a = mem.read8(SPIN_COUNT);
  regs.rrca();
  m.step(0x03f7, 24);

  if (regs.fC) {
    m.ret(11); // ret c taken -- bit0 set, leave (HL) = B. path total 24+11 = 35t.
    return;
  }

  // ret c not-taken(5) + inc b(4) + ld (hl),b(7) + the routine's own ret(10) = 26t,
  // straight-line to the routine's own return (no further branch, no stack op between
  // them). B := B+1, store again at the SAME address ((HL) ends B+1).
  regs.b = regs.inc8(regs.b);
  mem.write8(regs.hl, regs.b);
  m.ret(26); // not-taken path total 24+26 = 50t.
}
