// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSequenceStepWhenTimerExpires — advance the pointed-at sequence step once the
 * sub-state timer expires.
 *
 * A gated INDIRECT increment. Each call ticks the sub-state countdown down by one; only on
 * the frame that counter reaches zero does the body run and bump the step byte the
 * SEQ_ADVANCE_PTR word points at. This is the single-level gate — it ticks only the sub-state
 * timer itself, not the two-level prescaler its sibling helper runs through. While the counter
 * is still above zero the increment is skipped and nothing but the decrement happens this
 * frame.
 *
 * The target is reached INDIRECTLY: the WORD stored in SEQ_ADVANCE_PTR names the address, and
 * the byte at THAT address is incremented — the pointer cell itself is left untouched. Setup
 * routines re-point it at whichever render sequence is running (the opening cutscene's step,
 * or the how-high render's board-advance step), so this one helper advances whichever
 * render-sequence step is currently armed. The increment wraps at 8 bits.
 *
 * Polarity matters: the body runs only on EXPIRY, and is skipped while the timer is still
 * counting down — reading the gate the other way inverts the routine.
 *
 * The hardware expresses "skip the body" with the caller-skip idiom: on the still-counting
 * path the tick helper discards this routine's own return slot so control resumes in its
 * caller, cutting THIS body short. It can never skip its OWN caller, so it reports true on
 * both paths — a constant the dispatcher ignores — and the boolean the tick helper returns is
 * what drives the early exit here.
 *
 * LIVE-OUT: memory-only — the sub-state timer decremented inside the tick, and the byte at
 * *(SEQ_ADVANCE_PTR) incremented on the expiry frame. The constant true return exists only so
 * that a caller written to consume a skip is inert.
 */

import { SEQ_ADVANCE_PTR } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

/**
 * @param {object} m  the machine (uses m.mem, plus the sub-state tick).
 * @returns {boolean} always true — it cannot skip its own caller (kept so an erroneous
 *   `if (!advanceSequenceStepWhenTimerExpires(m)) return;` is inert rather than a live defect).
 */
export function advanceSequenceStepWhenTimerExpires(m) {
  const { mem } = m;

  // Tick the sub-state countdown; skip the increment unless it expired this frame. The tick
  // never skips OUR caller, so we report true either way.
  if (!tickSubstateTimer(m)) return true;

  // Counter expired: advance the step byte the SEQ_ADVANCE_PTR word points at. INDIRECT —
  // the target is the word stored THERE, and the pointer cell itself is untouched.
  const target = mem.read16(SEQ_ADVANCE_PTR);
  mem.write8(target, (mem.read8(target) + 1) & 0xff); // wraps at 8 bits

  return true;
}
