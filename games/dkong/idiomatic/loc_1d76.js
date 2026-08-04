// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d76 — the "sub-step timer still running" branch of the walk/climb animation
 * stepper; conditionally ticks the timer down.  ROM 0x1D76.
 *
 * entry_1d03 (the player walk/climb animation stepper) jumps here whenever the
 * 4-frame sub-step timer MARIO_MOVE_STEP_TIMER (0x620F) is still non-zero — i.e. the
 * mover is mid-hold between animation sub-steps. This branch decides whether to knock
 * that timer down by one this frame, gated on a flag byte and a climb-limit compare:
 *
 *   - Read the flag at 0x621A. If it is 0 (the ONLY arm attract ever exercises — the
 *     non-zero arm is cold on the tape), decrement the timer via the shared tail and
 *     return.
 *   - If it is non-zero: mirror it into 0x6219, then compare (MARIO_CLIMB_LIMIT_B −
 *     0x13) against Mario's Y (MARIO_Y). If that value is still ≥ Y, HOLD the timer
 *     (return without decrementing); otherwise fall into the shared tail and decrement.
 *
 * The two flag bytes it touches — 0x621A (read) and 0x6219 (written) — are left as hex
 * on purpose: names.js examined both and did NOT name them (0x621A is a "broken-ladder"-
 * looking flag that is ALSO written by an unrelated object arm at 0x2236/0x223F — a
 * shared byte one board can't settle; 0x6219 is a climb toggle with two writers and
 * ZERO absolute reads, so this store is dead as far as any reader is concerned, but is
 * reproduced faithfully for RAM-equivalence). Because that flag's true role is not
 * confidently understood, the routine keeps the neutral loc_1d76 name rather than risk
 * a misleading English one.
 *
 * Reads no live-in register (its first act overwrites A; HL is set, never read), so it
 * takes only the machine. The shared decrement TAIL (entry_1d8a) is already idiomatic
 * as tickMoveStepTimer — called directly, bottom-up, not through the oracle.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d76.test.js.
 * GATE:     exhaustive-grid — a total function of four bytes (0x621A, MARIO_CLIMB_LIMIT_B,
 *           MARIO_Y, 0x620F). The compare arm (the (limit−0x13) vs Y decision, incl. the
 *           sub-0x13 wrap) is swept EXHAUSTIVELY over the full 256×256 (limit,Y) grid for
 *           both the zero and a non-zero flag; flag and timer each swept over all 256
 *           values; plus real captured attract dispatches (all flag==0) and crafted
 *           entries for the cold non-zero arm. Reached only via entry_1d03, in-NMI.
 * LIVE-OUT: memory-only — mem[0x6219] (:= flag, on the non-zero arm) and mem[0x620F]
 *           (:= timer−1, on the decrement arms). The oracle's residual A (= limit−0x13,
 *           or the decremented timer) and F (from cp / dec) are dead ABI: the walk/climb
 *           stepper's caller cascade (loc_197a @ 0x1983 → call 0x1f72, same exit the tail
 *           tickMoveStepTimer documents) overwrites them before any read. SP/PC are the
 *           oracle's ret mechanism, replaced by the JS return, so not in the contract.
 * NAMES:    MARIO_Y (0x6205), MARIO_CLIMB_LIMIT_B (0x621C) — from names.js. 0x621A / 0x6219
 *           kept hex: names.js left both unnamed (shared / dead — see role paragraph).
 */

import { MARIO_Y, MARIO_CLIMB_LIMIT_B } from "./names.js";
import { tickMoveStepTimer } from "./tickMoveStepTimer.js";

// The gate flag (0x621A) and its mirror (0x6219). names.js examined and did NOT name
// either — 0x621A is a shared byte (also written at 0x2236/0x223F); 0x6219 is
// write-only with zero absolute readers. Kept hex so the code doesn't imply a meaning
// the evidence doesn't support.
const CLIMB_FLAG = 0x621a;
const CLIMB_FLAG_MIRROR = 0x6219;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function loc_1d76(m) {
  const { mem } = m;

  // ld a,(0x621a) / and a / jp z,0x1d8a — flag zero: just tick the timer down.
  const flag = mem.read8(CLIMB_FLAG);
  if (flag === 0) {
    tickMoveStepTimer(m); // shared tail entry_1d8a: dec (0x620F)
    return;
  }

  // ld (0x6219),a — mirror the flag (a dead store; reproduced for RAM-equivalence).
  mem.write8(CLIMB_FLAG_MIRROR, flag);

  // ld a,(0x621c) / sub 0x13 / ld hl,0x6205 / cp (hl) / ret nc —
  // hold the timer while (limit − 0x13) is still at or past Mario's Y (cp: no borrow →
  // no carry → limit−0x13 >= Y); the sub is 8-bit, matching `sub 0x13`.
  const threshold = (mem.read8(MARIO_CLIMB_LIMIT_B) - 0x13) & 0xff;
  if (threshold >= mem.read8(MARIO_Y)) return;

  // fall into the shared tail: dec (0x620F).
  tickMoveStepTimer(m);
}
