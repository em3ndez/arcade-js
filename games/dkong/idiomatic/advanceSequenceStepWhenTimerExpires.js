// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSequenceStepWhenTimerExpires — advance the pointed-at sequence step once the sub-state timer expires.  ROM 0x3069.
 *
 * A gated INDIRECT increment. Each call ticks the sub-state countdown SUBSTATE_TIMER
 * (0x6009) down by one through the rst-0x18 helper (tickSubstateTimer); only on the
 * frame the counter reaches zero does the body run and bump the step byte the
 * SEQ_ADVANCE_PTR word (0x63C0) points at. This is the single-level rst-0x18 gate — it
 * ticks only the high half 0x6009, NOT the two-level 0x6008/0x6009 prescaler its sibling
 * clearSubstateWhenTimerExpires runs through rst 0x20. While the counter is still above
 * zero the increment is skipped and nothing but the decrement happens this frame.
 *
 * The target is reached INDIRECTLY: `ld hl,(0x63C0)` loads the WORD stored at 0x63C0 and
 * increments the byte at THAT address, never 0x63C0 itself — the pointer cell is left
 * untouched. Setup routines re-point it (loc_0ae8/loc_0b06 aim it at INTRO_STEP 0x6385
 * for the opening cutscene, loc_17b6 at BOARD_ADVANCE_STEP 0x6388 for the how-high
 * render), so this one helper advances whichever render-sequence step is currently
 * armed. Both seeds and the indirection were observed live in MAME: the pointer took
 * 0x6385 for 619 frames and 0x6388 for 1597, holding constant while the byte it pointed
 * at walked, and this routine's own `inc (hl)` shows up in the write attribution of the
 * pointed-at cell. The increment wraps mod 256 like the Z80 `inc (hl)`.
 *
 * Polarity matters: the body runs only on EXPIRY (counter hit zero), and is skipped
 * while it is still counting down — reading the gate the other way inverts the routine.
 *
 * The oracle expresses "skip the body" with the caller-skip method: on the still-counting
 * path the rst-0x18 helper discards this routine's own return slot so control resumes in
 * its caller, cutting THIS body short. It can never skip its OWN caller, so it returns
 * true on both paths (a constant the dispatcher ignores) — the direct-call form drops the
 * stack surgery, consuming the helper's boolean as `if (!tickSubstateTimer(m)) return true;`.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3069.test.js.
 * GATE:     exhaustive — a total function of SUBSTATE_TIMER (0x6009) and the byte the
 *           SEQ_ADVANCE_PTR word points at; candidate == oracle on RAM (minus STACK_SCRATCH)
 *           over all 256×256 (timer, target-byte) combos, plus a pointer-target sweep that
 *           proves the increment lands at *(0x63C0) and never on 0x63C0 itself. Reached
 *           through an untranslated dw jump table (2 refs). REACHABILITY IS GROUNDED, and it
 *           has two halves — observed live in MAME 0.288 on the real dkong ROM (understanding
 *           pass 12). In ATTRACT it is never dispatched: ZERO fetches of 0x3069 over 14546
 *           attract frames, re-confirmed on the real ROM, so attract offers nothing to
 *           capture and the exhaustive sweep is the whole equivalence proof. But in EVERY
 *           CREDITED GAME it IS live: 0x3069 fetched 64× in each of the 1P / 50m / 75m / 100m
 *           runs and 128× in the board-advance run, first at frame 778 during the opening
 *           cutscene (substate 7) and again in the board-advance state. It is a live dispatch
 *           path once a game is credited, not dead code. The expiry polarity was grounded
 *           there too, with a built-in negative control twice over: the timer counted 32→1
 *           across 32 frames with the target byte held, and the step advanced only on the
 *           frame the timer read 0.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (0x6009) decremented inside the callee, and the
 *           byte at *(SEQ_ADVANCE_PTR) incremented on the expiry frame. The oracle returns
 *           a constant true on both paths (it cannot skip its own caller); no caller reads
 *           it, and its residual HL/A/F and the SP/PC churn are the dead caller-skip
 *           mechanism this boolean replaces.
 * NAMES:    SEQ_ADVANCE_PTR (0x63C0) — from ram.js; SUBSTATE_TIMER (0x6009) is named and
 *           ticked inside the tickSubstateTimer callee.
 */

import { SEQ_ADVANCE_PTR } from "./ram.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

/**
 * @param {object} m  the machine (uses m.mem, plus the callee's tick of 0x6009).
 * @returns {boolean} always true — it cannot skip its own caller (kept so an erroneous
 *   `if (!advanceSequenceStepWhenTimerExpires(m)) return;` is inert rather than a live defect).
 */
export function advanceSequenceStepWhenTimerExpires(m) {
  const { mem } = m;

  // rst 0x18 — tick the sub-state countdown; skip the increment unless it expired this
  // frame. The callee never skips OUR caller, so we return true either way.
  if (!tickSubstateTimer(m)) return true;

  // Counter expired: advance the step byte the SEQ_ADVANCE_PTR word points at. INDIRECT —
  // the target is the word AT 0x63C0, not 0x63C0 itself; the pointer cell is untouched.
  const target = mem.read16(SEQ_ADVANCE_PTR);
  mem.write8(target, (mem.read8(target) + 1) & 0xff); // inc (hl) — wraps mod 256

  return true;
}
