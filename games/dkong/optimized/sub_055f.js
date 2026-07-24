// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_055f — hand-optimized rewrite of the translated routine at ROM 0x055F,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. sub_055f is a LEAF (it calls nothing), so there is no
 * `m.call` here — only RAM *names* are imported (from ram.js). It is reached
 * ONLY by `m.call(0x055f)` from entry_051c (ROM 0x051C, task-table entry 0), at
 * that routine's 0x051E and 0x0550 call sites.
 */

import { CURRENT_PLAYER, P1_SCORE, P2_SCORE } from "./ram.js";

/**
 * sub_055f -- select the CURRENT player's 3-byte BCD score base into DE.
 * [ROM 0x055F-0x056A, 12 bytes, 6 instructions -- a leaf, two ordinary `ret` exits]
 *
 *   055f  11 b2 60   ld   de,0x60b2   ; DE = P1_SCORE (the default)
 *   0562  3a 0d 60   ld   a,(0x600d)  ; A  = CURRENT_PLAYER
 *   0565  a7         and  a           ; set Z from A (also clears C, sets H)
 *   0566  c8         ret  z           ; player 0 -> keep P1_SCORE, return
 *   0567  11 b5 60   ld   de,0x60b5   ; DE = P2_SCORE (overwrites the 0x055F load)
 *   056a  c9         ret
 *
 * WHAT IT DOES. Picks which player's score the caller will read/write: DE is
 * loaded with P1_SCORE unconditionally, then OVERWRITTEN with P2_SCORE unless
 * CURRENT_PLAYER (0x600D) is zero. The fall-through IS the selection -- the same
 * "load the default, `ret z`, else load the alternate" shape handler_05c6 uses at
 * 0x05CB/0x05D2. entry_051c calls it twice (0x051E, 0x0550) so its BCD score-add
 * and its high-score copy operate on the live player's score triple.
 *
 * INPUTS.  RAM read: CURRENT_PLAYER (0x600D). No register is read as an input --
 * the incoming DE and A are both overwritten before use.
 * OUTPUTS.  DE = P1_SCORE (0x60B2) when CURRENT_PLAYER == 0, else P2_SCORE
 * (0x60B5). It writes NO memory: its entire contract is the DE register.
 * CLOBBERS.  A = CURRENT_PLAYER at both exits; F = the `and a` result (Z from A,
 * C cleared, H set, S/PV from A). entry_051c consumes neither (the 0x051E call is
 * followed by `ld a,c`, the 0x0550 call by `ld hl,0x60b8`) -- but the unit gate
 * compares the WHOLE register file incl. A and F, so both are reproduced verbatim:
 * A is left = mem(CURRENT_PLAYER) and F = the `and a` flags via regs.and(regs.a).
 *
 * FLAGS.  regs.and(regs.a) is kept for its Z (it decides the branch AND is the
 * observed F at both exits). No other op here touches flags.
 *
 * ATOMICITY -- sub_055f itself makes no call and cannot span a frame, but ATOMICITY
 * IS PER-CALL-PATH: its ONLY caller, entry_051c, is a MAIN-LOOP routine (dispatched
 * by dispatchTask with the NMI mask ENABLED), so the vblank NMI CAN fire while this
 * leaf executes -- theoretically interruptible. GATED CONVERGENT, not strict,
 * unconditionally: per the collapse-sweep's blanket rule, any routine with a
 * whole-machine test is gated convergent regardless of whether the fold happens to
 * pass strict in a given scenario, since that would only be a property of the
 * tested trajectory, not proof of atomicity on every trajectory.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. Branch totals, each the
 * oracle's EXACTLY: P1 (ret z) -- pre-branch(27) + ret(11) = 38 t; P2 (fall
 * through) -- pre-branch(27) + jr-not-taken+ld-de fold(15) + ret(10) = 52 t.
 *
 * The optimization delivered on this tiny leaf is therefore the names (P1_SCORE /
 * P2_SCORE / CURRENT_PLAYER), structured control flow, and this documented
 * contract, plus the collapse -- behaviour is byte-for-byte the oracle's and the
 * cycle TOTAL on each branch matches exactly.
 */
export function sub_055f(m) {
  const { regs, mem } = m;

  // Block A: ld de,0x60b2 (default P1_SCORE) + ld a,(0x600d) + and a.  10+13+4 = 27 t
  regs.de = P1_SCORE;
  regs.a = mem.read8(CURRENT_PLAYER);
  regs.and(regs.a); // Z from A; clears C, sets H -- also the observed F at both exits
  m.step(0x0566, 27);

  if (regs.fZ) {
    // ret z: player 0 -- keep DE = P1_SCORE. (branch total 27+11 = 38 t)
    m.ret(11);
    return;
  }

  // jr-not-taken(5) + ld de,0x60b5(10) -- DE = P2_SCORE, overwriting the P1 load.  15 t
  regs.de = P2_SCORE;
  m.step(0x056a, 15);

  m.ret(); // unconditional ret at 0x056a (default 10 t; branch total 27+15+10 = 52 t)
}
