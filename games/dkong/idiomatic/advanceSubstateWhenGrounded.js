// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateWhenGrounded — hold this sub-state until Mario has landed, then
 * advance to the next sub-state and abort the rest of the frame.
 *
 * The WAIT+EXIT step of the bonus-expired sub-state sequence. Once that sequence has
 * run its INIT and DELAY steps it lands here, and this step is then dispatched every
 * frame, gating the final advance on Mario being on solid ground:
 *
 *   - MARIO_AIRBORNE != 0 — Mario is still jumping or falling: do nothing and return
 *     true, so the per-frame update cascade runs to completion normally. The step
 *     keeps waiting next frame.
 *   - MARIO_AIRBORNE == 0 — Mario has landed: run the shared advance tail, which steps
 *     the in-game sub-state index on to the next handler and re-arms its 64-frame
 *     wait; then return false.
 *
 * The `false` return is the caller-skip signal. It does not merely return from this
 * step: it aborts the rest of the per-frame cascade for this frame, so the frame's
 * remaining updates do not run.
 *
 * A near-leaf: it reads one byte and, on the grounded arm, defers all memory writes to
 * the shared advance tail. It loads its own state; the caller's registers are not a
 * live-in.
 *
 * LIVE-OUT: memory-only on the grounded branch — the sub-state index (incremented) and
 * its timer (re-armed), both written by the shared tail — PLUS the boolean caller-skip
 * return, which is the control signal the frame's cascade consumes.
 */

import { MARIO_AIRBORNE } from "./names.js";
import { advanceSubstateAndArmTimer } from "./advanceSubstateAndArmTimer.js";

export function advanceSubstateWhenGrounded(m) {
  const { mem } = m;

  // While Mario is airborne, keep waiting: the cascade continues normally this frame
  // (the caller sees "continue").
  if (mem.read8(MARIO_AIRBORNE) !== 0) return true;

  // Grounded: advance the in-game sub-state and re-arm its timer via the shared
  // tail, then caller-skip (abort the rest of this frame's cascade).
  advanceSubstateAndArmTimer(m);
  return false;
}
