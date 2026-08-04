// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1b4e — commit this frame's ladder-extent limits, then drive the Up-climb.  ROM 0x1B4E.
 *
 * The "collision cleared, keep climbing" tail of the hammer-climb collision handler
 * (loc_1afe). Its still-translated caller has just computed the two ladder-extent limits for
 * the current climb and hands them in — one from Mario's current height, one from the girder
 * scan — then branches here. This routine stores that pair into the two climb-limit cells the
 * climb stepper later compares Mario against, and falls straight into the Up-climb input guard.
 *
 * The caller's other (fall-through) branch stores the SAME pair into the SAME two cells but in
 * the OPPOSITE order, so which limit is "top" vs "bottom" is not fixed by this routine — the
 * two are a pair the stepper tests together (it stops the climb when the new height matches
 * EITHER one). This branch stores the first-given limit into MARIO_CLIMB_LIMIT_A and the
 * second into MARIO_CLIMB_LIMIT_B.
 *
 * After committing the pair it hands off to climbUpWhileHeld, which advances Mario's climb
 * this frame only while Up is held — this routine writes no further memory of its own.
 *
 * Name: kept the neutral loc_ — the mechanism (store the limit pair, then climb) is pinned to
 * the oracle, but the pair's top/bottom roles are deliberately unsettled in names.js, so the
 * routine is not promoted past its confirmed mechanism.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1b4e.test.js.
 * GATE:     real captured 0x1B4E dispatches from an attract run (the hammer-climb path fires
 *           it, always with Up held so the climb arm runs) + crafted entries that pin both
 *           climb-limit writes and drive the idle arm (Up clear). climbUpWhileHeld and its
 *           climb chain are already idiomatic and direct-called, so this composes their
 *           equivalence; the dead STACK_SCRATCH the dissolved climb tail-call churns is
 *           excluded. Teeth: a swapped-order twin and a dropped-write twin.
 * LIVE-OUT: memory-only — the two climb-limit cells here, plus whatever the climb chain writes
 *           on the Up arm. The caller consumes no register this leaves, and the whole chain
 *           nets exactly one caller-return.
 * NAMES:    MARIO_CLIMB_LIMIT_A (0x621B), MARIO_CLIMB_LIMIT_B (0x621C) from names.js. The two
 *           limit values arrive in registers from the still-translated caller (a genuine
 *           oracle boundary), so they are read from there directly; the caller's pointer at
 *           the block base just below the pair is invariantly 0x621A, so the two stores resolve
 *           to the named cells.
 */

import { MARIO_CLIMB_LIMIT_A, MARIO_CLIMB_LIMIT_B } from "./names.js";
import { climbUpWhileHeld } from "./climbUpWhileHeld.js"; // ROM 0x1B45

/**
 * @param {object} m  the machine. Reads the two ladder-extent limits from the caller's
 *                    registers (oracle boundary); otherwise touches only m.mem.
 * @returns {void}
 */
export function loc_1b4e(m) {
  const { regs, mem } = m;

  // Store the two ladder-extent limits the caller computed for this climb. This branch takes
  // them in the order (first -> A, second -> B); the caller's other branch stores them swapped.
  mem.write8(MARIO_CLIMB_LIMIT_A, regs.b);
  mem.write8(MARIO_CLIMB_LIMIT_B, regs.d);

  // Keep climbing: advance Mario's upward climb this frame if Up is held.
  climbUpWhileHeld(m);
}
