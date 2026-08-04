// SPDX-License-Identifier: GPL-3.0-only
/**
 * runHitEffectInsteadOfPlay — the per-frame gate on the hit-effect latch: while an effect is
 * playing, spend the frame on one beat of that effect INSTEAD of the gameplay update, and tell
 * the caller to abandon the rest of its cascade.
 *
 * Called once per frame from the shared per-frame update cascade, near its head. It reads one
 * byte, the hit-effect latch, and branches on it:
 *
 *   - latch clear -> return true, and the caller runs its ordinary frame: the long run of
 *     updates that follow, starting with the player movement/climb/jump machine.
 *   - latch set -> hand the frame to the effect-sequence router, which advances whichever of
 *     the three effect steps is current, then take the unconditional caller-skip tail, which
 *     answers false. The caller returns immediately, so NONE of the rest of that frame's
 *     gameplay update runs.
 *
 * So the latch suspends gameplay for the duration of an effect: while it is set, the only work
 * the cascade does each frame is one beat of the effect animation, and play resumes on the
 * frame the effect tears itself down.
 *
 * ANY nonzero value counts as set — the gate is a plain zero/nonzero test, not a bit test and
 * not a comparison against 1, even though play only ever puts 0 or 1 in the cell. The
 * distinction is real rather than pedantic: the cell's other reader tests only bit 0.
 *
 * WHAT THE LATCH MEANS. It is set when the swung hammer strikes a hazard, by a routine that
 * runs LATER in the same cascade this one gates — so a hit recorded on one frame first
 * suspends play on the NEXT. It is cleared on the effect sequence's teardown beat, the same
 * beat that resets the sequence to its first step and re-arms the parent effect state machine.
 * That clear is the only way this gate ever reopens.
 *
 * The latch has no shared name: it is engine scratch that this gate and one hazard-animation
 * gate read from opposite ends, so it is kept as a file-local address here.
 *
 * LIVE-OUT: the caller-skip boolean, plus whatever memory the effect beat writes through the
 * router. No register or flag is live: the proceed arm's successor reloads the accumulator
 * from memory as its first act, and the skip arm returns past the caller altogether.
 */

import { dispatchEffectSequenceStep } from "./dispatchEffectSequenceStep.js";
import { loc_1e94 } from "./loc_1e94.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean} true = proceed (the caller runs the rest of its per-frame cascade);
 *   false = skip (the caller abandons the frame's remaining gameplay update).
 */
export function runHitEffectInsteadOfPlay(m) {
  // Nothing playing — the caller gets its ordinary frame.
  if (m.mem.read8(0x6350) === 0) return true; // the hit-effect latch: shared engine scratch

  // An effect is playing: this frame belongs to it. Advance the effect's current step, then take
  // the skip tail, which always answers "abandon the caller's remaining work".
  dispatchEffectSequenceStep(m);
  return loc_1e94(m);
}
